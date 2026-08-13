# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TONTONKAD** is an Electron desktop application for designing and dimensioning electrical cable trays, conduits, and multi-tubing boxes with interactive 2D rendering. The application targets electrical engineers and contractors who need to optimize the placement of circular conduits (fourreaux) within rectangular cable trays while respecting occupancy rates and structural constraints.

- **Version**: 2.7.0
- **Platform**: Electron (Windows/Mac/Linux)
- **Core Technology**: Vanilla JavaScript, HTML5 Canvas, Konva.js for rendering
- **Build Tool**: Vite (development), electron-builder (distribution)
- **Testing**: Jest

## Architecture Overview

### Three-Process Model (Electron)

```
┌─────────────────────────────────────────────┐
│      Main Process (src/main/main.js)        │
│  - Window management, file I/O, auto-update │
│  - Config management (dataPath, theme)      │
│  - IPC handlers for CSV loading, exports    │
└─────────────────────────────────────────────┘
          ↑                              ↑
         IPC                            IPC
          ↓                              ↓
┌──────────────────────────┐  ┌─────────────────────────┐
│  Preload (contextBridge) │  │ Renderer (script.js)    │
│  src/preload/preload.js  │  │ HTML5 Canvas 2D engine  │
│  - Secure API exposure   │  │ Physics simulation      │
│  - Window controls       │  │ UI event handling       │
└──────────────────────────┘  └─────────────────────────┘
```

### Renderer Layer: Two-Canvas System

The renderer uses a **hybrid rendering approach**:

1. **HTML5 Canvas 2D** (`canvas#world` in index.html):
   - Physics simulation and collision detection
   - Drawing cable trays, buttons, grid
   - Zoom, pan, and high-DPI optimization
   - Main event loop (~15ms per frame)

2. **Konva.js Layer** (`konva-fourreaux.js`):
   - Overlaid on top of Canvas 2D (pointer-events: none)
   - Renders conduits with snap guides during drag
   - Separated from Canvas to allow independent updates
   - Positioned absolutely at (0, 0) with same viewport

**Key Design**: Canvas handles physics/grid, Konva handles visual feedback. This separation avoids full Canvas redraws on every drag gesture.

### Business Logic: Placement Engine (packer)

**File**: `src/renderer/packer.js` (~210 lines) — built on the `maxrects-packer` library (`maxrects-packer.min.js`). Tested in `tests/packer.test.js`.

Optimized placement uses bin-packing (MaxRects), not a bespoke engine. API exposed via `window.PACKER`:

- **`solve(tubes, opts)`** - computes one layout. Free mode favors a "trench" shape (width ≥ height, ratio 1–2) that is as compact as possible; locked mode (`opts.lock = 'w' | 'h'`) preserves the imposed axis.
- **`variants(tubes, opts)`** - up to 3 candidate layouts, tagged (`compact`, `tranchee`, `rect43`) and de-duplicated.
- **`anchorLayout(cfg, box)`** - anchors a layout into an existing box: laid at the BOTTOM (lit de pose), centered horizontally; a free axis is only grown (to the next multiple of 5) if the layout does not fit. Converts to canvas coordinates (circle centers, mm).
- **`GEO`** (`{ gap, margin }`) - entraxe and lit de pose, driven by the control-bar sliders in the UI.

Business principle: the largest conduits sit at the bottom (gravity); a trench is dug wide rather than deep.

**Coordinate System**: Y=0 at bottom, increases upward (inverted from canvas). Margins (`litDePose`) enforced on all sides.

### Pure Core Modules (extracted, packer-style)

Besides `packer.js`, several business-logic pieces have been extracted out of `script.js` into small, dependency-free files that follow the same convention: no DOM/canvas access and no mutated globals (inputs/outputs only, or an injected resolver callback such as `resolveOd`); each is exposed both as `window.<Namespace>` for the runtime (loaded via `<script>` in `index.html`) and as `module.exports` for Jest, so `tests/*.test.js` can `require()` the file directly without a DOM. `script.js` and `big-brain-panel.js` call into these namespaces rather than reimplementing the logic.

| Module | Namespace | Responsibility | Test |
|---|---|---|---|
| `geometry.js` | `window.Geom` | Circle area, occupancy rate, rounding to a step | `geometry.test.js` |
| `csv.js` | `window.CSVUtil` | CSV text → array of objects (feeds `data/*.csv` loading) | `csv.test.js` |
| `compat-chambres.js` | `window.CompatChambres` | Compatible chambre de tirage (StradEasy) lookup from tray dimensions | `compat-chambres.test.js` |
| `pdf-format.js` | `window.PdfFormat` | Label formatting for PDF export | `pdf-format.test.js` |
| `inventory-agg.js` | `window.InventoryAgg` | Aggregates placed fourreaux/câbles into inventory counts | `inventory-agg.test.js` |
| `circuit.js` | `window.Circuit` | Translates a circuit (phases/neutral/PE) into a flat cable list | `circuit.test.js` |
| `phase-assign.js` | `window.PhaseAssign` | Assigns L1/L2/L3/N/PE to individual cable units | `phase-assign.test.js` |
| `cable-assign.js` | `window.CableAssign` | Packs a liaison's cables into fourreaux (built on `packer.js`) | `cable-assign.test.js` |
| `big-brain.js` | `window.BigBrain` | Pure adapter between `CableAssign`/reserve output and the panel | `big-brain.test.js` |
| `caneco-import.js` | `window.CanecoImport` | Parses raw Caneco cable-schedule rows (`.xls`/`.xlsx`) into BIG BRAIN liaison drafts | `caneco-import.test.js` |

### BIG BRAIN: Circuit → Cable → Fourreau Pipeline

The "🧠 BIG BRAIN" sidebar tab (3rd tab — `#tabBIGBRAIN` / `#paneBIGBRAIN` in `index.html`) lets a user describe electrical **liaisons** and auto-generates the individual cables and their fourreau placement, instead of placing everything by hand. A liaison is one of two mutually-exclusive kinds, flagged by the presence of a `reserve` field:

- **Circuit liaison** (`circuit: {...}`) — phases + neutral + PE chosen from the cable catalogue, translated into cables and packed into fourreaux.
- **Reserve liaison** (`reserve: { type, code, qty }`) — a fourreau type/size + quantity chosen directly by the user; generates empty fourreaux (no cables, no packing), for spare capacity left in a run.

Pipeline, front to back:

1. **`big-brain-panel.js`** (~1,100 lines) — DOM controller for the sidebar tab only (IIFE + `DOMContentLoaded`, no business logic), à la `settings-modal.js`. Holds the in-memory list of liaisons for the session; liaisons can be created by hand, duplicated, or imported in bulk from a Caneco cable schedule (see below).
2. Liaisons are split by kind: circuit liaisons go through `window.BigBrain.validateLiaisons` → `window.Circuit.circuitToCables` (one circuit → `{ fam, code, od, qty, fonction }[]`, `fonction` ∈ `phase | neutre | PE | aucune`) → `window.PhaseAssign` (assigns L1/L2/L3/N/PE, cycling phases) → `window.CableAssign.assignCablesToFourreaux` (packs the unrolled cables into fourreaux, built on `packer.js`). Reserve liaisons go through `window.BigBrain.validateReserves` → `window.BigBrain.buildReserveFourreaux` (expands `qty` into that many empty fourreau entries, catalogue spec resolved directly, no packing).
3. **`window.BigBrain.buildGenerationResult(cableResult, reserveLiaisons, catalogue)`** — merges the two outputs into one `{ fourreaux, nonPlaces }` (reserves never produce `nonPlaces`; they're pre-validated).
4. **`bigBrainGenerate()`** (`script.js`, exposed as `window.bigBrainGenerate`) — creates and places the resulting fourreaux/cables on the canvas, via the shared `makeFourreauObject()` helper (also used by the inventory's "Placement Auto"). Both this and "Placement Auto" share one Remplacer/Ajouter confirmation (`confirmReplaceOrAdd()`, exposed as `window.confirmReplaceOrAdd`) — never a silent overwrite of an existing plan.

**Caneco import**: the "📥 Import Caneco" button opens a modal that reads a Caneco cable-schedule export (`.xls`/`.xlsx`, no header row), parses it with `window.CanecoImport.parseWorkbook` (pure — no DOM), and lets the user pick which detected rows become new circuit liaisons. SheetJS (`xlsx.full.min.js`, ~860 KB) is **not** loaded eagerly by `index.html`; `big-brain-panel.js` injects it as a `<script>` tag on first use (prefetched when the modal opens, awaited before parsing) so the ~860 KB parser doesn't cost every user on startup for a rarely-used feature.

Tested end-to-end in `tests/big-brain-integration.test.js`, which locks the invariant that L1/L2/L3/N/PE are never mixed even when they share the exact same catalogue code (e.g. an all-1x185 circuit) — the case where a regression indexing by code alone would be invisible.

### Main Script: Canvas & Physics Engine

**File**: `src/renderer/script.js` (~12,200 lines)

This is the core application logic, structured as an IIFE with distinct sections:

#### Constants & Physics (Lines 1-130)
- `MM_TO_PX` - Unit conversion (typically 0.5)
- Physics parameters: `GRAVITY`, `AIR_DRAG`, `RESTITUTION`, `FRICTION_GROUND`
- Display constants: `CANVAS_MARGIN`, `DEFAULT_STROKE_WIDTH`, grid spacing
- Grid system: `GRID_SPACING_MAIN` (50mm), `GRID_SPACING_SUB` (10mm)

#### Global State (Lines 140-250)
- `canvas`, `ctx` - Canvas 2D context
- `currentZoom` (25-500%)
- `pixelRatio`, `displayScale` - High-DPI adaptation
- `actionHistory[]` - Undo/redo stack (max 50 items)
- `draggedObject`, `virtualSlots[]` - Drag-and-drop state
- `previewFourreau`, `pendingFourreauType` - Placement previews

#### Coordinate Transforms (Lines 260-330)
- `setupCanvasOffsetAndScale()` - Aligns world ↔ canvas pixels accounting for:
  - Device pixel ratio (DPI scaling)
  - User zoom level
  - Canvas margin (100px border)
  - Display scale (responsive)
- **Critical**: All drawing calls use world coordinates; transforms applied once at ctx.setTransform()

#### Physics Loop (Lines 800-1200)
- `applyPhysics()` - Per-object:
  - Gravity + drag
  - Collision detection (box-circle)
  - Damping on collisions
  - Ground friction
- Runs ~8 iterations per frame for stability
- Positions updated, constraints enforced (bounds checking)

#### Rendering Pipeline (Lines 1300-2000)
- `drawGrid()` - Fixed or adaptive grid
- `drawTray()` - Rectangle with labels, dimension displays
- `drawCable()` - Thin lines within tray
- `drawFourreau()` - Circles with:
  - Cross pattern (X marking center)
  - Labels (code, diameter)
  - Selection highlight (green border)
  - Occupancy color coding
- `drawButtons()` - "Add Fourreau", "Reduce", etc. (SVG-based)
- Full canvas clear + redraw each frame

#### Interaction Handlers
- **Mouse**: `mousedown` → select object, start drag or add fourreau
- **Drag**: `mousemove` → update position, physics, snap guides (Konva)
- **Middle-click**: Quick fourreau add from toolbar
- **Keyboard**:
  - `Ctrl+Z` / `Ctrl+Shift+Z` - Undo/redo via actionHistory
  - `Ctrl+G` - Toggle grid
  - `Ctrl+T` - Toggle theme (light/dark)
  - `Ctrl+N/O/S` - New/open/save project
- **Zoom**: `Ctrl+Wheel` to scale (stored in `currentZoom`)

#### Project Persistence (Lines 5000+)
- Save/load via Electron IPC (`save-project`, `load-csv`)
- Project format: JSON with:
  - `trayWidth`, `trayHeight`
  - `cables[]`, `fourreaux[]`, `chemins[]` - placed objects
  - `theme` - saved preference
- CSV data (cables, fourreaux, chemins) loaded from `data/*.csv` on startup
- Auto-update on project load

## Running & Building

### Development

```bash
# Install dependencies
npm install

# Run Electron app in dev mode (with --dev flag for logging)
npm run dev
# or with console output
npm start

# Run web version (Vite dev server, port 5173)
npm run dev:web
```

### Testing

```bash
# Run all tests
npm test

# Watch mode (reruns on file change)
npm run test:watch

# Coverage report
npm run test:coverage

# Run single test file
npm test -- packer.test.js
```

Test framework: **Jest**. Tests are in `tests/` directory.

### Building for Distribution

```bash
# Build for current platform
npm run build

# Platform-specific
npm run build:win   # NSIS installer
npm run build:mac   # DMG
npm run build:linux # AppImage
```

Built artifacts go to `dist/` folder. Installer configuration in `package.json` build section (electron-builder config).

### Release Process

The **bmad method** integration provides CI/CD hooks:

```bash
npm run bmad:refresh   # Sync codex documentation
npm run bmad:validate  # Validate methodology compliance
npm run bmad:list      # List available BMAD agents
```

There is no working `/bump` skill for this repo (that skill targets a different project) — bump manually:

1. Edit `version` in `package.json` and `app.version` + `installation.downloadUrl` in `cea-app.json`, and add a `changelog` entry for the new version in `cea-app.json`.
2. Commit, then tag `vX.Y.Z` (annotated) on the commit that should ship.
3. Push **both** the branch and the tag: `git push origin <branch> && git push origin vX.Y.Z`. The CEA App Store update button reads `cea-app.json` from `main` specifically (via raw.githubusercontent.com) — a release whose commits never reach `main` won't show up there even if the GitHub Release itself is published.
4. `.github/workflows/build.yml` triggers on any `v*.*.*` tag push (not branch-restricted): builds Windows via `npm run build:win`, then publishes a GitHub Release with the installer assets. Watch it with `gh run watch` or `gh release view vX.Y.Z`.

## BMAD Agent Workflow

> **Status**: `.bmad-core/` and its skills are still installed, but active feature work (BIG BRAIN and everything since) no longer goes through BMAD stories — `docs/stories/` now holds only `README.md` and `archive/`. In practice, design work goes through the `superpowers` brainstorming/writing-plans skills instead, landing in `docs/superpowers/specs/` (design docs) and `docs/superpowers/plans/` (implementation plans). Neither `docs/architecture.md` nor a sharded `docs/architecture/` exist, so the BMAD dev-agent auto-load files below are currently empty/inactive. Treat this section as available-but-legacy rather than the default workflow.

This project uses the [BMAD method](https://github.com/bmadcode) with agents defined in `.bmad-core/`. User stories are stored in `docs/stories/` following the naming convention `{epic}.{story}.{slug}.md` (e.g. `1.4.integration-orchestrator.md`). Epic definitions are in `docs/stories/epic-*.md`.

### Available BMAD agents (Claude Code skills)

| Skill | Role | Use for |
|---|---|---|
| `/dev` | Full Stack Developer (James) | Code implementation, following story tasks |
| `/sm` | Scrum Master (Bob) | Drafting next stories (`/sm` → `*draft`) |
| `/po` | Product Owner (Sarah) | Backlog, story validation |
| `/qa` | Test Architect (Quinn) | Code review, quality gates |
| `/architect` | Architect (Winston) | System design, architecture docs |
| `/pm` | Product Manager (John) | PRDs, roadmap |
| `/analyst` | Business Analyst (Mary) | Brainstorming, research |
| `/bmad-orchestrator` | BMad Orchestrator | Workflow coordination |

### Dev agent context

When the `/dev` agent implements a story, it auto-loads these files (from `core-config.yaml` `devLoadAlwaysFiles`):
- `docs/architecture/coding-standards.md`
- `docs/architecture/tech-stack.md`
- `docs/architecture/source-tree.md`

> Note: the `docs/architecture/` sharded folder may not yet exist; the dev agent will use the monolithic `docs/architecture.md` if sharding hasn't been done.

### QA gate location

Quality gate files: `docs/qa/gates/{epic}.{story}-{slug}.yml`
Assessment reports: `docs/qa/assessments/`

## CEA App Store Integration

The file `cea-app.json` at the repo root is the manifest for the CEA App Store (internal company app distribution). It is updated automatically by the `/bump` skill alongside `package.json`. See `INSTRUCTIONS-POUR-REPOS.md` for the full field guide.

## Key Files & Responsibilities

| File | Purpose | Size | Key Exports/Classes |
|------|---------|------|-----|
| `src/renderer/script.js` | Main canvas engine, physics, UI | ~12.2K lines | Global state, render loop, event handlers, `bigBrainGenerate()`, `makeFourreauObject()`, `confirmReplaceOrAdd()` |
| `src/renderer/packer.js` | Bin-packing placement (MaxRects) | ~210 lines | `solve`, `variants`, `anchorLayout` (via `window.PACKER`) |
| `src/renderer/big-brain-panel.js` | BIG BRAIN sidebar tab (DOM only) | ~1.1K lines | Liaison list state (circuit + reserve), Caneco import modal, wiring to `bigBrainGenerate()` |
| `src/renderer/cable-assign.js`, `circuit.js`, `phase-assign.js`, `big-brain.js`, `caneco-import.js`, `geometry.js`, `csv.js`, `compat-chambres.js`, `pdf-format.js`, `inventory-agg.js` | Pure, DOM-free business logic extracted from `script.js` | 20–270 lines each | See [Pure Core Modules](#pure-core-modules-extracted-packer-style) above |
| `src/renderer/konva-fourreaux.js` | Konva rendering overlay | ~275 lines | `init()`, `render()`, `syncTransform()` |
| `src/renderer/titlebar.js` | Custom titlebar controller | ~55 lines | Window controls (Electron-only), "Recharger l'application" button (works in web mode too) |
| `src/renderer/index.html` | DOM structure | ~1.2K lines | `<canvas id="world">`, toolbar, modals, BIG BRAIN tab |
| `src/renderer/style.css` + `cea-variables.css` | UI styling + CSS variables | ~7.2K lines | theme variables, responsive layout |
| `src/renderer/electron-integration.js` | Renderer-side Electron IPC bridge | ~650 lines | Consumes `electronAPI` from `preload.js` (save/load, dev vs. packaged detection) |
| `src/main/main.js` | Electron main process | ~700 lines | Window creation, IPC handlers, auto-update setup |
| `src/preload/preload.js` | Secure API bridge | ~65 lines | `electronAPI` context bridge |
| `data/*.csv` | Embedded reference data | - | cables.csv, fourreaux.csv, chemins_de_cable.csv, chambres_de_tirage.csv |

## Common Patterns & Conventions

### Coordinate System Invariants

- **World coordinates**: mm (millimeters), Y=0 at bottom, origin @ tray bottom-left
- **Canvas pixels**: 0 ≤ x,y ≤ canvas.width/height, Y=0 at top
- **Conversion**: `world_mm = (canvas_px - margin - offset) / (scale * mm_to_px)`
  - `scale` = `pixelRatio * displayScale`
  - See `getEffectivePixelRatio()` function

### State Management (Undo/Redo)

```javascript
// To add an action to history:
actionHistory.push({
  type: 'add-fourreau',       // action type
  data: { x, y, diameter },   // serializable data
  timestamp: Date.now()
});
if (actionHistory.length > MAX_HISTORY) actionHistory.shift();

// Restore from history:
const action = actionHistory.pop();
// Replay or invert action based on type
```

Undo is implemented via full state snapshots stored in `actionHistory`.

### Placement Engine Integration

Placement is called through `window.PACKER` (see `packer.js`):

```javascript
// tubes: { id, d }[]  (d = diameter in mm, incl. entraxe handled by GEO.gap)
const layout = PACKER.solve(tubes, { lock: 'w' | 'h' | null, w, h });
// or several candidates:
const options = PACKER.variants(tubes, { lock: null });
// then fit into the current box (kept size unless it must grow):
const { w, h, positions } = PACKER.anchorLayout(layout, { w, h, lockW, lockH });
```

Fallback: if a layout does not fit under a locked axis, `solve` returns an empty layout and the UI keeps the manual placement.

### Cross-File Communication (`window.*` exports)

`script.js`, `big-brain-panel.js`, `titlebar.js`, and `settings-modal.js` are independent `<script>` files (no bundler, no imports) each with their own IIFE. When one needs to call into another (not into a pure module), the callee exposes a plain function on `window` — e.g. `window.showToast`, `window.bigBrainGenerate`, `window.customConfirm`, `window.confirmReplaceOrAdd` (all defined in `script.js`, consumed by `big-brain-panel.js`/`titlebar.js`). Because `script.js` loads with `defer` after the pure modules but its exports are only ever called from later user-triggered event handlers (never at parse time), load order across files doesn't matter in practice — just check with `typeof window.X === 'function'` before calling from a script that might load first.

### High-DPI & Zoom Handling

- `window.devicePixelRatio` read once at startup → `basePixelRatio`
- User zoom (Ctrl+Wheel) → `currentZoom` (25-500%)
- Display scale adapts based on container size → `displayScale`
- Effective pixel ratio capped at 4.5 to avoid performance degradation
- Canvas resolution set to `logicalWidth * effectivePixelRatio`
- All drawing uses logical (scaled) coordinates; transform applied once

## Historique placement

Le suivi par epics/stories (méthode BMAD) n'est plus le fil directeur du projet.
Les anciens plans (moteur maison `placement-engine.js`, agent RL TensorFlow.js,
epics 001–003) sont archivés dans `docs/stories/archive/` à titre historique — le
placement effectif repose désormais sur `packer.js` (MaxRects). Voir `docs/stories/README.md`.

## Domain Glossary

- **Fourreau** (pl. fourreaux) - Circular conduit/duct (electrical terminology)
- **Fourreau de réserve** - An empty fourreau (no cables) added for spare future capacity; in BIG BRAIN, a liaison with a `reserve` field instead of a `circuit`
- **Chemin de câble** - Cable tray / rectangular conduit
- **Multitubulaire** - Multi-conduit assembly
- **TPC** - Type code for conduit (e.g., "TPC 200" = 200mm diameter)
- **Entraxe** - Spacing between centerlines (30mm standard = 15mm gap each side)
- **Lit de pose** - Mandatory margin around perimeter (40mm per CCTP standard)
- **Occupancy rate** - (Σ fourreau areas) / (tray area) in percentage
- **Gravité** - Principle: larger/heavier items at bottom for stability

## Known Constraints & TODOs

1. **Grid coordinate flipping**: Placement engine uses Y=bottom; Canvas uses Y=top. Conversion is bidirectional but error-prone in edge cases.

2. **Konva overlay sync**: `syncTransform()` must be called after every zoom/pan/resize or snap guides misalign. Watch for stale transforms in Konva layer.

3. **Performance cap**: Physics loop runs max 8 iterations to maintain <16ms frame time. Heavy collisions may cause jitter.

4. **Canvas margin invariant**: All rendering assumes 100px margin (stored in `CANVAS_MARGIN`). Changes require updates to `setupCanvasOffsetAndScale()` and grid drawing.

5. **Theme persistence**: Theme preference stored in project JSON, but CSS variables defined in `cea-variables.css` must match `style.css` selectors.

## Linting & Code Style

- No formal linter configured (vanilla JS project)
- Conventions observed:
  - Strict mode (`"use strict"` at IIFE top)
  - Const/let for variables (no var)
  - JSDoc comments for exported functions/classes
  - camelCase for variables, SCREAMING_SNAKE_CASE for constants
  - Sections separated by `// ─── Section Name ───────` comments

## Resources

- **Product definition**: `PRODUCT.md` (users, positioning, business rules — lit de pose, entraxe, chambres StradEasy)
- **Design system**: `DESIGN.md` (colors, typography, spacing tokens)
- **Brainstorming / architecture history**: `docs/brainstorming-session-results.md`
- **Archived epics & stories** (historical only, see `docs/stories/README.md`): `docs/stories/archive/`
- **Electron docs**: https://www.electronjs.org/docs
- **Konva.js**: https://konvajs.org/
- **Bin packing reference**: https://en.wikipedia.org/wiki/Bin_packing_problem

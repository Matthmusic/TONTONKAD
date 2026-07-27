# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TONTONKAD** is an Electron desktop application for designing and dimensioning electrical cable trays, conduits, and multi-tubing boxes with interactive 2D rendering. The application targets electrical engineers and contractors who need to optimize the placement of circular conduits (fourreaux) within rectangular cable trays while respecting occupancy rates and structural constraints.

- **Version**: 2.4.11
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

### Business Logic: Placement Engine

**File**: `src/renderer/placement-engine.js` (~400+ lines)

Core classes for intelligent conduit placement optimization:

- **`PlacementConfiguration`** - Represents a candidate layout with:
  - `width`, `height` of the cable tray
  - `placedFourreaux[]` - positioned conduits
  - `score` - multi-objective score
  - Constraint system for locked dimensions (width or height)

- **`FourreauSorter`** - Intelligent sorting by:
  - Diameter (descending) → gravité principle
  - Quantity parity (even pairs first)
  - Quantity (descending)
  - Also detects symmetric pairs for balanced layouts

- **`ConfigurationGenerator`** - Explores 5 placement strategies:
  1. `bottomLeftStrategy` - Classic bin packing
  2. `centeredSymmetricStrategy` - Balanced around vertical axis
  3. `minWidthStrategy` - Minimize width (height free)
  4. `minHeightStrategy` - Minimize height (width free)
  5. `squareShapeStrategy` - Maximize aspect ratio ≈ 1

- **`MultiObjectiveScorer`** - Evaluates configs on 4 weighted criteria:
  - `surface` (40%) - Minimize footprint
  - `symmetry` (25%) - Y-axis balance
  - `stability` (20%) - No overhangs, gravity principles
  - `shape` (15%) - Prefer square over elongated

- **`PlacementOrchestrator`** - Coordinates generator + scorer:
  - Generates 5 candidate configurations
  - Scores each
  - Returns best config + alternatives

**Coordinate System**: Y=0 at bottom, increases upward (inverted from canvas). Margins (`litDePose` = 40mm) enforced on all sides.

### Main Script: Canvas & Physics Engine

**File**: `src/renderer/script.js` (~11,000 lines)

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
npm test -- placement-engine.test.js
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

For a full release (bumps version, creates git tag, triggers GitHub Actions):
- Use the `/bump` skill in Claude Code (or manually: edit `package.json`, `cea-app.json`, commit, tag, push)
- This triggers GitHub Actions to build and publish to Releases

## BMAD Agent Workflow

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
| `src/renderer/script.js` | Main canvas engine, physics, UI | ~11K lines | Global state, render loop, event handlers |
| `src/renderer/placement-engine.js` | Intelligent placement optimizer | ~400 lines | `PlacementOrchestrator`, `ConfigurationGenerator`, `MultiObjectiveScorer` |
| `src/renderer/konva-fourreaux.js` | Konva rendering overlay | ~300 lines | `init()`, `render()`, `syncTransform()` |
| `src/renderer/index.html` | DOM structure | ~1.5K lines | `<canvas id="world">`, toolbar, modals |
| `src/renderer/style.css` | UI styling + CSS variables | ~3.5K lines | `--mm-to-px`, theme variables, responsive layout |
| `src/main/main.js` | Electron main process | ~600 lines | Window creation, IPC handlers, auto-update setup |
| `src/preload/preload.js` | Secure API bridge | ~150 lines | `electronAPI` context bridge |
| `data/*.csv` | Embedded reference data | - | cables.csv, fourreaux.csv, chemins_de_cable.csv |

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

The placement engine is **optional** and called via:

```javascript
// When user clicks "Grid" (Ctrl+G) or "Reduce au minimum"
const orchestrator = new PlacementOrchestrator();
const result = orchestrator.optimize(
  fourreaux,  // { type, code, diameter, quantity }[]
  {
    trayWidth, 
    trayHeight,
    constraints: { lockedAxis: 'width'|'height'|null }
  }
);
// result.bestConfiguration contains optimized placement
// result.alternatives has fallback options
```

Fallback: If optimization fails, revert to manual placement or previous config.

### High-DPI & Zoom Handling

- `window.devicePixelRatio` read once at startup → `basePixelRatio`
- User zoom (Ctrl+Wheel) → `currentZoom` (25-500%)
- Display scale adapts based on container size → `displayScale`
- Effective pixel ratio capped at 4.5 to avoid performance degradation
- Canvas resolution set to `logicalWidth * effectivePixelRatio`
- All drawing uses logical (scaled) coordinates; transform applied once

## Placement Optimization Roadmap

**Epic 001** (v3.0 roadmap, in `docs/`):

- **Phase 1 (MVP, 13 days)**: Multi-config generator + 4-criteria scorer
  - Stories 001-004: Foundation, generator, scorer, integration
  - KPIs: 15-30% surface reduction, >80% symmetry, <100ms performance
  
- **Phase 2 (Optional, 10 days)**: TensorFlow.js RL agent
  - Stories 005-007: Dataset collection, RL training, hybrid mode
  - KPIs: +5-10% additional improvement, <5% fallback rate

Status: Phase 1 foundational architecture complete (`placement-engine.js`). Phase 2 conditioned on Phase 1 success metrics.

## Domain Glossary

- **Fourreau** (pl. fourreaux) - Circular conduit/duct (electrical terminology)
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

- **Architecture decisions**: See `docs/brainstorming-optimisation-placement-fourreaux.md`
- **Epic & stories**: `docs/roadmap-optimisation-placement-fourreaux.md` and `docs/stories/*.md`
- **Electron docs**: https://www.electronjs.org/docs
- **Konva.js**: https://konvajs.org/
- **Bin packing reference**: https://en.wikipedia.org/wiki/Bin_packing_problem

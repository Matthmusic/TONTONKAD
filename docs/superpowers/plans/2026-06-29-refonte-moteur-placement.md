# Refonte moteur de placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer `src/renderer/placement-engine.js` (~1700 lignes) par un module géométrique pur `src/renderer/packer.js` (~250 lignes) basé sur `maxrects-packer`, déterministe, avec axe verrouillé + tranchée.

**Architecture:** Module de fonctions pures (`solve`, `variants`, `cell`, `GEO`) enveloppant `maxrects-packer`. maxrects empaquette des cellules carrées (`d + gap`) ; une couche maison gère le balayage de largeurs, la contrainte tranchée (`w ≥ h`) et l'axe verrouillé. Coordonnées Y=0 en bas. Exposé via `window` (renderer) et `module.exports` (Jest).

**Tech Stack:** JavaScript vanilla, `maxrects-packer@2.7.3` (build UMD vendorisé), Jest.

## Global Constraints

- `GEO.gap = 30` (entraxe, mm), `GEO.margin = 40` (lit de pose, mm) — valeurs par défaut, mutables.
- Coordonnées de sortie : Y=0 en bas, Y croît vers le haut ; `x/y` = coin bas-gauche de la cellule.
- Déterminisme obligatoire : tri d'entrée stable + heuristique maxrects figée (`logic: PACKING_LOGIC.MAX_EDGE`, `pot: false`, `allowRotation: false`) + balayage à nombre de pas fixe.
- Aucune logique métier (familles, niveaux, réserves, validation, void-fill) dans `packer.js`.
- Noms courts : `solve`, `variants`, `cell`, `GEO`, `w/h/d/items`.
- Cible perf : < 100 ms pour 50 tubes.
- Lib chargée via `require('maxrects-packer')` sous Node/Jest, via `window.MaxRectsPacker` (UMD) dans le renderer.

---

### Task 1: Dépendance + vendoring de maxrects-packer

**Files:**
- Modify: `package.json` (ajout dépendance)
- Create: `src/renderer/maxrects-packer.min.js` (build UMD copié)
- Modify: `src/renderer/index.html` (balise script)

**Interfaces:**
- Produces: global navigateur `window.MaxRectsPacker` (objet UMD avec `.MaxRectsPacker`, `.Rectangle`, `.PACKING_LOGIC`) ; module Node `require('maxrects-packer')`.

- [ ] **Step 1: Installer la dépendance**

Run: `npm install maxrects-packer@2.7.3 --save-exact`
Expected: `package.json` `dependencies` contient `"maxrects-packer": "2.7.3"`, installation OK.

- [ ] **Step 2: Vendoriser le build UMD dans le renderer**

Run (Git Bash):
```bash
cp node_modules/maxrects-packer/dist/maxrects-packer.js src/renderer/maxrects-packer.min.js
head -5 src/renderer/maxrects-packer.min.js
```
Expected: le fichier commence par `(function (global, factory) {` et mentionne `global.MaxRectsPacker`.

- [ ] **Step 3: Inclure le script dans index.html (avant placement-engine.js, qui sera retiré en Task 9)**

Localiser la balise existante :
Run: `grep -n "placement-engine.js" src/renderer/index.html`

Ajouter **juste avant** cette ligne :
```html
    <script src="maxrects-packer.min.js"></script>
```

- [ ] **Step 4: Vérifier le chargement Node**

Run: `node -e "const m=require('maxrects-packer'); console.log(typeof m.MaxRectsPacker, typeof m.PACKING_LOGIC);"`
Expected: `function object`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/renderer/maxrects-packer.min.js src/renderer/index.html
git commit -m "build: add maxrects-packer dependency + vendor UMD build"
```

---

### Task 2: Scaffolding `packer.js` — `GEO` + `cell()`

**Files:**
- Create: `src/renderer/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Produces:
  - `GEO = { gap: number, margin: number }`
  - `cell(d: number) -> number` (= `d + GEO.gap`)
  - Export double : `module.exports = { GEO, cell, solve, variants }` (Node) **et** `window.PACKER` + `window.{GEO,cell,solve,variants}` (navigateur).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// tests/packer.test.js
const { GEO, cell } = require('../src/renderer/packer.js');

describe('packer — géométrie de base', () => {
  test('GEO défauts', () => {
    expect(GEO.gap).toBe(30);
    expect(GEO.margin).toBe(40);
  });
  test('cell = diamètre + entraxe', () => {
    expect(cell(125)).toBe(155);
    expect(cell(0)).toBe(30);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- packer.test.js`
Expected: FAIL — `Cannot find module '../src/renderer/packer.js'`.

- [ ] **Step 3: Créer `packer.js` (scaffolding + résolveur de lib)**

```js
'use strict';
(function (root) {
  const MRP = (typeof module !== 'undefined' && module.exports)
    ? require('maxrects-packer')
    : root.MaxRectsPacker;
  const MaxRectsPacker = MRP.MaxRectsPacker;
  const PACKING_LOGIC  = MRP.PACKING_LOGIC;

  const GEO  = { gap: 30, margin: 40 };
  const EDGE = 1e6; // borne "infinie" pour l'axe libre
  const OPTS = { smart: true, pot: false, square: false, allowRotation: false, border: 0, logic: PACKING_LOGIC.MAX_EDGE };

  const cell = (d) => d + GEO.gap;

  // Stubs (implémentés dans les tâches suivantes)
  function solve(tubes, opts) { throw new Error('not implemented'); }
  function variants(tubes, opts) { throw new Error('not implemented'); }

  const api = { GEO, cell, solve, variants };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- packer.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packer.js tests/packer.test.js
git commit -m "feat(packer): scaffold module avec GEO + cell()"
```

---

### Task 3: Pack interne `packAt()` + builder `toLayout()`

**Files:**
- Modify: `src/renderer/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `cell`, `GEO`, `MaxRectsPacker`, `OPTS`, `EDGE`.
- Produces (internes, non exportées) :
  - `sortTubes(tubes) -> tubes[]` (tri stable : `d` décroissant, puis `id` croissant)
  - `packAt(tubes, innerW) -> { cw, ch, placed: [{id,d,x,y}] } | null` — `x/y` en coords Y-up relatives au coin bas-gauche du contenu.
  - `toLayout(pack, tag, outW|null, outH|null) -> Layout` où `Layout = { w, h, items:[{id,x,y,d}], ratio, fill, tag }`. `items.x = GEO.margin + p.x`, `items.y = GEO.margin + p.y`. `w = outW ?? pack.cw + 2*GEO.margin`, idem `h`. `fill = Σ cell(d)² / (w*h)`, `ratio = w/h`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
// Ajouter dans tests/packer.test.js
const pkg = require('../src/renderer/packer.js');

// Accès aux internes via une trappe de test (voir Step 3).
describe('packer — pack interne', () => {
  const tubes = [
    { id: 'a', d: 125 }, { id: 'b', d: 125 },
    { id: 'c', d: 63 },  { id: 'd', d: 63 },
  ];

  test('toLayout : marges respectées et aucun chevauchement', () => {
    const pack = pkg.__test.packAt(pkg.__test.sortTubes(tubes), 1000);
    const L = pkg.__test.toLayout(pack, 'compact', null, null);
    // marges
    for (const it of L.items) {
      const c = pkg.cell(it.d);
      expect(it.x).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
      expect(it.y).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
      expect(it.x + c).toBeLessThanOrEqual(L.w - pkg.GEO.margin + 0.001);
      expect(it.y + c).toBeLessThanOrEqual(L.h - pkg.GEO.margin + 0.001);
    }
    // aucun chevauchement
    for (let i = 0; i < L.items.length; i++) {
      for (let j = i + 1; j < L.items.length; j++) {
        const A = L.items[i], B = L.items[j];
        const ca = pkg.cell(A.d), cb = pkg.cell(B.d);
        const sep = (A.x + ca <= B.x + 0.001) || (B.x + cb <= A.x + 0.001) ||
                    (A.y + ca <= B.y + 0.001) || (B.y + cb <= A.y + 0.001);
        expect(sep).toBe(true);
      }
    }
    expect(L.items).toHaveLength(4);
    expect(L.fill).toBeGreaterThan(0);
    expect(L.fill).toBeLessThanOrEqual(1.0001);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- packer.test.js`
Expected: FAIL — `pkg.__test is undefined`.

- [ ] **Step 3: Implémenter `sortTubes`, `packAt`, `toLayout` + exposer `__test`**

Dans `packer.js`, ajouter avant les stubs :
```js
  function sortTubes(tubes) {
    return [...tubes].sort((a, b) => (b.d - a.d) || String(a.id).localeCompare(String(b.id)));
  }

  // Pack des cellules dans une largeur intérieure ; retourne contenu en Y-up.
  function packAt(tubes, innerW) {
    const packer = new MaxRectsPacker(innerW, EDGE, 0, OPTS);
    for (const t of tubes) { const c = cell(t.d); packer.add(c, c, { id: t.id, d: t.d }); }
    const bin = packer.bins[0];
    if (!bin) return null;
    const cw = bin.width, ch = bin.height;
    const placed = bin.rects.map(r => ({
      id: r.data.id, d: r.data.d,
      x: r.x,                  // maxrects : origine haut-gauche, y vers le bas
      y: ch - r.y - r.height,  // flip vers Y-up
    }));
    return { cw, ch, placed };
  }

  function toLayout(pack, tag, outW, outH) {
    const w = outW != null ? outW : pack.cw + 2 * GEO.margin;
    const h = outH != null ? outH : pack.ch + 2 * GEO.margin;
    const items = pack.placed.map(p => ({ id: p.id, d: p.d, x: GEO.margin + p.x, y: GEO.margin + p.y }));
    const cellArea = items.reduce((s, p) => s + cell(p.d) * cell(p.d), 0);
    return { w, h, items, ratio: w / h, fill: cellArea / (w * h), tag };
  }
```
Et compléter l'export `api` :
```js
  const api = { GEO, cell, solve, variants, __test: { sortTubes, packAt, toLayout } };
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- packer.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packer.js tests/packer.test.js
git commit -m "feat(packer): pack interne maxrects + builder Layout (Y-up, marges)"
```

---

### Task 4: `solve()` — mode axe verrouillé (`lock:'w'` et `lock:'h'`)

**Files:**
- Modify: `src/renderer/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `sortTubes`, `packAt`, `toLayout`, `candidateWidths` (défini ici).
- Produces:
  - `candidateWidths(tubes) -> number[]` : largeurs intérieures candidates, de `max(cell)` à `Σ cell`, en `N=40` pas fixes, arrondies, dédupliquées, triées.
  - `solve(tubes, { w, h, lock })`:
    - `lock:'w'` → `toLayout(packAt(list, w - 2*margin), 'locked', w, null)`.
    - `lock:'h'` → balaye les largeurs, garde celles dont `pack.ch <= h - 2*margin`, retient la plus étroite (`w` min) ; `toLayout(pack, 'locked', null, h)`. Fallback : largeur candidate max si aucune ne tient.
    - `tubes` vide → `{ w:2*margin, h:2*margin, items:[], ratio:1, fill:0, tag:'empty' }`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
describe('packer — solve verrouillé', () => {
  const tubes = [
    { id: 'a', d: 125 }, { id: 'b', d: 125 }, { id: 'c', d: 90 },
    { id: 'd', d: 63 },  { id: 'e', d: 63 },  { id: 'f', d: 63 },
  ];
  test('lock:w → largeur respectée à l\'identique', () => {
    const L = pkg.solve(tubes, { w: 600, lock: 'w' });
    expect(L.w).toBe(600);
    expect(L.tag).toBe('locked');
    expect(L.items).toHaveLength(6);
    for (const it of L.items) {
      const c = pkg.cell(it.d);
      expect(it.x + c).toBeLessThanOrEqual(600 - pkg.GEO.margin + 0.001);
    }
  });
  test('lock:h → hauteur respectée à l\'identique', () => {
    const L = pkg.solve(tubes, { h: 500, lock: 'h' });
    expect(L.h).toBe(500);
    expect(L.items).toHaveLength(6);
  });
  test('liste vide → layout vide', () => {
    const L = pkg.solve([], { lock: null });
    expect(L.items).toHaveLength(0);
    expect(L.tag).toBe('empty');
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- packer.test.js`
Expected: FAIL — `not implemented`.

- [ ] **Step 3: Implémenter `candidateWidths` + branches verrouillées de `solve`**

Remplacer le stub `solve` et ajouter `candidateWidths` :
```js
  function candidateWidths(tubes) {
    const cells = tubes.map(t => cell(t.d));
    const lo = Math.max(...cells);
    const hi = cells.reduce((s, c) => s + c, 0);
    if (hi <= lo) return [lo];
    const N = 40, set = new Set();
    for (let i = 0; i <= N; i++) set.add(Math.round(lo + (hi - lo) * i / N));
    return [...set].sort((a, b) => a - b);
  }

  function emptyLayout() {
    return { w: 2 * GEO.margin, h: 2 * GEO.margin, items: [], ratio: 1, fill: 0, tag: 'empty' };
  }

  function solveLockedHeight(list, H) {
    const innerH = H - 2 * GEO.margin;
    let best = null;
    for (const iw of candidateWidths(list)) {
      const pack = packAt(list, iw);
      if (!pack || pack.ch > innerH) continue;
      const L = toLayout(pack, 'locked', null, H);
      if (!best || L.w < best.w) best = L;
    }
    if (!best) {
      const widths = candidateWidths(list);
      best = toLayout(packAt(list, widths[widths.length - 1]), 'locked', null, H);
    }
    return best;
  }

  function solve(tubes, opts = {}) {
    const list = sortTubes(tubes);
    if (list.length === 0) return emptyLayout();
    const lock = opts.lock || null;
    if (lock === 'w') return toLayout(packAt(list, opts.w - 2 * GEO.margin), 'locked', opts.w, null);
    if (lock === 'h') return solveLockedHeight(list, opts.h);
    return solveFree(list); // implémenté en Task 5
  }
```
Ajouter un stub temporaire `function solveFree(list){ throw new Error('not implemented'); }` (remplacé en Task 5).
Mettre à jour `__test` : `__test: { sortTubes, packAt, toLayout, candidateWidths }`.

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- packer.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packer.js tests/packer.test.js
git commit -m "feat(packer): solve() modes axe verrouillé (w/h) + candidateWidths"
```

---

### Task 5: `solve()` — mode libre (balayage + tranchée + déterminisme)

**Files:**
- Modify: `src/renderer/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `candidateWidths`, `packAt`, `toLayout`.
- Produces: `solveFree(list) -> Layout` : pour chaque largeur candidate, `toLayout(..., 'compact')` ; filtrer `w >= h` (tranchée) ; parmi le pool (ou tous si aucun ne respecte la tranchée), retenir `fill` max. `tag='compact'`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
describe('packer — solve libre', () => {
  const tubes = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i, d: i % 3 === 0 ? 125 : 63 }));
  test('tranchée : largeur >= hauteur', () => {
    const L = pkg.solve(tubes, { lock: null });
    expect(L.w).toBeGreaterThanOrEqual(L.h);
  });
  test('déterministe : deux appels identiques', () => {
    const A = pkg.solve(tubes, { lock: null });
    const B = pkg.solve(tubes, { lock: null });
    expect(JSON.stringify(A)).toBe(JSON.stringify(B));
  });
  test('performance : 50 tubes < 100 ms', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ id: 'x' + i, d: [63, 90, 125][i % 3] }));
    const t0 = Date.now();
    pkg.solve(big, { lock: null });
    expect(Date.now() - t0).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- packer.test.js`
Expected: FAIL — `not implemented` (solveFree).

- [ ] **Step 3: Implémenter `solveFree`**

Remplacer le stub :
```js
  function solveFree(list) {
    const all = candidateWidths(list)
      .map(iw => { const p = packAt(list, iw); return p ? toLayout(p, 'compact', null, null) : null; })
      .filter(Boolean);
    if (!all.length) return emptyLayout();
    const tranchee = all.filter(L => L.w >= L.h);
    const pool = tranchee.length ? tranchee : all;
    return pool.reduce((best, L) => (L.fill > best.fill ? L : best));
  }
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- packer.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packer.js tests/packer.test.js
git commit -m "feat(packer): solve() mode libre — balayage + tranchée + déterminisme"
```

---

### Task 6: `variants()`

**Files:**
- Modify: `src/renderer/packer.js`
- Test: `tests/packer.test.js`

**Interfaces:**
- Consumes: `solve`, `candidateWidths`, `packAt`, `toLayout`.
- Produces: `variants(tubes, opts={}) -> Layout[]` :
  - si `opts.lock` → `[ solve(tubes, opts) ]`.
  - sinon : construire tous les layouts du balayage, puis choisir 3 candidats étiquetés et dédupliqués (par `w`,`h` arrondis) :
    - `compact` : `fill` max.
    - `tranchee` (si au moins un `w>=h`) : `|ratio - 1.4|` min.
    - `rect43` : `|ratio - 4/3|` min.
  - Retour : ≤ 3 layouts, chacun avec son `tag`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
describe('packer — variants', () => {
  const tubes = Array.from({ length: 10 }, (_, i) => ({ id: 'v' + i, d: [125, 63, 90][i % 3] }));
  test('≤ 3 variantes, taguées, dédupliquées, valides', () => {
    const vs = pkg.variants(tubes, { lock: null });
    expect(vs.length).toBeGreaterThanOrEqual(1);
    expect(vs.length).toBeLessThanOrEqual(3);
    const tags = vs.map(v => v.tag);
    expect(new Set(tags).size).toBe(tags.length);          // tags uniques
    const keys = vs.map(v => `${Math.round(v.w)}x${Math.round(v.h)}`);
    expect(new Set(keys).size).toBe(keys.length);          // dimensions uniques (dédup)
    for (const v of vs) expect(v.items).toHaveLength(10);
  });
  test('mode verrouillé → 1 variante', () => {
    const vs = pkg.variants(tubes, { w: 700, lock: 'w' });
    expect(vs).toHaveLength(1);
    expect(vs[0].w).toBe(700);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- packer.test.js`
Expected: FAIL — `not implemented` (variants).

- [ ] **Step 3: Implémenter `variants`**

Remplacer le stub :
```js
  function variants(tubes, opts = {}) {
    const list = sortTubes(tubes);
    if (list.length === 0) return [];
    if (opts.lock) return [solve(tubes, opts)];

    const all = candidateWidths(list)
      .map(iw => { const p = packAt(list, iw); return p ? toLayout(p, '', null, null) : null; })
      .filter(Boolean);
    if (!all.length) return [];

    const pickMax = (arr, f) => arr.reduce((b, L) => (f(L) > f(b) ? L : b));
    const pickMin = (arr, f) => arr.reduce((b, L) => (f(L) < f(b) ? L : b));

    const out = [];
    out.push({ ...pickMax(all, L => L.fill), tag: 'compact' });
    const tr = all.filter(L => L.w >= L.h);
    if (tr.length) out.push({ ...pickMin(tr, L => Math.abs(L.ratio - 1.4)), tag: 'tranchee' });
    out.push({ ...pickMin(all, L => Math.abs(L.ratio - 4 / 3)), tag: 'rect43' });

    const seen = new Set();
    return out.filter(L => {
      const k = `${Math.round(L.w)}x${Math.round(L.h)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- packer.test.js`
Expected: PASS (toute la suite).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/packer.js tests/packer.test.js
git commit -m "feat(packer): variants() — compact / tranchee / rect43 dédupliquées"
```

---

### Task 7: Intégration dans `script.js` (site #1 — `arrangeConduitGridNew`)

**Files:**
- Modify: `src/renderer/script.js` (≈ lignes 1245-1340, fonction `arrangeConduitGridNew`)

**Interfaces:**
- Consumes: `window.solve`, `window.variants`, `window.cell`, `window.GEO`, `prepareFourreauxInput`.
- Produces: comportement UI inchangé, alimenté par le nouveau moteur.

**Mapping de référence (toutes les tâches d'intégration) :**
| Ancien | Nouveau |
|---|---|
| `prepareFourreauxInput(...)` renvoie `{diameter, id, ...}` | construire `tubes = list.map(f => ({ id: f.id, d: f.od || spec.od }))` |
| `orchestrator.computeBestPlacement(input, constraints, options)` | `window.solve(tubes, optsPacker)` |
| `constraints.lockedAxis 'width'/'height'` | `opts.lock = 'w'/'h'` |
| `constraints.boxWidth/boxHeight` | `opts.w / opts.h` |
| `bestConfig.placedFourreaux` (`{id,x,y,diameter}`) | `layout.items` (`{id,x,y,d}`) — `pf.diameter` → `it.d` |
| `bestConfig.width/height` | `layout.w/h` |
| `bestConfig.calculateCellSize(d)` | `window.cell(d)` |
| `bestConfig.alternatives` | `window.variants(tubes, optsPacker)` |
| `bestConfig.score` (×100) | `layout.fill` (×100, libellé « Occupation ») |

- [ ] **Step 1: Lire le site d'appel**

Run: `grep -n "arrangeConduitGridNew\|computeBestPlacement\|placedFourreaux\|detectVoidFill\|reserveSuggestions" src/renderer/script.js`
Lire les blocs autour de chaque résultat pour cette fonction (≈ 1245-1340).

- [ ] **Step 2: Réécrire `arrangeConduitGridNew`**

Remplacer la construction d'`orchestrator`/`constraints`/`computeBestPlacement` par :
```js
      const input = prepareFourreauxInput(fourreaux);
      const tubes = input.map(f => ({ id: f.id, d: f.diameter }));

      const lockWidth  = document.getElementById('lockWidth')?.checked;
      const lockHeight = document.getElementById('lockHeight')?.checked;
      const boxWidth   = shape === 'rect' ? parseFloat(boxWInput.value) : parseFloat(boxDInput.value);
      const boxHeight  = shape === 'rect' ? parseFloat(boxHInput.value) : parseFloat(boxDInput.value);

      const optsPacker = {};
      if (lockHeight && !lockWidth) { optsPacker.lock = 'h'; optsPacker.h = boxHeight; }
      else { optsPacker.lock = 'w'; optsPacker.w = boxWidth; } // défaut historique : ranger dans la largeur

      const bestConfig = window.solve(tubes, optsPacker);
```
Adapter la boucle d'application (le bloc `bestConfig.placedFourreaux.forEach`) :
```js
      const offsetX = (boxWidth  - bestConfig.w) / 2;
      const offsetY = (boxHeight - bestConfig.h) / 2;
      bestConfig.items.forEach(it => {
        const fourreau = fourreaux.find(f => String(f.id) === String(it.id));
        if (fourreau) {
          const c = window.cell(it.d);
          const x = (offsetX + it.x + c / 2) * MM_TO_PX;
          const y = (offsetY + bestConfig.h - it.y - c / 2) * MM_TO_PX;
          moveFourreauWithChildren(fourreau, x, y);
        }
      });
```
Remplacer la construction des variantes :
```js
      const allConfigs = [bestConfig, ...window.variants(tubes, optsPacker).filter(v => v.tag !== bestConfig.tag)];
```
Supprimer le bloc `detectVoidFill` / `lastVoidFillSuggestions` (mettre `lastVoidFillSuggestions = [];`).
Remplacer le toast :
```js
      const fillPercent = (bestConfig.fill * 100).toFixed(0);
      showToast(`✅ ${fourreaux.length} fourreaux placés (Occupation: ${fillPercent}%) - Ctrl+X pour dégeler`);
```

- [ ] **Step 3: Vérifier qu'aucune référence morte ne subsiste dans cette fonction**

Run: `grep -n "computeBestPlacement\|placedFourreaux\|\.score\b\|calculateCellSize" src/renderer/script.js | sed -n '1,40p'`
Expected: plus aucune occurrence **dans `arrangeConduitGridNew`** (les autres fonctions sont traitées en Task 8).

- [ ] **Step 4: Vérifier le lancement de l'app (fumée manuelle)**

Run: `npm start` (ou demander à l'utilisateur), placer quelques fourreaux, déclencher la grille.
Expected: placement appliqué, toast « Occupation: NN% », pas d'erreur console.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/script.js
git commit -m "feat(packer): intégration site #1 arrangeConduitGridNew"
```

---

### Task 8: Intégration `script.js` (sites #2 et #3) + `buildNappeVariants`

**Files:**
- Modify: `src/renderer/script.js` (≈ lignes 3251-3320 et 3380-3470, + `buildNappeVariants` ≈ 2490-2660)

**Interfaces:**
- Consumes: idem Task 7.
- Produces: les 2 autres points d'entrée + le rendu des cartes de variantes utilisent le mapping nouveau moteur.

- [ ] **Step 1: Localiser les sites restants**

Run: `grep -n "computeBestPlacement\|new window.PlacementOrchestrator\|\.alternatives\|buildNappeVariants\|placedFourreaux\|optimizeDimensions" src/renderer/script.js`

- [ ] **Step 2: Réécrire le site #2 (≈ 3251)**

Appliquer le **même patron** qu'en Task 7 (cf. tableau de mapping) : `tubes`, `optsPacker`, `window.solve`, boucle `items`/`cell`/`w`/`h`, variantes via `window.variants`. Supprimer toute référence `detectVoidFill`/`reserveSuggestions` rencontrée.

- [ ] **Step 3: Réécrire le site #3 (≈ 3397, fonction de réduction)**

Idem. Remplacer `alternatives.forEach(cfg => orchestrator.optimizeDimensions(cfg))` (le `solve`/`variants` renvoie déjà des dimensions serrées — supprimer cet appel). Supprimer le bloc `detectVoidFill`.

- [ ] **Step 4: Adapter `buildNappeVariants`**

Dans `buildNappeVariants` (≈ 2490-2660), remplacer les accès `cfg.placedFourreaux` → `cfg.items`, `pf.diameter` → `it.d`, `cfg.width/height` → `cfg.w/h`, `cfg.calculateCellSize(d)` → `window.cell(d)`, `cfg.score` → `cfg.fill`. Conserver la logique d'affichage/cartes.

- [ ] **Step 5: Vérifier l'absence totale de référence à l'ancien moteur**

Run: `grep -n "PlacementOrchestrator\|computeBestPlacement\|placedFourreaux\|calculateCellSize\|detectVoidFill\|reserveSuggestions\|\.alternatives\b" src/renderer/script.js`
Expected: **aucune occurrence**. Corriger toute occurrence restante.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/script.js
git commit -m "feat(packer): intégration sites #2/#3 + buildNappeVariants"
```

---

### Task 9: Suppression de l'ancien moteur + nettoyage

**Files:**
- Delete: `src/renderer/placement-engine.js`
- Delete: `tests/placement-engine.test.js`
- Modify: `src/renderer/index.html` (retirer la balise `placement-engine.js`)
- Modify: `CLAUDE.md` (mise à jour de la section moteur — optionnel mais recommandé)

**Interfaces:**
- Produces: codebase sans l'ancien moteur, suite Jest verte.

- [ ] **Step 1: Confirmer qu'aucun fichier ne référence l'ancien moteur**

Run: `grep -rn "placement-engine\|PlacementOrchestrator\|NappeLayout\|MultiObjectiveScorer\|FamilyClassifier" src/ tests/ index.html src/renderer/index.html`
Expected: aucune occurrence hors `placement-engine.js`/`placement-engine.test.js` eux-mêmes.

- [ ] **Step 2: Retirer la balise script de index.html**

Run: `grep -n "placement-engine.js" src/renderer/index.html`
Supprimer la ligne `<script src="placement-engine.js"></script>`.

- [ ] **Step 3: Supprimer les fichiers de l'ancien moteur**

```bash
git rm src/renderer/placement-engine.js tests/placement-engine.test.js
```

- [ ] **Step 4: Lancer toute la suite de tests**

Run: `npm test`
Expected: PASS — seul `tests/packer.test.js` (et autres tests existants non liés) s'exécutent ; aucun échec ; aucune référence manquante.

- [ ] **Step 5: Fumée manuelle finale**

Run: `npm start`
Expected: les 3 points d'entrée (grille, variantes, réduction) fonctionnent ; panel de propositions affiche les variantes ; aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: supprime l'ancien placement-engine au profit de packer.js"
```

---

## Notes de mise en œuvre

- **Trappe `__test`** : exposée uniquement pour les tests Jest des fonctions internes ; sans danger en navigateur.
- **Centrage** : `offsetX/offsetY` sont conservés à l'identique (parité avec l'existant) ; en mode verrouillé, `layout.w/h` = dimension imposée → offset nul, items alignés à gauche/bas comme aujourd'hui.
- **maxrects multi-bins** : `maxHeight = EDGE (1e6)` garantit un seul bin ; on utilise `bins[0]`.
- **Si `npm start` indisponible** dans l'environnement d'exécution : remplacer les étapes de fumée manuelle par une demande de validation à l'utilisateur.

# Modularisation de script.js — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continuer à extraire les cœurs *purs* de `script.js` vers des modules testés, sans changer le comportement, jusqu'à épuisement des fonctions extractibles sans refactor d'architecture.

**Architecture:** Chaque module suit le pattern `packer.js` : IIFE qui expose une API sur `window.X` (runtime) et `module.exports` (Jest). Dans `script.js`, la fonction d'origine devient un **wrapper fin** qui adapte les globales à l'API pure (signature inchangée → aucun call-site modifié). `index.html` charge le module avant `script.js`.

**Tech Stack:** Vanilla JS (IIFE, pas de build step, chargé en `file://`), Jest.

## Global Constraints

- Comportement strictement préservé : la logique est déplacée à l'identique ; seuls les points de lecture des globales deviennent des paramètres.
- Après chaque tâche : `node --check` sur module + `script.js`, puis `npm test` (doit rester vert et croître), puis commit.
- Modules chargés dans `index.html` **avant** `script.js` (bloc après `packer.js`).
- Nommage : modules `window.X` en PascalCase court ; wrappers gardent le nom d'origine.
- **Frontière (hors de ce plan)** : les fonctions DOM/canvas/physique (`render*`, `draw*`, `applyPhysics`, interactions) et l'export DXF (~400 lignes couplées) nécessitent d'abord un objet `state` explicite + un harnais de test renderer. Elles ne sont PAS extraites ici (aucun test unitaire ne les couvre → seule la validation dans l'app les protège). À traiter en phase design séparée.

---

### Task 1: Module géométrie + occupation (`geometry.js`)

**Files:**
- Create: `src/renderer/geometry.js`
- Modify: `src/renderer/script.js` (remplace `areaCircle` ~974, `calculateBoxOccupancy` ~5818, `roundToStep` ~6980 par des wrappers)
- Modify: `src/renderer/index.html` (charge `geometry.js`)
- Test: `tests/geometry.test.js`

**Interfaces:**
- Produces:
  - `Geom.areaCircle(d) -> number` (aire d'un disque de diamètre d)
  - `Geom.roundToStep(value, step) -> number` (arrondi au pas ; renvoie value si non fini)
  - `Geom.computeOccupancy({ shape, wMm, hMm, dMm, fourreaux, cables }) -> number` (taux d'occupation en %, 0 si aire totale <= 0 ; câbles avec `parent` exclus)

- [ ] **Step 1: Écrire le test qui échoue** (`tests/geometry.test.js`)

```javascript
const { areaCircle, roundToStep, computeOccupancy } = require('../src/renderer/geometry.js');

describe('areaCircle', () => {
  test('π·r²', () => { expect(areaCircle(10)).toBeCloseTo(Math.PI * 25, 6); });
  test('0 → 0', () => { expect(areaCircle(0)).toBe(0); });
});

describe('roundToStep', () => {
  test('arrondi au pas de 5', () => { expect(roundToStep(23, 5)).toBe(25); });
  test('valeur non finie renvoyée telle quelle', () => { expect(roundToStep(NaN, 5)).toBeNaN(); });
});

describe('computeOccupancy', () => {
  test('boîte rect : aire fourreaux / aire boîte × 100', () => {
    const occ = computeOccupancy({ shape: 'rect', wMm: 1000, hMm: 1000, fourreaux: [{ od: 100 }], cables: [] });
    expect(occ).toBeCloseTo((Math.PI * 2500) / 1e6 * 100, 6);
  });
  test('câbles avec parent exclus, câbles libres comptés', () => {
    const occ = computeOccupancy({ shape: 'rect', wMm: 1000, hMm: 1000, fourreaux: [], cables: [{ od: 50, parent: 'f1' }, { od: 50 }] });
    expect(occ).toBeCloseTo((Math.PI * 625) / 1e6 * 100, 6);
  });
  test('forme circulaire : aire = π·(D/2)²', () => {
    const occ = computeOccupancy({ shape: 'circle', dMm: 1000, fourreaux: [{ od: 100 }], cables: [] });
    expect(occ).toBeCloseTo((Math.PI * 2500) / (Math.PI * 250000) * 100, 6);
  });
  test('aire totale nulle → 0', () => {
    expect(computeOccupancy({ shape: 'rect', wMm: 0, hMm: 0, fourreaux: [{ od: 100 }], cables: [] })).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test → échec** — `npm test -- geometry.test.js` → FAIL (module absent).

- [ ] **Step 3: Créer `src/renderer/geometry.js`**

```javascript
'use strict';
(function (root) {
  function areaCircle(d) { const r = d / 2; return Math.PI * r * r; }
  function roundToStep(value, step) {
    if (!Number.isFinite(value)) return value;
    return Math.round(value / step) * step;
  }
  function computeOccupancy({ shape, wMm, hMm, dMm, fourreaux = [], cables = [] }) {
    const totalArea = (shape === 'rect' || shape === 'chemin_de_cable') ? wMm * hMm : areaCircle(dMm);
    if (totalArea <= 0) return 0;
    const occ = fourreaux.reduce((s, f) => s + areaCircle(f.od), 0);
    const occCable = cables.filter(c => !c.parent).reduce((s, c) => s + areaCircle(c.od), 0);
    return ((occ + occCable) / totalArea) * 100;
  }
  const api = { areaCircle, roundToStep, computeOccupancy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Geom = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Wrappers dans `script.js`**

Remplacer `const areaCircle = d => {...}` par `const areaCircle = d => Geom.areaCircle(d);`
Remplacer le corps de `roundToStep` par `return Geom.roundToStep(value, step);`
Remplacer le corps de `calculateBoxOccupancy` par :
```javascript
    return Geom.computeOccupancy({ shape: SHAPE, wMm: WORLD_W_MM, hMm: WORLD_H_MM, dMm: WORLD_D_MM, fourreaux, cables });
```

- [ ] **Step 5: Charger dans `index.html`** — ajouter `<script src="geometry.js"></script>` après `packer.js` (avant `csv.js`).

- [ ] **Step 6: Vérifier** — `node --check src/renderer/geometry.js src/renderer/script.js` ; `npm test` (vert, +tests géométrie).

- [ ] **Step 7: Commit** — `refactor(geometry): extrait areaCircle/roundToStep/computeOccupancy dans un module testé`.

---

### Task 2: Module agrégation inventaire (`inventory-agg.js`)

**Files:**
- Create: `src/renderer/inventory-agg.js`
- Modify: `src/renderer/script.js` (remplace `countGroups` ~5441 par un wrapper)
- Modify: `src/renderer/index.html` (charge `inventory-agg.js`)
- Test: `tests/inventory-agg.test.js`

**Interfaces:**
- Produces: `InventoryAgg.countGroups(fourreaux, cables) -> { fc: {[type|code]: n}, cc: {[fam|code]: n} }`

- [ ] **Step 1: Écrire le test qui échoue** (`tests/inventory-agg.test.js`)

```javascript
const { countGroups } = require('../src/renderer/inventory-agg.js');

describe('countGroups', () => {
  test('compte les fourreaux par type|code et les câbles par fam|code', () => {
    const { fc, cc } = countGroups(
      [{ type: 'TPC', code: '200' }, { type: 'TPC', code: '200' }, { type: 'TPC', code: '125' }],
      [{ fam: 'U1000', code: '3x2.5' }]
    );
    expect(fc).toEqual({ 'TPC|200': 2, 'TPC|125': 1 });
    expect(cc).toEqual({ 'U1000|3x2.5': 1 });
  });
  test('listes vides → objets vides', () => {
    expect(countGroups([], [])).toEqual({ fc: {}, cc: {} });
  });
});
```

- [ ] **Step 2: Lancer le test → échec** — `npm test -- inventory-agg.test.js` → FAIL.

- [ ] **Step 3: Créer `src/renderer/inventory-agg.js`**

```javascript
'use strict';
(function (root) {
  function countGroups(fourreaux = [], cables = []) {
    const fc = {}, cc = {};
    for (const f of fourreaux) { const k = `${f.type}|${f.code}`; fc[k] = (fc[k] || 0) + 1; }
    for (const c of cables) { const k = `${c.fam}|${c.code}`; cc[k] = (cc[k] || 0) + 1; }
    return { fc, cc };
  }
  const api = { countGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InventoryAgg = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Wrapper dans `script.js`** — remplacer le corps de `countGroups()` par `return InventoryAgg.countGroups(fourreaux, cables);`

- [ ] **Step 5: Charger dans `index.html`** — `<script src="inventory-agg.js"></script>` après `pdf-format.js`.

- [ ] **Step 6: Vérifier** — `node --check` ; `npm test`.

- [ ] **Step 7: Commit** — `refactor(inventory-agg): extrait countGroups dans un module testé`.

---

## Fin du plan sûr

Après Task 2, les fonctions à cœur pur restantes sont épuisées. La suite (rendu, physique, interactions, export DXF, persistance) est **couplée à l'état global et à effets de bord** : elle exige d'abord un objet `state` explicite + une stratégie de test renderer, à cadrer en phase design séparée (brainstorming). Cette frontière est volontaire : on ne déplace pas du code non testable « à l'aveugle » juste pour réduire le compteur de lignes.

# BIG BRAIN — Brique A : moteur d'affectation câbles→fourreaux — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter `src/renderer/cable-assign.js`, module PUR qui répartit les câbles de liaisons dans des fourreaux sous un taux d'occupation max, avec tests Jest.

**Architecture:** IIFE façon `packer.js` exposant `window.CableAssign` (runtime) + `module.exports` (Jest). Aucune dépendance DOM/canvas. Algorithme glouton FFD + cohésion de liaison + remplissage croisé best-fit + split.

**Tech Stack:** Vanilla JS (pas de build), Jest.

**Spec de référence :** `docs/superpowers/specs/2026-07-28-big-brain-assignment-engine-design.md`

## Global Constraints

- Module PUR : entrées/sorties uniquement, aucune globale lue/mutée, aucun DOM.
- Déterministe : tous les tris stables, départages par identifiants → mêmes entrées, même sortie.
- Occupation : `aire(d)=π·(d/2)²` ; capacité utile d'un fourreau = `tauxMax · aire(f.id)` (`id` = Ø intérieur).
- `tauxMax` défaut `0.33` ; `tailleMaxFourreauOd` et `typesAutorises` optionnels.
- Chaque câble-unité apparaît **exactement une fois** dans `fourreaux` OU `nonPlaces`.
- Après chaque tâche : `node --check` sur le module + `npm test` (vert, croissant), puis commit.
- Chargé dans `index.html` avant `script.js`.

---

### Task 1 : Helpers purs (`cable-assign.js` — squelette + fonctions utilitaires)

**Files:**
- Create: `src/renderer/cable-assign.js`
- Test: `tests/cable-assign.test.js`

**Interfaces produites (via `CableAssign.__test`) :**
- `aire(d) -> number` = π·(d/2)²
- `capacite(f, tauxMax) -> number` = tauxMax·aire(f.id)
- `expandCables(liaisons) -> [{liaisonId,fam,code,od,fonction,area}]` (déplie `qty`)
- `eligibleFourreaux(catalogue, options) -> Fourreau[]` (filtré `od≤tailleMaxFourreauOd`, `type∈typesAutorises` ; trié par `id` croissant)
- `smallestFourreauFor(area, eligibles, tauxMax) -> Fourreau|null`

- [ ] **Step 1 : Écrire le test qui échoue** (`tests/cable-assign.test.js`)

```javascript
const { __test } = require('../src/renderer/cable-assign.js');
const { aire, capacite, expandCables, eligibleFourreaux, smallestFourreauFor } = __test;

const CAT = [
  { type: 'TPC', code: '200', od: 200, id: 150 },
  { type: 'TPC', code: '63',  od: 63,  id: 47 },
  { type: 'IRL', code: '63',  od: 63,  id: 57.3 },
];

describe('helpers occupation', () => {
  test('aire = π·(d/2)²', () => { expect(aire(10)).toBeCloseTo(Math.PI * 25, 6); });
  test('capacite = tauxMax·aire(id)', () => {
    expect(capacite({ id: 100 }, 0.33)).toBeCloseTo(0.33 * Math.PI * 2500, 6);
  });
});

describe('expandCables', () => {
  test('déplie qty en unités avec area', () => {
    const u = expandCables([{ id: 'L1', nom: 'x', cables: [{ fam: 'F', code: '1x185', od: 25.5, qty: 3, fonction: 'phase' }] }]);
    expect(u).toHaveLength(3);
    expect(u[0]).toMatchObject({ liaisonId: 'L1', code: '1x185', od: 25.5, fonction: 'phase' });
    expect(u[0].area).toBeCloseTo(Math.PI * (25.5 / 2) ** 2, 6);
  });
  test('qty 0 ou manquant → ignoré ; liste vide → []', () => {
    expect(expandCables([{ id: 'L', cables: [{ od: 10, qty: 0 }] }])).toEqual([]);
    expect(expandCables([])).toEqual([]);
  });
});

describe('eligibleFourreaux', () => {
  test('trié par id croissant (capacité croissante)', () => {
    expect(eligibleFourreaux(CAT, {}).map(f => f.id)).toEqual([47, 57.3, 150]);
  });
  test('borne tailleMaxFourreauOd exclut les trop grands (od)', () => {
    expect(eligibleFourreaux(CAT, { tailleMaxFourreauOd: 63 }).map(f => f.code)).toEqual(['63', '63']);
  });
  test('filtre typesAutorises', () => {
    expect(eligibleFourreaux(CAT, { typesAutorises: ['IRL'] }).map(f => f.type)).toEqual(['IRL']);
  });
});

describe('smallestFourreauFor', () => {
  test('plus petit fourreau dont capacité ≥ area, sinon null', () => {
    const elig = eligibleFourreaux(CAT, {});
    // cap(id47)@0.33 ≈ 572.5 ; cap(id150) ≈ 5831.5
    expect(smallestFourreauFor(500, elig, 0.33).id).toBe(47);
    expect(smallestFourreauFor(3000, elig, 0.33).id).toBe(150);
    expect(smallestFourreauFor(999999, elig, 0.33)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- cable-assign.test.js` → FAIL (module absent).

- [ ] **Step 3 : Créer `src/renderer/cable-assign.js` (helpers + squelette API)**

```javascript
'use strict';
// BIG BRAIN — moteur d'affectation câbles→fourreaux (PUR, testé). Façon packer.js.
(function (root) {
  const aire = (d) => Math.PI * (d / 2) * (d / 2);
  const aireInt = (f) => aire(f.id);
  const capacite = (f, tauxMax) => tauxMax * aireInt(f);

  // Déplie les câbles de toutes les liaisons en unités individuelles (+ area).
  function expandCables(liaisons) {
    const units = [];
    (liaisons || []).forEach((l) => {
      (l.cables || []).forEach((c) => {
        const n = Math.max(0, Math.floor(c.qty || 0));
        for (let i = 0; i < n; i++) {
          units.push({ liaisonId: l.id, fam: c.fam, code: c.code, od: c.od, fonction: c.fonction, area: aire(c.od) });
        }
      });
    });
    return units;
  }

  // Fourreaux éligibles (filtrés) triés par Ø intérieur croissant (capacité croissante).
  function eligibleFourreaux(catalogue, options) {
    const maxOd = options.tailleMaxFourreauOd;
    const types = options.typesAutorises;
    return (catalogue || [])
      .filter((f) => (maxOd == null || f.od <= maxOd) && (!types || types.includes(f.type)))
      .slice()
      .sort((a, b) => (a.id - b.id) || (a.od - b.od) || String(a.type + a.code).localeCompare(String(b.type + b.code)));
  }

  // Plus petit fourreau éligible dont la capacité ≥ area ; null sinon.
  function smallestFourreauFor(area, eligibles, tauxMax) {
    for (const f of eligibles) if (capacite(f, tauxMax) >= area) return f;
    return null;
  }

  function assignCablesToFourreaux(liaisons, catalogueFourreaux, options = {}) {
    return { fourreaux: [], nonPlaces: [] }; // implémenté en Task 2
  }

  const api = {
    assignCablesToFourreaux,
    __test: { aire, aireInt, capacite, expandCables, eligibleFourreaux, smallestFourreauFor },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CableAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4 : Lancer → vert** — `npm test -- cable-assign.test.js` → PASS ; `node --check src/renderer/cable-assign.js`.

- [ ] **Step 5 : Commit** — `git add src/renderer/cable-assign.js tests/cable-assign.test.js && git commit -m "feat(cable-assign): helpers purs occupation + éligibilité (Brique A, TDD)"`

---

### Task 2 : Algorithme `assignCablesToFourreaux`

**Files:**
- Modify: `src/renderer/cable-assign.js` (remplacer le stub `assignCablesToFourreaux`)
- Modify: `tests/cable-assign.test.js` (ajouter les suites algorithme)

**Interfaces produites :**
- `assignCablesToFourreaux(liaisons, catalogue, options) -> { fourreaux: [{type,code,od,id,cables:[{liaisonId,fam,code,od,fonction}],usedArea,tauxOccupation}], nonPlaces: [{liaisonId,fam,code,od,raison}] }`

- [ ] **Step 1 : Écrire les tests qui échouent** (ajouter à `tests/cable-assign.test.js`)

```javascript
const { assignCablesToFourreaux } = require('../src/renderer/cable-assign.js');

const CAT2 = [
  { type: 'TPC', code: '63',  od: 63,  id: 47 },   // cap@0.33 ≈ 572.5
  { type: 'TPC', code: '110', od: 110, id: 82 },   // cap@0.33 ≈ 1742.8
  { type: 'TPC', code: '200', od: 200, id: 150 },  // cap@0.33 ≈ 5831.5
];
// aire(od) : od19≈283.5, od40≈1256.6, od60≈2827.4, od200≈31416
const liaison = (id, od, qty = 1) => ({ id, nom: id, cables: [{ fam: 'U1000 R2V', code: `${od}`, od, qty }] });
const TAUX = 0.33 + 1e-9;

describe('assignCablesToFourreaux', () => {
  test('petite liaison → plus petit fourreau', () => {
    const r = assignCablesToFourreaux([liaison('L1', 19)], CAT2, { tauxMax: 0.33 });
    expect(r.fourreaux).toHaveLength(1);
    expect(r.fourreaux[0].code).toBe('63');
    expect(r.fourreaux[0].cables).toHaveLength(1);
    expect(r.nonPlaces).toEqual([]);
  });

  test('regroupement croisé : 2 liaisons dans 1 fourreau, la 3e ouvre un 2e', () => {
    const r = assignCablesToFourreaux([liaison('A', 19), liaison('B', 19), liaison('C', 19)], CAT2, { tauxMax: 0.33 });
    // 2×283.5=567 ≤ 572.5 ; 3×=850.5 > 572.5
    expect(r.fourreaux).toHaveLength(2);
    expect(r.fourreaux[0].cables).toHaveLength(2);
    expect(r.fourreaux[1].cables).toHaveLength(1);
    expect(r.nonPlaces).toEqual([]);
  });

  test('taux max jamais dépassé', () => {
    const many = Array.from({ length: 12 }, (_, i) => liaison('L' + i, 40));
    const r = assignCablesToFourreaux(many, CAT2, { tauxMax: 0.33 });
    for (const f of r.fourreaux) expect(f.tauxOccupation).toBeLessThanOrEqual(TAUX);
  });

  test('split : grosse liaison répartie sur plusieurs fourreaux', () => {
    // 3 câbles od60 (2827 chacun, total 8482) > cap max 5831 → split
    const L = { id: 'BIG', nom: 'BIG', cables: [{ fam: 'F', code: '60', od: 60, qty: 3 }] };
    const r = assignCablesToFourreaux([L], CAT2, { tauxMax: 0.33 });
    const placed = r.fourreaux.reduce((s, f) => s + f.cables.length, 0);
    expect(placed).toBe(3);
    expect(r.fourreaux.length).toBeGreaterThanOrEqual(2);
    expect(r.fourreaux.every(f => f.code === '200')).toBe(true);
    expect(r.nonPlaces).toEqual([]);
  });

  test('câble trop gros pour la taille max → nonPlaces (pas de crash)', () => {
    const r = assignCablesToFourreaux([liaison('X', 200)], CAT2, { tauxMax: 0.33 });
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces).toHaveLength(1);
    expect(r.nonPlaces[0]).toMatchObject({ liaisonId: 'X', od: 200 });
  });

  test('borne tailleMaxFourreauOd : od40 ne rentre plus si limité au 63', () => {
    const r = assignCablesToFourreaux([liaison('Y', 40)], CAT2, { tauxMax: 0.33, tailleMaxFourreauOd: 63 });
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces).toHaveLength(1);
  });

  test('catalogue vide → tout en nonPlaces avec raison dédiée', () => {
    const r = assignCablesToFourreaux([liaison('Z', 19)], [], {});
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces[0].raison).toBe('aucun fourreau éligible');
  });

  test('déterministe : deux appels identiques → résultat identique', () => {
    const input = [liaison('A', 40), liaison('B', 19), liaison('C', 60)];
    const a = assignCablesToFourreaux(input, CAT2, { tauxMax: 0.33 });
    const b = assignCablesToFourreaux(input, CAT2, { tauxMax: 0.33 });
    expect(a).toEqual(b);
  });

  test('liaisons vides → { fourreaux:[], nonPlaces:[] } ; taux par défaut 0.33', () => {
    expect(assignCablesToFourreaux([], CAT2)).toEqual({ fourreaux: [], nonPlaces: [] });
    // défaut : od40 (1256.6) tient dans id82 (cap 1742) mais pas id47 (572) → code 110
    const r = assignCablesToFourreaux([liaison('D', 40)], CAT2);
    expect(r.fourreaux[0].code).toBe('110');
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- cable-assign.test.js` → FAIL (stub renvoie vide).

- [ ] **Step 3 : Remplacer le stub `assignCablesToFourreaux`** par :

```javascript
  function assignCablesToFourreaux(liaisons, catalogueFourreaux, options = {}) {
    const tauxMax = (typeof options.tauxMax === 'number' && options.tauxMax > 0) ? options.tauxMax : 0.33;
    const eligibles = eligibleFourreaux(catalogueFourreaux, options);
    const raisonAucun = eligibles.length === 0 ? 'aucun fourreau éligible' : 'câble trop gros pour la taille max';
    const EPS = 1e-9;

    const open = [];        // { fourreau, cables:[], usedArea }
    const nonPlaces = [];

    // Regrouper les unités par liaison (ordre d'apparition conservé).
    const byLiaison = new Map();
    for (const u of expandCables(liaisons)) {
      if (!byLiaison.has(u.liaisonId)) byLiaison.set(u.liaisonId, []);
      byLiaison.get(u.liaisonId).push(u);
    }
    // Liaisons triées par aire totale décroissante (départage : liaisonId).
    const liaisonEntries = [...byLiaison.entries()]
      .map(([id, cables]) => ({ id, cables, area: cables.reduce((s, c) => s + c.area, 0) }))
      .sort((a, b) => (b.area - a.area) || String(a.id).localeCompare(String(b.id)));

    // Best-fit : fourreau ouvert le plus rempli qui accepte encore `area`.
    const bestOpenFor = (area) => {
      let best = null;
      for (const o of open) {
        if (o.usedArea + area <= capacite(o.fourreau, tauxMax) + EPS && (!best || o.usedArea > best.usedArea)) best = o;
      }
      return best;
    };
    const addTo = (o, cs) => { for (const c of cs) { o.cables.push(c); o.usedArea += c.area; } };
    const placeSingle = (c) => {
      const o = bestOpenFor(c.area);
      if (o) return addTo(o, [c]);
      const f = smallestFourreauFor(c.area, eligibles, tauxMax);
      if (f) return open.push({ fourreau: f, cables: [c], usedArea: c.area });
      nonPlaces.push({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, raison: raisonAucun });
    };

    for (const L of liaisonEntries) {
      const o = bestOpenFor(L.area);                         // 1) regroupement croisé
      if (o) { addTo(o, L.cables); continue; }
      const f = smallestFourreauFor(L.area, eligibles, tauxMax); // 2) nouveau fourreau pour liaison entière
      if (f) { open.push({ fourreau: f, cables: [...L.cables], usedArea: L.area }); continue; }
      const sorted = [...L.cables].sort((a, b) => (b.area - a.area) || String(a.code).localeCompare(String(b.code)));
      for (const c of sorted) placeSingle(c);               // 3) split câble par câble
    }

    const fourreaux = open.map((o) => ({
      type: o.fourreau.type, code: o.fourreau.code, od: o.fourreau.od, id: o.fourreau.id,
      cables: o.cables.map((c) => ({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, fonction: c.fonction })),
      usedArea: o.usedArea,
      tauxOccupation: o.usedArea / aireInt(o.fourreau),
    }));
    return { fourreaux, nonPlaces };
  }
```

- [ ] **Step 4 : Lancer → vert** — `npm test -- cable-assign.test.js` → PASS ; `node --check src/renderer/cable-assign.js` ; `npm test` (toute la suite verte).

- [ ] **Step 5 : Commit** — `git add src/renderer/cable-assign.js tests/cable-assign.test.js && git commit -m "feat(cable-assign): algorithme d'affectation (FFD + regroupement + split) (Brique A, TDD)"`

---

### Task 3 : Enregistrer le module dans `index.html`

**Files:**
- Modify: `src/renderer/index.html`

Le module est inerte tant que la Brique B (modale) ne l'appelle pas, mais on l'enregistre pour qu'il soit disponible (comme `packer.js`).

- [ ] **Step 1 : Ajouter le `<script>`** — après `<script src="packer.js"></script>` (bloc des modules purs, avant `script.js`) :

```html
  <script src="cable-assign.js"></script>
```

- [ ] **Step 2 : Vérifier** — ouvrir l'app (`npm start`) → aucune erreur console ; `window.CableAssign` défini. (`npm test` reste vert.)

- [ ] **Step 3 : Commit** — `git add src/renderer/index.html && git commit -m "chore(cable-assign): charge le module dans index.html (dispo pour Brique B)"`

---

## Fin de la Brique A

Livrable : `cable-assign.js` pur + testé, enregistré. Les Briques B (modale de saisie
des liaisons + paramètres) et C (placement/chambre/nommage) feront l'objet de specs et
plans séparés, en réutilisant `CableAssign.assignCablesToFourreaux`.

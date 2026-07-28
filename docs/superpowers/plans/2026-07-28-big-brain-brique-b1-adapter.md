# BIG BRAIN — Brique B1 : adaptateur pur `big-brain.js` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter `src/renderer/big-brain.js`, adaptateur PUR entre le moteur `CableAssign` (Brique A) et la future modale : validation des liaisons + transformation du résultat en objets prêts à créer. Avec tests Jest.

**Architecture:** IIFE façon `packer.js`/`cable-assign.js` exposant `window.BigBrain` + `module.exports`. Aucune dépendance DOM/canvas.

**Tech Stack:** Vanilla JS (pas de build), Jest.

**Spec de référence :** `docs/superpowers/specs/2026-07-28-big-brain-modal-brique-b-design.md`

## Global Constraints

- Module PUR : entrées/sorties uniquement, aucune globale, aucun DOM.
- Après chaque tâche : `node --check` sur le module + `npm test` (vert, croissant), puis commit.
- Chargé dans `index.html` avant `script.js` (comme les autres modules purs).
- Ne toucher que : `src/renderer/big-brain.js`, `tests/big-brain.test.js`, `src/renderer/index.html`.
- Environnement Windows/Git Bash : pas de `sed -i` (bloqué) — éditer via les outils d'édition.

---

### Task 1 : `big-brain.js` (adaptateur pur) + tests

**Files:**
- Create: `src/renderer/big-brain.js`
- Test: `tests/big-brain.test.js`

**Interfaces produites :**
- `validateLiaisons(liaisons) -> { ok: boolean, errors: [{ index, message }] }`
- `resultToObjects(result, liaisonsById) -> { fourreaux: [{type,code,od,idm,tauxOccupation,label}], cables: [{fam,code,od,fonction,parentIndex,label}] }`

- [ ] **Step 1 : Écrire le test qui échoue** (`tests/big-brain.test.js`)

```javascript
const { validateLiaisons, resultToObjects } = require('../src/renderer/big-brain.js');

const liaisonOK = () => ({ id: 'L1', nom: 'TGBT → GE', cables: [{ fam: 'U1000 R2V', code: '2x185', od: 25.5, qty: 3 }] });

describe('validateLiaisons', () => {
  test('liste vide → ok:false', () => {
    const r = validateLiaisons([]);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/aucune liaison/i);
  });
  test('cas valide → ok:true, errors vide', () => {
    expect(validateLiaisons([liaisonOK()])).toEqual({ ok: true, errors: [] });
  });
  test('nom vide → erreur sur l’index', () => {
    const r = validateLiaisons([{ id: 'L', nom: '  ', cables: [{ fam: 'F', code: 'c', od: 10, qty: 1 }] }]);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.index === 0 && /nom/i.test(e.message))).toBe(true);
  });
  test('liaison sans câble → erreur', () => {
    const r = validateLiaisons([{ id: 'L', nom: 'X', cables: [] }]);
    expect(r.errors.some(e => /sans câble/i.test(e.message))).toBe(true);
  });
  test('câble od<=0 ou qty invalide → erreur', () => {
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 0, qty: 1 }] }]).ok).toBe(false);
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 10, qty: 0 }] }]).ok).toBe(false);
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 10, qty: 1.5 }] }]).ok).toBe(false);
  });
  test('câble sans fam/code → erreur', () => {
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ od: 10, qty: 1 }] }]).ok).toBe(false);
  });
});

describe('resultToObjects', () => {
  const result = {
    fourreaux: [
      { type: 'TPC', code: '200', od: 200, id: 150, tauxOccupation: 0.31, cables: [
        { liaisonId: 'L1', fam: 'U1000 R2V', code: '2x185', od: 25.5, fonction: 'phase' },
        { liaisonId: 'L1', fam: 'U1000 R2V', code: '1x185', od: 25.5, fonction: 'PE' },
      ] },
      { type: 'TPC', code: '110', od: 110, id: 82, tauxOccupation: 0.2, cables: [
        { liaisonId: 'L2', fam: 'F', code: 'c', od: 20 },
      ] },
    ],
    nonPlaces: [],
  };
  const names = { L1: 'TGBT → GE', L2: 'GE → Onduleur' };

  test('mappe id→idm et conserve type/code/od/taux', () => {
    const { fourreaux } = resultToObjects(result, names);
    expect(fourreaux[0]).toMatchObject({ type: 'TPC', code: '200', od: 200, idm: 150, tauxOccupation: 0.31 });
  });
  test('parentIndex rattache chaque câble au bon fourreau', () => {
    const { cables } = resultToObjects(result, names);
    expect(cables).toHaveLength(3);
    expect(cables.filter(c => c.parentIndex === 0)).toHaveLength(2);
    expect(cables.filter(c => c.parentIndex === 1)).toHaveLength(1);
  });
  test('labels résolus via liaisonsById, fallback = liaisonId', () => {
    expect(resultToObjects(result, names).fourreaux[0].label).toBe('TGBT → GE');
    expect(resultToObjects(result, names).cables[2].label).toBe('GE → Onduleur');
    expect(resultToObjects(result, {}).cables[0].label).toBe('L1'); // fallback
  });
  test('label fourreau multi-liaisons → "nom +N"', () => {
    const mixed = { fourreaux: [{ type: 'T', code: 'c', od: 1, id: 1, cables: [
      { liaisonId: 'L1' }, { liaisonId: 'L2' },
    ] }], nonPlaces: [] };
    expect(resultToObjects(mixed, names).fourreaux[0].label).toBe('TGBT → GE +1');
  });
  test('résultat vide → objets vides', () => {
    expect(resultToObjects({ fourreaux: [], nonPlaces: [] }, {})).toEqual({ fourreaux: [], cables: [] });
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- big-brain.test.js` → FAIL (module absent).

- [ ] **Step 3 : Créer `src/renderer/big-brain.js`**

```javascript
'use strict';
// BIG BRAIN — adaptateur PUR entre CableAssign (Brique A) et la modale (Brique B2).
// Façon packer.js : window.BigBrain + module.exports. Aucun DOM.
(function (root) {
  // Valide la saisie des liaisons avant génération.
  function validateLiaisons(liaisons) {
    if (!Array.isArray(liaisons) || liaisons.length === 0) {
      return { ok: false, errors: [{ index: -1, message: 'Aucune liaison définie' }] };
    }
    const errors = [];
    liaisons.forEach((l, index) => {
      if (!l || typeof l.nom !== 'string' || !l.nom.trim()) {
        errors.push({ index, message: 'Nom de liaison vide' });
      }
      const cables = (l && Array.isArray(l.cables)) ? l.cables : [];
      if (cables.length === 0) {
        errors.push({ index, message: 'Liaison sans câble' });
      }
      cables.forEach((c) => {
        if (!c || !c.fam || !c.code) errors.push({ index, message: 'Câble incomplet (fam/code)' });
        else if (!(Number(c.od) > 0)) errors.push({ index, message: 'Câble sans diamètre valide' });
        else if (!(Number.isInteger(c.qty) && c.qty >= 1)) errors.push({ index, message: 'Quantité de câble invalide (≥ 1)' });
      });
    });
    return { ok: errors.length === 0, errors };
  }

  // Transforme le résultat moteur en objets prêts à instancier dans l'app.
  function resultToObjects(result, liaisonsById) {
    const names = liaisonsById || {};
    const nameOf = (id) => (names[id] != null ? names[id] : String(id));
    const fourreaux = [];
    const cables = [];
    const list = (result && Array.isArray(result.fourreaux)) ? result.fourreaux : [];
    list.forEach((f, i) => {
      const liaisonNames = [...new Set((f.cables || []).map((c) => nameOf(c.liaisonId)))];
      const label = liaisonNames.length <= 1
        ? (liaisonNames[0] || '')
        : `${liaisonNames[0]} +${liaisonNames.length - 1}`;
      fourreaux.push({ type: f.type, code: f.code, od: f.od, idm: f.id, tauxOccupation: f.tauxOccupation, label });
      (f.cables || []).forEach((c) => {
        cables.push({ fam: c.fam, code: c.code, od: c.od, fonction: c.fonction, parentIndex: i, label: nameOf(c.liaisonId) });
      });
    });
    return { fourreaux, cables };
  }

  const api = { validateLiaisons, resultToObjects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BigBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4 : Lancer → vert** — `npm test -- big-brain.test.js` → PASS ; `node --check src/renderer/big-brain.js` ; `npm test` (toute la suite verte).

- [ ] **Step 5 : Commit** — `git add src/renderer/big-brain.js tests/big-brain.test.js && git commit -m "feat(big-brain): adaptateur pur validateLiaisons + resultToObjects (Brique B1, TDD)"`

---

### Task 2 : Enregistrer le module dans `index.html`

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1 : Ajouter le `<script>`** — après `<script src="cable-assign.js"></script>` (bloc des modules purs) :

```html
  <script src="big-brain.js"></script>
```

- [ ] **Step 2 : Vérifier** — `npm test` reste vert ; ouvrir l'app (`npm start`) → aucune erreur console, `window.BigBrain` défini.

- [ ] **Step 3 : Commit** — `git add src/renderer/index.html && git commit -m "chore(big-brain): charge l'adaptateur dans index.html (dispo pour Brique B2)"`

---

## Fin de la Brique B1

Livrable : `big-brain.js` pur + testé, enregistré. La Brique B2 (modale DOM maître-détail
+ intégration `script.js`) fera l'objet d'un spec/plan séparé, réutilisant
`BigBrain.validateLiaisons` / `BigBrain.resultToObjects` et `CableAssign`.

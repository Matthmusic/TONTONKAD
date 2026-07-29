# BIG BRAIN — Brique C : phases auto + suggestion de chambre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Nommage automatique des phases (L1/L2/L3/N/PE, modifiable par câble) sur les câbles générés par BIG BRAIN, + suggestion informative de chambre de tirage après génération.

**Architecture:** Un module PUR `phase-assign.js` (façon `cable-assign.js`). Intégration dans `bigBrainGenerate` (`script.js`) qui pose `customColor` = couleur de phase (le libellé s'affiche alors tout seul). Toast de chambre via `CompatChambres`. Colonne « fonction » dans la modale.

**Tech Stack:** Vanilla JS (pas de build), Jest.

**Spec :** `docs/superpowers/specs/2026-07-29-big-brain-brique-c-phases-chambre-design.md`

## Global Constraints

- `phase-assign.js` est PUR : entrées/sorties, aucune globale, aucun DOM. IIFE → `window.PhaseAssign` + `module.exports`.
- Le canvas affiche déjà le libellé de phase quand `customColor` vaut une couleur de `COLOR_SYSTEM.PHASE_COLORS` — ne PAS réimplémenter d'affichage.
- Le cycle L1→L2→L3 est **local à chaque liaison** ; les entrées `null` ne consomment pas le cycle.
- La suggestion de chambre est **informative** : aucun redimensionnement, aucun verrouillage, aucun label appliqué.
- Après chaque tâche : `node --check` sur les JS touchés + `npm test` (vert, croissant), puis commit.
- Fichiers autorisés : `src/renderer/phase-assign.js`, `tests/phase-assign.test.js`, `src/renderer/big-brain.js`, `tests/big-brain.test.js`, `src/renderer/script.js`, `src/renderer/big-brain-modal.js`, `src/renderer/index.html`, `src/renderer/style.css`. Pas de push.
- Windows/Git Bash : `sed -i` bloqué — utiliser les outils d'édition.

---

### Task 1 : module `phase-assign.js` + tests

**Files:** Create `src/renderer/phase-assign.js`, `tests/phase-assign.test.js` ; Modify `src/renderer/index.html`

**Interfaces produites :**
- `PhaseAssign.isUnipolaire(code) -> boolean`
- `PhaseAssign.assignPhases(cables) -> Array<'L1'|'L2'|'L3'|'N'|'PE'|null>` (une entrée par câble-unité, `qty` déplié)

- [ ] **Step 1 : Écrire le test qui échoue** (`tests/phase-assign.test.js`)

```javascript
const { assignPhases, isUnipolaire } = require('../src/renderer/phase-assign.js');

describe('isUnipolaire', () => {
  test('1x… → true, multipolaire → false', () => {
    expect(isUnipolaire('1x185')).toBe(true);
    expect(isUnipolaire('1X10')).toBe(true);
    expect(isUnipolaire(' 1x6 ')).toBe(true);
    expect(isUnipolaire('2x185')).toBe(false);
    expect(isUnipolaire('4x25')).toBe(false);
    expect(isUnipolaire('')).toBe(false);
    expect(isUnipolaire(undefined)).toBe(false);
  });
});

describe('assignPhases — mode auto', () => {
  test('unipolaires : cycle L1/L2/L3 sur les unités (qty déplié)', () => {
    expect(assignPhases([{ code: '1x185', qty: 3 }])).toEqual(['L1', 'L2', 'L3']);
  });
  test('le cycle boucle après L3', () => {
    expect(assignPhases([{ code: '1x185', qty: 4 }])).toEqual(['L1', 'L2', 'L3', 'L1']);
  });
  test('multipolaire → null et ne consomme pas le cycle', () => {
    expect(assignPhases([{ code: '2x185', qty: 1 }, { code: '1x185', qty: 2 }]))
      .toEqual([null, 'L1', 'L2']);
  });
});

describe('assignPhases — fonction explicite', () => {
  test('neutre → N, PE → PE, aucune → null', () => {
    expect(assignPhases([
      { code: '1x185', qty: 1, fonction: 'neutre' },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1, fonction: 'aucune' },
    ])).toEqual(['N', 'PE', null]);
  });
  test('phase forcée sur un multipolaire prend quand même le cycle', () => {
    expect(assignPhases([{ code: '4x25', qty: 2, fonction: 'phase' }])).toEqual(['L1', 'L2']);
  });
  test('N et PE ne consomment pas le cycle des phases', () => {
    expect(assignPhases([
      { code: '1x185', qty: 2 },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1 },
    ])).toEqual(['L1', 'L2', 'PE', 'L3']);
  });
  test('cas métier 3×[2x185] + PE[1x185]', () => {
    expect(assignPhases([
      { code: '2x185', qty: 3 },
      { code: '1x185', qty: 1, fonction: 'PE' },
    ])).toEqual([null, null, null, 'PE']);
  });
});

describe('assignPhases — cas limites', () => {
  test('liste vide → []', () => { expect(assignPhases([])).toEqual([]); });
  test('qty absent → 1 unité ; qty 0 → ignoré', () => {
    expect(assignPhases([{ code: '1x185' }])).toEqual(['L1']);
    expect(assignPhases([{ code: '1x185', qty: 0 }])).toEqual([]);
  });
  test('qty en chaîne numérique tolérée', () => {
    expect(assignPhases([{ code: '1x185', qty: '2' }])).toEqual(['L1', 'L2']);
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- phase-assign.test.js` → FAIL (module absent).

- [ ] **Step 3 : Créer `src/renderer/phase-assign.js`**

```javascript
'use strict';
// BIG BRAIN — affectation des phases électriques (PUR, testé). Façon cable-assign.js.
// Le canvas affiche le libellé de phase dès que le câble porte la couleur
// correspondante (COLOR_SYSTEM.PHASE_COLORS) — ce module ne décide QUE la phase.
(function (root) {
  const CYCLE = ['L1', 'L2', 'L3'];

  // Un code catalogue « 1x… » désigne un câble unipolaire (un seul conducteur).
  function isUnipolaire(code) {
    return /^1\s*x/i.test(String(code == null ? '' : code).trim());
  }

  // cables : câbles d'UNE liaison [{ code, qty, fonction }]. fonction ∈
  // 'auto' (défaut) | 'phase' | 'neutre' | 'PE' | 'aucune'.
  // Retourne une phase (ou null) par câble-unité, qty déplié. Le cycle L1→L2→L3
  // est local à l'appel (donc à la liaison) ; les null ne le consomment pas.
  function assignPhases(cables) {
    const out = [];
    let cursor = 0;
    (cables || []).forEach((c) => {
      const n = Math.max(0, Math.floor(Number(c && c.qty != null ? c.qty : 1)) || 0);
      const fonction = (c && c.fonction) || 'auto';
      for (let i = 0; i < n; i++) {
        if (fonction === 'neutre') { out.push('N'); continue; }
        if (fonction === 'PE') { out.push('PE'); continue; }
        if (fonction === 'aucune') { out.push(null); continue; }
        const estPhase = (fonction === 'phase') || (fonction === 'auto' && isUnipolaire(c.code));
        if (!estPhase) { out.push(null); continue; }
        out.push(CYCLE[cursor % CYCLE.length]);
        cursor++;
      }
    });
    return out;
  }

  const api = { assignPhases, isUnipolaire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhaseAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4 : Charger dans `index.html`** — après `<script src="big-brain.js"></script>` : `<script src="phase-assign.js"></script>`

- [ ] **Step 5 : Vérifier** — `npm test -- phase-assign.test.js` PASS ; `node --check src/renderer/phase-assign.js` ; `npm test` (toute la suite verte).

- [ ] **Step 6 : Commit** — `feat(phase-assign): module pur d'affectation des phases (Brique C, TDD)`

---

### Task 2 : `liaisonId` sur les câbles de `resultToObjects`

**Files:** Modify `src/renderer/big-brain.js`, `tests/big-brain.test.js`

Nécessaire pour regrouper les câbles générés par liaison au moment d'affecter les phases.
Ajout **additif** (aucun champ existant modifié).

- [ ] **Step 1 : Ajouter le test** (dans le describe `resultToObjects` de `tests/big-brain.test.js`)

```javascript
  test('chaque câble porte son liaisonId (pour l’affectation des phases)', () => {
    const { cables } = resultToObjects(result, names);
    expect(cables.map(c => c.liaisonId)).toEqual(['L1', 'L1', 'L2']);
  });
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- big-brain.test.js` → FAIL (`undefined`).

- [ ] **Step 3 : Ajouter le champ** dans `src/renderer/big-brain.js`, fonction `resultToObjects`, au `cables.push({...})` : ajouter `liaisonId: c.liaisonId,` en première propriété.

- [ ] **Step 4 : Vérifier** — `npm test` (tout vert) ; `node --check src/renderer/big-brain.js`.

- [ ] **Step 5 : Commit** — `feat(big-brain): expose liaisonId sur les câbles de resultToObjects`

---

### Task 3 : intégration dans `bigBrainGenerate` (phases + toast chambre)

**Files:** Modify `src/renderer/script.js`

**Signature étendue (rétrocompatible) :** `bigBrainGenerate(result, liaisonsById, replace, liaisons)` — `liaisons` optionnel : tableau des liaisons saisies (avec `cables[].fonction`). Sans lui, aucune phase n'est posée (comportement actuel).

- [ ] **Step 1 : Modifier `bigBrainGenerate`** (`script.js`, ~ligne 1702)

Remplacer la signature et ajouter le calcul des phases avant la création des câbles :

```javascript
  function bigBrainGenerate(result, liaisonsById, replace, liaisons) {
```

Juste après `const objs = window.BigBrain.resultToObjects(...)`, ajouter :

```javascript
    // Phases par liaison : une file de phases consommée dans l'ordre des câbles
    // de cette liaison (le cycle L1/L2/L3 redémarre à chaque liaison).
    const phaseQueues = {};
    if (Array.isArray(liaisons) && window.PhaseAssign) {
      liaisons.forEach((l) => {
        phaseQueues[l.id] = window.PhaseAssign.assignPhases(l.cables || []);
      });
    }
    const phaseCursors = {};
```

Puis, dans `objs.cables.forEach((co) => {` , juste avant le `cables.push({...})`, ajouter :

```javascript
      // Couleur de phase → le libellé L1/L2/L3/N/PE s'affiche automatiquement.
      let phaseColor = null;
      const queue = phaseQueues[co.liaisonId];
      if (queue) {
        const k = phaseCursors[co.liaisonId] || 0;
        phaseCursors[co.liaisonId] = k + 1;
        const phase = queue[k];
        if (phase && typeof COLOR_SYSTEM !== 'undefined') {
          const col = COLOR_SYSTEM.getByPhase(phase);
          if (col) phaseColor = col.hex;
        }
      }
```

et remplacer `customColor: null,` par `customColor: phaseColor,` dans ce `cables.push`.

- [ ] **Step 2 : Ajouter la suggestion de chambre** — juste avant `return { created… }` (donc après `redraw()`), insérer :

```javascript
    // Suggestion INFORMATIVE de chambre de tirage (rien n'est appliqué).
    try {
      if (SHAPE === 'rect' && window.CompatChambres && typeof showToast === 'function') {
        const models = window.CompatChambres.getChamberModels(CHAMBRES_TIRAGE);
        const { unit } = window.CompatChambres.computeCompatibleChambers(
          models, Math.round(WORLD_W_MM), Math.round(WORLD_H_MM), 3
        );
        if (unit && unit.length) {
          const b = unit[0];
          showToast(`🏗️ Chambre ${b.ref} compatible (${b.l} × ${b.H} mm) — voir « Chambres compatibles »`, 'info', 6000);
        }
      }
    } catch (e) {
      console.warn('[BIG BRAIN] suggestion de chambre indisponible', e);
    }
```

- [ ] **Step 3 : Exposer `CompatChambres`** — vérifier que `window.CompatChambres` existe (le module `compat-chambres.js` s'expose déjà ainsi en runtime). Si `CHAMBRES_TIRAGE` n'est pas accessible dans la portée de `bigBrainGenerate`, utiliser la variable de module existante (elle est déclarée en haut de `script.js`).

- [ ] **Step 4 : Vérifier** — `node --check src/renderer/script.js` ; `npm test` (inchangé, vert).

- [ ] **Step 5 : Commit** — `feat(big-brain): phases automatiques sur les câbles générés + suggestion de chambre`

---

### Task 4 : colonne « fonction » dans la modale

**Files:** Modify `src/renderer/big-brain-modal.js`, `src/renderer/style.css`

- [ ] **Step 1 : Ajouter le select** dans `renderDetail()` (`big-brain-modal.js`), entre `qtyInput` et `removeBtn` :

```javascript
      const fonctionSelect = document.createElement('select');
      fonctionSelect.className = 'bb-cable-fonction';
      fonctionSelect.setAttribute('aria-label', 'Fonction du câble (phase)');
      [
        ['auto', 'Auto'], ['phase', 'Phase'], ['neutre', 'Neutre'], ['PE', 'PE'], ['aucune', 'Aucune'],
      ].forEach(([value, texte]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = texte;
        if ((cable.fonction || 'auto') === value) opt.selected = true;
        fonctionSelect.appendChild(opt);
      });
```

et l'insérer : `row.appendChild(fonctionSelect);` **avant** `row.appendChild(removeBtn);`

- [ ] **Step 2 : Gérer le changement** — dans la délégation `change` qui traite déjà `.bb-cable-fam` / `.bb-cable-code` / `.bb-cable-qty`, ajouter une branche :

```javascript
        if (target.classList.contains('bb-cable-fonction')) {
          cable.fonction = target.value;
        }
```

- [ ] **Step 3 : Initialiser à la création** — dans `addCableToSelected()`, ajouter `fonction: 'auto'` à l'objet poussé.

- [ ] **Step 4 : Transmettre aux modules ET à la génération** — dans la construction des liaisons (`built`), inclure `fonction: c.fonction || 'auto'` pour chaque câble ; et à l'appel de génération, passer `built` en 4ᵉ argument : `window.bigBrainGenerate(result, liaisonsById, replace, built)`.

- [ ] **Step 5 : CSS** — dans `style.css`, ajouter `.bb-cable-fonction` en calquant `.bb-cable-code` (même hauteur/police/bordure), largeur ~90px. Ajuster la grille/flex de `.bb-cable-row` si nécessaire pour accueillir la colonne supplémentaire sans casser l'alignement.

- [ ] **Step 6 : Vérifier** — `node --check src/renderer/big-brain-modal.js` ; `npm test` (vert).

- [ ] **Step 7 : Commit** — `feat(big-brain): colonne fonction (phase) dans la modale`

---

## Fin de la Brique C

Livrable : phases automatiques et modifiables sur les câbles générés (libellé + couleur), suggestion informative de chambre. Vérification finale dans l'app par l'utilisateur.

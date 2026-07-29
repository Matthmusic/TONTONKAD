# BIG BRAIN — Brique D : saisie par circuit + correctifs UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Remplacer la saisie « lignes de câble » par un bloc **circuit** (phases / neutre / PE, sections indépendantes), et corriger 3 défauts UX relevés au test terrain (centrage de la modale, libellé de liaison répété sur les câbles, emplacement du bouton BIG BRAIN).

**Architecture:** Un module PUR `circuit.js` (`circuitToCables`) alimente les moteurs existants sans les modifier. La modale passe d'une liste de lignes à un formulaire de circuit. Le bouton devient un 3ᵉ onglet de la carte de saisie.

**Tech Stack:** Vanilla JS, Jest.

**Spec :** `docs/superpowers/specs/2026-07-29-big-brain-brique-d-circuits-ux-design.md`

## Global Constraints

- `circuit.js` est PUR : aucune globale, aucun DOM ; le catalogue est injecté via `resolveOd(fam, code)`. IIFE → `window.Circuit` + `module.exports`.
- **Ne PAS modifier** `cable-assign.js` ni `phase-assign.js` : leurs formats d'entrée restent identiques (`circuitToCables` produit exactement le format `cables[]` attendu).
- Après chaque tâche : `node --check` sur les JS touchés + `npm test` (vert, croissant), puis commit.
- Fichiers autorisés : `src/renderer/circuit.js`, `tests/circuit.test.js`, `src/renderer/big-brain.js`, `tests/big-brain.test.js`, `src/renderer/big-brain-modal.js`, `src/renderer/index.html`, `src/renderer/style.css`. Pas de push.
- Windows/Git Bash : `sed -i` bloqué — utiliser les outils d'édition.
- Baseline : 123 tests verts.

---

### Task 1 : module pur `circuit.js` + tests

**Files:** Create `src/renderer/circuit.js`, `tests/circuit.test.js` ; Modify `src/renderer/index.html`

**Interface produite :** `Circuit.circuitToCables(circuit, resolveOd) -> [{fam, code, od, qty, fonction}]`

- [ ] **Step 1 : Écrire le test qui échoue** (`tests/circuit.test.js`)

```javascript
const { circuitToCables } = require('../src/renderer/circuit.js');

// resolveOd factice : diamètre déduit du code pour vérifier le câblage
const resolveOd = (fam, code) => ({ '1x185': 25.5, '1x95': 19, '1x50': 15 }[code] || 0);
const base = {
  fam: 'U1000-AR2V', nbPhases: 3, codePhase: '1x185',
  neutre: true, codeNeutre: '1x185', pe: true, codePE: '1x185', parallele: 1,
};

describe('circuitToCables', () => {
  test('3 phases + neutre + PE → 3 entrées, fonctions et qty correctes', () => {
    expect(circuitToCables(base, resolveOd)).toEqual([
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 3, fonction: 'phase' },
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 1, fonction: 'neutre' },
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 1, fonction: 'PE' },
    ]);
  });

  test('sans neutre / sans PE → entrées omises', () => {
    const r = circuitToCables({ ...base, neutre: false, pe: false }, resolveOd);
    expect(r).toHaveLength(1);
    expect(r[0].fonction).toBe('phase');
  });

  test('sections différentes par fonction respectées', () => {
    const r = circuitToCables({ ...base, codePE: '1x95' }, resolveOd);
    const pe = r.find((c) => c.fonction === 'PE');
    expect(pe).toMatchObject({ code: '1x95', od: 19 });
  });

  test('parallele=2 multiplie tout le circuit', () => {
    const r = circuitToCables({ ...base, parallele: 2 }, resolveOd);
    expect(r.map((c) => c.qty)).toEqual([6, 2, 2]);
  });

  test('nbPhases=0 → pas d’entrée phase', () => {
    const r = circuitToCables({ ...base, nbPhases: 0 }, resolveOd);
    expect(r.every((c) => c.fonction !== 'phase')).toBe(true);
    expect(r).toHaveLength(2);
  });

  test('circuit vide/absent → [] sans crash', () => {
    expect(circuitToCables(null, resolveOd)).toEqual([]);
    expect(circuitToCables({}, resolveOd)).toEqual([]);
  });

  test('parallele absent → 1 par défaut ; valeurs en chaîne tolérées', () => {
    const r = circuitToCables({ ...base, parallele: undefined, nbPhases: '3' }, resolveOd);
    expect(r[0].qty).toBe(3);
  });

  test('resolveOd non fourni → od 0, pas de crash', () => {
    expect(circuitToCables(base)[0].od).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer → échec** — `npm test -- circuit.test.js` → FAIL (module absent).

- [ ] **Step 3 : Créer `src/renderer/circuit.js`**

```javascript
'use strict';
// BIG BRAIN — traduction d'un CIRCUIT électrique (phases / neutre / PE) en liste
// de câbles exploitable par cable-assign.js et phase-assign.js. PUR : le
// catalogue est injecté via resolveOd(fam, code).
(function (root) {
  const num = (v, def) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : def;
  };

  // circuit : { fam, nbPhases, codePhase, neutre, codeNeutre, pe, codePE, parallele }
  // Retourne [{ fam, code, od, qty, fonction }] — les entrées à qty 0 sont omises.
  function circuitToCables(circuit, resolveOd) {
    if (!circuit || !circuit.fam) return [];
    const od = (code) => (typeof resolveOd === 'function' ? (resolveOd(circuit.fam, code) || 0) : 0);
    const par = Math.max(1, num(circuit.parallele, 1));
    const out = [];
    const push = (code, qty, fonction) => {
      if (!code || qty <= 0) return;
      out.push({ fam: circuit.fam, code, od: od(code), qty, fonction });
    };
    push(circuit.codePhase, num(circuit.nbPhases, 0) * par, 'phase');
    if (circuit.neutre) push(circuit.codeNeutre, par, 'neutre');
    if (circuit.pe) push(circuit.codePE, par, 'PE');
    return out;
  }

  const api = { circuitToCables };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Circuit = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4 : Charger dans `index.html`** — après `<script src="phase-assign.js"></script>` : `<script src="circuit.js"></script>`

- [ ] **Step 5 : Vérifier** — `npm test -- circuit.test.js` PASS ; `node --check src/renderer/circuit.js` ; `npm test` global vert.

- [ ] **Step 6 : Commit** — `feat(circuit): module pur circuitToCables (phases/neutre/PE) — Brique D`

---

### Task 2 : correctifs UX (libellé câble, centrage modale, onglet BIG BRAIN)

**Files:** Modify `src/renderer/big-brain.js`, `tests/big-brain.test.js`, `src/renderer/big-brain-modal.js`, `src/renderer/index.html`, `src/renderer/style.css`

- [ ] **Step 1 : Libellé des câbles — test d'abord.** Dans `tests/big-brain.test.js`, describe `resultToObjects`, le test « labels résolus via liaisonsById » attend `cables[2].label === 'GE → Onduleur'`. Remplacer cette assertion sur les câbles par : les câbles n'ont plus de libellé de liaison (le fourreau le garde).

```javascript
  test('les câbles ne portent pas le nom de liaison (libellé réservé au fourreau)', () => {
    const { fourreaux, cables } = resultToObjects(result, names);
    expect(fourreaux[0].label).toBe('TGBT → GE');
    expect(cables.every((c) => c.label === '')).toBe(true);
  });
```

(Adapter/retirer l'ancienne assertion `cables[2].label` du test existant pour qu'il ne teste plus que le libellé du fourreau et le fallback fourreau.)

- [ ] **Step 2 : Appliquer** — dans `src/renderer/big-brain.js`, `resultToObjects`, remplacer `label: nameOf(c.liaisonId)` par `label: ''` dans le `cables.push({...})`. **Conserver `liaisonId`** (nécessaire aux phases). Vérifier : `npm test` vert.

- [ ] **Step 3 : Centrage de la modale** — dans `big-brain-modal.js`, fonction `open()`, avant `modalEl.style.display = 'flex';` ajouter :

```javascript
    // Déplacer la modale en fin de <body> : un conteneur parent avec overflow ou
    // transform casse le centrage d'un élément position:fixed (même remède que
    // la modale d'export PDF).
    if (modalEl.parentElement !== document.body) document.body.appendChild(modalEl);
```

- [ ] **Step 4 : Onglet BIG BRAIN** — dans `index.html`, ajouter un 3ᵉ onglet après `tabCABLE` :

```html
            <div id="tabBIGBRAIN" class="tab">🧠 BIG BRAIN</div>
```

Retirer le bouton `#bigBrainBtn` de la barre d'outils du bas (et son éventuel séparateur devenu inutile).

- [ ] **Step 5 : Câbler l'onglet** — dans `big-brain-modal.js`, là où le listener de `#bigBrainBtn` est posé, écouter `#tabBIGBRAIN` à la place (garder un fallback : si `#bigBrainBtn` existe encore, le câbler aussi — code défensif d'une ligne). L'onglet ouvre la modale ; il ne doit PAS masquer les panneaux FOURREAU/CÂBLE (pas de `setTab`), donc ne touche pas à la logique d'onglets de `script.js`.

- [ ] **Step 6 : CSS de l'onglet** — dans `style.css`, si nécessaire, ajuster `.tabs` pour accueillir 3 onglets (taille de police / padding réduits, `flex-wrap` si besoin) sans casser l'alignement existant. `#tabBIGBRAIN` garde l'apparence `.tab`.

- [ ] **Step 7 : Vérifier** — `node --check` sur les JS touchés ; `npm test` vert.

- [ ] **Step 8 : Commit** — `fix(big-brain): libellé câbles, centrage de la modale, onglet BIG BRAIN`

---

### Task 3 : panneau détail « circuit » dans la modale

**Files:** Modify `src/renderer/big-brain-modal.js`, `src/renderer/style.css`

- [ ] **Step 1 : Modèle d'état** — une liaison devient `{ id, nom, circuit: {...} }`. Dans la fonction qui crée une liaison (`addLiaison`), initialiser :

```javascript
      circuit: {
        fam: (getFamilies()[0] || ''), nbPhases: 3, codePhase: '',
        neutre: true, codeNeutre: '', pe: true, codePE: '',
        parallele: 1,
      },
```

et remplir `codePhase`/`codeNeutre`/`codePE` avec le premier code disponible de la famille (`getCodesForFam(fam)[0]`).

- [ ] **Step 2 : `renderDetail()`** — remplacer la liste de lignes de câble par le bloc circuit :
  - champ **nom** (existant, conservé) ;
  - select **famille** (classe `bb-circuit-fam`) — au changement, réinitialiser les 3 codes sur le premier code de la nouvelle famille ;
  - ligne **Phases** : `<input type="number" min="0" max="6" class="bb-circuit-nbphases">` + select code (`bb-circuit-codephase`) ;
  - ligne **Neutre** : `<input type="checkbox" class="bb-circuit-neutre">` + select code (`bb-circuit-codeneutre`), select désactivé si la case est décochée ;
  - ligne **PE** : idem (`bb-circuit-pe`, `bb-circuit-codepe`) ;
  - champ **Circuits en parallèle** : `<input type="number" min="1" class="bb-circuit-parallele">` ;
  - **récapitulatif** (`<div class="bb-circuit-recap">`) recalculé à chaque rendu depuis `window.Circuit.circuitToCables(circuit, resolveOd)` : afficher par ex. `3×1x185 + 1x185 (N) + 1x185 (PE) → 5 câbles`.
  - Tous les selects de code sont peuplés via `getCodesForFam(circuit.fam)`.

- [ ] **Step 3 : Événements** — dans la délégation `change`/`input` du panneau détail, écrire la valeur dans `liaison.circuit` selon la classe de la cible (`nbPhases`, `codePhase`, `neutre` via `.checked`, etc.), puis `renderDetail()` pour rafraîchir le récapitulatif et l'état activé/désactivé des selects. Retirer les branches devenues mortes (`bb-cable-*`) ainsi que `addCableToSelected` et le bouton « + Ajouter un câble ».

- [ ] **Step 4 : Construction pour les moteurs** — dans `generate()`, remplacer la construction actuelle de `built` par :

```javascript
    const resolveOdFn = (fam, code) => resolveOd(fam, code);
    const built = liaisons.map((l) => ({
      id: l.id,
      nom: l.nom,
      cables: window.Circuit.circuitToCables(l.circuit, resolveOdFn),
    }));
```

(Le reste du flux — `validateLiaisons`, `assignCablesToFourreaux`, garde « aucun fourreau », `bigBrainGenerate(result, liaisonsById, replace, built)` — est inchangé.)

- [ ] **Step 5 : Compteur du panneau maître** — `renderMaster()` affiche « N câble(s) » : le calculer désormais via `circuitToCables(l.circuit, resolveOd).reduce((s, c) => s + c.qty, 0)`.

- [ ] **Step 6 : CSS** — styles du bloc circuit dans `style.css` (grille à 2-3 colonnes alignées : libellé / champ / select), classes `bb-circuit-*` et `.bb-circuit-recap` (texte discret, style « aide »). Retirer/laisser inertes les styles `.bb-cable-*` devenus inutilisés.

- [ ] **Step 7 : Vérifier** — `node --check src/renderer/big-brain-modal.js` ; `npm test` vert (123 + Task 1/2).

- [ ] **Step 8 : Commit** — `feat(big-brain): saisie par circuit (phases/neutre/PE) dans la modale`

---

## Fin de la Brique D

Livrable : saisie électrique par circuit, modale centrée, canvas lisible, bouton au bon endroit. Vérification finale dans l'app par l'utilisateur.

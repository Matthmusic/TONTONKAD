# BIG BRAIN — Brique F : câblage mono / multi — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases (`- [ ]`).

**Goal:** Permettre de décrire une liaison BIG BRAIN soit en **mono** (un câble unipolaire par conducteur — comportement actuel), soit en **multi** (un seul câble multiconducteur `3G2,5` / `5G16` / `4x25`, choisi librement dans le catalogue).

**Architecture:** Le circuit gagne un champ `mode: 'mono' | 'multi'`. L'aiguillage vit entièrement dans le module pur `src/renderer/circuit.js` : en multi, `circuitToCables` renvoie **une seule** entrée `{ code: codeMulti, qty: parallele, fonction: 'aucune' }`. Les moteurs `cable-assign.js` et `phase-assign.js` ne sont pas modifiés — `fonction: 'aucune'` leur fait déjà renvoyer `null`, donc aucune couleur ni libellé de phase au canvas. Le panneau `big-brain-panel.js` expose le choix et adapte son rendu.

**Tech Stack:** Vanilla JS (IIFE, `window.X` + `module.exports`), Jest, CSS variables.

**Spec :** `docs/superpowers/specs/2026-07-30-big-brain-brique-f-mono-multi-design.md`

## Global Constraints

- **Aucune modification** de `cable-assign.js`, `phase-assign.js`, `big-brain.js`, `script.js` ni du placement : leurs formats d'entrée ne changent pas.
- `mode` **absent ⇒ `'mono'`** : le dépliage existant reste identique (rétrocompatibilité de l'état en mémoire).
- En multi, `nbPhases` / `neutre` / `pe` sont **ignorés** par `circuitToCables`, mais leurs valeurs restent dans l'état : un aller-retour de mode ne perd aucune saisie.
- `parallele` sert de **quantité** en multi (pas de champ `qtyMulti`) ; seul le libellé UI change.
- Hors périmètre : distinction normative `G` / `x`, section de PE réduite en multi, import Caneco, persistance du mode dans le projet.
- Suite de tests : **134 tests verts** avant de commencer ; **139** attendus à la fin.
- Après chaque tâche : `node --check` sur les JS touchés, `npm test`, puis commit. **Pas de push.**
- Windows / Git Bash : `sed -i` bloqué — utiliser les outils d'édition.
- Fichiers autorisés : `src/renderer/circuit.js`, `src/renderer/big-brain-panel.js`, `src/renderer/style.css`, `tests/circuit.test.js`, `tests/big-brain-integration.test.js`.

---

### Task 1 : `mode` dans `circuit.js` (module pur, TDD)

**Files:**
- Modify: `src/renderer/circuit.js` (fonction `circuitToCables`, ~lignes 11-26)
- Test: `tests/circuit.test.js` (ajout d'un `describe`, extension du `resolveOd` ligne 4)
- Test: `tests/big-brain-integration.test.js` (extension du `resolveOd` ligne 12, ajout d'un test)

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: `circuitToCables(circuit, resolveOd)` accepte `circuit.mode === 'multi'` + `circuit.codeMulti: string` et renvoie alors `[{ fam, code, od, qty, fonction: 'aucune' }]` (une seule entrée, `qty = parallele`). Tout autre `mode` (y compris absent) ⇒ dépliage mono inchangé. La Task 2 s'appuie sur ces deux noms de champs : `mode` et `codeMulti`.

- [ ] **Step 1 : Écrire les tests unitaires qui échouent**

Dans `tests/circuit.test.js`, ajouter `'5x16': 25` au faux catalogue de la ligne 4 :

```js
const resolveOd = (fam, code) => ({ '1x185': 25.5, '1x95': 19, '1x50': 15, '5x16': 25 }[code] || 0);
```

puis ajouter, après le `describe('circuitToCables', …)` existant :

```js
describe('circuitToCables — mode multi', () => {
  // base porte 3 phases + neutre + PE : en multi ils doivent être IGNORÉS,
  // le câble multiconducteur portant déjà tous les conducteurs.
  const multi = { ...base, mode: 'multi', codeMulti: '5x16' };

  test('multi → une seule entrée, fonction "aucune", phases/N/PE ignorés', () => {
    expect(circuitToCables(multi, resolveOd)).toEqual([
      { fam: 'U1000-AR2V', code: '5x16', od: 25, qty: 1, fonction: 'aucune' },
    ]);
  });

  test('parallele=3 → qty 3 (un câble par circuit en parallèle)', () => {
    const r = circuitToCables({ ...multi, parallele: 3 }, resolveOd);
    expect(r).toHaveLength(1);
    expect(r[0].qty).toBe(3);
  });

  test('codeMulti absent ou vide → [] (bloqué en amont par validateLiaisons)', () => {
    expect(circuitToCables({ ...multi, codeMulti: '' }, resolveOd)).toEqual([]);
    expect(circuitToCables({ ...base, mode: 'multi' }, resolveOd)).toEqual([]);
  });

  test('mode "mono" explicite = mode absent (rétrocompatibilité)', () => {
    expect(circuitToCables({ ...base, mode: 'mono' }, resolveOd))
      .toEqual(circuitToCables(base, resolveOd));
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

Run: `npm test -- circuit.test.js`
Expected: FAIL — les 2 premiers tests reçoivent 3 entrées (`phase`/`neutre`/`PE`) au lieu d'une seule ; le 3ᵉ reçoit 3 entrées au lieu de `[]`. Le 4ᵉ passe déjà (le `mode` est ignoré aujourd'hui).

- [ ] **Step 3 : Implémenter l'aiguillage**

Dans `src/renderer/circuit.js`, insérer la branche multi juste après la définition de `push`, avant `push(circuit.codePhase, …)` :

```js
    // Multiconducteur : UN seul câble par circuit en parallèle, tous les
    // conducteurs à l'intérieur. fonction 'aucune' ⇒ PhaseAssign renvoie null
    // ⇒ pas de customColor ⇒ aucun libellé de phase au canvas.
    if (circuit.mode === 'multi') {
      push(circuit.codeMulti, par, 'aucune');
      return out;
    }
```

Mettre aussi à jour l'en-tête de fichier (commentaire ligne 11) pour documenter le champ :

```js
  // circuit : { mode: 'mono' | 'multi' (défaut 'mono'), fam, nbPhases, codePhase,
  //   neutre, codeNeutre, pe, codePE, codeMulti, parallele }
  // Retourne [{ fam, code, od, qty, fonction }] — les entrées à qty 0 sont omises.
  // En 'multi', une seule entrée (codeMulti × parallele, fonction 'aucune') :
  // nbPhases / neutre / pe sont ignorés.
```

- [ ] **Step 4 : Vérifier que les tests unitaires passent**

Run: `npm test -- circuit.test.js`
Expected: PASS (12 tests dans ce fichier : 8 existants + 4 nouveaux).

- [ ] **Step 5 : Écrire le test d'intégration qui échoue**

Dans `tests/big-brain-integration.test.js`, ajouter `'5x16': 25` au `resolveOd` de la ligne 12 :

```js
const resolveOd = (fam, code) => ({ '1x185': 25.5, '5x16': 25 }[code] || 0);
```

puis ajouter ce test à la fin du `describe` existant :

```js
  test('liaison en multi : un seul câble par circuit, aucune phase attribuée', () => {
    const circuit = {
      mode: 'multi', fam: 'U1000-AR2V', codeMulti: '5x16',
      nbPhases: 3, codePhase: '1x185', neutre: true, codeNeutre: '1x185',
      pe: true, codePE: '1x185', parallele: 2,
    };
    const cables = circuitToCables(circuit, resolveOd);
    expect(cables).toHaveLength(1);
    expect(cables[0]).toMatchObject({ code: '5x16', od: 25, qty: 2, fonction: 'aucune' });

    // Un multiconducteur ne porte pas UNE phase : aucun libellé au canvas.
    expect(assignPhases(cables)).toEqual([null, null]);

    const queues = buildPhaseQueues([{ id: 'L1', nom: 'TG vers PARIF', cables }]);
    expect(queues['L1|5x16|aucune']).toEqual([null, null]);
    expect(Object.keys(queues)).toHaveLength(1);
  });
```

- [ ] **Step 6 : Vérifier l'intégration et la suite complète**

Run: `npm test -- big-brain-integration.test.js`
Expected: PASS (3 tests).

Run: `node --check src/renderer/circuit.js` puis `npm test`
Expected: `node --check` silencieux ; **139 tests passés, 12 suites**.

- [ ] **Step 7 : Commit**

```bash
git add src/renderer/circuit.js tests/circuit.test.js tests/big-brain-integration.test.js
git commit -m "feat(big-brain): mode mono/multi dans circuitToCables"
```

---

### Task 2 : choix « Câblage » dans le panneau

**Files:**
- Modify: `src/renderer/big-brain-panel.js` (helpers de catalogue ~l.22-38, `renderDetail` ~l.168-264, `addLiaison` ~l.275-291, handler `change` ~l.472-503)
- Modify: `src/renderer/style.css` (après `.bb-circuit-fields input[type="checkbox"]`, ~l.7006)

**Interfaces:**
- Consumes: `circuitToCables(circuit, resolveOd)` de la Task 1 (via `window.Circuit`), qui lit `circuit.mode` et `circuit.codeMulti` ; `window.PhaseAssign.isUnipolaire(code) -> boolean` (existant, chargé avant ce fichier dans `index.html`).
- Produces: rien (feuille de l'arbre).

- [ ] **Step 1 : Ajouter les helpers de catalogue filtrés par mode**

Dans `big-brain-panel.js`, après `resolveOd(fam, code)` (l.33-38), ajouter :

```js
  // ── Codes filtrés par mode de câblage ──
  // mono ⇒ unipolaires ('1x…') seulement ; multi ⇒ tous les autres (3G, 5G, 4x…).
  // Sans ce filtre, « 3x25 » pouvait être choisi comme code de phase en mono,
  // produisant 3 câbles 3x25 étiquetés L1/L2/L3 — électriquement faux.
  // Repli : si le filtrage est vide pour une famille, on rend la liste complète
  // plutôt qu'un select vide (pas de cul-de-sac).
  function getCodesForMode(fam, mode) {
    const all = getCodesForFam(fam);
    const uni = (code) => !!(window.PhaseAssign && window.PhaseAssign.isUnipolaire(code));
    const filtered = (mode === 'multi') ? all.filter((c) => !uni(c)) : all.filter(uni);
    return filtered.length ? filtered : all;
  }

  // Codes par défaut d'une famille, pour les DEUX modes (création de liaison et
  // changement de famille).
  function resetCodes(circuit) {
    const uni = getCodesForMode(circuit.fam, 'mono')[0] || '';
    circuit.codePhase = uni;
    circuit.codeNeutre = uni;
    circuit.codePE = uni;
    circuit.codeMulti = getCodesForMode(circuit.fam, 'multi')[0] || '';
  }

  // Bascule de mode : la saisie de l'autre mode est CONSERVÉE ; on ne remplit
  // que le code du mode visé s'il n'a jamais été renseigné.
  function ensureCodeForMode(circuit) {
    if (circuit.mode === 'multi') {
      if (!circuit.codeMulti) circuit.codeMulti = getCodesForMode(circuit.fam, 'multi')[0] || '';
      return;
    }
    if (!circuit.codePhase) {
      const uni = getCodesForMode(circuit.fam, 'mono')[0] || '';
      circuit.codePhase = uni;
      if (!circuit.codeNeutre) circuit.codeNeutre = uni;
      if (!circuit.codePE) circuit.codePE = uni;
    }
  }
```

- [ ] **Step 2 : Rendre la ligne « Câblage » et brancher le rendu conditionnel**

Dans `renderDetail()`, remplacer les lignes `const circuit = …` / `const codes = …` (l.184-186) par :

```js
    const circuit = liaison.circuit;
    const families = getFamilies();
    const isMulti = circuit.mode === 'multi';
    const codes = getCodesForMode(circuit.fam, circuit.mode);
```

Après la création de `grid` (`grid.className = 'bb-circuit-grid';`), insérer la ligne « Câblage » **avant** la ligne Famille :

```js
    // Câblage : mono (un câble par conducteur) ou multi (un seul câble)
    const modeFields = document.createElement('span');
    modeFields.className = 'bb-circuit-modes';
    [
      { value: 'mono', label: 'Mono', title: 'Un câble par conducteur (3 phases + N + PE)' },
      { value: 'multi', label: 'Multi', title: 'Un seul câble multiconducteur (3G, 5G, 4x…)' },
    ].forEach((opt) => {
      const wrap = document.createElement('label');
      wrap.className = 'bb-circuit-mode-opt';
      wrap.title = opt.title;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'bb-circuit-mode';
      radio.name = 'bb-circuit-mode';
      radio.value = opt.value;
      radio.checked = (opt.value === (isMulti ? 'multi' : 'mono'));
      wrap.appendChild(radio);
      wrap.appendChild(document.createTextNode(' ' + opt.label));
      modeFields.appendChild(wrap);
    });
    grid.appendChild(buildCircuitRow('Câblage', [modeFields]));
```

Puis encadrer les lignes Phases / Neutre / PE existantes (de `// Phases : nombre × section` jusqu'au `grid.appendChild(buildCircuitRow('PE', …))` inclus, l.204-244) dans un `else`, avec la branche multi devant :

```js
    if (isMulti) {
      // Un seul câble : son code porte tous les conducteurs.
      const codeMultiSelect = buildCodeSelect('bb-circuit-codemulti', 'Câble multiconducteur', codes, circuit.codeMulti);
      grid.appendChild(buildCircuitRow('Câble', [codeMultiSelect]));
    } else {
      // … lignes Phases / Neutre / PE existantes, inchangées …
    }
```

Les ~40 lignes déplacées dans le `else` ne changent **pas** de contenu (mêmes `const`, mêmes classes CSS, même ordre) : seule leur indentation gagne deux espaces. Ne rien renommer au passage.

Enfin, la ligne `parallele` (l.246-255) garde son champ mais change de libellé — remplacer son `grid.appendChild(...)` par :

```js
    // Même champ dans les deux modes : N circuits identiques.
    grid.appendChild(buildCircuitRow(isMulti ? 'Quantité' : 'Circuits en parallèle', [paralleleInput]));
```

- [ ] **Step 3 : Initialiser `mode` et `codeMulti` à la création d'une liaison**

Remplacer le corps de `addLiaison()` (l.275-291) par :

```js
  function addLiaison() {
    seq += 1;
    const circuit = {
      mode: 'mono', fam: getFamilies()[0] || '',
      nbPhases: 3, codePhase: '', neutre: true, codeNeutre: '', pe: true, codePE: '',
      codeMulti: '', parallele: 1,
    };
    resetCodes(circuit);
    liaisons.push({ id: 'L' + seq, nom: 'Liaison ' + seq, circuit });
    selectedIndex = liaisons.length - 1;
    renderMaster();
    renderDetail();
  }
```

- [ ] **Step 4 : Brancher les changements de mode, de code multi et de famille**

Dans le handler `change` de `detailEl` (l.472-503), remplacer la branche famille et ajouter les deux nouvelles branches, en tête de la chaîne :

```js
        if (target.classList.contains('bb-circuit-mode')) {
          circuit.mode = (target.value === 'multi') ? 'multi' : 'mono';
          ensureCodeForMode(circuit);
          renderDetail();
        } else if (target.classList.contains('bb-circuit-fam')) {
          circuit.fam = target.value;
          resetCodes(circuit);
          renderDetail();
        } else if (target.classList.contains('bb-circuit-codemulti')) {
          circuit.codeMulti = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-circuit-neutre')) {
```

(le reste de la chaîne — `neutre`, `pe`, `codephase`, `codeneutre`, `codepe`, `else return` puis `updateMasterCount(selectedIndex)` — est inchangé.)

- [ ] **Step 5 : Styler la ligne de radios**

Dans `src/renderer/style.css`, après le bloc `.bb-circuit-fields input[type="checkbox"] { … }` (~l.7006), ajouter :

```css
/* Ligne « Câblage » : deux choix courts (Mono / Multi) alignés dans la rangée. */
.bb-circuit-modes {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-width: 0;
}
.bb-circuit-mode-opt {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
}
.bb-circuit-fields input[type="radio"] {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    accent-color: var(--primary-orange);
    cursor: pointer;
}
```

- [ ] **Step 6 : Vérifier syntaxe et non-régression**

Run: `node --check src/renderer/big-brain-panel.js`
Expected: aucune sortie.

Run: `npm test`
Expected: **139 tests passés** (aucun test unitaire ajouté ici : c'est de l'UI, vérifiée dans l'app).

- [ ] **Step 7 : Vérifier dans l'app**

Run: `npm start`, puis onglet **🧠 BIG BRAIN** → « + Nouvelle » :

1. La ligne **Câblage** apparaît en tête du bloc circuit, **Mono** coché.
2. En Mono, les sélecteurs de section ne proposent **que** des codes `1x…`.
3. Cocher **Multi** : les lignes Phases / Neutre / PE sont remplacées par une ligne **Câble** proposant `3G…` / `5G…` / `4x…` / `5x…` (aucun `1x…`) ; la dernière ligne devient **Quantité**.
4. Récapitulatif en multi : `1×<code> → 1 câble(s)`, et `2×<code> → 2 câble(s)` avec Quantité = 2 ; la liste des liaisons affiche le même compte.
5. Revenir sur **Mono** : les phases / neutre / PE et leurs sections sont **retrouvées telles quelles** ; re-cocher **Multi** retrouve le code multi choisi.
6. Changer de **Famille** en multi : le code multi est réinitialisé au premier code multi de la nouvelle famille (pas de select vide).
7. **Générer** en multi (quantité 2) : 2 câbles créés, **sans libellé de phase** (aucun L1/L2/L3/N/PE), dans un ou deux fourreaux selon le taux d'occupation.
8. Générer en mono : résultat identique à avant la brique (L1/L2/L3 + N + PE).

- [ ] **Step 8 : Commit**

```bash
git add src/renderer/big-brain-panel.js src/renderer/style.css
git commit -m "feat(big-brain): choix Mono/Multi dans le panneau (codes filtrés par mode)"
```

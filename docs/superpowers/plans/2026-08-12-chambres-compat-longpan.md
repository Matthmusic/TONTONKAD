# Chambres compatibles via le long-pan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le panneau « Chambres compatibles » propose aussi les modèles StradEasy dont le
pignon est trop étroit mais dont le long-pan convient (entrée latérale), au lieu de
retomber directement sur du maçonné sur mesure + tampons.

**Architecture:** Le calcul pur (`compat-chambres.js`) gagne un 3e tableau `longPan` dans
`computeCompatibleChambers`. Le panneau (`script.js`, `renderCompatChambres`) affiche
jusqu'à deux sections préformées simultanées (pignon + long-pan) plutôt qu'une seule, avec
une sélection active unique qui bascule entre les deux ; le reste du flux (schéma SVG,
bouton Appliquer, redimensionnement, sauvegarde/chargement) reste inchangé car il opère
déjà sur une forme générique `{ ref, l, H }` — un match long-pan y est simplement injecté
avec sa valeur `L` sous la clé `l`.

**Tech Stack:** JavaScript vanilla, aucun bundler ; Jest pour `compat-chambres.js`
(module pur, double export `window.CompatChambres` / `module.exports`) ; `script.js`
n'est couvert par aucun test Jest (chargé uniquement via `<script>` dans `index.html`),
vérifié manuellement via un script jsdom jetable comme établi dans cette session.

## Global Constraints

- Respecter la terminologie métier existante : « pignon » (petit côté), « long-pan »
  (grand côté) — voir `PRODUCT.md:47-48`.
- Commentaires et libellés UI en français, dans le style déjà en place dans les deux
  fichiers touchés.
- Aucun changement de format CSV ni de `getChamberModels()`.
- Ne pas toucher aux fichiers déjà modifiés (en attente, non liés à cette feature) dans
  l'arbre de travail — rester strictement dans le périmètre de ce plan.
- Travailler sur la branche `feat/chambres-compat-longpan` (déjà active), commits séparés
  par tâche.
- Design source : `docs/superpowers/specs/2026-08-12-chambres-compat-longpan-design.md`.

---

### Task 1: `computeCompatibleChambers` — nouveau tableau `longPan`

**Files:**
- Modify: `src/renderer/compat-chambres.js:28-62`
- Test: `tests/compat-chambres.test.js`

**Interfaces:**
- Produces: `computeCompatibleChambers(models, largeur, hauteur, maxN=3)` retourne
  désormais `{ unit, longPan, tiling }` (au lieu de `{ unit, tiling }`).
  `longPan` : `{ ref: string, L: number, H: number, marginW: number, marginH: number }[]`,
  trié par marge croissante (`marginW + marginH`), sans doublon avec `unit`.

- [ ] **Step 1: Écrire les tests qui échouent (nouveau describe + mise à jour de l'assertion existante)**

Dans `tests/compat-chambres.test.js`, remplacer le test « modèles vides » existant :

```js
  test('modèles vides → { unit:[], tiling:[] }', () => {
    expect(computeCompatibleChambers([], 400, 500, 3)).toEqual({ unit: [], tiling: [] });
  });
```

par :

```js
  test('modèles vides → { unit:[], longPan:[], tiling:[] }', () => {
    expect(computeCompatibleChambers([], 400, 500, 3)).toEqual({ unit: [], longPan: [], tiling: [] });
  });
```

Puis ajouter ce nouveau bloc `describe` à la fin du fichier (avant la dernière accolade
fermante du fichier, au même niveau que les autres `describe`) :

```js
describe('computeCompatibleChambers — préformées par le long-pan (longPan)', () => {
  const models = getChamberModels(CH);

  test('pignon trop étroit mais long-pan suffisant → présent dans longPan, absent de unit', () => {
    const { unit, longPan } = computeCompatibleChambers(models, 450, 500, 3);
    expect(unit.map((u) => u.ref)).not.toContain('L1T');
    expect(longPan).toHaveLength(1);
    expect(longPan[0]).toMatchObject({ ref: 'L1T', L: 520, H: 540, marginW: 70, marginH: 40 });
  });

  test('aucun doublon avec unit : un modèle compatible côté pignon ne réapparaît pas dans longPan', () => {
    const { unit, longPan } = computeCompatibleChambers(models, 450, 500, 3);
    const unitRefs = unit.map((u) => u.ref);
    const longPanRefs = longPan.map((l) => l.ref);
    expect(longPanRefs.some((ref) => unitRefs.includes(ref))).toBe(false);
  });

  test('tri par marge croissante au sein de longPan', () => {
    const { longPan } = computeCompatibleChambers(models, 800, 500, 3);
    expect(longPan.map((l) => l.ref)).toEqual(['1/2 L4T', 'L3T']);
    expect(longPan[0]).toMatchObject({ ref: '1/2 L4T', L: 880, H: 540, marginW: 80, marginH: 40 });
    expect(longPan[1]).toMatchObject({ ref: 'L3T', L: 1380, H: 540, marginW: 580, marginH: 40 });
  });

  test('tiling reste vide dès que longPan a des entrées, même si unit est vide', () => {
    const { unit, longPan, tiling } = computeCompatibleChambers(models, 800, 500, 3);
    expect(unit).toEqual([]);
    expect(longPan.length).toBeGreaterThan(0);
    expect(tiling).toEqual([]);
  });

  test('tiling se déclenche normalement si unit ET longPan sont vides (régression)', () => {
    const { unit, longPan, tiling } = computeCompatibleChambers(models, 1000, 2000, 3);
    expect(unit).toEqual([]);
    expect(longPan).toEqual([]);
    expect(tiling.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx jest compat-chambres.test.js`
Expected: FAIL — `longPan` est `undefined` (champ absent), le test « modèles vides »
échoue aussi (objet retourné n'a pas la clé `longPan`).

- [ ] **Step 3: Implémenter `longPan` dans `compat-chambres.js`**

Remplacer le bloc actuel (commentaire + fonction, `src/renderer/compat-chambres.js:28-62`) :

```js
  // Logique :
  //  1) chambre PRÉFORMÉE (StradEasy) : la boîte tient dedans (pignon l >= largeur
  //     ET hauteur H >= hauteur boîte). Une entrée PAR RÉFÉRENCE, triée par marge.
  //  2) sinon : chambre MAÇONNÉE sur mesure + TAMPONS (couvercles) posés dessus.
  //     Le tampon ne couvre que le dessus → on ne raisonne que sur la LARGEUR ;
  //     la hauteur est libre (maçonnerie), donc PAS de filtre hauteur ici.
  function computeCompatibleChambers(models, largeur, hauteur, maxN = 3) {
    models = models || [];

    // 1) Chambres préformées compatibles — une entrée par référence (plusieurs
    //    réfs pouvant partager les mêmes cotes).
    const unit = models
      .filter(m => m.l >= largeur && m.H >= hauteur)
      .map(m => ({ ref: m.ref, l: m.l, H: m.H, marginW: m.l - largeur, marginH: m.H - hauteur }))
      .sort((a, b) => (a.marginW + a.marginH) - (b.marginW + b.marginH) || a.ref.localeCompare(b.ref));

    // 2) Sinon : maçonné sur mesure + tampons (couverture de la largeur)
    let tiling = [];
    if (unit.length === 0) {
      const byL = new Map();
      models.forEach(m => {
        const g = byL.get(m.l) || { l: m.l, refs: [] };
        g.refs.push(m.ref);
        byL.set(m.l, g);
      });
      byL.forEach(g => {
        const N = Math.ceil(largeur / g.l);
        if (N >= 1 && N <= maxN && N * g.l >= largeur) {
          tiling.push({ l: g.l, refs: g.refs.sort(), N, total: N * g.l, margin: N * g.l - largeur });
        }
      });
      tiling.sort((a, b) => (a.margin - b.margin) || (a.N - b.N));
    }
    return { unit, tiling };
  }
```

par :

```js
  // Logique :
  //  1) chambre PRÉFORMÉE par le PIGNON (StradEasy) : la boîte tient dedans (pignon
  //     l >= largeur ET hauteur H >= hauteur boîte) — entrée en ligne droite, la face
  //     par laquelle le faisceau traverse la chambre. Une entrée PAR RÉFÉRENCE, triée
  //     par marge.
  //  1bis) sinon, chambre PRÉFORMÉE par le LONG-PAN uniquement (pignon trop étroit,
  //     mais long-pan L >= largeur) : entrée latérale, toujours préférable à du
  //     maçonné sur mesure. Jamais de doublon avec (1) : m.l < largeur exclut tout
  //     modèle déjà retenu côté pignon.
  //  2) sinon (ni pignon ni long-pan) : chambre MAÇONNÉE sur mesure + TAMPONS
  //     (couvercles) posés dessus. Le tampon ne couvre que le dessus → on ne
  //     raisonne que sur la LARGEUR ; la hauteur est libre (maçonnerie), donc PAS
  //     de filtre hauteur ici.
  function computeCompatibleChambers(models, largeur, hauteur, maxN = 3) {
    models = models || [];

    // 1) Chambres préformées compatibles par le pignon — une entrée par référence
    //    (plusieurs réfs pouvant partager les mêmes cotes).
    const unit = models
      .filter(m => m.l >= largeur && m.H >= hauteur)
      .map(m => ({ ref: m.ref, l: m.l, H: m.H, marginW: m.l - largeur, marginH: m.H - hauteur }))
      .sort((a, b) => (a.marginW + a.marginH) - (b.marginW + b.marginH) || a.ref.localeCompare(b.ref));

    // 1bis) Chambres préformées compatibles par le long-pan uniquement
    const longPan = models
      .filter(m => m.l < largeur && m.L >= largeur && m.H >= hauteur)
      .map(m => ({ ref: m.ref, L: m.L, H: m.H, marginW: m.L - largeur, marginH: m.H - hauteur }))
      .sort((a, b) => (a.marginW + a.marginH) - (b.marginW + b.marginH) || a.ref.localeCompare(b.ref));

    // 2) Sinon (aucune préformée, ni pignon ni long-pan) : maçonné sur mesure + tampons
    let tiling = [];
    if (unit.length === 0 && longPan.length === 0) {
      const byL = new Map();
      models.forEach(m => {
        const g = byL.get(m.l) || { l: m.l, refs: [] };
        g.refs.push(m.ref);
        byL.set(m.l, g);
      });
      byL.forEach(g => {
        const N = Math.ceil(largeur / g.l);
        if (N >= 1 && N <= maxN && N * g.l >= largeur) {
          tiling.push({ l: g.l, refs: g.refs.sort(), N, total: N * g.l, margin: N * g.l - largeur });
        }
      });
      tiling.sort((a, b) => (a.margin - b.margin) || (a.N - b.N));
    }
    return { unit, longPan, tiling };
  }
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx jest compat-chambres.test.js`
Expected: PASS — tous les tests du fichier, y compris les 5 nouveaux et celui mis à jour.

- [ ] **Step 5: Lancer la suite complète (non-régression)**

Run: `npx jest`
Expected: PASS — tous les fichiers, y compris ceux sans rapport avec ce changement.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/compat-chambres.js tests/compat-chambres.test.js
git commit -m "feat(compat-chambres): calcule les chambres compatibles par le long-pan

computeCompatibleChambers() retourne un 3e tableau longPan : les
modèles StradEasy dont le pignon est trop étroit mais dont le
long-pan convient (entrée latérale). Le repli maçonné + tampons ne
se déclenche plus que si aucune préformée ne convient, ni par le
pignon ni par le long-pan.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Panneau UI — deux sections préformées simultanées

**Files:**
- Modify: `src/renderer/script.js:7327` (état `compatChambresState`)
- Modify: `src/renderer/script.js:7434-7521` (`renderCompatChambres`)

**Interfaces:**
- Consumes: `computeCompatibleChambers(largeur, hauteur, maxN)` → `{ unit, longPan, tiling }`
  (Task 1, via le wrapper `script.js` existant, inchangé).
- Consumes: `buildUnitSchema(W, H, s)` où `s = { ref, l, H }` (inchangé — un match
  long-pan y est passé avec sa valeur `L` sous la clé `l`, la fonction ne sait pas
  d'où vient la cote).
- Produces: `compatChambresState.selectedUnit = { ref, l, H } | null` — forme générique
  déjà consommée telle quelle par le bouton Appliquer, `drawChamberLabel()` et la
  sauvegarde/chargement de projet (`appliedUnit`) : **aucun changement requis dans ce
  code aval**, ce Task ne touche que la construction de la liste et la détermination de
  la sélection active.

- [ ] **Step 1: Étendre l'état `compatChambresState`**

Dans `src/renderer/script.js:7327`, remplacer :

```js
  const compatChambresState = { open: false, selectedIndex: 0, selected: null, selectedUnit: null, applied: null, appliedUnit: null };
```

par :

```js
  const compatChambresState = { open: false, selectedIndex: 0, selectedLongPanIndex: 0, activeKind: null, selected: null, selectedUnit: null, applied: null, appliedUnit: null };
```

(`activeKind`: `'unit' | 'longpan' | 'tile' | null` — quelle section pilote le schéma et
le bouton Appliquer ; `selectedIndex` reste partagé entre la liste pignon et la liste
tampons, comme avant, puisqu'elles ne sont jamais actives toutes les deux en même temps ;
`selectedLongPanIndex` est propre à la liste long-pan.)

- [ ] **Step 2: Réécrire `renderCompatChambres()`**

Remplacer entièrement la fonction actuelle (`src/renderer/script.js:7434-7521`) par :

```js
  function renderCompatChambres() {
    const list = document.getElementById('compatList');
    const subtitle = document.getElementById('compatSubtitle');
    const schema = document.getElementById('compatSchema');
    if (!list) return;
    const W = Math.round(WORLD_W_MM || 0);
    const H = Math.round(WORLD_H_MM || 0);
    if (subtitle) subtitle.textContent = `Boîte ${W} × ${H} mm`;
    const { unit, longPan, tiling } = computeCompatibleChambers(W, H, 3);
    list.innerHTML = '';
    if (schema) schema.innerHTML = '';

    const hasPreformed = unit.length > 0 || longPan.length > 0;
    if (!hasPreformed && tiling.length === 0) {
      list.innerHTML = `<div class="compat-empty">Boîte trop large : aucun assemblage de 3 tampons max ne couvre ${W} mm.</div>`;
      compatChambresState.selected = null;
      compatChambresState.selectedUnit = null;
      const applyBtnEmpty = document.getElementById('compatApplyBtn');
      if (applyBtnEmpty) applyBtnEmpty.style.display = 'none';
      if (typeof redraw === 'function') redraw();
      return;
    }

    // Section active (celle qui pilote schéma/bouton Appliquer) : conservée d'un
    // rendu à l'autre, sauf si elle n'a plus d'éléments → repli pignon puis
    // long-pan puis tampons.
    const k = compatChambresState.activeKind;
    if (!hasPreformed) compatChambresState.activeKind = 'tile';
    else if (k === 'longpan' && !longPan.length) compatChambresState.activeKind = 'unit';
    else if (k === 'unit' && !unit.length) compatChambresState.activeKind = 'longpan';
    else if (k !== 'unit' && k !== 'longpan') compatChambresState.activeKind = unit.length ? 'unit' : 'longpan';

    if (unit.length) {
      if (compatChambresState.selectedIndex >= unit.length) compatChambresState.selectedIndex = 0;
      unit.forEach((s, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'compat-item' + (compatChambresState.activeKind === 'unit' && i === compatChambresState.selectedIndex ? ' active' : '');
        item.innerHTML =
          `<span class="compat-item-main"><span>${s.ref} — ${s.l} × ${s.H} mm</span>` +
          `<span class="compat-item-margin">L+${s.marginW} · H+${s.marginH}</span></span>`;
        item.addEventListener('click', () => {
          compatChambresState.activeKind = 'unit';
          compatChambresState.selectedIndex = i;
          renderCompatChambres();
        });
        list.appendChild(item);
      });
    }

    if (longPan.length) {
      const note = document.createElement('div');
      note.className = 'compat-empty';
      note.textContent = 'Compatible par le long-pan (entrée latérale) :';
      list.appendChild(note);
      if (compatChambresState.selectedLongPanIndex >= longPan.length) compatChambresState.selectedLongPanIndex = 0;
      longPan.forEach((s, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'compat-item' + (compatChambresState.activeKind === 'longpan' && i === compatChambresState.selectedLongPanIndex ? ' active' : '');
        item.innerHTML =
          `<span class="compat-item-main"><span>${s.ref} — ${s.L} × ${s.H} mm</span>` +
          `<span class="compat-item-margin">L+${s.marginW} · H+${s.marginH}</span></span>`;
        item.addEventListener('click', () => {
          compatChambresState.activeKind = 'longpan';
          compatChambresState.selectedLongPanIndex = i;
          renderCompatChambres();
        });
        list.appendChild(item);
      });
    }

    if (compatChambresState.activeKind === 'tile') {
      const note = document.createElement('div');
      note.className = 'compat-empty';
      note.textContent = `Aucune chambre préformée compatible → chambre maçonnée sur mesure + tampons :`;
      list.appendChild(note);
      if (compatChambresState.selectedIndex >= tiling.length) compatChambresState.selectedIndex = 0;
      tiling.forEach((s, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'compat-item' + (i === compatChambresState.selectedIndex ? ' active' : '');
        item.innerHTML =
          `<span class="compat-item-main"><span>${s.N}× tampon ${s.l} → ${s.total} mm</span>` +
          `<span class="compat-item-margin">+${s.margin}</span></span>` +
          `<span class="compat-item-refs">${s.refs.join(' · ')}</span>`;
        item.addEventListener('click', () => {
          compatChambresState.selectedIndex = i;
          renderCompatChambres();
        });
        list.appendChild(item);
      });
    }

    let selSug = null;
    if (compatChambresState.activeKind === 'unit') {
      selSug = unit[compatChambresState.selectedIndex] || null;
      if (schema && selSug) schema.innerHTML = buildUnitSchema(W, H, selSug);
    } else if (compatChambresState.activeKind === 'longpan') {
      const s = longPan[compatChambresState.selectedLongPanIndex] || null;
      selSug = s ? { ref: s.ref, l: s.L, H: s.H } : null;
      if (schema && selSug) schema.innerHTML = buildUnitSchema(W, H, selSug);
    } else {
      selSug = tiling[compatChambresState.selectedIndex] || null;
      if (schema && selSug) schema.innerHTML = buildTileSchema(W, selSug);
    }

    // Visualisation canvas : uniquement les tampons (mode maçonné sur mesure)
    compatChambresState.selected = (compatChambresState.activeKind === 'tile' && selSug)
      ? { N: selSug.N, l: selSug.l, total: selSug.total }
      : null;
    // Suggestion préformée sélectionnée (pignon ou long-pan) — réf + cotes applicables
    compatChambresState.selectedUnit = (compatChambresState.activeKind !== 'tile' && selSug)
      ? { ref: selSug.ref, l: selSug.l, H: selSug.H }
      : null;

    // Bouton « Appliquer » : redimensionne la boîte (préformé, pignon ou long-pan)
    // ou pose les tampons (tile) — logique inchangée, déjà générique sur selectedUnit.
    const applyBtn = document.getElementById('compatApplyBtn');
    if (applyBtn) {
      const unitSel = compatChambresState.selectedUnit;
      const tile = compatChambresState.selected;
      if (unitSel) {
        applyBtn.style.display = 'block';
        applyBtn.dataset.mode = 'unit';
        applyBtn.textContent = `Appliquer : ${unitSel.ref} · ${unitSel.l} × ${unitSel.H} mm`;
        applyBtn.classList.remove('is-applied');
      } else if (tile) {
        const ap = compatChambresState.applied;
        const isApplied = !!(ap && ap.N === tile.N && ap.l === tile.l);
        applyBtn.style.display = 'block';
        applyBtn.dataset.mode = 'tile';
        applyBtn.textContent = isApplied ? '✓ Appliqué — retirer' : 'Appliquer au plan';
        applyBtn.classList.toggle('is-applied', isApplied);
      } else {
        applyBtn.style.display = 'none';
      }
    }
    if (typeof redraw === 'function') redraw();
  }
```

Le bouton Appliquer (`setupCompatChambres()`, `src/renderer/script.js:7573-7603`) n'est
**pas modifié** : il lit déjà `compatChambresState.selectedUnit.{ref,l,H}` de façon
générique, qui contient maintenant indifféremment une cote pignon ou long-pan.

- [ ] **Step 3: Vérifier la syntaxe**

Run: `node --check src/renderer/script.js`
Expected: aucune sortie (pas d'erreur de syntaxe).

- [ ] **Step 4: Vérification manuelle via jsdom (script.js n'est couvert par aucun test Jest)**

Avec le catalogue réel (`data/chambres_de_tirage.csv`), la boîte **600 × 500 mm** isole un
cas où les deux sections sont non vides et distinctes : `unit` (pignon) = L5T, L6T, K1C,
K2C, K3C ; `longPan` = L2T, L3T, 1/2 L4T, L4T (aucun recoupement). Écrire ce script jetable
dans le scratchpad (jamais dans le dépôt), l'exécuter avec
`NODE_PATH="c:/DEV/tontonKAD/node_modules" node <fichier>.js`, puis le supprimer :

```js
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = 'c:/DEV/tontonKAD';
const html = fs.readFileSync(path.join(root, 'src/renderer/index.html'), 'utf8');

async function main() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'file://' + path.join(root, 'src/renderer/index.html').replace(/\\/g, '/'),
    pretendToBeVisual: true,
  });
  const { window: win } = dom;

  Object.defineProperty(win, 'localStorage', {
    value: (() => {
      const store = new Map();
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
      };
    })(),
  });

  win.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({}, { get: () => (typeof win.Function === 'function' ? () => {} : undefined) });
  };

  await new Promise((resolve) => {
    if (win.document.readyState === 'complete' || win.document.readyState === 'interactive') resolve();
    else win.document.addEventListener('DOMContentLoaded', resolve);
  });
  await new Promise((r) => setTimeout(r, 300)); // laisse le temps au chargement CSV (fetch)

  const doc = win.document;
  doc.getElementById('boxW').value = '600';
  doc.getElementById('boxW').dispatchEvent(new win.Event('input'));
  doc.getElementById('boxH').value = '500';
  doc.getElementById('boxH').dispatchEvent(new win.Event('input'));
  win.applyDimensions({ anchorContents: true, width: 600, height: 500 });

  doc.getElementById('compatChambresBtn').click();
  const items = [...doc.querySelectorAll('#compatList .compat-item')];
  const notes = [...doc.querySelectorAll('#compatList .compat-empty')].map((n) => n.textContent);
  console.log('Items rendus :', items.map((i) => i.textContent.trim()));
  console.log('Notes de section :', notes);
  console.log('Attendu : items L5T/L6T/K1C/K2C/K3C (pignon), une note "long-pan", puis items L2T/L3T/1/2 L4T/L4T.');

  // Sélectionne le 1er item de la section long-pan (après la note) et vérifie le bouton Appliquer.
  const noteIdx = [...doc.getElementById('compatList').children].findIndex((el) => el.classList.contains('compat-empty') && el.textContent.includes('long-pan'));
  const longPanItem = doc.getElementById('compatList').children[noteIdx + 1];
  longPanItem.click();
  const applyBtn = doc.getElementById('compatApplyBtn');
  console.log('Texte bouton Appliquer après sélection long-pan :', applyBtn.textContent);
  console.log('Item long-pan actif ?', longPanItem.classList.contains('active'));
  console.log('Aucun item pignon actif ?', items.every((i) => i === longPanItem || !i.classList.contains('active')));

  applyBtn.click();
  console.log('Cotes boîte après Appliquer :', doc.getElementById('boxW').value, '×', doc.getElementById('boxH').value);
  console.log('Attendu : la cote long-pan choisie (ex. 1160 × 540 pour L2T, la marge la plus faible).');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Expected : les logs confirment (1) deux groupes distincts d'items séparés par la note
« Compatible par le long-pan… », (2) le bouton Appliquer affiche la cote long-pan une
fois un item long-pan sélectionné, avec la classe `.active` uniquement sur cet item,
(3) après clic sur Appliquer, `#boxW`/`#boxH` prennent les cotes long-pan du modèle
choisi. Aucune erreur JS dans la sortie.

- [ ] **Step 5: Lancer la suite Jest complète (non-régression, script.js n'y participe pas)**

Run: `npx jest`
Expected: PASS — 217 + les nouveaux tests du Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/script.js
git commit -m "feat(compat-chambres): affiche les suggestions long-pan dans le panneau

renderCompatChambres() affiche jusqu'à deux sections préformées
simultanées (pignon puis long-pan, si présentes), avec une sélection
active unique qui bascule entre les deux. Le bouton Appliquer et le
reste du flux (schéma, redimensionnement, sauvegarde) restent
inchangés : ils consomment déjà une forme générique { ref, l, H }.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

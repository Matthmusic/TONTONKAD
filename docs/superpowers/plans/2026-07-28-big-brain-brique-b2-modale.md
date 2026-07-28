# BIG BRAIN — Brique B2 : modale DOM + intégration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** La modale « BIG BRAIN » (disposition maître-détail) : saisir des liaisons + paramètres, appeler `CableAssign` (Brique A) + `BigBrain` (Brique B1), créer les fourreaux remplis dans l'app et lancer le placement existant.

**Architecture:** Une fonction d'intégration `bigBrainGenerate(...)` dans `script.js` (crée les objets + arrange). Un contrôleur DOM `big-brain-modal.js` (façon `settings-modal.js`). HTML dans `index.html`, CSS dans `style.css`. Réutilise `window.CableAssign`, `window.BigBrain`.

**Tech Stack:** Vanilla JS, DOM. Vérifié dans l'app (pas de tests unitaires — code DOM/état).

**Spec :** `docs/superpowers/specs/2026-07-28-big-brain-modal-brique-b-design.md`

## Global Constraints

- Réutiliser les modules purs existants (`CableAssign.assignCablesToFourreaux`, `BigBrain.validateLiaisons`, `BigBrain.resultToObjects`). Ne pas ré-implémenter leur logique.
- Génération = opération annulable : `saveStateToHistory()` UNE fois avant de créer/effacer.
- Après chaque tâche : `node --check` sur les fichiers JS touchés + `npm test` (doit rester à 107 verts — on n'ajoute pas de test unitaire ici). Puis commit.
- Fichiers autorisés : `src/renderer/script.js`, `src/renderer/big-brain-modal.js`, `src/renderer/index.html`, `src/renderer/style.css`. Pas de push.
- Windows/Git Bash : pas de `sed -i`.
- `qty` saisi dans un `<input>` est une chaîne → le contrôleur convertit en nombre (`parseInt`) avant de construire les liaisons passées aux modules.

---

### Task 1 : fonction d'intégration `bigBrainGenerate` dans `script.js`

**Files:** Modify `src/renderer/script.js`

**Interface produite (exposée sur `window`) :**
- `window.bigBrainGenerate(result, liaisonsById, replace) -> { created: number, nonPlaces: number }`
  - `result` = sortie de `CableAssign.assignCablesToFourreaux`. `liaisonsById` = map `{id: nom}`. `replace` = booléen (true : vider le plan avant).

- [ ] **Step 1 : Ajouter la fonction** (près des autres helpers de création, après `addCableAt`)

```javascript
  // BIG BRAIN — instancie les fourreaux remplis à partir du résultat moteur, puis
  // laisse le placement existant (packer) les positionner. Une seule entrée d'historique.
  function bigBrainGenerate(result, liaisonsById, replace) {
    const objs = window.BigBrain.resultToObjects(result, liaisonsById || {});
    saveStateToHistory();
    if (replace) {
      fourreaux.length = 0;
      cables.length = 0;
      selected = null;
      selectedMultiple = [];
      gridLocked = false;
    }
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const createdIds = [];
    objs.fourreaux.forEach((fo, i) => {
      const id = nextId++;
      fourreaux.push({
        id, x: cx, y: cy, od: fo.od, idm: fo.idm,
        color: colorForFourreau(fo.type, fo.code), customColor: null, label: fo.label || '',
        children: [], vx: 0, vy: 0, dragging: false, frozen: false,
        _frozenByUser: false, _frozenByMode: false, _px: cx, _py: cy, type: fo.type, code: fo.code,
        famille: null, statut: 'utilisé', usage: '', origine: '', destination: '', reserve: false, aiguille: false,
      });
      createdIds[i] = id;
    });
    objs.cables.forEach((co) => {
      const parentId = createdIds[co.parentIndex];
      const parent = fourreaux.find((f) => f.id === parentId);
      if (!parent) return;
      const id = nextId++;
      cables.push({
        id, x: parent.x, y: parent.y, od: co.od, parent: parentId,
        color: colorForCable(co.fam, co.code), customColor: null, label: co.label || '',
        fam: co.fam, code: co.code, vx: 0, vy: 0, dragging: false, frozen: false,
        _frozenByUser: false, _frozenByMode: false, _px: parent.x, _py: parent.y,
      });
      parent.children.push(id);
    });
    if (fourreaux.length > 0 && typeof arrangeConduitGrid === 'function') arrangeConduitGrid();
    updateStats();
    updateInventory();
    redraw();
    return { created: objs.fourreaux.length, nonPlaces: (result.nonPlaces || []).length };
  }
  window.bigBrainGenerate = bigBrainGenerate;
```

- [ ] **Step 2 : Vérifier** — `node --check src/renderer/script.js` ; `npm test` (107 verts, inchangé).

- [ ] **Step 3 : Commit** — `feat(big-brain): fonction d'intégration bigBrainGenerate (crée fourreaux+câbles, arrange)`

---

### Task 2 : HTML de la modale + CSS

**Files:** Modify `src/renderer/index.html`, `src/renderer/style.css`

Suivre le pattern des modales existantes (ex. la modale projet / `settings-modal`) : overlay plein écran masqué par défaut, contenu centré.

- [ ] **Step 1 : Bouton d'ouverture** dans la barre d'outils (près des autres boutons Plan, ex. après `reduceToMinimum`). Ajouter :

```html
<button id="bigBrainBtn" class="btn" title="BIG BRAIN — générer depuis les liaisons">🧠 BIG BRAIN</button>
```

- [ ] **Step 2 : Markup de la modale** (avant `</body>`), disposition maître-détail :

```html
<div id="bigBrainModal" class="bb-modal" style="display:none;">
  <div class="bb-modal-content">
    <div class="bb-modal-header">
      <span>🧠 BIG BRAIN — Générer depuis les liaisons</span>
      <button id="bigBrainClose" class="bb-close" type="button">✕</button>
    </div>
    <div class="bb-params">
      <label>Taux max <input id="bbTaux" type="number" min="5" max="60" value="33" step="1"> %</label>
      <label>Taille max fourreau <select id="bbTailleMax"></select></label>
      <span class="bb-types">Types :
        <label><input type="checkbox" class="bb-type" value="TPC" checked> TPC</label>
        <label><input type="checkbox" class="bb-type" value="IRL"> IRL</label>
        <label><input type="checkbox" class="bb-type" value="ICTA"> ICTA</label>
      </span>
    </div>
    <div class="bb-body">
      <div class="bb-master">
        <div class="bb-master-head">Liaisons <button id="bbAddLiaison" type="button">+ Nouvelle</button></div>
        <ul id="bbLiaisonList" class="bb-liaison-list"></ul>
      </div>
      <div class="bb-detail" id="bbDetail">
        <div class="bb-detail-empty">Sélectionne ou crée une liaison.</div>
      </div>
    </div>
    <div class="bb-modal-footer">
      <span id="bbFootMsg" class="bb-foot-msg"></span>
      <button id="bigBrainCancel" type="button">Annuler</button>
      <button id="bigBrainGenerateBtn" type="button" class="bb-go">Générer ▶</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3 : Charger le contrôleur** — après `<script src="big-brain.js"></script>` : `<script src="big-brain-modal.js" defer></script>`

- [ ] **Step 4 : CSS** dans `style.css` (thème-aware, réutiliser les variables existantes `--bg-*`, `--border-color`, `--primary-orange`) : overlay `.bb-modal` (position fixed, fond semi-transparent, z-index élevé, flex centré), `.bb-modal-content` (largeur ~820px, colonne), `.bb-body` (flex : `.bb-master` flex 0 0 40 % avec bordure droite, `.bb-detail` flex 1), listes cliquables `.bb-liaison-item` (`.active` = accent orange), `.bb-go` (fond `--primary-orange`). S'inspirer des styles de modale existants pour la cohérence.

- [ ] **Step 5 : Vérifier** — `npm test` (107) ; ouvrir l'app : le bouton 🧠 ouvre une modale vide sans erreur console.

- [ ] **Step 6 : Commit** — `feat(big-brain): modale BIG BRAIN (HTML maître-détail + CSS)`

---

### Task 3 : contrôleur `big-brain-modal.js`

**Files:** Create `src/renderer/big-brain-modal.js`

Contrôleur DOM. État : `liaisons` en mémoire (module), `selectedIndex`. Réutilise `window.CableAssign`, `window.BigBrain`, `window.FOURREAUX`? → non : `FOURREAUX` n'est pas exposé sur window. **Étape préalable (dans cette tâche)** : dans `script.js`, exposer les catalogues au chargement des données — `window.FOURREAUX = FOURREAUX; window.CABLES = CABLES;` (ajouter après leur affectation dans `loadData`, et re-assigner à chaque rechargement). Puis le contrôleur les lit.

- [ ] **Step 1 : Exposer les catalogues** — dans `script.js`, après que `FOURREAUX` et `CABLES` sont chargés (fin de `loadData`), ajouter :

```javascript
    window.FOURREAUX = FOURREAUX;
    window.CABLES = CABLES;
```

- [ ] **Step 2 : Créer `src/renderer/big-brain-modal.js`** — contrôleur (IIFE) qui :
  - au `DOMContentLoaded`, récupère les éléments, remplit `#bbTailleMax` avec `window.FOURREAUX` (options `type code (od mm)`, value `od`), et câble les événements.
  - `open()` : `bigBrainModal.style.display='flex'`, rend la liste + le détail depuis l'état `liaisons`.
  - `addLiaison()` : ajoute `{ id: 'L'+(++seq), nom: 'Liaison '+seq, cables: [] }`, sélectionne-la, re-render.
  - rendu **maître** : un `<li>` par liaison (nom + nb câbles), clic → `selectedIndex`, re-render détail ; boutons renommer/supprimer.
  - rendu **détail** : input nom, liste des câbles de la liaison (select `fam` → select `code` filtré → input `qty` → bouton –), bouton « + ajouter un câble ». Les selects `fam`/`code` sont peuplés depuis `window.CABLES` (familles distinctes, puis codes de la famille). À chaque changement, mettre à jour l'objet câble et son `od` (depuis `CABLES.find(fam,code).od`).
  - **Générer** : construire `liaisons` (avec `qty` en nombre via `parseInt`, `od` résolu), `opts = { tauxMax: taux/100, tailleMaxFourreauOd: Number(#bbTailleMax.value), typesAutorises: cases cochées }`. Appeler `BigBrain.validateLiaisons(liaisons)` → si `!ok`, afficher les messages dans `#bbFootMsg`, stop. Sinon `result = CableAssign.assignCablesToFourreaux(liaisons, window.FOURREAUX, opts)`. Demander « Remplacer / Ajouter » via `confirm()` (ou un mini-dialogue) → `replace` booléen. `map = Object.fromEntries(liaisons.map(l => [l.id, l.nom]))`. Appeler `window.bigBrainGenerate(result, map, replace)`. Si `result.nonPlaces.length`, `showToast`?( le contrôleur n'a pas accès à showToast → afficher via `#bbFootMsg` un résumé, OU exposer `window.showToast`). **Étape préalable** : exposer `window.showToast = showToast;` dans `script.js`. Fermer la modale.
  - `close()` : `display='none'` (conserve `liaisons` en mémoire de session).

  (Le code complet du contrôleur est écrit à l'implémentation en suivant ces responsabilités ; il n'a aucune logique métier — validation/affectation/création sont déléguées aux modules exposés.)

- [ ] **Step 3 : Exposer `showToast`** — dans `script.js` : `window.showToast = showToast;` (près des autres exports `window.*`).

- [ ] **Step 4 : Vérifier dans l'app** — `node --check` sur les JS ; `npm test` (107). `npm start` : créer 2 liaisons avec des câbles, régler taux/taille, Générer → les fourreaux remplis apparaissent, placement lancé, non-placés signalés ; Ctrl+Z annule ; réouvrir la modale conserve les liaisons.

- [ ] **Step 5 : Commit** — `feat(big-brain): contrôleur de la modale (saisie liaisons → génération)`

---

## Fin de la Brique B2

Livrable : la modale BIG BRAIN fonctionnelle (saisie → affectation → création → placement). Vérifiée dans l'app. La Brique C (placement dédié + chambre + noms de phase) et l'import Caneco restent des specs futurs.

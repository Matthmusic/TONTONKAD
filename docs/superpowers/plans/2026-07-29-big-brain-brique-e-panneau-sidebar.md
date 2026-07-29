# BIG BRAIN — Brique E : la modale devient un panneau de la sidebar — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Déplacer toute l'interface BIG BRAIN de la modale vers un **panneau de la sidebar**, au même niveau que FOURREAU et CÂBLE. La modale est supprimée.

**Décision de design (validée) :** l'onglet 🧠 BIG BRAIN affiche un panneau (comme les deux autres onglets) au lieu d'ouvrir une modale — c'est un choix de mode de saisie, pas une fenêtre. Les paramètres (taux / taille max / types) passent dans une section **repliable, fermée par défaut**, car la sidebar (35 % de large, min 320 px) contient déjà les inventaires et le détail de sélection. La modale et son CSS sont **entièrement supprimés** : une seule interface à maintenir.

**Agencement cible (colonne étroite, empilé) :**

```
[FOURREAU] [CÂBLE] [🧠 BIG BRAIN]

Liaisons                      [+ Nouvelle]
  TG VERS PARIF        5 câbles   ✏ 🗑
  TG VERS NEO          5 câbles   ✏ 🗑   ← sélection

── Circuit : TG VERS NEO ──
Nom       [TG VERS NEO            ]
Famille   [U1000-AR2V           ▾]
Phases    [3] × [1x185          ▾]
Neutre    [☑]   [1x185          ▾]
PE        [☑]   [1x95           ▾]
Parallèle [1]
Récap : 3×1x185 + 1x185 (N) + 1x95 (PE) → 5 câbles

▸ Paramètres (33 %, TPC 200, TPC)        ← replié par défaut

           [ Générer ▶ ]
```

## Global Constraints

- **Aucun changement de logique métier** : validation, affectation, phases, génération, garde « aucun fourreau », confirm Remplacer/Ajouter, messages d'erreur et toasts sont repris **à l'identique**. Cette brique déplace de l'UI.
- Les modules purs (`circuit.js`, `cable-assign.js`, `phase-assign.js`, `big-brain.js`) ne sont **pas** modifiés.
- L'état des liaisons reste en mémoire de session (inchangé).
- Après chaque tâche : `node --check` sur les JS touchés + `npm test` (**134 tests**, doit rester vert — c'est de l'UI, on n'ajoute pas de test unitaire), puis commit.
- Fichiers autorisés : `src/renderer/big-brain-panel.js` (renommé), `src/renderer/big-brain-modal.js` (supprimé), `src/renderer/index.html`, `src/renderer/style.css`, `src/renderer/script.js`. Pas de push.
- Windows/Git Bash : `sed -i` bloqué — utiliser les outils d'édition. Pour le renommage, utiliser `git mv`.

---

### Task 1 : structure HTML du panneau + suppression de la modale

**Files:** Modify `src/renderer/index.html`

- [ ] **Step 1 : Ajouter le panneau** — après le `<div id="paneCABLE" class="hidden">…</div>` (dans la même `.card.add-card`), ajouter `<div id="paneBIGBRAIN" class="hidden">` contenant, dans cet ordre :
  1. En-tête « Liaisons » + bouton `#bbAddLiaison` (« + Nouvelle »).
  2. `<ul id="bbLiaisonList" class="bb-liaison-list"></ul>`.
  3. `<div id="bbDetail" class="bb-detail"></div>` (le bloc circuit y est rendu par le contrôleur).
  4. Section repliable des paramètres :
     ```html
     <details id="bbParams" class="bb-params-details">
       <summary id="bbParamsSummary">Paramètres</summary>
       <div class="bb-params">
         <label>Taux max <input id="bbTaux" type="number" min="5" max="60" value="33" step="1"> %</label>
         <label>Taille max fourreau <select id="bbTailleMax"></select></label>
         <span class="bb-types">Types :
           <label><input type="checkbox" class="bb-type" value="TPC" checked> TPC</label>
           <label><input type="checkbox" class="bb-type" value="IRL"> IRL</label>
           <label><input type="checkbox" class="bb-type" value="ICTA"> ICTA</label>
         </span>
       </div>
     </details>
     ```
     (`<details>` sans `open` = replié par défaut, comportement natif, aucun JS requis pour le pli.)
  5. `<div id="bbFootMsg" class="bb-foot-msg"></div>` puis `<button id="bigBrainGenerateBtn" type="button" class="bb-go">Générer ▶</button>`.

  **Conserver strictement les mêmes `id`** que la modale actuelle (`bbAddLiaison`, `bbLiaisonList`, `bbDetail`, `bbTaux`, `bbTailleMax`, `bb-type`, `bbFootMsg`, `bigBrainGenerateBtn`) : le contrôleur les réutilise tels quels.

- [ ] **Step 2 : Supprimer la modale** — retirer intégralement le bloc `<div id="bigBrainModal" class="bb-modal">…</div>` (y compris `#bigBrainClose` et `#bigBrainCancel`).

- [ ] **Step 3 : Mettre à jour le `<script>`** — remplacer `<script src="big-brain-modal.js" defer></script>` par `<script src="big-brain-panel.js" defer></script>`.

- [ ] **Step 4 : Vérifier** — `npm test` vert (134). Aucun `id` orphelin : rechercher `bigBrainModal`, `bigBrainClose`, `bigBrainCancel` dans `src/` → plus aucune occurrence attendue hors JS à traiter en Task 2.

- [ ] **Step 5 : Commit** — `feat(big-brain): panneau sidebar (HTML) et suppression de la modale`

---

### Task 2 : contrôleur — de la modale au panneau

**Files:** `git mv src/renderer/big-brain-modal.js src/renderer/big-brain-panel.js` puis modifier ce fichier ; Modify `src/renderer/script.js`

- [ ] **Step 1 : Renommer** — `git mv src/renderer/big-brain-modal.js src/renderer/big-brain-panel.js`. Mettre à jour le commentaire d'en-tête du fichier (« contrôleur du panneau BIG BRAIN de la sidebar »).

- [ ] **Step 2 : Retirer la mécanique de modale** — supprimer :
  - `open()` / `close()` et tout `style.display` sur `#bigBrainModal` ;
  - le `document.body.appendChild(modalEl)` (le panneau vit dans la sidebar) ;
  - les listeners de `#bigBrainClose`, `#bigBrainCancel`, la fermeture par Échap **propre à BIG BRAIN**, et le fallback `#bigBrainBtn` ;
  - toute référence à `modalEl`.

  À la place, le contrôleur **s'initialise au chargement** : peupler `#bbTailleMax`, rendre la liste et le détail, câbler les événements — le panneau étant simplement masqué/affiché par la bascule d'onglets.

- [ ] **Step 3 : Exposer un point d'entrée de rafraîchissement** — le catalogue `window.FOURREAUX` peut n'être pas encore chargé à l'init. Exposer `window.bigBrainPanelRefresh = () => { populateTailleMax(); renderMaster(); renderDetail(); }` et l'appeler depuis `script.js` quand l'onglet BIG BRAIN devient actif (voir Step 5). Garder l'init au `DOMContentLoaded` en plus, avec les gardes défensives existantes.

- [ ] **Step 4 : `setTab` gère 3 onglets** — dans `src/renderer/script.js`, fonction `setTab` (~ligne 6899), ajouter l'onglet et le panneau BIG BRAIN aux bascules existantes :

```javascript
    tabFOURREAU.classList.toggle('active', name === 'FOURREAU');
    tabCABLE.classList.toggle('active', name === 'CÂBLE');
    tabBIGBRAIN.classList.toggle('active', name === 'BIGBRAIN');
    paneFOURREAU.classList.toggle('hidden', name !== 'FOURREAU');
    paneCABLE.classList.toggle('hidden', name !== 'CÂBLE');
    paneBIGBRAIN.classList.toggle('hidden', name !== 'BIGBRAIN');
```

Déclarer `tabBIGBRAIN` et `paneBIGBRAIN` près de `tabFOURREAU`/`paneFOURREAU` (~lignes 203-206) avec `document.getElementById`.

- [ ] **Step 5 : Câbler l'onglet** — près de `tabCABLE.addEventListener(...)` (~ligne 9424) :

```javascript
    if (tabBIGBRAIN) tabBIGBRAIN.addEventListener('click', () => {
      setTab('BIGBRAIN');
      if (typeof window.bigBrainPanelRefresh === 'function') window.bigBrainPanelRefresh();
    });
```

- [ ] **Step 6 : Vérifier** — `node --check` sur `big-brain-panel.js` et `script.js` ; `npm test` vert ; rechercher `big-brain-modal` dans `src/` → aucune occurrence.

- [ ] **Step 7 : Commit** — `refactor(big-brain): contrôleur de panneau (renommage + bascule d'onglets)`

---

### Task 3 : CSS du panneau (colonne étroite) + retrait des styles de modale

**Files:** Modify `src/renderer/style.css`

- [ ] **Step 1 : Supprimer les styles de modale** — retirer les règles `.bb-modal`, `.bb-modal-content`, `.bb-modal-header`, `.bb-modal-footer`, `.bb-close`, `.bb-body`, `.bb-master`, `.bb-detail` **dans leur variante maître-détail côte-à-côte** (le `display:flex` à deux colonnes), et toute règle devenue orpheline.

- [ ] **Step 2 : Styles du panneau** — adapter au flux vertical d'une colonne de ~320-450 px :
  - `#paneBIGBRAIN` : `display:flex; flex-direction:column; gap:` (variable d'espacement existante).
  - `.bb-liaison-list` : hauteur max modérée (ex. `max-height: 180px; overflow-y:auto`) pour que le circuit reste visible même avec beaucoup de liaisons.
  - `.bb-liaison-item` : ligne compacte (nom en gras + compteur discret + ✏ 🗑 alignés à droite), état `.active` avec l'accent orange existant.
  - Bloc circuit : libellés courts alignés à gauche, champs à droite ; les lignes Phases/Neutre/PE en grille 3 colonnes (`libellé | nb/case | select`) qui se réduit proprement ; `.bb-circuit-recap` en texte discret.
  - `.bb-params-details > summary` : style de section repliable cohérent avec le reste de l'app (curseur pointeur, chevron natif conservé).
  - `.bb-go` : pleine largeur en bas du panneau.
  - Réutiliser les variables existantes (`--bg-*`, `--border-color`, `--primary-orange`, `--radius-*`, espacements) — aucune couleur en dur.

- [ ] **Step 3 : Vérifier** — `npm test` vert ; rechercher `bb-modal` dans `src/` → aucune occurrence.

- [ ] **Step 4 : Commit** — `style(big-brain): styles du panneau sidebar, retrait des styles de modale`

---

## Fin de la Brique E

Livrable : BIG BRAIN entièrement intégré à la sidebar en 3ᵉ onglet, modale supprimée, paramètres repliables. Vérification visuelle par l'utilisateur dans l'app.

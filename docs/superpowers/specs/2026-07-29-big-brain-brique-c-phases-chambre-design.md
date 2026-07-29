# BIG BRAIN — Brique C : phases auto + suggestion de chambre — Design

**Date :** 2026-07-29
**Statut :** validé (design), prêt pour plan
**Dépend de :** Brique A (`cable-assign.js`), B1 (`big-brain.js`), B2 (modale + `bigBrainGenerate`) — livrées.

## Périmètre

Le **placement** est déjà assuré par B2 (appel à `arrangeConduitGrid()`). La Brique C
ajoute donc les deux volets restants du mode BIG BRAIN :

1. **Nommage automatique des phases** (L1/L2/L3/N/PE), modifiable par câble.
2. **Suggestion de chambre de tirage** après génération — **non destructive** (informative).

**Exclus :** application automatique de la chambre (l'utilisateur garde le panneau existant),
import Caneco, modification du moteur d'affectation ou du placement.

## Contexte existant réutilisé

- `COLOR_SYSTEM.PHASE_COLORS` : `L1`→ACI 24 (marron), `L2`→8 (gris), `L3`→250 (noir), `N`→5 (bleu), `PE`→3 (vert).
- `COLOR_SYSTEM.getByPhase(phase)` → objet couleur (`.hex`).
- Le canvas **affiche déjà** le libellé de phase d'un câble dès que son `customColor`
  correspond à une couleur de phase (via `getPhaseFromColor`). Donc « nommer les phases »
  = poser le bon `customColor`.
- `CompatChambres.computeCompatibleChambers(models, largeur, hauteur, maxN)` et
  `CompatChambres.getChamberModels(chambres)` (module pur `compat-chambres.js`).

## C1 — Moteur de phases : `src/renderer/phase-assign.js` (PUR, testé)

```js
// cables : câbles d'UNE liaison, tels que saisis (avec qty et fonction)
//   [{ code: '1x185', qty: 3, fonction: 'auto'|'phase'|'neutre'|'PE'|'aucune' }, …]
// Retourne une phase (ou null) PAR CÂBLE-UNITÉ (qty déplié), dans l'ordre.
assignPhases(cables) -> ['L1','L2','L3','PE', …]

// Détecte un câble unipolaire depuis le code catalogue ('1x185' → true, '2x185' → false)
isUnipolaire(code) -> boolean
```

**Règles :**
- `fonction` par défaut : `'auto'`.
- `auto` → si `isUnipolaire(code)` ⇒ traité comme `phase` ; sinon ⇒ `null`.
- `phase` → phase suivante du cycle **L1 → L2 → L3 → L1 → …**
- `neutre` → `'N'` ; `PE` → `'PE'` ; `aucune` → `null`.
- `qty` est déplié : 3 unités de `1x185` en `auto` ⇒ `['L1','L2','L3']`.
- **Le cycle est local à la liaison** : `assignPhases` est appelée une fois par liaison,
  donc chaque liaison redémarre à L1. Les entrées `null` ne consomment pas de cycle.
- `isUnipolaire` : `true` si le code (trimé) commence par `1x` ou `1X` (tolère les espaces).

**API module** (pattern `packer.js`) : `window.PhaseAssign = { assignPhases, isUnipolaire }` + `module.exports`.

## C2 — Application des phases dans `bigBrainGenerate` (`script.js`)

Les phases sont calculées **par liaison** puis rattachées aux câbles créés.

- Avant création, construire une map `phasesByLiaison` : pour chaque liaison,
  `PhaseAssign.assignPhases(liaison.cables)` → tableau de phases, consommé dans l'ordre
  d'apparition des câbles-unités de cette liaison.
- À la création de chaque câble, si une phase est disponible pour sa liaison :
  `customColor = COLOR_SYSTEM.getByPhase(phase).hex` (et `color` inchangé).
- Le libellé de phase apparaît alors automatiquement au rendu (mécanisme existant).
- Les câbles sans phase (`null`) gardent leur couleur de famille, sans libellé.

**Contrainte d'ordre :** `CableAssign` peut répartir les câbles d'une liaison sur
plusieurs fourreaux ; l'affectation des phases suit l'ordre des **câbles-unités de la
liaison** (pas l'ordre des fourreaux), pour que L1/L2/L3 restent cohérents dans le circuit.

## C3 — Suggestion de chambre (informative)

Après création + `arrangeConduitGrid()`, dans le même flux :

- Lire les cotes courantes (`WORLD_W_MM`, `WORLD_H_MM`).
- `models = CompatChambres.getChamberModels(CHAMBRES_TIRAGE)` puis
  `{ unit } = CompatChambres.computeCompatibleChambers(models, W, H)`.
- Si `unit.length > 0` : `showToast('🏗️ Chambre <ref> compatible (<l> × <H> mm) — voir « Chambres compatibles »')`
  avec la meilleure suggestion (`unit[0]`, déjà triée par marge).
- Sinon : aucun message (silence — le panneau reste disponible).
- **Rien n'est appliqué** : ni redimensionnement, ni verrouillage, ni label de chambre.

## C4 — UI : colonne « fonction » dans la modale

Dans `big-brain-modal.js`, `renderDetail()` : ajouter un `<select class="bb-cable-fonction">`
entre `qty` et le bouton `–`, avec les options
`Auto` (`auto`, défaut) · `Phase` (`phase`) · `Neutre` (`neutre`) · `PE` (`PE`) · `Aucune` (`aucune`).

- Le changement écrit `cable.fonction` dans l'état (même délégation que `qty`).
- `addCableToSelected()` initialise `fonction: 'auto'`.
- La `fonction` est transmise telle quelle dans les liaisons construites pour les modules.
- CSS : calquer la largeur/style des selects existants (`.bb-cable-fam`/`.bb-cable-code`).

## Tests (Jest — `tests/phase-assign.test.js`)

- `isUnipolaire` : `'1x185'`→true, `'2x185'`→false, `'1X10'`→true, `' 1x6 '`→true, `''`→false.
- `auto` sur unipolaires : 3 unités ⇒ `['L1','L2','L3']` ; 4 unités ⇒ `[…,'L1']` (cycle).
- `auto` sur multipolaire ⇒ `null`, et **ne consomme pas** le cycle
  (`[2x185 qty1 auto, 1x185 qty2 auto]` ⇒ `[null,'L1','L2']`).
- `fonction` explicite : `neutre`⇒`'N'`, `PE`⇒`'PE'`, `aucune`⇒`null`,
  `phase` sur un multipolaire ⇒ prend quand même le cycle.
- Cas métier `3×[2x185] + [1x185 en PE]` ⇒ `[null,null,null,'PE']`.
- `qty` absent/0 ⇒ ignoré ; liste vide ⇒ `[]`.

## Découpage d'implémentation

1. **C1** — `phase-assign.js` + tests + chargement dans `index.html`.
2. **C2/C3** — intégration dans `bigBrainGenerate` (phases + toast chambre).
3. **C4** — colonne « fonction » dans la modale + CSS.

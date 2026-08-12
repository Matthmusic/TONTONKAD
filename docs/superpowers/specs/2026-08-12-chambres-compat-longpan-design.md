# Chambres compatibles — suggestion via le long-pan — Design

**Date :** 2026-08-12
**Statut :** validé (design), prêt pour plan
**Dépend de :** `compat-chambres.js` / panneau « Chambres compatibles » — livrés.

## Origine

`computeCompatibleChambers()` ne compare aujourd'hui la largeur de la boîte qu'au **pignon**
(`m.l`, le petit côté) de chaque modèle StradEasy — la face d'entrée en ligne droite du
faisceau. Le **long-pan** (`m.L`, le grand côté) est calculé dans `getChamberModels()` mais
jamais exploité : un modèle dont le pignon est trop étroit mais dont le long-pan
conviendrait n'est jamais proposé, alors qu'il représente une option préformée valable
(entrée latérale) — préférable à repartir sur du maçonné sur mesure + tampons.

## Périmètre

Ajout d'une 2e catégorie de suggestions « compatible par le long-pan » dans le calcul pur
et dans le panneau UI, avec sa propre sélection et son propre comportement d'application.

**Exclus :** changement du calcul pignon existant (`unit`) et de son tri ; changement du
format CSV/catalogue ; distinction visuelle avancée (rotation) dans le schéma SVG — on
réutilise `buildUnitSchema` tel quel.

## Approche

Toute la logique de filtrage vit dans le module **pur** `compat-chambres.js`, comme
l'existant. Le panneau (`script.js`) reste un consommateur : il affiche ce que le module
calcule et applique la dimension choisie à la boîte.

Alternative écartée : fusionner pignon et long-pan dans un seul tableau `unit` avec un
champ `via: 'pignon' | 'long-pan'`. Rejeté pour deux raisons : (1) le tri par marge
mélangerait des cotes de nature différente (pignon vs long-pan) sous une même marge,
rendant la liste illisible sans lecture attentive du libellé ; (2) l'UI doit de toute façon
distinguer visuellement les deux (intitulé de section différent), donc deux tableaux
distincts collent mieux à la présentation qu'un seul filtré après coup.

## C1 — `computeCompatibleChambers` (compat-chambres.js)

Nouveau tableau `longPan`, calculé après `unit`, **avant** la décision de repli `tiling` :

```js
const longPan = models
  .filter(m => m.l < largeur && m.L >= largeur && m.H >= hauteur)
  .map(m => ({ ref: m.ref, L: m.L, H: m.H, marginW: m.L - largeur, marginH: m.H - hauteur }))
  .sort((a, b) => (a.marginW + a.marginH) - (b.marginW + b.marginH) || a.ref.localeCompare(b.ref));
```

- `m.l < largeur` exclut tout modèle déjà présent dans `unit` (pas de doublon entre les
  deux listes — un modèle dont le pignon convient n'a pas besoin d'être reproposé via son
  long-pan, qui est de toute façon toujours ≥ pignon).
- Le calcul de `tiling` (repli maçonné) ne se déclenche que si **les deux** listes
  préformées sont vides : `if (unit.length === 0 && longPan.length === 0) { ... }`.
- Retour de la fonction : `{ unit, longPan, tiling }`.

## C2 — Panneau (`script.js`, `renderCompatChambres`)

- Nouvelle section sous la liste pignon, affichée seulement si `longPan.length > 0`,
  intitulée pour ne pas laisser croire à une entrée en ligne droite (ex. « Compatible par
  le long-pan (entrée latérale) »). Item au même format que `unit` (`réf — L × H mm` +
  marge), construit à partir de `longPan`.
- État de sélection : deux compteurs distincts, un seul actif à la fois — sélectionner
  dans l'une des deux listes désélectionne l'autre. Réutilise le pattern déjà en place
  pour `unit`/`tiling` (un seul `selected*` renseigné à la fois).
- Bouton **Appliquer** : si la sélection active porte sur `longPan`, redimensionne la
  boîte à `L × H` (au lieu de `l × H`) ; comportement pignon/tiling inchangé sinon.
- Schéma SVG : réutilise `buildUnitSchema(W, H, s)` tel quel, en lui passant
  `{ ref: s.ref, l: s.L, H: s.H }` — le paramètre `l` de la fonction représente la largeur
  de la chambre affichée, sans supposer qu'il s'agit du pignon.

## Tests (`compat-chambres.test.js`)

- Un modèle absent de `unit` (pignon trop étroit) mais présent dans `longPan` (long-pan
  suffisant), avec les bonnes marges.
- Tri par marge croissante au sein de `longPan`.
- Aucun doublon : un modèle compatible côté pignon n'apparaît pas dans `longPan`.
- `tiling` reste vide dès que `unit` **ou** `longPan` contient au moins une entrée.
- `tiling` se déclenche normalement si `unit` et `longPan` sont tous les deux vides
  (régression sur le comportement existant).

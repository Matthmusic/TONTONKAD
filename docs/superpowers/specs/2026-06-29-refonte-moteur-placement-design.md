# Design — Refonte du moteur de placement de fourreaux

- **Date** : 2026-06-29
- **Auteur** : Matthieu MAUREL (assisté Claude)
- **Statut** : Approuvé (design) — en attente de relecture du spec
- **Remplace** : `src/renderer/placement-engine.js` (~1700 lignes)

---

## 1. Contexte & objectifs

Le moteur actuel (`placement-engine.js`) a accumulé des couches successives :
classes `PlacementOrchestrator/Generator/Scorer/Configuration`, logique
famille/niveau/réserve **désactivée** (`familyCoherence: 0`, mode flow-first),
stratégies redondantes (`minWidth`, `minHeight`, `square`, `compact`,
`interleaved` qui ne fait que rediriger vers `flowPacking`), alias de
compatibilité v1, et un scoring multi-critères flou exposé en « score % ».

On repart de zéro. Objectifs validés avec l'utilisateur :

1. **Compacité** — minimiser la surface de la nappe.
2. **Forme prévisible (tranchée)** — privilégier `largeur ≥ hauteur`
   (creuser large > profond).
3. **Déterminisme & explicabilité** — même entrée ⇒ même sortie, toujours ;
   chaque placement doit être compréhensible.

Non-objectif : la performance n'est pas un problème (≤ 50 fourreaux, cible
< 100 ms).

### Décisions actées

| Sujet | Décision |
|---|---|
| Techno | JS, avec une lib de packing |
| Algorithme | `maxrects-packer` (choix utilisateur), enveloppé d'une fine couche |
| Périmètre | **Cœur géométrique seul** — on jette familles, niveaux, réserves, `ValidationEngine`, `ReserveAdvisor`, `detectVoidFill` |
| Sortie | `solve()` (meilleur placement) + `variants()` (propositions à la demande) |
| Style | Noms courts |

> Note : l'auteur a choisi `maxrects-packer` malgré la recommandation d'un
> shelf-packer maison. Les deux risques identifiés (déterminisme, contraintes
> non gérées nativement) sont neutralisés par la conception ci-dessous
> (heuristique figée + couche tranchée/axe verrouillé externe).

---

## 2. Bibliothèque

- **Paquet** : `maxrects-packer@2.7.3` — MIT, maintenu (modifié 2025-08-30).
- **Build** : UMD (`global.MaxRectsPacker`), donc vendorisable par balise
  `<script>` exactement comme `konva.min.js` — aucun changement au système de
  chargement du renderer Electron.
- **Intégration** : dépendance npm + copie du build UMD vers
  `src/renderer/maxrects-packer.min.js`, inclus dans `index.html` **avant**
  `packer.js`.

Configuration **déterministe** imposée :
`{ pot: false, smart: true, allowRotation: false, border: 0, logic: MAX_EDGE }`.
Une seule heuristique figée → résultat 100 % reproductible.

---

## 3. Architecture & API

Module unique **`src/renderer/packer.js`** (~250 lignes), fonctions pures, sans
logique métier. Exposé sur `window` (cohérent avec l'existant).

```js
// Géométrie (mutable par l'UI)
GEO = { gap: 30, margin: 40 }   // entraxe (mm), lit de pose (mm)

cell(d) -> number               // taille de cellule = d + GEO.gap

solve(tubes, opts) -> Layout            // meilleur placement déterministe
variants(tubes, opts) -> Layout[]       // propositions à la demande
```

### Entrées

- `tubes` : `[{ id, d }]` — `d` = diamètre (mm). La quantité est dépliée en
  amont (instances individuelles), comme aujourd'hui.
- `opts` : `{ w?, h?, lock?: 'w' | 'h' | null }`
  - `lock: 'w'` → largeur `w` imposée (cas par défaut de l'app).
  - `lock: 'h'` → hauteur `h` imposée.
  - `lock: null` → deux axes libres.

### Sortie — `Layout`

```js
{
  w, h,                          // dimensions de la nappe (mm), marges incluses
  items: [{ id, x, y, d }],      // x/y = coin BAS-GAUCHE de la cellule, Y=0 en bas
  ratio,                         // w / h
  fill,                          // taux d'occupation 0..1 (Σ aires cellules / (w·h))
  tag,                           // 'compact' | 'tranchee' | 'rect43' | 'locked'
}
```

**Invariant de coordonnées conservé** : Y=0 en bas, Y croît vers le haut ;
`x/y` = coin bas-gauche de la cellule (identique à `placedFourreaux`
aujourd'hui). La conversion vers le canvas (Y inversé + centrage) reste côté UI,
inchangée.

Le « score % » multi-critères est **abandonné** au profit de métriques
explicites : `fill` (compacité) et `ratio` (forme).

---

## 4. Algorithme

**Modèle** : chaque tube → cellule carrée `c = cell(d) = d + GEO.gap`. maxrects
empaquette ces carrés ; les marges (`GEO.margin`) sont ajoutées autour du
contenu packé.

**Tri d'entrée** stable : diamètre décroissant, puis `id` croissant
(déterminisme).

### Modes selon `lock`

- **`lock: 'w'`** : pack dans `maxWidth = w - 2·margin`, `maxHeight = ∞`.
  maxrects (`smart: true`) renvoie la hauteur de contenu `hc`.
  → `Layout = { w, h: hc + 2·margin, tag: 'locked' }`.
- **`lock: 'h'`** : symétrique (hauteur imposée, largeur calculée).
- **`lock: null`** : **balayage de largeurs candidates** de `maxCellule` à
  `Σ cellules`, par paliers fixes. Pour chaque largeur candidate on pack et on
  mesure `(w, h, fill, ratio)`. On sélectionne selon l'objectif (§5).

### Couche tranchée (hors lib, ≈15 lignes)

Filtre/tri appliqué aux résultats du balayage : on préfère `w ≥ h`, idéalement
`1 ≤ ratio ≤ 2`. Ce critère n'existe pas dans maxrects — c'est notre couche.

### Déterminisme

Tri d'entrée stable + heuristique maxrects figée + balayage à pas fixe ⇒ même
entrée = même sortie.

---

## 5. `solve` vs `variants`

- **`solve(tubes, opts)`** : LA meilleure proposition.
  - Mode verrouillé : résultat unique (`tag: 'locked'`).
  - Mode libre : parmi le balayage, la plus compacte (`fill` max) respectant la
    tranchée (`w ≥ h`).
- **`variants(tubes, opts)`** : jusqu'à 3 `Layout` étiquetés, dédupliqués :
  - `compact` — surface minimale (forme libre).
  - `tranchee` — `w ≥ h`, ratio le plus proche de l'idéal large.
  - `rect43` — ratio visé ≈ 4:3.

  Remplace les cards Compact / Optimisé / Rectangle du panel actuel.

---

## 6. Intégration dans `script.js`

3 sites d'appel utilisent `new PlacementOrchestrator().computeBestPlacement(...)`
(≈ lignes 1263, 3251, 3397). Réécriture vers `solve` / `variants`. Mapping :

| Ancien | Nouveau |
|---|---|
| `bestConfig.placedFourreaux` (`{id,x,y,diameter}`) | `layout.items` (`{id,x,y,d}`) |
| `bestConfig.width` / `.height` | `layout.w` / `layout.h` |
| `bestConfig.calculateCellSize(d)` | `cell(d)` |
| `bestConfig.alternatives` | `variants(...)` |
| `bestConfig.score` (affiché %) | `layout.fill` (taux d'occupation %) |

**Suppressions côté UI** :
- appels `detectVoidFill` (≈ 1325, 3468) et `lastVoidFillSuggestions`,
- `reserveSuggestions`,
- toute référence famille / niveau / validation.

La conversion de coordonnées (Y inversé + centrage dans la boîte) est
**conservée à l'identique**. Chaque site d'appel est revu individuellement.

---

## 7. Tests, migration & nettoyage

### Migration
- Ajout dépendance `maxrects-packer` + vendoring du build UMD.
- Inclusion dans `index.html` avant `packer.js`.
- **Suppression** de `placement-engine.js`.
- Remplacement de `tests/placement-engine.test.js` par `tests/packer.test.js`.

### Tests Jest (garantie qualité)
1. Aucun chevauchement de cellules.
2. Marges (`GEO.margin`) respectées sur les 4 bords.
3. **Déterminisme** : deux appels identiques ⇒ résultat identique.
4. **Tranchée** : `w ≥ h` en mode libre (`solve`).
5. **Axe verrouillé** : `lock:'w'` ⇒ `layout.w === w` ; idem `'h'`.
6. `fill` cohérent (0 < fill ≤ 1).
7. Performance : < 100 ms sur 50 tubes.
8. `variants` : ≤ 3 résultats, dédupliqués, chacun valide géométriquement.

---

## 8. Hors périmètre (YAGNI)

- Familles, niveaux (bas/médian/haut), couleurs par famille.
- Réserves, `ReserveAdvisor`, ratio de réserves.
- `ValidationEngine` (alertes CFO/CFA, etc.).
- `detectVoidFill` (remplissage des vides).
- Rotation des cellules (inutile : carrés).
- Changement de langage / WASM.

# BIG BRAIN — Brique F : câblage mono / multi — Design

**Date :** 2026-07-30
**Statut :** validé (design), prêt pour plan
**Dépend de :** Briques A / B1 / B2 / C / D / E — livrées.

## Origine

La Brique D décrit une liaison comme un **circuit** (`nbPhases` × section + neutre + PE) que
`circuit.js` déplie en autant de câbles **unipolaires**. C'est le cas des grosses sections
(3×`1x185` + N + PE), mais pas celui des câbles **multiconducteurs** (`3G2,5`, `5G16`,
`4x25`, `5x16`…), où **un seul câble** transporte tous les conducteurs.

Le panneau doit donc porter un choix explicite de nature de câblage :

- **Mono** (unipolaire) : un câble par conducteur — comportement actuel.
- **Multi** (multiconducteur) : un seul câble contenant tous les conducteurs.

## Périmètre

Un champ `mode` sur le circuit, son aiguillage dans `circuit.js`, et l'UI correspondante
dans le panneau BIG BRAIN.

**Exclus :** distinction normative `G` / `x` (présence du conducteur vert-jaune),
section de PE réduite dans un multiconducteur, import Caneco, persistance du mode dans le
projet (l'état BIG BRAIN reste en mémoire de session), modification de `cable-assign.js`,
`phase-assign.js` ou du placement.

## Approche

Toute la bascule vit dans le module **pur** `src/renderer/circuit.js`. Les formats d'entrée
de `CableAssign` et `PhaseAssign` ne changent pas : ils reçoivent la même liste
`[{ fam, code, od, qty, fonction }]`, le mode multi produisant simplement **une seule
entrée** au lieu de plusieurs.

Alternatives écartées :

- **Module d'aiguillage séparé** (`cable-mode.js`) : un fichier de plus pour une
  branche de trois lignes, sans frontière utile.
- **Aiguillage dans `big-brain-panel.js`** : sortirait la logique métier du périmètre
  testé par Jest — le panneau reste un contrôleur DOM sans décision métier.

## F1 — Modèle de données

```js
Liaison = {
  id, nom,
  circuit: {
    mode: 'mono' | 'multi',   // défaut 'mono' ; absent ⇒ 'mono' (rétrocompatible)
    fam: string,              // famille catalogue, ex. 'U1000 R2V'

    // mode 'mono' (inchangé — Brique D)
    nbPhases: number,
    codePhase: string,
    neutre: boolean,
    codeNeutre: string,
    pe: boolean,
    codePE: string,

    // mode 'multi'
    codeMulti: string,        // code multiconducteur, ex. '5x16'

    parallele: number         // partagé entre les deux modes (défaut 1)
  }
}
```

**`parallele` est réutilisé comme quantité en mode multi** plutôt qu'un champ `qtyMulti`
supplémentaire : la sémantique est la même (N circuits identiques), et l'état reste
cohérent quand on bascule de mode. Seul le libellé UI change
(« Circuits en parallèle » en mono, « Quantité » en multi).

**Les champs mono sont conservés** en passant en multi (et inversement) : un aller-retour
de mode ne perd aucune saisie.

## F2 — `circuitToCables` : aiguillage par mode

Dans `src/renderer/circuit.js`, avant le dépliage actuel :

```js
const par = Math.max(1, num(circuit.parallele, 1));
if (circuit.mode === 'multi') {
  push(circuit.codeMulti, par, 'aucune');
  return out;   // nbPhases / neutre / pe sont ignorés en multi
}
// … dépliage mono existant (phase / neutre / PE) inchangé
```

`fonction: 'aucune'` est la valeur déjà définie par la Brique C : `PhaseAssign.assignPhases`
renvoie `null`, donc aucun `customColor` n'est posé, donc **aucun libellé de phase ne
s'affiche** au canvas — le rendu voulu pour un multiconducteur. Aucune modification de
`phase-assign.js` ni de `drawCable`.

`codeMulti` vide ou absent ⇒ `[]` (le `push` existant filtre déjà `!code`), ce qui déclenche
l'erreur « Liaison sans câble » de `BigBrain.validateLiaisons` : cul-de-sac impossible côté
génération.

## F3 — UI du panneau (`big-brain-panel.js`)

```
Nom de la liaison   [TG vers PARIF        ]
Câblage             (•) Mono    ( ) Multi
Famille             [U1000 R2V          ▾]
Câble               [5x16               ▾]     ← mode multi seulement
Quantité            [2]
Récap : 2×5x16 → 2 câble(s)
```

- Nouvelle ligne **« Câblage »** en tête du bloc circuit, via `buildCircuitRow` :
  deux boutons radio (même `name`) `Mono` / `Multi`, avec `title` explicite
  (« Un câble par conducteur (3 phases + N + PE) » / « Un seul câble multiconducteur
  (3G, 5G, 4x…) »).
- En **mono** : le bloc actuel (Phases / Neutre / PE / Circuits en parallèle) est inchangé.
- En **multi** : les lignes Phases / Neutre / PE sont remplacées par une ligne
  « Câble » (select de code) ; la ligne `parallele` prend le libellé « Quantité ».
- Le changement de **mode** ou de **famille** provoque un `renderDetail()` complet
  (même mécanique que `neutre` / `pe` aujourd'hui) ; un changement de code seul ne
  rafraîchit que le récapitulatif (`updateRecap`).
- `addLiaison()` initialise `mode: 'mono'` et `codeMulti` = premier code multi de la famille.
- Le changement de famille réinitialise `codeMulti` comme les autres codes
  (premier code multi de la nouvelle famille).
- Le récapitulatif existant (`recapText`) fonctionne tel quel : `fonction: 'aucune'` n'a pas
  de suffixe, d'où `2×5x16 → 2 câble(s)`. Le diamètre n'est pas ajouté au récap (le mode
  mono ne l'affiche pas non plus).

### Filtrage des codes par mode (correctif)

Les sélecteurs de code sont filtrés selon le mode, via `PhaseAssign.isUnipolaire`
(déjà chargé avant `big-brain-panel.js` dans `index.html`) :

- **mono** ⇒ seuls les codes `1x…` ;
- **multi** ⇒ tous les autres (`3G2,5`, `5G16`, `4x25`, `5x16`…).

C'est un **correctif** : aujourd'hui `getCodesForFam` liste tous les codes, donc `3x25`
peut être choisi comme code de phase en mono, produisant 3 câbles `3x25` étiquetés
L1/L2/L3 — électriquement faux.

Repli défensif : si le filtrage donne une liste **vide** pour une famille (famille sans
unipolaire, ou sans multiconducteur), le sélecteur affiche la liste complète des codes de
la famille plutôt qu'un select vide.

## Tests

**`tests/circuit.test.js`** (étendu) :

- `mode: 'multi'` ⇒ exactement une entrée `{ fam, code: codeMulti, od, qty: parallele, fonction: 'aucune' }` ;
- `mode: 'multi'`, `parallele: 3` ⇒ `qty: 3` ;
- `mode: 'multi'` avec `nbPhases: 3`, `neutre: true`, `pe: true` ⇒ toujours **une seule** entrée
  (les champs mono sont ignorés) ;
- `mode: 'multi'` sans `codeMulti` (vide/absent) ⇒ `[]` ;
- `mode: 'mono'` explicite et `mode` **absent** ⇒ dépliage identique à l'existant (rétrocompatibilité) ;
- `od` du multi résolu via `resolveOd(fam, codeMulti)`.

**`tests/big-brain-integration.test.js`** (étendu) : une liaison en multi ⇒
`assignPhases` renvoie `[null, …]` (une entrée par circuit parallèle) et
`buildPhaseQueues` produit une seule file `L1|<codeMulti>|aucune` ne contenant que des
`null` — donc aucun libellé de phase au canvas.

Le reste (radios, bascule de rendu, filtrage des selects) est vérifié dans l'app.

## Découpage d'implémentation

1. **F2** — `mode` dans `circuit.js` + tests unitaires et d'intégration.
2. **F3** — ligne « Câblage », rendu conditionnel du détail, filtrage des codes, CSS
   éventuel pour la ligne de radios.

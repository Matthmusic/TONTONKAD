# BIG BRAIN — Brique D : saisie par circuit + correctifs UX — Design

**Date :** 2026-07-29
**Statut :** validé (design), issu du test terrain de la v2.6.0
**Dépend de :** Briques A / B1 / B2 / C — livrées.

## Origine

Premier test réel de la modale BIG BRAIN. Quatre problèmes relevés :

1. **Modale mal positionnée** — elle n'est pas centrée dans la fenêtre.
2. **Nom de liaison répété sur chaque câble** au canvas → illisible (empilement de « TG VERS PARIF » sur tous les câbles).
3. **Bouton BIG BRAIN mal placé** — il est dans la barre d'outils du bas alors qu'il s'agit d'un choix de mode de saisie, au même niveau que FOURREAU / CÂBLE.
4. **Saisie des câbles inadaptée** — « 5 × 1x185 en Auto » donne L1, L2, L3, L1, L2 : électriquement faux. Il faut décrire le circuit : *3 phases + neutre + PE*.

## D1 — Saisie par « circuit » (remplace les lignes de câble)

Une liaison porte désormais **un circuit** décrit électriquement, au lieu d'une liste de
lignes câble+quantité+fonction.

```js
Liaison = {
  id, nom,
  circuit: {
    fam: string,            // famille catalogue, ex. 'U1000-AR2V'
    nbPhases: number,       // 1..4 (typiquement 3)
    codePhase: string,      // code catalogue des phases, ex. '1x185'
    neutre: boolean,        // présence d'un neutre
    codeNeutre: string,     // code catalogue du neutre (section propre)
    pe: boolean,            // présence d'un PE
    codePE: string,         // code catalogue du PE (section propre)
    parallele: number       // nombre de circuits en parallèle (défaut 1)
  }
}
```

**Sections différentes par fonction** : `codePhase`, `codeNeutre` et `codePE` sont
indépendants (cas courant : phases 185 mm², PE 95 mm²).

**Sémantique de `parallele`** : *N circuits en parallèle* ⇒ **tout** le circuit est
multiplié par N (phases, neutre et PE). `parallele = 2` sur `3×1x185 + N + PE` donne
6 conducteurs de phase (→ L1,L2,L3,L1,L2,L3), 2 neutres, 2 PE.

### Fonction pure `circuitToCables(circuit, resolveOd)`

Nouveau module `src/renderer/circuit.js` (pattern `packer.js`).

```js
circuitToCables(circuit, resolveOd) -> [ { fam, code, od, qty, fonction }, … ]
// resolveOd(fam, code) -> number : injecté (le module reste pur, sans accès au catalogue)
```

Produit, dans cet ordre (les entrées à `qty = 0` sont omises) :
- `{ code: codePhase, qty: nbPhases × parallele, fonction: 'phase' }`
- si `neutre` : `{ code: codeNeutre, qty: parallele, fonction: 'neutre' }`
- si `pe` : `{ code: codePE, qty: parallele, fonction: 'PE' }`

Le résultat alimente **tel quel** `CableAssign` et `PhaseAssign` (formats inchangés) :
`fonction` étant explicite, la détection unipolaire/multipolaire n'intervient plus pour
ces câbles — L1/L2/L3 pour les phases, N pour le neutre, PE pour le PE.

### UI (panneau détail de la modale)

Remplace les lignes de câble par un bloc :

```
Nom de la liaison        [TG VERS NEO            ]
Famille                  [U1000-AR2V           ▾]
Phases      [3]  ×       [1x185                ▾]
Neutre      [☑]          [1x185                ▾]
PE          [☑]          [1x185                ▾]
Circuits en parallèle    [1]
Récapitulatif : 3×1x185² + 1x185² + PE 185²  →  5 câbles
```

- Les sélecteurs de code sont filtrés par la famille choisie (comportement existant).
- Le récapitulatif se met à jour à chaque changement (contrôle visuel immédiat).
- La colonne « fonction » disparaît (la fonction découle de la structure du circuit).

## D2 — Correctifs UX

### Centrage de la modale
À l'ouverture, déplacer la modale en fin de `body` — `document.body.appendChild(modal)` —
avant de l'afficher. C'est le remède déjà appliqué à la modale d'export PDF
(« éviter les conflits de layout » : un conteneur parent avec `overflow`/`transform`
casse le centrage d'un élément `position: fixed`).

### Libellé des câbles au canvas
Dans `big-brain.js` / `resultToObjects`, les câbles ne reçoivent plus le nom de la
liaison : `label: ''`. Le **fourreau** conserve son libellé de liaison (c'est lui qui
identifie le circuit sur le plan). `liaisonId` reste présent (nécessaire aux phases).

### Emplacement du bouton BIG BRAIN
Le bouton quitte la barre d'outils du bas et devient un **troisième onglet** de la carte
de saisie, à côté de FOURREAU et CÂBLE :

```
[ FOURREAU ] [ CÂBLE ] [ 🧠 BIG BRAIN ]
```

Cliquer l'onglet BIG BRAIN ouvre la modale (les deux autres onglets gardent leur
comportement de bascule de panneau). L'onglet reprend l'apparence active des autres.

## Tests

- **`circuit.js`** (Jest) : 3 phases + N + PE ⇒ 3 entrées avec bons `qty`/`fonction` ;
  sans neutre / sans PE ⇒ entrées omises ; `parallele = 2` ⇒ tout multiplié par 2 ;
  sections différentes respectées ; `od` résolu via `resolveOd` ; `nbPhases = 0` ⇒ pas
  d'entrée phase ; circuit vide/incomplet ⇒ `[]` sans crash.
- **`big-brain.js`** : les câbles générés portent `label: ''` (test mis à jour).
- Le reste (modale, onglet, centrage) est vérifié dans l'app.

## Hors périmètre

Import Caneco ; modification des moteurs `cable-assign` / `phase-assign` (leurs formats
d'entrée ne changent pas).

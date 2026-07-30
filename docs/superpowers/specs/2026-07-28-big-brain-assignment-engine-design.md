# BIG BRAIN — Moteur d'affectation câbles → fourreaux (Brique A) — Design

**Date :** 2026-07-28
**Statut :** validé (design), prêt pour plan d'implémentation

## Vision d'ensemble

Un mode « BIG BRAIN » quasi full-auto pour TONTONKAD : on définit des **liaisons**
électriques (ex. `TGBT → GE`, composée de câbles), et l'app **répartit
automatiquement** les câbles dans des fourreaux adaptés (sous un taux d'occupation
max), **place** les fourreaux, **propose une chambre** si une convient, et **nomme**
les phases. L'utilisateur configure tout dans une modale dédiée, valide, et le
résultat apparaît sur le canvas.

### Pipeline (3 briques, livrables séparément)

```
Liaisons (input)   →   Cerveau d'affectation   →   Orchestration
[nom + câbles]         [câbles → fourreaux]        [placement + chambre + noms] → CANVAS
   Brique B                 Brique A                      Brique C
```

- **Brique A — Moteur d'affectation** (`src/renderer/cable-assign.js`) : module **pur
  et testé** (façon `packer.js`), aucune dépendance UI/DOM/canvas. **← objet de CE spec.**
- **Brique B — Modale « BIG BRAIN »** : saisie des liaisons + paramètres, appelle le
  moteur, restitue sur le canvas. *(spec futur)*
- **Brique C — Orchestration** : placement auto (packer existant) + suggestion de
  chambre (existant) + nommage des phases. *(spec futur)*

On construit **A d'abord** : c'est la partie novatrice et risquée, testable isolément.

## Périmètre de CE spec

**Inclus :** le module pur `cable-assign.js` + ses tests Jest.
**Exclus (specs futurs) :** modale UI, rendu/placement canvas, suggestion de chambre,
nommage des phases, import CSV Caneco. Le data model est conçu **compatible** avec un
import Caneco futur (chaque câble peut porter une `fonction`), mais l'import n'est pas
implémenté ici.

## Data model

### Entrées

```js
// Une liaison = un circuit nommé + ses câbles (issus du catalogue, avec quantité)
Liaison = {
  id: string,            // identifiant stable (ex. "L1", ou slug du nom)
  nom: string,           // ex. "TGBT → GE"
  cables: [ {
    fam: string,         // ex. "U1000 R2V"      (catalogue cables.csv)
    code: string,        // ex. "2x185" | "1x185"
    od: number,          // Ø extérieur en mm    (catalogue)
    qty: number,         // nombre de câbles identiques
    fonction?: string    // 'phase' | 'neutre' | 'PE' (optionnel ; rempli par Caneco plus tard)
  } ]
}

// Catalogue fourreaux (issu de fourreaux.csv : type;code;od;id)
Fourreau = { type: string, code: string, od: number, id: number } // id = Ø INTÉRIEUR (mm)

Options = {
  tauxMax?: number,          // taux d'occupation max, défaut 0.33 (33%)
  tailleMaxFourreauOd?: number, // borne : n'utilise que les fourreaux dont od ≤ cette valeur (défaut : pas de borne)
  typesAutorises?: string[]  // filtre optionnel de types ('TPC','IRL','ICTA'), défaut : tous
}
```

> Note d'intégration (Brique B) : à l'exécution, un fourreau placé expose son Ø
> intérieur sous `idm`. Le moteur, lui, est pur et travaille sur un tableau de
> catalogue `{type,code,od,id}` (colonne `id` de `fourreaux.csv`). La conversion
> `id ↔ idm` est la responsabilité de l'intégration, pas du moteur.

### Sortie

```js
Resultat = {
  fourreaux: [ {
    type, code, od, id,                    // le fourreau choisi
    cables: [ { liaisonId, fam, code, od, fonction } ], // câbles affectés (unités, qty déjà dépliée)
    usedArea: number,                      // Σ aires câbles (mm²)
    tauxOccupation: number                 // usedArea / aireInterieure (0..1)
  } ],
  nonPlaces: [ { liaisonId, fam, code, od, raison } ]  // câbles qu'aucun fourreau ≤ taille max ne peut accueillir
}
```

## Le « cerveau » — algorithme

### Fonctions d'occupation (pures)

- Aire d'un disque : `aire(d) = π·(d/2)²`.
- Aire intérieure d'un fourreau : `aireInt(f) = aire(f.id)`.
- Capacité utile d'un fourreau : `capacite(f) = tauxMax · aireInt(f)`.
- Un ensemble de câbles d'aire totale `A` **tient** dans `f` si `A ≤ capacite(f)`.

### Stratégie — glouton « first-fit decreasing » + cohésion de liaison + remplissage croisé

Déterministe (tous les tris sont stables, départages par identifiants), donc testable
comme `packer.js`.

**Préparation :**
1. `fourreauxEligibles` = catalogue filtré (`od ≤ tailleMaxFourreauOd` si défini ; `type ∈ typesAutorises` si défini), trié par `id` croissant (capacité croissante).
2. Pour chaque liaison, déplier ses câbles en **unités** (`qty` fois chacun), avec `area = aire(od)`.
3. Trier les liaisons par **aire totale décroissante** (départage : `liaison.id`).

**Boucle principale** — on maintient une liste de **fourreaux ouverts**
`{ fourreau, cables[], usedArea }` :

Pour chaque liaison (ordre trié) :
1. `aireLiaison` = Σ des aires de ses câbles.
2. **Regroupement croisé (priorité)** : chercher un fourreau **déjà ouvert** tel que
   `usedArea + aireLiaison ≤ capacite`. S'il y en a plusieurs, prendre **le plus rempli
   qui rentre encore** (best-fit → maximise le remplissage, laisse de la place ailleurs).
   → placer **toute** la liaison dedans.
3. Sinon, **nouveau fourreau pour la liaison entière**, choisi par **anticipation**
   (`chooseFourreauSize`, mise à jour 2026-07-30 — voir « Correctif anticipation » ci-dessous)
   plutôt que par le simple plus petit `fourreauEligible` dont `capacite ≥ aireLiaison`.
   Trouvé → l'ouvrir, y placer toute la liaison.
4. Sinon (aucun fourreau ne contient la liaison entière) → **split** :
   - trier les câbles de la liaison par aire décroissante ;
   - placer **chaque câble** un par un : d'abord dans un fourreau ouvert avec marge
     (best-fit), sinon dans un fourreau neuf choisi par la même anticipation ;
   - si même le plus gros fourreau éligible ne contient pas un câble seul → ce câble va
     dans `nonPlaces` (raison `"câble trop gros pour la taille max"`).

### Correctif anticipation (2026-07-30)

Choisir systématiquement le **plus petit** fourreau qui contient tout juste la liaison
courante (`smallestFourreauFor`) dégénérait quand plusieurs liaisons ont une aire
similaire : la 1ʳᵉ liaison ouvrait un fourreau à peine assez grand pour elle-même, sans
marge pour la 2ᵉ ; celle-ci rouvrait alors un fourreau tout aussi minimal, etc. — au lieu
du regroupement croisé visé, on obtenait **un fourreau par liaison** (ex. 10 liaisons
identiques en `3G2,5` → 10 fourreaux à 1 câble). `smallestFourreauFor` reste disponible
(toujours testé) mais n'est plus utilisé par `assignCablesToFourreaux`.

`chooseFourreauSize(items, startIndex, eligibles, tauxMax)` corrige cela en **anticipant**
le reste de la file (`items[startIndex+1..]`, d'aires ≤ celle de l'item courant puisque la
file est triée décroissante) : parmi les tailles éligibles qui contiennent l'item seul, elle
retient celle qui **minimise le nombre de fourreaux** nécessaires pour placer tout le
reste — simulé par `simulateBinCount` avec le même critère best-fit que la boucle réelle —
et, à regroupement égal, la plus petite (aucune sur-dimensionnement inutile). Une seule
liaison en attente ⇒ comportement inchangé (plus petit fourreau qui la contient).

**Sortie :** pour chaque fourreau ouvert, calculer `tauxOccupation = usedArea / aireInt`.
Retourner `{ fourreaux, nonPlaces }`.

### Alternatives écartées

- **Bin-packing optimal** (minimiser nombre/taille de fourreaux) : surdimensionné pour
  le besoin, non déterministe simplement. YAGNI.
- **Un fourreau dédié par liaison** (pas de regroupement) : gaspille de la place et
  contredit l'objectif « regrouper plusieurs circuits ».

## API du module (pattern `packer.js`)

```js
// src/renderer/cable-assign.js
window.CableAssign = {
  assignCablesToFourreaux(liaisons, catalogueFourreaux, options) -> Resultat,
  __test: { aire, capacite, expandCables, smallestFourreauFor }
};
// + module.exports pour Jest
```

Chargé dans `index.html` avant `script.js` (comme `packer.js`, `geometry.js`, etc.).

## Tests (Jest, façon `packer.test.js`)

- **Petite liaison** → placée dans le plus petit fourreau qui respecte le taux.
- **Regroupement croisé** : plusieurs petites liaisons tiennent dans **un seul** fourreau
  tant que Σ aires ≤ taux·aireInt ; une de plus ouvre un 2ᵉ fourreau.
- **Taux respecté** : aucun fourreau ne dépasse `tauxOccupation ≤ tauxMax` (à ε près).
- **Split** : une grosse liaison qui ne tient dans aucun fourreau seul est répartie sur
  plusieurs fourreaux, sans chevauchement d'affectation (chaque câble placé une fois).
- **Non plaçable** : un câble plus gros que le plus grand fourreau éligible → `nonPlaces`,
  pas de crash.
- **Borne taille max** : `tailleMaxFourreauOd` exclut bien les fourreaux trop grands.
- **Filtre types** : `typesAutorises: ['TPC']` n'utilise que des TPC.
- **Déterminisme** : deux appels identiques → résultat identique (structurellement égal).
- **Vide** : `liaisons: []` → `{ fourreaux: [], nonPlaces: [] }`.
- **Défaut** : `options` omis → `tauxMax = 0.33`, pas de borne de taille.

## Invariants / cas limites

- Chaque câble-unité apparaît **exactement une fois** dans `fourreaux` **ou** `nonPlaces`.
- `tauxMax` par défaut `0.33` ; accepte toute valeur `> 0` (l'UI la bornera, ex. 0.1–0.6).
- Catalogue fourreaux vide → tous les câbles en `nonPlaces` (raison `"aucun fourreau éligible"`).
- Le moteur ne fait **aucune** géométrie de placement 2D (ça, c'est le packer, Brique C) :
  il ne décide **que** quel câble va dans quel fourreau, sous contrainte d'aire.
```

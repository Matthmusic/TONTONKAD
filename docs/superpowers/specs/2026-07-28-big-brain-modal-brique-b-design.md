# BIG BRAIN — Modale de saisie des liaisons (Brique B) — Design

**Date :** 2026-07-28
**Statut :** validé (design), prêt pour plan d'implémentation
**Dépend de :** Brique A (`cable-assign.js`, `window.CableAssign`) — livrée.

## Position dans le pipeline

```
Liaisons (input)   →   Cerveau d'affectation   →   Orchestration
   Brique B                 Brique A                     Brique C
  ← CE spec              (livrée)                    (spec futur)
```

La Brique B fournit la **modale « BIG BRAIN »** : saisir des liaisons + paramètres,
appeler le moteur (Brique A), **créer les fourreaux remplis** (avec leurs câbles) dans
l'app, et laisser le **placement existant** les positionner.

## Périmètre

**Inclus :**
- Adaptateur PUR `src/renderer/big-brain.js` (testable Jest) : validation des liaisons + transformation du résultat moteur en objets prêts à instancier.
- Modale DOM `src/renderer/big-brain-modal.js` (disposition **maître-détail**), son HTML dans `index.html`, son CSS dans `style.css`.
- Bouton d'ouverture de la modale dans la barre d'outils.

**Exclus (specs futurs) :**
- Placement « intelligent » dédié, suggestion de chambre, nommage des phases (L1/L2/L3/N/PE) → **Brique C**.
- Import CSV Caneco.
- Persistance des liaisons dans le fichier projet (MVP = mémoire de session).

## Adaptateur pur — `big-brain.js`

Isole la logique sans DOM pour la tester.

```js
// Valide la saisie avant génération.
validateLiaisons(liaisons) -> { ok: boolean, errors: [{ index, message }] }
//   règles : ≥ 1 liaison ; chaque liaison : nom non vide, ≥ 1 câble ;
//   chaque câble : fam & code non vides, od > 0, qty entier ≥ 1.

// Transforme le résultat moteur en objets prêts à créer dans l'app.
resultToObjects(result, liaisonsById) -> {
  fourreaux: [ { type, code, od, idm, tauxOccupation, label } ],   // idm = result.fourreau.id (Ø int.)
  cables:    [ { fam, code, od, fonction, parentIndex, label } ]   // parentIndex = index du fourreau ci-dessus
}
//   liaisonsById : map { liaisonId -> nom } pour les libellés (optionnel : sinon label = liaisonId).
//   label fourreau = noms de liaisons distincts qu'il contient (ex. "TGBT → GE", ou "TGBT → GE +1").
//   label câble = nom de sa liaison.
```

`resultToObjects` est PUR : pas besoin du catalogue (le résultat moteur porte déjà
`type/code/od/id`). Le seul remappage est `id → idm` (champ runtime du fourreau).

**API module** (pattern `packer.js`) : `window.BigBrain = { validateLiaisons, resultToObjects }` + `module.exports`.

## Modale DOM — `big-brain-modal.js` (disposition maître-détail)

- **Paramètres (haut)** : taux max (défaut 33 %, champ %), taille max fourreau (select du catalogue `FOURREAUX`), types autorisés (cases TPC / IRL / ICTA).
- **Maître (gauche)** : liste des liaisons (`+ Nouvelle liaison`, sélection, renommer ✏, supprimer 🗑).
- **Détail (droite)** : nom de la liaison sélectionnée + ses câbles ; chaque câble via les **selects recherchables existants** (`fam` + `code`) + `qty` ; `+ ajouter un câble`, `–` retirer.
- **Pied** : `Annuler` · `Générer ▶` (désactivé si `validateLiaisons` échoue).

**État** : liaisons en **mémoire de session** (objet module), conservées tant que l'app tourne ; la modale les réaffiche à la réouverture.

## Flux « Générer »

```
1. Lire l'UI → liaisons[] + options { tauxMax, tailleMaxFourreauOd, typesAutorises }
2. validateLiaisons(liaisons) → si !ok : afficher les erreurs, stop.
3. result = CableAssign.assignCablesToFourreaux(liaisons, FOURREAUX, options)
4. Demander "Remplacer le plan / Ajouter au plan ?" (choix systématique).
     - Remplacer : vider fourreaux[] et cables[] (via le flux d'effacement existant).
     - Ajouter : conserver l'existant.
5. objs = resultToObjects(result, mapNomsParId)
6. Instancier : pour chaque objs.fourreaux → créer un fourreau (type/code/od/idm) dans l'app ;
   pour chaque objs.cables → créer un câble enfant (parent = fourreau créé via parentIndex).
7. Déclencher le placement existant (auto-arrange) pour positionner les fourreaux.
8. Si result.nonPlaces.length : toast/alerte « N câble(s) non placé(s) : <détail> ».
9. Fermer la modale, redraw.
```

**Points d'intégration `script.js`** (les noms exacts seront reliés dans le plan après
inspection) : création programmatique d'un fourreau, création d'un câble avec `parent`,
effacement du plan (Remplacer), auto-arrange, `showToast`, `redraw`, `saveStateToHistory`
(pour Ctrl+Z avant génération).

## Nommage (minimal en B)

- Fourreau : `label` = nom(s) de liaison. Câble : `label` = nom de liaison.
- Les **noms de phase** (L1/L2/L3/N/PE) sont hors périmètre → Brique C.

## Gestion d'erreurs / cas limites

- 0 liaison valide → bouton `Générer` désactivé.
- `nonPlaces` non vide → alerte listant les câbles non placés (l'utilisateur ajuste taux/taille max ou la liaison).
- `FOURREAUX` vide / catalogue filtré vide → tout en `nonPlaces` (géré par Brique A) → alerte.
- Génération = une opération annulable : `saveStateToHistory()` avant, donc **Ctrl+Z** revient à l'état précédent.

## Tests

- **`big-brain.js`** (adaptateur pur) — Jest :
  - `validateLiaisons` : liste vide → erreur ; nom vide → erreur ; liaison sans câble → erreur ; câble od≤0 / qty<1 → erreur ; cas valide → `ok:true, errors:[]`.
  - `resultToObjects` : mapping `id→idm` ; `parentIndex` correct (câbles rattachés au bon fourreau) ; labels résolus via `liaisonsById` (et fallback liaisonId) ; comptage câbles conservé ; `tauxOccupation` propagé.
- **Modale DOM** : vérifiée dans l'app (comme le reste de l'UI ; pas de test unitaire).

## Découpage d'implémentation

1. **B1** — `big-brain.js` (adaptateur pur) + tests. *(incrément testable, façon Brique A)*
2. **B2** — modale DOM (`big-brain-modal.js` + HTML + CSS + intégration `script.js` + bouton). *(vérifié dans l'app)*

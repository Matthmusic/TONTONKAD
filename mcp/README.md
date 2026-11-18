# Serveur MCP TONTONKAD

Permet de demander à Claude :

> « Fais-moi les masques TGBT → COFFRET 1 puis COFFRET 1 → PIT 1 à partir de
> la note de calcul `C:\Projets\X\note.xlsx`. »

Le serveur réutilise **les moteurs de l'application** (import Caneco, BIG BRAIN,
placement des fourreaux) : un masque produit ici est identique à celui que
TONTONKAD ferait à la main. Il ne fait aucun appel réseau et ne modifie jamais
un fichier existant.

## Installation (sur le PC de chaque utilisateur)

Prérequis : Node.js 18 ou plus, et une copie du dépôt TONTONKAD (le serveur lit
les catalogues `data/*.csv` du dépôt).

```bash
cd tontonkad/mcp
npm install
```

### Brancher dans Claude Code

```bash
claude mcp add tontonkad -- node /chemin/vers/tontonkad/mcp/src/server.js
```

### Brancher dans l'application de bureau Claude

Dans `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "tontonkad": {
      "command": "node",
      "args": ["C:\\chemin\\vers\\tontonkad\\mcp\\src\\server.js"]
    }
  }
}
```

Variable facultative : `TONTONKAD_DATA` = dossier des catalogues, si ce n'est
pas `data/` du dépôt.

## Comment Claude mène l'étude

Le serveur fournit à Claude des **instructions** (lues dès qu'il est branché) et
une commande **`etude_masques`** (dans Claude Code : `/mcp__tontonkad__etude_masques`).
Dans les deux cas, Claude :

1. appelle `preparer_etude` avec ce qu'il sait déjà ;
2. pose dans le chat, **en un seul message**, les questions qui manquent :
   notes de calcul (NDC), tronçons, rendu souhaité, plan, zone de la tranchée ;
3. rappelle `preparer_etude` avec les réponses, jusqu'à `pret = true` ;
4. montre les liaisons retenues par tronçon et attend la validation ;
5. génère les masques et résume dimensions, profondeur, contrôles de conformité.

Rendus : AutoCAD, ZWCAD, DXF et PDF avec vue 3D sont disponibles ; MultiCAD
(masques posés sur le plan DWG) passe par le MCP MultiCAD s'il est branché ;
Revit est prévu et signalé comme indisponible pour l'instant.

## Outils

| Outil | Rôle |
|---|---|
| `preparer_etude` | À appeler en premier : vérifie les fichiers et les tronçons fournis, renvoie les questions à poser pour ce qui manque. |
| `lire_note_calcul` | Liste les liaisons d'une note Caneco (.xls/.xlsx) : référence `L<n° de ligne>`, origine, destination, câble, longueur. Filtres possibles. |
| `generer_masques` | Un masque par tronçon : choix et placement des fourreaux, répartition des câbles avec leurs phases, profondeur de fouille et grillage avertisseur. Renvoie la **géométrie** (mm) et écrit un **DXF** si `sortieDxf` est donné. |
| `regles_normes` | Affiche les règles normatives appliquées et leurs sources. |

### Trouver les liaisons d'un tronçon

Chaque masque reçoit une ou plusieurs recherches :

- `{ "origine": "TGBT", "destination": "COFFRET 1" }` : l'origine doit être
  exactement `TGBT` ; la destination est cherchée **par mots entiers**
  (« COFFRET 1 » trouve « COFFRET 1 ECLAIRAGE » mais jamais « COFFRET 10 ») ;
- `{ "refs": ["L12", "L13"] }` : références exactes renvoyées par `lire_note_calcul` ;
- `{ "texte": "PIT 1" }` : texte libre.

Les liaisons trouvées par plusieurs recherches ne sont comptées qu'une fois.

### Géométrie renvoyée

Unités : mm. Repère : Y vers le haut, origine = coin bas-gauche du masque
(fond de fouille pour une tranchée).

```text
masque
├─ largeur, hauteur        nappe (lit de pose compris) ; diamètre pour un conduit
├─ tranchee                profondeur (fond → terrain fini), recouvrement,
│                          grillage { y, couleur, aci }, conformite[]
├─ fourreaux[]             id (F1…), type, code, od, di, x, y (centre), libelle, taux
├─ cables[]                fourreau, liaison, fam, code, od, phase, x, y (centre)
└─ avertissements[]        à relire avant de livrer
```

C'est ce format qu'un MCP de CAO (MultiCAD / nanoCAD) dessine : cercles
`od`/`di` pour chaque fourreau, un cercle par câble, une ligne pour le grillage,
le cadre de la tranchée, translatés au point d'insertion repéré sur le plan.

### PDF avec vue 3D

`sortiePdf` écrit une planche A4 paysage par masque : la coupe à l'échelle, une
vue 3D du tronçon en perspective cavalière (fourreaux en cylindres, grillage
avertisseur, parois de la tranchée ; longueur réglable avec `longueur3dMm`,
1,5 m par défaut), la légende des fourreaux, la profondeur et les contrôles de
conformité. La vue 3D est un dessin, pas un modèle 3D manipulable.

### DXF

R12 (AC1009), calques identiques à l'export de l'application (`_CEAI_BOITE`,
`_CEAI_COTES`, `_CEAI_FOURREAU_<type>_<code>`, `_CEAI_CABLE_<fam>_<code>_<phase>`)
plus `_CEAI_GRILLAGE_<couleur>` et `_CEAI_TEXTES`. Options : `unite` (`mm` ou
`m`, selon l'unité du plan) et `origine` (point d'insertion). Un fichier
existant n'est jamais écrasé.

## Normes appliquées (à valider)

- **NF P 98-331** (tranchées) : recouvrement minimal au-dessus des fourreaux
  selon la zone — 800 mm sous chaussée, 600 mm sous trottoir, espace vert ou
  terrain privé.
- **NF T 54-080**, annulée et remplacée par **NF EN 12613** (dispositifs
  avertisseurs) : grillage de la couleur du réseau (rouge pour l'électricité),
  200 à 300 mm au-dessus des fourreaux.
- Distances entre réseaux parallèles (**NF P 98-332**) : pas encore traitées.

Ces valeurs viennent de guides publics, pas du texte AFNOR officiel : chaque
contrôle porte `aValider: true`. Elles sont regroupées dans `src/normes.js` et
surchargeables par masque (`zone`, `recouvrementMm`, `grillageAuDessusMm`,
`profondeurFouilleMm`, `reseau`).

## Essai

```bash
npm test --prefix ..        # tests du cœur (tests/mcp-masque.test.js)
node test/smoke.js          # bout en bout par le protocole MCP, note d'essai générée
```

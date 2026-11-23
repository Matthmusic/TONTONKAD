# Serveur MCP TONTONKAD

Permet de demander à Claude :

> « Fais-moi les masques TGBT → COFFRET 1 puis COFFRET 1 → PIT 1 à partir de
> la note de calcul `C:\Projets\X\note.xlsx`. »

Le serveur réutilise **les moteurs de l'application** (import Caneco, BIG BRAIN,
placement des fourreaux) : un masque produit ici est identique à celui que
TONTONKAD ferait à la main. Il ne fait aucun appel réseau et ne modifie jamais
un fichier existant.

## Installation

**Depuis TONTONKAD 2.8.2, le serveur est livré avec l'application.** Dans
TONTONKAD : *Paramètres › Claude (serveur MCP) › Brancher à Claude*, puis
redémarrer l'application Claude. Il tourne avec l'exécutable de TONTONKAD en
mode Node (`ELECTRON_RUN_AS_NODE=1`) : ni dépôt ni Node.js à installer, et il
se met à jour avec l'application. Pour Claude Code, le même panneau donne la
commande `claude mcp add …` à copier.

### Installation manuelle depuis le dépôt (développement)

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
| `etudier_reseau` | Un **réseau complet** en un appel : éléments (chambres, coffrets/tableaux, sorties) et tronçons (liaisons de la note, réserves, longueur, faces). Renvoie la coupe de chaque tronçon, l'étude de chaque chambre (préfabriquée ou maçonnée, traversées, arrêts), le contrôle des coffrets, la continuité des liaisons et le métré ; PDF (synoptique 2D, isométrique, métré, coupes, chambres) et DXF. |
| `regles_normes` | Affiche les règles normatives appliquées et leurs sources. |

`generer_masques` et `etudier_reseau` acceptent `cad: true` (commandes multiCAD)
et `placements` (position et rotation de chaque dessin sur le plan).

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

Pour une tranchée, une **page « chambre de tirage »** suit : la chambre Stradal
choisie comme dans l'application (`compat-chambres.js` : entrée par le pignon
d'abord, sinon par le long-pan), dessinée en volume intérieur, avec les
fourreaux du masque qui arrivent sur la face d'entrée. Option `chambre` pour
imposer une référence (ex. `"L2T"`). Seules les cotes intérieures du catalogue
sont connues : épaisseur des parois, cadre et tampon ne sont pas dessinés.

### Chambre à plusieurs faces (traversées)

Le paramètre `chambres` de `generer_masques` décrit quel masque arrive sur
quelle face d'une chambre, vue de dessus : `pignonA` (gauche), `pignonB`
(droite), `longPanA` (bas), `longPanB` (haut).

```json
"chambres": [{ "nom": "Chambre C1",
  "faces": { "pignonA": "Arrivée TGBT", "pignonB": "Vers COFFRET 1", "longPanB": "Vers COFFRET 2" } }]
```

- la chambre retenue est la plus petite où **chaque masque tient dans sa face**
  (largeur du pignon ou du long-pan, hauteur utile) ; `ref` pour l'imposer ;
- une liaison présente dans deux masques **traverse** la chambre : en ligne
  droite (faces opposées) ou en angle (rayon de courbure à vérifier) ; un
  changement de diamètre de fourreau est indiqué ;
- une liaison présente sur une seule face **s'arrête** dans la chambre ;
- le PDF ajoute une **vue de dessus** : fourreaux sur chaque face, traversées
  numérotées et colorées, légende.

- **chambre maçonnée** : ajouter `"maconnee": { "paroi": 200, "tampon": { "L": 600, "l": 600, "classe": "D400" }, "zone": "chaussee" }`
  (tout est facultatif). Les cotes intérieures sont déduites des nappes, le
  nombre de tampons de la longueur, et la classe du tampon est contrôlée
  selon la zone (NF EN 124). Sans préfabriquée qui convienne, la maçonnée est
  proposée d'office. **Valeurs par défaut à valider.**

Démo : `node test/chambre-demo.js sortie.pdf`.

### DXF

R12 (AC1009), calques identiques à l'export de l'application (`_CEAI_BOITE`,
`_CEAI_COTES`, `_CEAI_FOURREAU_<type>_<code>`, `_CEAI_CABLE_<fam>_<code>_<phase>`)
plus `_CEAI_GRILLAGE_<couleur>` et `_CEAI_TEXTES`. Options : `unite` (`mm` ou
`m`, selon l'unité du plan) et `origine` (point d'insertion). Un fichier
existant n'est jamais écrasé.

### Dessin sur un plan DWG avec le MCP multiCAD

[multiCAD-mcp](https://github.com/AnCode666/multiCAD-mcp) pilote AutoCAD,
ZWCAD, GstarCAD et BricsCAD (Windows, COM). Avec `cad: true`, la réponse
contient un objet `multicad` :

- `calques` : une commande `create|<calque>|<couleur>|25` par ligne, à passer
  à **`manage_layers`** ;
- `blocs` : un dessin par coupe (« Coupe TGBT → C1 ») et par chambre
  (« Chambre C1 »), avec ses `commandes` (`line|…`, `circle|…`,
  `polyline|…`, `text|…`, en mm) à passer à **`draw_entities`**.

Base des dessins : une coupe part du coin bas-gauche du fond de fouille ; une
chambre est centrée sur son intérieur, pignon A vers −X, long-pan B vers +Y.
`placements` les pose sur le plan :

```json
"placements": { "Chambre C1": { "x": 152340, "y": 48210, "rotation": 35 },
                "Coupe TGBT → C1": { "x": 160000, "y": 40000 } }
```

Claude demande ces points à l'utilisateur (ou les lit sur le plan si multiCAD
le permet). Les textes restent horizontaux (multiCAD ne prend pas d'angle de
texte). **Non testé sur une vraie installation AutoCAD : premier essai à faire
sur un plan de test.** Sans multiCAD, `sortieDxf` donne les mêmes dessins en
DXF R12 à insérer à la main.

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
node test/reseau-demo.js    # etudier_reseau : réseau complet, PDF, DXF et commandes multiCAD
```

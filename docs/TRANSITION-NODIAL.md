# Transition TONTONKAD → nodial

Objectif : chaque poste équipé de TONTONKAD passe à **nodial v0.0.1** (nouveau dépôt, nouvelle
identité), sans perdre ses réglages, sans manipulation compliquée, et sans deux applications
qui cohabitent durablement.

## Les trois versions

| Version | Dépôt | Rôle |
|---|---|---|
| **TONTONKAD 2.9.0** | `Matthmusic/TONTONKAD` | Dernière vraie version de TONTONKAD : interface déjà aux couleurs de nodial, code de reprise des données embarqué (sans effet sous TONTONKAD). |
| **TONTONKAD 3.0.0** | `Matthmusic/TONTONKAD` | **Version de bascule**, publiée le jour de la sortie de nodial 0.0.1. Arrive par la mise à jour automatique ; affiche « TONTONKAD devient nodial. Merci d'avoir utilisé TONTONKAD ! » et un lien de téléchargement de nodial. |
| **nodial 0.0.1** | nouveau dépôt nodial | Application nodial : `appId`, nom, dossier de données, mises à jour et fiche CEA App Store qui lui sont propres. |

Pourquoi une bascule : la mise à jour automatique (electron-updater) n'installe jamais une version
plus basse. Un poste en 2.9.0 ne verrait jamais une « 0.0.1 ». C'est donc la 3.0.0, publiée sur
l'ancien dépôt, qui fait le pont.

## Identité de nodial 0.0.1

| Réglage | TONTONKAD | nodial |
|---|---|---|
| `package.json` `name` / `build.productName` | `tontonkad` / `TONTONKAD` | `nodial` / `nodial` |
| `build.appId` | `com.tontonkad.app` | **`nodial`** — nodial s'installe à côté de TONTONKAD (pas de mise à jour en place) |
| Dossier de données | `%APPDATA%\TONTONKAD` | `%APPDATA%\nodial` (repris au 1er lancement, voir plus bas) |
| Exécutable | `C:\Program Files\TONTONKAD\TONTONKAD.exe` | `C:\Program Files\nodial\nodial.exe` |
| Installeur | `TONTONKAD-Setup-x.exe` | `nodial-Setup-x.exe` |
| `build.publish` | `Matthmusic/TONTONKAD` | `Matthmusic/nodial-releases` (public) |
| Serveur MCP | `tontonkad` | `nodial` — l'ancienne inscription est retirée au branchement (déjà en place) |
| Fichiers projet | `.tontonkad` | `.nodial`, et `.tontonkad` toujours ouvert (déjà en place) |

## ⚠️ Dépôt privé : les postes doivent pouvoir télécharger

Un dépôt GitHub **privé** ne laisse télécharger ses releases qu'avec un jeton. Ni la mise à
jour automatique de nodial, ni le CEA App Store, ni la bascule 3.0.0 ne pourront récupérer
l'installeur. Il ne faut **jamais** mettre de jeton GitHub dans l'application : n'importe quel
utilisateur pourrait l'extraire.

Solution habituelle : **code privé, diffusion publique.**

- `Matthmusic/nodial` (privé) : le code source.
- `Matthmusic/nodial-releases` (public, vide de code) : les releases (`nodial-Setup-x.exe`,
  `latest.yml`, `.blockmap`) et `cea-app.json`. electron-builder y publie avec
  `"publish": { "provider": "github", "owner": "Matthmusic", "repo": "nodial-releases" }` ;
  le jeton de publication ne sert qu'en CI, chez toi.

Une autre possibilité : un serveur de fichiers interne (`"provider": "generic"`).

## Reprise des données (déjà dans le code, `src/main/transition-nodial.js`)

Au premier lancement de nodial, si `%APPDATA%\TONTONKAD` existe, on recopie dans `%APPDATA%\nodial` :

- `config.json` : un dossier de catalogues qui pointait dans l'ancien `%APPDATA%` est redirigé
  vers la copie ; un dossier réseau ou personnalisé reste tel quel ;
- `data\` : catalogues CSV, y compris les modifications de l'utilisateur ;
- `Local Storage\` : thème, cartouche, infos PDF, état des panneaux.

Les règles de la reprise :
- l'ancien dossier n'est jamais modifié ;
- ce que nodial possède déjà n'est jamais écrasé ;
- un marqueur `reprise-tontonkad.json` empêche de recommencer ;
- un message confirme la reprise à l'utilisateur.

Les projets eux-mêmes sont des fichiers choisis par l'utilisateur : ils ne bougent pas.

## Déroulé de la bascule (TONTONKAD 3.0.0)

1. Le jour J, on publie nodial 0.0.1 dans `nodial-releases`, puis TONTONKAD 3.0.0 dans `TONTONKAD`.
2. Les postes reçoivent la 3.0.0 par la mise à jour habituelle.
3. Au lancement, la 3.0.0 affiche « **TONTONKAD devient nodial.** Merci d'avoir utilisé TONTONKAD ! »
   et un bouton qui ouvre la page de téléchargement :
   `https://github.com/Matthmusic/nodial-releases/releases/latest`.
   On peut aussi pointer vers la fiche nodial du CEA App Store.
4. L'utilisateur installe nodial, qui reprend ses réglages et catalogues au premier lancement. Le
   branchement MCP retire l'ancienne inscription « tontonkad ».
5. TONTONKAD peut ensuite être désinstallé depuis Windows ou depuis le store. Tant qu'il ne l'est
   pas, les deux applications coexistent sans conflit : dossiers et `appId` distincts.

## Workflow : build privé, release publique

Le workflow actuel (`.github/workflows/build.yml`) publie dans le dépôt où il tourne, avec
`GITHUB_TOKEN`. Ce jeton n'a aucun droit sur un autre dépôt. Le modèle
`docs/nodial/build.yml`, à copier dans le dépôt nodial, change trois choses :

- `electron-builder --publish never` : le build ne publie rien lui-même, mais l'app embarque
  quand même l'adresse de `nodial-releases` pour ses mises à jour ;
- la release est créée dans `Matthmusic/nodial-releases` avec un secret `RELEASES_TOKEN`. C'est
  un jeton *fine-grained* limité à ce seul dépôt, avec la permission Contents en lecture-écriture ;
- `cea-app.json` et l'icône sont recopiés sur `main` de `nodial-releases`, où le store les lit.
  Les notes de release sont tirées du changelog de `cea-app.json`.

On continue à pousser un tag `v0.0.1` sur le dépôt de build, exactement comme aujourd'hui.

## CEA App Store

- **Nouvelle fiche `nodial`** : un nouveau `cea-app.json` avec `id: "nodial"`, servi depuis
  `nodial-releases` (public). Il faut ajouter ce dépôt au catalogue du store.
- **Fiche `tontonkad`** : version 3.0.0, description « Remplacée par nodial », lien vers la
  fiche nodial. Elle reste visible le temps de la transition, puis on la retire du catalogue.
- La détection de nodial porte sur `C:\Program Files\nodial\nodial.exe`, `%APPDATA%\nodial` et
  la clé de désinstallation nodial. Ne pas y mettre les chemins TONTONKAD : la fiche nodial
  paraîtrait installée avant la bascule.

## Calendrier

1. **Maintenant** : publier TONTONKAD 2.9.0, puis créer `nodial` (privé) et `nodial-releases`
   (public) à partir de la branche actuelle.
2. **nodial 0.0.1** : `appId` `nodial`, nom, icônes du kit, charte, `publish` vers
   `nodial-releases`, workflow `docs/nodial/build.yml`. Faire le test « poste neuf » et le test
   « poste avec TONTONKAD 2.9.0 ».
3. **Pilote** : quelques postes installent nodial à la main depuis le store et vérifient la reprise.
4. **Jour J** : nodial 0.0.1 puis TONTONKAD 3.0.0 (écran « TONTONKAD devient nodial » + lien).
5. **Après quelques semaines** : retirer la fiche TONTONKAD du store, archiver le dépôt TONTONKAD.
   Ne pas le supprimer : les postes restés en 2.x y cherchent leurs mises à jour.

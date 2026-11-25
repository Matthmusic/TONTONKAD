# Transition TONTONKAD → nodial

Objectif : chaque poste équipé de TONTONKAD passe à **nodial v0.0.1** (nouveau dépôt, nouvelle
identité), sans perdre ses réglages, sans manipulation compliquée, et sans deux applications
qui cohabitent durablement.

## Les trois versions

| Version | Dépôt | Rôle |
|---|---|---|
| **TONTONKAD 2.9.0** | `Matthmusic/TONTONKAD` | Dernière vraie version de TONTONKAD : interface déjà aux couleurs de nodial, code de reprise des données embarqué (sans effet sous TONTONKAD). |
| **TONTONKAD 3.0.0** | `Matthmusic/TONTONKAD` | **Version de bascule.** Arrive par la mise à jour automatique habituelle ; son seul travail est d'installer nodial 0.0.1. |
| **nodial 0.0.1** | nouveau dépôt nodial | Application nodial : `appId`, nom, dossier de données, mises à jour et fiche CEA App Store qui lui sont propres. |

Pourquoi une bascule : la mise à jour automatique (electron-updater) n'installe jamais une version
plus basse. Un poste en 2.9.0 ne verrait jamais une « 0.0.1 ». C'est donc la 3.0.0, publiée sur
l'ancien dépôt, qui fait le pont.

## Identité de nodial 0.0.1

| Réglage | TONTONKAD | nodial |
|---|---|---|
| `package.json` `name` / `build.productName` | `tontonkad` / `TONTONKAD` | `nodial` / `nodial` |
| `build.appId` | `com.tontonkad.app` | **nouveau** (ex. `fr.cea.nodial`) — nodial s'installe à côté, puis TONTONKAD est retiré |
| Dossier de données | `%APPDATA%\TONTONKAD` | `%APPDATA%\nodial` (repris au 1er lancement, voir plus bas) |
| Exécutable | `C:\Program Files\TONTONKAD\TONTONKAD.exe` | `C:\Program Files\nodial\nodial.exe` |
| Installeur | `TONTONKAD-Setup-x.exe` | `nodial-Setup-x.exe` |
| `build.publish` | `Matthmusic/TONTONKAD` | dépôt de diffusion nodial (voir « Dépôt privé ») |
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

1. Le poste reçoit la 3.0.0 par la mise à jour habituelle.
2. Au démarrage, une fenêtre annonce « TONTONKAD devient nodial » et propose **Installer nodial** :
   - l'app télécharge `nodial-Setup-0.0.1.exe` depuis `nodial-releases` ;
   - elle contrôle l'empreinte sha512 annoncée par `latest.yml` ;
   - elle lance l'installeur, puis se ferme.
3. nodial démarre : il reprend les données, puis branche le MCP (ce qui retire « tontonkad »).
4. nodial propose **Désinstaller TONTONKAD**. L'app lance le désinstalleur d'origine, et Windows
   demande la validation administrateur, car l'installation est « pour tous les utilisateurs ».
   L'utilisateur peut refuser : les deux apps coexistent alors sans conflit (dossiers et
   `appId` distincts).
5. Si l'utilisateur ferme la fenêtre de la 3.0.0, TONTONKAD continue de fonctionner, et la
   fenêtre réapparaît au lancement suivant. Il ne faut pas bloquer quelqu'un en plein rendu.

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
2. **nodial 0.0.1** : nouvel `appId`, nom, icônes du kit, charte, `publish` vers
   `nodial-releases`, écran « Désinstaller TONTONKAD ». Faire le test « poste neuf » et le test
   « poste avec TONTONKAD 2.9.0 ».
3. **Pilote** : quelques postes installent nodial à la main depuis le store et vérifient la reprise.
4. **TONTONKAD 3.0.0** : publier la bascule ; le parc passe à nodial au fil des démarrages.
5. **Après quelques semaines** : retirer la fiche TONTONKAD du store, archiver le dépôt TONTONKAD.
   Ne pas le supprimer : les postes restés en 2.x y cherchent leurs mises à jour.

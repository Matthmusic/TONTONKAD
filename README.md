# TONTONKAD v2.4.8

Application de bureau (Electron) pour concevoir et dimensionner chemins de câbles, fourreaux et boîtes électriques avec un rendu 2D interactif.

## Obtenir l'application
- Téléchargez l'installateur Windows (.exe) depuis la page [GitHub Releases](https://github.com/Matthmusic/TONTONKAD/releases) du projet, puis lancez-le. C'est la seule méthode d'installation recommandée et distribuée.
- Les mises à jour sont proposées automatiquement depuis les releases : au démarrage, l'application vérifie s'il existe une nouvelle version et vous guide pour l'installer.

## Prise en main rapide (après installation)
1) Ouvrez TONTONKAD depuis le menu Démarrer.
2) Créez un projet ou chargez-en un existant.
3) Placez vos chemins de câbles, fourreaux et boîtes via le canvas (drag & drop, zoom, grille).
4) Contrôlez les taux d'occupation et ajustez les dimensions en direct.
5) Exporte : PDF pour le partage, DXF pour AutoCAD, JSON pour réimporter vos projets.

## Fonctionnalités clés
- Dimensionnement précis : calculs automatiques des taux d'occupation, contrôle des diamètres et sections, alertes visuelles.
- Conception visuelle : canvas 2D avec interactions fluides (drag & drop, sélection multiple, undo/redo, grille).
- Exports multiples : PDF pour les revues, DXF pour AutoCAD, JSON pour archiver ou collaborer.
- Gestion de projets : sauvegarde/chargement local, reprises rapides, thèmes clair/sombre.
- Productivité : raccourcis clavier (Ctrl+N/O/S, Ctrl+Z/Shift+Z, Ctrl+G pour la grille, Ctrl+T pour le thème).

## Données métiers embarquées
- `data/cables.csv` : catalogue de câbles pour le dimensionnement.
- `data/fourreaux.csv` : référentiel de fourreaux et conduits circulaires.
- `data/chemins_de_cable.csv` : goulottes et chemins de câbles rectangulaires.
- Ces référentiels sont packagés avec l'application pour garantir des calculs cohérents et reproductibles.

## Architecture en bref
- Electron (processus principal + preload sécurisé) et renderer en JavaScript natif.
- Canvas API pour le rendu 2D et la simulation physique légère.
- jsPDF pour la génération de PDF, export DXF intégré pour AutoCAD.
- `electron-updater` pour les mises à jour distribuées via GitHub Releases.

## Support et retours
- Questions, bugs ou idées : ouvrez une issue sur GitHub.
- Vous pouvez aussi consulter `CHANGELOG.md` et `CHANGELOG-V2.md` pour suivre l'évolution de la v2.

## Licence
MIT. Voir `LICENSE` pour le détail.

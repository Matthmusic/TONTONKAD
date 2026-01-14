# Changelog

Toutes les modifications notables de ce projet seront document?es dans ce fichier.

Le format est bas? sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adh?re ? [Semantic Versioning](https://semver.org/lang/fr/).

## [2.4.8] - 2026-01-14

### Ajoute
- Inclusion des assets ico dans le build.
- Ajout d'une sidebar personnalisee pour l'installeur.

### Modifie
- Mise a jour des versions et metadonnees associees a la release.

## [2.4.7] - 2026-01-14

### Ajout?
- Option de cr?ation de dossier depuis la liste des dossiers dans la modale projets.

### Modifi?
- Mise ? jour des versions et m?tadonn?es associ?es ? la release.

## [2.4.6] - 2025-12-30

### Ajouté
- 📦 **Intégration CEA App Store** : Ajout du fichier `cea-app.json` pour permettre la découverte et l'installation via le CEA App Store
- 🔍 **Métadonnées enrichies** : Description complète, tags de recherche, et informations de détection d'installation

### Modifié
- 📝 **Documentation** : Amélioration des métadonnées du projet pour une meilleure visibilité

## [2.0.0] - 2025-01-14

### Ajouté
- 🎉 **Version Electron** : Application de bureau multi-plateforme
- 💾 **Système de fichiers natif** : Sauvegarde et chargement de projets via dialogues natifs
- 🔄 **Mises à jour automatiques** : Système de mise à jour intégré via GitHub Releases
- 📋 **Menu natif** : Menu application avec raccourcis clavier système
- 🚀 **CI/CD GitHub Actions** : Build et release automatiques pour Windows, Linux, macOS
- 📦 **Assets locaux** : Font Awesome embarqué (plus de dépendance CDN)
- 🔒 **Sécurité renforcée** : Context isolation et preload script sécurisé
- 📂 **Export amélioré** : Dialogues natifs pour l'export PDF et DXF

### Modifié
- ♻️ **Architecture** : Séparation main process / renderer process
- 🎨 **Interface** : Adaptation pour environnement desktop
- 📝 **Gestion des projets** : Fichiers JSON au lieu de LocalStorage
- 🔧 **Configuration** : Electron-builder pour le packaging multi-plateforme

### Technique
- Electron 32.2.8
- electron-updater 6.3.9
- electron-builder 25.1.8
- Node.js 20+
- Support Windows, Linux (AppImage), macOS (DMG)

## [1.0.0] - 2024

### Version initiale (PWA)
- Interface web progressive (PWA)
- Calcul de dimensionnement de câbles et fourreaux
- Export PDF et DXF
- Visualisation 2D avec Canvas
- LocalStorage pour la persistance
- Thème sombre/clair
- Service Worker pour mode hors ligne

---

## Types de changements

- `Ajouté` pour les nouvelles fonctionnalités
- `Modifié` pour les changements aux fonctionnalités existantes
- `Déprécié` pour les fonctionnalités qui seront supprimées
- `Supprimé` pour les fonctionnalités supprimées
- `Corrigé` pour les corrections de bugs
- `Sécurité` pour les correctifs de vulnérabilités

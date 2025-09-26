# CLAUDE - Contexte du projet TontonKAD

## Vue d'ensemble
Application web PWA professionnelle pour la simulation et l'organisation de fourreaux électriques en multitubulaires.
- Simulateur de multitubulaires avec algorithmes avancés
- Calcul d'occupation des fourreaux rectangulaires et circulaires
- Visualisation 2D interactive haute résolution avec moteur physique
- Interface responsive avec panneau redimensionnable
- Système de projets avec sauvegarde/import/export
- Palette de couleurs AutoCAD intégrée

## Structure des fichiers (vérifiée le 2025-09-24)
```
TONTONKAD_DEV/
├── .claude/                          # Configuration Claude Code
├── .git/                             # Dépôt Git
├── .gitignore                        # Exclusions Git
├── .vscode/                          # Configuration VS Code
├── app/                              # Application web principale
│   ├── data/                         # Données CSV locales
│   │   ├── cables.csv                # Spécifications câbles (364 lignes, 8kb)
│   │   ├── fourreaux.csv             # Spécifications fourreaux (24 lignes, 1kb)
│   │   └── chemins_de_cable.csv      # Chemins de câbles (10 lignes, 1kb)
│   ├── index.html                    # Interface principale (677 lignes)
│   ├── style.css                     # Styles CSS (2594 lignes)
│   ├── script.js                     # Logique principale (5192 lignes)
│   ├── dimension-button-handler.js   # Gestion UI dimensionnement (300 lignes)
│   ├── sw.js                         # Service Worker PWA (118 lignes)
│   ├── manifest.json                 # Manifest PWA avec shortcuts
│   ├── TONTONKAD.svg                 # Logo SVG (13.8kb)
│   └── ICONS_TODO.md                 # TODO list pour icônes
├── server.py                         # Serveur développement Python avec CORS
├── TONTONKAD.bat                     # Script lancement Windows avec auto-install Python
├── README.md                         # Documentation utilisateur complète
└── CLAUDE.md                         # Ce fichier (contexte pour Claude)
```

## Commandes de développement
- **Lancement principal**: Double-clic sur `TONTONKAD.bat` (installation Python automatique)
- **Lancement développeur**: `python server.py`
- **URL locale**: http://localhost:8000
- **Port par défaut**: 8000 (avec fallback si occupé)
- **Développement**: Modifier directement les CSV dans `/app/data/` (pas de dossier /data/ séparé)

## Technologies
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla (aucune dépendance externe)
- **Canvas**: Rendu 2D haute résolution avec devicePixelRatio
- **PWA**: Progressive Web App complète avec Service Worker
- **Moteur physique**: Gravité (0.25), friction (0.98), collisions (8 itérations)
- **Données**: Format CSV pour flexibilité configuration
- **Cache**: Service Worker avec stratégie Cache-First

## Fonctionnalités principales

### 🏗️ Simulation de multitubulaires
- Algorithme de grille adaptative avec arrangement réaliste
- Tri intelligent : gros fourreaux en bas, petits en haut
- Centrage automatique et espacement configurable (30mm)
- Placement depuis le bas selon logique multitubulaire

### 🎮 Interface interactive
- Canvas haute résolution avec zoom/pan
- Manipulation tactile et souris
- Modes : placement, sélection, suppression, édition
- Panneau redimensionnable avec splitter

### 💾 Gestion de projets
- Sauvegarde/chargement projets nommés
- Auto-sauvegarde toutes les 30 secondes
- Import/export JSON pour partage
- LocalStorage pour persistance

### 📊 Calculs avancés
- Occupation fourreaux rectangulaires/circulaires
- Coefficient de foisonnement
- Simulation physique des câbles
- Validation contraintes réglementaires

### 🎨 Système visuel
- Palette AutoCAD (256 couleurs)
- Rendu haute qualité
- Responsive design
- Thème professionnel

## Raccourcis clavier
- **Ctrl+G**: Arrangement grille multitubulaire
- **Ctrl+X**: Geler/dégeler tous éléments
- **Ctrl+S**: Sauvegarder projet
- **Ctrl+C/V**: Copier/coller
- **Delete**: Supprimer sélection

## Algorithmes avancés

### Grille multitubulaire
1. Calcul automatique dimensions optimales
2. Tri par diamètre décroissant (réalisme)
3. Placement depuis bas avec centrage horizontal
4. Espacement uniforme configurable
5. Fallback méthode classique si erreur

### Moteur physique
- Gravité : 0.25 (équilibre réalisme/performance)
- Friction : 0.98 pour amortissement naturel
- 8 itérations collision pour précision maximale
- Masse dynamique avec coefficient 0.02

## Performance et qualité

### Métriques code
- **script.js**: 5192 lignes (cœur application)
- **style.css**: 2594 lignes (interface complète)
- **dimension-button-handler.js**: 300 lignes (gestion UI)
- **index.html**: 677 lignes (interface)
- **sw.js**: 118 lignes (service worker)
- **Total app**: ~8881 lignes JavaScript/CSS/HTML
- **Aucune dépendance externe** (autonomie complète)

### Optimisations
- Canvas high-DPI avec devicePixelRatio
- Headers anti-cache pour développement
- Preload ressources critiques
- Service Worker intelligent
- LocalStorage optimisé

## Notes de développement
- **Version courante**: v1.0.3 (interface améliorée et optimisations)
- **Développement actif**: Septembre 2025
- **Architecture**: Modulaire avec séparation concerns
- **Compatibilité**: Tous navigateurs modernes
- **Installation**: Zero-config avec TONTONKAD.bat
- **Débogage**: Console développeur avec logs détaillés

## Bonnes pratiques de développement

### Hiérarchie z-index (IMPORTANT)
Toujours respecter cette échelle pour éviter les conflits d'affichage :
- **1-9** : Éléments de base (cartes, panneaux, layouts)
- **10-99** : Éléments surélevés (boutons, contrôles, tooltips)
- **100-999** : Overlays et modales (notifications, dialogues)
- **1000-9999** : Dropdowns et menus contextuels (toujours visibles)

**Jamais de valeurs > 9999** - Utiliser cette hiérarchie logique pour maintenir l'ordre.

### Interface utilisateur
- **Dropdowns flottants** : Position absolute avec z-index 1000+
- **Recherche clavier** : Filtrage temps réel sur input
- **Cohérence visuelle** : Même style que les select natifs
- **Pas de débordement** : box-sizing: border-box sur inputs

## Cas d'usage professionnels
- **Électriciens**: Calcul rapide occupation, optimisation installations
- **Bureaux d'études**: Dimensionnement infrastructures, plans techniques
- **Formation**: Apprentissage règles, simulation interactive
- **Validation**: Configurations avant installation terrain
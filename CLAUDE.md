# CLAUDE - Contexte du projet TontonKAD

## Vue d'ensemble
Application web PWA pour l'organisation de fourreaux et câbles électriques.
- Calcul d'occupation des fourreaux
- Visualisation 2D interactive
- Interface responsive avec panneau redimensionnable

## Structure des fichiers (vérifiée le 2025-09-05)
```
TONTONKAD_DEV/
├── app/
│   ├── index.html                    # Page principale
│   ├── style.css                     # Styles CSS
│   ├── script.js                     # Logique principale
│   ├── dimension-button-handler.js   # Gestion boutons dimensionnement  
│   ├── sw.js                         # Service Worker PWA
│   ├── manifest.json                 # Manifest PWA
│   └── TONTONKAD.svg                 # Logo
├── data/
│   ├── cables.csv                    # Données des câbles
│   ├── fourreaux.csv                 # Données des fourreaux
│   └── chemins_de_cable.csv          # Chemins des câbles
├── server.py                         # Serveur de développement Python
├── start.bat                         # Script de lancement Windows
├── README.md                         # Documentation utilisateur
└── CLAUDE.md                         # Ce fichier (contexte pour Claude)
```

## Commandes de développement
- **Lancement**: `python server.py` ou `start.bat` ou Live Server (VS Code)
- **URL locale**: http://localhost:8000
- **Port par défaut**: 8000
- **Développement**: Modifier les CSV dans `/data/` pour la configuration

## Technologies
- HTML5 + CSS3 + JavaScript vanilla
- Canvas pour visualisation 2D
- PWA (Progressive Web App)
- Données CSV pour configuration
- Service Worker pour cache hors ligne

## Fonctionnalités clés
- Sélection forme (rectangulaire/circulaire)
- Calcul automatique d'occupation des fourreaux
- Interface graphique interactive avec Canvas
- Panneau de contrôle redimensionnable
- Cache hors ligne via Service Worker
- Compatible PWA (installable)

## Notes de développement
- Interface responsive (mobile/tablette/desktop)
- Sécurité CSP configurée
- Optimisations de performance (preload)
- Projet en développement actif (dernière vérification: sept 2025)
- Structure de fichiers simple et claire
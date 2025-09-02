# CLAUDE - Contexte du projet TontonKAD

## Vue d'ensemble
Application web PWA pour l'organisation de fourreaux et câbles électriques.
- Calcul d'occupation des fourreaux
- Visualisation 2D interactive
- Interface responsive avec panneau redimensionnable

## Structure des fichiers
```
TONTONKAD_DEV/
├── app/
│   ├── index.html              # Page principale
│   ├── style.css               # Styles CSS
│   ├── script.js               # Logique principale
│   ├── dimension-button-handler.js # Gestion boutons dimensionnement  
│   ├── sw.js                   # Service Worker PWA
│   ├── manifest.json           # Manifest PWA
│   └── TONTONKAD.svg           # Logo
├── data/
│   ├── cables.csv              # Données des câbles
│   ├── fourreaux.csv           # Données des fourreaux
│   └── chemins_de_cable.csv    # Chemins des câbles
├── server.py                   # Serveur de développement Python
└── start.bat                   # Script de lancement Windows
```

## Commandes de développement
- **Lancement**: `python server.py` ou `start.bat`
- **URL locale**: http://localhost:8000
- **Port par défaut**: 8000

## Technologies
- HTML5 + CSS3 + JavaScript vanilla
- Canvas pour visualisation 2D
- PWA (Progressive Web App)
- Données CSV pour configuration

## Fonctionnalités clés
- Sélection forme (rectangulaire/circulaire)
- Calcul automatique d'occupation
- Interface graphique interactive
- Panneau de contrôle redimensionnable
- Cache hors ligne via Service Worker

## Notes de développement
- Interface responsive
- Sécurité CSP configurée
- Optimisations de performance (preload)
- Compatible mobile/tablette
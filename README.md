# TontonKAD - Version Simple

Organisateur de fourreaux et câbles - Version développement simplifiée

## Structure du projet

```
TONTONKAD_DEV/
├── app/           # Application web (HTML, CSS, JS)
├── data/          # Fichiers CSV (fourreaux, câbles)
├── server.py      # Serveur de développement
├── start.bat      # Lancement rapide (Windows)
└── README.md      # Ce fichier
```

## Lancement rapide

**Option 1 - Fichier batch (Windows):**
```bash
start.bat
```

**Option 2 - Python:**
```bash
python server.py
```

**Option 3 - Live Server (VS Code):**
- Ouvrir `app/index.html`
- Clic droit → "Open with Live Server"

## Développement

- **Port par défaut:** 8000
- **URL:** http://localhost:8000
- **Live reload:** Utiliser Live Server pour voir les modifications en temps réel
- **Données:** Modifier les CSV dans le dossier `data/`

## Technologies

- HTML5 + CSS3 + JavaScript
- Canvas pour la visualisation
- PWA (Progressive Web App)
- Service Worker pour le cache
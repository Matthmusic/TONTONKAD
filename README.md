# TONTONKAD v2 - Application Electron

Application de bureau pour le dimensionnement de chemins de câbles et fourreaux électriques.

## Fonctionnalités

- 📐 **Dimensionnement précis** : Boîtes rectangulaires, conduits circulaires, chemins de câbles
- 🎨 **Visualisation 2D** : Canvas interactif avec physique simulée
- 📊 **Calculs automatiques** : Taux d'occupation, statistiques
- 📄 **Exports multiples** : PDF, DXF (AutoCAD), JSON
- 💾 **Sauvegarde locale** : Projets au format JSON
- 🎯 **Interface intuitive** : Drag & drop, undo/redo, raccourcis clavier
- 🌓 **Thème sombre/clair** : Interface adaptable
- 🔄 **Mises à jour automatiques** : Via GitHub Releases

## Technologies

- **Electron** : Framework desktop multi-plateforme
- **Vanilla JavaScript** : Code natif sans framework
- **Canvas API** : Rendu graphique 2D
- **jsPDF** : Génération de PDF
- **electron-updater** : Système de mise à jour automatique

## Installation pour les utilisateurs

### Windows

1. Téléchargez le fichier `.exe` depuis la [page des releases](https://github.com/Matthmusic/TONTONKAD-v2/releases)
2. Exécutez l'installeur
3. Lancez TONTONKAD depuis le menu Démarrer

### Linux

1. Téléchargez le fichier `.AppImage` depuis la [page des releases](https://github.com/Matthmusic/TONTONKAD-v2/releases)
2. Rendez-le exécutable : `chmod +x TONTONKAD-*.AppImage`
3. Exécutez : `./TONTONKAD-*.AppImage`

### macOS

1. Téléchargez le fichier `.dmg` depuis la [page des releases](https://github.com/Matthmusic/TONTONKAD-v2/releases)
2. Ouvrez le DMG et glissez TONTONKAD dans Applications
3. Lancez depuis le dossier Applications

## Installation pour les développeurs

### Prérequis

- Node.js 20 ou supérieur
- npm ou yarn
- Git

### Cloner le repository

```bash
git clone https://github.com/Matthmusic/TONTONKAD-v2.git
cd TONTONKAD-v2
```

### Installer les dépendances

```bash
npm install
```

### Lancer en mode développement

```bash
npm run dev
```

Cette commande lance l'application Electron avec le DevTools ouvert et le rechargement automatique.

### Build de production

#### Windows
```bash
npm run build:win
```

#### Linux
```bash
npm run build:linux
```

#### macOS
```bash
npm run build:mac
```

#### Toutes les plateformes
```bash
npm run build
```

Les fichiers de build seront dans le dossier `dist/`.

## Structure du projet

```
TONTONKAD-v2/
├── src/
│   ├── main/
│   │   └── main.js              # Process principal Electron
│   ├── preload/
│   │   └── preload.js           # Script preload (bridge sécurisé)
│   └── renderer/
│       ├── index.html           # Interface utilisateur
│       ├── script.js            # Logique métier
│       ├── style.css            # Styles
│       ├── cea-variables.css    # Variables CSS
│       ├── dimension-button-handler.js
│       ├── electron-integration.js  # Intégration Electron
│       ├── jspdf.min.js         # Bibliothèque PDF
│       └── manifest.json        # Manifeste PWA
├── data/
│   ├── cables.csv               # Base de données câbles
│   ├── fourreaux.csv            # Base de données fourreaux
│   └── chemins_de_cable.csv    # Base de données chemins de câbles
├── assets/
│   ├── fonts/                   # Font Awesome (local)
│   └── icons/                   # Icônes de l'application
├── .github/
│   └── workflows/
│       └── build.yml            # CI/CD GitHub Actions
├── package.json
├── .gitignore
└── README.md
```

## Déploiement et releases

### Créer une nouvelle release

1. **Mettre à jour la version** dans `package.json` :
   ```json
   {
     "version": "2.0.1"
   }
   ```

2. **Commit les changements** :
   ```bash
   git add package.json
   git commit -m "Bump version to 2.0.1"
   ```

3. **Créer un tag Git** :
   ```bash
   git tag v2.0.1
   ```

4. **Pousser sur GitHub** :
   ```bash
   git push origin main
   git push origin v2.0.1
   ```

5. **GitHub Actions s'exécute automatiquement** :
   - Build pour Windows, Linux, et macOS
   - Création d'une release GitHub
   - Upload des installeurs

6. **Les utilisateurs reçoivent la mise à jour automatiquement** au lancement de l'application

### Workflow GitHub Actions

Le fichier `.github/workflows/build.yml` configure :

- **Build multi-plateforme** : Windows, Linux, macOS en parallèle
- **Artifacts** : Upload temporaire des builds
- **Release automatique** : Publication sur GitHub avec les fichiers
- **Déclenchement** : Sur push de tag `v*.*.*` ou manuellement

### Configuration electron-builder

Dans `package.json`, section `build` :

```json
{
  "build": {
    "appId": "com.tontonkad.app",
    "productName": "TONTONKAD",
    "publish": {
      "provider": "github",
      "owner": "Matthmusic",
      "repo": "TONTONKAD-v2"
    }
  }
}
```

## Mises à jour automatiques

L'application vérifie automatiquement les mises à jour au démarrage (seulement en production).

### Pour l'utilisateur

1. Une notification apparaît quand une mise à jour est disponible
2. Option de télécharger immédiatement ou plus tard
3. Installation au redémarrage de l'application

### Forcer la vérification

Menu : **Aide → Vérifier les mises à jour**

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl+N` | Nouveau projet |
| `Ctrl+O` | Ouvrir un projet |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+Shift+S` | Sauvegarder sous |
| `Ctrl+Z` | Annuler |
| `Ctrl+Shift+Z` | Refaire |
| `Ctrl+G` | Afficher/Masquer la grille |
| `Ctrl+T` | Basculer thème clair/sombre |
| `Ctrl+Q` | Quitter |

## Configuration pour votre propre fork

Si vous forkez ce projet pour votre propre usage :

1. **Modifiez `package.json`** :
   ```json
   {
     "name": "votre-app",
     "author": "Votre Nom",
     "build": {
       "appId": "com.votredomaine.app",
       "publish": {
         "owner": "VotreUsername",
         "repo": "VotreRepo"
       }
     }
   }
   ```

2. **Créez un token GitHub** (si nécessaire pour les releases privées) :
   - Settings → Developer settings → Personal access tokens
   - Créer un token avec scope `repo`
   - Ajouter comme secret GitHub Actions : `GH_TOKEN`

3. **Modifiez les icônes** dans `assets/icons/ico/`

## Développement

### Ajouter une nouvelle fonctionnalité

1. Modifiez `src/renderer/script.js` pour la logique
2. Modifiez `src/renderer/index.html` pour l'interface
3. Si besoin d'API Electron :
   - Ajoutez handler dans `src/main/main.js`
   - Exposez via `src/preload/preload.js`
   - Utilisez via `window.electronAPI` dans le renderer

### Debug

En mode développement, le DevTools est ouvert automatiquement.

Pour logger depuis le main process :
```javascript
console.log('Message'); // Visible dans le terminal
```

Pour logger depuis le renderer :
```javascript
console.log('Message'); // Visible dans le DevTools
```

## Troubleshooting

### L'application ne démarre pas

- Vérifiez que Node.js 20+ est installé
- Supprimez `node_modules` et réinstallez : `rm -rf node_modules && npm install`
- Vérifiez les logs : `npm start`

### Le build échoue

- Vérifiez que toutes les icônes existent dans `assets/icons/ico/`
- Sur Windows, installer Visual Studio Build Tools peut être nécessaire
- Sur Linux, installer `fuse` : `sudo apt install libfuse2`

### Les mises à jour ne fonctionnent pas

- Les mises à jour fonctionnent uniquement sur les builds signés/packagés
- En développement (`npm run dev`), les mises à jour sont désactivées
- Vérifiez que le repository GitHub est public ou que vous avez un token valide

## Contribuer

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Commit : `git commit -m "Ajout de ma fonctionnalité"`
4. Push : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une Pull Request

## Licence

MIT

## Auteur

TONTONKAD Team

## Support

Pour toute question ou problème :
- Ouvrez une [issue](https://github.com/Matthmusic/TONTONKAD-v2/issues)
- Consultez la documentation dans l'application : Menu Aide

# Guide de démarrage rapide - TONTONKAD Electron

## Pour les développeurs

### 1. Installation rapide

```bash
# Cloner le repository
git clone https://github.com/Matthmusic/TONTONKAD.git
cd TONTONKAD

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

### 2. Tester l'application

L'application se lance avec le DevTools ouvert. Vous pouvez :
- Créer un nouveau projet
- Ajouter des câbles et fourreaux
- Tester les exports (PDF, DXF)
- Sauvegarder et charger des projets

### 3. Créer un build

```bash
# Build Windows (sur Windows)
npm run build:win

# Build sera dans dist/
```

## Pour créer une release

### 1. Mettre à jour la version

Éditez `package.json` :
```json
{
  "version": "2.0.1"  // Augmentez la version
}
```

### 2. Créer le tag et pousser

```bash
# Commit
git add .
git commit -m "Bump version to 2.0.1"

# Créer le tag
git tag v2.0.1

# Pousser
git push origin main
git push origin v2.0.1
```

### 3. GitHub Actions fait le reste

- Build automatique pour Windows, Linux, macOS
- Création de la release GitHub
- Upload des installeurs
- Les utilisateurs recevront la mise à jour automatiquement

## Configuration du repository GitHub

### 1. Créer le repository sur GitHub

1. Allez sur https://github.com/new
2. Nom : `TONTONKAD`
3. Description : `Application Electron pour le dimensionnement de câbles et fourreaux`
4. Public ou Private (recommandé : Public pour les releases automatiques)
5. Créer le repository

### 2. Lier votre dépôt local

```bash
git remote add origin https://github.com/Matthmusic/TONTONKAD.git
git push -u origin main
```

### 3. Activer GitHub Actions

Les Actions sont automatiquement activées. Vérifiez dans l'onglet "Actions" du repository.

### 4. Permissions pour les releases

1. Allez dans Settings → Actions → General
2. Sous "Workflow permissions"
3. Sélectionnez "Read and write permissions"
4. Cochez "Allow GitHub Actions to create and approve pull requests"
5. Sauvegardez

## Structure des icônes (Important !)

Pour que les builds fonctionnent, vous devez avoir les icônes suivantes :

```
assets/icons/ico/
├── icon.ico          # Windows (256x256)
├── icon.icns         # macOS (512x512)
└── icon.png          # Linux (512x512)
```

### Créer les icônes depuis une image

Si vous avez une image PNG haute résolution :

```bash
# Windows .ico (nécessite ImageMagick)
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# macOS .icns (nécessite iconutil sur macOS)
# Créer d'abord les différentes tailles puis utiliser iconutil

# Linux .png
# Simplement copier votre PNG 512x512
```

Ou utilisez un service en ligne comme :
- https://convertico.com/
- https://cloudconvert.com/

## Vérifications avant la première release

- [ ] Les icônes sont présentes dans `assets/icons/ico/`
- [ ] `package.json` a le bon `owner` et `repo` dans la section `build.publish`
- [ ] Le repository GitHub est créé
- [ ] Les permissions GitHub Actions sont configurées
- [ ] La version dans `package.json` est correcte (ex: 2.0.0)

## Commandes utiles

```bash
# Développement
npm start                 # Lancer l'app (production mode)
npm run dev              # Lancer l'app (dev mode avec DevTools)

# Build
npm run build            # Build toutes les plateformes
npm run build:win        # Build Windows uniquement
npm run build:linux      # Build Linux uniquement
npm run build:mac        # Build macOS uniquement

# Release
npm run release          # Build + Publish sur GitHub
```

## Problèmes courants

### "Error: GitHub token not found"

Le token est automatiquement fourni par GitHub Actions. Si vous buildez localement et voulez publier :

```bash
export GH_TOKEN=your_github_personal_access_token
npm run release
```

### "Icon not found"

Ajoutez les icônes dans `assets/icons/ico/` ou créez un dossier `build/` à la racine avec vos icônes.

### Build qui échoue sur GitHub Actions

- Vérifiez les logs dans l'onglet Actions
- Assurez-vous que les permissions sont correctes
- Vérifiez que le tag est bien créé avec le format `v*.*.*`

## Support

Des questions ? Ouvrez une issue sur GitHub !

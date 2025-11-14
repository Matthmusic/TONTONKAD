# Guide de déploiement sur GitHub

## Étape 1 : Créer le repository sur GitHub

1. Allez sur https://github.com/new
2. **Nom du repository** : `TONTONKAD-v2`
3. **Description** : `Application Electron pour le dimensionnement de câbles et fourreaux électriques`
4. **Visibilité** : Public (recommandé pour les releases automatiques gratuites)
5. **NE PAS** initialiser avec README, .gitignore ou LICENSE (déjà créés localement)
6. Cliquez sur **Create repository**

## Étape 2 : Lier votre dépôt local au repository GitHub

Dans votre terminal, depuis le dossier `TONTONKAD-v2` :

```bash
# Ajouter le remote origin
git remote add origin https://github.com/Matthmusic/TONTONKAD-v2.git

# Pousser le code
git push -u origin main
```

Si vous utilisez SSH au lieu de HTTPS :
```bash
git remote add origin git@github.com:Matthmusic/TONTONKAD-v2.git
git push -u origin main
```

## Étape 3 : Configurer GitHub Actions

1. Allez dans votre repository sur GitHub
2. Cliquez sur **Settings** (en haut)
3. Dans le menu de gauche, cliquez sur **Actions** → **General**
4. Sous **Workflow permissions**, sélectionnez :
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**
5. Cliquez sur **Save**

## Étape 4 : Préparer les icônes (Important !)

Pour que les builds fonctionnent, vous devez avoir les icônes suivantes :

### Option A : Utiliser les icônes existantes

Si vous avez déjà des icônes `.ico` dans le dossier `assets/icons/ico/`, renommez-les :

```bash
# Windows
copy assets\icons\ico\TONTONKADN.ico build\icon.ico

# Ou sur Linux/Mac
cp assets/icons/ico/TONTONKADN.ico build/icon.ico
```

### Option B : Créer des icônes depuis une image

Si vous avez une image PNG de haute qualité (512x512 ou plus) :

**Avec ImageMagick (multiplateforme)** :
```bash
# Installer ImageMagick d'abord
# Windows: choco install imagemagick
# Mac: brew install imagemagick
# Linux: sudo apt-get install imagemagick

# Créer icon.ico pour Windows
magick convert votre-logo.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico

# Créer icon.png pour Linux (512x512)
magick convert votre-logo.png -resize 512x512 build/icon.png
```

**Services en ligne** (plus simple) :
- https://convertico.com/
- https://cloudconvert.com/png-to-ico
- https://www.icoconverter.com/

Téléchargez votre PNG, convertissez en ICO (256x256), et placez dans `build/icon.ico`

### Option C : Icône temporaire

Si vous n'avez pas d'icône pour le moment, vous pouvez temporairement désactiver l'icône dans `package.json` :

```json
{
  "build": {
    "win": {
      // Commentez ou retirez cette ligne temporairement
      // "icon": "assets/icons/ico/icon.ico"
    }
  }
}
```

**Important** : Commitez et poussez vos changements d'icônes avant de créer une release :
```bash
git add build/
git commit -m "Add application icons"
git push
```

## Étape 5 : Créer votre première release

### Vérifications avant release :

- [ ] Le repository GitHub est créé et linked
- [ ] Les permissions GitHub Actions sont configurées
- [ ] Les icônes sont présentes (ou désactivées temporairement)
- [ ] `package.json` a le bon owner/repo dans `build.publish`

### Créer la release :

**Option 1 : Script automatique (recommandé)**

Windows (PowerShell) :
```powershell
.\release.ps1 2.0.0
```

Linux/Mac (Bash) :
```bash
./release.sh 2.0.0
```

**Option 2 : Manuellement**

```bash
# 1. Mettre à jour la version
npm version 2.0.0 --no-git-tag-version

# 2. Commit
git add package.json package-lock.json
git commit -m "chore: bump version to 2.0.0"

# 3. Créer le tag
git tag v2.0.0

# 4. Pousser
git push origin main
git push origin v2.0.0
```

## Étape 6 : Suivre le build

1. Allez sur https://github.com/Matthmusic/TONTONKAD-v2/actions
2. Vous verrez le workflow "Build and Release" en cours
3. Le build prend environ 15-20 minutes (3 plateformes en parallèle)
4. Si tout est vert ✅, votre release sera créée automatiquement

## Étape 7 : Vérifier la release

1. Allez sur https://github.com/Matthmusic/TONTONKAD-v2/releases
2. Vous devriez voir `v2.0.0` avec les fichiers :
   - `TONTONKAD-Setup-2.0.0.exe` (Windows)
   - `TONTONKAD-2.0.0.AppImage` (Linux)
   - `TONTONKAD-2.0.0.dmg` (macOS)
   - Fichiers `.yml` pour les mises à jour automatiques

## Étape 8 : Tester l'application

1. Téléchargez l'installeur pour votre plateforme
2. Installez l'application
3. Lancez TONTONKAD
4. L'application devrait vérifier automatiquement les mises à jour au démarrage

## Releases futures

Pour créer de nouvelles releases, c'est encore plus simple :

```bash
# Faire vos modifications
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push

# Créer une nouvelle release (incrémentez la version)
./release.sh 2.0.1    # ou release.ps1 sur Windows
```

## Troubleshooting

### Erreur : "Resource not accessible by integration"

➜ Vérifiez les permissions GitHub Actions (Étape 3)

### Erreur : "Icon not found"

➜ Ajoutez les icônes dans `build/` ou désactivez dans `package.json` (Étape 4)

### Le build échoue sur une plateforme

➜ Vérifiez les logs dans l'onglet Actions. Chaque plateforme peut avoir des besoins spécifiques.

### L'auto-update ne fonctionne pas

➜ Les auto-updates fonctionnent uniquement sur les apps installées (pas en mode dev).
➜ Vérifiez que le repository est public ou configurez un token GitHub.

### "fatal: remote origin already exists"

➜ Utilisez : `git remote set-url origin https://github.com/Matthmusic/TONTONKAD-v2.git`

## Support

Des questions ? Ouvrez une issue sur GitHub !

---

**Bon déploiement ! 🚀**

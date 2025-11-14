# 🚀 Prochaines étapes - Guide pour Matthmusic

Salut ! Voici exactement ce qu'il te reste à faire pour mettre TONTONKAD en ligne sur GitHub avec le système de releases automatiques.

## ✅ Ce qui est déjà fait

- ✅ Structure Electron complète (main/preload/renderer)
- ✅ Système d'auto-update intégré
- ✅ Menu natif et raccourcis clavier
- ✅ Workflow GitHub Actions configuré
- ✅ Documentation complète
- ✅ Git initialisé avec commits
- ✅ Package.json configuré pour ton compte GitHub

## 📝 Ce qu'il te reste à faire (5-10 minutes)

### Étape 1 : Créer le repository sur GitHub

1. Va sur https://github.com/new
2. **Repository name** : `TONTONKAD-v2`
3. **Description** : `Application Electron pour le dimensionnement de câbles et fourreaux électriques`
4. **Public** (pour releases gratuites et auto-updates)
5. **NE COCHE RIEN** (pas de README, .gitignore, etc.)
6. Clique sur **Create repository**

### Étape 2 : Pousser ton code sur GitHub

Ouvre ton terminal dans `C:\DEV\TONTONKAD-v2` et exécute :

```bash
# Ajouter le remote GitHub
git remote add origin https://github.com/Matthmusic/TONTONKAD-v2.git

# Pousser tout le code
git push -u origin main
```

Si tu utilises SSH :
```bash
git remote add origin git@github.com:Matthmusic/TONTONKAD-v2.git
git push -u origin main
```

### Étape 3 : Configurer les permissions GitHub Actions

1. Va sur https://github.com/Matthmusic/TONTONKAD-v2/settings/actions
2. Sous **Workflow permissions**, choisis :
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**
3. Clique **Save**

### Étape 4 : Gérer les icônes (IMPORTANT !)

Tu as 2 options :

#### Option A : Utiliser une icône temporaire (pour tester rapidement)

Édite `package.json` et commente les lignes d'icônes :

```json
"win": {
  "target": [...],
  // "icon": "assets/icons/ico/icon.ico",
  "publish": ["github"]
}
```

Puis :
```bash
git add package.json
git commit -m "temp: disable icons for first build"
git push
```

#### Option B : Ajouter tes vraies icônes (recommandé)

Si tu as un logo PNG (512x512 minimum), utilise un de ces sites pour convertir :
- https://convertico.com/
- https://cloudconvert.com/png-to-ico

Télécharge ton PNG, convertis en ICO (256x256), et place-le dans `build/icon.ico`

```bash
# Créer le dossier build si nécessaire
mkdir build

# Copier ton icône (renomme ton fichier en icon.ico)
copy ton-icone.ico build\icon.ico

# Commit
git add build/
git commit -m "Add application icon"
git push
```

### Étape 5 : Créer ta première release

Une fois que tout est poussé sur GitHub, tu peux créer ta première release :

#### Windows (PowerShell) :
```powershell
.\release.ps1 2.0.0
```

#### Linux/Mac/Git Bash :
```bash
./release.sh 2.0.0
```

Ou manuellement :
```bash
npm version 2.0.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "Release v2.0.0"
git tag v2.0.0
git push origin main
git push origin v2.0.0
```

### Étape 6 : Attendre le build

1. Va sur https://github.com/Matthmusic/TONTONKAD-v2/actions
2. Tu verras "Build and Release" en cours d'exécution
3. Attends ~15-20 minutes (3 plateformes en parallèle)
4. Si tout est vert ✅ → Success !

### Étape 7 : Télécharger et tester

1. Va sur https://github.com/Matthmusic/TONTONKAD-v2/releases
2. Tu devrais voir `v2.0.0` avec 3 fichiers :
   - `TONTONKAD-Setup-2.0.0.exe` (Windows)
   - `TONTONKAD-2.0.0.AppImage` (Linux)
   - `TONTONKAD-2.0.0.dmg` (macOS)
3. Télécharge le `.exe`
4. Installe-le
5. Lance TONTONKAD !

## 🧪 Tester en local avant (optionnel)

Si tu veux tester l'app Electron avant de créer une release :

```bash
# Installer les dépendances (déjà fait normalement)
npm install

# Lancer en mode dev (avec DevTools)
npm run dev

# Ou en mode production
npm start
```

## 🔄 Workflow pour les prochaines releases

Après ta première release, c'est encore plus simple :

```bash
# 1. Faire tes modifications dans le code
# 2. Tester en local
npm run dev

# 3. Commit et push
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push

# 4. Créer une nouvelle release (incrémente la version)
.\release.ps1 2.0.1    # Bug fix
.\release.ps1 2.1.0    # Nouvelle feature
.\release.ps1 3.0.0    # Breaking change

# 5. Les users reçoivent automatiquement la mise à jour !
```

## 📚 Documentation disponible

- [README.md](README.md) - Documentation principale
- [QUICKSTART.md](QUICKSTART.md) - Guide rapide développeurs
- [DEPLOY.md](DEPLOY.md) - Guide de déploiement détaillé
- [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) - Résumé de la migration
- [CHANGELOG.md](CHANGELOG.md) - Historique des versions

## ❓ Questions fréquentes

### L'app ne démarre pas en mode dev ?

```bash
rm -rf node_modules
npm install
npm run dev
```

### Erreur "remote origin already exists" ?

```bash
git remote set-url origin https://github.com/Matthmusic/TONTONKAD-v2.git
```

### Le build GitHub Actions échoue ?

Vérifie :
1. Les permissions GitHub Actions (Étape 3)
2. Que les icônes sont présentes ou désactivées
3. Les logs dans l'onglet Actions pour plus de détails

### L'auto-update ne fonctionne pas ?

Les auto-updates fonctionnent UNIQUEMENT :
- Sur les apps installées (pas en mode dev)
- Quand il y a une nouvelle release sur GitHub
- Si le repository est public (ou avec un token pour privé)

## 🎯 Commandes récapitulatives

```bash
# Setup initial (à faire UNE FOIS)
git remote add origin https://github.com/Matthmusic/TONTONKAD-v2.git
git push -u origin main

# Créer une release (à chaque nouvelle version)
.\release.ps1 2.0.0

# Développement quotidien
npm run dev              # Test local
git add .                # Staging
git commit -m "..."      # Commit
git push                 # Push
```

## 🎉 C'est parti !

Tu es prêt ! Commence par l'Étape 1 et suis le guide pas à pas.

Si tu as des questions, tout est documenté dans [DEPLOY.md](DEPLOY.md).

**Bon courage et félicitations pour ce projet ! 🚀**

# Script de création de release pour TONTONKAD (Windows PowerShell)
# Usage: .\release.ps1 [version]
# Exemple: .\release.ps1 2.0.1

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$Tag = "v$Version"

Write-Host "🚀 Création de la release $Tag" -ForegroundColor Yellow
Write-Host ""

# Vérifier qu'on est sur main
$CurrentBranch = git branch --show-current
if ($CurrentBranch -ne "main") {
    Write-Host "❌ Vous devez être sur la branche main" -ForegroundColor Red
    exit 1
}

# Vérifier qu'il n'y a pas de changements non commités
$Status = git status --porcelain
if ($Status) {
    Write-Host "❌ Il y a des changements non commités" -ForegroundColor Red
    Write-Host "Commitez ou stash vos changements avant de continuer"
    exit 1
}

# Mettre à jour la version dans package.json
Write-Host "📝 Mise à jour de package.json..." -ForegroundColor Yellow
npm version $Version --no-git-tag-version

# Commit
Write-Host "💾 Commit des changements..." -ForegroundColor Yellow
git add package.json package-lock.json
git commit -m "chore: bump version to $Version"

# Créer le tag
Write-Host "🏷️  Création du tag $Tag..." -ForegroundColor Yellow
git tag -a $Tag -m "Release $Version"

# Pousser
Write-Host "⬆️  Push vers GitHub..." -ForegroundColor Yellow
git push origin main
git push origin $Tag

Write-Host ""
Write-Host "✅ Release $Tag créée avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📦 GitHub Actions va maintenant :"
Write-Host "  1. Builder pour Windows, Linux, et macOS"
Write-Host "  2. Créer une release GitHub"
Write-Host "  3. Uploader les installeurs"
Write-Host ""
Write-Host "🔗 Suivez la progression sur :"
Write-Host "   https://github.com/Matthmusic/TONTONKAD-v2/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Une fois terminé, la release sera disponible sur :"
Write-Host "   https://github.com/Matthmusic/TONTONKAD-v2/releases" -ForegroundColor Cyan

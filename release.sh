#!/bin/bash

# Script de création de release pour TONTONKAD
# Usage: ./release.sh [version]
# Exemple: ./release.sh 2.0.1

set -e

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ -z "$1" ]; then
  echo -e "${RED}❌ Erreur: Version non spécifiée${NC}"
  echo "Usage: ./release.sh [version]"
  echo "Exemple: ./release.sh 2.0.1"
  exit 1
fi

VERSION=$1
TAG="v${VERSION}"

echo -e "${YELLOW}🚀 Création de la release ${TAG}${NC}"
echo ""

# Vérifier qu'on est sur main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}❌ Vous devez être sur la branche main${NC}"
  exit 1
fi

# Vérifier qu'il n'y a pas de changements non commités
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Il y a des changements non commités${NC}"
  echo "Commitez ou stash vos changements avant de continuer"
  exit 1
fi

# Mettre à jour la version dans package.json
echo -e "${YELLOW}📝 Mise à jour de package.json...${NC}"
npm version $VERSION --no-git-tag-version

# Commit
echo -e "${YELLOW}💾 Commit des changements...${NC}"
git add package.json package-lock.json
git commit -m "chore: bump version to ${VERSION}"

# Créer le tag
echo -e "${YELLOW}🏷️  Création du tag ${TAG}...${NC}"
git tag -a $TAG -m "Release ${VERSION}"

# Pousser
echo -e "${YELLOW}⬆️  Push vers GitHub...${NC}"
git push origin main
git push origin $TAG

echo ""
echo -e "${GREEN}✅ Release ${TAG} créée avec succès !${NC}"
echo ""
echo "📦 GitHub Actions va maintenant :"
echo "  1. Builder pour Windows, Linux, et macOS"
echo "  2. Créer une release GitHub"
echo "  3. Uploader les installeurs"
echo ""
echo "🔗 Suivez la progression sur :"
echo "   https://github.com/Matthmusic/TONTONKAD-v2/actions"
echo ""
echo "🎉 Une fois terminé, la release sera disponible sur :"
echo "   https://github.com/Matthmusic/TONTONKAD-v2/releases"

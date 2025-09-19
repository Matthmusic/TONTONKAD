# TontonKAD - Simulateur de Multitubulaires

Application web professionnelle pour l'organisation et la simulation de fourreaux électriques en multitubulaires.

## 🎯 Vue d'ensemble

TontonKAD est un outil de simulation permettant d'optimiser l'arrangement de fourreaux dans des multitubulaires. Il calcule automatiquement l'occupation, simule la physique des câbles et génère des arrangements optimisés pour l'installation électrique.

### ✨ Fonctionnalités principales

- **🏗️ Simulation de multitubulaires** : Arrangement automatique des fourreaux avec contraintes réalistes
- **📐 Calcul d'occupation** : Fourreaux rectangulaires et circulaires avec taux d'occupation automatique
- **🎮 Simulation physique** : Gravité, collision et placement intelligent des câbles
- **📊 Interface interactive** : Canvas haute résolution avec zoom, pan et manipulation tactile
- **💾 Gestion de projets** : Sauvegarde locale, import/export, auto-sauvegarde
- **🎨 Système de couleurs** : Palette AutoCAD intégrée pour identification rapide
- **📱 PWA complète** : Installation native, fonctionnement hors ligne

### 🔧 Algorithmes avancés

- **Grille adaptative** : Calcul automatique des dimensions optimales
- **Tri intelligent** : Gros fourreaux en bas, petits en haut (logique multitubulaire)
- **Centrage automatique** : Positionnement depuis le bas avec centrage horizontal
- **Espacement configurable** : 30mm par défaut entre fourreaux
- **Fallback robuste** : Méthode classique en cas d'erreur

## 🚀 Lancement

**Double-clic sur :**
```
TONTONKAD.bat
```

C'est tout ! 🎯

## 📁 Structure du projet

```
TONTONKAD_DEV/
├── app/                          # Application web
│   ├── index.html               # Interface principale
│   ├── script.js                # Logique principale (~4000 lignes)
│   ├── style.css                # Styles CSS
│   ├── dimension-button-handler.js  # Gestion UI
│   ├── sw.js                    # Service Worker PWA
│   ├── manifest.json            # Manifest PWA
│   └── data/                    # Données CSV locales
│       ├── cables.csv           # Spécifications câbles
│       ├── fourreaux.csv        # Spécifications fourreaux
│       └── chemins_de_cable.csv # Chemins de câbles
├── data/                        # Données CSV sources
├── server.py                    # Serveur de développement
├── start.bat                    # Lancement Windows
├── CLAUDE.md                    # Documentation technique
└── README.md                    # Ce fichier
```

## 🎮 Utilisation

### Interface principale
- **Panneau de contrôle** : Redimensionnable, sélection des types de fourreaux/câbles
- **Canvas interactif** : Zoom avec molette, déplacement par glisser-déposer
- **Modes d'interaction** : Placement, sélection, suppression, édition

### Raccourcis clavier
- **Ctrl+G** : Arrangement en grille multitubulaire
- **Ctrl+X** : Geler/dégeler tous les éléments
- **Ctrl+S** : Sauvegarder le projet
- **Ctrl+C/V** : Copier/coller les éléments
- **Delete** : Supprimer la sélection

### Gestion de projets
- **Auto-sauvegarde** : Sauvegarde automatique toutes les 30 secondes
- **Projets nommés** : Création et gestion de projets multiples
- **Import/Export** : Fichiers JSON pour partage
- **LocalStorage** : Persistance locale des données

## 🔬 Technologies

### Frontend
- **HTML5/CSS3/JavaScript** : Interface moderne et responsive
- **Canvas 2D** : Rendu haute résolution avec devicePixelRatio
- **Progressive Web App** : Installation native, cache hors ligne
- **CSS Grid/Flexbox** : Layout adaptatif

### Moteur physique
- **Gravité** : 0.25 (configurable)
- **Friction** : 0.98 pour réalisme
- **Collisions** : 8 itérations pour précision maximale
- **Masse dynamique** : Coefficient 0.02

### Données
- **Format CSV** : Configuration flexible des composants
- **Cache intelligent** : Service Worker avec stratégie Cache-First
- **CORS optimisé** : Headers configurés pour développement

## 🛠️ Développement

### Configuration locale
```bash
# Cloner le projet
git clone https://github.com/Matthmusic/TONTONKAD.git
cd TONTONKAD_DEV

# Lancer le serveur
python server.py
```

### Débogage
- **Console développeur** : Logs détaillés avec F12
- **Headers anti-cache** : Pas besoin de Ctrl+Shift+R
- **Source maps** : Débogage direct du code source

### Modification des données
- **Fourreaux** : `app/data/fourreaux.csv` (type, code, diamètres OD/ID)
- **Câbles** : `app/data/cables.csv` (famille, code, diamètre)
- **Chemins** : `app/data/chemins_de_cable.csv` (dimensions spéciales)

## 📊 Format des données

### Fourreaux (fourreaux.csv)
```csv
type;code;od;id
TPC;40;40;30
TPC;50;50;37
IRL;16;16;13
ICTA;20;20;14.1
```

### Câbles (cables.csv)
```csv
fam;code;od
U1000R2V;3G1.5;8.1
H07VK;1x1.5;3.2
```

## 🎯 Cas d'usage

### Électriciens professionnels
- Calcul rapide d'occupation des fourreaux
- Optimisation des multitubulaires
- Visualisation des configurations avant installation

### Bureaux d'études
- Dimensionnement des infrastructures
- Génération de plans techniques
- Validation des configurations

### Formation
- Apprentissage des règles d'occupation
- Simulation interactive
- Visualisation pédagogique

## 🆕 Dernières améliorations

### v1.0.2 - Algorithme de grille multitubulaire
- ✅ Arrangement réaliste depuis le bas
- ✅ Tri par taille (gros fourreaux en bas)
- ✅ Espacement configurable 30mm
- ✅ Grille adaptative avec centrage
- ✅ Débogage console détaillé

### v1.0.1 - Système de projets
- ✅ Sauvegarde/chargement de projets
- ✅ Auto-sauvegarde intelligente
- ✅ Import/export JSON
- ✅ Interface modale moderne

## 📝 Licence

Projet de développement personnel - Usage professionnel autorisé

## 👨‍💻 Contributeurs

- **Développement principal** : Matthmusic
- **Optimisations IA** : Claude Code (Anthropic)

---

🚀 **Prêt à optimiser vos multitubulaires ?** Lancez `python server.py` et créez votre première configuration !
# 🎨 TontonKAD v2.0 - Thème CEA Ingénierie

> **Refonte graphique complète** de TontonKAD avec le thème moderne CEA Ingénierie

![Version](https://img.shields.io/badge/version-2.0.0-orange)
![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Theme](https://img.shields.io/badge/theme-CEA-ff914d)

---

## 🌟 Aperçu

TontonKAD v2 est une **refonte graphique complète** de l'application d'organisation de fourreaux et câbles électriques. Cette version adopte le **thème CEA Ingénierie** avec ses couleurs signature orange (#ff914d), des effets glassmorphism modernes, et un mode sombre/clair élégant.

### 🎯 Nouveautés v2

- ✨ **Design moderne** : Glassmorphism, gradients orange, ombres dynamiques
- 🌙 **Mode sombre/clair** : Toggle dans le header avec persistance localStorage
- 🎨 **Palette CEA** : Orange, marron, et effets vitrés professionnels
- 🔤 **Police Inter** : Typographie Google Fonts élégante
- 💫 **Animations fluides** : Transitions 0.3s, hover effects, glow effects
- 📱 **Responsive** : Adapté mobile/tablet/desktop

### ✅ Fonctionnalités conservées

Toutes les fonctionnalités de la v1 sont **100% conservées** :

- ✅ Algorithme multitubulaire (grille 3cm)
- ✅ Moteur physique Canvas
- ✅ Gestion projets (sauvegarde/export JSON)
- ✅ Export DXF AutoCAD
- ✅ Export PDF avec jsPDF
- ✅ Calculs d'occupation
- ✅ Palette AutoCAD 256 couleurs
- ✅ Raccourcis clavier (Ctrl+G, Ctrl+S, etc.)
- ✅ PWA offline

---

## 🚀 Installation et démarrage

### Prérequis

- Python 3.x (inclus dans Windows 10/11)
- Navigateur moderne (Chrome, Firefox, Edge, Safari)

### Lancement rapide

```bash
# Depuis le dossier racine du projet
cd app-v2
python ../server.py
```

Ouvrir dans le navigateur : **http://localhost:8000**

### Lancement via le script Windows

```bash
# Depuis le dossier racine
TONTONKAD.bat
```

Puis naviguer vers `http://localhost:8000` et sélectionner le dossier `app-v2`.

---

## 🎨 Aperçu du thème CEA

### Palette de couleurs

| Couleur | Hex | Usage |
|---------|-----|-------|
| **Orange CEA** | `#ff914d` | Primaire (boutons, accents) |
| **Orange foncé** | `#ff751f` | Hover, gradients |
| **Marron** | `#7a2f00` | Accents sombres |
| **Gris** | `#737373` | Textes secondaires |

### Effets visuels

- **Glassmorphism** : `backdrop-filter: blur(20px)` + backgrounds semi-transparents
- **Gradients** : `linear-gradient(135deg, #ff914d, #ff751f)` sur boutons et éléments actifs
- **Ombres** : `box-shadow: 0 4px 15px rgba(255, 145, 77, 0.3)` sur hover
- **Transitions** : `0.3s ease` partout pour fluidité

---

## 🌙 Mode Sombre

Le mode sombre peut être activé via le bouton 🌙/☀️ dans le header.

### Thème Light (par défaut)
- Background : Gradient blanc → gris clair
- Panneaux : Verre blanc semi-transparent
- Texte : Noir/gris foncé

### Thème Dark
- Background : Gradient #1a1a2e → #16213e
- Panneaux : Verre noir semi-transparent
- Texte : Blanc/gris clair

Le thème choisi est **sauvegardé** dans `localStorage` et restauré au prochain chargement.

---

## 📁 Structure des fichiers

```
app-v2/
├── index.html                    # Interface HTML (+ toggle thème)
├── style.css                     # CSS complet avec thème CEA (3120 lignes)
├── cea-variables.css             # Variables CSS du thème CEA
├── script.js                     # Logique JavaScript (identique v1)
├── dimension-button-handler.js   # Gestion UI (identique v1)
├── sw.js                         # Service Worker PWA (cache v2)
├── manifest.json                 # Manifest PWA (theme_color orange)
├── jspdf.min.js                  # Bibliothèque export PDF
├── TONTONKAD.svg                 # Logo
├── data/
│   ├── cables.csv                # Spécifications câbles
│   ├── fourreaux.csv             # Spécifications fourreaux
│   └── chemins_de_cable.csv      # Chemins de câbles
├── ico/                          # Icônes (cadenas, soleil, lune)
├── CHANGELOG-V2.md               # Détails des changements
└── README-V2.md                  # Ce fichier
```

---

## 🎯 Différences v1 vs v2

| Aspect | v1 | v2 |
|--------|----|----|
| **Couleurs** | Bleu/gris | Orange CEA |
| **Effets** | Ombres simples | Glassmorphism + glow |
| **Police** | System fonts | Inter (Google Fonts) |
| **Icônes** | SVG inline | Font Awesome 6 |
| **Mode sombre** | Via toggle existant | Toggle header + icône |
| **Header** | Logo + titre | Logo + titre gradient + badge v2 |
| **Boutons** | Simples | Gradients orange + ripple |
| **Scrollbar** | Standard | Gradient orange custom |

### Code identique
- ✅ `script.js` : **5192 lignes inchangées**
- ✅ `dimension-button-handler.js` : **300 lignes inchangées**
- ✅ Données CSV : **Identiques**
- ✅ Algorithmes : **Identiques**

---

## 🧪 Tests et validation

### Checklist de tests

- ✅ Chargement de l'application
- ✅ Toggle thème light/dark
- ✅ Ajout fourreaux/câbles
- ✅ Drag & drop dans canvas
- ✅ Arrangement grille (Ctrl+G)
- ✅ Sauvegarde/chargement projets
- ✅ Export JSON
- ✅ Export DXF
- ✅ Export PDF
- ✅ Calculs d'occupation
- ✅ Recherche câbles/fourreaux
- ✅ Mode responsive (mobile)
- ✅ PWA offline

### Navigateurs testés

- ✅ Chrome 120+
- ✅ Firefox 120+
- ✅ Edge 120+
- ✅ Safari 17+ (macOS/iOS)

---

## 🎨 Personnalisation

### Modifier les couleurs principales

Éditer `cea-variables.css` :

```css
:root {
  --primary-orange: #ff914d;      /* Changer cette couleur */
  --primary-orange-dark: #ff751f; /* Changer cette couleur */
  --primary-brown: #7a2f00;       /* Changer cette couleur */
}
```

### Ajouter un nouveau thème

Dans `style.css`, ajouter :

```css
[data-theme="custom"] {
  --primary-orange: #3b82f6;  /* Bleu */
  --primary-orange-dark: #2563eb;
  /* ... autres variables ... */
}
```

---

## 📦 Déploiement

### Production

1. **Minifier les ressources** (optionnel)
   ```bash
   # CSS
   npx csso style.css -o style.min.css

   # JS (déjà fait pour jspdf.min.js)
   npx terser script.js -o script.min.js
   ```

2. **Servir via HTTPS** pour PWA complète
   ```bash
   # Nginx, Apache, ou autre serveur web
   ```

3. **Vérifier le manifest PWA**
   - Theme color : `#ff914d`
   - Icons : OK
   - Service worker : OK

### GitHub Pages

1. Créer un dossier `docs` à la racine
2. Copier `app-v2/*` dans `docs/`
3. Activer GitHub Pages sur le dossier `/docs`
4. Accéder via `https://username.github.io/tontonkad/`

---

## 🐛 Résolution de problèmes

### Le thème ne charge pas
- **Cause** : Cache navigateur
- **Solution** : Ctrl+Shift+R (hard reload)

### Les icônes Font Awesome ne s'affichent pas
- **Cause** : CDN bloqué ou CSP trop restrictif
- **Solution** : Vérifier la connexion internet et le CSP dans `index.html`

### Le mode sombre ne persiste pas
- **Cause** : LocalStorage désactivé
- **Solution** : Autoriser les cookies/localStorage dans le navigateur

### Canvas blanc/vide
- **Cause** : JavaScript non chargé
- **Solution** : Vérifier la console (F12) pour erreurs JS

---

## 🔧 Développement

### Structure CSS

Le fichier `style.css` est organisé en **41 sections** :

1. Imports (variables CEA, Google Fonts)
2. Animations globales
3. Reset & Base
4. Variables root
5. Mode sombre `[data-theme="dark"]`
6. Scrollbar custom
7. Layout principal (wrap, panel, canvas)
8. Header & brand
9. Cards & composants
10-40. ... (voir le fichier)
41. Media queries responsive

### Ajouter un composant

Exemple : ajouter un badge CEA

```css
/* Dans style.css */
.badge-cea {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: linear-gradient(135deg, var(--primary-orange), var(--primary-orange-dark));
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 145, 77, 0.3);
}
```

Utiliser dans HTML :
```html
<span class="badge-cea">CEA</span>
```

---

## 📚 Ressources

### Documentation
- **CLAUDE.md** : Contexte complet du projet
- **CHANGELOG-V2.md** : Détails de tous les changements
- **README.md** (racine) : Documentation générale TontonKAD

### Thème CEA
- **CEA-THEME-GUIDE.md** : Guide d'utilisation du thème
- **cea-theme.css** : Thème CSS réutilisable
- **exemple-markdown-stylise.html** : Exemple de rendu

### Technologies
- [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)
- [Font Awesome 6](https://fontawesome.com/)
- [CSS Backdrop Filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [PWA Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

## 📝 Changelog

Voir [CHANGELOG-V2.md](CHANGELOG-V2.md) pour l'historique complet des modifications.

### Version 2.0.0 - 1er octobre 2025

#### 🎨 Ajouté
- Thème CEA Ingénierie (orange, glassmorphism)
- Toggle mode sombre/clair dans header
- Police Inter (Google Fonts)
- Icônes Font Awesome 6
- Animations fluides (hover, glow, transitions)
- Badge "v2" dans le header
- Variables CSS centralisées (`cea-variables.css`)

#### 🔄 Modifié
- CSS refactorisé (3120 lignes, 41 sections)
- Header modernisé (logo + titre gradient)
- Boutons avec gradients orange
- Scrollbar personnalisée orange
- Service worker (cache v2)
- Manifest PWA (theme_color orange)

#### ✅ Conservé
- Toute la logique JavaScript (script.js intact)
- Toutes les fonctionnalités v1
- Compatibilité projets v1
- Données CSV identiques

---

## 🙏 Crédits

### Développement
- **TontonKAD v1** : Équipe originale
- **TontonKAD v2** : Refonte CEA par Claude (Anthropic)

### Design
- **Thème CEA** : Inspiré de CEA-THEME-GUIDE.md
- **Glassmorphism** : Tendance design moderne
- **Police Inter** : Google Fonts (Rasmus Andersson)
- **Icônes** : Font Awesome (Dave Gandy)

---

## 📄 Licence

Ce projet est sous la même licence que TontonKAD v1.

---

## 📞 Support

### Questions fréquentes

**Q : Puis-je revenir à la v1 ?**
A : Oui, lancez le serveur depuis le dossier `app` au lieu de `app-v2`.

**Q : Les projets v1 sont-ils compatibles ?**
A : Oui, 100% compatibles. Aucune migration nécessaire.

**Q : Le thème peut-il être personnalisé ?**
A : Oui, modifiez les variables dans `cea-variables.css`.

**Q : Faut-il une connexion internet ?**
A : Non pour l'application, oui pour Google Fonts et Font Awesome (fallback système fonts).

---

**🎉 Profitez de TontonKAD v2 avec le thème CEA Ingénierie !**

*Fait avec ❤️ et du code propre - Octobre 2025*

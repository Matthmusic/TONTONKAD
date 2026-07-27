---
name: TontonKAD
description: CAO métier pour dimensionner fourreaux, câbles et chambres de tirage — verre dépoli réchauffé au cuivre.
colors:
  copper: "#ff914d"
  copper-deep: "#ff751f"
  copper-brown: "#7a2f00"
  ink: "#1a1d1f"
  slate: "#4a5568"
  slate-muted: "#718096"
  surface: "#f8f9fa"
  paper-hi: "#f0f2f5"
  paper-lo: "#dde1e7"
  hairline: "rgba(45, 52, 54, 0.1)"
  ink-dark: "#12121c"
  ink-dark-2: "#10182b"
  surface-dark: "#1a1a2e"
  success: "#48bb78"
  error: "#f56565"
  warning: "#ed8936"
  info: "#4299e1"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.03em"
  readout:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "30px"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.copper-deep}"
    textColor: "#ffffff"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  tab-active:
    backgroundColor: "{colors.copper}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  kpi-value:
    textColor: "{colors.copper}"
    typography: "{typography.readout}"
---

# Design System: TontonKAD

## Overview

**Creative North Star : « Verre & Cuivre »**

TontonKAD est un cockpit de bureau d'études : des surfaces de **verre dépoli** (glassmorphism translucide, flou d'arrière-plan) posées sur un dégradé froid gris-bleu, réchauffées par un unique accent **orange cuivre CEA**. La matière est froide et propre — de l'atelier, de l'instrument de mesure — mais l'énergie vient toujours du cuivre : action primaire, accents d'angle, lectures de valeurs. On lit l'écran comme un tableau de bord technique, pas comme une page web.

Le ton est **instrumenté et tactile** : les cartes de verre sont précises et nettes ; les boutons d'action sont pleins, cuivrés, affirmés ; les valeurs numériques (dimensions, taux d'occupation, échelle) s'affichent en **monospace**, entre crochets discrets, comme sur un afficheur. La profondeur naît de la superposition de couches de verre (blur + ombres douces + accents d'angle orange), jamais d'un relief lourd. Les micro-interactions ont un léger ressort — assumé, pas gadget.

Le système est **bi-thème** (clair par défaut, sombre optionnel) : chaque surface doit rester lisible dans les deux, du bureau au chantier. L'anti-référence est la page marketing générique : ici, pas de héros illustré, pas de dégradés décoratifs partout, pas de couleur de remplissage tapageuse — la densité d'information et la précision priment.

**Key Characteristics :**
- Verre translucide + flou d'arrière-plan comme matière de base
- Orange cuivre en accent rare et signifiant (jamais en aplat de fond)
- Lectures techniques en monospace, entre crochets `[ ]`
- Accents d'angle orange comme device maison (pas de bandeau latéral)
- Rayons généreux (12–20px), hairlines fines, parité clair/sombre

## Colors

Une base neutre froide (gris-bleu, encre) sur laquelle un seul accent chaud — l'orange cuivre CEA — porte toute l'énergie.

### Primary
- **Orange Cuivre** (`#ff914d`) : l'accent signature CEA. Réservé à l'action primaire (boutons pleins, onglet actif), aux accents d'angle des panneaux, aux lectures de valeurs (KPIs) et aux tampons/suggestions sur le canvas. C'est la seule couleur chaude du système.
- **Cuivre Profond** (`#ff751f`) : fin des dégradés cuivre et état *hover* des actions primaires.
- **Cuivre Brûlé** (`#7a2f00`) : bas de gamme du cuivre, fin de dégradé pour les surbrillances et lueurs.

### Neutral
- **Encre** (`#1a1d1f` ; sombre `#ffffff`) : texte principal.
- **Ardoise** (`#4a5568`) : texte secondaire, libellés.
- **Ardoise Estompée** (`#718096`) : texte tertiaire, aides, placeholders.
- **Papier Froid** (dégradé `#f0f2f5` → `#dde1e7`) : fond d'application clair.
- **Surface** (`#f8f9fa` ; sombre `#1a1a2e`) : fond opaque des modales et cartes solides.
- **Hairline** (`rgba(45,52,54,0.1)` ; sombre `rgba(255,255,255,0.1)`) : bordures et séparateurs d'1px.
- **Encre Nuit** (`#12121c` → `#10182b`) : fond d'application en thème sombre.

### Named Rules
**La Règle du Cuivre Rare.** L'orange cuivre ne remplit jamais une grande zone de fond. Il occupe ≤ 10 % d'un écran donné : action primaire, accents d'angle, valeurs. Sa rareté est ce qui lui donne son autorité d'accent CEA.

**La Règle des Deux Thèmes.** Aucune surface, aucun texte, aucun accent n'est validé tant qu'il n'est pas lisible en clair **et** en sombre. Les couleurs passent par les variables de thème, jamais en dur.

## Typography

**Police d'interface :** IBM Plex Sans (avec `system-ui`, `-apple-system`, sans-serif)
**Police technique :** JetBrains Mono (monospace)

**Caractère :** IBM Plex Sans donne un ton d'ingénierie propre et neutre, sans fioriture. JetBrains Mono isole les valeurs mesurées — chiffres, cotes, taux — pour qu'elles se lisent comme sur un instrument.

### Hierarchy
- **Display** (700, `1.5rem`, `-0.02em`, MAJUSCULES) : titre de marque / en-tête d'application. Souligné d'un trait cuivre.
- **Title** (600, `16px`) : titres de cartes et de sections (Inventaire, Détails sélection…).
- **Body** (400–500, `14px`, interligne 1.5) : texte courant, champs, options.
- **Label** (600, `12px`, `0.03em`, souvent MAJUSCULES) : micro-libellés, onglets, en-têtes de tuiles KPI.
- **Readout** (JetBrains Mono, 700, `15px`, `0.05em`) : valeurs numériques — dimensions, taux d'occupation, échelle, largeurs de tampons. Registre « afficheur ».

### Named Rules
**La Règle de l'Afficheur.** Toute valeur mesurée ou calculée (mm, %, px/mm) se compose en JetBrains Mono, en cuivre, et peut être encadrée de crochets `[ ]` discrets. Le texte de prose reste en IBM Plex Sans.

## Layout

Application à deux colonnes : un **panneau latéral** (config + inventaire + KPIs) à gauche, l'**espace de travail** canvas au centre, et une **barre d'outils** en pied. Le panneau adopte un cadre fixe (en-tête + barre KPI fixes) autour d'une zone de travail scrollable — les totaux restent toujours visibles.

- **Rythme d'espacement** : échelle `0.25 / 0.5 / 1 / 1.5 / 2 / 3 rem` (variables `--spacing-*`). Les cartes respirent au `lg` (24px), les lignes denses au `sm` (8px).
- **Config dense** : la ligne de configuration de boîte se répartit en fractions (forme `2fr` · dimensions `1fr` + `1fr`) qui remplissent la largeur de la colonne et se replient proprement.
- **Mode compact** : sous `max-height: 1100px` (écrans 1080p et moins), l'en-tête, les cartes et les listes se compactent pour éviter le scroll du panneau. La lisibilité bureau **et** chantier est une contrainte de layout, pas une option.

## Elevation & Depth

Système **glassmorphism en couches** : la profondeur vient de la translucidité et du flou, pas d'ombres lourdes. Les surfaces sont du verre dépoli (`backdrop-filter: blur(20px)`) sur fond dégradé, cerclées d'une hairline, et signées par des **accents d'angle** orange animés à l'apparition.

### Shadow Vocabulary
- **Ombre de verre** (`box-shadow: 0 8px 32px rgba(0,0,0,0.1)`) : élévation ambiante par défaut des panneaux et cartes.
- **Ombre de survol** (`0 8px 32px rgba(0,0,0,0.12)`) : légère montée d'une carte au *hover*.
- **Ombre de modale** (`0 12px 32px → 0 20px 40px rgba(0,0,0,0.25–0.3)`) : détache la modale de la scène assombrie.

### Named Rules
**La Règle des Accents d'Angle.** Le device maison de profondeur/cadrage est l'**accent d'angle** (deux traits cuivre en équerre), pas le bandeau latéral coloré. Éviter les grosses bordures latérales décoratives (`border-left` épais) comme signature.

**La Règle des Modales Opaques.** Les modales sont **opaques** (`--modal-bg-solid`), pas translucides : le verre est pour la scène, l'opacité pour ce qui demande la lecture (guide, réglages, PDF, projet).

## Shapes

Langage de formes **doux et généreux** : coins arrondis marqués, hairlines fines, aucune arête vive.

- **Rayons** : `sm 8px` (champs, petits contrôles) · `md 12px` (boutons, modales) · `lg 20px` (cartes, panneaux) · `full` (pastilles, quantités, scrollbars).
- **Bordures** : hairline 1px translucide ; jamais de trait épais sauf l'accent cuivre volontaire.
- **Silhouette** : cartes de verre à grand rayon, cerclées et signées d'accents d'angle ; boutons pleins à rayon moyen.

## Components

### Buttons
- **Shape :** rayon moyen (`12px`).
- **Primary :** dégradé cuivre (`#ff914d → #ff751f`), texte blanc, padding `12px 16px`, `IBM Plex Sans 600`. Pleine largeur dans les contextes de formulaire.
- **Hover / Focus :** vire vers le cuivre profond, légère montée (`translateY(-2px)`) et lueur cuivre ; effet de brillance qui traverse.
- **Persistant vs. transitoire :** un bouton d'action **transitoire** (ex. « Appliquer » qui n'apparaît qu'au changement) peut pulser pour attirer l'œil ; un bouton **toujours visible** ne pulse jamais (classe persistante, `animation: none`).
- **Réduire (accent vert) :** exception fonctionnelle — action « redimensionner auto » en vert (`#059669`), distincte de l'action métier cuivre.

### Chips / Tabs
- **Onglets (FOURREAU / CÂBLE) :** piste de verre en creux ; onglet **actif** en cuivre plein, texte blanc, MAJUSCULES `0.03em`, rayon `lg`.
- **Pastilles (pill/badge) :** rayon `full`, fond neutre secondaire, hairline, `12px`.

### Cards / Containers
- **Corner Style :** rayon `20px`.
- **Background :** verre (`--glass-bg` translucide + `backdrop-filter: blur(20px)`) ; surface opaque (`#f8f9fa`) pour les modales.
- **Shadow Strategy :** ombre de verre ambiante (voir Elevation).
- **Border :** hairline 1px ; accents d'angle cuivre animés à l'apparition (`revealStagger`).
- **Internal Padding :** `lg` (24px), `md` (16px) en mode compact.

### Inputs / Fields
- **Style :** fond `--input-bg`, hairline, rayon `sm` (8px), ombre interne légère. Champs numériques en registre technique.
- **Focus :** bordure cuivre + lueur douce ; transition `0.3s`.
- **Select recherchable :** input texte + liste flottante filtrable (fourreaux, câbles, chemins, chambres) — **un seul et même motif** pour tous les sélecteurs de référence. Le verrou de dimension (cadenas) est un toggle iconographique.

### KPI Strip (signature)
Barre horizontale de tuiles en pied de panneau (Fourreaux · Câbles · Occupation · Échelle). Libellé en **Label** MAJUSCULE estompé, valeur en **Readout** cuivre monospace. Toujours visible : c'est l'afficheur du cockpit.

### Compat / Tampons Panel (signature)
Panneau flottant ancré à droite du canvas qui suggère des chambres de tirage compatibles (préformé, sinon maçonné + tampons) et **dessine les tampons sur le canvas**, à l'échelle, centrés sur la boîte. Même matière verre/cuivre, animation d'entrée `modalPopIn`.

## Do's and Don'ts

### Do:
- **Do** réserver l'orange cuivre à l'accent (action primaire, angles, valeurs) — ≤ 10 % de l'écran (Règle du Cuivre Rare).
- **Do** composer chaque valeur mesurée en JetBrains Mono cuivre, encadrée de `[ ]` si pertinent (Règle de l'Afficheur).
- **Do** construire la profondeur au verre : `backdrop-filter: blur(20px)` + hairline + ombre de verre + accents d'angle.
- **Do** valider chaque surface en clair **et** en sombre via les variables de thème (Règle des Deux Thèmes).
- **Do** garder les modales **opaques** (`--modal-bg-solid`) et centrées, avec une entrée `modalPopIn` sans « saut ».
- **Do** rester lisible en mode compact (`max-height: 1100px`) — bureau et chantier.

### Don't:
- **Don't** utiliser l'orange en grand aplat de fond ni sur de nombreux éléments simultanément.
- **Don't** faire du texte en dégradé, sauf la signature « afficheur » des KPIs.
- **Don't** signer les cartes par une grosse bordure latérale colorée (`border-left` épais) : le device maison est l'accent d'angle.
- **Don't** empiler plus d'une animation d'attention (pulse/flicker) par vue, ni faire pulser un bouton en permanence.
- **Don't** mettre des valeurs de couleur en dur : passer par les variables (`--primary-orange`, `--glass-bg`, `--text-primary`…).

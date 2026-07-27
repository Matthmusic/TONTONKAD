# Brainstorming Session — Amélioration du Système de Placement de Fourreaux

**Date** : 2026-06-26
**Facilitateur** : Claude (BMAD Analyst)
**Participant** : Matthieu MAUREL
**Durée** : ~45 min
**Techniques utilisées** : How Might We, SCAMPER, Flow Progressif

---

## Executive Summary

**Sujet** : Refonte et amélioration du moteur de placement de fourreaux dans TontonKAD.

**Contraintes** :
- Pas de contrainte de performance (on peut se permettre un algo plus lent si le résultat est meilleur)
- L'existant sera archivé sur une branche GitHub de sauvegarde avant toute refonte
- Périmètre : algo ET UX

**Objectif** : Explorer de nouveaux axes ET approfondir les idées déjà identifiées.

**Résultat** : Architecture UX complète définie + améliorations algo prioritaires identifiées.

**Total idées générées** : 22 idées distinctes

---

## Idées générées par technique

### How Might We — Vision du placement parfait

> *Ce qu'un placement parfait doit produire pour l'utilisateur final*

- Encombrement **minimum en largeur ET en hauteur**
- Logique tranchée : **préférer creuser large plutôt que profond** (largeur > hauteur)
- Principe de gravité : **gros fourreaux en bas**, petits en haut
- Regroupement par famille : **gros avec gros, petits avec petits**
- Remplissage intelligent des vides : **N petits dans l'espace d'un grand** (ex: 2×TPC63 dans la place d'un TPC200)
- Auto-redimensionnement respectant : **entraxe + lit de pose + axes verrouillés**
- Le redimensionnement suit les contraintes CCTP (lit de pose 40mm, entraxe 30mm)

### SCAMPER — Ce qu'on peut améliorer dans le moteur

**S — Substituer**
- Remplacer les 5 stratégies fixes par un algo de **remplissage par permutation sur grille de cellules**
- Possibilité d'un algo plus lent mais plus exhaustif (pas de contrainte perf)

**C — Combiner**
- Mode quantitatif (liste → auto-placement) **combiné** avec le moteur existant = un pipeline unifié
- L'inventaire devient le **hub central** qui alimente tous les modes

**A — Adapter**
- Principe "N petits dans la place d'un grand" : applicable quand un grand ne rentre pas ou pour remplir un vide
- *(Hors scope pour l'instant : placement vertical ou quinconce)*

**M — Modifier**
- Panel de propositions : **3 cards** (compact, optimisé, rectangle)
- 3ème card affichée **uniquement si score > 80%**, sinon 2 cards (compact + optimisé)
- Card optimisée marquée : **⭐ + animation pulse** sur le contour

---

## Architecture UX définie

### Sélecteur de fourreau (barre d'outils)

```
┌──────────────────────────────────────────────┐
│  [TPC 200 ▼]    [−] 4 [+]    [+ Ajouter]   │
└──────────────────────────────────────────────┘
```

**Règle de déclenchement du mode :**
- Type sélectionné + **clic direct canvas** → **Mode A** (gravité, placement immédiat)
- Type sélectionné + quantité + **bouton "Ajouter"** → ajout à l'inventaire (pulse feedback) → **Mode B ou C**

---

### Inventaire Fourreaux (hub central)

```
┌─────────────────────────────────────────────┐
│ INVENTAIRE FOURREAUX                        │
│                                             │
│ TPC 200  [−] 3 [+]   ░░░ 1 placé / 3      │
│ TPC 125  [−] 6 [+]   ░░░ 6 placés ✓        │
│ TPC 63   [−] 4 [+]   ░░░ 0 placés / 4      │
│                                             │
│  [⚡ PLACEMENT AUTO]    [✋ MANUEL]         │
└─────────────────────────────────────────────┘
```

---

### 3 Modes de placement (sans choix explicite de l'utilisateur)

#### Mode A — "Exploration / Instinctif" *(ADN actuel)*
**Déclencheur** : sélection d'un type fourreau depuis la toolbar + clic direct canvas

- Gravité active
- Placement au clic molette (comportement actuel conservé)
- Ajoute automatiquement le fourreau à l'inventaire
- Idéal pour : tester, explorer, ajouter rapidement

#### Mode B — "Production / Auto"
**Déclencheur** : bouton ⚡ PLACEMENT AUTO dans l'inventaire

- Le moteur place tous les fourreaux de la liste
- Auto-redimensionnement de la boîte
- Affiche le **panel de propositions** (2 ou 3 cards)
- Idéal pour : cahier des charges défini, résultat optimal en un clic

#### Mode C — "Guidé / Semi-manuel"
**Déclencheur** : clic sur un type dans la liste inventaire

- Grille visuelle apparaît sur le canvas
- Osnap suggère les positions logiques
- Compteur visible : "X placés / N total"
- Pas de gravité — placement précis contrôlé
- Si quantité = N sélectionnée → N fantômes prévisualisant le placement
- Boutons [−][+] dans l'inventaire pour ajuster la quantité restante
- Idéal pour : connaître approximativement le plan mais vouloir garder le contrôle

---

### Panel de Propositions (remplace le bouton "Redimensionner")

Affiché après un placement auto ou manuel, quand l'optimisation a du sens.

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│                  │  │ ⭐               │  │                  │
│   COMPACT        │  │   OPTIMISÉ  ✨   │  │   RECTANGLE      │
│                  │  │ ░░░░░░░░░░░░░░░ │  │                  │
│ Placement actuel │  │ Meilleur score   │  │  Grille type     │
│ + boîte serrée   │  │ + redim auto     │  │  4×3 basique     │
│ au lit de pose   │  │                  │  │ (si score > 80%) │
│                  │  │                  │  │                  │
│   [Appliquer]    │  │   [Appliquer]    │  │   [Appliquer]    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Comportement des cards :**
- Clic sur une card → **redimensionne automatiquement la boîte**
- Card "Optimisé" : animation pulse sur le contour de la vue canvas
- Card 3 (Rectangle) : affichée **uniquement si score > 80%**, sinon masquée
- Toutes les cards respectent : entraxe + lit de pose + axes verrouillés

---

## Idée Categorization

### Immediate Opportunities — À implémenter maintenant

1. **Préférence largeur > hauteur** dans le scorer (modifier le poids `shape` dans `MultiObjectiveScorer`)
2. **Panel 3 cards** remplaçant le bouton "Redimensionner" — Card 1 (compact) + Card 2 (optimisé ⭐) + Card 3 conditionnelle
3. **Clic sur une card → redim automatique de la boîte**
4. **Seuil 80%** pour l'affichage de la 3ème card
5. **Inventaire fourreaux avec +/- et compteur** [placés/total]
6. **Fix Ctrl+Z — drag/move** : `startDrag()` ne sauvegarde pas l'état avant déplacement → ajouter `saveStateToHistory()` au début de `startDrag()` ([script.js:6083](../src/renderer/script.js#L6083))
7. **Fix Ctrl+Z — dimensions boîte** : `saveStateToHistory()` ne capture pas `WORLD_W_MM` / `WORLD_H_MM` / `lockWidth` / `lockHeight` → inclure dans le snapshot pour rendre annulables les redimensionnements et rotations

### Future Innovations — Nécessite développement

6. **Remplissage des vides** : N petits dans l'espace d'un grand (nouvelle stratégie dans `ConfigurationGenerator`)
7. **Mode C guidé** : grille visuelle + osnap + compteur restant lors du clic sur un type dans l'inventaire
8. **Mode B auto** : bouton ⚡ dans l'inventaire → pipeline placement + panel propositions
9. **Sélecteur fourreau** : champ quantité [−][+] + bouton "Ajouter" → flow vers inventaire

### Moonshots — Ambitieux mais transformateurs

10. **Algo par permutation sur grille de cellules** : remplace les 5 stratégies fixes, explore l'espace de solutions de façon exhaustive
11. **Placement quantitatif pur** : saisir une liste de fourreaux sans la boîte → le moteur suggère les dimensions de boîte optimales

### Insights & Learnings

- Le moteur actuel est correct mais opaque (3/4 du code potentiellement inutile) → **audit + nettoyage avant d'ajouter des features**
- Les 3 modes UX ne sont pas des alternatives mais des **compléments** selon le contexte utilisateur
- L'inventaire est le **hub manquant** qui unifie les 3 modes sans forcer l'utilisateur à choisir explicitement
- La logique "tranchée" (large > profond) est un **invariant métier** qui doit être encodé dans le scorer, pas juste une option

---

## Action Planning

### Priorité 1 — Fondations propres (avant toute nouvelle feature)

**Tâche** : Créer une branche de sauvegarde de l'état actuel, puis auditer `placement-engine.js` pour identifier le code réellement utilisé.

**Pourquoi** : Le moteur actuel est opaque après de nombreuses itérations. Bâtir sur du code propre est non négociable pour la suite.

**Next steps** :
1. `git checkout -b backup/placement-engine-v1` et push
2. Lire et cartographier `placement-engine.js` — identifier les classes/fonctions vraiment appelées depuis `script.js`
3. Supprimer le code mort
4. Ajouter les tests manquants sur les fonctions conservées

**Timeline** : Avant tout le reste

---

### Priorité 2 — Scorer : logique tranchée + seuil 80%

**Tâche** : Modifier `MultiObjectiveScorer` pour favoriser largeur > hauteur, et implémenter la logique d'affichage conditionnel des cards.

**Pourquoi** : Impact immédiat sur la qualité des résultats, changement localisé dans le scorer.

**Next steps** :
1. Modifier le poids `shape` dans `MultiObjectiveScorer` : pénaliser hauteur > largeur
2. Ajouter un score `aspectRatio` (largeur/hauteur) dans l'évaluation
3. Implémenter le seuil 80% pour la 3ème card dans le panel
4. Tester sur des cas réels avec TPC200, TPC125, TPC63

**Timeline** : Sprint 1

---

### Priorité 3 — Panel de propositions + redim au clic

**Tâche** : Remplacer le bouton "Redimensionner" par le panel 3 cards avec redim automatique au clic.

**Pourquoi** : C'est le changement UX le plus visible et le plus attendu. Directement lié aux priorités algo.

**Next steps** :
1. Créer le composant panel dans `index.html` + `style.css`
2. Brancher sur `PlacementOrchestrator.optimize()` pour alimenter les cards
3. Implémenter le clic → `resizeTrayToFit(configuration)` dans `script.js`
4. Ajouter l'animation pulse sur la card optimisée
5. Masquer la card 3 si score < 80%

**Timeline** : Sprint 1-2

---

## Reflection & Follow-up

**Grille visuelle Mode C** : utiliser la grille visuelle existante (déjà implémentée), simplement l'activer au clic sur un type dans l'inventaire.

**Remplissage N petits / 1 grand** : à valider par l'utilisateur avant application (pas automatique).

---

**Ce qui a bien fonctionné** : La technique "How Might We" a permis de partir de la réalité métier (logique tranchée) plutôt que des contraintes techniques. SCAMPER a aidé à structurer les améliorations sans repartir de zéro inutilement.

**Axes non explorés pour une prochaine session** :
- Algo de remplissage par permutation (Moonshot #10) — mériterait une session dédiée avec prototypage
- UX du mode quantitatif pur (Moonshot #11)
- Gestion des conflits : que se passe-t-il quand les contraintes de verrouillage rendent le placement impossible ?

**Questions émergentes** :
- Quel est le format exact de la grille visuelle en Mode C ? (espacement, couleur, snap magnétique ?)
- Comment gérer le "retour en arrière" après avoir appliqué une card du panel ?
- Le remplissage N petits / 1 grand : l'utilisateur doit-il le valider ou c'est automatique ?

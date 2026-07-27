# Epic 002 : Variantes de placement et tableau de bord des scores

---

## Métadonnées

- **Epic ID** : EPIC-002
- **Titre** : Variantes de placement et tableau de bord des scores
- **Statut** : 📋 Planifié
- **Priorité** : P1 (Important)
- **Owner** : Matthieu MAUREL
- **Créé le** : 2026-06-26
- **Version cible** : v2.5
- **Estimation totale** : 6-8 jours (3 stories)

---

## 🎯 Vue d'ensemble

### Contexte

L'Epic 001 a livré les fondations de contrôle AutoCAD-like (gravité toggle, ORTHO F8, OSNAP F3). En parallèle, le `PlacementOrchestrator` génère jusqu'à 7 configurations candidates via `NappeGenerator`, les score via `NappeScorer` sur 5 critères, mais **n'expose à l'utilisateur que la meilleure** — les alternatives sont calculées puis jetées.

Le `#layoutPreviewPanel` DOM existe déjà (utilisé par l'ancien système de placement). Les fonctions `showLayoutPreviewPanel()`, `hideLayoutPreviewPanel()`, `applyLayoutVariant()` existent dans `script.js`. La variable `lastLayoutVariants[]` existe mais n'est jamais remplie par le nouveau système.

### Problème

L'utilisateur ne voit pas les alternatives de placement générées par le moteur. Il ne connaît pas les scores détaillés (familyCoherence, surface, reserveAccessibility, symmetry, stability). Il ne peut pas choisir une variante qui conviendrait mieux à sa contrainte métier (ex : préférer une nappe plus large plutôt que plus haute).

### Solution

Connecter le `PlacementOrchestrator` au `#layoutPreviewPanel` existant pour exposer les variantes scorées, afficher les métriques détaillées, et aligner le sélecteur de stratégie avec les vraies stratégies du moteur.

---

## 🏗️ Architecture technique

### Fichiers impactés

| Fichier | Type de modification |
|---------|---------------------|
| `src/renderer/placement-engine.js` | Exposer `alternatives` + `strategyName` sur NappeLayout |
| `src/renderer/script.js` | Connecter variantes au panel, nouvelle fonction `applyNappeVariant` |
| `src/renderer/index.html` | Mise à jour cards HTML du panel si nécessaire |
| `src/renderer/style.css` | Styles barres de score (mineurs) |

### État actuel du moteur

- `NappeGenerator.generateConfigurations()` → jusqu'à 7 stratégies selon `placementMode`
- `NappeScorer.evaluate(cfg)` → remplit `cfg.score` (0-1) et `cfg.scoreDetails` (`familyCoherence`, `surface`, `reserveAccessibility`, `symmetry`, `stability`)
- `PlacementOrchestrator.computeBestPlacement()` → retourne seulement `configs[0]` (meilleure), l'array `configs` contient toutes les alternatives mais n'est pas exposé
- `#placementModeSelect` → 4 options : `auto`, `rect43`, `compact`, `pyramid` — mais `pyramid` n'existe pas dans le nouveau moteur

### Noms des stratégies NappeGenerator (7 stratégies)

| Nom interne | Mode(s) | Traduction FR |
|---|---|---|
| `familyLevelStrategy` | auto | Par familles |
| `bottomLeftStrategy` | auto | Bas-gauche |
| `centeredSymmetricStrategy` | auto | Symétrique |
| `compactByDiameterStrategy` | auto, compact | Compact |
| `rectangularAspectStrategy` | auto, rect43 | Rectangle 4/3 |
| `minWidthStrategy` | auto | Largeur min |
| `minHeightStrategy` | auto, compact, rect43 | Hauteur min |

---

## 📋 Stories

| Story | Titre | Estimation | Priorité | Statut |
|-------|-------|------------|----------|--------|
| [2.1](2.1.variantes-placement.md) | Panel de variantes de placement | 2-3 jours | P1 | 📋 À faire |
| [2.2](2.2.scores-detailles.md) | Scores détaillés par variante | 1-2 jours | P2 | 📋 À faire |
| [2.3](2.3.selecteur-strategie.md) | Nettoyage sélecteur de stratégie | 1 jour | P2 | 📋 À faire |

**Total estimé : 4-6 jours**

---

## 🎯 Jalons & Critères de succès

### Fin Story 2.1 — Variantes

- ✅ Après "Placer en grille", le panel d'alternatives s'affiche avec ≥ 2 variantes
- ✅ Chaque card affiche nom de stratégie (FR), dimensions en mm, score global %
- ✅ Cliquer une card alternative applique ce placement au canvas
- ✅ Fonctionne aussi pour "Réduire au minimum"

### Fin Story 2.2 — Scores détaillés

- ✅ Chaque card du panel montre les 5 métriques en barres visuelles
- ✅ Les critères sont libellés en français (Familles, Surface, Réserves, Symétrie, Stabilité)

### Fin Story 2.3 — Sélecteur stratégie

- ✅ `#placementModeSelect` aligne ses options sur les vraies stratégies du moteur
- ✅ L'option "pyramid" supprimée ou remplacée par une option valide

---

## ⚠️ Points d'attention

| Risque | Mitigation |
|--------|------------|
| `applyLayoutVariant()` utilise l'ancien format (`layout.fits`, items[]) | Créer `applyNappeVariant()` dédié au nouveau format NappeLayout |
| Conversion coordonnées mm → canvas pixels pour variantes | Reprendre exactement le même calcul que dans `arrangeConduitGridNew()` |
| Compatibilité `lastLayoutVariants` ancien/nouveau système | Utiliser un flag `isNappeLayout: true` pour distinguer les formats |
| autoResize dans les variantes de `reduceToMinimumNew` | Appeler `orchestrator.optimizeDimensions(cfg)` sur chaque alternative aussi |

---

**Epic créé le** : 2026-06-26
**Statut** : 📋 Planifié — Story 2.1 prête à démarrer

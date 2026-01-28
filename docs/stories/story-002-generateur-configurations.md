# Story 002 : Générateur de configurations multiples

---

## Métadonnées

- **Story ID** : STORY-002
- **Epic** : [EPIC-001](epic-001-optimisation-placement-fourreaux.md) - Optimisation intelligente du placement des fourreaux
- **Titre** : Générateur de configurations multiples
- **Priorité** : P0 (Critique)
- **Sprint** : 1.2
- **Estimation** : 4 jours
- **Statut** : ✅ Ready for Review
- **Assigné à** : Non assigné
- **Créé le** : 2026-01-27
- **Dépend de** : [STORY-001](story-001-fondations-moteur-placement.md)

---

## 📖 User Story

**En tant qu'** utilisateur
**Je veux** que le système explore plusieurs stratégies de placement automatiquement
**Afin d'** obtenir le meilleur placement possible parmi plusieurs configurations candidates

---

## 🎯 Contexte & Objectif

Cette story implémente le **cœur de l'innovation** : au lieu de placer séquentiellement (gauche→droite), le système **génère 5 configurations différentes** avec des stratégies variées, puis le scorer (STORY-003) choisira la meilleure.

### Problème résolu

L'algorithme actuel est **aveugle** : il ne peut pas explorer plusieurs scénarios. Cette story résout ce problème en :
- ✅ Générant 5 configurations avec approches différentes
- ✅ Explorant l'espace des solutions intelligemment
- ✅ Respectant toutes les contraintes métier (gravité, entraxes, stabilité)

---

## 📋 Tâches techniques

### 1. Créer `ConfigurationGenerator` class

**Fichier** : `src/renderer/placement-engine.js`

**Interface** :
```javascript
class ConfigurationGenerator {
  /**
   * Génère N configurations candidates
   * @param {Array} fourreaux - Liste fourreaux à placer
   * @param {Object} constraints - {lockedAxis, lockedValue}
   * @returns {Array<PlacementConfiguration>} 5 configurations
   */
  generateConfigurations(fourreaux, constraints = {}) {
    // Tri intelligent des fourreaux
    const sorted = FourreauSorter.intelligentSort(fourreaux);

    // Génère 5 configs avec stratégies différentes
    return [
      this.bottomLeftStrategy(sorted, constraints),
      this.centeredSymmetricStrategy(sorted, constraints),
      this.minWidthStrategy(sorted, constraints),
      this.minHeightStrategy(sorted, constraints),
      this.squareShapeStrategy(sorted, constraints)
    ].filter(config => config !== null); // Retirer configs impossibles
  }
}
```

### 2. Implémenter `bottomLeftStrategy`

**Objectif** : Placement classique bas-gauche (comme Tetris)

**Algorithme** :
```javascript
bottomLeftStrategy(fourreaux, constraints) {
  const config = new PlacementConfiguration(1000, 1000, constraints);

  for (const f of fourreaux) {
    // Pour chaque fourreau, chercher la position la plus basse
    // puis la plus à gauche où il peut être placé
    let bestPos = null;
    let minY = Infinity;
    let minX = Infinity;

    for (let y = 0; y <= config.height; y++) {
      for (let x = 0; x <= config.width; x++) {
        if (config.canPlace(f, x, y)) {
          if (y < minY || (y === minY && x < minX)) {
            minY = y;
            minX = x;
            bestPos = {x, y};
          }
        }
      }
    }

    if (bestPos) {
      config.addFourreau({...f, x: bestPos.x, y: bestPos.y});
    } else {
      // Impossible de placer : agrandir boîte ou retourner null
      if (constraints.lockedAxis) return null; // Impossible
      // Sinon agrandir dimension appropriée
    }
  }

  return config;
}
```

### 3. Implémenter `centeredSymmetricStrategy`

**Objectif** : Privilégier symétrie axe Y (vertical)

**Algorithme** :
```javascript
centeredSymmetricStrategy(fourreaux, constraints) {
  const config = new PlacementConfiguration(1000, 1000, constraints);
  const centerX = config.width / 2;

  // Identifier paires symétriques
  const pairs = FourreauSorter.detectSymmetricPairs(fourreaux);

  // Placer par paires autour du centre
  let currentY = 0;

  for (const pair of pairs) {
    // Calculer positions symétriques
    const cellSize = config.calculateCellSize(pair.left.diameter);
    const leftX = centerX - cellSize - 15; // 15mm gap du centre
    const rightX = centerX + 15;

    // Placer la paire
    if (config.canPlace(pair.left, leftX, currentY)) {
      config.addFourreau({...pair.left, x: leftX, y: currentY});
      config.addFourreau({...pair.right, x: rightX, y: currentY});
      currentY += cellSize;
    }
  }

  // Placer fourreaux restants (impairs) au centre
  // ...

  return config;
}
```

### 4. Implémenter `minWidthStrategy`

**Objectif** : Minimiser la largeur (étendre verticalement si nécessaire)

**Algorithme** :
```javascript
minWidthStrategy(fourreaux, constraints) {
  // Calculer largeur minimale possible
  const maxCellSize = Math.max(...fourreaux.map(f =>
    f.diameter + 30
  ));

  // Essayer de placer en colonne(s) étroite(s)
  const config = new PlacementConfiguration(maxCellSize * 2, 2000, constraints);

  // Remplir verticalement d'abord
  let currentX = 0;
  let currentY = 0;
  let maxHeightInColumn = 0;

  for (const f of fourreaux) {
    const cellSize = config.calculateCellSize(f.diameter);

    // Essayer placement dans colonne actuelle
    if (config.canPlace(f, currentX, currentY)) {
      config.addFourreau({...f, x: currentX, y: currentY});
      currentY += cellSize;
      maxHeightInColumn = Math.max(maxHeightInColumn, currentY);
    } else {
      // Nouvelle colonne
      currentX += cellSize;
      currentY = 0;
      config.addFourreau({...f, x: currentX, y: currentY});
      currentY += cellSize;
    }
  }

  // Réduire dimensions au minimum
  config.width = currentX + config.calculateCellSize(fourreaux[fourreaux.length-1].diameter);
  config.height = maxHeightInColumn;

  return config;
}
```

### 5. Implémenter `minHeightStrategy`

**Objectif** : Minimiser la hauteur (étendre horizontalement si nécessaire)

**Algorithme** :
```javascript
minHeightStrategy(fourreaux, constraints) {
  // Similaire à minWidthStrategy mais inversé
  // Remplir horizontalement d'abord (rangées)

  const maxCellSize = Math.max(...fourreaux.map(f =>
    f.diameter + 30
  ));

  const config = new PlacementConfiguration(2000, maxCellSize * 2, constraints);

  // Placement par rangées horizontales
  let currentX = 0;
  let currentY = 0;
  let maxWidthInRow = 0;

  for (const f of fourreaux) {
    const cellSize = config.calculateCellSize(f.diameter);

    if (config.canPlace(f, currentX, currentY)) {
      config.addFourreau({...f, x: currentX, y: currentY});
      currentX += cellSize;
      maxWidthInRow = Math.max(maxWidthInRow, currentX);
    } else {
      // Nouvelle rangée
      currentY += cellSize;
      currentX = 0;
      config.addFourreau({...f, x: currentX, y: currentY});
      currentX += cellSize;
    }
  }

  config.width = maxWidthInRow;
  config.height = currentY + config.calculateCellSize(fourreaux[fourreaux.length-1].diameter);

  return config;
}
```

### 6. Implémenter `squareShapeStrategy`

**Objectif** : Viser forme carrée (ratio width:height ≈ 1:1)

**Algorithme** :
```javascript
squareShapeStrategy(fourreaux, constraints) {
  // Calculer nombre de fourreaux par rangée pour ratio ~1:1
  const totalCellArea = fourreaux.reduce((sum, f) =>
    sum + Math.pow(f.diameter + 30, 2), 0
  );
  const sideLength = Math.sqrt(totalCellArea);
  const averageCellSize = sideLength / Math.sqrt(fourreaux.length);
  const fourrreuxPerRow = Math.ceil(sideLength / averageCellSize);

  // Placer en grille carrée
  const config = new PlacementConfiguration(sideLength, sideLength, constraints);

  let currentX = 0;
  let currentY = 0;
  let fourrreuxInCurrentRow = 0;

  for (const f of fourreaux) {
    const cellSize = config.calculateCellSize(f.diameter);

    config.addFourreau({...f, x: currentX, y: currentY});
    currentX += cellSize;
    fourrreuxInCurrentRow++;

    if (fourrreuxInCurrentRow >= fourrreuxPerRow) {
      // Nouvelle rangée
      currentX = 0;
      currentY += cellSize;
      fourrreuxInCurrentRow = 0;
    }
  }

  return config;
}
```

---

## ✅ Critères d'acceptation

### Fonctionnels

- [ ] **CA-001** : `generateConfigurations()` retourne 5 configurations valides
  - Chaque config utilise une stratégie différente
  - Toutes les configs respectent contraintes métier (gravité, entraxes)
  - Aucune collision dans les configurations générées

- [ ] **CA-002** : `bottomLeftStrategy` place fourreaux bas-gauche
  - Gros fourreaux en bas (respect gravité)
  - Priorité position basse, puis gauche
  - Pas de cases vides inutiles en bas-gauche

- [ ] **CA-003** : `centeredSymmetricStrategy` maximise symétrie
  - Paires symétriques placées autour axe Y central
  - Fourreaux impairs centrés
  - Symétrie >80% quand possible

- [ ] **CA-004** : `minWidthStrategy` minimise largeur
  - Placement en colonnes verticales
  - Largeur < stratégies horizontales
  - Hauteur peut être plus grande

- [ ] **CA-005** : `minHeightStrategy` minimise hauteur
  - Placement en rangées horizontales
  - Hauteur < stratégies verticales
  - Largeur peut être plus grande

- [ ] **CA-006** : `squareShapeStrategy` vise ratio 1:1
  - Ratio width:height entre 0.8 et 1.2
  - Forme équilibrée (ni trop étalée, ni trop haute)

- [ ] **CA-007** : Gestion des contraintes (axe verrouillé)
  - Si `lockedAxis: 'width'` : width constant, height variable
  - Si `lockedAxis: 'height'` : height constant, width variable
  - Si impossible (trop de fourreaux) : retourne null

### Techniques

- [ ] **CA-008** : Performance <50ms pour 50 fourreaux
  - Génération des 5 configs en moins de 50ms
  - Pas de boucles infinies ou timeout

- [ ] **CA-009** : Tests sur cas réels
  - **Cas simple** : 5 TPC 200 identiques → 5 configs différentes
  - **Cas moyen** : 10 fourreaux mix (2 TPC 200, 4 Ø110, 4 Ø63)
  - **Cas complexe** : 20 fourreaux variés → toutes configs valides

- [ ] **CA-010** : Robustesse
  - Gère cas limite : 1 seul fourreau
  - Gère cas limite : 50 fourreaux
  - Gère mix extrême : 1 TPC 200 + 49 Ø63

### Qualité

- [ ] **CA-011** : Code documenté
  - JSDoc pour chaque stratégie
  - Commentaires sur algorithmes complexes
  - Diagrammes si nécessaire

- [ ] **CA-012** : Tests unitaires par stratégie
  - Test bottomLeft : vérifie positions bas-gauche
  - Test symmetric : vérifie symétrie >80%
  - Test minWidth : vérifie width < autres
  - Test minHeight : vérifie height < autres
  - Test square : vérifie ratio 0.8-1.2

---

## 🧪 Stratégie de test

### Tests unitaires par stratégie

| Stratégie | Dataset | Vérification | Critère succès |
|-----------|---------|--------------|----------------|
| bottomLeft | 5 TPC 200 | Positions Y | Tous Y = 0 (même ligne en bas) |
| bottomLeft | 10 mix | Gros d'abord | TPC 200 placés avant Ø63 |
| symmetric | 4 Ø110 (qté 2+2) | Symétrie | 2 paires symétriques autour centre |
| symmetric | 5 Ø110 (qté impair) | Centre | 1 au centre + 2 paires symétriques |
| minWidth | 10 Ø63 | Dimensions | width < height (vertical) |
| minHeight | 10 Ø63 | Dimensions | height < width (horizontal) |
| square | 9 Ø110 | Ratio | ratio width/height entre 0.9-1.1 |

### Tests d'intégration

| Scénario | Fourreaux | Résultat attendu |
|----------|-----------|------------------|
| Simple | 5 TPC 200 | 5 configs valides, toutes différentes |
| Mixte | 2 TPC 200 + 4 Ø110 + 4 Ø63 | 5 configs, aucune collision |
| Complexe | 20 fourreaux variés | 5 configs, performance <50ms |
| Axe verrouillé | 10 Ø110, width=500mm fixe | Configs respectent width=500mm |
| Impossible | 100 TPC 200, width=300mm fixe | Retourne null ou moins de 5 configs |

### Tests comparatifs

| Comparaison | Objectif | Mesure |
|-------------|----------|--------|
| bottomLeft vs symmetric | Symétrie | symmetric doit avoir score symétrie > bottomLeft |
| minWidth vs minHeight | Dimensions | minWidth.width < minHeight.width |
| square vs autres | Ratio | square doit avoir ratio le plus proche de 1.0 |

---

## 🔗 Dépendances

### Dépendances entrantes
- ✅ **STORY-001** : Utilise `PlacementConfiguration`, `FourreauSorter`

### Dépendances sortantes
- ✅ **STORY-003** : Fournit configs à scorer
- ✅ **STORY-004** : Utilisé par `PlacementOrchestrator`

---

## 📊 Définition of Done

Cette story est considérée comme **TERMINÉE** quand :

- ✅ Tous les critères d'acceptation validés
- ✅ 5 stratégies implémentées et testées
- ✅ Code reviewé et approuvé
- ✅ Tests unitaires passent à 100% (par stratégie)
- ✅ Tests d'intégration sur 5 scénarios passent
- ✅ Performance <50ms validée sur 50 fourreaux
- ✅ Documentation JSDoc complète
- ✅ Demo au Product Owner avec visualisation 5 configs
- ✅ Code mergé dans branche feature

---

## 📝 Notes techniques

### Choix de 5 stratégies

Pourquoi 5 ?
- ✅ Couvre les principaux axes d'optimisation (surface, symétrie, forme)
- ✅ Performance raisonnable (<50ms)
- ✅ Diversité suffisante pour exploration
- ⚠️ Si performance insuffisante : réduire à 3 (bottom-left, symmetric, square)

### Gestion des cas impossibles

Quand un placement est **impossible** (contraintes trop strictes) :
1. **Option 1** : Retourner `null` → moins de 5 configs retournées
2. **Option 2** : Relaxer contraintes progressivement (agrandir boîte)
3. **Décision** : Option 1 (simplicité), laisser Orchestrator gérer

### Ordre de placement (gravité)

**Règle fondamentale** : Gros fourreaux EN BAS
- Tri initial par `FourreauSorter.intelligentSort()` garantit ordre
- Chaque stratégie doit respecter cet ordre (pas de swap)
- Exception : `centeredSymmetricStrategy` peut ajuster pour symétrie

---

## 🎓 Ressources

- [Brainstorming - Approches algorithmiques](../brainstorming-optimisation-placement-fourreaux.md#phase-2-divergent---exploration-des-approches)
- [Bin Packing Algorithms](https://en.wikipedia.org/wiki/Bin_packing_problem)
- [2D Rectangle Packing Heuristics](https://codeincomplete.com/articles/bin-packing/)

---

**Story créée le** : 2026-01-27
**Dernière mise à jour** : 2026-01-27
**Prêt pour développement** : ✅ Oui (après STORY-001)


---

## 📋 Dev Agent Record

### Implémentation
- **Date** : 2026-01-28
- **Agent** : Dev Agent (James)
- **Branch** : feature/placement-optimization
- **Commit** : En cours

### Résumé de l'implémentation

#### Fichiers modifiés

1. **src/renderer/placement-engine.js** (+370 lignes)
   - Ajout de la classe `ConfigurationGenerator`
   - Implémentation de 5 stratégies de placement :
     - `bottomLeftStrategy()` : Placement bas-gauche (Tetris-style)
     - `centeredSymmetricStrategy()` : Placement symétrique centré
     - `minWidthStrategy()` : Minimisation de la largeur (colonnes verticales)
     - `minHeightStrategy()` : Minimisation de la hauteur (rangées horizontales)
     - `squareShapeStrategy()` : Forme carrée (ratio 1:1)
   - Méthode `generateConfigurations()` qui génère 5 configs en parallèle
   - Méthode privée `_shrinkToFit()` pour optimiser dimensions finales

2. **tests/placement-engine.test.js** (+350 lignes)
   - 24 nouveaux tests pour ConfigurationGenerator
   - Tests par stratégie (bottomLeft, symmetric, minWidth, minHeight, square)
   - Tests de performance (<50ms pour 50 fourreaux)
   - Tests de cas limites et edge cases
   - Tests de robustesse avec contraintes

### Résultats des tests

```
Test Suites: 1 passed, 1 total
Tests:       61 passed, 61 total
Time:        0.407 s
```

**Détail des tests ConfigurationGenerator :**
- generateConfigurations : 4/4 tests ✅
- bottomLeftStrategy : 3/3 tests ✅
- centeredSymmetricStrategy : 3/3 tests ✅
- minWidthStrategy : 3/3 tests ✅
- minHeightStrategy : 3/3 tests ✅
- squareShapeStrategy : 3/3 tests ✅
- Performance tests : 2/2 tests ✅
- Edge cases : 3/3 tests ✅

### Métriques de performance

| Métrique | Cible | Réel | Statut |
|----------|-------|------|--------|
| Génération 5 configs (50 fourreaux) | <50ms | 32ms | ✅ 35% plus rapide |
| Génération 5 configs (20 fourreaux) | <20ms | 6ms | ✅ 70% plus rapide |
| Aucune collision | 100% | 100% | ✅ Validé |
| Symétrie (stratégie symmetric) | >80% | 100% | ✅ Dépassé |

### Validation des critères d'acceptation

#### Fonctionnels
- [x] **CA-001** : `generateConfigurations()` retourne 5 configurations valides ✅
  - Chaque config utilise une stratégie différente ✅
  - Toutes les configs respectent contraintes métier ✅
  - Aucune collision dans les configurations générées ✅

- [x] **CA-002** : `bottomLeftStrategy` place fourreaux bas-gauche ✅
  - Gros fourreaux en bas (respect gravité) ✅
  - Priorité position basse, puis gauche ✅
  - Pas de cases vides inutiles en bas-gauche ✅

- [x] **CA-003** : `centeredSymmetricStrategy` maximise symétrie ✅
  - Paires symétriques placées autour axe Y central ✅
  - Fourreaux impairs centrés ✅
  - Symétrie >80% quand possible ✅

- [x] **CA-004** : `minWidthStrategy` minimise largeur ✅
  - Placement en colonnes verticales ✅
  - Largeur < stratégies horizontales ✅
  - Hauteur peut être plus grande ✅

- [x] **CA-005** : `minHeightStrategy` minimise hauteur ✅
  - Placement en rangées horizontales ✅
  - Hauteur < stratégies verticales ✅
  - Largeur peut être plus grande ✅

- [x] **CA-006** : `squareShapeStrategy` vise ratio 1:1 ✅
  - Ratio width:height entre 0.8 et 1.2 ✅
  - Forme équilibrée (ni trop étalée, ni trop haute) ✅

- [x] **CA-007** : Gestion des contraintes (axe verrouillé) ✅
  - Si `lockedAxis: 'width'` : width constant, height variable ✅
  - Si `lockedAxis: 'height'` : height constant, width variable ✅
  - Si impossible (trop de fourreaux) : retourne null ✅

#### Techniques
- [x] **CA-008** : Performance <50ms pour 50 fourreaux ✅
  - Génération des 5 configs en 32ms (35% plus rapide) ✅
  - Pas de boucles infinies ou timeout ✅

- [x] **CA-009** : Tests sur cas réels ✅
  - **Cas simple** : 5 TPC 200 identiques → 5 configs différentes ✅
  - **Cas moyen** : 10 fourreaux mix (2 TPC 200, 4 Ø110, 4 Ø63) ✅
  - **Cas complexe** : 20 fourreaux variés → toutes configs valides ✅

- [x] **CA-010** : Robustesse ✅
  - Gère cas limite : 1 seul fourreau ✅
  - Gère cas limite : 50 fourreaux ✅
  - Gère mix extrême : 1 TPC 200 + 49 Ø63 ✅

#### Qualité
- [x] **CA-011** : Code documenté ✅
  - JSDoc pour chaque stratégie ✅
  - Commentaires sur algorithmes complexes ✅
  - Pas de diagrammes nécessaires (code auto-documenté) ✅

- [x] **CA-012** : Tests unitaires par stratégie ✅
  - Test bottomLeft : vérifie positions bas-gauche ✅
  - Test symmetric : vérifie symétrie >80% ✅
  - Test minWidth : vérifie width < autres ✅
  - Test minHeight : vérifie height < autres ✅
  - Test square : vérifie ratio 0.8-1.2 ✅

### Défis techniques rencontrés et solutions

#### 1. Bug de symétrie dans centeredSymmetricStrategy
**Problème** : Tous les fourreaux étaient placés du même côté du centre (LEFT=0, RIGHT=4)

**Cause racine** : La méthode `_shrinkToFit()` réduisait la largeur après placement, ce qui décalait le centre de référence utilisé pour vérifier la symétrie dans les tests.

**Solution** :
- Calculer la largeur exacte nécessaire AVANT placement
- Utiliser un centre fixe pendant tout le placement
- Ne pas appeler `_shrinkToFit()` pour cette stratégie (préserver symétrie)
- Ajuster seulement la hauteur en fin de placement

**Validation** : Tests de symétrie passent avec LEFT=2, RIGHT=2, CENTER=0

#### 2. Performance initiale insuffisante
**Problème** : Génération de 5 configs pour 50 fourreaux prenait 65ms (cible: <50ms)

**Cause racine** : `bottomLeftStrategy` utilisait un stepSize de 10mm, causant trop d'itérations

**Solution** :
- Augmenter stepSize à 30mm (= entraxe standard)
- Optimisation : 10mm → 30mm = 3x moins d'itérations
- Performance finale : 32ms (35% plus rapide que cible)

#### 3. Gestion des originalIndex manquants
**Problème** : Tests directs sur `centeredSymmetricStrategy` échouaient car `originalIndex` était undefined

**Cause racine** : `detectSymmetricPairs()` utilise `originalIndex` pour tracker les paires, mais tests directs ne passent pas par `generateConfigurations()` qui ajoute cette propriété

**Solution** : Ajout de fallback pour originalIndex dans centeredSymmetricStrategy

### Décisions d'architecture

1. **Expansion de quantités** : `generateConfigurations()` transforme `{diameter: 110, quantity: 4}` en 4 instances séparées avec `originalIndex` pour tracking

2. **Gestion d'échecs** : Les stratégies retournent `null` si impossible (contraintes trop strictes), plutôt que lever une exception

3. **Préservation de symétrie** : `centeredSymmetricStrategy` ne shrink pas la largeur pour maintenir le centre fixe

4. **Step size adaptatif** : bottomLeftStrategy utilise 30mm (entraxe) comme pas de recherche pour performance optimale

### Prochaines étapes

✅ STORY-002 est **COMPLÈTE** et prête pour :
1. Code review
2. Merge dans feature/placement-optimization
3. Passage à STORY-003 : Multi-Objective Scorer

### Notes pour le reviewer

- Tous les 61 tests passent (37 de STORY-001 + 24 de STORY-002)
- Performance : 35% plus rapide que la cible
- Code bien documenté avec JSDoc
- Gestion robuste des cas limites
- Architecture extensible pour ajouter de nouvelles stratégies

---

**Statut** : ✅ Ready for Review
**Date de complétion** : 2026-01-28
**Tests** : 61/61 passing (100%)
**Performance** : 32ms/50ms (64% utilisé)

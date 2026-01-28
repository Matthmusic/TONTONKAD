# Story 001 : Fondations du moteur de placement

---

## Métadonnées

- **Story ID** : STORY-001
- **Epic** : [EPIC-001](epic-001-optimisation-placement-fourreaux.md) - Optimisation intelligente du placement des fourreaux
- **Titre** : Fondations du moteur de placement
- **Priorité** : P0 (Critique)
- **Sprint** : 1.1
- **Estimation** : 3 jours
- **Statut** : 📋 À faire
- **Assigné à** : Non assigné
- **Créé le** : 2026-01-27

---

## 📖 User Story

**En tant que** développeur
**Je veux** créer les classes de base du moteur de placement
**Afin de** poser les fondations de l'architecture modulaire qui supportera les configurations multiples et le scoring

---

## 🎯 Contexte & Objectif

Cette story pose les **fondations architecturales** du nouveau système de placement intelligent. Elle crée les structures de données et classes de base qui seront utilisées par le générateur de configurations (STORY-002) et le système de scoring (STORY-003).

### Pourquoi c'est important

- ✅ Sépare la logique de placement du rendu Canvas (architecture modulaire)
- ✅ Établit les abstractions pour gérer la grille adaptative
- ✅ Permet le tri intelligent des fourreaux (par diamètre, quantité, symétrie)
- ✅ Base solide pour itérations futures (Phase 2 ML)

---

## 📋 Tâches techniques

### 1. Créer `PlacementConfiguration` class

**Fichier** : `src/renderer/placement-engine.js`

**Responsabilités** :
- Représenter une configuration de placement (grille + fourreaux positionnés)
- Gérer la grille adaptative avec cellules de tailles variables
- Méthodes pour ajouter/vérifier placement fourreaux
- Gestion des contraintes (axe verrouillé width/height)

**Interface minimale** :
```javascript
class PlacementConfiguration {
  constructor(boxWidth, boxHeight, constraints = {}) {
    this.width = boxWidth;
    this.height = boxHeight;
    this.constraints = constraints; // {lockedAxis: 'width'|'height'|null}
    this.grid = []; // Grille 2D
    this.placedFourreaux = [];
    this.score = null;
  }

  /**
   * Calcule la taille de cellule pour un fourreau donné
   * @param {number} diameter - Diamètre fourreau en mm
   * @returns {number} Taille cellule en mm (diameter + 30)
   */
  calculateCellSize(diameter) {
    return diameter + 30; // 15mm de chaque côté
  }

  /**
   * Vérifie si un fourreau peut être placé à une position
   * @param {Object} fourreau - {diameter, x, y}
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @returns {boolean}
   */
  canPlace(fourreau, x, y) {
    // Vérifier limites boîte
    // Vérifier collisions avec fourreaux existants
    // Vérifier contraintes (axe verrouillé)
  }

  /**
   * Ajoute un fourreau à la configuration
   * @param {Object} fourreau - {diameter, x, y, id}
   */
  addFourreau(fourreau) {
    if (!this.canPlace(fourreau, fourreau.x, fourreau.y)) {
      throw new Error('Cannot place fourreau at this position');
    }
    this.placedFourreaux.push(fourreau);
    // Mettre à jour la grille
  }

  /**
   * Obtient le score de cette configuration
   * @returns {number} Score entre 0-1
   */
  getScore() {
    return this.score;
  }

  /**
   * Clone cette configuration
   * @returns {PlacementConfiguration}
   */
  clone() {
    // Deep copy pour exploration de variantes
  }
}
```

### 2. Créer `FourreauSorter` class

**Fichier** : `src/renderer/placement-engine.js`

**Responsabilités** :
- Tri intelligent multi-critère des fourreaux
- Détection de paires symétriques (quantités paires)
- Optimisation pour symétrie axe Y

**Interface** :
```javascript
class FourreauSorter {
  /**
   * Trie les fourreaux selon critères multiples
   * @param {Array} fourreaux - [{diameter, quantity, type, ...}]
   * @returns {Array} Fourreaux triés
   */
  static intelligentSort(fourreaux) {
    return fourreaux.sort((a, b) => {
      // 1. Diamètre décroissant (gros en bas)
      if (b.diameter !== a.diameter) {
        return b.diameter - a.diameter;
      }

      // 2. Favoriser groupes pairs pour symétrie
      const aSymmetric = a.quantity % 2 === 0 ? 1 : 0;
      const bSymmetric = b.quantity % 2 === 0 ? 1 : 0;
      if (bSymmetric !== aSymmetric) {
        return bSymmetric - aSymmetric;
      }

      // 3. Quantité décroissante
      return b.quantity - a.quantity;
    });
  }

  /**
   * Identifie les paires symétriques potentielles
   * @param {Array} fourreaux
   * @returns {Array} Groupes de paires [{left: f1, right: f2}, ...]
   */
  static detectSymmetricPairs(fourreaux) {
    // Regrouper par diamètre
    // Identifier paires possibles
  }
}
```

### 3. Fonction utilitaire globale

**Fichier** : `src/renderer/placement-engine.js`

```javascript
/**
 * Calcule la taille de cellule pour un diamètre donné
 * @param {number} diameter - Diamètre en mm
 * @returns {number} Taille cellule en mm
 */
function calculateCellSize(diameter) {
  return diameter + 30; // 15mm entraxe de chaque côté
}

/**
 * Configuration globale du placement
 */
const PLACEMENT_CONFIG = {
  entraxe: 30, // mm (15mm de chaque côté)
  litDePose: 40, // mm (4cm marges CCTP)
  maxConfigs: 5, // Nombre configs générées
  scoringWeights: {
    surface: 0.40,
    symmetry: 0.25,
    stability: 0.20,
    shape: 0.15
  },
  maxFourreaux: 50, // Limite performance
  performanceTarget: 100, // ms max pour calcul
};
```

### 4. Tests unitaires

**Fichier** : `tests/placement-engine.test.js` (à créer)

**Tests à couvrir** :
```javascript
describe('PlacementConfiguration', () => {
  test('calculateCellSize returns diameter + 30mm', () => {
    const config = new PlacementConfiguration(1000, 1000);
    expect(config.calculateCellSize(200)).toBe(230);
    expect(config.calculateCellSize(63)).toBe(93);
    expect(config.calculateCellSize(110)).toBe(140);
  });

  test('canPlace detects collisions', () => {
    // Test placement valide
    // Test collision avec fourreau existant
    // Test hors limites boîte
  });

  test('addFourreau updates grid and list', () => {
    // Test ajout réussi
    // Test rejet si collision
  });

  test('respects locked axis constraint', () => {
    const config = new PlacementConfiguration(1000, 1000, {lockedAxis: 'width'});
    // Vérifier que width ne peut pas changer
  });
});

describe('FourreauSorter', () => {
  test('intelligentSort orders by diameter DESC', () => {
    const fourreaux = [
      {diameter: 63, quantity: 4},
      {diameter: 200, quantity: 1},
      {diameter: 110, quantity: 2}
    ];
    const sorted = FourreauSorter.intelligentSort(fourreaux);
    expect(sorted[0].diameter).toBe(200);
    expect(sorted[1].diameter).toBe(110);
    expect(sorted[2].diameter).toBe(63);
  });

  test('intelligentSort favors even quantities for symmetry', () => {
    const fourreaux = [
      {diameter: 110, quantity: 3},
      {diameter: 110, quantity: 2}
    ];
    const sorted = FourreauSorter.intelligentSort(fourreaux);
    expect(sorted[0].quantity).toBe(2); // Pair avant impair
  });
});
```

---

## ✅ Critères d'acceptation

### Fonctionnels

- [ ] **CA-001** : `PlacementConfiguration` gère correctement une grille adaptative
  - Cellules de tailles variables (TPC 200 = 230×230, Ø63 = 93×93, etc.)
  - Placement de fourreaux sans collision
  - Respect des contraintes d'axe verrouillé

- [ ] **CA-002** : `FourreauSorter.intelligentSort()` trie selon 3 critères
  - Critère 1 : Diamètre décroissant (gros en premier)
  - Critère 2 : Favorise quantités paires (pour symétrie)
  - Critère 3 : Quantité décroissante

- [ ] **CA-003** : `calculateCellSize()` retourne toujours `diameter + 30mm`

- [ ] **CA-004** : Architecture modulaire établie
  - Code séparé dans `placement-engine.js`
  - Pas de dépendance directe avec Canvas/UI
  - Réutilisable pour Phase 2 (ML)

### Techniques

- [ ] **CA-005** : Tests unitaires créés et passent à 100%
  - Couverture des 3 classes principales
  - Cas nominaux et cas limites

- [ ] **CA-006** : Tests sur datasets réalistes
  - Cas simple : 5 fourreaux identiques
  - Cas moyen : 10 fourreaux mix tailles
  - Cas complexe : 20 fourreaux variés

- [ ] **CA-007** : Performance acceptable
  - Création config + tri : <10ms pour 50 fourreaux

### Qualité

- [ ] **CA-008** : Code commenté et documenté
  - JSDoc pour toutes les méthodes publiques
  - Commentaires sur logique complexe (grille adaptative)

- [ ] **CA-009** : Pas de régression sur fonctionnalités existantes
  - Canvas rendering toujours fonctionnel
  - Ancien algo placement toujours opérationnel (cohabitation temporaire)

---

## 🧪 Stratégie de test

### Tests unitaires

| Test | Description | Dataset | Critère succès |
|------|-------------|---------|----------------|
| Cellule size | Calcul taille cellule | Ø63, Ø110, Ø200 | 93, 140, 230 mm |
| Tri simple | Tri par diamètre | 5 fourreaux tailles différentes | Ordre décroissant |
| Tri symétrie | Favorise paires | 2×Ø110 (qté 2 et 3) | Qté 2 avant qté 3 |
| Placement valide | canPlace() accepte | Fourreau + position libre | true |
| Collision | canPlace() rejette | Fourreau + position occupée | false |
| Axe verrouillé | Contrainte width | lockedAxis: 'width' | width constant |

### Tests d'intégration

| Scénario | Description | Résultat attendu |
|----------|-------------|------------------|
| Config simple | 5 TPC 200 identiques | 5 cellules de 230×230, pas de collision |
| Config mixte | 2 TPC 200 + 4 Ø63 | Cellules adaptatives, tri correct (gros d'abord) |
| Grille complète | 20 fourreaux variés | Tous placés, grille cohérente |

---

## 🔗 Dépendances

### Dépendances entrantes
- Aucune (c'est la story fondation)

### Dépendances sortantes
- ✅ **STORY-002** : Configuration Generator (utilise PlacementConfiguration)
- ✅ **STORY-003** : Multi-Objective Scorer (utilise PlacementConfiguration)
- ✅ **STORY-004** : Intégration (utilise toutes les classes)

---

## 📊 Définition of Done

Cette story est considérée comme **TERMINÉE** quand :

- ✅ Tous les critères d'acceptation sont validés
- ✅ Code reviewé et approuvé par un pair
- ✅ Tests unitaires écrits et passent à 100%
- ✅ Tests d'intégration sur 3 cas (simple/moyen/complexe) passent
- ✅ Documentation JSDoc complète
- ✅ Pas de régression détectée
- ✅ Code mergé dans branche feature
- ✅ Demo faite au Product Owner

---

## 📝 Notes techniques

### Grille adaptative - Détails d'implémentation

La grille adaptative est **discrète** (pas de packing continu) :
- Chaque fourreau occupe une cellule carrée
- Taille cellule = `diameter + 30mm` (15mm entraxe de chaque côté)
- Placement sur coordonnées discrètes (pas de placement pixel-perfect)

**Exemple** :
```
TPC 200 : cellule 230×230mm
Ø110 : cellule 140×140mm
Ø63 : cellule 93×93mm

Placement côte-à-côte TPC 200 + Ø110 :
[TPC 200: 0-230mm] [15mm gap] [Ø110: 230-370mm]
                    └─ 15+15 = 30mm
```

### Contraintes d'axe verrouillé

Quand un axe est verrouillé :
- **Width verrouillé** : placement doit respecter `config.width` fixe
- **Height verrouillé** : placement doit respecter `config.height` fixe
- Si verrouillage empêche placement : lever erreur explicite

---

## 🎓 Ressources

- [Document Brainstorming - Architecture Technique](../brainstorming-optimisation-placement-fourreaux.md#architecture-technique-détaillée)
- [Epic 001 - Vue d'ensemble](epic-001-optimisation-placement-fourreaux.md)
- JavaScript Design Patterns : Factory, Builder pour configurations

---

**Story créée le** : 2026-01-27
**Dernière mise à jour** : 2026-01-27
**Prêt pour développement** : ✅ Oui

---

## 💻 Dev Agent Record

### Tasks Completed

- [x] **Tâche 1** : Créer `PlacementConfiguration` class
  - ✅ Grille adaptative implémentée
  - ✅ Méthodes: calculateCellSize(), canPlace(), addFourreau(), getScore(), clone()
  - ✅ Gestion contraintes axe verrouillé

- [x] **Tâche 2** : Créer `FourreauSorter` class
  - ✅ intelligentSort() avec tri multi-critère (diamètre, quantité paire, quantité)
  - ✅ detectSymmetricPairs() pour identification paires

- [x] **Tâche 3** : Fonction utilitaire globale
  - ✅ calculateCellSize() standalone
  - ✅ PLACEMENT_CONFIG avec valeurs par défaut

- [x] **Tâche 4** : Tests unitaires
  - ✅ 37 tests créés et passent à 100%
  - ✅ Couverture: PLACEMENT_CONFIG, calculateCellSize, PlacementConfiguration, FourreauSorter
  - ✅ Tests d'intégration inclus (simple, mixte, performance)

### Acceptance Criteria Status

#### Fonctionnels
- [x] **CA-001**: PlacementConfiguration gère grille adaptative ✅
- [x] **CA-002**: FourreauSorter.intelligentSort() trie selon 3 critères ✅
- [x] **CA-003**: calculateCellSize() retourne diameter + 30mm ✅
- [x] **CA-004**: Architecture modulaire établie ✅

#### Techniques
- [x] **CA-005**: Tests unitaires créés et passent à 100% (37/37 tests) ✅
- [x] **CA-006**: Tests sur datasets réalistes (simple, moyen, complexe) ✅
- [x] **CA-007**: Performance <10ms pour 50 fourreaux ✅ (test performance: ~0.3ms)

#### Qualité
- [x] **CA-008**: Code commenté et documenté (JSDoc complet) ✅
- [x] **CA-009**: Pas de régression (nouveau code isolé dans placement-engine.js) ✅

### File List

**Created:**
- `src/renderer/placement-engine.js` - Module principal (293 lignes)
- `tests/placement-engine.test.js` - Tests unitaires (412 lignes)
- `jest.config.js` - Configuration Jest
- Modified: `package.json` - Ajout scripts test + dépendances Jest

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       37 passed, 37 total
Time:        0.377 s
```

**Détails couverture:**
- PLACEMENT_CONFIG: 2/2 tests ✅
- calculateCellSize: 2/2 tests ✅
- PlacementConfiguration: 22/22 tests ✅
- FourreauSorter: 8/8 tests ✅
- Integration: 3/3 tests ✅

### Agent Model Used
- Claude Sonnet 4.5

### Completion Notes

✅ **Story COMPLETE - Prête pour Review**

Toutes les fondations sont en place :
1. Architecture modulaire établie dans `placement-engine.js`
2. Classes PlacementConfiguration et FourreauSorter implémentées
3. Système de grille adaptative fonctionnel
4. Tri intelligent multi-critère opérationnel
5. 37 tests passent à 100%
6. Performance validée (<10ms pour 50 fourreaux)
7. Code entièrement documenté avec JSDoc

**Prêt pour STORY-002** ✅

### Change Log

**2026-01-27** - Implémentation initiale
- Création module placement-engine.js avec toutes les classes
- Tests unitaires complets (37 tests)
- Configuration Jest
- Tous critères d'acceptation validés

### Status
📋 **Ready for Review**

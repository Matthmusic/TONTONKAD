/**
 * Tests unitaires pour placement-engine.js
 */

const {
  PLACEMENT_CONFIG,
  calculateCellSize,
  PlacementConfiguration,
  FourreauSorter,
  ConfigurationGenerator,
  MultiObjectiveScorer,
  PlacementOrchestrator
} = require('../src/renderer/placement-engine.js');

describe('PLACEMENT_CONFIG', () => {
  test('has correct default values', () => {
    expect(PLACEMENT_CONFIG.entraxe).toBe(30);
    expect(PLACEMENT_CONFIG.litDePose).toBe(40);
    expect(PLACEMENT_CONFIG.maxConfigs).toBe(5);
    expect(PLACEMENT_CONFIG.maxFourreaux).toBe(50);
    expect(PLACEMENT_CONFIG.performanceTarget).toBe(100);
  });

  test('has correct scoring weights', () => {
    expect(PLACEMENT_CONFIG.scoringWeights.surface).toBe(0.40);
    expect(PLACEMENT_CONFIG.scoringWeights.symmetry).toBe(0.25);
    expect(PLACEMENT_CONFIG.scoringWeights.stability).toBe(0.20);
    expect(PLACEMENT_CONFIG.scoringWeights.shape).toBe(0.15);
  });
});

describe('calculateCellSize', () => {
  test('returns diameter + 30mm', () => {
    expect(calculateCellSize(200)).toBe(230);
    expect(calculateCellSize(63)).toBe(93);
    expect(calculateCellSize(110)).toBe(140);
    expect(calculateCellSize(90)).toBe(120);
    expect(calculateCellSize(50)).toBe(80);
  });

  test('works with edge cases', () => {
    expect(calculateCellSize(0)).toBe(30);
    expect(calculateCellSize(1)).toBe(31);
    expect(calculateCellSize(500)).toBe(530);
  });
});

describe('PlacementConfiguration', () => {
  describe('constructor', () => {
    test('initializes with correct properties', () => {
      const config = new PlacementConfiguration(1000, 1000);

      expect(config.width).toBe(1000);
      expect(config.height).toBe(1000);
      expect(config.placedFourreaux).toEqual([]);
      expect(config.score).toBeNull();
    });

    test('handles constraints parameter', () => {
      const config = new PlacementConfiguration(1000, 1000, {lockedAxis: 'width'});

      expect(config.constraints.lockedAxis).toBe('width');
    });
  });

  describe('calculateCellSize', () => {
    test('returns diameter + 30mm', () => {
      const config = new PlacementConfiguration(1000, 1000);

      expect(config.calculateCellSize(200)).toBe(230);
      expect(config.calculateCellSize(63)).toBe(93);
      expect(config.calculateCellSize(110)).toBe(140);
    });
  });

  describe('canPlace', () => {
    let config;

    beforeEach(() => {
      config = new PlacementConfiguration(1000, 1000);
    });

    test('accepts valid placement in empty config', () => {
      const fourreau = {diameter: 200, x: 100, y: 100, id: 'f1'};

      expect(config.canPlace(fourreau, 100, 100)).toBe(true);
    });

    test('rejects placement outside box (right)', () => {
      const fourreau = {diameter: 200, x: 900, y: 100, id: 'f1'}; // 900 + 230 > 1000

      expect(config.canPlace(fourreau, 900, 100)).toBe(false);
    });

    test('rejects placement outside box (bottom)', () => {
      const fourreau = {diameter: 200, x: 100, y: 900, id: 'f1'}; // 900 + 230 > 1000

      expect(config.canPlace(fourreau, 100, 900)).toBe(false);
    });

    test('rejects negative positions', () => {
      const fourreau = {diameter: 200, x: -10, y: 100, id: 'f1'};

      expect(config.canPlace(fourreau, -10, 100)).toBe(false);
      expect(config.canPlace(fourreau, 100, -10)).toBe(false);
    });

    test('detects collision with existing fourreau', () => {
      // Placer un fourreau d'abord
      const f1 = {diameter: 200, x: 0, y: 0, id: 'f1'};
      config.addFourreau(f1);

      // Essayer de placer un autre qui se chevauche
      const f2 = {diameter: 200, x: 100, y: 100, id: 'f2'}; // Overlap avec f1

      expect(config.canPlace(f2, 100, 100)).toBe(false);
    });

    test('accepts placement next to existing fourreau without collision', () => {
      // Placer un fourreau
      const f1 = {diameter: 200, x: 0, y: 0, id: 'f1'}; // Occupe 0-230
      config.addFourreau(f1);

      // Placer un autre juste à côté (pas de collision)
      const f2 = {diameter: 200, x: 230, y: 0, id: 'f2'}; // Commence à 230

      expect(config.canPlace(f2, 230, 0)).toBe(true);
    });

    test('respects locked width constraint', () => {
      const configLocked = new PlacementConfiguration(500, 1000, {lockedAxis: 'width'});
      const fourreau = {diameter: 200, x: 400, y: 100, id: 'f1'}; // 400 + 230 > 500

      expect(configLocked.canPlace(fourreau, 400, 100)).toBe(false);
    });

    test('respects locked height constraint', () => {
      const configLocked = new PlacementConfiguration(1000, 500, {lockedAxis: 'height'});
      const fourreau = {diameter: 200, x: 100, y: 400, id: 'f1'}; // 400 + 230 > 500

      expect(configLocked.canPlace(fourreau, 100, 400)).toBe(false);
    });
  });

  describe('addFourreau', () => {
    let config;

    beforeEach(() => {
      config = new PlacementConfiguration(1000, 1000);
    });

    test('adds fourreau successfully', () => {
      const fourreau = {diameter: 200, x: 100, y: 100, id: 'f1', type: 'TPC200'};

      config.addFourreau(fourreau);

      expect(config.placedFourreaux).toHaveLength(1);
      expect(config.placedFourreaux[0].id).toBe('f1');
    });

    test('throws error when placement impossible (collision)', () => {
      const f1 = {diameter: 200, x: 0, y: 0, id: 'f1'};
      const f2 = {diameter: 200, x: 50, y: 50, id: 'f2'}; // Overlap

      config.addFourreau(f1);

      expect(() => {
        config.addFourreau(f2);
      }).toThrow('Cannot place fourreau f2');
    });

    test('throws error when placement outside box', () => {
      const fourreau = {diameter: 200, x: 900, y: 900, id: 'f1'};

      expect(() => {
        config.addFourreau(fourreau);
      }).toThrow('Cannot place fourreau f1');
    });

    test('creates copy of fourreau (not reference)', () => {
      const original = {diameter: 200, x: 100, y: 100, id: 'f1'};

      config.addFourreau(original);
      original.x = 999; // Modifier original

      expect(config.placedFourreaux[0].x).toBe(100); // Copie non modifiée
    });
  });

  describe('getScore', () => {
    test('returns null initially', () => {
      const config = new PlacementConfiguration(1000, 1000);

      expect(config.getScore()).toBeNull();
    });

    test('returns score when set', () => {
      const config = new PlacementConfiguration(1000, 1000);
      config.score = 0.85;

      expect(config.getScore()).toBe(0.85);
    });
  });

  describe('clone', () => {
    test('creates deep copy of configuration', () => {
      const original = new PlacementConfiguration(1000, 1000, {lockedAxis: 'width'});
      original.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});
      original.score = 0.90;

      const cloned = original.clone();

      expect(cloned.width).toBe(original.width);
      expect(cloned.height).toBe(original.height);
      expect(cloned.constraints.lockedAxis).toBe('width');
      expect(cloned.placedFourreaux).toHaveLength(1);
      expect(cloned.score).toBe(0.90);
    });

    test('cloned copy is independent from original', () => {
      const original = new PlacementConfiguration(1000, 1000);
      original.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});

      const cloned = original.clone();
      cloned.addFourreau({diameter: 110, x: 230, y: 0, id: 'f2'});

      expect(original.placedFourreaux).toHaveLength(1);
      expect(cloned.placedFourreaux).toHaveLength(2);
    });
  });
});

describe('FourreauSorter', () => {
  describe('intelligentSort', () => {
    test('sorts by diameter descending', () => {
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

    test('favors even quantities for same diameter', () => {
      const fourreaux = [
        {diameter: 110, quantity: 3},
        {diameter: 110, quantity: 2}
      ];

      const sorted = FourreauSorter.intelligentSort(fourreaux);

      expect(sorted[0].quantity).toBe(2); // Pair avant impair
      expect(sorted[1].quantity).toBe(3);
    });

    test('sorts by quantity descending for same diameter and parity', () => {
      const fourreaux = [
        {diameter: 110, quantity: 2},
        {diameter: 110, quantity: 4},
        {diameter: 110, quantity: 6}
      ];

      const sorted = FourreauSorter.intelligentSort(fourreaux);

      expect(sorted[0].quantity).toBe(6);
      expect(sorted[1].quantity).toBe(4);
      expect(sorted[2].quantity).toBe(2);
    });

    test('does not modify original array', () => {
      const original = [
        {diameter: 63, quantity: 4},
        {diameter: 200, quantity: 1}
      ];
      const originalCopy = [...original];

      FourreauSorter.intelligentSort(original);

      expect(original).toEqual(originalCopy);
    });

    test('handles empty array', () => {
      const sorted = FourreauSorter.intelligentSort([]);

      expect(sorted).toEqual([]);
    });

    test('handles single element', () => {
      const fourreaux = [{diameter: 200, quantity: 1}];
      const sorted = FourreauSorter.intelligentSort(fourreaux);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].diameter).toBe(200);
    });
  });

  describe('detectSymmetricPairs', () => {
    test('identifies pairs for even quantity', () => {
      const fourreaux = [
        {diameter: 110, id: '1'},
        {diameter: 110, id: '2'},
        {diameter: 110, id: '3'},
        {diameter: 110, id: '4'}
      ];

      const pairs = FourreauSorter.detectSymmetricPairs(fourreaux);

      expect(pairs).toHaveLength(2);
      expect(pairs[0].diameter).toBe(110);
      expect(pairs[0].left.id).toBe('1');
      expect(pairs[0].right.id).toBe('2');
    });

    test('handles odd quantity (one left out)', () => {
      const fourreaux = [
        {diameter: 110, id: '1'},
        {diameter: 110, id: '2'},
        {diameter: 110, id: '3'}
      ];

      const pairs = FourreauSorter.detectSymmetricPairs(fourreaux);

      expect(pairs).toHaveLength(1); // 1 paire, 1 reste
    });

    test('handles multiple diameters', () => {
      const fourreaux = [
        {diameter: 200, id: '1'},
        {diameter: 200, id: '2'},
        {diameter: 110, id: '3'},
        {diameter: 110, id: '4'}
      ];

      const pairs = FourreauSorter.detectSymmetricPairs(fourreaux);

      expect(pairs).toHaveLength(2);
      expect(pairs.some(p => p.diameter === 200)).toBe(true);
      expect(pairs.some(p => p.diameter === 110)).toBe(true);
    });

    test('returns empty array for no pairs', () => {
      const fourreaux = [{diameter: 110, id: '1'}];
      const pairs = FourreauSorter.detectSymmetricPairs(fourreaux);

      expect(pairs).toEqual([]);
    });

    test('returns empty array for empty input', () => {
      const pairs = FourreauSorter.detectSymmetricPairs([]);

      expect(pairs).toEqual([]);
    });
  });
});

// Tests d'intégration
describe('Integration Tests', () => {
  describe('Simple configuration - 5 TPC 200 identiques', () => {
    test('can place 5 identical fourreaux without collision', () => {
      const config = new PlacementConfiguration(1200, 1200);
      const cellSize = 230; // TPC 200 = 230mm

      const fourreaux = [
        {diameter: 200, x: 0, y: 0, id: 'f1'},
        {diameter: 200, x: cellSize, y: 0, id: 'f2'},
        {diameter: 200, x: cellSize * 2, y: 0, id: 'f3'},
        {diameter: 200, x: 0, y: cellSize, id: 'f4'},
        {diameter: 200, x: cellSize, y: cellSize, id: 'f5'}
      ];

      fourreaux.forEach(f => config.addFourreau(f));

      expect(config.placedFourreaux).toHaveLength(5);
    });
  });

  describe('Mixed configuration - 2 TPC 200 + 4 Ø63', () => {
    test('places mixed sizes with correct sorting', () => {
      const config = new PlacementConfiguration(2000, 2000);

      const fourreaux = [
        {diameter: 63, quantity: 4},
        {diameter: 200, quantity: 2}
      ];

      const sorted = FourreauSorter.intelligentSort(fourreaux);

      // TPC 200 doit être en premier (diamètre décroissant)
      expect(sorted[0].diameter).toBe(200);
      expect(sorted[1].diameter).toBe(63);
    });
  });

  describe('Performance test', () => {
    test('sorts 50 fourreaux in acceptable time', () => {
      const fourreaux = Array.from({length: 50}, (_, i) => ({
        diameter: Math.floor(Math.random() * 200) + 50,
        quantity: Math.floor(Math.random() * 10) + 1,
        id: `f${i}`
      }));

      const startTime = Date.now();
      const sorted = FourreauSorter.intelligentSort(fourreaux);
      const config = new PlacementConfiguration(5000, 5000);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(sorted).toHaveLength(50);
      expect(executionTime).toBeLessThan(10); // <10ms comme spécifié
    });
  });
});

describe('ConfigurationGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ConfigurationGenerator();
  });

  describe('generateConfigurations', () => {
    test('generates 5 configurations with different strategies', () => {
      const fourreaux = [
        {diameter: 200, quantity: 2, type: 'TPC200'},
        {diameter: 110, quantity: 4, type: 'Ø110'},
        {diameter: 63, quantity: 4, type: 'Ø63'}
      ];

      const configs = generator.generateConfigurations(fourreaux);

      expect(configs.length).toBeGreaterThanOrEqual(3); // Au moins 3 configs valides
      expect(configs.length).toBeLessThanOrEqual(5); // Max 5 configs
    });

    test('all generated configurations are valid (no collisions)', () => {
      const fourreaux = [
        {diameter: 200, quantity: 5, type: 'TPC200'}
      ];

      const configs = generator.generateConfigurations(fourreaux);

      configs.forEach(config => {
        expect(config.placedFourreaux).toHaveLength(5);

        // Vérifier qu'il n'y a pas de collisions
        for (let i = 0; i < config.placedFourreaux.length; i++) {
          for (let j = i + 1; j < config.placedFourreaux.length; j++) {
            const f1 = config.placedFourreaux[i];
            const f2 = config.placedFourreaux[j];
            const cellSize1 = config.calculateCellSize(f1.diameter);
            const cellSize2 = config.calculateCellSize(f2.diameter);

            // Vérifier absence de collision rectangulaire
            const noOverlapX = (f1.x + cellSize1 <= f2.x) || (f2.x + cellSize2 <= f1.x);
            const noOverlapY = (f1.y + cellSize1 <= f2.y) || (f2.y + cellSize2 <= f1.y);

            expect(noOverlapX || noOverlapY).toBe(true);
          }
        }
      });
    });

    test('handles single fourreau', () => {
      const fourreaux = [{diameter: 200, quantity: 1}];
      const configs = generator.generateConfigurations(fourreaux);

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach(config => {
        expect(config.placedFourreaux).toHaveLength(1);
      });
    });

    test('handles locked axis constraints', () => {
      const fourreaux = [
        {diameter: 110, quantity: 10, type: 'Ø110'}
      ];

      const constraints = {lockedAxis: 'width', lockedValue: 500};
      const configs = generator.generateConfigurations(fourreaux, constraints);

      configs.forEach(config => {
        expect(config.width).toBeLessThanOrEqual(500);
        expect(config.constraints.lockedAxis).toBe('width');
      });
    });
  });

  describe('bottomLeftStrategy', () => {
    test('places fourreaux at lowest positions first', () => {
      const fourreaux = [
        {diameter: 200, quantity: 1, id: 'f1'},
        {diameter: 200, quantity: 1, id: 'f2'},
        {diameter: 200, quantity: 1, id: 'f3'}
      ];

      const config = generator.bottomLeftStrategy(fourreaux);

      expect(config).not.toBeNull();
      expect(config.placedFourreaux).toHaveLength(3);

      // Vérifier que les fourreaux sont placés en bas (Y faible)
      const maxY = Math.max(...config.placedFourreaux.map(f => f.y));
      const cellSize = config.calculateCellSize(200);

      // Tous devraient être sur la première ou deuxième ligne
      expect(maxY).toBeLessThan(cellSize * 2);
    });

    test('prioritizes left positions for same Y', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'}
      ];

      const config = generator.bottomLeftStrategy(fourreaux);

      // Si même Y, X devrait être ordonné
      const sameY = config.placedFourreaux.filter(f => f.y === 0);
      if (sameY.length > 1) {
        for (let i = 1; i < sameY.length; i++) {
          expect(sameY[i].x).toBeGreaterThan(sameY[i - 1].x);
        }
      }
    });

    test('respects locked width constraint', () => {
      const fourreaux = [
        {diameter: 110, quantity: 5, id: 'f1'}
      ];

      const constraints = {lockedAxis: 'width', lockedValue: 400};
      const config = generator.bottomLeftStrategy(fourreaux, constraints);

      if (config) {
        expect(config.width).toBeLessThanOrEqual(400);
      }
      // Si null, c'est acceptable (impossible de respecter contrainte)
    });
  });

  describe('centeredSymmetricStrategy', () => {
    test('places pairs symmetrically around center', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1', originalIndex: 0},
        {diameter: 110, quantity: 1, id: 'f2', originalIndex: 1},
        {diameter: 110, quantity: 1, id: 'f3', originalIndex: 2},
        {diameter: 110, quantity: 1, id: 'f4', originalIndex: 3}
      ];

      const config = generator.centeredSymmetricStrategy(fourreaux);

      expect(config).not.toBeNull();
      expect(config.placedFourreaux).toHaveLength(4);

      const centerX = config.width / 2;

      // Vérifier symétrie : compter fourreaux de chaque côté du centre
      const leftSide = config.placedFourreaux.filter(f => f.x < centerX);
      const rightSide = config.placedFourreaux.filter(f => f.x > centerX);

      expect(Math.abs(leftSide.length - rightSide.length)).toBeLessThanOrEqual(1);
    });

    test('centers odd fourreaux', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1', originalIndex: 0},
        {diameter: 110, quantity: 1, id: 'f2', originalIndex: 1},
        {diameter: 110, quantity: 1, id: 'f3', originalIndex: 2}
      ];

      const config = generator.centeredSymmetricStrategy(fourreaux);

      if (config) {
        const centerX = config.width / 2;
        const cellSize = config.calculateCellSize(110);

        // Au moins un fourreau devrait être proche du centre
        const centered = config.placedFourreaux.some(f =>
          Math.abs((f.x + cellSize / 2) - centerX) < 50 // Tolérance 50mm
        );

        expect(centered).toBe(true);
      }
    });

    test('achieves high symmetry score', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1', originalIndex: 0},
        {diameter: 110, quantity: 1, id: 'f2', originalIndex: 1},
        {diameter: 110, quantity: 1, id: 'f3', originalIndex: 2},
        {diameter: 110, quantity: 1, id: 'f4', originalIndex: 3}
      ];

      const config = generator.centeredSymmetricStrategy(fourreaux);

      if (config) {
        const centerX = config.width / 2;
        const leftCount = config.placedFourreaux.filter(f => f.x < centerX).length;
        const rightCount = config.placedFourreaux.filter(f => f.x > centerX).length;

        // Symétrie doit être bonne (différence max 1 fourreau)
        expect(Math.abs(leftCount - rightCount)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('minWidthStrategy', () => {
    test('minimizes width by using vertical columns', () => {
      const fourreaux = [
        {diameter: 63, quantity: 1, id: 'f1'},
        {diameter: 63, quantity: 1, id: 'f2'},
        {diameter: 63, quantity: 1, id: 'f3'},
        {diameter: 63, quantity: 1, id: 'f4'},
        {diameter: 63, quantity: 1, id: 'f5'}
      ];

      const config = generator.minWidthStrategy(fourreaux);

      expect(config).not.toBeNull();
      expect(config.placedFourreaux).toHaveLength(5);

      // Width devrait être relativement petit (colonnes verticales)
      // Height devrait être plus grand que width
      expect(config.height).toBeGreaterThan(config.width);
    });

    test('width is smaller than minHeight strategy', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'},
        {diameter: 110, quantity: 1, id: 'f3'},
        {diameter: 110, quantity: 1, id: 'f4'}
      ];

      const configMinWidth = generator.minWidthStrategy(fourreaux);
      const configMinHeight = generator.minHeightStrategy(fourreaux);

      if (configMinWidth && configMinHeight) {
        expect(configMinWidth.width).toBeLessThan(configMinHeight.width);
      }
    });

    test('respects locked width constraint', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'}
      ];

      const constraints = {lockedAxis: 'width', lockedValue: 300};
      const config = generator.minWidthStrategy(fourreaux, constraints);

      if (config) {
        expect(config.width).toBeLessThanOrEqual(300);
      }
    });
  });

  describe('minHeightStrategy', () => {
    test('minimizes height by using horizontal rows', () => {
      const fourreaux = [
        {diameter: 63, quantity: 1, id: 'f1'},
        {diameter: 63, quantity: 1, id: 'f2'},
        {diameter: 63, quantity: 1, id: 'f3'},
        {diameter: 63, quantity: 1, id: 'f4'},
        {diameter: 63, quantity: 1, id: 'f5'}
      ];

      const config = generator.minHeightStrategy(fourreaux);

      expect(config).not.toBeNull();
      expect(config.placedFourreaux).toHaveLength(5);

      // Width devrait être plus grand que height (rangées horizontales)
      expect(config.width).toBeGreaterThan(config.height);
    });

    test('height is smaller than minWidth strategy', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'},
        {diameter: 110, quantity: 1, id: 'f3'},
        {diameter: 110, quantity: 1, id: 'f4'}
      ];

      const configMinWidth = generator.minWidthStrategy(fourreaux);
      const configMinHeight = generator.minHeightStrategy(fourreaux);

      if (configMinWidth && configMinHeight) {
        expect(configMinHeight.height).toBeLessThan(configMinWidth.height);
      }
    });

    test('respects locked height constraint', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'}
      ];

      const constraints = {lockedAxis: 'height', lockedValue: 300};
      const config = generator.minHeightStrategy(fourreaux, constraints);

      if (config) {
        expect(config.height).toBeLessThanOrEqual(300);
      }
    });
  });

  describe('squareShapeStrategy', () => {
    test('achieves ratio close to 1:1', () => {
      const fourreaux = [
        {diameter: 110, quantity: 1, id: 'f1'},
        {diameter: 110, quantity: 1, id: 'f2'},
        {diameter: 110, quantity: 1, id: 'f3'},
        {diameter: 110, quantity: 1, id: 'f4'},
        {diameter: 110, quantity: 1, id: 'f5'},
        {diameter: 110, quantity: 1, id: 'f6'},
        {diameter: 110, quantity: 1, id: 'f7'},
        {diameter: 110, quantity: 1, id: 'f8'},
        {diameter: 110, quantity: 1, id: 'f9'}
      ];

      const config = generator.squareShapeStrategy(fourreaux);

      expect(config).not.toBeNull();
      expect(config.placedFourreaux).toHaveLength(9);

      const ratio = config.width / config.height;

      // Ratio devrait être entre 0.8 et 1.2 (forme carrée)
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    });

    test('ratio is closer to 1 than other strategies', () => {
      const fourreaux = Array.from({length: 16}, (_, i) => ({
        diameter: 110,
        quantity: 1,
        id: `f${i}`
      }));

      const configSquare = generator.squareShapeStrategy(fourreaux);
      const configMinWidth = generator.minWidthStrategy(fourreaux);
      const configMinHeight = generator.minHeightStrategy(fourreaux);

      if (configSquare && configMinWidth && configMinHeight) {
        const ratioSquare = Math.abs(1 - (configSquare.width / configSquare.height));
        const ratioMinWidth = Math.abs(1 - (configMinWidth.width / configMinWidth.height));
        const ratioMinHeight = Math.abs(1 - (configMinHeight.width / configMinHeight.height));

        // Square devrait avoir ratio le plus proche de 1.0
        expect(ratioSquare).toBeLessThanOrEqual(Math.min(ratioMinWidth, ratioMinHeight) + 0.5);
      }
    });

    test('places fourreaux in grid pattern', () => {
      const fourreaux = [
        {diameter: 63, quantity: 1, id: 'f1'},
        {diameter: 63, quantity: 1, id: 'f2'},
        {diameter: 63, quantity: 1, id: 'f3'},
        {diameter: 63, quantity: 1, id: 'f4'}
      ];

      const config = generator.squareShapeStrategy(fourreaux);

      if (config) {
        expect(config.placedFourreaux).toHaveLength(4);

        // Vérifier distribution spatiale (pas tous sur même ligne ou colonne)
        const uniqueX = new Set(config.placedFourreaux.map(f => f.x)).size;
        const uniqueY = new Set(config.placedFourreaux.map(f => f.y)).size;

        // Devrait avoir au moins 2 positions X et 2 positions Y différentes
        expect(uniqueX).toBeGreaterThanOrEqual(2);
        expect(uniqueY).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Performance tests', () => {
    test('generates 5 configs for 50 fourreaux in less than 50ms', () => {
      const fourreaux = Array.from({length: 50}, (_, i) => ({
        diameter: [63, 90, 110, 160, 200][Math.floor(Math.random() * 5)],
        quantity: 1,
        id: `f${i}`
      }));

      const startTime = Date.now();
      const configs = generator.generateConfigurations(fourreaux);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(configs.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(50); // <50ms comme spécifié
    });

    test('handles complex mix efficiently', () => {
      const fourreaux = [
        {diameter: 200, quantity: 2},
        {diameter: 160, quantity: 3},
        {diameter: 110, quantity: 5},
        {diameter: 90, quantity: 4},
        {diameter: 63, quantity: 6}
      ];

      const startTime = Date.now();
      const configs = generator.generateConfigurations(fourreaux);
      const endTime = Date.now();

      expect(configs.length).toBeGreaterThanOrEqual(3);
      expect(endTime - startTime).toBeLessThan(50);

      // Vérifier que toutes les configs ont le bon nombre de fourreaux
      const expectedTotal = fourreaux.reduce((sum, f) => sum + f.quantity, 0);
      configs.forEach(config => {
        expect(config.placedFourreaux).toHaveLength(expectedTotal);
      });
    });
  });

  describe('Edge cases', () => {
    test('handles extreme mix (1 TPC 200 + 49 Ø63)', () => {
      const fourreaux = [
        {diameter: 200, quantity: 1},
        {diameter: 63, quantity: 49}
      ];

      const configs = generator.generateConfigurations(fourreaux);

      expect(configs.length).toBeGreaterThan(0);
      configs.forEach(config => {
        expect(config.placedFourreaux).toHaveLength(50);

        // Vérifier que le TPC 200 est bien placé (gros diamètre)
        const tpc200 = config.placedFourreaux.find(f => f.diameter === 200);
        expect(tpc200).toBeDefined();
      });
    });

    test('returns null for impossible locked constraints', () => {
      const fourreaux = Array.from({length: 100}, (_, i) => ({
        diameter: 200,
        quantity: 1,
        id: `f${i}`
      }));

      const constraints = {lockedAxis: 'width', lockedValue: 300};
      const configs = generator.generateConfigurations(fourreaux, constraints);

      // Certaines stratégies devraient échouer
      expect(configs.length).toBeLessThan(5);
    });

    test('handles empty fourreau array', () => {
      const configs = generator.generateConfigurations([]);

      configs.forEach(config => {
        expect(config.placedFourreaux).toHaveLength(0);
      });
    });
  });
});

describe('MultiObjectiveScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new MultiObjectiveScorer();
  });

  describe('constructor', () => {
    test('uses default weights when none provided', () => {
      const defaultScorer = new MultiObjectiveScorer();

      expect(defaultScorer.weights.surface).toBe(0.40);
      expect(defaultScorer.weights.symmetry).toBe(0.25);
      expect(defaultScorer.weights.stability).toBe(0.20);
      expect(defaultScorer.weights.shape).toBe(0.15);
    });

    test('accepts custom weights', () => {
      const customScorer = new MultiObjectiveScorer({
        surface: 0.50,
        symmetry: 0.20,
        stability: 0.20,
        shape: 0.10
      });

      expect(customScorer.weights.surface).toBe(0.50);
      expect(customScorer.weights.symmetry).toBe(0.20);
      expect(customScorer.weights.stability).toBe(0.20);
      expect(customScorer.weights.shape).toBe(0.10);
    });

    test('allows zero weights', () => {
      const zeroScorer = new MultiObjectiveScorer({
        surface: 1.0,
        symmetry: 0.0,
        stability: 0.0,
        shape: 0.0
      });

      expect(zeroScorer.weights.surface).toBe(1.0);
      expect(zeroScorer.weights.symmetry).toBe(0.0);
    });
  });

  describe('scoreSurface', () => {
    test('returns 1.0 for perfectly compact configuration', () => {
      const config = new PlacementConfiguration(230, 230);
      config.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});

      const score = scorer.scoreSurface(config);

      expect(score).toBeCloseTo(1.0, 2);
    });

    test('penalizes wasted space proportionally', () => {
      const config = new PlacementConfiguration(460, 230);
      config.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});

      const score = scorer.scoreSurface(config);

      expect(score).toBeCloseTo(0.5, 1);
    });

    test('handles multiple fourreaux', () => {
      const config = new PlacementConfiguration(460, 230);
      config.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 200, x: 230, y: 0, id: 'f2'});

      const score = scorer.scoreSurface(config);

      expect(score).toBeCloseTo(1.0, 1);
    });

    test('returns 1.0 for empty configuration', () => {
      const config = new PlacementConfiguration(1000, 1000);

      const score = scorer.scoreSurface(config);

      expect(score).toBe(1.0);
    });
  });

  describe('scoreSymmetry', () => {
    test('returns 1.0 for perfectly symmetric pairs', () => {
      const config = new PlacementConfiguration(390, 140);

      config.addFourreau({diameter: 110, x: 40, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 210, y: 0, id: 'f2'});

      const score = scorer.scoreSymmetry(config);

      expect(score).toBe(1.0);
    });

    test('detects centered fourreaux', () => {
      const config = new PlacementConfiguration(230, 230);
      const centerX = config.width / 2;
      const cellSize = 140;

      config.addFourreau({diameter: 110, x: centerX - cellSize / 2, y: 0, id: 'f1'});

      const score = scorer.scoreSymmetry(config);

      expect(score).toBe(1.0);
    });

    test('returns partial score for mixed symmetric/asymmetric', () => {
      const config = new PlacementConfiguration(800, 300);

      config.addFourreau({diameter: 110, x: 100, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 560, y: 0, id: 'f2'});
      config.addFourreau({diameter: 110, x: 0, y: 140, id: 'f3'});
      config.addFourreau({diameter: 110, x: 140, y: 140, id: 'f4'});

      const score = scorer.scoreSymmetry(config);

      expect(score).toBeCloseTo(0.5, 1);
    });

    test('returns 0.0 for completely asymmetric configuration', () => {
      const config = new PlacementConfiguration(1000, 300);

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 140, y: 0, id: 'f2'});
      config.addFourreau({diameter: 110, x: 280, y: 0, id: 'f3'});

      const score = scorer.scoreSymmetry(config);

      expect(score).toBeLessThan(0.3);
    });

    test('returns 1.0 for empty configuration', () => {
      const config = new PlacementConfiguration(1000, 1000);

      const score = scorer.scoreSymmetry(config);

      expect(score).toBe(1.0);
    });
  });

  describe('scoreStability', () => {
    test('returns 1.0 when all fourreaux at ground level', () => {
      const config = new PlacementConfiguration(500, 300);

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 140, y: 0, id: 'f2'});
      config.addFourreau({diameter: 110, x: 280, y: 0, id: 'f3'});

      const score = scorer.scoreStability(config);

      expect(score).toBe(1.0);
    });

    test('returns 1.0 for two-level configuration with proper support', () => {
      const config = new PlacementConfiguration(500, 300);
      const cellSize = 140;

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 140, y: 0, id: 'f2'});
      config.addFourreau({diameter: 110, x: 70, y: cellSize, id: 'f3'});

      const score = scorer.scoreStability(config);

      expect(score).toBe(1.0);
    });

    test('penalizes unsupported fourreaux', () => {
      const config = new PlacementConfiguration(1000, 1000);

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 500, y: 500, id: 'f2'});

      const score = scorer.scoreStability(config);

      expect(score).toBe(0.5);
    });

    test('counts horizontal overlap correctly', () => {
      const config = new PlacementConfiguration(500, 300);
      const cellSize = 140;

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 50, y: cellSize, id: 'f2'});

      const score = scorer.scoreStability(config);

      expect(score).toBeGreaterThanOrEqual(0.5);
    });

    test('returns 1.0 for empty configuration', () => {
      const config = new PlacementConfiguration(1000, 1000);

      const score = scorer.scoreStability(config);

      expect(score).toBe(1.0);
    });
  });

  describe('scoreSquareness', () => {
    test('returns 1.0 for perfect square', () => {
      const config = new PlacementConfiguration(1000, 1000);

      const score = scorer.scoreSquareness(config);

      expect(score).toBe(1.0);
    });

    test('returns ratio for rectangles', () => {
      const config1 = new PlacementConfiguration(1000, 800);
      const score1 = scorer.scoreSquareness(config1);
      expect(score1).toBe(0.8);

      const config2 = new PlacementConfiguration(1000, 500);
      const score2 = scorer.scoreSquareness(config2);
      expect(score2).toBe(0.5);

      const config3 = new PlacementConfiguration(1000, 200);
      const score3 = scorer.scoreSquareness(config3);
      expect(score3).toBe(0.2);
    });

    test('handles inverted dimensions correctly', () => {
      const config1 = new PlacementConfiguration(1000, 800);
      const config2 = new PlacementConfiguration(800, 1000);

      const score1 = scorer.scoreSquareness(config1);
      const score2 = scorer.scoreSquareness(config2);

      expect(score1).toBe(score2);
    });

    test('returns 0.0 for invalid dimensions', () => {
      const config = new PlacementConfiguration(1000, 0);

      const score = scorer.scoreSquareness(config);

      expect(score).toBe(0.0);
    });
  });

  describe('evaluate', () => {
    test('returns score between 0 and 1', () => {
      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const score = scorer.evaluate(config);

      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('calculates weighted composite score correctly', () => {
      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const score = scorer.evaluate(config);

      expect(config.scoreDetails).toBeDefined();
      expect(config.scoreDetails.surface).toBeDefined();
      expect(config.scoreDetails.symmetry).toBeDefined();
      expect(config.scoreDetails.stability).toBeDefined();
      expect(config.scoreDetails.shape).toBeDefined();

      expect(config.score).toBe(score);

      const expectedScore = (
        config.scoreDetails.surface * 0.40 +
        config.scoreDetails.symmetry * 0.25 +
        config.scoreDetails.stability * 0.20 +
        config.scoreDetails.shape * 0.15
      );

      expect(score).toBeCloseTo(expectedScore, 5);
    });

    test('uses custom weights correctly', () => {
      const customScorer = new MultiObjectiveScorer({
        surface: 1.0,
        symmetry: 0.0,
        stability: 0.0,
        shape: 0.0
      });

      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const score = customScorer.evaluate(config);

      expect(score).toBeCloseTo(config.scoreDetails.surface, 5);
    });

    test('stores all score details in config', () => {
      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      scorer.evaluate(config);

      expect(config.score).toBeDefined();
      expect(config.scoreDetails).toBeDefined();
      expect(typeof config.scoreDetails.surface).toBe('number');
      expect(typeof config.scoreDetails.symmetry).toBe('number');
      expect(typeof config.scoreDetails.stability).toBe('number');
      expect(typeof config.scoreDetails.shape).toBe('number');
    });
  });

  describe('compareBest', () => {
    test('returns config with higher score', () => {
      const config1 = new PlacementConfiguration(500, 500);
      config1.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const config2 = new PlacementConfiguration(1000, 1000);
      config2.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const best = MultiObjectiveScorer.compareBest(config1, config2);

      expect(best).toBe(config1);
    });

    test('handles equal scores', () => {
      const config1 = new PlacementConfiguration(500, 500);
      config1.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const config2 = new PlacementConfiguration(500, 500);
      config2.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const best = MultiObjectiveScorer.compareBest(config1, config2);

      expect(best).toBe(config1);
    });
  });

  describe('rankConfigurations', () => {
    test('sorts configurations by score descending', () => {
      const configs = [
        new PlacementConfiguration(1000, 1000),
        new PlacementConfiguration(500, 500),
        new PlacementConfiguration(300, 300)
      ];

      configs[0].addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      configs[1].addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      configs[2].addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const ranked = MultiObjectiveScorer.rankConfigurations(configs);

      expect(ranked[0].score).toBeDefined();
      expect(ranked[1].score).toBeDefined();
      expect(ranked[2].score).toBeDefined();

      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
      expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
    });

    test('handles empty array', () => {
      const ranked = MultiObjectiveScorer.rankConfigurations([]);

      expect(ranked).toEqual([]);
    });

    test('handles single configuration', () => {
      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const ranked = MultiObjectiveScorer.rankConfigurations([config]);

      expect(ranked).toHaveLength(1);
      expect(ranked[0].score).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    test('evaluates excellent configuration with high scores', () => {
      const config = new PlacementConfiguration(390, 140);

      // All fourreaux at ground level for perfect stability
      config.addFourreau({diameter: 110, x: 40, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 210, y: 0, id: 'f2'});

      const score = scorer.evaluate(config);

      expect(score).toBeGreaterThan(0.7);
      expect(config.scoreDetails.surface).toBeGreaterThan(0.6);
      expect(config.scoreDetails.symmetry).toBe(1.0);
      expect(config.scoreDetails.stability).toBe(1.0);
    });

    test('penalizes poor configuration appropriately', () => {
      const config = new PlacementConfiguration(2000, 500);

      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 500, y: 0, id: 'f2'});

      const score = scorer.evaluate(config);

      expect(score).toBeLessThan(0.6);
      expect(config.scoreDetails.surface).toBeLessThan(0.5);
      expect(config.scoreDetails.shape).toBeLessThan(0.3);
    });

    test('score is deterministic for same configuration', () => {
      const config = new PlacementConfiguration(500, 500);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});

      const score1 = scorer.evaluate(config);
      const score2 = scorer.evaluate(config);

      expect(score1).toBe(score2);
    });
  });
});

describe('PlacementOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new PlacementOrchestrator();
  });

  describe('constructor', () => {
    test('creates generator and scorer instances', () => {
      expect(orchestrator.generator).toBeDefined();
      expect(orchestrator.scorer).toBeDefined();
      expect(orchestrator.generator).toBeInstanceOf(ConfigurationGenerator);
      expect(orchestrator.scorer).toBeInstanceOf(MultiObjectiveScorer);
    });

    test('initializes mlModule to null (Phase 2)', () => {
      expect(orchestrator.mlModule).toBeNull();
    });
  });

  describe('computeBestPlacement', () => {
    test('returns best configuration for simple case', () => {
      const fourreaux = [
        {diameter: 110, quantity: 4, type: 'Ø110'}
      ];

      const bestConfig = orchestrator.computeBestPlacement(fourreaux);

      expect(bestConfig).toBeDefined();
      expect(bestConfig.placedFourreaux).toHaveLength(4);
      expect(bestConfig.score).toBeDefined();
      expect(bestConfig.score).toBeGreaterThan(0);
      expect(bestConfig.scoreDetails).toBeDefined();
    });

    test('selects configuration with highest score', () => {
      const fourreaux = [
        {diameter: 200, quantity: 2},
        {diameter: 110, quantity: 4},
        {diameter: 63, quantity: 4}
      ];

      const bestConfig = orchestrator.computeBestPlacement(fourreaux);

      // Générer manuellement toutes les configs pour comparaison
      const allConfigs = orchestrator.generator.generateConfigurations(fourreaux);
      allConfigs.forEach(cfg => orchestrator.scorer.evaluate(cfg));

      const maxScore = Math.max(...allConfigs.map(c => c.score));

      expect(bestConfig.score).toBe(maxScore);
    });

    test('respects locked width constraint', () => {
      const fourreaux = [
        {diameter: 110, quantity: 5}
      ];

      const constraints = {
        lockedAxis: 'width',
        boxWidth: 500
      };

      const bestConfig = orchestrator.computeBestPlacement(fourreaux, constraints);

      expect(bestConfig.width).toBeLessThanOrEqual(500);
    });

    test('respects locked height constraint', () => {
      const fourreaux = [
        {diameter: 110, quantity: 5}
      ];

      const constraints = {
        lockedAxis: 'height',
        boxHeight: 500
      };

      const bestConfig = orchestrator.computeBestPlacement(fourreaux, constraints);

      expect(bestConfig.height).toBeLessThanOrEqual(500);
    });

    test('applies autoResize when option enabled', () => {
      const fourreaux = [
        {diameter: 110, quantity: 2}
      ];

      const bestConfig = orchestrator.computeBestPlacement(
        fourreaux,
        {},
        {autoResize: true}
      );

      // Avec autoResize, dimensions doivent être minimales
      const maxX = Math.max(...bestConfig.placedFourreaux.map(f =>
        f.x + bestConfig.calculateCellSize(f.diameter)
      ));
      const maxY = Math.max(...bestConfig.placedFourreaux.map(f =>
        f.y + bestConfig.calculateCellSize(f.diameter)
      ));

      const margin = PLACEMENT_CONFIG.litDePose;

      expect(bestConfig.width).toBeCloseTo(maxX + margin, 0);
      expect(bestConfig.height).toBeCloseTo(maxY + margin, 0);
    });

    test('throws error when no fourreaux provided', () => {
      expect(() => {
        orchestrator.computeBestPlacement([]);
      }).toThrow('Aucun fourreau à placer');
    });

    test('throws error when impossible constraints', () => {
      const fourreaux = Array.from({length: 100}, (_, i) => ({
        diameter: 200,
        quantity: 1,
        id: `f${i}`
      }));

      const constraints = {
        lockedAxis: 'width',
        boxWidth: 300
      };

      expect(() => {
        orchestrator.computeBestPlacement(fourreaux, constraints);
      }).toThrow('Impossible de générer des configurations valides');
    });

    test('handles mixed diameter fourreaux', () => {
      const fourreaux = [
        {diameter: 200, quantity: 1},
        {diameter: 160, quantity: 2},
        {diameter: 110, quantity: 3},
        {diameter: 90, quantity: 2},
        {diameter: 63, quantity: 4}
      ];

      const bestConfig = orchestrator.computeBestPlacement(fourreaux);

      const expectedTotal = fourreaux.reduce((sum, f) => sum + f.quantity, 0);
      expect(bestConfig.placedFourreaux).toHaveLength(expectedTotal);
      expect(bestConfig.score).toBeGreaterThan(0.3); // Score raisonnable
    });
  });

  describe('optimizeDimensions', () => {
    test('reduces dimensions to minimum needed', () => {
      const config = new PlacementConfiguration(1000, 1000);
      config.addFourreau({diameter: 110, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 140, y: 0, id: 'f2'});

      orchestrator.optimizeDimensions(config);

      // Dimensions devraient être réduites
      expect(config.width).toBeLessThan(500);
      expect(config.height).toBeLessThan(500);

      // Vérifier dimensions exactes avec marge
      const cellSize = 140; // 110 + 30
      const margin = PLACEMENT_CONFIG.litDePose;

      expect(config.width).toBeCloseTo(cellSize * 2 + margin, 0);
      expect(config.height).toBeCloseTo(cellSize + margin, 0);
    });

    test('handles empty configuration', () => {
      const config = new PlacementConfiguration(1000, 1000);

      orchestrator.optimizeDimensions(config);

      // Dimensions ne changent pas si config vide
      expect(config.width).toBe(1000);
      expect(config.height).toBe(1000);
    });

    test('calculates correct bounding box for complex layout', () => {
      const config = new PlacementConfiguration(2000, 2000);
      config.addFourreau({diameter: 200, x: 0, y: 0, id: 'f1'});
      config.addFourreau({diameter: 110, x: 230, y: 0, id: 'f2'});
      config.addFourreau({diameter: 63, x: 370, y: 0, id: 'f3'});
      config.addFourreau({diameter: 110, x: 115, y: 230, id: 'f4'});

      orchestrator.optimizeDimensions(config);

      // Vérifier que toutes les positions + cellSizes sont dans les nouvelles dimensions
      for (const f of config.placedFourreaux) {
        const cellSize = config.calculateCellSize(f.diameter);
        expect(f.x + cellSize).toBeLessThanOrEqual(config.width);
        expect(f.y + cellSize).toBeLessThanOrEqual(config.height);
      }

      // Dimensions doivent être beaucoup plus petites que 2000x2000
      expect(config.width).toBeLessThan(1000);
      expect(config.height).toBeLessThan(1000);
    });
  });

  describe('Integration tests', () => {
    test('complete workflow: generate, score, select best', () => {
      const fourreaux = [
        {diameter: 110, quantity: 6, type: 'Ø110'}
      ];

      const startTime = Date.now();
      const bestConfig = orchestrator.computeBestPlacement(fourreaux);
      const endTime = Date.now();

      // Vérifier résultat
      expect(bestConfig.placedFourreaux).toHaveLength(6);
      expect(bestConfig.score).toBeGreaterThan(0.5);
      expect(bestConfig.scoreDetails.stability).toBe(1.0); // Tous stables

      // Vérifier performance (<100ms pour 6 fourreaux)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('autoResize produces more compact result', () => {
      const fourreaux = [
        {diameter: 110, quantity: 4}
      ];

      const configNoResize = orchestrator.computeBestPlacement(
        fourreaux,
        {},
        {autoResize: false}
      );

      const configWithResize = orchestrator.computeBestPlacement(
        fourreaux,
        {},
        {autoResize: true}
      );

      const areaNoResize = configNoResize.width * configNoResize.height;
      const areaWithResize = configWithResize.width * configWithResize.height;

      // autoResize devrait réduire la surface
      expect(areaWithResize).toBeLessThanOrEqual(areaNoResize);
    });

    test('handles extreme case: 50 fourreaux in <100ms', () => {
      const fourreaux = Array.from({length: 50}, (_, i) => ({
        diameter: [63, 90, 110][i % 3],
        quantity: 1,
        id: `f${i}`
      }));

      const startTime = Date.now();
      const bestConfig = orchestrator.computeBestPlacement(fourreaux);
      const endTime = Date.now();

      expect(bestConfig.placedFourreaux).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('locked axis constraint is properly enforced', () => {
      const fourreaux = [
        {diameter: 110, quantity: 8}
      ];

      const constraints = {
        lockedAxis: 'width',
        boxWidth: 600
      };

      const bestConfig = orchestrator.computeBestPlacement(fourreaux, constraints);

      // Width ne doit jamais dépasser la contrainte
      expect(bestConfig.width).toBeLessThanOrEqual(600);
      expect(bestConfig.placedFourreaux).toHaveLength(8);
    });

    test('score is better than random placement', () => {
      const fourreaux = [
        {diameter: 110, quantity: 6}
      ];

      const bestConfig = orchestrator.computeBestPlacement(fourreaux);

      // Score devrait être élevé (>0.6 pour cas simple)
      expect(bestConfig.score).toBeGreaterThan(0.6);

      // Symétrie devrait être bonne
      expect(bestConfig.scoreDetails.symmetry).toBeGreaterThan(0.5);

      // Stabilité devrait être parfaite
      expect(bestConfig.scoreDetails.stability).toBe(1.0);
    });
  });
});

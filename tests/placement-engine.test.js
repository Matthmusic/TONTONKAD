/**
 * Tests unitaires pour placement-engine.js
 */

const {
  PLACEMENT_CONFIG,
  calculateCellSize,
  PlacementConfiguration,
  FourreauSorter
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

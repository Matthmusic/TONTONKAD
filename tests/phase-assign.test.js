const { assignPhases, isUnipolaire } = require('../src/renderer/phase-assign.js');

describe('isUnipolaire', () => {
  test('1x… → true, multipolaire → false', () => {
    expect(isUnipolaire('1x185')).toBe(true);
    expect(isUnipolaire('1X10')).toBe(true);
    expect(isUnipolaire(' 1x6 ')).toBe(true);
    expect(isUnipolaire('2x185')).toBe(false);
    expect(isUnipolaire('4x25')).toBe(false);
    expect(isUnipolaire('')).toBe(false);
    expect(isUnipolaire(undefined)).toBe(false);
  });
});

describe('assignPhases — mode auto', () => {
  test('unipolaires : cycle L1/L2/L3 sur les unités (qty déplié)', () => {
    expect(assignPhases([{ code: '1x185', qty: 3 }])).toEqual(['L1', 'L2', 'L3']);
  });
  test('le cycle boucle après L3', () => {
    expect(assignPhases([{ code: '1x185', qty: 4 }])).toEqual(['L1', 'L2', 'L3', 'L1']);
  });
  test('multipolaire → null et ne consomme pas le cycle', () => {
    expect(assignPhases([{ code: '2x185', qty: 1 }, { code: '1x185', qty: 2 }]))
      .toEqual([null, 'L1', 'L2']);
  });
});

describe('assignPhases — fonction explicite', () => {
  test('neutre → N, PE → PE, aucune → null', () => {
    expect(assignPhases([
      { code: '1x185', qty: 1, fonction: 'neutre' },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1, fonction: 'aucune' },
    ])).toEqual(['N', 'PE', null]);
  });
  test('phase forcée sur un multipolaire prend quand même le cycle', () => {
    expect(assignPhases([{ code: '4x25', qty: 2, fonction: 'phase' }])).toEqual(['L1', 'L2']);
  });
  test('N et PE ne consomment pas le cycle des phases', () => {
    expect(assignPhases([
      { code: '1x185', qty: 2 },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1 },
    ])).toEqual(['L1', 'L2', 'PE', 'L3']);
  });
  test('cas métier 3×[2x185] + PE[1x185]', () => {
    expect(assignPhases([
      { code: '2x185', qty: 3 },
      { code: '1x185', qty: 1, fonction: 'PE' },
    ])).toEqual([null, null, null, 'PE']);
  });
});

describe('assignPhases — cas limites', () => {
  test('liste vide → []', () => { expect(assignPhases([])).toEqual([]); });
  test('qty absent → 1 unité ; qty 0 → ignoré', () => {
    expect(assignPhases([{ code: '1x185' }])).toEqual(['L1']);
    expect(assignPhases([{ code: '1x185', qty: 0 }])).toEqual([]);
  });
  test('qty en chaîne numérique tolérée', () => {
    expect(assignPhases([{ code: '1x185', qty: '2' }])).toEqual(['L1', 'L2']);
  });
});

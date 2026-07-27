// tests/geometry.test.js
const { areaCircle, roundToStep, computeOccupancy } = require('../src/renderer/geometry.js');

describe('areaCircle', () => {
  test('π·r²', () => { expect(areaCircle(10)).toBeCloseTo(Math.PI * 25, 6); });
  test('0 → 0', () => { expect(areaCircle(0)).toBe(0); });
});

describe('roundToStep', () => {
  test('arrondi au pas de 5', () => { expect(roundToStep(23, 5)).toBe(25); });
  test('valeur non finie renvoyée telle quelle', () => { expect(roundToStep(NaN, 5)).toBeNaN(); });
});

describe('computeOccupancy', () => {
  test('boîte rect : aire fourreaux / aire boîte × 100', () => {
    const occ = computeOccupancy({ shape: 'rect', wMm: 1000, hMm: 1000, fourreaux: [{ od: 100 }], cables: [] });
    expect(occ).toBeCloseTo((Math.PI * 2500) / 1e6 * 100, 6);
  });
  test('câbles avec parent exclus, câbles libres comptés', () => {
    const occ = computeOccupancy({ shape: 'rect', wMm: 1000, hMm: 1000, fourreaux: [], cables: [{ od: 50, parent: 'f1' }, { od: 50 }] });
    expect(occ).toBeCloseTo((Math.PI * 625) / 1e6 * 100, 6);
  });
  test('forme circulaire : aire = π·(D/2)²', () => {
    const occ = computeOccupancy({ shape: 'circle', dMm: 1000, fourreaux: [{ od: 100 }], cables: [] });
    expect(occ).toBeCloseTo((Math.PI * 2500) / (Math.PI * 250000) * 100, 6);
  });
  test('aire totale nulle → 0', () => {
    expect(computeOccupancy({ shape: 'rect', wMm: 0, hMm: 0, fourreaux: [{ od: 100 }], cables: [] })).toBe(0);
  });
});

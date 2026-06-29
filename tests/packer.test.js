// tests/packer.test.js
const { GEO, cell } = require('../src/renderer/packer.js');
const pkg = require('../src/renderer/packer.js');

describe('packer — géométrie de base', () => {
  test('GEO défauts', () => {
    expect(GEO.gap).toBe(30);
    expect(GEO.margin).toBe(40);
  });
  test('cell = diamètre + entraxe', () => {
    expect(cell(125)).toBe(155);
    expect(cell(0)).toBe(30);
  });
});

// Accès aux internes via une trappe de test (voir Step 3).
describe('packer — pack interne', () => {
  const tubes = [
    { id: 'a', d: 125 }, { id: 'b', d: 125 },
    { id: 'c', d: 63 },  { id: 'd', d: 63 },
  ];

  test('toLayout : marges respectées et aucun chevauchement', () => {
    const pack = pkg.__test.packAt(pkg.__test.sortTubes(tubes), 1000);
    const L = pkg.__test.toLayout(pack, 'compact', null, null);
    // marges
    for (const it of L.items) {
      const c = pkg.cell(it.d);
      expect(it.x).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
      expect(it.y).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
      expect(it.x + c).toBeLessThanOrEqual(L.w - pkg.GEO.margin + 0.001);
      expect(it.y + c).toBeLessThanOrEqual(L.h - pkg.GEO.margin + 0.001);
    }
    // aucun chevauchement
    for (let i = 0; i < L.items.length; i++) {
      for (let j = i + 1; j < L.items.length; j++) {
        const A = L.items[i], B = L.items[j];
        const ca = pkg.cell(A.d), cb = pkg.cell(B.d);
        const sep = (A.x + ca <= B.x + 0.001) || (B.x + cb <= A.x + 0.001) ||
                    (A.y + ca <= B.y + 0.001) || (B.y + cb <= A.y + 0.001);
        expect(sep).toBe(true);
      }
    }
    expect(L.items).toHaveLength(4);
    expect(L.fill).toBeGreaterThan(0);
    expect(L.fill).toBeLessThanOrEqual(1.0001);
  });
});

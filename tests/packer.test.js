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

describe('packer — solve verrouillé', () => {
  const tubes = [
    { id: 'a', d: 125 }, { id: 'b', d: 125 }, { id: 'c', d: 90 },
    { id: 'd', d: 63 },  { id: 'e', d: 63 },  { id: 'f', d: 63 },
  ];
  test('lock:w → largeur respectée à l\'identique', () => {
    const L = pkg.solve(tubes, { w: 600, lock: 'w' });
    expect(L.w).toBe(600);
    expect(L.tag).toBe('locked');
    expect(L.items).toHaveLength(6);
    for (const it of L.items) {
      const c = pkg.cell(it.d);
      expect(it.x + c).toBeLessThanOrEqual(600 - pkg.GEO.margin + 0.001);
    }
  });
  test('lock:h → hauteur respectée à l\'identique', () => {
    const L = pkg.solve(tubes, { h: 500, lock: 'h' });
    expect(L.h).toBe(500);
    expect(L.items).toHaveLength(6);
  });
  test('liste vide → layout vide', () => {
    const L = pkg.solve([], { lock: null });
    expect(L.items).toHaveLength(0);
    expect(L.tag).toBe('empty');
  });
});

describe('packer — solve libre', () => {
  const tubes = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i, d: i % 3 === 0 ? 125 : 63 }));
  test('tranchée : largeur >= hauteur', () => {
    const L = pkg.solve(tubes, { lock: null });
    expect(L.w).toBeGreaterThanOrEqual(L.h);
  });
  test('déterministe : deux appels identiques', () => {
    const A = pkg.solve(tubes, { lock: null });
    const B = pkg.solve(tubes, { lock: null });
    expect(JSON.stringify(A)).toBe(JSON.stringify(B));
  });
  test('performance : 50 tubes < 100 ms', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({ id: 'x' + i, d: [63, 90, 125][i % 3] }));
    const t0 = Date.now();
    pkg.solve(big, { lock: null });
    expect(Date.now() - t0).toBeLessThan(100);
  });
});

describe('packer — variants', () => {
  const tubes = Array.from({ length: 10 }, (_, i) => ({ id: 'v' + i, d: [125, 63, 90][i % 3] }));
  test('≤ 3 variantes, taguées, dédupliquées, valides', () => {
    const vs = pkg.variants(tubes, { lock: null });
    expect(vs.length).toBeGreaterThanOrEqual(1);
    expect(vs.length).toBeLessThanOrEqual(3);
    const tags = vs.map(v => v.tag);
    expect(new Set(tags).size).toBe(tags.length);          // tags uniques
    const keys = vs.map(v => `${Math.round(v.w)}x${Math.round(v.h)}`);
    expect(new Set(keys).size).toBe(keys.length);          // dimensions uniques (dédup)
    for (const v of vs) expect(v.items).toHaveLength(10);
  });
  test('mode verrouillé → 1 variante', () => {
    const vs = pkg.variants(tubes, { w: 700, lock: 'w' });
    expect(vs).toHaveLength(1);
    expect(vs[0].w).toBe(700);
  });
});

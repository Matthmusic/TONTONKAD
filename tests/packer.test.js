// tests/packer.test.js
const { GEO, cell } = require('../src/renderer/packer.js');
const pkg = require('../src/renderer/packer.js');

// Réglages standard utilisés par les suites géométriques ci-dessous
// (les défauts runtime sont 0/0, réglables via le pop-over de la barre d'outils)
const setStandardGeo = () => { GEO.gap = 30; GEO.margin = 40; };

describe('packer — géométrie de base', () => {
  test('GEO défauts : écart et lit de pose à 0', () => {
    expect(GEO.gap).toBe(0);
    expect(GEO.margin).toBe(0);
  });
  test('cell = diamètre + entraxe', () => {
    setStandardGeo();
    expect(cell(125)).toBe(155);
    expect(cell(0)).toBe(30);
  });
});

// Accès aux internes via une trappe de test (voir Step 3).
describe('packer — pack interne', () => {
  beforeAll(setStandardGeo);
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
  beforeAll(setStandardGeo);
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

  test('lock:h — hauteur trop petite (même < 2×margin) → layout vide, pas de débordement', () => {
    // maxrects-packer (smart:true) peut renvoyer bins.length===1 avec un bin plus
    // haut que la borne demandée (observé sur un item unique dont la cellule vaut
    // exactement l'autre axe) : sans garde sur les dimensions réelles du bin,
    // solve() renvoyait un layout avec h=50 mais un item positionné jusqu'à y=270.
    const L = pkg.solve([{ id: 'a', d: 200 }], { h: 50, lock: 'h' });
    expect(L.tag).toBe('empty');
    expect(L.items).toHaveLength(0);
  });
});

describe('packer — solve libre', () => {
  beforeAll(setStandardGeo);
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
  test('gravité : le plus gros fourreau est posé en bas (y = margin)', () => {
    const mix = [
      { id: 's1', d: 40 }, { id: 'big', d: 160 },
      { id: 's2', d: 40 }, { id: 's3', d: 40 },
    ];
    const L = pkg.solve(mix, { lock: null });
    const biggest = L.items.reduce((a, b) => (b.d > a.d ? b : a));
    expect(biggest.y).toBe(pkg.GEO.margin);
  });
});

describe('packer — anchorLayout (ancrage fond de boîte)', () => {
  beforeAll(setStandardGeo);
  const eightTubes = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, d: 90 }));

  test('boîte plus grande que la nappe : dimensions conservées, nappe au fond', () => {
    const cfg = pkg.solve(eightTubes, { lock: null }); // nappe 560×320 (d90, gap 30, marge 40)
    const A = pkg.anchorLayout(cfg, { w: 700, h: 390, lockW: false, lockH: false });
    expect(A.w).toBe(700);
    expect(A.h).toBe(390);
    // Fond : la rangée la plus basse repose sur le lit de pose (bord bas de cellule = h - marge)
    const lowest = Math.max(...A.positions.map(p => {
      const c = pkg.cell(cfg.items.find(it => it.id === p.id).d);
      return p.y + c / 2;
    }));
    expect(lowest).toBeCloseTo(390 - pkg.GEO.margin, 5);
    // Aucune cellule ne déborde ; yUp est le miroir exact de y (repère moteur)
    for (const p of A.positions) {
      const c = pkg.cell(90);
      expect(p.y + c / 2).toBeLessThanOrEqual(390 - pkg.GEO.margin + 0.001);
      expect(p.y - c / 2).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
      expect(p.yUp).toBeCloseTo(A.h - p.y, 9);
    }
  });

  test('centrage horizontal : marges gauche/droite égales', () => {
    const cfg = pkg.solve(eightTubes, { lock: null });
    const A = pkg.anchorLayout(cfg, { w: 700, h: 390, lockW: false, lockH: false });
    const c = pkg.cell(90);
    const left = Math.min(...A.positions.map(p => p.x - c / 2));
    const right = Math.max(...A.positions.map(p => p.x + c / 2));
    expect(left).toBeCloseTo(700 - right, 5);
    expect(left).toBeGreaterThanOrEqual(pkg.GEO.margin - 0.001);
  });

  test('boîte trop petite sur un axe libre : agrandie au multiple de 5 supérieur', () => {
    const cfg = pkg.solve(eightTubes, { lock: null }); // 560×320
    const A = pkg.anchorLayout(cfg, { w: 300, h: 200, lockW: false, lockH: false });
    expect(A.w).toBe(560);
    expect(A.h).toBe(320);
  });

  test('largeur verrouillée : nappe centrée, pas collée à gauche', () => {
    const tubes = [{ id: 'a', d: 125 }, { id: 'b', d: 125 }, { id: 'c', d: 63 }];
    const cfg = pkg.solve(tubes, { w: 900, lock: 'w' });
    const A = pkg.anchorLayout(cfg, { w: 900, h: 400, lockW: true, lockH: false });
    expect(A.w).toBe(900);
    const left = Math.min(...A.positions.map(p => {
      const c = pkg.cell(cfg.items.find(it => it.id === p.id).d);
      return p.x - c / 2;
    }));
    expect(left).toBeGreaterThan(pkg.GEO.margin); // centré → marge gauche > lit de pose seul
  });

  test('axes verrouillés : dimensions strictement conservées', () => {
    const cfg = pkg.solve(eightTubes, { w: 700, lock: 'w' });
    const A = pkg.anchorLayout(cfg, { w: 700, h: 390, lockW: true, lockH: true });
    expect(A.w).toBe(700);
    expect(A.h).toBe(390);
  });

  test('layout vide : pas de crash, dimensions conservées', () => {
    const cfg = pkg.solve([], { lock: null });
    const A = pkg.anchorLayout(cfg, { w: 700, h: 390, lockW: false, lockH: false });
    expect(A.positions).toHaveLength(0);
    expect(A.w).toBe(700);
    expect(A.h).toBe(390);
  });
});

describe('packer — variants', () => {
  beforeAll(setStandardGeo);
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

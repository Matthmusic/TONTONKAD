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

  // Un cfg calculé en mode LIBRE (large) peut ne pas rentrer dans une boîte dont
  // l'utilisateur a verrouillé un axe plus étroit (ex. une variante choisie après
  // verrouillage) : anchorLayout doit recalculer pour cet axe plutôt que garder
  // des positions qui déborderaient de la boîte affichée, sans aucun signal.
  test('axe verrouillé trop petit pour la nappe libre : recalculé, verrou respecté', () => {
    const tubes = Array.from({ length: 10 }, (_, i) => ({ id: 't' + i, d: 63 })); // homogène : le repack peut réussir
    const cfg = pkg.solve(tubes, { lock: null }); // nappe libre large (452×359)
    const A = pkg.anchorLayout(cfg, { w: 250, h: cfg.h, lockW: true, lockH: false });
    expect(A.w).toBe(250); // le verrou est bien respecté après recalcul (pas un repli)
    expect(A.positions).toHaveLength(10);
    for (const p of A.positions) {
      const c = pkg.cell(63);
      expect(p.x - c / 2).toBeGreaterThanOrEqual(-0.001);
      expect(p.x + c / 2).toBeLessThanOrEqual(A.w + 0.001);
      expect(p.y - c / 2).toBeGreaterThanOrEqual(-0.001);
      expect(p.y + c / 2).toBeLessThanOrEqual(A.h + 0.001);
    }
  });

  test('axe verrouillé trop petit, repack impossible pour CETTE nappe : repli honnête (pas de débordement caché)', () => {
    // d=125 (cellule 155) ne peut physiquement pas rentrer dans une largeur
    // verrouillée de 200mm (intérieur 120mm) : le recalcul échoue, et le repli
    // fait grandir la boîte plutôt que mentir sur sa largeur réelle.
    const tubes = Array.from({ length: 10 }, (_, i) => ({ id: 't' + i, d: [125, 90, 63][i % 3] }));
    const cfg = pkg.solve(tubes, { lock: null });
    const A = pkg.anchorLayout(cfg, { w: 200, h: cfg.h, lockW: true, lockH: false });
    expect(A.positions).toHaveLength(10);
    for (const p of A.positions) {
      const c = pkg.cell(tubes.find((t) => t.id === p.id).d);
      expect(p.x - c / 2).toBeGreaterThanOrEqual(-0.001);
      expect(p.x + c / 2).toBeLessThanOrEqual(A.w + 0.001); // cohérent avec A.w réel, quel qu'il soit
      expect(p.y - c / 2).toBeGreaterThanOrEqual(-0.001);
      expect(p.y + c / 2).toBeLessThanOrEqual(A.h + 0.001);
    }
  });

  test('largeur ET hauteur verrouillées, place suffisante : les deux respectées après recalcul', () => {
    const tubes = Array.from({ length: 10 }, (_, i) => ({ id: 't' + i, d: [125, 90, 63][i % 3] }));
    const cfg = pkg.solve(tubes, { lock: null });
    const A = pkg.anchorLayout(cfg, { w: 400, h: 900, lockW: true, lockH: true });
    expect(A.w).toBe(400);
    expect(A.h).toBe(900);
    expect(A.positions).toHaveLength(10);
  });

  test('axe verrouillé impossible à respecter (même recalculé) : repli sans perte de fourreaux', () => {
    // Un seul fourreau dont la cellule dépasse déjà l'axe verrouillé : aucun
    // recalcul ne peut le faire rentrer. Les fourreaux restent tous présents,
    // au prix d'un dépassement de CET axe plutôt que de disparaître.
    const tubes = [{ id: 'a', d: 300 }];
    const cfg = pkg.solve(tubes, { lock: null });
    const A = pkg.anchorLayout(cfg, { w: 50, h: 50, lockW: true, lockH: true });
    expect(A.positions).toHaveLength(1);
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

// ── Gravité / stabilité / conduit circulaire ─────────────────────────────
describe('packer — gravité et stabilité', () => {
  const DIAMS = [40, 63, 90, 110, 160, 200];
  // Générateur pseudo-aléatoire déterministe
  const randomSets = (count) => {
    const sets = [];
    for (let s = 1; s <= count; s++) {
      let r = s;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      const n = 3 + Math.floor(rnd() * 20);
      const t = [];
      for (let i = 0; i < n; i++) t.push({ id: 'x' + i, d: DIAMS[Math.floor(rnd() * DIAMS.length)] });
      sets.push(t);
    }
    return sets;
  };
  const local = (L) => L.items.map(i => ({ ...i, x: i.x - pkg.GEO.margin, y: i.y - pkg.GEO.margin }));

  for (const gap of [0, 30]) {
    test(`gap ${gap} : aucun fourreau en l'air, aucun chevauchement, marges respectées`, () => {
      pkg.GEO.gap = gap; pkg.GEO.margin = 40;
      for (const tubes of randomSets(60)) {
        const L = pkg.solve(tubes, { lock: null });
        expect(L.items).toHaveLength(tubes.length);
        const it = local(L);
        for (const a of it) expect(pkg.__test.isStable(a, it)).toBe(true);
        for (let i = 0; i < L.items.length; i++) {
          const A = L.items[i], ca = pkg.cell(A.d);
          expect(A.x + ca).toBeLessThanOrEqual(L.w - pkg.GEO.margin + 1e-6);
          expect(A.y + ca).toBeLessThanOrEqual(L.h - pkg.GEO.margin + 1e-6);
          for (let j = i + 1; j < L.items.length; j++) {
            const B = L.items[j], cb = pkg.cell(B.d);
            const sep = (A.x + ca <= B.x + 1e-6) || (B.x + cb <= A.x + 1e-6) ||
                        (A.y + ca <= B.y + 1e-6) || (B.y + cb <= A.y + 1e-6);
            expect(sep).toBe(true);
          }
        }
      }
    });
  }

  test('cas réel : le 40 ne reste pas suspendu au-dessus du 200', () => {
    pkg.GEO.gap = 30; pkg.GEO.margin = 40;
    const tubes = [40, 63, 110, 200, 110, 63].map((d, i) => ({ id: 't' + i, d }));
    const it = local(pkg.solve(tubes, { lock: null }));
    for (const a of it) expect(pkg.__test.isStable(a, it)).toBe(true);
  });

  test('lock:w : la stabilisation ne dépasse jamais la largeur imposée', () => {
    pkg.GEO.gap = 30; pkg.GEO.margin = 40;
    for (const tubes of randomSets(30)) {
      const L = pkg.solve(tubes, { lock: 'w', w: 700 });
      if (!L.items.length) continue;
      for (const a of L.items) expect(a.x + pkg.cell(a.d)).toBeLessThanOrEqual(700 - pkg.GEO.margin + 1e-6);
    }
  });

  test('variants : la carte « compact » est le layout de solve()', () => {
    pkg.GEO.gap = 30; pkg.GEO.margin = 40;
    const tubes = [[200, 4], [63, 10]].flatMap(([d, n]) => Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}`, d })));
    const L = pkg.solve(tubes, { lock: null });
    const compact = pkg.variants(tubes, { lock: null }).find(v => v.tag === 'compact');
    expect([compact.w, compact.h]).toEqual([L.w, L.h]);
  });
});

describe('packer — conduit circulaire', () => {
  beforeEach(() => { pkg.GEO.gap = 30; pkg.GEO.margin = 40; });
  const inside = (A) => {
    const R = A.w / 2;
    for (const p of A.positions) {
      const dist = Math.hypot(p.x - R, p.y - R);
      // conduit : pas d'écart entre fourreaux, seul le lit de pose compte
      expect(dist + p.d / 2 + pkg.GEO.margin).toBeLessThanOrEqual(R + 1e-3);
    }
    for (let i = 0; i < A.positions.length; i++) {
      for (let j = i + 1; j < A.positions.length; j++) {
        const P = A.positions[i], Q = A.positions[j];
        expect(Math.hypot(P.x - Q.x, P.y - Q.y)).toBeGreaterThanOrEqual((P.d + Q.d) / 2 - 1e-3);
      }
    }
  };
  const tubes = [[110, 4], [63, 3]].flatMap(([d, n]) => Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}`, d })));

  test('tous les fourreaux sont DANS le cercle (pas seulement dans le carré)', () => {
    const L = pkg.solve(tubes, { shape: 'circ' });
    const A = pkg.anchorLayout(L, { w: 0, h: 0, shape: 'circ' });
    expect(A.w).toBe(A.h);
    expect(A.positions).toHaveLength(tubes.length);
    inside(A);
  });

  test('un layout rectangulaire reçu pour un conduit est recalculé pour le cercle', () => {
    const L = pkg.solve(tubes, { lock: null }); // layout pensé pour un rectangle
    const A = pkg.anchorLayout(L, { w: 0, h: 0, shape: 'circ' });
    expect(A.positions).toHaveLength(tubes.length);
    inside(A);
  });

  test('7 fourreaux identiques : nid d\'abeille, D = 3·d', () => {
    pkg.GEO.gap = 30; pkg.GEO.margin = 0; // l'écart est ignoré dans un conduit
    const t = Array.from({ length: 7 }, (_, i) => ({ id: i, d: 63 }));
    expect(pkg.solve(t, { shape: 'circ' }).w).toBeCloseTo(189, 0);
  });

  test('diamètre verrouillé suffisant : conservé', () => {
    const A = pkg.anchorLayout(pkg.solve(tubes, { shape: 'circ' }), { w: 1000, h: 1000, lockW: true, shape: 'circ' });
    expect(A.w).toBe(1000);
    inside(A);
  });

  test('4 fourreaux identiques sans écart : D ≈ (1 + √2)·d', () => {
    pkg.GEO.gap = 0; pkg.GEO.margin = 0;
    const t = [0, 1, 2, 3].map(i => ({ id: i, d: 100 }));
    const L = pkg.solve(t, { shape: 'circ' });
    expect(L.w).toBeCloseTo((1 + Math.SQRT2) * 100, 0);
  });
});

describe('packer — rangement par groupes de diamètre', () => {
  beforeEach(() => { pkg.GEO.gap = 30; pkg.GEO.margin = 40; });
  const mk = (spec) => spec.flatMap(([d, n]) => Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}`, d })));

  test('un plus gros fourreau n\'est jamais posé au-dessus d\'un plus petit', () => {
    for (const spec of [[[90, 8], [63, 6], [40, 4]], [[160, 8], [110, 10], [63, 12]], [[200, 1], [110, 2], [63, 2], [40, 1]]]) {
      const L = pkg.solve(mk(spec), { lock: null });
      for (const a of L.items) for (const b of L.items) {
        if (a.d <= b.d) continue;
        const ca = pkg.cell(a.d), cb = pkg.cell(b.d);
        const above = a.y >= b.y + cb - 1e-6 && a.x < b.x + cb - 1e-6 && b.x < a.x + ca - 1e-6;
        expect(above).toBe(false);
      }
    }
  });

  test('hauteur imposée : les fourreaux s\'empilent plutôt que de s\'étaler', () => {
    const L = pkg.solve(mk([[160, 3], [110, 5], [63, 6]]), { lock: 'h', h: 400 });
    expect(L.items).toHaveLength(14);
    expect(L.w).toBeLessThan(1150); // l'ancien moteur donnait 1350
  });

  test('les 40 d\'une petite rangée sont centrés sur le bloc qui les porte', () => {
    const L = pkg.solve(mk([[110, 6], [40, 8]]), { lock: 'h', h: 300 });
    const big = L.items.filter(i => i.d === 110), small = L.items.filter(i => i.d === 40);
    const mid = (arr) => (Math.min(...arr.map(i => i.x)) + Math.max(...arr.map(i => i.x + pkg.cell(i.d)))) / 2;
    expect(Math.abs(mid(big) - mid(small))).toBeLessThan(1);
  });
});

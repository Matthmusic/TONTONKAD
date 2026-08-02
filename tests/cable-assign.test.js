const { __test } = require('../src/renderer/cable-assign.js');
const { aire, capacite, expandCables, eligibleFourreaux, smallestFourreauFor, chooseFourreauSize, simulateBinCount } = __test;

const CAT = [
  { type: 'TPC', code: '200', od: 200, id: 150 },
  { type: 'TPC', code: '63',  od: 63,  id: 47 },
  { type: 'IRL', code: '63',  od: 63,  id: 57.3 },
];

describe('helpers occupation', () => {
  test('aire = π·(d/2)²', () => { expect(aire(10)).toBeCloseTo(Math.PI * 25, 6); });
  test('capacite = tauxMax·aire(id)', () => {
    expect(capacite({ id: 100 }, 0.33)).toBeCloseTo(0.33 * Math.PI * 2500, 6);
  });
});

describe('expandCables', () => {
  test('déplie qty en unités avec area', () => {
    const u = expandCables([{ id: 'L1', nom: 'x', cables: [{ fam: 'F', code: '1x185', od: 25.5, qty: 3, fonction: 'phase' }] }]);
    expect(u).toHaveLength(3);
    expect(u[0]).toMatchObject({ liaisonId: 'L1', code: '1x185', od: 25.5, fonction: 'phase' });
    expect(u[0].area).toBeCloseTo(Math.PI * (25.5 / 2) ** 2, 6);
  });
  test('qty 0 ou manquant → ignoré ; liste vide → []', () => {
    expect(expandCables([{ id: 'L', cables: [{ od: 10, qty: 0 }] }])).toEqual([]);
    expect(expandCables([])).toEqual([]);
  });
});

describe('eligibleFourreaux', () => {
  test('trié par id croissant (capacité croissante)', () => {
    expect(eligibleFourreaux(CAT, {}).map(f => f.id)).toEqual([47, 57.3, 150]);
  });
  test('borne tailleMaxFourreauOd exclut les trop grands (od)', () => {
    expect(eligibleFourreaux(CAT, { tailleMaxFourreauOd: 63 }).map(f => f.code)).toEqual(['63', '63']);
  });
  test('filtre typesAutorises', () => {
    expect(eligibleFourreaux(CAT, { typesAutorises: ['IRL'] }).map(f => f.type)).toEqual(['IRL']);
  });
});

describe('smallestFourreauFor', () => {
  test('plus petit fourreau dont capacité ≥ area, sinon null', () => {
    const elig = eligibleFourreaux(CAT, {});
    // cap(id47)@0.33 ≈ 572.5 ; cap(id150) ≈ 5831.5
    expect(smallestFourreauFor(500, elig, 0.33).id).toBe(47);
    expect(smallestFourreauFor(3000, elig, 0.33).id).toBe(150);
    expect(smallestFourreauFor(999999, elig, 0.33)).toBeNull();
  });
});

describe('simulateBinCount', () => {
  test('best-fit homogène : compte les fourreaux nécessaires pour le reste de la file', () => {
    const items = [{ area: 300 }, { area: 300 }, { area: 300 }];
    expect(simulateBinCount(items, 0, 700)).toBe(2);   // 300+300≤700, +300 non → 2 bacs
    expect(simulateBinCount(items, 0, 1000)).toBe(1);  // 3×300=900≤1000 → 1 bac
    expect(simulateBinCount(items, 1, 700)).toBe(1);   // à partir de l'index 1 : 2 items → 1 bac
  });
});

describe('chooseFourreauSize', () => {
  test('anticipe le reste de la file : choisit la taille qui minimise le nb de fourreaux, la plus petite en cas d’égalité', () => {
    const elig = eligibleFourreaux(CAT2, {});
    const items = [{ area: 283.5 }, { area: 283.5 }, { area: 283.5 }]; // 3×od19
    // 63(cap572.5)→2 bacs ; 110(cap1742.8)→1 bac ; 200(cap5831.5)→1 bac (égalité, 110 gagne)
    expect(chooseFourreauSize(items, 0, elig, 0.33).id).toBe(82);
  });
  test('un seul item restant → plus petit fourreau qui le contient (pas de sur-dimensionnement)', () => {
    const elig = eligibleFourreaux(CAT2, {});
    const items = [{ area: 283.5 }];
    expect(chooseFourreauSize(items, 0, elig, 0.33).id).toBe(47);
  });
  test('aucune taille ne contient même l’item seul → null', () => {
    const elig = eligibleFourreaux(CAT2, {});
    expect(chooseFourreauSize([{ area: 999999 }], 0, elig, 0.33)).toBeNull();
  });
});

const { assignCablesToFourreaux } = require('../src/renderer/cable-assign.js');

const CAT2 = [
  { type: 'TPC', code: '63',  od: 63,  id: 47 },   // cap@0.33 ≈ 572.5
  { type: 'TPC', code: '110', od: 110, id: 82 },   // cap@0.33 ≈ 1742.8
  { type: 'TPC', code: '200', od: 200, id: 150 },  // cap@0.33 ≈ 5831.5
];
// aire(od) : od19≈283.5, od40≈1256.6, od60≈2827.4, od200≈31416
const liaison = (id, od, qty = 1) => ({ id, nom: id, cables: [{ fam: 'U1000 R2V', code: `${od}`, od, qty }] });
const TAUX = 0.33 + 1e-9;

describe('interleaveCore', () => {
  const { interleaveCore } = __test;
  const u = (fonction, i) => ({ fonction, code: fonction + i, area: 1 });

  test('entrelace 3 phases pour 1 neutre (ratio du circuit préservé)', () => {
    const phases = [u('phase', 0), u('phase', 1), u('phase', 2), u('phase', 3), u('phase', 4), u('phase', 5)];
    const neutres = [u('neutre', 0), u('neutre', 1)];
    const out = interleaveCore([...phases, ...neutres]);
    expect(out.map((c) => c.fonction)).toEqual([
      'phase', 'phase', 'phase', 'neutre', 'phase', 'phase', 'phase', 'neutre',
    ]);
  });

  test('sans neutre (ou sans phase) → inchangé, rien à entrelacer', () => {
    const core = [u('phase', 0), u('phase', 1)];
    expect(interleaveCore(core)).toEqual(core);
    expect(interleaveCore([u('neutre', 0)])).toEqual([u('neutre', 0)]);
    expect(interleaveCore([])).toEqual([]);
  });

  test('reliquat non entier réparti sans perte (7 phases pour 2 neutres)', () => {
    const phases = Array.from({ length: 7 }, (_, i) => u('phase', i));
    const neutres = [u('neutre', 0), u('neutre', 1)];
    const out = interleaveCore([...phases, ...neutres]);
    expect(out).toHaveLength(9);
    expect(out.filter((c) => c.fonction === 'phase')).toHaveLength(7);
    expect(out.filter((c) => c.fonction === 'neutre')).toHaveLength(2);
  });
});

describe('assignCablesToFourreaux', () => {
  test('petite liaison → plus petit fourreau', () => {
    const r = assignCablesToFourreaux([liaison('L1', 19)], CAT2, { tauxMax: 0.33 });
    expect(r.fourreaux).toHaveLength(1);
    expect(r.fourreaux[0].code).toBe('63');
    expect(r.fourreaux[0].cables).toHaveLength(1);
    expect(r.nonPlaces).toEqual([]);
  });

  test('regroupement croisé : 3 petites liaisons anticipent et tiennent dans 1 seul fourreau', () => {
    const r = assignCablesToFourreaux([liaison('A', 19), liaison('B', 19), liaison('C', 19)], CAT2, { tauxMax: 0.33 });
    // 3×283.5=850.5 ne tient pas dans le 63 (cap 572.5) mais tient dans le 110
    // (cap 1742.8) : l'ouverture anticipe le reste de la file plutôt que de
    // choisir le plus petit fourreau qui contient seulement la 1ère liaison.
    expect(r.fourreaux).toHaveLength(1);
    expect(r.fourreaux[0].code).toBe('110');
    expect(r.fourreaux[0].cables).toHaveLength(3);
    expect(r.nonPlaces).toEqual([]);
  });

  test('N liaisons identiques se regroupent dans peu de fourreaux (pas 1 par liaison)', () => {
    // Cas rapporté : 10 circuits identiques (ici od14, proche d'un 3G2,5 réel)
    // ouvraient chacun leur propre plus petit fourreau (1 câble dedans) faute
    // d'anticipation. od14 → aire ≈153.9 ; seul le 110 (cap 1742.8) et le 200
    // (cap 5831.5) en contiennent plus d'un ; le 110 regroupe déjà les 10.
    const many = Array.from({ length: 10 }, (_, i) => liaison('L' + i, 14));
    const r = assignCablesToFourreaux(many, CAT2, { tauxMax: 0.33 });
    const placed = r.fourreaux.reduce((s, f) => s + f.cables.length, 0);
    expect(placed).toBe(10);
    expect(r.fourreaux.length).toBeLessThan(10);
    for (const f of r.fourreaux) expect(f.tauxOccupation).toBeLessThanOrEqual(TAUX);
    expect(r.nonPlaces).toEqual([]);
  });

  test('taux max jamais dépassé', () => {
    const many = Array.from({ length: 12 }, (_, i) => liaison('L' + i, 40));
    const r = assignCablesToFourreaux(many, CAT2, { tauxMax: 0.33 });
    for (const f of r.fourreaux) expect(f.tauxOccupation).toBeLessThanOrEqual(TAUX);
  });

  test('split : grosse liaison répartie sur plusieurs fourreaux', () => {
    // 3 câbles od60 (2827 chacun, total 8482) > cap max 5831 → split
    const L = { id: 'BIG', nom: 'BIG', cables: [{ fam: 'F', code: '60', od: 60, qty: 3 }] };
    const r = assignCablesToFourreaux([L], CAT2, { tauxMax: 0.33 });
    const placed = r.fourreaux.reduce((s, f) => s + f.cables.length, 0);
    expect(placed).toBe(3);
    expect(r.fourreaux.length).toBeGreaterThanOrEqual(2);
    expect(r.fourreaux.every(f => f.code === '200')).toBe(true);
    expect(r.nonPlaces).toEqual([]);
  });

  test('split : le PE est détaché seul si nécessaire, phases+neutre restent groupés', () => {
    // 3 phases + neutre (od40) tiennent ensemble dans un 200 (5026≤5831) ; +PE
    // ça déborde (6283>5831) : le PE doit être le seul détaché, pas une phase.
    const L = { id: 'BIG', nom: 'BIG', cables: [
      { fam: 'F', code: '40p', od: 40, qty: 3, fonction: 'phase' },
      { fam: 'F', code: '40n', od: 40, qty: 1, fonction: 'neutre' },
      { fam: 'F', code: '40pe', od: 40, qty: 1, fonction: 'PE' },
    ] };
    const CAT3 = [
      { type: 'TPC', code: '110', od: 110, id: 82 },
      { type: 'TPC', code: '200', od: 200, id: 150 },
    ];
    const r = assignCablesToFourreaux([L], CAT3, { tauxMax: 0.33 });
    const core = r.fourreaux.find((f) => f.cables.some((c) => c.fonction !== 'PE'));
    const peOnly = r.fourreaux.find((f) => f.cables.every((c) => c.fonction === 'PE'));
    expect(core.cables.filter((c) => c.fonction === 'phase')).toHaveLength(3);
    expect(core.cables.filter((c) => c.fonction === 'neutre')).toHaveLength(1);
    expect(core.cables.every((c) => c.fonction !== 'PE')).toBe(true); // aucune phase mélangée au PE détaché
    expect(peOnly.cables).toHaveLength(1);
    expect(r.fourreaux).toHaveLength(2);
    expect(r.nonPlaces).toEqual([]);
  });

  test('split : même le noyau phase+neutre doit être scindé → jamais mélangé avec le PE', () => {
    // 3 phases + neutre (od60) ne tiennent même pas ensemble (11310>5831) :
    // scindés câble par câble, mais le PE reste dans un fourreau à part —
    // aucun fourreau ne doit mélanger du PE avec une phase/neutre ici.
    const L = { id: 'BIG', nom: 'BIG', cables: [
      { fam: 'F', code: '60p', od: 60, qty: 3, fonction: 'phase' },
      { fam: 'F', code: '60n', od: 60, qty: 1, fonction: 'neutre' },
      { fam: 'F', code: '60pe', od: 60, qty: 1, fonction: 'PE' },
    ] };
    const CAT3 = [
      { type: 'TPC', code: '63', od: 63, id: 47 },
      { type: 'TPC', code: '110', od: 110, id: 82 },
      { type: 'TPC', code: '200', od: 200, id: 150 },
    ];
    const r = assignCablesToFourreaux([L], CAT3, { tauxMax: 0.33 });
    const placed = r.fourreaux.reduce((s, f) => s + f.cables.length, 0);
    expect(placed).toBe(5);
    expect(r.nonPlaces).toEqual([]);
    for (const f of r.fourreaux) {
      const hasPE = f.cables.some((c) => c.fonction === 'PE');
      const hasCore = f.cables.some((c) => c.fonction !== 'PE');
      expect(hasPE && hasCore).toBe(false); // jamais PE + phase/neutre dans le même fourreau
    }
  });

  test('split du noyau : phases et neutre entrelacés, aucun fourreau 100% phases ou 100% neutre', () => {
    // parallele=3, nbPhases=3 (9 phases + 3 neutre, od40) : le noyau entier ne
    // tient pas dans un seul fourreau (12×1256.6=15079 > cap max 5831.5), donc
    // split. Sans entrelacement, les phases partiraient toutes ensemble puis
    // le neutre à part (fourreaux non équilibrés magnétiquement).
    const L = { id: 'BIG', nom: 'BIG', cables: [
      { fam: 'F', code: '40p', od: 40, qty: 9, fonction: 'phase' },
      { fam: 'F', code: '40n', od: 40, qty: 3, fonction: 'neutre' },
    ] };
    const CAT3 = [
      { type: 'TPC', code: '110', od: 110, id: 82 },
      { type: 'TPC', code: '200', od: 200, id: 150 },
    ];
    const r = assignCablesToFourreaux([L], CAT3, { tauxMax: 0.33 });
    const placed = r.fourreaux.reduce((s, f) => s + f.cables.length, 0);
    expect(placed).toBe(12);
    expect(r.nonPlaces).toEqual([]);
    for (const f of r.fourreaux) {
      const nPhase = f.cables.filter((c) => c.fonction === 'phase').length;
      const nNeutre = f.cables.filter((c) => c.fonction === 'neutre').length;
      if (nPhase > 0) expect(nNeutre).toBeGreaterThan(0); // jamais des phases sans leur neutre
    }
  });

  test('câble trop gros pour la taille max → nonPlaces (pas de crash)', () => {
    const r = assignCablesToFourreaux([liaison('X', 200)], CAT2, { tauxMax: 0.33 });
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces).toHaveLength(1);
    expect(r.nonPlaces[0]).toMatchObject({ liaisonId: 'X', od: 200 });
  });

  test('borne tailleMaxFourreauOd : od40 ne rentre plus si limité au 63', () => {
    const r = assignCablesToFourreaux([liaison('Y', 40)], CAT2, { tauxMax: 0.33, tailleMaxFourreauOd: 63 });
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces).toHaveLength(1);
  });

  test('catalogue vide → tout en nonPlaces avec raison dédiée', () => {
    const r = assignCablesToFourreaux([liaison('Z', 19)], [], {});
    expect(r.fourreaux).toEqual([]);
    expect(r.nonPlaces[0].raison).toBe('aucun fourreau éligible');
  });

  test('déterministe : deux appels identiques → résultat identique', () => {
    const input = [liaison('A', 40), liaison('B', 19), liaison('C', 60)];
    const a = assignCablesToFourreaux(input, CAT2, { tauxMax: 0.33 });
    const b = assignCablesToFourreaux(input, CAT2, { tauxMax: 0.33 });
    expect(a).toEqual(b);
  });

  test('liaisons vides → { fourreaux:[], nonPlaces:[] } ; taux par défaut 0.33', () => {
    expect(assignCablesToFourreaux([], CAT2)).toEqual({ fourreaux: [], nonPlaces: [] });
    // défaut : od40 (1256.6) tient dans id82 (cap 1742) mais pas id47 (572) → code 110
    const r = assignCablesToFourreaux([liaison('D', 40)], CAT2);
    expect(r.fourreaux[0].code).toBe('110');
  });

  test('typesAutorises end-to-end : un ICTA plus petit mais non-autorisé est ignoré', () => {
    // ICTA id39.6 : cap@0.33 ≈ 406.4 > aire(19)≈283.5 → serait choisi en premier
    // (plus petit) si le filtre ne s'appliquait pas au bout-en-bout.
    const CAT_MIXED = [...CAT2, { type: 'ICTA', code: '50', od: 50, id: 39.6 }];
    const r = assignCablesToFourreaux([liaison('T', 19)], CAT_MIXED, { tauxMax: 0.33, typesAutorises: ['TPC'] });
    expect(r.fourreaux.length).toBeGreaterThanOrEqual(1);
    expect(r.fourreaux.every(f => f.type === 'TPC')).toBe(true);
    expect(r.nonPlaces).toEqual([]);
  });
});

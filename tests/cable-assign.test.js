const { __test } = require('../src/renderer/cable-assign.js');
const { aire, capacite, expandCables, eligibleFourreaux, smallestFourreauFor } = __test;

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

const { assignCablesToFourreaux } = require('../src/renderer/cable-assign.js');

const CAT2 = [
  { type: 'TPC', code: '63',  od: 63,  id: 47 },   // cap@0.33 ≈ 572.5
  { type: 'TPC', code: '110', od: 110, id: 82 },   // cap@0.33 ≈ 1742.8
  { type: 'TPC', code: '200', od: 200, id: 150 },  // cap@0.33 ≈ 5831.5
];
// aire(od) : od19≈283.5, od40≈1256.6, od60≈2827.4, od200≈31416
const liaison = (id, od, qty = 1) => ({ id, nom: id, cables: [{ fam: 'U1000 R2V', code: `${od}`, od, qty }] });
const TAUX = 0.33 + 1e-9;

describe('assignCablesToFourreaux', () => {
  test('petite liaison → plus petit fourreau', () => {
    const r = assignCablesToFourreaux([liaison('L1', 19)], CAT2, { tauxMax: 0.33 });
    expect(r.fourreaux).toHaveLength(1);
    expect(r.fourreaux[0].code).toBe('63');
    expect(r.fourreaux[0].cables).toHaveLength(1);
    expect(r.nonPlaces).toEqual([]);
  });

  test('regroupement croisé : 2 liaisons dans 1 fourreau, la 3e ouvre un 2e', () => {
    const r = assignCablesToFourreaux([liaison('A', 19), liaison('B', 19), liaison('C', 19)], CAT2, { tauxMax: 0.33 });
    // 2×283.5=567 ≤ 572.5 ; 3×=850.5 > 572.5
    expect(r.fourreaux).toHaveLength(2);
    expect(r.fourreaux[0].cables).toHaveLength(2);
    expect(r.fourreaux[1].cables).toHaveLength(1);
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
});

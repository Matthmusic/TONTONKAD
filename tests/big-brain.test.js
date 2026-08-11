const { validateLiaisons, resultToObjects, validateReserves, buildReserveFourreaux, buildGenerationResult } = require('../src/renderer/big-brain.js');

const liaisonOK = () => ({ id: 'L1', nom: 'TGBT → GE', cables: [{ fam: 'U1000 R2V', code: '2x185', od: 25.5, qty: 3 }] });

describe('validateLiaisons', () => {
  test('liste vide → ok:false', () => {
    const r = validateLiaisons([]);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/aucune liaison/i);
  });
  test('cas valide → ok:true, errors vide', () => {
    expect(validateLiaisons([liaisonOK()])).toEqual({ ok: true, errors: [] });
  });
  test('nom vide → erreur sur l’index', () => {
    const r = validateLiaisons([{ id: 'L', nom: '  ', cables: [{ fam: 'F', code: 'c', od: 10, qty: 1 }] }]);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.index === 0 && /nom/i.test(e.message))).toBe(true);
  });
  test('liaison sans câble → erreur', () => {
    const r = validateLiaisons([{ id: 'L', nom: 'X', cables: [] }]);
    expect(r.errors.some(e => /sans câble/i.test(e.message))).toBe(true);
  });
  test('câble od<=0 ou qty invalide → erreur', () => {
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 0, qty: 1 }] }]).ok).toBe(false);
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 10, qty: 0 }] }]).ok).toBe(false);
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: 10, qty: 1.5 }] }]).ok).toBe(false);
  });
  test('câble sans fam/code → erreur', () => {
    expect(validateLiaisons([{ id: 'L', nom: 'X', cables: [{ od: 10, qty: 1 }] }]).ok).toBe(false);
  });
  test('od et qty en chaîne numérique (saisie DOM) → ok:true', () => {
    const r = validateLiaisons([{ id: 'L', nom: 'X', cables: [{ fam: 'F', code: 'c', od: '25.5', qty: '3' }] }]);
    expect(r.ok).toBe(true);
  });
});

describe('resultToObjects', () => {
  const result = {
    fourreaux: [
      { type: 'TPC', code: '200', od: 200, id: 150, tauxOccupation: 0.31, cables: [
        { liaisonId: 'L1', fam: 'U1000 R2V', code: '2x185', od: 25.5, fonction: 'phase' },
        { liaisonId: 'L1', fam: 'U1000 R2V', code: '1x185', od: 25.5, fonction: 'PE' },
      ] },
      { type: 'TPC', code: '110', od: 110, id: 82, tauxOccupation: 0.2, cables: [
        { liaisonId: 'L2', fam: 'F', code: 'c', od: 20 },
      ] },
    ],
    nonPlaces: [],
  };
  const names = { L1: 'TGBT → GE', L2: 'GE → Onduleur' };

  test('mappe id→idm et conserve type/code/od/taux', () => {
    const { fourreaux } = resultToObjects(result, names);
    expect(fourreaux[0]).toMatchObject({ type: 'TPC', code: '200', od: 200, idm: 150, tauxOccupation: 0.31 });
  });
  test('parentIndex rattache chaque câble au bon fourreau', () => {
    const { cables } = resultToObjects(result, names);
    expect(cables).toHaveLength(3);
    expect(cables.filter(c => c.parentIndex === 0)).toHaveLength(2);
    expect(cables.filter(c => c.parentIndex === 1)).toHaveLength(1);
  });
  test('labels résolus via liaisonsById, fallback = liaisonId (fourreau)', () => {
    expect(resultToObjects(result, names).fourreaux[0].label).toBe('TGBT → GE');
    expect(resultToObjects(result, {}).fourreaux[0].label).toBe('L1'); // fallback
  });
  test('les câbles ne portent pas le nom de liaison (libellé réservé au fourreau)', () => {
    const { fourreaux, cables } = resultToObjects(result, names);
    expect(fourreaux[0].label).toBe('TGBT → GE');
    expect(cables.every((c) => c.label === '')).toBe(true);
  });
  test('label fourreau multi-liaisons → "nom +N"', () => {
    const mixed = { fourreaux: [{ type: 'T', code: 'c', od: 1, id: 1, cables: [
      { liaisonId: 'L1' }, { liaisonId: 'L2' },
    ] }], nonPlaces: [] };
    expect(resultToObjects(mixed, names).fourreaux[0].label).toBe('TGBT → GE +1');
  });
  test('résultat vide → objets vides', () => {
    expect(resultToObjects({ fourreaux: [], nonPlaces: [] }, {})).toEqual({ fourreaux: [], cables: [] });
  });
  test('chaque câble porte son liaisonId (pour l’affectation des phases)', () => {
    const { cables } = resultToObjects(result, names);
    expect(cables.map(c => c.liaisonId)).toEqual(['L1', 'L1', 'L2']);
  });
  // Fourreaux de réserve (buildReserveFourreaux) : aucun câble à l'intérieur,
  // donc rien dont dériver un libellé par liaison — resultToObjects doit
  // respecter un f.label déjà posé plutôt que de le recalculer en '' (voir
  // describe('buildReserveFourreaux') plus bas pour la génération de f.label).
  test('f.label déjà posé (fourreau sans câble, ex. réserve) → respecté tel quel', () => {
    const withLabel = { fourreaux: [{ type: 'TPC', code: '200', od: 200, id: 150, cables: [], label: 'Réserve DN200' }], nonPlaces: [] };
    expect(resultToObjects(withLabel, {}).fourreaux[0].label).toBe('Réserve DN200');
  });
});

const CATALOGUE_FOURREAUX = [
  { type: 'TPC', code: '40', od: 40, id: 30 },
  { type: 'TPC', code: '200', od: 200, id: 150 },
  { type: 'IRL', code: '16', od: 16, id: 13 },
];

describe('validateReserves', () => {
  test('liste vide/absente → ok:true (les réserves sont optionnelles)', () => {
    expect(validateReserves([], CATALOGUE_FOURREAUX)).toEqual({ ok: true, errors: [] });
    expect(validateReserves(undefined, CATALOGUE_FOURREAUX)).toEqual({ ok: true, errors: [] });
  });
  test('cas valide → ok:true, errors vide', () => {
    const r = validateReserves([{ id: 'L1', nom: 'Réserve 200', reserve: { type: 'TPC', code: '200', qty: 3 } }], CATALOGUE_FOURREAUX);
    expect(r).toEqual({ ok: true, errors: [] });
  });
  test('nom vide → erreur sur l’index', () => {
    const r = validateReserves([{ id: 'L', nom: '  ', reserve: { type: 'TPC', code: '200', qty: 1 } }], CATALOGUE_FOURREAUX);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.index === 0 && /nom/i.test(e.message))).toBe(true);
  });
  test('type+code introuvable au catalogue → erreur', () => {
    const r = validateReserves([{ id: 'L', nom: 'X', reserve: { type: 'TPC', code: '999', qty: 1 } }], CATALOGUE_FOURREAUX);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /introuvable/i.test(e.message))).toBe(true);
  });
  test('quantité invalide (0, négative, non entière) → erreur', () => {
    expect(validateReserves([{ id: 'L', nom: 'X', reserve: { type: 'TPC', code: '200', qty: 0 } }], CATALOGUE_FOURREAUX).ok).toBe(false);
    expect(validateReserves([{ id: 'L', nom: 'X', reserve: { type: 'TPC', code: '200', qty: -1 } }], CATALOGUE_FOURREAUX).ok).toBe(false);
    expect(validateReserves([{ id: 'L', nom: 'X', reserve: { type: 'TPC', code: '200', qty: 1.5 } }], CATALOGUE_FOURREAUX).ok).toBe(false);
  });
  test('quantité en chaîne numérique (saisie DOM) → ok:true', () => {
    const r = validateReserves([{ id: 'L', nom: 'X', reserve: { type: 'TPC', code: '200', qty: '3' } }], CATALOGUE_FOURREAUX);
    expect(r.ok).toBe(true);
  });
  test('plusieurs erreurs sur des liaisons différentes → toutes remontées', () => {
    const r = validateReserves([
      { id: 'L1', nom: '', reserve: { type: 'TPC', code: '200', qty: 1 } },
      { id: 'L2', nom: 'Y', reserve: { type: 'X', code: '?', qty: 1 } },
    ], CATALOGUE_FOURREAUX);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0].index).toBe(0);
    expect(r.errors[1].index).toBe(1);
  });
});

describe('buildReserveFourreaux', () => {
  test('une réserve de qty 3 → 3 fourreaux identiques, sans câble, label = nom de la liaison', () => {
    const out = buildReserveFourreaux([{ id: 'L1', nom: 'Réserve 200', reserve: { type: 'TPC', code: '200', qty: 3 } }], CATALOGUE_FOURREAUX);
    expect(out).toHaveLength(3);
    out.forEach((f) => {
      expect(f).toMatchObject({ type: 'TPC', code: '200', od: 200, id: 150, cables: [], usedArea: 0, tauxOccupation: 0, label: 'Réserve 200' });
    });
  });
  test('plusieurs liaisons réserve → fourreaux concaténés dans l’ordre', () => {
    const out = buildReserveFourreaux([
      { id: 'L1', nom: 'A', reserve: { type: 'TPC', code: '40', qty: 1 } },
      { id: 'L2', nom: 'B', reserve: { type: 'IRL', code: '16', qty: 2 } },
    ], CATALOGUE_FOURREAUX);
    expect(out.map((f) => f.label)).toEqual(['A', 'B', 'B']);
  });
  test('qty en chaîne numérique (saisie DOM) → expansée correctement', () => {
    const out = buildReserveFourreaux([{ id: 'L1', nom: 'A', reserve: { type: 'TPC', code: '40', qty: '2' } }], CATALOGUE_FOURREAUX);
    expect(out).toHaveLength(2);
  });
  test('type+code introuvable au catalogue → aucun fourreau généré (pas de crash)', () => {
    const out = buildReserveFourreaux([{ id: 'L1', nom: 'A', reserve: { type: 'X', code: '?', qty: 5 } }], CATALOGUE_FOURREAUX);
    expect(out).toEqual([]);
  });
  test('qty nulle/négative/non numérique → aucun fourreau (pas de crash)', () => {
    expect(buildReserveFourreaux([{ id: 'L1', nom: 'A', reserve: { type: 'TPC', code: '40', qty: 0 } }], CATALOGUE_FOURREAUX)).toEqual([]);
    expect(buildReserveFourreaux([{ id: 'L1', nom: 'A', reserve: { type: 'TPC', code: '40', qty: -3 } }], CATALOGUE_FOURREAUX)).toEqual([]);
  });
  test('liste vide/absente → tableau vide', () => {
    expect(buildReserveFourreaux([], CATALOGUE_FOURREAUX)).toEqual([]);
    expect(buildReserveFourreaux(undefined, CATALOGUE_FOURREAUX)).toEqual([]);
  });
});

describe('buildGenerationResult', () => {
  const cableResult = {
    fourreaux: [{ type: 'TPC', code: '40', od: 40, id: 30, cables: [{ liaisonId: 'L1', fam: 'F', code: 'c', od: 10, qty: 1 }], usedArea: 5, tauxOccupation: 0.2 }],
    nonPlaces: [{ liaisonId: 'L1', fam: 'F', code: 'c', od: 999, raison: 'trop gros' }],
  };
  const reserveLiaisons = [{ id: 'L2', nom: 'Réserve 200', reserve: { type: 'TPC', code: '200', qty: 2 } }];

  test('concatène fourreaux circuits + fourreaux réserve (circuits en premier)', () => {
    const r = buildGenerationResult(cableResult, reserveLiaisons, CATALOGUE_FOURREAUX);
    expect(r.fourreaux).toHaveLength(3);
    expect(r.fourreaux[0]).toMatchObject({ type: 'TPC', code: '40' });
    expect(r.fourreaux[1]).toMatchObject({ type: 'TPC', code: '200', label: 'Réserve 200' });
    expect(r.fourreaux[2]).toMatchObject({ type: 'TPC', code: '200', label: 'Réserve 200' });
  });
  test('nonPlaces vient uniquement du résultat circuits (les réserves n’en produisent jamais)', () => {
    const r = buildGenerationResult(cableResult, reserveLiaisons, CATALOGUE_FOURREAUX);
    expect(r.nonPlaces).toBe(cableResult.nonPlaces);
  });
  test('aucune réserve → fourreaux = ceux du circuit tels quels', () => {
    const r = buildGenerationResult(cableResult, [], CATALOGUE_FOURREAUX);
    expect(r.fourreaux).toEqual(cableResult.fourreaux);
  });
  test('cableResult vide/absent → seules les réserves apparaissent, pas de crash', () => {
    expect(buildGenerationResult({ fourreaux: [], nonPlaces: [] }, reserveLiaisons, CATALOGUE_FOURREAUX).fourreaux).toHaveLength(2);
    expect(buildGenerationResult(undefined, reserveLiaisons, CATALOGUE_FOURREAUX).fourreaux).toHaveLength(2);
    expect(buildGenerationResult(undefined, reserveLiaisons, CATALOGUE_FOURREAUX).nonPlaces).toEqual([]);
  });
  test('ni circuit ni réserve → résultat vide', () => {
    expect(buildGenerationResult({ fourreaux: [], nonPlaces: [] }, [], CATALOGUE_FOURREAUX)).toEqual({ fourreaux: [], nonPlaces: [] });
  });
});

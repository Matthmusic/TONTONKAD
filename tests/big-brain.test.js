const { validateLiaisons, resultToObjects } = require('../src/renderer/big-brain.js');

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
  test('labels résolus via liaisonsById, fallback = liaisonId', () => {
    expect(resultToObjects(result, names).fourreaux[0].label).toBe('TGBT → GE');
    expect(resultToObjects(result, names).cables[2].label).toBe('GE → Onduleur');
    expect(resultToObjects(result, {}).cables[0].label).toBe('L1'); // fallback
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
});

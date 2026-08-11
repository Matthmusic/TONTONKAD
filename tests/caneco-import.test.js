// tests/caneco-import.test.js
const { __test, parseRow, parseWorkbook } = require('../src/renderer/caneco-import.js');
const { normalizeFamille, matchFamille, normalizeCodeForCompare, parseCode, defaultPhaseSplit } = __test;

// Sous-ensemble du vrai catalogue (data/cables.csv) pertinent pour ces tests.
// U1000 R2V/AR2V désignent leurs câbles multiconducteurs avec "x" (ex.
// "5x4"), PAS "G" — mais c'est le même concept (câble à N âmes) que "5G4"
// chez H07RN-F : les deux notations doivent matcher l'une comme l'autre.
// « CIRCUIT MONOPHASE » (2x2,5) n'a pas de SKU 2 âmes ici → sert à tester le
// repli en mono.
const CATALOGUE = [
  { fam: 'U1000 R2V', code: '1x1,5', od: 6.4 },
  { fam: 'U1000 R2V', code: '1x2,5', od: 6.8 },
  { fam: 'U1000 R2V', code: '1x4', od: 7.2 },
  { fam: 'U1000 R2V', code: '1x35', od: 13.5 },
  { fam: 'U1000 R2V', code: '1x400', od: 34.5 },
  { fam: 'U1000 R2V', code: '3x1,5', od: 11 },
  { fam: 'U1000 R2V', code: '3x2,5', od: 12.5 },
  { fam: 'U1000 R2V', code: '3x70', od: 34 },
  { fam: 'U1000 R2V', code: '4x35', od: 28.5 },
  { fam: 'U1000 R2V', code: '5x4', od: 16 },
  { fam: 'U1000 AR2V', code: '1x400', od: 34.5 },
  { fam: 'H07RN-F', code: '3G2.5', od: 14 },
  { fam: 'H07RN-F', code: '5G4', od: 19.9 },
];

describe('normalizeFamille', () => {
  test('retire le suffixe entre parenthèses, espaces/tirets, met en majuscules', () => {
    expect(normalizeFamille('U1000R2V (90°C)')).toBe('U1000R2V');
    expect(normalizeFamille('U1000-AR2V')).toBe('U1000AR2V');
    expect(normalizeFamille('u1000 r2v')).toBe('U1000R2V');
  });
  test('valeur vide/absente → chaîne vide', () => {
    expect(normalizeFamille('')).toBe('');
    expect(normalizeFamille(undefined)).toBe('');
  });
});

describe('matchFamille', () => {
  const familles = ['U1000 R2V', 'U1000 AR2V', 'H07RN-F', 'H07BN4-F'];
  test('« U1000R2V (90°C) » (Caneco) trouve « U1000 R2V » (catalogue)', () => {
    expect(matchFamille('U1000R2V (90°C)', familles)).toBe('U1000 R2V');
  });
  test('« U1000AR2V (90°C) » trouve « U1000 AR2V » — pas confondu avec U1000 R2V', () => {
    expect(matchFamille('U1000AR2V (90°C)', familles)).toBe('U1000 AR2V');
  });
  test('aucune correspondance → null (pas de faux positif)', () => {
    expect(matchFamille('CABLE INCONNU XYZ', familles)).toBeNull();
  });
});

describe('parseCode', () => {
  test('« NxS » (ex. 4x35) AVEC un SKU multiconducteur réel au catalogue → mode multi, code du catalogue', () => {
    // U1000 R2V écrit ses câbles multiconducteurs avec "x", pas "G" — "4x35" y est un SKU réel.
    const r = parseCode('4x35', '', 'U1000 R2V', CATALOGUE);
    expect(r).toMatchObject({ recognized: true, mode: 'multi', codeMulti: '4x35', parallele: 1, nbConducteurs: 4 });
  });

  test('« NGS » (ex. 5G4) matche un SKU catalogue écrit avec « x » (5x4) — séparateurs interchangeables', () => {
    // C'est le même câble physique que "U1000 R2V;5x4" — seule la lettre change.
    const r = parseCode('5G4', '', 'U1000 R2V', CATALOGUE);
    expect(r).toMatchObject({ recognized: true, mode: 'multi', codeMulti: '5x4', parallele: 1, nbConducteurs: 5 });
  });

  test('« NxS »/« NGS » SANS SKU multiconducteur au catalogue pour cette famille → replié en mono', () => {
    // "2x2,5" (monophasé) n'a pas de SKU 2 âmes dans la fixture → repli en 2 conducteurs unipolaires.
    const r = parseCode('2x2,5', '', 'U1000 R2V', CATALOGUE);
    expect(r).toMatchObject({ recognized: true, mode: 'mono', parallele: 1, nbConducteurs: 2, codeUnitaire: '1x2,5' });
  });

  test('« NGS » AVEC un SKU multiconducteur réel au catalogue (même notation) → mode multi, code du catalogue', () => {
    // H07RN-F a bien "3G2.5" (point, pas virgule) au catalogue, sous cette même notation.
    const r = parseCode('3G2,5', '', 'H07RN-F', CATALOGUE);
    expect(r).toMatchObject({ recognized: true, mode: 'multi', codeMulti: '3G2.5', parallele: 1 });
  });

  test('« NxMx(1xS) » avec code élémentaire renseigné (colonne E) → mono, parallele=M, code = colonne E', () => {
    const r = parseCode('4X3X(1x400)', '1x400', 'U1000 AR2V', CATALOGUE);
    expect(r).toMatchObject({ recognized: true, mode: 'mono', parallele: 3, nbConducteurs: 4, codeUnitaire: '1x400' });
  });

  test('« NxMx(1xS) » sans colonne E → code unitaire dérivé de la parenthèse', () => {
    const r = parseCode('4X3X(1x400)', '', 'U1000 AR2V', CATALOGUE);
    expect(r.codeUnitaire).toBe('1x400');
  });

  test('code vide ou non reconnu → recognized:false, pas de crash', () => {
    expect(parseCode('', '', 'U1000 R2V', CATALOGUE)).toMatchObject({ recognized: false });
    expect(parseCode('???', '', 'U1000 R2V', CATALOGUE)).toMatchObject({ recognized: false });
  });
});

describe('defaultPhaseSplit', () => {
  test('3 conducteurs → 3 phases, ni neutre ni PE (convention confirmée)', () => {
    expect(defaultPhaseSplit(3)).toEqual({ nbPhases: 3, neutre: false, pe: false, uncertain: false });
  });
  test('4 conducteurs → 3 phases + PE', () => {
    expect(defaultPhaseSplit(4)).toEqual({ nbPhases: 3, neutre: false, pe: true, uncertain: false });
  });
  test('5 conducteurs → 3 phases + neutre + PE', () => {
    expect(defaultPhaseSplit(5)).toEqual({ nbPhases: 3, neutre: true, pe: true, uncertain: false });
  });
  test('autre nombre (ex. 1, 2, 7) → replié en tout-phase, marqué incertain', () => {
    expect(defaultPhaseSplit(2)).toEqual({ nbPhases: 2, neutre: false, pe: false, uncertain: true });
    expect(defaultPhaseSplit(7)).toEqual({ nbPhases: 7, neutre: false, pe: false, uncertain: true });
  });
});

describe('parseRow — bout en bout, sur des lignes réelles du carnet Caneco', () => {
  test('ligne réserve (longueur 0, code vide) → non sélectionnable', () => {
    const row = ['TGBT', 'RÉSERVE ÉQUIPÉE 63A', '0', '', '', 'U1000R2V (90°C)'];
    const d = parseRow(row, CATALOGUE);
    expect(d.selectable).toBe(false);
    expect(d.nom).toBe('RÉSERVE ÉQUIPÉE 63A');
  });

  test('ligne « 3G2,5 » réelle (PROT - RELAIS PROT.) → multi, SKU catalogue "3x2,5", famille résolue', () => {
    const row = ['TGBT', 'PROT - RELAIS PROT.', '5', '3G2,5', '', 'U1000R2V (90°C)'];
    const d = parseRow(row, CATALOGUE);
    expect(d.selectable).toBe(true);
    expect(d.liaison.circuit).toMatchObject({
      mode: 'multi', fam: 'U1000 R2V', codeMulti: '3x2,5', parallele: 1,
    });
    expect(d.warning).toBeNull();
  });

  test('ligne « 5G4 » réelle (ALIM - ENROUL. ARM IRBE 1) → multi, SKU catalogue "5x4"', () => {
    const row = ['TGBT', 'ALIM - ENROUL. ARM IRBE 1', '130', '5G4', '', 'U1000R2V (90°C)'];
    const d = parseRow(row, CATALOGUE);
    expect(d.liaison.circuit).toMatchObject({
      mode: 'multi', fam: 'U1000 R2V', codeMulti: '5x4', parallele: 1,
    });
    expect(d.warning).toBeNull();
  });

  test('ligne complexe réelle (P1 - ALIM ARM IRBE 1, 4X3X(1x400)) → mono 3P+PE, parallele=3', () => {
    const row = ['TGBT', 'P1 - ALIM ARM IRBE 1', '80', '4X3X(1x400)', '1x400', 'U1000AR2V (90°C)'];
    const d = parseRow(row, CATALOGUE);
    expect(d.liaison.circuit).toMatchObject({
      mode: 'mono', fam: 'U1000 AR2V', nbPhases: 3, neutre: false, pe: true,
      codePhase: '1x400', codePE: '1x400', parallele: 3,
    });
  });

  test('famille non reconnue → fam vide + avertissement, mais le reste est importé quand même', () => {
    const row = ['TGBT', 'CIRCUIT TEST', '5', '4x35', '', 'CABLE INCONNU XYZ'];
    const d = parseRow(row, CATALOGUE);
    expect(d.selectable).toBe(true);
    expect(d.liaison.circuit.fam).toBe('');
    expect(d.warning).toMatch(/famille/i);
  });

  test('nombre de conducteurs hors convention (ex. 2) → importé mais averti « à vérifier »', () => {
    const row = ['TGBT', 'CIRCUIT MONOPHASE', '5', '2x2,5', '', 'U1000R2V (90°C)'];
    const d = parseRow(row, CATALOGUE);
    expect(d.selectable).toBe(true);
    expect(d.warning).toMatch(/vérifier/i);
  });
});

describe('parseWorkbook', () => {
  test('déplie toutes les lignes, conserve leur index d\'origine, aucun crash sur une feuille vide', () => {
    const rows = [
      ['TGBT', 'PROT - PARAFOUDRE', '1', '4x35', '', 'U1000R2V (90°C)'],
      ['TGBT', 'RÉSERVE ÉQUIPÉE 63A', '0', '', '', 'U1000R2V (90°C)'],
    ];
    const drafts = parseWorkbook(rows, CATALOGUE);
    expect(drafts).toHaveLength(2);
    expect(drafts[0].rowIndex).toBe(0);
    expect(drafts[1].rowIndex).toBe(1);
    expect(parseWorkbook([], CATALOGUE)).toEqual([]);
    expect(parseWorkbook(null, CATALOGUE)).toEqual([]);
  });
});

const { circuitToCables } = require('../src/renderer/circuit.js');

// resolveOd factice : diamètre déduit du code pour vérifier le câblage
const resolveOd = (fam, code) => ({ '1x185': 25.5, '1x95': 19, '1x50': 15, '5x16': 25 }[code] || 0);
const base = {
  fam: 'U1000-AR2V', nbPhases: 3, codePhase: '1x185',
  neutre: true, codeNeutre: '1x185', pe: true, codePE: '1x185', parallele: 1,
};

describe('circuitToCables', () => {
  test('3 phases + neutre + PE → 3 entrées, fonctions et qty correctes', () => {
    expect(circuitToCables(base, resolveOd)).toEqual([
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 3, fonction: 'phase' },
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 1, fonction: 'neutre' },
      { fam: 'U1000-AR2V', code: '1x185', od: 25.5, qty: 1, fonction: 'PE' },
    ]);
  });

  test('sans neutre / sans PE → entrées omises', () => {
    const r = circuitToCables({ ...base, neutre: false, pe: false }, resolveOd);
    expect(r).toHaveLength(1);
    expect(r[0].fonction).toBe('phase');
  });

  test('sections différentes par fonction respectées', () => {
    const r = circuitToCables({ ...base, codePE: '1x95' }, resolveOd);
    const pe = r.find((c) => c.fonction === 'PE');
    expect(pe).toMatchObject({ code: '1x95', od: 19 });
  });

  test('parallele=2 multiplie phases et neutre, mais pas le PE (un seul PE quel que soit le nombre de circuits en parallèle)', () => {
    const r = circuitToCables({ ...base, parallele: 2 }, resolveOd);
    expect(r.map((c) => c.qty)).toEqual([6, 2, 1]);
  });

  test('parallele=4 → toujours 1 seul PE', () => {
    const r = circuitToCables({ ...base, parallele: 4 }, resolveOd);
    const pe = r.find((c) => c.fonction === 'PE');
    expect(pe.qty).toBe(1);
  });

  test('nbPhases=0 → pas d’entrée phase', () => {
    const r = circuitToCables({ ...base, nbPhases: 0 }, resolveOd);
    expect(r.every((c) => c.fonction !== 'phase')).toBe(true);
    expect(r).toHaveLength(2);
  });

  test('circuit vide/absent → [] sans crash', () => {
    expect(circuitToCables(null, resolveOd)).toEqual([]);
    expect(circuitToCables({}, resolveOd)).toEqual([]);
  });

  test('parallele absent → 1 par défaut ; valeurs en chaîne tolérées', () => {
    const r = circuitToCables({ ...base, parallele: undefined, nbPhases: '3' }, resolveOd);
    expect(r[0].qty).toBe(3);
  });

  test('resolveOd non fourni → od 0, pas de crash', () => {
    expect(circuitToCables(base)[0].od).toBe(0);
  });
});

describe('circuitToCables — mode multi', () => {
  // base porte 3 phases + neutre + PE : en multi ils doivent être IGNORÉS,
  // le câble multiconducteur portant déjà tous les conducteurs.
  const multi = { ...base, mode: 'multi', codeMulti: '5x16' };

  test('multi → une seule entrée, fonction "aucune", phases/N/PE ignorés', () => {
    expect(circuitToCables(multi, resolveOd)).toEqual([
      { fam: 'U1000-AR2V', code: '5x16', od: 25, qty: 1, fonction: 'aucune' },
    ]);
  });

  test('parallele=3 → qty 3 (un câble par circuit en parallèle)', () => {
    const r = circuitToCables({ ...multi, parallele: 3 }, resolveOd);
    expect(r).toHaveLength(1);
    expect(r[0].qty).toBe(3);
  });

  test('codeMulti absent ou vide → [] (bloqué en amont par validateLiaisons)', () => {
    expect(circuitToCables({ ...multi, codeMulti: '' }, resolveOd)).toEqual([]);
    expect(circuitToCables({ ...base, mode: 'multi' }, resolveOd)).toEqual([]);
  });

  test('mode "mono" explicite = mode absent (rétrocompatibilité)', () => {
    expect(circuitToCables({ ...base, mode: 'mono' }, resolveOd))
      .toEqual(circuitToCables(base, resolveOd));
  });
});

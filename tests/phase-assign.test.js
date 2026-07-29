const { assignPhases, isUnipolaire, buildPhaseQueues } = require('../src/renderer/phase-assign.js');

describe('isUnipolaire', () => {
  test('1x… → true, multipolaire → false', () => {
    expect(isUnipolaire('1x185')).toBe(true);
    expect(isUnipolaire('1X10')).toBe(true);
    expect(isUnipolaire(' 1x6 ')).toBe(true);
    expect(isUnipolaire('2x185')).toBe(false);
    expect(isUnipolaire('4x25')).toBe(false);
    expect(isUnipolaire('')).toBe(false);
    expect(isUnipolaire(undefined)).toBe(false);
  });
});

describe('assignPhases — mode auto', () => {
  test('unipolaires : cycle L1/L2/L3 sur les unités (qty déplié)', () => {
    expect(assignPhases([{ code: '1x185', qty: 3 }])).toEqual(['L1', 'L2', 'L3']);
  });
  test('le cycle boucle après L3', () => {
    expect(assignPhases([{ code: '1x185', qty: 4 }])).toEqual(['L1', 'L2', 'L3', 'L1']);
  });
  test('multipolaire → null et ne consomme pas le cycle', () => {
    expect(assignPhases([{ code: '2x185', qty: 1 }, { code: '1x185', qty: 2 }]))
      .toEqual([null, 'L1', 'L2']);
  });
});

describe('assignPhases — fonction explicite', () => {
  test('neutre → N, PE → PE, aucune → null', () => {
    expect(assignPhases([
      { code: '1x185', qty: 1, fonction: 'neutre' },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1, fonction: 'aucune' },
    ])).toEqual(['N', 'PE', null]);
  });
  test('phase forcée sur un multipolaire prend quand même le cycle', () => {
    expect(assignPhases([{ code: '4x25', qty: 2, fonction: 'phase' }])).toEqual(['L1', 'L2']);
  });
  test('N et PE ne consomment pas le cycle des phases', () => {
    expect(assignPhases([
      { code: '1x185', qty: 2 },
      { code: '1x185', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 1 },
    ])).toEqual(['L1', 'L2', 'PE', 'L3']);
  });
  test('cas métier 3×[2x185] + PE[1x185]', () => {
    expect(assignPhases([
      { code: '2x185', qty: 3 },
      { code: '1x185', qty: 1, fonction: 'PE' },
    ])).toEqual([null, null, null, 'PE']);
  });
});

describe('assignPhases — cas limites', () => {
  test('liste vide → []', () => { expect(assignPhases([])).toEqual([]); });
  test('qty absent → 1 unité ; qty 0 → ignoré', () => {
    expect(assignPhases([{ code: '1x185' }])).toEqual(['L1']);
    expect(assignPhases([{ code: '1x185', qty: 0 }])).toEqual([]);
  });
  test('qty en chaîne numérique tolérée', () => {
    expect(assignPhases([{ code: '1x185', qty: '2' }])).toEqual(['L1', 'L2']);
  });
});

describe('buildPhaseQueues — robuste au tri/split de cable-assign.js', () => {
  // Scénario du bug : cable-assign.js peut retrier les unités d'une liaison par
  // aire décroissante (repli "split câble par câble"). Une file unique consommée
  // "dans l'ordre rencontré" ferait alors passer les 1x185 avant le 1x50/PE et
  // désynchroniserait la phase du câble. buildPhaseQueues doit regrouper par
  // signature (liaisonId|code|fonction) pour rester correct quel que soit
  // l'ordre de consommation.
  const liaisons = () => ([{
    id: 'L1',
    cables: [
      { code: '1x50', qty: 1, fonction: 'PE' },
      { code: '1x185', qty: 3, fonction: 'auto' },
    ],
  }]);

  test('une file par signature de câble, indexée sur liaisonId|code|fonction', () => {
    const queues = buildPhaseQueues(liaisons());
    expect(queues['L1|1x50|PE']).toEqual(['PE']);
    expect(queues['L1|1x185|auto']).toEqual(['L1', 'L2', 'L3']);
  });

  test('reste correct même consommé dans un ordre différent de la saisie (simulation split par aire)', () => {
    const queues = buildPhaseQueues(liaisons());
    const cursors = {};
    const consume = (sig) => {
      const q = queues[sig];
      if (!q) return null;
      const k = cursors[sig] || 0;
      cursors[sig] = k + 1;
      return q[k];
    };
    // cable-assign.js rencontrerait ici les 3 grosses unités 1x185 avant la
    // petite 1x50/PE (tri par aire décroissante) : la signature garantit que
    // chaque câble reçoit quand même la bonne phase.
    expect(consume('L1|1x185|auto')).toBe('L1');
    expect(consume('L1|1x185|auto')).toBe('L2');
    expect(consume('L1|1x185|auto')).toBe('L3');
    expect(consume('L1|1x50|PE')).toBe('PE');
  });

  test('non-placement partiel : une unité manquante ne décale pas les autres signatures', () => {
    // Simule que la 2e unité de 1x185 a fini dans nonPlaces et n'est jamais
    // consommée : les autres signatures ne sont pas affectées.
    const queues = buildPhaseQueues(liaisons());
    expect(queues['L1|1x50|PE'][0]).toBe('PE');
    expect(queues['L1|1x185|auto'][0]).toBe('L1');
    expect(queues['L1|1x185|auto'][2]).toBe('L3');
  });

  test('liste de liaisons vide → objet vide', () => {
    expect(buildPhaseQueues([])).toEqual({});
  });
});

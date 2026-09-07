// BIG BRAIN — test d'intégration : verrouille l'invariant électrique central
// de la Brique D. circuitToCables() décrit un circuit (phases/neutre/PE) ;
// buildPhaseQueues() doit affecter L1/L2/L3, N et PE SANS jamais les mélanger,
// même quand les trois fonctions partagent EXACTEMENT le même code catalogue
// (cas le plus courant : tout en 1x185). C'est justement le cas où une
// régression serait invisible si buildPhaseQueues indexait un jour par
// `code` seul au lieu de `liaisonId|code|fonction`.
const { circuitToCables } = require('../src/renderer/circuit.js');
const { assignPhases, buildPhaseQueues } = require('../src/renderer/phase-assign.js');

// resolveOd factice : un seul code catalogue partout, comme dans le cas réel.
const resolveOd = (fam, code) => ({ '1x185': 25.5, '5x16': 25 }[code] || 0);

describe('BIG BRAIN — circuit → phases, bout en bout', () => {
  test('phases, neutre et PE en MÊME section (1x185) ne se mélangent pas', () => {
    const circuit = {
      fam: 'U1000-AR2V', nbPhases: 3, codePhase: '1x185',
      neutre: true, codeNeutre: '1x185', pe: true, codePE: '1x185', parallele: 1,
    };
    const cables = circuitToCables(circuit, resolveOd);
    const liaison = { id: 'L1', nom: 'TGBT → GE', cables };

    // Séquence globale, dans l'ordre où circuitToCables produit les câbles
    // (phase, puis neutre, puis PE) : c'est exactement ce que verrait le canvas.
    expect(assignPhases(cables)).toEqual(['L1', 'L2', 'L3', 'N', 'PE']);

    const queues = buildPhaseQueues([liaison]);
    // Trois signatures distinctes malgré le même code '1x185' : la fonction
    // fait partie de la signature (liaisonId|code|fonction).
    expect(queues['L1|1x185|phase']).toEqual(['L1', 'L2', 'L3']);
    expect(queues['L1|1x185|neutre']).toEqual(['N']);
    expect(queues['L1|1x185|PE']).toEqual(['PE']);
    expect(Object.keys(queues)).toHaveLength(3);
  });

  test('parallele=2 : phases et neutre sont dupliqués, mais PAS le PE (un seul PE)', () => {
    const circuit = {
      fam: 'U1000-AR2V', nbPhases: 3, codePhase: '1x185',
      neutre: true, codeNeutre: '1x185', pe: true, codePE: '1x185', parallele: 2,
    };
    const cables = circuitToCables(circuit, resolveOd);
    const liaison = { id: 'L1', nom: 'TGBT → GE', cables };

    expect(assignPhases(cables)).toEqual(['L1', 'L2', 'L3', 'L1', 'L2', 'L3', 'N', 'N', 'PE']);

    const queues = buildPhaseQueues([liaison]);
    expect(queues['L1|1x185|phase']).toEqual(['L1', 'L2', 'L3', 'L1', 'L2', 'L3']);
    expect(queues['L1|1x185|neutre']).toEqual(['N', 'N']);
    expect(queues['L1|1x185|PE']).toEqual(['PE']);
  });

  test('PEN en MÊME section (1x185) que les phases ne se mélange pas avec elles', () => {
    const circuit = {
      fam: 'U1000-AR2V', nbPhases: 3, codePhase: '1x185',
      pen: true, codePEN: '1x185', parallele: 1,
    };
    const cables = circuitToCables(circuit, resolveOd);
    const liaison = { id: 'L1', nom: 'TGBT → GE', cables };

    expect(assignPhases(cables)).toEqual(['L1', 'L2', 'L3', 'PEN']);

    const queues = buildPhaseQueues([liaison]);
    expect(queues['L1|1x185|phase']).toEqual(['L1', 'L2', 'L3']);
    expect(queues['L1|1x185|PEN']).toEqual(['PEN']);
    expect(Object.keys(queues)).toHaveLength(2);
  });

  test('liaison en multi : un seul câble par circuit, aucune phase attribuée', () => {
    const circuit = {
      mode: 'multi', fam: 'U1000-AR2V', codeMulti: '5x16',
      nbPhases: 3, codePhase: '1x185', neutre: true, codeNeutre: '1x185',
      pe: true, codePE: '1x185', parallele: 2,
    };
    const cables = circuitToCables(circuit, resolveOd);
    expect(cables).toHaveLength(1);
    expect(cables[0]).toMatchObject({ code: '5x16', od: 25, qty: 2, fonction: 'aucune' });

    // Un multiconducteur ne porte pas UNE phase : aucun libellé au canvas.
    expect(assignPhases(cables)).toEqual([null, null]);

    const queues = buildPhaseQueues([{ id: 'L1', nom: 'TG vers PARIF', cables }]);
    expect(queues['L1|5x16|aucune']).toEqual([null, null]);
    expect(Object.keys(queues)).toHaveLength(1);
  });
});

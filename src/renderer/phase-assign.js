'use strict';
// BIG BRAIN — affectation des phases électriques (PUR, testé). Façon cable-assign.js.
// Le canvas affiche le libellé de phase dès que le câble porte la couleur
// correspondante (COLOR_SYSTEM.PHASE_COLORS) — ce module ne décide QUE la phase.
(function (root) {
  const CYCLE = ['L1', 'L2', 'L3'];

  // Un code catalogue « 1x… » désigne un câble unipolaire (un seul conducteur).
  function isUnipolaire(code) {
    return /^1\s*x/i.test(String(code == null ? '' : code).trim());
  }

  // cables : câbles d'UNE liaison [{ code, qty, fonction }]. fonction ∈
  // 'auto' (défaut) | 'phase' | 'neutre' | 'PE' | 'PEN' | 'aucune'.
  // PEN = conducteur combiné neutre+PE (mutuellement exclusif avec neutre/PE
  // séparés en amont, dans circuit.js) — traité à part, jamais recyclé comme N ou PE.
  // Retourne une phase (ou null) par câble-unité, qty déplié. Le cycle L1→L2→L3
  // est local à l'appel (donc à la liaison) ; les null ne le consomment pas.
  function assignPhases(cables) {
    const out = [];
    let cursor = 0;
    (cables || []).forEach((c) => {
      const n = Math.max(0, Math.floor(Number(c && c.qty != null ? c.qty : 1)) || 0);
      const fonction = (c && c.fonction) || 'auto';
      for (let i = 0; i < n; i++) {
        if (fonction === 'neutre') { out.push('N'); continue; }
        if (fonction === 'PE') { out.push('PE'); continue; }
        if (fonction === 'PEN') { out.push('PEN'); continue; }
        if (fonction === 'aucune') { out.push(null); continue; }
        const estPhase = (fonction === 'phase') || (fonction === 'auto' && isUnipolaire(c.code));
        if (!estPhase) { out.push(null); continue; }
        out.push(CYCLE[cursor % CYCLE.length]);
        cursor++;
      }
    });
    return out;
  }

  // Regroupe les phases par SIGNATURE de câble (liaisonId|code|fonction) plutôt
  // que par liaison seule. Nécessaire car en aval (cable-assign.js, repli
  // « split câble par câble ») les unités d'une même liaison peuvent être
  // retriées (par aire décroissante) ou partiellement non placées : consommer
  // une file unique « dans l'ordre rencontré » désynchronise alors la phase du
  // câble. Les unités de même signature sont interchangeables (même câble),
  // donc l'ordre à l'intérieur d'une file n'a pas d'importance.
  // Retourne { [signature]: ['L1', 'L2', …] }.
  function buildPhaseQueues(liaisons) {
    const queues = {};
    (liaisons || []).forEach((l) => {
      const cables = l.cables || [];
      const phases = assignPhases(cables);
      let cursor = 0;
      cables.forEach((c) => {
        const n = Math.max(0, Math.floor(Number(c && c.qty != null ? c.qty : 1)) || 0);
        const sig = `${l.id}|${c && c.code}|${(c && c.fonction) || 'auto'}`;
        if (!queues[sig]) queues[sig] = [];
        for (let i = 0; i < n; i++) {
          queues[sig].push(phases[cursor]);
          cursor++;
        }
      });
    });
    return queues;
  }

  const api = { assignPhases, isUnipolaire, buildPhaseQueues };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhaseAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);

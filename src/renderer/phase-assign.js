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
  // 'auto' (défaut) | 'phase' | 'neutre' | 'PE' | 'aucune'.
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
        if (fonction === 'aucune') { out.push(null); continue; }
        const estPhase = (fonction === 'phase') || (fonction === 'auto' && isUnipolaire(c.code));
        if (!estPhase) { out.push(null); continue; }
        out.push(CYCLE[cursor % CYCLE.length]);
        cursor++;
      }
    });
    return out;
  }

  const api = { assignPhases, isUnipolaire };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhaseAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
// BIG BRAIN — traduction d'un CIRCUIT électrique (phases / neutre / PE) en liste
// de câbles exploitable par cable-assign.js et phase-assign.js. PUR : le
// catalogue est injecté via resolveOd(fam, code).
(function (root) {
  const num = (v, def) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : def;
  };

  // circuit : { mode: 'mono' | 'multi' (défaut 'mono'), fam, nbPhases, codePhase,
  //   neutre, codeNeutre, pe, codePE, codeMulti, parallele }
  // Retourne [{ fam, code, od, qty, fonction }] — les entrées à qty 0 sont omises.
  // En 'multi', une seule entrée (codeMulti × parallele, fonction 'aucune') :
  // nbPhases / neutre / pe sont ignorés.
  function circuitToCables(circuit, resolveOd) {
    if (!circuit || !circuit.fam) return [];
    const od = (code) => (typeof resolveOd === 'function' ? (resolveOd(circuit.fam, code) || 0) : 0);
    const par = Math.max(1, num(circuit.parallele, 1));
    const out = [];
    const push = (code, qty, fonction) => {
      if (!code || qty <= 0) return;
      out.push({ fam: circuit.fam, code, od: od(code), qty, fonction });
    };

    // Multiconducteur : UN seul câble par circuit en parallèle, tous les
    // conducteurs à l'intérieur. fonction 'aucune' ⇒ PhaseAssign renvoie null
    // ⇒ pas de customColor ⇒ aucun libellé de phase au canvas.
    if (circuit.mode === 'multi') {
      push(circuit.codeMulti, par, 'aucune');
      return out;
    }

    push(circuit.codePhase, num(circuit.nbPhases, 0) * par, 'phase');
    if (circuit.neutre) push(circuit.codeNeutre, par, 'neutre');
    if (circuit.pe) push(circuit.codePE, par, 'PE');
    return out;
  }

  const api = { circuitToCables };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Circuit = api;
})(typeof window !== 'undefined' ? window : globalThis);

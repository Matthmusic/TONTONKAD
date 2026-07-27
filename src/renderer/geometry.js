'use strict';
// Géométrie & occupation — fonctions PURES. Extraites de script.js pour être
// testables. Exposées sur window.Geom (runtime) et module.exports (Jest).
(function (root) {

  // Aire d'un disque de diamètre d.
  function areaCircle(d) { const r = d / 2; return Math.PI * r * r; }

  // Arrondi au pas (renvoie value inchangée si non finie).
  function roundToStep(value, step) {
    if (!Number.isFinite(value)) return value;
    return Math.round(value / step) * step;
  }

  // Taux d'occupation (%) : somme des aires des fourreaux (Ø ext.) + câbles LIBRES
  // (sans parent), rapportée à l'aire de la boîte. 0 si l'aire totale est nulle.
  //   { shape, wMm, hMm, dMm, fourreaux, cables }
  function computeOccupancy({ shape, wMm, hMm, dMm, fourreaux = [], cables = [] }) {
    const totalArea = (shape === 'rect' || shape === 'chemin_de_cable') ? wMm * hMm : areaCircle(dMm);
    if (totalArea <= 0) return 0;
    const occ = fourreaux.reduce((s, f) => s + areaCircle(f.od), 0);
    const occCable = cables.filter(c => !c.parent).reduce((s, c) => s + areaCircle(c.od), 0);
    return ((occ + occCable) / totalArea) * 100;
  }

  const api = { areaCircle, roundToStep, computeOccupancy };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Geom = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

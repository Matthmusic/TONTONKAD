'use strict';
(function (root) {
  const MRP = (typeof module !== 'undefined' && module.exports)
    ? require('maxrects-packer')
    : root.MaxRectsPacker;
  const MaxRectsPacker = MRP.MaxRectsPacker;
  const PACKING_LOGIC  = MRP.PACKING_LOGIC;

  const GEO  = { gap: 30, margin: 40 };
  const EDGE = 1e6; // borne "infinie" pour l'axe libre
  const OPTS = { smart: true, pot: false, square: false, allowRotation: false, border: 0, logic: PACKING_LOGIC.MAX_EDGE };

  const cell = (d) => d + GEO.gap;

  // Stubs (implémentés dans les tâches suivantes)
  function solve(tubes, opts) { throw new Error('not implemented'); }
  function variants(tubes, opts) { throw new Error('not implemented'); }

  const api = { GEO, cell, solve, variants };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants;
  }
})(typeof window !== 'undefined' ? window : globalThis);

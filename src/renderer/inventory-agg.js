'use strict';
// Agrégation d'inventaire — fonction PURE. Extraite de script.js pour être
// testable. Exposée sur window.InventoryAgg (runtime) et module.exports (Jest).
(function (root) {

  // Compte les fourreaux par clé `type|code` et les câbles par clé `fam|code`.
  function countGroups(fourreaux = [], cables = []) {
    const fc = {}, cc = {};
    for (const f of fourreaux) { const k = `${f.type}|${f.code}`; fc[k] = (fc[k] || 0) + 1; }
    for (const c of cables) { const k = `${c.fam}|${c.code}`; cc[k] = (cc[k] || 0) + 1; }
    return { fc, cc };
  }

  const api = { countGroups };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.InventoryAgg = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

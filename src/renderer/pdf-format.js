'use strict';
// Formatage des libellés / textes pour l'export PDF — fonctions PURES (objets et
// valeurs passés en paramètre, aucune globale). Extraites de script.js pour être
// testables. Exposées sur window.PdfFormat (runtime) et module.exports (Jest).
(function (root) {

  // Libellé d'un objet (fourreau/câble) : label explicite > customLabel > fallback.
  function getObjectLabel(obj, fallback) {
    const label = typeof obj?.label === 'string' ? obj.label.trim() : '';
    if (label) return label;

    const customLabel = typeof obj?.customLabel === 'string' ? obj.customLabel.trim() : '';
    if (customLabel) return customLabel;

    return fallback;
  }

  // Nom d'un fourreau (défaut « F{numéro} »).
  function getFourreauName(fourreau, numero) {
    return getObjectLabel(fourreau, `F${numero}`);
  }

  // Nom d'un câble (défaut « L{index+1} »).
  function getCableName(cable, index) {
    return getObjectLabel(cable, `L${index + 1}`);
  }

  // Tronque à maxChars en ajoutant « ... » (les points comptent dans la limite).
  function truncate(text, maxChars) {
    const value = String(text ?? '');
    return value.length > maxChars ? value.substring(0, Math.max(0, maxChars - 3)) + '...' : value;
  }

  const api = { getObjectLabel, getFourreauName, getCableName, truncate };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PdfFormat = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

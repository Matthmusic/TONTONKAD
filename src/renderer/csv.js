'use strict';
// Parsing CSV — fonction PURE (texte → tableau d'objets). Extraite de script.js
// pour être testable isolément. Exposée sur window.CSVUtil (runtime) et
// module.exports (Jest), à la manière de packer.js / compat-chambres.js.
(function (root) {

  // Colonnes converties en nombre (les autres restent des chaînes).
  const NUMERIC_HEADERS = ['od', 'id', 'largeur', 'hauteur'];

  // text  : contenu CSV brut (1re ligne = en-tête)
  // delimiter : séparateur de colonnes (';' par défaut, ',' possible)
  // Retourne [] s'il n'y a pas au moins un en-tête + une ligne de données.
  function parseCSV(text, delimiter = ';') {
    const lines = String(text == null ? '' : text).replace(/\r/g, '').trim().split('\n');
    if (lines.length < 2) return [];
    const header = lines[0].split(delimiter).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(delimiter);
      const obj = {};
      header.forEach((key, i) => {
        const value = (values[i] || '').trim();
        if (NUMERIC_HEADERS.includes(key)) {
          obj[key] = parseFloat(value.replace(',', '.')) || 0;
        } else {
          obj[key] = value;
        }
      });
      return obj;
    });
  }

  const api = { parseCSV, NUMERIC_HEADERS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CSVUtil = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

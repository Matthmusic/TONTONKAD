'use strict';
// Catalogues métier (fourreaux, câbles) — les MÊMES fichiers que l'application
// (data/*.csv), lus avec le même parseur (src/renderer/csv.js).
const fs = require('fs');
const path = require('path');
const CSVUtil = require('../../src/renderer/csv.js');

// Dossier des catalogues : variable TONTONKAD_DATA, sinon data/ du dépôt
// (mcp/src → ../../data), sinon data/ de l'installation (resources/mcp → ../data).
const DEFAULT_DATA_DIR = [path.join(__dirname, '..', '..', 'data'), path.join(__dirname, '..', 'data')]
  .find((d) => fs.existsSync(path.join(d, 'fourreaux.csv'))) || path.join(__dirname, '..', '..', 'data');

function loadCatalogues(dataDir = process.env.TONTONKAD_DATA || DEFAULT_DATA_DIR) {
  const read = (name) => fs.readFileSync(path.join(dataDir, name), 'utf8');
  const fourreaux = CSVUtil.parseCSV(read('fourreaux.csv'));
  const cables = CSVUtil.parseCSV(read('cables.csv'));
  // Chambres de tirage : cotes INTÉRIEURES par face (Stradal), séparateur virgule.
  let chambres = [];
  try { chambres = CSVUtil.parseCSV(read('chambres_de_tirage.csv'), ','); } catch (_) { chambres = []; }
  if (!fourreaux.length || !cables.length) {
    throw new Error(`Catalogues vides ou illisibles dans ${dataDir}`);
  }
  return {
    fourreaux,
    cables,
    chambres,
    resolveOd(fam, code) {
      const spec = cables.find((c) => c.fam === fam && c.code === code);
      return spec ? spec.od : undefined;
    },
  };
}

module.exports = { loadCatalogues, DEFAULT_DATA_DIR };

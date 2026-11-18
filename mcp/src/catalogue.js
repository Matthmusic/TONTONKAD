'use strict';
// Catalogues métier (fourreaux, câbles) — les MÊMES fichiers que l'application
// (data/*.csv), lus avec le même parseur (src/renderer/csv.js).
const fs = require('fs');
const path = require('path');
const CSVUtil = require('../../src/renderer/csv.js');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data');

function loadCatalogues(dataDir = process.env.TONTONKAD_DATA || DEFAULT_DATA_DIR) {
  const read = (name) => fs.readFileSync(path.join(dataDir, name), 'utf8');
  const fourreaux = CSVUtil.parseCSV(read('fourreaux.csv'));
  const cables = CSVUtil.parseCSV(read('cables.csv'));
  if (!fourreaux.length || !cables.length) {
    throw new Error(`Catalogues vides ou illisibles dans ${dataDir}`);
  }
  return {
    fourreaux,
    cables,
    resolveOd(fam, code) {
      const spec = cables.find((c) => c.fam === fam && c.code === code);
      return spec ? spec.od : undefined;
    },
  };
}

module.exports = { loadCatalogues, DEFAULT_DATA_DIR };

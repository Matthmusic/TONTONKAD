'use strict';
// Génère une note de calcul Caneco d'essai (même format que l'export Caneco :
// pas d'en-tête, colonnes A-F = origine, nom, longueur m, code, code élémentaire, famille).
const path = require('path');
const XLSX = require('xlsx');

const ROWS = [
  ['TGBT', 'COFFRET 1', 85, '4x95', '', 'U1000R2V (90°C)'],
  ['TGBT', 'COFFRET 1 ECLAIRAGE', 85, '5x10', '', 'U1000R2V (90°C)'],
  ['TGBT', 'COFFRET 1 PRISES', 85, '5x16', '', 'U1000R2V (90°C)'],
  ['TGBT', 'COFFRET 2', 120, '4x35', '', 'U1000R2V (90°C)'],
  ['COFFRET 1', 'PIT 1', 40, '3x6', '', 'U1000R2V (90°C)'],
  ['COFFRET 1', 'PIT 1 COMMANDE', 40, '3x2,5', '', 'U1000R2V (90°C)'],
  ['COFFRET 1', 'RESERVE', 0, '', '', ''],
];

function makeNote(file) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ROWS), 'Câbles');
  XLSX.writeFile(wb, file);
  return file;
}

if (require.main === module) {
  console.log(makeNote(process.argv[2] || path.join(__dirname, 'note-essai.xlsx')));
}
module.exports = { makeNote, ROWS };

'use strict';
// Lecture d'une note de calcul Caneco (.xls/.xlsx, carnet de câbles sans
// en-tête, colonnes A-F) avec le MÊME parseur que l'import Caneco de BIG BRAIN
// (src/renderer/caneco-import.js). On garde en plus l'origine (colonne A),
// ignorée par l'application mais indispensable pour retrouver « TGBT → COFFRET 1 ».
const XLSX = require('xlsx');
const CanecoImport = require('../../src/renderer/caneco-import.js');

function readRows(file) {
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // Mêmes options que big-brain-panel.js (header:1, defval:'', raw:false).
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
}

// rows → liste de liaisons { ref, origine, nom, longueurM, codeBrut, famille,
// selectable, avertissement, liaison (brouillon BIG BRAIN avec circuit) }
function parseRows(rows, catalogueCables) {
  const drafts = CanecoImport.parseWorkbook(rows, catalogueCables);
  return drafts
    .map((d) => {
      const row = rows[d.rowIndex] || [];
      const origine = String(row[0] || '').trim();
      return {
        ref: `L${d.rowIndex + 1}`, // n° de ligne du classeur, stable
        ligne: d.rowIndex + 1,
        origine,
        nom: d.nom,
        longueurM: Number(String(row[2] || '').replace(',', '.')) || 0,
        codeBrut: String(row[3] || '').trim(),
        famille: String(row[5] || '').trim(),
        selectable: d.selectable,
        avertissement: d.warning,
        liaison: d.liaison,
      };
    })
    // lignes entièrement vides du classeur : sans intérêt
    .filter((l) => l.origine || l.nom !== '(sans nom)' || l.codeBrut);
}

function readNote(file, catalogueCables) {
  return parseRows(readRows(file), catalogueCables);
}

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// Cherche les liaisons d'un tronçon. Critères (tous optionnels, combinés en ET) :
// origine, destination (= nom Caneco), texte libre ; ou refs explicites.
function findLiaisons(liaisons, { refs, origine, destination, texte } = {}) {
  if (Array.isArray(refs) && refs.length) {
    const set = new Set(refs.map((r) => String(r).toUpperCase()));
    return liaisons.filter((l) => set.has(l.ref.toUpperCase()));
  }
  // Correspondance par MOTS ENTIERS : « COFFRET 1 » trouve « COFFRET 1 » et
  // « COFFRET 1 ECLAIRAGE », jamais « COFFRET 10 ».
  const words = (s) => ` ${s} `;
  const has = (hay, needle) => words(hay).includes(words(needle));
  const o = norm(origine), d = norm(destination), t = norm(texte);
  return liaisons.filter((l) => {
    const lo = norm(l.origine), ln = norm(l.nom);
    if (o && lo !== o) return false; // origine = un tableau précis : égalité stricte
    if (d && !has(ln, d)) return false;
    if (t && !has(`${lo} ${ln}`, t)) return false;
    return true;
  });
}

module.exports = { readNote, readRows, parseRows, findLiaisons, norm };

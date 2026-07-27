// tests/csv.test.js
const { parseCSV } = require('../src/renderer/csv.js');

describe('parseCSV', () => {
  test('parse basique avec séparateur ; (défaut)', () => {
    const rows = parseCSV('nom;code\nTPC 200;t200\nTPC 125;t125');
    expect(rows).toEqual([
      { nom: 'TPC 200', code: 't200' },
      { nom: 'TPC 125', code: 't125' },
    ]);
  });

  test('convertit les colonnes numériques (od/id/largeur/hauteur), virgule décimale', () => {
    const rows = parseCSV('code;od;id\nA;63,5;50');
    expect(rows[0]).toEqual({ code: 'A', od: 63.5, id: 50 });
    expect(typeof rows[0].od).toBe('number');
  });

  test('numérique invalide → 0', () => {
    expect(parseCSV('code;od\nA;abc')[0]).toEqual({ code: 'A', od: 0 });
  });

  test('séparateur personnalisé (,)', () => {
    const rows = parseCSV('nom,largeur,hauteur\nL1T,520,540', ',');
    expect(rows[0]).toEqual({ nom: 'L1T', largeur: 520, hauteur: 540 });
  });

  test('trim des en-têtes et valeurs, gestion des \\r', () => {
    const rows = parseCSV(' nom ; code \r\n TPC 200 ; t200 \r\n', ';');
    expect(rows).toEqual([{ nom: 'TPC 200', code: 't200' }]);
  });

  test('valeur manquante → "" (texte) ou 0 (numérique)', () => {
    const rows = parseCSV('nom;code;od\nX', ';');
    expect(rows[0]).toEqual({ nom: 'X', code: '', od: 0 });
  });

  test('moins de 2 lignes → []', () => {
    expect(parseCSV('nom;code')).toEqual([]);
    expect(parseCSV('')).toEqual([]);
  });

  test('entrée nulle/indéfinie → [] (robustesse)', () => {
    expect(parseCSV(null)).toEqual([]);
    expect(parseCSV(undefined)).toEqual([]);
  });
});

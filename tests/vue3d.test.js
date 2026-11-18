// Vue 3D partagée (application + MCP) : opérateurs PDF bruts, sans DOM.
const V = require('../src/renderer/vue3d.js');
const { chambrePourNappe } = require('../src/renderer/chambres-infos.js');
const CompatChambres = require('../src/renderer/compat-chambres.js');
const { parseCSV } = require('../src/renderer/csv.js');
const fs = require('fs');
const path = require('path');

const rows = parseCSV(fs.readFileSync(path.join(__dirname, '..', 'data', 'chambres_de_tirage.csv'), 'utf8'), ',');
const m = {
  nom: 'Essai', ok: true, forme: 'rect', largeur: 425, hauteur: 270, tranchee: null,
  reglages: { ecart: 30, litDePose: 40 },
  fourreaux: [{ id: 'F1', type: 'TPC', code: '160', od: 160, di: 120, x: 135, y: 135, libelle: '' }],
  cables: [],
  chambre: chambrePourNappe(425, 270, rows, CompatChambres),
};

describe('vue3d — pour jsPDF (application)', () => {
  test('emitText:false → aucun texte dans le flux, textes rendus via labels', () => {
    const p = new V.Page({ emitText: false, ombre: false });
    V.drawCoupe(p, m, 36, 200, 300, 300);
    V.draw3D(p, m, 440, 200, 360, 300, 1500);
    const ops = p.ops.join('\n');
    expect(ops).not.toMatch(/\bBT\b|\/F1|\/F2/);
    expect(p.labels.some((l) => /L = 425 mm/.test(l.text))).toBe(true);
  });
  test('ombre:false → pas d\'état graphique /GS1 (inconnu de jsPDF)', () => {
    const p = new V.Page({ emitText: false, ombre: false });
    V.drawChambre3D(p, m, 50, 120, 520, 380);
    expect(p.ops.join('\n')).not.toMatch(/GS1/);
    expect(p.ops.length).toBeGreaterThan(50);
  });
  test('chambre choisie comme dans l\'application', () => {
    expect(m.chambre.entree).toBe('pignon');
    expect(m.chambre.tient).toBe(true);
  });
});

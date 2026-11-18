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

describe('chambre à plusieurs faces : choix et traversées', () => {
  const { etudierChambre } = require('../src/renderer/chambre-faces.js');
  const mq = (nom, largeur, hauteur, liaisons, od = 110) => ({ nom, largeur, hauteur, liaisons,
    fourreaux: [{ id: 'F1', od, x: largeur / 2, y: hauteur / 2, liaisons }] });
  const faces = {
    pignonA: mq('Arrivée', 270, 270, ['A', 'B', 'C'], 160),
    pignonB: mq('Vers 1', 235, 235, ['A', 'B'], 125),
    longPanB: mq('Vers 2', 185, 185, ['C'], 75),
  };

  test('plus petite chambre recevant toutes les faces ; traversées droite et en angle', () => {
    const e = etudierChambre(faces, rows, CompatChambres);
    expect(e.ok).toBe(true);
    expect(Object.values(e.faces).every((f) => f.tient)).toBe(true);
    const t = Object.fromEntries(e.traversees.map((x) => [x.liaison, x]));
    expect(t.A.type).toBe('droite');
    expect(t.C.type).toBe('angle');
    expect(t.C.changementFourreau).toBe('Ø160 → Ø75');
    expect(e.arrets).toHaveLength(0);
  });

  test('liaison sur une seule face → elle s\'arrête dans la chambre', () => {
    const e = etudierChambre({ pignonA: mq('Arrivée', 270, 270, ['A', 'Z']), pignonB: mq('Vers 1', 235, 235, ['A']) }, rows, CompatChambres);
    expect(e.arrets.map((a) => a.liaison)).toEqual(['Z']);
  });

  test('chambre imposée trop petite pour une face → signalé ; masque trop grand partout → maçonnée', () => {
    const e = etudierChambre({ longPanA: mq('Large', 900, 300, ['A']) }, rows, CompatChambres, { ref: 'L1T' });
    expect(e.faces.longPanA.tient).toBe(false);
    expect(e.avertissements.join(' ')).toMatch(/ne tient pas/);
    const g = etudierChambre({ pignonA: mq('Géant', 3000, 3000, ['A']) }, rows, CompatChambres);
    expect(g.ok).toBe(false);
    expect(g.erreurs[0]).toMatch(/maçonnée/);
  });

  test('vue de dessus : dessinée sans texte dans le flux (jsPDF)', () => {
    const e = etudierChambre(faces, rows, CompatChambres);
    const p = new V.Page({ emitText: false, ombre: false });
    const couleurs = V.drawChambreDessus(p, e, faces, 36, 60, 500, 450);
    expect(couleurs.size).toBe(3);
    expect(p.ops.join('\n')).not.toMatch(/\bBT\b/);
    expect(p.labels.some((l) => /pignon A : Arrivée/.test(l.text))).toBe(true);
  });
});

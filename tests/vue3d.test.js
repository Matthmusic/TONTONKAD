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
    expect(p.labels.some((l) => /(CÔTÉ 4|\.4) · Arrivée/.test(l.text))).toBe(true);
  });
});

describe('coupe vue des deux côtés d\'un tronçon (symétrie)', () => {
  // position le long de la face (repère plan) d'un fourreau à x dans une coupe de largeur W
  const surFace = (face, sens, x, W = 400) => (V.coupeEnMiroir(face, sens) ? W - x : x);
  // coordonnée physique perpendiculaire au tronçon, pour comparer les deux bouts
  const physique = (face, t) => (face.startsWith('pignon') ? { y: t } : { x: t });

  test('ligne droite : pignon B (départ) → pignon A (arrivée), même côté physique', () => {
    expect(physique('pignonB', surFace('pignonB', 'depart', 60))).toEqual(physique('pignonA', surFace('pignonA', 'arrivee', 60)));
  });
  test('vue de dos : à l\'arrivée la coupe est l\'image miroir du départ sur une même orientation', () => {
    expect(V.coupeEnMiroir('pignonA', 'arrivee')).toBe(!V.coupeEnMiroir('pignonA', 'depart'));
  });
  test('angle : vers l\'est puis vers le nord, le fourreau de gauche reste à gauche', () => {
    // départ pignon B (vers l'est) : x petit = gauche = nord (y grand)
    expect(surFace('pignonB', 'depart', 60)).toBe(340);
    // arrivée long-pan A en montant (vers le nord) : x petit = gauche = ouest (x petit)
    expect(surFace('longPanA', 'arrivee', 60)).toBe(60);
  });
  test('sans sens connu (MCP) : coupe posée telle quelle', () => {
    expect(V.coupeEnMiroir('pignonB', undefined)).toBe(false);
  });
});

describe('couleurs de liaison stables d\'une chambre à l\'autre', () => {
  const V = require('../src/renderer/vue3d.js');
  const mq = (nom, liaisons) => ({ nom, largeur: 200, hauteur: 200, fourreaux: liaisons.map((l, i) => ({ id: `F${i}`, od: 110, x: 60 + i * 120, y: 60, liaisons: [l] })), liaisons });
  const etude = (traversees, arrets) => ({ ok: true, ref: 'X', L: 1000, l: 600, H: 600, infos: {}, faces: { pignonA: { face: 'pignon A' }, pignonB: { face: 'pignon B' } }, traversees, arrets });
  test('la même liaison garde sa couleur quand l\'ordre global est fourni', () => {
    const ordre = ['A', 'B', 'C'];
    const e1 = etude([{ liaison: 'A', cles: ['pignonA', 'pignonB'], type: 'droite' }, { liaison: 'C', cles: ['pignonA', 'pignonB'], type: 'droite' }], []);
    const e2 = etude([{ liaison: 'C', cles: ['pignonA', 'pignonB'], type: 'droite' }], []);
    e1.ordreLiaisons = ordre; e2.ordreLiaisons = ordre;
    const m1 = { pignonA: mq('T1', ['A', 'C']), pignonB: mq('T2', ['A', 'C']) }, m2 = { pignonA: mq('T2', ['C']), pignonB: mq('T3', ['C']) };
    const c1 = V.drawChambreDessus(new V.Page({ emitText: false }), e1, m1, 0, 0, 500, 400);
    const c2 = V.drawChambreDessus(new V.Page({ emitText: false }), e2, m2, 0, 0, 500, 400);
    expect(c2.get('C')).toEqual(c1.get('C'));
  });
});

describe('page chambre révisée', () => {
  test('câbles écrits par phases : 12×1x240 → 3×4×1x240, 13×1x300 → 3×4×1x300 + 1×1x300', () => {
    expect(V.sectionsParPhases(new Map([['1x240', 12], ['1x95', 1], ['PE 1x95', 1]]))).toBe('3×4×1x240 + 1×1x95 + PE 1x95');
    expect(V.sectionsParPhases(new Map([['1x300', 13]]))).toBe('3×4×1x300 + 1×1x300');
    expect(V.sectionsParPhases(new Map([['1x150', 3]]))).toBe('3×1x150');
  });
  test('cartouche : champs personnalisés et valeurs automatiques', () => {
    const c = V.remplirCartouche([{ libelle: 'Affaire', valeur: '{projet} / {chambre}', large: true }, { libelle: 'Folio', valeur: '{folio}' }], { projet: 'MA04', chambre: 'C8', folio: '1 / 2' });
    expect(c).toEqual([{ libelle: 'Affaire', valeur: 'MA04 / C8', large: true }, { libelle: 'Folio', valeur: '1 / 2', large: false }]);
    expect(V.remplirCartouche(null, {}).map((x) => x.libelle)).toContain('Folio'); // cartouche par défaut
  });
  test('tableau trop long : pages de suite avec le même cartouche et des folios', () => {
    const cables = [], fourreaux = [];
    for (let i = 0; i < 60; i++) { fourreaux.push({ id: `F${i + 1}`, x: 50 + (i % 10) * 60, y: 40 + Math.floor(i / 10) * 60, od: 50, di: 40, liaisons: [`L${i}`] }); cables.push({ fourreau: `F${i + 1}`, liaison: `L${i}`, code: '1x16', od: 10, x: 50 + (i % 10) * 60, y: 30 + Math.floor(i / 10) * 60 }); }
    const mq = { nom: 'C1 → C2', largeur: 650, hauteur: 400, fourreaux, cables };
    const e = { ok: true, nom: 'C1', ref: 'Maçonnée', L: 1300, l: 1000, H: 900, infos: { paroi: 200 } };
    const pages = V.pagesChambreA3(e, { pignonB: mq }, { projet: 'P', cartouche: { champs: [{ libelle: 'Folio', valeur: '{folio}' }] } }, () => new V.Page());
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1].toString()).toMatch(/contenu des fourreaux \\\(suite\\\)/); // parenthèses échappées dans le flux PDF
    expect(pages[pages.length - 1].toString()).toMatch(new RegExp(`\\(${pages.length} / ${pages.length}\\)`));
  });
});

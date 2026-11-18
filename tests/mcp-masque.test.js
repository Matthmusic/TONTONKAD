// Serveur MCP TONTONKAD — cœur métier (sans le protocole) : note Caneco →
// liaisons → masque → DXF. Le serveur lui-même est testé par mcp/test/smoke.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadCatalogues } = require('../mcp/src/catalogue.js');
const { readNote, findLiaisons } = require('../mcp/src/note.js');
const { buildMasque } = require('../mcp/src/masque.js');
const { masquesToDxf } = require('../mcp/src/dxf.js');
const { trancheeNormee } = require('../mcp/src/normes.js');
const { makeNote } = require('../mcp/test/fixtures/make-note.js');

const cat = loadCatalogues();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-mcp-test-'));
const liaisons = readNote(makeNote(path.join(dir, 'note.xlsx')), cat.cables);

describe('MCP — lecture de la note de calcul', () => {
  test('toutes les lignes, avec origine et destination', () => {
    expect(liaisons).toHaveLength(7);
    expect(liaisons[0]).toMatchObject({ ref: 'L1', origine: 'TGBT', nom: 'COFFRET 1', selectable: true });
    expect(liaisons[6].selectable).toBe(false); // ligne de réserve Caneco
  });

  test('recherche par mots entiers : COFFRET 1 ne trouve pas COFFRET 10, origine stricte', () => {
    const L = [
      { ref: 'a', origine: 'TGBT', nom: 'COFFRET 1' },
      { ref: 'b', origine: 'TGBT', nom: 'COFFRET 10' },
      { ref: 'c', origine: 'tgbt', nom: 'Coffret 1 éclairage' },
      { ref: 'd', origine: 'TGBT-2', nom: 'COFFRET 1' },
    ];
    expect(findLiaisons(L, { origine: 'TGBT', destination: 'coffret 1' }).map((l) => l.ref)).toEqual(['a', 'c']);
    expect(findLiaisons(L, { refs: ['B'] }).map((l) => l.ref)).toEqual(['b']);
  });
});

describe('MCP — masque', () => {
  const tronçon = findLiaisons(liaisons, { origine: 'TGBT', destination: 'COFFRET 1' });
  const m = buildMasque({ nom: 'TGBT → COFFRET 1', liaisons: tronçon, reserves: [{ type: 'TPC', code: '160', qty: 1 }] }, cat);

  test('fourreaux et câbles produits, tous les câbles dans leur fourreau', () => {
    expect(m.ok).toBe(true);
    expect(m.liaisons).toHaveLength(4); // 3 circuits + 1 réserve
    expect(m.cables).toHaveLength(3);
    for (const c of m.cables) {
      const f = m.fourreaux.find((x) => x.id === c.fourreau);
      expect(Math.hypot(c.x - f.x, c.y - f.y) + c.od / 2).toBeLessThanOrEqual(f.di / 2 + 0.05);
    }
  });

  test('fourreaux dans la tranchée, sans chevauchement, lit de pose respecté', () => {
    for (const f of m.fourreaux) {
      expect(f.x - f.od / 2).toBeGreaterThanOrEqual(40 - 1e-6);
      expect(f.y - f.od / 2).toBeGreaterThanOrEqual(40 - 1e-6);
      expect(f.x + f.od / 2).toBeLessThanOrEqual(m.largeur - 40 + 1e-6);
    }
    for (let i = 0; i < m.fourreaux.length; i++) for (let j = i + 1; j < m.fourreaux.length; j++) {
      const a = m.fourreaux[i], b = m.fourreaux[j];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.od + b.od) / 2 + 30 - 1e-6);
    }
  });

  test('tranchée normée : recouvrement de la zone et grillage avertisseur', () => {
    const haut = Math.max(...m.fourreaux.map((f) => f.y + f.od / 2));
    expect(m.tranchee.profondeur - haut).toBeGreaterThanOrEqual(600); // trottoir par défaut
    expect(m.tranchee.grillage.y - haut).toBe(200);
    expect(m.tranchee.grillage.couleur).toBe('rouge');
    expect(m.tranchee.conformite.every((c) => c.ok && c.aValider)).toBe(true);
  });

  test('sous chaussée le recouvrement minimal passe à 800 mm', () => {
    const c = buildMasque({ nom: 'x', liaisons: tronçon, options: { zone: 'chaussee' } }, cat);
    const haut = Math.max(...c.fourreaux.map((f) => f.y + f.od / 2));
    expect(c.tranchee.profondeur - haut).toBeGreaterThanOrEqual(800);
  });

  test('profondeur imposée trop faible : signalée non conforme', () => {
    const c = buildMasque({ nom: 'x', liaisons: tronçon, options: { profondeurFouilleMm: 500 } }, cat);
    expect(c.tranchee.conformite.some((r) => !r.ok)).toBe(true);
    expect(c.avertissements.some((a) => a.startsWith('Non conforme'))).toBe(true);
  });

  test('aucune liaison utilisable → erreur explicite, pas de masque vide', () => {
    const c = buildMasque({ nom: 'vide', liaisons: [liaisons[6]] }, cat);
    expect(c.ok).toBe(false);
    expect(c.erreurs.join(' ')).toMatch(/Aucune liaison/);
  });

  test('conduit circulaire : pas de tranchée, fourreaux dans le cercle', () => {
    const c = buildMasque({ nom: 'conduit', liaisons: tronçon, options: { forme: 'circ', litDePose: 0 } }, cat);
    expect(c.tranchee).toBeNull();
    for (const f of c.fourreaux) {
      expect(Math.hypot(f.x - c.largeur / 2, f.y - c.largeur / 2) + f.od / 2).toBeLessThanOrEqual(c.largeur / 2 + 1e-3);
    }
  });

  test('DXF R12 : calques de l\'application, une entité CIRCLE par fourreau (×2) et par câble', () => {
    const dxf = masquesToDxf([m]);
    expect(dxf).toMatch(/\$ACADVER\n1\nAC1009/);
    expect(dxf).toMatch(/_CEAI_FOURREAU_TPC_160/);
    expect(dxf).toMatch(/_CEAI_GRILLAGE_ROUGE/);
    expect((dxf.match(/\nCIRCLE\n/g) || []).length).toBe(m.fourreaux.length * 2 + m.cables.length);
    expect(dxf.trim().endsWith('EOF')).toBe(true);
  });
});

describe('MCP — normes', () => {
  test('zone inconnue refusée', () => {
    expect(() => trancheeNormee({ largeur: 400, hauteur: 300, hautNappe: 250 }, { zone: 'lune' })).toThrow(/Zone inconnue/);
  });
});

describe('MCP — préparation d\'étude (questions à poser dans le chat)', () => {
  const { preparerEtude } = require('../mcp/src/etude.js');
  const note = path.join(dir, 'note.xlsx');

  test('rien de fourni : NDC, tronçons et rendu obligatoires ; plan et zone en option', () => {
    const r = preparerEtude({}, cat);
    expect(r.pret).toBe(false);
    expect(r.manquant.filter((m) => m.obligatoire).map((m) => m.champ)).toEqual(['notesCalcul', 'troncons', 'rendus']);
    expect(r.manquant.filter((m) => !m.obligatoire).map((m) => m.champ)).toEqual(['plans', 'zone']);
  });

  test('fichier absent ou mauvais format signalé', () => {
    const r = preparerEtude({ notesCalcul: [path.join(dir, 'absente.xlsx'), path.join(dir, 'note.txt')] }, cat);
    expect(r.manquant.filter((m) => m.champ === 'notesCalcul')).toHaveLength(2);
  });

  test('tronçon introuvable dans la note → question ; tronçon trouvé → références', () => {
    const r = preparerEtude({ notesCalcul: [note], rendus: ['autocad'], troncons: [
      { nom: 'ok', origine: 'TGBT', destination: 'COFFRET 1' }, { nom: 'ko', origine: 'TGBT', destination: 'PIT 9' }] }, cat);
    expect(r.fourni.troncons[0].refs).toEqual(['L1', 'L2', 'L3']);
    expect(r.manquant.some((m) => m.champ === 'troncons' && m.question.includes('ko'))).toBe(true);
    expect(r.pret).toBe(false);
  });

  test('MultiCAD ou Revit : le plan devient obligatoire ; seul Revit est signalé indisponible', () => {
    const r = preparerEtude({ notesCalcul: [note], rendus: ['MultiCAD', 'revit', 'pdf'], troncons: [{ origine: 'TGBT', destination: 'COFFRET 1' }] }, cat);
    expect(r.manquant.some((m) => m.champ === 'plans' && m.obligatoire)).toBe(true);
    expect(r.aSignaler).toHaveLength(1);
    expect(r.aSignaler[0]).toMatch(/^Revit/);
  });

  test('tout fourni → prêt', () => {
    const r = preparerEtude({ notesCalcul: [note], rendus: ['zwcad'], surPlan: false, zone: 'chaussee',
      troncons: [{ origine: 'COFFRET 1', destination: 'PIT 1' }] }, cat);
    expect(r.pret).toBe(true);
    expect(r.manquant).toHaveLength(0);
  });
});

describe('MCP — planche PDF avec vue 3D', () => {
  const { masquesToPdf } = require('../mcp/src/pdf.js');
  const tr = findLiaisons(liaisons, { origine: 'TGBT', destination: 'COFFRET 1' });
  const m1 = buildMasque({ nom: 'TGBT → COFFRET 1', liaisons: tr }, cat);
  const m2 = buildMasque({ nom: 'conduit', liaisons: tr, options: { forme: 'circ', litDePose: 0 } }, cat);

  test('une page A4 paysage par masque, PDF bien formé', () => {
    const pdf = masquesToPdf([m1, m2]).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trim().endsWith('%%EOF')).toBe(true);
    expect(pdf).toMatch(/\/Count 3/); // 2 masques + 1 page chambre (le conduit n en a pas)
    expect((pdf.match(/\/MediaBox \[0 0 842 595\]/g) || []).length).toBe(3);
    // xref : chaque offset pointe bien sur « n 0 obj »
    const start = Number(pdf.match(/startxref\n(\d+)/)[1]);
    const offs = pdf.slice(start).split('\n').filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
    offs.forEach((o, i) => expect(pdf.slice(o, o + 12).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });

  test('texte en WinAnsi : tiret long et flèche convertis, pas de « ? »', () => {
    const pdf = masquesToPdf([m1]).toString('latin1');
    expect(pdf).toContain('(TGBT -> COFFRET 1)');
    expect(pdf).toContain('\x97'); // tiret long
  });

  test('aucun masque réussi → erreur', () => {
    expect(() => masquesToPdf([{ ok: false }])).toThrow(/Aucun masque/);
  });
});

describe('MCP — chambre de tirage', () => {
  const tr = findLiaisons(liaisons, { origine: 'TGBT', destination: 'COFFRET 1' });

  test('choix automatique comme l\'application : pignon d\'abord, la nappe tient', () => {
    const m = buildMasque({ nom: 'x', liaisons: tr }, cat);
    expect(m.chambre.entree).toBe('pignon');
    expect(m.chambre.tient).toBe(true);
    expect(m.chambre.face.largeur).toBeGreaterThanOrEqual(m.largeur);
    expect(m.chambre.face.hauteur).toBeGreaterThanOrEqual(m.hauteur);
  });

  test('chambre imposée ; référence inconnue signalée', () => {
    expect(buildMasque({ nom: 'x', liaisons: tr, options: { chambre: 'L2T' } }, cat).chambre.ref).toBe('L2T');
    const k = buildMasque({ nom: 'x', liaisons: tr, options: { chambre: 'ZZZ' } }, cat);
    expect(k.chambre).toBeNull();
    expect(k.avertissements.join(' ')).toMatch(/ZZZ.*inconnue/);
  });

  test('le PDF ajoute une page chambre par masque', () => {
    const { masquesToPdf } = require('../mcp/src/pdf.js');
    const m = buildMasque({ nom: 'x', liaisons: tr }, cat);
    expect(masquesToPdf([m]).toString('latin1')).toMatch(/\/Count 2/);
    expect(masquesToPdf([m], { chambre: false }).toString('latin1')).toMatch(/\/Count 1/);
  });
});

const { dessinMasque, dessinChambre, versMultiCAD, versDxf } = require('../mcp/src/cad.js');

const masque = {
  nom: 'TGBT → C1', ok: true, forme: 'rect', largeur: 400, hauteur: 250,
  tranchee: { profondeur: 900, recouvrement: 650, zone: 'chaussee', grillage: { couleur: 'rouge', aci: 1, y: 450 } },
  fourreaux: [{ id: 'F1', type: 'TPC', code: '160', od: 160, di: 120, x: 120, y: 120, libelle: 'L1', taux: 30, liaisons: ['L1'] },
    { id: 'F2', type: 'TPC', code: '110', od: 110, di: 82, x: 290, y: 95, libelle: 'L2', liaisons: ['L2'] }],
  cables: [{ fam: 'U1000 R2V', code: '4x95', od: 42.5, x: 120, y: 90, phase: null }],
};
const etude = {
  ok: true, nom: 'C1', ref: 'L2T', L: 1160, l: 380, H: 540, infos: { paroi: 125, tampons: 2 },
  faces: { pignonA: { face: 'pignon A' }, pignonB: { face: 'pignon B' } },
  traversees: [{ liaison: 'L1', cles: ['pignonA', 'pignonB'], type: 'droite', entree: 'pignon A', sortie: 'pignon B' }],
  arrets: [{ liaison: 'L2', cle: 'pignonA', face: 'pignon A' }],
};

describe('MCP : dessins CAO (multiCAD / DXF)', () => {
  test('coupe : boîte, fourreaux, câbles et calques _CEAI_', () => {
    const d = dessinMasque(masque);
    expect(d.nom).toBe('Coupe TGBT → C1');
    expect(d.entites.filter((e) => e.t === 'circle')).toHaveLength(5); // 2 × 2 fourreaux + 1 câble
    expect(d.calques.map((c) => c.nom)).toEqual(expect.arrayContaining(['_CEAI_BOITE', '_CEAI_FOURREAU_TPC_160', '_CEAI_GRILLAGE_ROUGE']));
  });
  test('chambre : parois, fourreaux par face, traversée et arrêt', () => {
    const d = dessinChambre(etude, { pignonA: masque, pignonB: { ...masque, fourreaux: [masque.fourreaux[0]] } });
    const polys = d.entites.filter((e) => e.t === 'poly');
    expect(polys.filter((e) => e.c === '_CEAI_CHAMBRE')).toHaveLength(2); // intérieur + extérieur
    expect(polys.filter((e) => e.c === '_CEAI_TRAVERSEES')).toHaveLength(1);
    expect(d.entites.some((e) => e.t === 'circle' && e.c === '_CEAI_TRAVERSEES')).toBe(true); // arrêt de L2
    // intérieur centré sur l'origine
    const int = polys.find((e) => e.c === '_CEAI_CHAMBRE').pts;
    expect(Math.min(...int.map((p) => p[0]))).toBe(-580);
  });
  test('commandes multiCAD : format draw_entities et placement tourné', () => {
    const d = dessinChambre(etude, { pignonA: masque });
    const out = versMultiCAD([d], { 'Chambre C1': { x: 1000, y: 2000, rotation: 90 } });
    expect(out.calques.split('\n')[0]).toMatch(/^create\|_CEAI_\w+\|\w+\|25$/);
    const cmds = out.blocs[0].commandes.split('\n');
    expect(cmds[0]).toMatch(/^polyline\|[-\d.,;]+\|true\|\w+\|_CEAI_CHAMBRE$/);
    // rotation de 90° : l'intérieur 1160 × 380 devient 380 × 1160 autour de (1000, 2000)
    const pts = cmds[0].split('|')[1].split(';').map((p) => p.split(',').map(Number));
    expect(Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]))).toBeCloseTo(380, 0);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(2580, 0);
    expect(cmds.every((c) => !c.split('|').slice(1).some((x) => x === ''))).toBe(true);
  });
  test('DXF R12 : en-tête, calques et entités', () => {
    const dxf = versDxf([dessinMasque(masque), dessinChambre(etude, { pignonA: masque })]);
    expect(dxf).toMatch(/AC1009/);
    expect(dxf).toMatch(/_CEAI_CHAMBRE/);
    expect((dxf.match(/\nPOLYLINE\n/g) || []).length).toBeGreaterThan(3);
    expect(dxf.trim().endsWith('EOF')).toBe(true);
  });
});

const CI = require('../src/renderer/chambres-infos.js');
const CF = require('../src/renderer/chambre-faces.js');

describe('chambre maçonnée sur mesure (valeurs par défaut à valider)', () => {
  test('dimensions déduites des nappes, arrondies, tampons répartis', () => {
    const c = CI.chambreMaconnee({ pignonA: { largeur: 900, hauteur: 500 }, longPanB: { largeur: 1400, hauteur: 300 } });
    expect([c.L, c.l, c.H]).toEqual([1700, 1200, 750]);
    expect(c.infos.tampons).toBe(2);
    expect(c.infos.paroi).toBe(200);
    expect(c.controles).toEqual([]);
  });
  test('classe de tampon contrôlée selon la zone', () => {
    expect(CI.controleTampon('B125', 'chaussee').ok).toBe(false);
    expect(CI.controleTampon('D400', 'chaussee').ok).toBe(true);
    expect(CI.controleTampon('B125', 'trottoir').ok).toBe(true);
    const c = CI.chambreMaconnee({ pignonA: { largeur: 400, hauteur: 300 } }, { tampon: { classe: 'B125' } });
    expect(c.controles[0]).toMatch(/D400 minimum/);
  });
  test('étude multi-faces sur le modèle maçonné', () => {
    const mq = { nom: 'T1', largeur: 900, hauteur: 500, liaisons: ['X'] };
    const modele = CI.chambreMaconnee({ pignonA: mq });
    const e = CF.etudierChambre({ pignonA: mq }, [], { getChamberModels: () => [] }, { modele });
    expect(e.ok).toBe(true);
    expect(e.ref).toBe(modele.ref);
    expect(e.faces.pignonA.tient).toBe(true);
    expect(e.infos.maconnee).toBe(true);
  });
  test('nappe trop large pour le catalogue : maçonnée proposée', () => {
    const compat = require('../src/renderer/compat-chambres.js');
    const r = CI.chambrePourNappe(3000, 600, [{ nom: 'L1T Pignon', largeur: 380, hauteur: 540 }, { nom: 'L1T Long-pan', largeur: 520, hauteur: 540 }], compat);
    expect(r.aucune).toBe(true);
    expect(r.face.largeur).toBeGreaterThanOrEqual(3000);
    expect(r.ref).toMatch(/^Maçonnée/);
  });
});

describe('maçonnée : côtés fixes (nord = côté 1)', () => {
  test('les grosses nappes sur les pignons élargissent les pignons, sans échange L / l', () => {
    const CI = require('../src/renderer/chambres-infos.js');
    const c = CI.chambreMaconnee({ pignonB: { largeur: 1305, hauteur: 660 }, pignonA: { largeur: 1120, hauteur: 665 }, longPanA: { largeur: 355, hauteur: 205 } }, {});
    expect(c.l).toBeGreaterThanOrEqual(1305 + 2 * CI.MACONNEE_DEFAUTS.degagementLateral); // le pignon reçoit la nappe de 1305
    expect(c.L).toBeLessThan(c.l);
  });
});

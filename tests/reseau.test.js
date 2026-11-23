const R = require('../src/renderer/reseau.js');

describe('réseau de chambres', () => {
  test('faces choisies selon la direction, puis la plus proche libre', () => {
    const r = R.creerReseau();
    const c1 = R.ajouterNoeud(r, 'chambre', { x: 100, y: 100 });
    const c2 = R.ajouterNoeud(r, 'chambre', { x: 400, y: 100 });
    const t = R.relier(r, c1.id, c2.id, { longueurM: 45 });
    expect([t.a.face, t.b.face]).toEqual(['pignonB', 'pignonA']);
    expect(t.longueurM).toBe(45);
    const c3 = R.ajouterNoeud(r, 'chambre', { x: 420, y: 110 }); // encore à droite de C1
    const t2 = R.relier(r, c1.id, c3.id);
    expect(t2.a.face).toBe('longPanB'); // pignon B pris → face voisine
    expect(R.facesLibres(r, c1)).toEqual(['pignonA', 'longPanA']);
  });

  test('noms et couleurs par défaut, coffret et sortie à face unique', () => {
    const r = R.creerReseau();
    const c = R.ajouterNoeud(r, 'chambre');
    const cf = R.ajouterNoeud(r, 'coffret');
    const s = R.ajouterNoeud(r, 'sortie');
    expect([c.nom, cf.nom, s.nom]).toEqual(['C1', 'CF1', 'S1']);
    expect(c.couleur).not.toBe(cf.couleur);
    R.relier(r, c.id, cf.id);
    R.relier(r, c.id, s.id);
    expect(R.facesLibres(r, cf)).toEqual(['bas']); // un coffret accepte plusieurs arrivées
  });

  test('navigation : tronçon sur une face et élément suivant', () => {
    const r = R.creerReseau();
    const c1 = R.ajouterNoeud(r, 'chambre', { x: 0, y: 0 });
    const c2 = R.ajouterNoeud(r, 'chambre', { x: 300, y: 0 });
    R.relier(r, c1.id, c2.id);
    const v = R.surFace(r, c1.id, 'pignonB');
    expect(v.autre.id).toBe(c2.id);
    expect(v.faceAutre).toBe('pignonA');
    expect(R.surFace(r, c1.id, 'pignonA')).toBeNull();
    expect(R.nomTroncon(r, v.troncon)).toBe('C1 → C2');
  });

  test('face occupée refusée ; suppression d\'un nœud supprime ses tronçons', () => {
    const r = R.creerReseau();
    const a = R.ajouterNoeud(r, 'chambre'), b = R.ajouterNoeud(r, 'chambre'), c = R.ajouterNoeud(r, 'chambre');
    const t = R.relier(r, a.id, b.id, { faceA: 'pignonB', faceB: 'pignonA' });
    expect(() => R.relier(r, a.id, c.id, { faceA: 'pignonB' })).toThrow(/déjà occupé/);
    expect(() => R.changerFace(r, t.id, 'a', 'pignonB')).not.toThrow();
    R.supprimerNoeud(r, b.id);
    expect(r.troncons).toHaveLength(0);
  });

  test('coffret : la nappe doit passer dans la face du bas', () => {
    expect(R.verifierCoffret({ largeur: 400, profondeur: 250 }, 380, 240).tient).toBe(true);
    expect(R.verifierCoffret({ largeur: 400, profondeur: 250 }, 240, 380).tient).toBe(true); // tourné
    expect(R.verifierCoffret({ largeur: 400, profondeur: 250 }, 420, 240).tient).toBe(false);
    expect(R.verifierCoffret({ largeur: null }, 100, 100).connu).toBe(false);
  });

  test('reprise d\'une chambre de la version précédente', () => {
    const r = R.depuisAncienneChambre({ nom: 'Ch', ref: 'L2T', faceActive: 'pignonB',
      faces: { pignonA: { fourreaux: [1] }, pignonB: null, longPanA: null, longPanB: { fourreaux: [2] } } }, null);
    expect(r.noeuds.filter((n) => n.type === 'chambre')).toHaveLength(1);
    expect(r.troncons).toHaveLength(3); // pignon A, pignon B (actif), long-pan B
    const actif = R.troncon(r, r.actif.troncon);
    expect(actif.a.face).toBe('pignonB');
    expect(actif.coupe).toBeNull(); // la face active vit dans le plan affiché
  });
});

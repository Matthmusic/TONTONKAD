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

describe('réseau : continuité et métré', () => {
  // TGBT(coffret) → C1 → C2 → CF ; la liaison X va jusqu'au bout, Y s'arrête dans C2
  const r = R.creerReseau();
  const tg = R.ajouterNoeud(r, 'coffret', { nom: 'TGBT', x: 0, y: 0 });
  const c1 = R.ajouterNoeud(r, 'chambre', { x: 200, y: 0 });
  const c2 = R.ajouterNoeud(r, 'chambre', { x: 400, y: 0 });
  const cf = R.ajouterNoeud(r, 'coffret', { x: 600, y: 0 });
  const t1 = R.relier(r, tg.id, c1.id, { longueurM: 20 });
  const t2 = R.relier(r, c1.id, c2.id, { longueurM: 45 });
  const t3 = R.relier(r, c2.id, cf.id, { longueurM: 12 });
  const L = { [t1.id]: ['X', 'Y'], [t2.id]: ['X', 'Y'], [t3.id]: ['X'] };
  const F = { [t1.id]: [{ type: 'TPC', code: '160' }, { type: 'TPC', code: '110' }], [t2.id]: [{ type: 'TPC', code: '160' }, { type: 'TPC', code: '110' }], [t3.id]: [{ type: 'TPC', code: '110' }] };

  test('chemin, longueur totale et interruption détectée', () => {
    const c = R.continuite(r, (t) => L[t.id]);
    const x = c.liaisons.find((l) => l.nom === 'X'), y = c.liaisons.find((l) => l.nom === 'Y');
    expect(x.chemin).toEqual(['TGBT', 'C1', 'C2', 'CF2']);
    expect(x.longueurM).toBe(77);
    expect(x.problemes).toEqual([]);
    expect(y.problemes).toEqual(["s'interrompt dans C2"]);
    expect(c.problemes).toEqual(["Y s'interrompt dans C2"]);
  });

  test('métré par type de fourreau', () => {
    const m = R.metre(r, (t) => F[t.id]);
    expect(m.lignes).toEqual([{ fourreau: 'TPC 110', nombre: 3, metres: 77 }, { fourreau: 'TPC 160', nombre: 2, metres: 65 }]);
    expect(m.totalMetres).toBe(142);
    expect(m.longueurReseau).toBe(77);
  });

  test('tronçon sans longueur signalé, pas compté', () => {
    t3.longueurM = null;
    const m = R.metre(r, (t) => F[t.id]);
    expect(m.sansLongueur).toEqual(['C2 → CF2']);
    expect(R.continuite(r, (t) => L[t.id]).liaisons.find((l) => l.nom === 'X').longueurIncomplete).toBe(true);
    t3.longueurM = 12;
  });
});

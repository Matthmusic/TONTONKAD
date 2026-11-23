'use strict';
// Réseau de chambres — PUR, sans DOM. Exposé sur window.Reseau et module.exports.
//
// Un projet décrit un réseau :
//   noeuds   : chambres, coffrets/tableaux, sorties (nom, couleur, position)
//   troncons : liaison entre deux nœuds, par une face de chacun, avec une
//              longueur (m) et UNE coupe (les fourreaux), la même aux deux bouts.
// Faces : chambre → pignonA (gauche), pignonB (droite), longPanA (bas),
//         longPanB (haut) ; coffret → 'bas' (une seule entrée, plusieurs tronçons
//         possibles) ; sortie → 'sortie'.
(function (root) {
  const FACES_CHAMBRE = ['pignonA', 'pignonB', 'longPanA', 'longPanB'];
  const COULEURS = ['#e8661c', '#2459c9', '#16857a', '#b0302a', '#6b4fd0', '#c78a00', '#3f8f3a', '#5d6a70'];
  const TYPES = { chambre: 'Chambre', coffret: 'Coffret / tableau', sortie: 'Sortie' };
  const LIBELLE_FACE = { pignonA: 'pignon A', pignonB: 'pignon B', longPanA: 'long-pan A', longPanB: 'long-pan B', bas: 'face du bas', sortie: 'sortie' };

  function creerReseau() { return { noeuds: [], troncons: [], seq: 1, actif: { vue: 'coupe', noeud: null, troncon: null } }; }

  const noeud = (r, id) => r.noeuds.find((n) => n.id === id) || null;
  const troncon = (r, id) => r.troncons.find((t) => t.id === id) || null;

  function prefixe(type) { return type === 'chambre' ? 'C' : type === 'coffret' ? 'CF' : 'S'; }

  function ajouterNoeud(r, type, opts = {}) {
    if (!TYPES[type]) throw new Error(`Type de nœud inconnu : ${type}`);
    const n = r.noeuds.filter((x) => x.type === type).length + 1;
    const nd = {
      id: `n${r.seq++}`, type,
      nom: opts.nom || `${prefixe(type)}${n}`,
      couleur: opts.couleur || COULEURS[(r.noeuds.length) % COULEURS.length],
      x: Number.isFinite(opts.x) ? opts.x : 120 + (r.noeuds.length % 5) * 160,
      y: Number.isFinite(opts.y) ? opts.y : 120 + Math.floor(r.noeuds.length / 5) * 140,
    };
    if (type === 'chambre') nd.ref = opts.ref || null; // null = choix automatique
    if (type === 'coffret') nd.coffret = { genre: 'coffret', largeur: null, profondeur: null, source: 'manuel', ...(opts.coffret || {}) };
    r.noeuds.push(nd);
    return nd;
  }

  // Faces disponibles d'un nœud (une face de chambre ne reçoit qu'un tronçon).
  function facesLibres(r, nd) {
    if (nd.type !== 'chambre') return [nd.type === 'coffret' ? 'bas' : 'sortie'];
    const prises = new Set(r.troncons.flatMap((t) => [t.a, t.b]).filter((e) => e.noeud === nd.id).map((e) => e.face));
    return FACES_CHAMBRE.filter((f) => !prises.has(f));
  }

  // Face « naturelle » d'une chambre vers un point (repère synoptique, y vers le bas) :
  // à droite → pignon B, à gauche → pignon A, en bas → long-pan A, en haut → long-pan B.
  function faceVers(nd, x, y) {
    const dx = x - nd.x, dy = y - nd.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'pignonB' : 'pignonA';
    return dy >= 0 ? 'longPanA' : 'longPanB';
  }
  function choisirFace(r, nd, vers) {
    const libres = facesLibres(r, nd);
    if (!libres.length) return null;
    if (nd.type !== 'chambre') return libres[0];
    const ideale = faceVers(nd, vers.x, vers.y);
    if (libres.includes(ideale)) return ideale;
    const ordre = { pignonA: ['longPanA', 'longPanB', 'pignonB'], pignonB: ['longPanB', 'longPanA', 'pignonA'],
      longPanA: ['pignonA', 'pignonB', 'longPanB'], longPanB: ['pignonB', 'pignonA', 'longPanA'] }[ideale];
    return ordre.find((f) => libres.includes(f)) || libres[0];
  }

  function relier(r, idA, idB, opts = {}) {
    const A = noeud(r, idA), B = noeud(r, idB);
    if (!A || !B) throw new Error('Nœud introuvable');
    if (A.id === B.id) throw new Error('Impossible de relier un élément à lui-même');
    const faceA = opts.faceA || choisirFace(r, A, B);
    const faceB = opts.faceB || choisirFace(r, B, A);
    if (!faceA) throw new Error(`${A.nom} n'a plus de face libre`);
    if (!faceB) throw new Error(`${B.nom} n'a plus de face libre`);
    if (!facesLibres(r, A).includes(faceA)) throw new Error(`${A.nom} : ${LIBELLE_FACE[faceA]} déjà occupé`);
    if (!facesLibres(r, B).includes(faceB)) throw new Error(`${B.nom} : ${LIBELLE_FACE[faceB]} déjà occupé`);
    const t = { id: `t${r.seq++}`, a: { noeud: A.id, face: faceA }, b: { noeud: B.id, face: faceB },
      longueurM: Number(opts.longueurM) > 0 ? Number(opts.longueurM) : null, coupe: opts.coupe || null };
    r.troncons.push(t);
    return t;
  }

  // Change la face d'un bout de tronçon (si libre).
  function changerFace(r, tId, bout, face) {
    const t = troncon(r, tId);
    const nd = noeud(r, t[bout].noeud);
    if (t[bout].face === face) return t;
    if (!facesLibres(r, nd).includes(face)) throw new Error(`${nd.nom} : ${LIBELLE_FACE[face]} déjà occupé`);
    t[bout].face = face;
    return t;
  }

  function supprimerTroncon(r, tId) { r.troncons = r.troncons.filter((t) => t.id !== tId); }
  function supprimerNoeud(r, id) {
    r.troncons = r.troncons.filter((t) => t.a.noeud !== id && t.b.noeud !== id);
    r.noeuds = r.noeuds.filter((n) => n.id !== id);
  }

  // Tronçons d'un nœud, avec la face côté nœud et l'élément à l'autre bout.
  function tronconsDe(r, id) {
    return r.troncons.filter((t) => t.a.noeud === id || t.b.noeud === id).map((t) => {
      const ici = t.a.noeud === id ? t.a : t.b, la = t.a.noeud === id ? t.b : t.a;
      return { troncon: t, face: ici.face, autre: noeud(r, la.noeud), faceAutre: la.face };
    });
  }
  // Tronçon arrivant sur une face donnée d'une chambre.
  function surFace(r, id, face) { return tronconsDe(r, id).find((x) => x.face === face) || null; }

  // Contrôle d'un coffret : la nappe (largeur × hauteur de la coupe) doit
  // passer dans la face du bas (largeur × profondeur), dans un sens ou l'autre.
  function verifierCoffret(cf, largeurNappe, hauteurNappe) {
    if (!cf || !(cf.largeur > 0) || !(cf.profondeur > 0)) return { connu: false, tient: null };
    const tient = (largeurNappe <= cf.largeur && hauteurNappe <= cf.profondeur) || (largeurNappe <= cf.profondeur && hauteurNappe <= cf.largeur);
    return { connu: true, tient, marge: { largeur: cf.largeur - largeurNappe, profondeur: cf.profondeur - hauteurNappe } };
  }

  // Reprise d'une « chambre » de la version précédente (faces → coupes) :
  // une chambre C1, et pour chaque face renseignée un tronçon vers une sortie.
  function depuisAncienneChambre(c, etatFaceActive) {
    const r = creerReseau();
    if (!c || !c.faces) return null;
    const ch = ajouterNoeud(r, 'chambre', { nom: c.nom || 'C1', ref: c.ref || null, x: 400, y: 260 });
    const pos = { pignonA: [140, 260], pignonB: [660, 260], longPanA: [400, 440], longPanB: [400, 80] };
    let actif = null;
    for (const f of FACES_CHAMBRE) {
      const etat = f === c.faceActive ? (etatFaceActive || null) : c.faces[f];
      if (!etat && f !== c.faceActive) continue;
      const s = ajouterNoeud(r, 'sortie', { nom: `Sortie ${LIBELLE_FACE[f]}`, x: pos[f][0], y: pos[f][1] });
      const t = relier(r, ch.id, s.id, { faceA: f, faceB: 'sortie', coupe: f === c.faceActive ? null : etat });
      if (f === c.faceActive) actif = t.id;
    }
    r.actif = { vue: 'coupe', noeud: ch.id, troncon: actif };
    return r;
  }

  // Libellé court d'un tronçon : « C1 → C2 ».
  function nomTroncon(r, t) {
    const A = noeud(r, t.a.noeud), B = noeud(r, t.b.noeud);
    return `${A ? A.nom : '?'} → ${B ? B.nom : '?'}`;
  }

  const api = {
    FACES_CHAMBRE, COULEURS, TYPES, LIBELLE_FACE,
    creerReseau, ajouterNoeud, relier, changerFace, supprimerNoeud, supprimerTroncon,
    noeud, troncon, tronconsDe, surFace, facesLibres, faceVers, verifierCoffret,
    depuisAncienneChambre, nomTroncon,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reseau = api;
})(typeof window !== 'undefined' ? window : globalThis);

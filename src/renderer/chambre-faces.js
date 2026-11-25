'use strict';
// Étude d'une chambre de tirage à plusieurs faces — PUR, sans DOM.
// Exposé sur window.ChambreFaces et module.exports.
//
// Une chambre a 4 faces, nommées vue de dessus :
//   pignonA (gauche), pignonB (droite) : largeur = l (pignon)
//   longPanA (bas),   longPanB (haut)  : largeur = L (long-pan)
// Chaque face peut recevoir un masque (nappe de fourreaux). On choisit la
// plus petite chambre où chaque masque tient dans sa face, puis on déduit les
// TRAVERSÉES : une liaison présente sur deux faces entre par l'une et sort
// par l'autre (droite si faces opposées, en angle sinon) ; présente sur une
// seule face, elle s'arrête dans la chambre.
(function (root) {
  const FACES = ['pignonA', 'pignonB', 'longPanA', 'longPanB'];
  // Côtés numérotés vus de dessus, dans le sens horaire, 1 en haut (choix du
  // bureau d'études) : 1 = haut (ex long-pan B), 2 = droite (ex pignon B),
  // 3 = bas (ex long-pan A), 4 = gauche (ex pignon A). Masque d'un côté : « C7.1 ».
  const NUMERO = { longPanB: 1, pignonB: 2, longPanA: 3, pignonA: 4 };
  const LIBELLE = { pignonA: 'côté 4', pignonB: 'côté 2', longPanA: 'côté 3', longPanB: 'côté 1' };
  const estPignon = (k) => k.startsWith('pignon');
  const opposee = { pignonA: 'pignonB', pignonB: 'pignonA', longPanA: 'longPanB', longPanB: 'longPanA' };

  // Largeur et hauteur utiles d'une face pour un modèle {ref, L, l, H}.
  const faceDe = (m, k) => ({ largeur: estPignon(k) ? m.l : m.L, hauteur: m.H });

  /**
   * @param {object} faces  { pignonA?: masque, … } ; masque = { nom, largeur, hauteur,
   *                        fourreaux: [{ id, type, code, od, x, y, libelle }],
   *                        liaisons: [nom de liaison…] }
   * @param {Array}  chambresRows  lignes de data/chambres_de_tirage.csv
   * @param {object} compat        CompatChambres (getChamberModels)
   * @param {object} [opts]        { ref: chambre imposée, infos: fn(ref) → compléments }
   */
  function etudierChambre(faces, chambresRows, compat, opts = {}) {
    const avertissements = [];
    const occupees = FACES.filter((k) => faces && faces[k]);
    if (!occupees.length) return { ok: false, erreurs: ['Aucune face renseignée'] };
    const models = compat.getChamberModels(chambresRows || []);

    const tient = (m) => occupees.every((k) => {
      const f = faceDe(m, k);
      return f.largeur >= faces[k].largeur && f.hauteur >= faces[k].hauteur;
    });
    let modele;
    if (opts.modele) {
      modele = opts.modele; // chambre maçonnée sur mesure (ChambresInfos.chambreMaconnee)
    } else if (opts.ref) {
      modele = models.find((m) => m.ref.toUpperCase() === String(opts.ref).toUpperCase());
      if (!modele) return { ok: false, erreurs: [`Chambre « ${opts.ref} » inconnue (catalogue : ${models.map((m) => m.ref).join(', ')})`] };
    } else {
      // la plus petite emprise qui convient à toutes les faces
      modele = models.filter(tient).sort((a, b) => (a.L * a.l) - (b.L * b.l) || a.H - b.H || a.ref.localeCompare(b.ref))[0];
      if (!modele) {
        return { ok: false, erreurs: ['Aucune chambre préformée ne reçoit toutes ces faces : chambre maçonnée sur mesure à prévoir'],
          besoin: Object.fromEntries(occupees.map((k) => [k, { largeur: faces[k].largeur, hauteur: faces[k].hauteur }])) };
      }
    }

    const detailFaces = {};
    for (const k of occupees) {
      const f = faceDe(modele, k), mq = faces[k];
      const ok = f.largeur >= mq.largeur && f.hauteur >= mq.hauteur;
      if (!ok) avertissements.push(`${LIBELLE[k]} : le masque « ${mq.nom} » (${mq.largeur} × ${mq.hauteur} mm) ne tient pas dans ${f.largeur} × ${f.hauteur} mm`);
      detailFaces[k] = { face: LIBELLE[k], masque: mq.nom, largeurFace: f.largeur, hauteurFace: f.hauteur,
        largeurMasque: mq.largeur, hauteurMasque: mq.hauteur, tient: ok,
        marge: { largeur: f.largeur - mq.largeur, hauteur: f.hauteur - mq.hauteur } };
    }

    // Traversées : par nom de liaison, sur quelles faces elle apparaît
    const parLiaison = new Map();
    for (const k of occupees) {
      for (const nom of faces[k].liaisons || []) {
        if (!parLiaison.has(nom)) parLiaison.set(nom, []);
        if (!parLiaison.get(nom).includes(k)) parLiaison.get(nom).push(k);
      }
    }
    const fourreauxDe = (k, nom) => (faces[k].fourreaux || []).filter((f) => (f.liaisons || [f.libelle]).some((x) => x && (x === nom || String(x).startsWith(nom))));
    const traversees = [], arrets = [];
    for (const [nom, ks] of parLiaison) {
      if (ks.length === 1) { arrets.push({ liaison: nom, face: LIBELLE[ks[0]], cle: ks[0] }); continue; }
      const [a, b] = ks;
      const t = { liaison: nom, entree: LIBELLE[a], sortie: LIBELLE[b], cles: [a, b], type: opposee[a] === b ? 'droite' : 'angle' };
      if (ks.length > 2) avertissements.push(`« ${nom} » apparaît sur ${ks.length} faces : vérifier son cheminement`);
      const da = fourreauxDe(a, nom).map((f) => f.od), db = fourreauxDe(b, nom).map((f) => f.od);
      if (da.length && db.length && Math.max(...da) !== Math.max(...db)) {
        // normal quand un faisceau se sépare : indiqué, pas une anomalie
        t.changementFourreau = `Ø${Math.max(...da)} → Ø${Math.max(...db)}`;
      }
      if (t.type === 'angle') t.note = 'traversée en angle : vérifier le rayon de courbure des câbles dans la chambre';
      traversees.push(t);
    }
    const infos = modele.infos || (typeof opts.infos === 'function' ? opts.infos(modele.ref) : null);
    (modele.controles || []).forEach((c) => avertissements.push(c));
    return {
      ok: true, ref: modele.ref, L: modele.L, l: modele.l, H: modele.H, infos,
      faces: detailFaces, traversees, arrets, avertissements,
    };
  }


  // Traversées regroupées par couple de côtés (un faisceau par couple) : lisible
  // même quand 30 liaisons traversent la chambre. Du plus gros faisceau au plus petit.
  function regrouperTraversees(etude) {
    const g = new Map();
    for (const t of (etude && etude.traversees) || []) {
      const [a, b] = t.cles, cle = NUMERO[a] <= NUMERO[b] ? `${a}|${b}` : `${b}|${a}`;
      if (!g.has(cle)) g.set(cle, { cles: cle.split('|'), type: t.type, liaisons: [] });
      g.get(cle).liaisons.push(t.liaison);
    }
    return [...g.values()].sort((x, y) => y.liaisons.length - x.liaisons.length || NUMERO[x.cles[0]] - NUMERO[y.cles[0]])
      .map((x) => ({ ...x, entree: LIBELLE[x.cles[0]], sortie: LIBELLE[x.cles[1]] }));
  }

  const api = { etudierChambre, regrouperTraversees, FACES, LIBELLE, NUMERO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChambreFaces = api;
})(typeof window !== 'undefined' ? window : globalThis);

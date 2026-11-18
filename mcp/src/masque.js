'use strict';
// Génération d'un MASQUE (coupe d'un tronçon : tranchée ou conduit) à partir
// de liaisons Caneco — même chaîne que BIG BRAIN dans l'application :
//   circuit → câbles (circuit.js) → phases (phase-assign.js)
//   → fourreaux (cable-assign.js) + réserves (big-brain.js)
//   → placement des fourreaux (packer.js) → placement des câbles dans
//     chaque fourreau (packer.js, nid d'abeille, posés au fond).
// Sortie : une géométrie NEUTRE en mm (Y vers le haut, origine = coin
// bas-gauche du masque), utilisable telle quelle par n'importe quelle CAO.
const Circuit = require('../../src/renderer/circuit.js');
const PhaseAssign = require('../../src/renderer/phase-assign.js');
const CableAssign = require('../../src/renderer/cable-assign.js');
const BigBrain = require('../../src/renderer/big-brain.js');
const PACKER = require('../../src/renderer/packer.js');
const { trancheeNormee } = require('./normes.js');
const CompatChambres = require('../../src/renderer/compat-chambres.js');
const { chambrePourNappe } = require('./chambres-infos.js');

const DEFAULTS = {
  ecart: 30,          // mm, bord à bord entre fourreaux (tranchée)
  litDePose: 40,      // mm, autour de la nappe
  forme: 'rect',      // 'rect' (tranchée / boîte) ou 'circ' (conduit)
  tauxMax: 0.33,      // remplissage max d'un fourreau (BIG BRAIN)
  typesAutorises: ['TPC'],
  tailleMaxFourreauOd: null,
  harmonie: false,
  // Tranchée normée (NF P 98-331 / NF EN 12613, ex NF T 54-080) — voir normes.js
  zone: 'trottoir',     // chaussee | trottoir | espace_vert | prive
  reseau: 'electricite',
  recouvrementMm: null, // surcharge du recouvrement minimal de la zone
  grillageAuDessusMm: null,
  profondeurFouilleMm: null,
  chambre: null,        // réf. imposée (ex. "L2T") ; sinon choix automatique
};

// Chambre de tirage pour ce masque : règle partagée avec l'application
// (src/renderer/chambres-infos.js → compat-chambres.js).
function choisirChambre(W, H, cat, refImposee) {
  return chambrePourNappe(W, H, cat.chambres, CompatChambres, refImposee);
}

function withGeo(gap, margin, fn) {
  const saved = { ...PACKER.GEO };
  PACKER.GEO.gap = gap; PACKER.GEO.margin = margin;
  try { return fn(); } finally { Object.assign(PACKER.GEO, saved); }
}

const labelOf = (l) => (l.origine ? `${l.origine} → ${l.nom}` : l.nom);

/**
 * @param {object} p
 * @param {string} p.nom                  nom du masque (ex. "TGBT → COFFRET 1")
 * @param {Array}  p.liaisons             liaisons lues dans la note (note.js)
 * @param {Array}  [p.reserves]           [{ type, code, qty, nom? }]
 * @param {object} [p.options]            voir DEFAULTS, + largeurImposee / hauteurImposee
 * @param {object} cat                    catalogues (catalogue.js)
 */
function buildMasque({ nom, liaisons = [], reserves = [], options = {} }, cat) {
  const o = { ...DEFAULTS, ...options };
  const avertissements = [];

  const circuitLiaisons = liaisons.filter((l) => l.selectable && l.liaison && l.liaison.circuit);
  liaisons.filter((l) => !(l.selectable && l.liaison)).forEach((l) => {
    avertissements.push(`${labelOf(l)} (ligne ${l.ligne}) : ligne de réserve ou illisible dans la note, ignorée`);
  });
  liaisons.filter((l) => l.avertissement).forEach((l) => {
    avertissements.push(`${labelOf(l)} : ${l.avertissement}`);
  });

  const built = circuitLiaisons.map((l) => ({
    id: l.ref,
    nom: labelOf(l),
    cables: Circuit.circuitToCables(l.liaison.circuit, cat.resolveOd),
    tailleImposee: null,
  }));
  const reserveLiaisons = reserves.map((r, i) => ({
    id: `R${i + 1}`, nom: r.nom || `Réserve ${r.type} ${r.code}`, reserve: { type: r.type, code: String(r.code), qty: r.qty },
  }));

  const erreurs = [];
  if (built.length) {
    const v = BigBrain.validateLiaisons(built);
    v.errors.forEach((e) => erreurs.push(`${built[e.index] ? built[e.index].nom : 'Liaison'} : ${e.message}`));
  }
  const vr = BigBrain.validateReserves(reserveLiaisons, cat.fourreaux);
  vr.errors.forEach((e) => erreurs.push(`${reserveLiaisons[e.index] ? reserveLiaisons[e.index].nom : 'Réserve'} : ${e.message}`));
  if (!built.length && !reserveLiaisons.length) erreurs.push('Aucune liaison utilisable pour ce masque');
  if (erreurs.length) return { nom, ok: false, erreurs, avertissements };

  // 1. câbles → fourreaux
  const cableResult = built.length
    ? CableAssign.assignCablesToFourreaux(built, cat.fourreaux, {
      tauxMax: o.tauxMax, tailleMaxFourreauOd: o.tailleMaxFourreauOd,
      typesAutorises: o.typesAutorises, harmonie: o.harmonie,
    })
    : { fourreaux: [], nonPlaces: [] };
  const result = BigBrain.buildGenerationResult(cableResult, reserveLiaisons, cat.fourreaux);
  const namesById = Object.fromEntries([...built, ...reserveLiaisons].map((l) => [l.id, l.nom]));
  const objs = BigBrain.resultToObjects(result, namesById);
  if (!objs.fourreaux.length) {
    return { nom, ok: false, erreurs: ['Aucun fourreau ne convient (câbles trop gros pour la taille max ou les types autorisés)'], avertissements, nonPlaces: result.nonPlaces };
  }

  // 2. phases (même indexation par signature que l'application)
  const queues = PhaseAssign.buildPhaseQueues(built);
  const cursors = {};
  const phaseOf = (c) => {
    const sig = `${c.liaisonId}|${c.code}|${c.fonction || 'auto'}`;
    const q = queues[sig];
    if (!q) return null;
    const k = cursors[sig] || 0; cursors[sig] = k + 1;
    return q[k] || null;
  };

  // 3. placement des fourreaux dans la coupe
  const tubes = objs.fourreaux.map((f, i) => ({ id: i, d: f.od }));
  const lockW = Number(o.largeurImposee) > 0, lockH = Number(o.hauteurImposee) > 0;
  const anchored = withGeo(o.ecart, o.litDePose, () => {
    const solveOpts = o.forme === 'circ' ? { shape: 'circ' }
      : lockW ? { lock: 'w', w: o.largeurImposee }
      : lockH ? { lock: 'h', h: o.hauteurImposee } : { lock: null };
    const L = PACKER.solve(tubes, solveOpts);
    return PACKER.anchorLayout(L, {
      w: lockW ? o.largeurImposee : 0, h: lockH ? o.hauteurImposee : 0,
      lockW, lockH, shape: o.forme === 'circ' ? 'circ' : 'rect',
    });
  });
  if (lockW && anchored.w > o.largeurImposee + 1e-6) avertissements.push(`Largeur imposée ${o.largeurImposee} mm dépassée : ${anchored.w} mm nécessaires`);
  if (lockH && anchored.h > o.hauteurImposee + 1e-6) avertissements.push(`Hauteur imposée ${o.hauteurImposee} mm dépassée : ${anchored.h} mm nécessaires`);

  const W = anchored.w, H = anchored.h;
  const fourreaux = anchored.positions.map((p) => {
    const f = objs.fourreaux[p.id];
    return {
      id: `F${p.id + 1}`, type: f.type, code: String(f.code), od: f.od, di: f.idm,
      x: round(p.x), y: round(p.yUp),
      libelle: f.label || '', taux: round(f.tauxOccupation * 100, 1),
      // liste complète des liaisons portées (le libellé est abrégé en « X +2 »)
      liaisons: (() => {
        const noms = [...new Set(objs.cables.filter((c) => c.parentIndex === p.id).map((c) => namesById[c.liaisonId] || c.liaisonId))];
        return noms.length ? noms : [f.label || ''];
      })(),
    };
  }).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  // 4. câbles dans chaque fourreau : nid d'abeille, faisceau posé au fond
  const cables = [];
  objs.fourreaux.forEach((f, i) => {
    const mine = objs.cables.filter((c) => c.parentIndex === i);
    if (!mine.length) return;
    const fo = fourreaux.find((x) => x.id === `F${i + 1}`);
    const bundle = withGeo(0, 0, () => {
      const L = PACKER.solve(mine.map((c, k) => ({ id: k, d: c.od })), { shape: 'circ' });
      return PACKER.anchorLayout(L, { w: 0, h: 0, shape: 'circ' });
    });
    const R = bundle.w / 2, ri = f.idm / 2;
    if (R > ri + 1e-6) avertissements.push(`${fo.id} (${f.type} ${f.code}) : les câbles ne tiennent pas géométriquement dans Ø${f.idm} intérieur`);
    const drop = Math.max(0, ri - R); // faisceau au fond du fourreau
    bundle.positions.forEach((bp) => {
      const c = mine[bp.id];
      cables.push({
        fourreau: fo.id, liaison: namesById[c.liaisonId] || c.liaisonId,
        fam: c.fam, code: c.code, od: c.od, fonction: c.fonction || null, phase: phaseOf(c),
        x: round(fo.x + (bp.x - R)), y: round(fo.y + (bp.yUp - R) - drop),
      });
    });
  });

  const aire = o.forme === 'circ' ? Math.PI * W * W / 4 : W * H;
  const occupation = round(fourreaux.reduce((s, f) => s + Math.PI * f.od * f.od / 4, 0) / aire * 100, 1);
  (result.nonPlaces || []).forEach((n) => avertissements.push(`Câble non placé : ${n.fam} ${n.code} (Ø${n.od})${n.raison ? ' — ' + n.raison : ''}`));

  // 5. tranchée normée : profondeur, recouvrement, grillage avertisseur
  let tranchee = null;
  if (o.forme !== 'circ') {
    const hautNappe = Math.max(...fourreaux.map((f) => f.y + f.od / 2));
    tranchee = trancheeNormee({ largeur: W, hauteur: H, hautNappe }, {
      zone: o.zone, reseau: o.reseau, recouvrementMm: o.recouvrementMm,
      grillageAuDessusMm: o.grillageAuDessusMm, profondeurFouilleMm: o.profondeurFouilleMm,
    });
    tranchee.conformite.filter((c) => !c.ok).forEach((c) => avertissements.push(`Non conforme : ${c.regle} (${c.detail})`));
  }

  // 6. chambre de tirage (tranchée seulement)
  let chambre = null;
  if (o.forme !== 'circ') {
    chambre = choisirChambre(W, H, cat, o.chambre);
    if (chambre && chambre.erreur) { avertissements.push(chambre.erreur); chambre = null; }
    else if (chambre && chambre.aucune) avertissements.push('Aucune chambre préformée ne convient : chambre maçonnée sur mesure à prévoir');
    if (chambre && chambre.infos && chambre.infos.aVerifier) avertissements.push(`Chambre ${chambre.ref} : ${chambre.infos.aVerifier}`);
    if (chambre && chambre.aucune) { /* déjà signalé */ } else if (chambre && !chambre.tient) avertissements.push(`La nappe (${W} × ${H} mm) ne tient pas dans la face ${chambre.entree} de la ${chambre.ref} (${chambre.face.largeur} × ${chambre.face.hauteur} mm)`);
  }

  return {
    nom, ok: true,
    forme: o.forme,
    tranchee,
    chambre,
    largeur: W, hauteur: H, // diamètre = largeur pour un conduit
    reglages: { ecart: o.forme === 'circ' ? 0 : o.ecart, litDePose: o.litDePose, tauxMax: o.tauxMax, typesAutorises: o.typesAutorises },
    occupation,
    fourreaux, cables,
    liaisons: built.map((l) => l.nom).concat(reserveLiaisons.map((r) => r.nom)),
    nonPlaces: result.nonPlaces || [],
    avertissements,
  };
}

function round(v, d = 2) { const k = 10 ** d; return Math.round(v * k) / k; }

module.exports = { buildMasque, DEFAULTS };

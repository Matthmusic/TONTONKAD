'use strict';
(function (root) {
// Compléments INDICATIFS aux cotes de chambres de TONTONKAD
// (data/chambres_de_tirage.csv), relevés dans des sources publiques — pas
// une fiche fabricant. Servent au dessin (parois, tampons, hauteur totale).
//
// Constats (relevé du 18/11/2026) :
// - Longueurs et largeurs intérieures de TONTONKAD = sources publiques, sauf
//   L4T (1670 contre 1870 mm) et L3C (520 contre 380 mm) : à vérifier.
// - Hauteurs de TONTONKAD plus basses d'une valeur CONSTANTE : 60 mm pour la
//   série T (trottoir), 140 mm pour les séries C et K (chaussée). On les lit
//   comme des hauteurs UTILES sous cadre + tampon ; la hauteur intérieure
//   totale publiée est 600 mm (T), 1200 mm (L5T/L6T), 600 mm (L…C), 750 mm (K).
// - Parois : ~125 mm pour la série L…T (extérieur L1T 775 × 635, L6T
//   2675 × 1130 pour un intérieur 520 × 380 et 2420 × 880) ; ~100 mm pour la
//   série K (extérieur 950 × 950 pour 750 × 750 intérieur).
//
// Sources : fibre.wiki (Chambres de tirage / Série L), fiche technique Samse
// 11960, MyPUM (chambres télécom béton), Prozon (chambres trottoir et
// chaussée), guide de conception ICE de Nantes Métropole (2011).

const SERIE_T = { reserveHauteur: 60, paroi: 125 };
const SERIE_C = { reserveHauteur: 140, paroi: null };
const SERIE_K = { reserveHauteur: 140, paroi: 100 };

const INFOS = {
  L1T: { ...SERIE_T, tampons: 1 },
  L2T: { ...SERIE_T, tampons: 2 },
  L3T: { ...SERIE_T, tampons: 3 },
  L4T: { ...SERIE_T, tampons: 4, aVerifier: 'longueur 1670 mm dans TONTONKAD, 1870 mm dans les sources publiques' },
  '1/2 L4T': { ...SERIE_T, tampons: null },
  L5T: { ...SERIE_T, tampons: 3 },
  L6T: { ...SERIE_T, tampons: 4 },
  L1C: { ...SERIE_C, tampons: null },
  L2C: { ...SERIE_C, tampons: null },
  L3C: { ...SERIE_C, tampons: null, aVerifier: 'largeur 520 mm dans TONTONKAD, 380 mm dans les sources publiques' },
  K1C: { ...SERIE_K, tampons: null },
  K2C: { ...SERIE_K, tampons: null },
  K3C: { ...SERIE_K, tampons: null },
};

const SOURCE = 'Indicatif : sources publiques (fibre.wiki, fiches Samse/MyPUM/Prozon, guide ICE Nantes), pas une fiche fabricant.';

function infosChambre(ref) {
  const i = INFOS[ref];
  return i ? { ...i, source: SOURCE } : null;
}

// Chambre retenue pour une nappe W × H (mm) — règle de l'application
// (compat-chambres.js) : pignon d'abord, sinon long-pan, sinon maçonnée.
// compat = CompatChambres (passé en paramètre : module sans dépendance).
function chambrePourNappe(W, H, chambresRows, compat, refImposee) {
  const models = compat.getChamberModels(chambresRows || []);
  if (!models.length) return null;
  const build = (m, via) => {
    const pignon = via === 'pignon';
    const face = { largeur: pignon ? m.l : m.L, hauteur: m.H };
    return {
      ref: m.ref, entree: via, L: m.L, l: m.l, H: m.H, face,
      profondeur: pignon ? m.L : m.l,
      marge: { largeur: face.largeur - W, hauteur: face.hauteur - H },
      tient: face.largeur >= W && face.hauteur >= H,
      infos: infosChambre(m.ref),
      source: 'Cotes intérieures du catalogue TONTONKAD (chambres Stradal).',
    };
  };
  if (refImposee) {
    const m = models.find((x) => x.ref.toUpperCase() === String(refImposee).toUpperCase());
    if (!m) return { erreur: `Chambre « ${refImposee} » inconnue (catalogue : ${models.map((x) => x.ref).join(', ')})` };
    return build(m, m.l >= W ? 'pignon' : 'long-pan');
  }
  const { unit, longPan, tiling } = compat.computeCompatibleChambers(models, W, H, 3);
  const best = compat.pickBestChamber(unit, longPan);
  if (best) return build(models.find((x) => x.ref === best.ref), best.via === 'unit' ? 'pignon' : 'long-pan');
  const t = tiling[0];
  // Aucune préformée : chambre maçonnée sur mesure (valeurs par défaut, à valider)
  const mc = chambreMaconnee({ pignonA: { largeur: W, hauteur: H } });
  return { aucune: true, maconnee: t ? { tampons: t.N, refs: t.refs, largeurTotale: t.total } : null,
    ref: mc.ref, entree: mc.l >= W ? 'pignon' : 'long-pan', L: mc.L, l: mc.l, H: mc.H,
    face: { largeur: mc.l >= W ? mc.l : mc.L, hauteur: mc.H }, profondeur: mc.l >= W ? mc.L : mc.l,
    marge: { largeur: (mc.l >= W ? mc.l : mc.L) - W, hauteur: mc.H - H }, tient: true, infos: mc.infos, sur_mesure: true, source: SOURCE_MACONNEE };
}


// ─── Chambre MAÇONNÉE sur mesure ──────────────────────────────────────────
// Toutes les valeurs ci-dessous sont des DÉFAUTS MODIFIABLES, à valider par
// le bureau d'études : aucune n'est tirée d'une norme ni d'une fiche fabricant.
const MACONNEE_DEFAUTS = {
  paroi: 200,               // épaisseur des parois (mm) : bloc béton / béton banché
  degagementLateral: 150,   // de chaque côté de la nappe, le long d'une face (mm)
  degagementHaut: 250,      // au-dessus de la nappe, sous le cadre du tampon (mm)
  longueurMin: 1000,        // longueur intérieure mini pour le tirage (mm)
  arrondi: 50,              // cotes intérieures arrondies au multiple supérieur (mm)
  tampon: { L: 600, l: 600, classe: 'D400' },
  zone: 'chaussee',
  ouvertureParTampon: 1500, // longueur de chambre desservie par un tampon (mm)
};
// Ouvertures courantes (mm) et classes NF EN 124 (à valider pour chaque projet).
const TAMPONS = [[400, 400], [500, 500], [600, 600], [700, 700], [800, 800], [1000, 600], [1200, 600]];
const CLASSES = ['A15', 'B125', 'C250', 'D400', 'E600', 'F900'];
const ZONES = {
  espaceVert: { libelle: 'Espace vert / piétons', mini: 'A15' },
  trottoir: { libelle: 'Trottoir / parking VL', mini: 'B125' },
  bordure: { libelle: 'Bordure de trottoir / caniveau', mini: 'C250' },
  chaussee: { libelle: 'Chaussée', mini: 'D400' },
  lourd: { libelle: 'Zone poids lourds / portuaire', mini: 'E600' },
};
const SOURCE_MACONNEE = 'Chambre maçonnée : dimensions et tampon calculés avec des valeurs par défaut — à valider (bureau d\'études, NF EN 124 pour la classe).';

function controleTampon(classe, zone) {
  const z = ZONES[zone];
  if (!z) return { ok: true, message: null };
  const ok = CLASSES.indexOf(classe) >= CLASSES.indexOf(z.mini);
  return { ok, message: ok ? null : `Tampon ${classe} insuffisant en ${z.libelle.toLowerCase()} : ${z.mini} minimum (à valider)` };
}

// besoins = { pignonA?: { largeur, hauteur }, pignonB?, longPanA?, longPanB? }
// (largeur/hauteur de la nappe de chaque face, en mm).
function chambreMaconnee(besoins, options) {
  const o = { ...MACONNEE_DEFAUTS, ...(options || {}) };
  o.tampon = { ...MACONNEE_DEFAUTS.tampon, ...((options && options.tampon) || {}) };
  const up = (v) => Math.ceil(v / o.arrondi) * o.arrondi;
  const b = besoins || {};
  const larg = (ks) => Math.max(0, ...ks.filter((k) => b[k]).map((k) => b[k].largeur));
  const haut = Math.max(0, ...Object.values(b).filter(Boolean).map((x) => x.hauteur));
  const tMin = Math.min(o.tampon.L, o.tampon.l), tMax = Math.max(o.tampon.L, o.tampon.l);
  // pignons = petite largeur l, long-pans = grande longueur L
  let l = up(Math.max(larg(['pignonA', 'pignonB']) + 2 * o.degagementLateral, tMin));
  let L = up(Math.max(larg(['longPanA', 'longPanB']) + 2 * o.degagementLateral, o.longueurMin, tMax));
  if (l > L) [L, l] = [l, L];
  const H = up(Math.max(haut + o.degagementHaut, 400));
  const tampons = Math.max(1, Math.ceil(L / o.ouvertureParTampon));
  const controles = [];
  const c = controleTampon(o.tampon.classe, o.zone);
  if (!c.ok) controles.push(c.message);
  if (tampons * tMax > L) controles.push(`${tampons} tampon(s) de ${tMax} mm ne tiennent pas sur ${L} mm : réduire le nombre ou la taille`);
  return {
    ref: `Maçonnée ${L}×${l}`, L, l, H, maconnee: true, controles,
    infos: { paroi: o.paroi, reserveHauteur: 0, tampons, tampon: o.tampon, zone: o.zone, maconnee: true, source: SOURCE_MACONNEE },
    reglages: o,
  };
}

const api = { infosChambre, chambrePourNappe, chambreMaconnee, controleTampon, MACONNEE_DEFAUTS, TAMPONS, CLASSES, ZONES, INFOS, SOURCE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.ChambresInfos = api;
})(typeof window !== 'undefined' ? window : globalThis);

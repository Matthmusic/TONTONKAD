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
  return { aucune: true, maconnee: t ? { tampons: t.N, refs: t.refs, largeurTotale: t.total } : null };
}

const api = { infosChambre, chambrePourNappe, INFOS, SOURCE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.ChambresInfos = api;
})(typeof window !== 'undefined' ? window : globalThis);

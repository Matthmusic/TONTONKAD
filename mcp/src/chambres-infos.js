'use strict';
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

module.exports = { infosChambre, INFOS, SOURCE };

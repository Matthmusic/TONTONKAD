'use strict';
// Règles normatives appliquées aux masques de tranchée.
//
// ⚠ Valeurs par DÉFAUT reprises de sources secondaires publiques (guides VRD,
// fabricants), PAS du texte AFNOR officiel (payant). Chaque règle porte sa
// source et `aValider: true` tant qu'un référent ne l'a pas confrontée au
// texte en vigueur. Toutes sont surchargeables par les options du masque.
//
// - NF P 98-331 : tranchées (ouverture, remblayage, réfection) → hauteur de
//   recouvrement minimale au-dessus de la génératrice supérieure des réseaux.
// - NF T 54-080 : dispositifs avertisseurs (grillages/rubans) — ANNULÉE,
//   remplacée par NF EN 12613 → couleur par réseau, pose au-dessus des réseaux.
// - Distances entre réseaux parallèles : NF P 98-332 (non traitée ici).

const RECOUVREMENT_MIN_MM = {
  chaussee: 800,       // sous chaussée / parking
  trottoir: 600,       // sous trottoir, accotement
  espace_vert: 600,    // sous espace vert
  prive: 600,          // terrain privé, à défaut d'exigence plus forte
};

const GRILLAGE = {
  auDessusMinMm: 200,  // au-dessus de la génératrice supérieure du réseau
  auDessusMaxMm: 300,
  couleurs: {          // NF EN 12613 (ex NF T 54-080)
    electricite: { nom: 'rouge', aci: 1 },
    telecom: { nom: 'vert', aci: 3 },
    eau: { nom: 'bleu', aci: 5 },
    gaz: { nom: 'jaune', aci: 2 },
    assainissement: { nom: 'marron', aci: 34 },
    eclairage: { nom: 'rouge', aci: 1 },
  },
};

const SOURCES = {
  recouvrement: 'NF P 98-331 (valeurs issues de guides VRD publics, à valider sur le texte AFNOR)',
  grillage: 'NF T 54-080, remplacée par NF EN 12613 (valeurs issues de guides fabricants, à valider)',
};

/**
 * Coupe de tranchée normée autour d'une nappe de fourreaux.
 * Y vers le haut, origine = fond de fouille (coin bas-gauche du masque).
 * @param {object} nappe   { largeur, hauteur, hautNappe } en mm (hautNappe =
 *                         cote de la génératrice supérieure du fourreau le plus haut)
 * @param {object} opts    { zone, reseau, recouvrementMm, grillageAuDessusMm,
 *                           profondeurFouilleMm (imposée, facultatif) }
 */
function trancheeNormee(nappe, opts = {}) {
  const zone = opts.zone || 'trottoir';
  const reseau = opts.reseau || 'electricite';
  const conformite = [];

  const recouvrementMin = Number(opts.recouvrementMm) > 0 ? Number(opts.recouvrementMm)
    : RECOUVREMENT_MIN_MM[zone];
  if (recouvrementMin == null) throw new Error(`Zone inconnue « ${zone} » (attendu : ${Object.keys(RECOUVREMENT_MIN_MM).join(', ')})`);

  // Profondeur de fouille : imposée, ou minimale = haut de nappe + recouvrement.
  const profMin = nappe.hautNappe + recouvrementMin;
  const profondeur = Number(opts.profondeurFouilleMm) > 0 ? Number(opts.profondeurFouilleMm) : Math.ceil(profMin / 10) * 10;
  const recouvrement = profondeur - nappe.hautNappe;
  conformite.push({
    regle: `Recouvrement ≥ ${recouvrementMin} mm (${zone.replace('_', ' ')})`,
    ok: recouvrement + 1e-6 >= recouvrementMin,
    detail: `recouvrement obtenu : ${Math.round(recouvrement)} mm`,
    source: SOURCES.recouvrement, aValider: true,
  });

  const g = Number(opts.grillageAuDessusMm) > 0 ? Number(opts.grillageAuDessusMm) : GRILLAGE.auDessusMinMm;
  const couleur = GRILLAGE.couleurs[reseau] || GRILLAGE.couleurs.electricite;
  const yGrillage = nappe.hautNappe + g;
  conformite.push({
    regle: `Grillage avertisseur ${couleur.nom}, ${GRILLAGE.auDessusMinMm} à ${GRILLAGE.auDessusMaxMm} mm au-dessus des fourreaux`,
    ok: g >= GRILLAGE.auDessusMinMm && g <= GRILLAGE.auDessusMaxMm && yGrillage < profondeur,
    detail: `posé à ${g} mm au-dessus, soit à ${Math.round(profondeur - yGrillage)} mm sous le terrain fini`,
    source: SOURCES.grillage, aValider: true,
  });
  if (!GRILLAGE.couleurs[reseau]) {
    conformite.push({ regle: 'Couleur du grillage', ok: false, detail: `réseau « ${reseau} » inconnu, rouge (électricité) utilisé par défaut`, source: SOURCES.grillage, aValider: true });
  }

  return {
    zone, reseau,
    profondeur,                 // fond de fouille → terrain fini
    recouvrement: Math.round(recouvrement),
    grillage: { y: yGrillage, couleur: couleur.nom, aci: couleur.aci, largeur: nappe.largeur },
    conformite,
  };
}

module.exports = { trancheeNormee, RECOUVREMENT_MIN_MM, GRILLAGE, SOURCES };

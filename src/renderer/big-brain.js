'use strict';
// BIG BRAIN — adaptateur PUR entre CableAssign (Brique A) et la modale (Brique B2).
// Façon packer.js : window.BigBrain + module.exports. Aucun DOM.
(function (root) {
  // Valide la saisie des liaisons avant génération.
  function validateLiaisons(liaisons) {
    if (!Array.isArray(liaisons) || liaisons.length === 0) {
      return { ok: false, errors: [{ index: -1, message: 'Aucune liaison définie' }] };
    }
    const errors = [];
    liaisons.forEach((l, index) => {
      if (!l || typeof l.nom !== 'string' || !l.nom.trim()) {
        errors.push({ index, message: 'Nom de liaison vide' });
      }
      const cables = (l && Array.isArray(l.cables)) ? l.cables : [];
      if (cables.length === 0) {
        errors.push({ index, message: 'Liaison sans câble' });
      }
      cables.forEach((c) => {
        if (!c || !c.fam || !c.code) errors.push({ index, message: 'Câble incomplet (fam/code)' });
        else if (!(Number(c.od) > 0)) errors.push({ index, message: 'Câble sans diamètre valide' });
        else {
          const q = Number(c.qty);
          if (!(Number.isInteger(q) && q >= 1)) errors.push({ index, message: 'Quantité de câble invalide (≥ 1)' });
        }
      });
    });
    return { ok: errors.length === 0, errors };
  }

  // Cherche un fourreau exact (type+code) au catalogue — utilisé par
  // validateReserves et buildReserveFourreaux (même résolution, deux fois).
  function findFourreauSpec(catalogueFourreaux, type, code) {
    return (catalogueFourreaux || []).find((f) => f.type === type && f.code === code) || null;
  }

  // Valide les liaisons RÉSERVE (fourreaux vides, pas de câble) avant
  // génération. reserve = { type, code, qty } — voir buildReserveFourreaux.
  // Liste vide/absente : ok (les réserves sont optionnelles, contrairement
  // aux liaisons circuit où « aucune liaison » est déjà une erreur en soi).
  function validateReserves(reserveLiaisons, catalogueFourreaux) {
    const list = Array.isArray(reserveLiaisons) ? reserveLiaisons : [];
    const errors = [];
    list.forEach((l, index) => {
      if (!l || typeof l.nom !== 'string' || !l.nom.trim()) {
        errors.push({ index, message: 'Nom de liaison vide' });
      }
      const r = (l && l.reserve) || {};
      if (!findFourreauSpec(catalogueFourreaux, r.type, r.code)) {
        errors.push({ index, message: 'Type de fourreau introuvable au catalogue' });
      }
      const qty = Number(r.qty);
      if (!(Number.isInteger(qty) && qty >= 1)) {
        errors.push({ index, message: 'Quantité de réserve invalide (≥ 1)' });
      }
    });
    return { ok: errors.length === 0, errors };
  }

  // Transforme les liaisons RÉSERVE en fourreaux vides prêts à instancier —
  // même forme de sortie que assignCablesToFourreaux (cable-assign.js), sans
  // passer par l'empaquetage (rien à empaqueter : le type+taille est déjà
  // choisi explicitement par l'utilisateur, pas par le moteur). `label` est
  // posé directement ici (le nom de la liaison), car resultToObjects ne peut
  // pas le dériver des câbles d'un fourreau qui n'en contient aucun.
  // Entrée invalide (type+code introuvable, qty ≤ 0) : ignorée en silence —
  // generate() (big-brain-panel.js) valide en amont via validateReserves et
  // bloque déjà la génération dans ce cas ; robustesse défensive ici.
  function buildReserveFourreaux(reserveLiaisons, catalogueFourreaux) {
    const out = [];
    (reserveLiaisons || []).forEach((l) => {
      const r = (l && l.reserve) || {};
      const spec = findFourreauSpec(catalogueFourreaux, r.type, r.code);
      if (!spec) return;
      const qty = Math.floor(Number(r.qty));
      if (!(qty >= 1)) return;
      for (let i = 0; i < qty; i++) {
        out.push({ type: spec.type, code: spec.code, od: spec.od, id: spec.id, cables: [], usedArea: 0, tauxOccupation: 0, label: l.nom });
      }
    });
    return out;
  }

  // Combine le résultat de l'empaquetage des circuits (cable-assign.js) et
  // les fourreaux de réserve dans le même { fourreaux, nonPlaces } — seul
  // point où les deux natures de liaison se rejoignent avant instanciation.
  // Les réserves n'ont pas de notion de "non placé" (déjà validées en amont) :
  // nonPlaces vient uniquement de l'empaquetage des circuits.
  function buildGenerationResult(cableResult, reserveLiaisons, catalogueFourreaux) {
    const cr = cableResult || {};
    const cableFourreaux = Array.isArray(cr.fourreaux) ? cr.fourreaux : [];
    return {
      fourreaux: [...cableFourreaux, ...buildReserveFourreaux(reserveLiaisons, catalogueFourreaux)],
      nonPlaces: cr.nonPlaces || [],
    };
  }

  // Transforme le résultat moteur en objets prêts à instancier dans l'app.
  function resultToObjects(result, liaisonsById) {
    const names = liaisonsById || {};
    const nameOf = (id) => (names[id] != null ? names[id] : String(id));
    const fourreaux = [];
    const cables = [];
    const list = (result && Array.isArray(result.fourreaux)) ? result.fourreaux : [];
    list.forEach((f, i) => {
      // Un fourreau de réserve (buildReserveFourreaux) n'a aucun câble : rien
      // dont dériver un libellé par liaison — son f.label (déjà posé) prime.
      let label = f.label;
      if (label == null) {
        const liaisonNames = [...new Set((f.cables || []).map((c) => nameOf(c.liaisonId)))];
        label = liaisonNames.length <= 1
          ? (liaisonNames[0] || '')
          : `${liaisonNames[0]} +${liaisonNames.length - 1}`;
      }
      fourreaux.push({ type: f.type, code: f.code, od: f.od, idm: f.id, tauxOccupation: f.tauxOccupation, label });
      (f.cables || []).forEach((c) => {
        // Pas de nom de liaison sur le câble : répété sur chaque câble du
        // fourreau, il devenait illisible au canvas. Le fourreau garde le
        // libellé (identifie le circuit sur le plan) ; liaisonId reste
        // présent (nécessaire à l'affectation des phases).
        cables.push({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, fonction: c.fonction, parentIndex: i, label: '' });
      });
    });
    return { fourreaux, cables };
  }

  const api = { validateLiaisons, resultToObjects, validateReserves, buildReserveFourreaux, buildGenerationResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BigBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);

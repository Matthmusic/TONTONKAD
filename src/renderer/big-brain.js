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

  // Transforme le résultat moteur en objets prêts à instancier dans l'app.
  function resultToObjects(result, liaisonsById) {
    const names = liaisonsById || {};
    const nameOf = (id) => (names[id] != null ? names[id] : String(id));
    const fourreaux = [];
    const cables = [];
    const list = (result && Array.isArray(result.fourreaux)) ? result.fourreaux : [];
    list.forEach((f, i) => {
      const liaisonNames = [...new Set((f.cables || []).map((c) => nameOf(c.liaisonId)))];
      const label = liaisonNames.length <= 1
        ? (liaisonNames[0] || '')
        : `${liaisonNames[0]} +${liaisonNames.length - 1}`;
      fourreaux.push({ type: f.type, code: f.code, od: f.od, idm: f.id, tauxOccupation: f.tauxOccupation, label });
      (f.cables || []).forEach((c) => {
        cables.push({ fam: c.fam, code: c.code, od: c.od, fonction: c.fonction, parentIndex: i, label: nameOf(c.liaisonId) });
      });
    });
    return { fourreaux, cables };
  }

  const api = { validateLiaisons, resultToObjects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BigBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);

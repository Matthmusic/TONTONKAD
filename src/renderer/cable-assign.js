'use strict';
// BIG BRAIN — moteur d'affectation câbles→fourreaux (PUR, testé). Façon packer.js.
(function (root) {
  const aire = (d) => Math.PI * (d / 2) * (d / 2);
  const aireInt = (f) => aire(f.id);
  const capacite = (f, tauxMax) => tauxMax * aireInt(f);

  // Déplie les câbles de toutes les liaisons en unités individuelles (+ area).
  function expandCables(liaisons) {
    const units = [];
    (liaisons || []).forEach((l) => {
      (l.cables || []).forEach((c) => {
        const n = Math.max(0, Math.floor(c.qty || 0));
        for (let i = 0; i < n; i++) {
          units.push({ liaisonId: l.id, fam: c.fam, code: c.code, od: c.od, fonction: c.fonction, area: aire(c.od) });
        }
      });
    });
    return units;
  }

  // Fourreaux éligibles (filtrés) triés par Ø intérieur croissant (capacité croissante).
  function eligibleFourreaux(catalogue, options) {
    const maxOd = options.tailleMaxFourreauOd;
    const types = options.typesAutorises;
    return (catalogue || [])
      .filter((f) => (maxOd == null || f.od <= maxOd) && (!types || types.includes(f.type)))
      .slice()
      .sort((a, b) => (a.id - b.id) || (a.od - b.od) || String(a.type + a.code).localeCompare(String(b.type + b.code)));
  }

  // Plus petit fourreau éligible dont la capacité ≥ area ; null sinon.
  function smallestFourreauFor(area, eligibles, tauxMax) {
    for (const f of eligibles) if (capacite(f, tauxMax) >= area) return f;
    return null;
  }

  function assignCablesToFourreaux(liaisons, catalogueFourreaux, options = {}) {
    const tauxMax = (typeof options.tauxMax === 'number' && options.tauxMax > 0) ? options.tauxMax : 0.33;
    const eligibles = eligibleFourreaux(catalogueFourreaux, options);
    const raisonAucun = eligibles.length === 0 ? 'aucun fourreau éligible' : 'câble trop gros pour la taille max';
    const EPS = 1e-9;

    const open = [];        // { fourreau, cables:[], usedArea }
    const nonPlaces = [];

    // Regrouper les unités par liaison (ordre d'apparition conservé).
    const byLiaison = new Map();
    for (const u of expandCables(liaisons)) {
      if (!byLiaison.has(u.liaisonId)) byLiaison.set(u.liaisonId, []);
      byLiaison.get(u.liaisonId).push(u);
    }
    // Liaisons triées par aire totale décroissante (départage : liaisonId).
    const liaisonEntries = [...byLiaison.entries()]
      .map(([id, cables]) => ({ id, cables, area: cables.reduce((s, c) => s + c.area, 0) }))
      .sort((a, b) => (b.area - a.area) || String(a.id).localeCompare(String(b.id)));

    // Best-fit : fourreau ouvert le plus rempli qui accepte encore `area`.
    const bestOpenFor = (area) => {
      let best = null;
      for (const o of open) {
        if (o.usedArea + area <= capacite(o.fourreau, tauxMax) + EPS && (!best || o.usedArea > best.usedArea)) best = o;
      }
      return best;
    };
    const addTo = (o, cs) => { for (const c of cs) { o.cables.push(c); o.usedArea += c.area; } };
    const placeSingle = (c) => {
      const o = bestOpenFor(c.area);
      if (o) return addTo(o, [c]);
      const f = smallestFourreauFor(c.area, eligibles, tauxMax);
      if (f) return open.push({ fourreau: f, cables: [c], usedArea: c.area });
      nonPlaces.push({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, raison: raisonAucun });
    };

    for (const L of liaisonEntries) {
      const o = bestOpenFor(L.area);                         // 1) regroupement croisé
      if (o) { addTo(o, L.cables); continue; }
      const f = smallestFourreauFor(L.area, eligibles, tauxMax); // 2) nouveau fourreau pour liaison entière
      if (f) { open.push({ fourreau: f, cables: [...L.cables], usedArea: L.area }); continue; }
      const sorted = [...L.cables].sort((a, b) => (b.area - a.area) || String(a.code).localeCompare(String(b.code)));
      for (const c of sorted) placeSingle(c);               // 3) split câble par câble
    }

    const fourreaux = open.map((o) => ({
      type: o.fourreau.type, code: o.fourreau.code, od: o.fourreau.od, id: o.fourreau.id,
      cables: o.cables.map((c) => ({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, fonction: c.fonction })),
      usedArea: o.usedArea,
      tauxOccupation: o.usedArea / aireInt(o.fourreau),
    }));
    return { fourreaux, nonPlaces };
  }

  const api = {
    assignCablesToFourreaux,
    __test: { aire, aireInt, capacite, expandCables, eligibleFourreaux, smallestFourreauFor },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CableAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);

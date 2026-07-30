'use strict';
// BIG BRAIN — moteur d'affectation câbles→fourreaux (PUR, testé). Façon packer.js.
(function (root) {
  const aire = (d) => Math.PI * (d / 2) * (d / 2);
  const aireInt = (f) => aire(f.id);
  const capacite = (f, tauxMax) => tauxMax * aireInt(f);
  const EPS = 1e-9;

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

  // Simule un remplissage best-fit (même critère que la boucle réelle) de
  // items[startIndex..] dans des fourreaux homogènes de capacité `cap`.
  // Retourne le nombre de fourreaux nécessaires pour tout le reste de la file.
  function simulateBinCount(items, startIndex, cap) {
    const bins = [];
    for (let i = startIndex; i < items.length; i++) {
      const a = items[i].area;
      let bestIdx = -1, bestUsed = -1;
      for (let b = 0; b < bins.length; b++) {
        if (bins[b] + a <= cap + EPS && bins[b] > bestUsed) { bestUsed = bins[b]; bestIdx = b; }
      }
      if (bestIdx >= 0) bins[bestIdx] += a;
      else bins.push(a);
    }
    return bins.length;
  }

  // Choisit la taille de fourreau à OUVRIR pour items[startIndex], en anticipant
  // le reste de la file (items[startIndex+1..], d'aires ≤ celle de l'item
  // courant puisque la file est triée décroissante) : parmi les tailles
  // éligibles qui contiennent l'item seul, retient celle qui MINIMISE le
  // nombre de fourreaux nécessaires pour placer tout le reste — à
  // regroupement égal, la plus petite (parcours croissant + mise à jour
  // stricte, donc premier trouvé conservé en cas d'égalité).
  // Sans cette anticipation (smallestFourreauFor seul), la taille minimale
  // pour UN item laisse souvent ~0 place pour le suivant : N liaisons
  // similaires ouvraient N fourreaux à 1 câble chacun au lieu de se
  // regrouper — exactement ce que le regroupement croisé (ci-dessous) est
  // censé éviter, mais ne peut pas faire s'il n'a jamais de marge.
  function chooseFourreauSize(items, startIndex, eligibles, tauxMax) {
    let best = null;
    let bestCount = Infinity;
    for (const f of eligibles) {
      const cap = capacite(f, tauxMax);
      if (cap + EPS < items[startIndex].area) continue;
      const count = simulateBinCount(items, startIndex, cap);
      if (count < bestCount) { best = f; bestCount = count; }
    }
    return best;
  }

  function assignCablesToFourreaux(liaisons, catalogueFourreaux, options = {}) {
    const tauxMax = (typeof options.tauxMax === 'number' && options.tauxMax > 0) ? options.tauxMax : 0.33;
    const eligibles = eligibleFourreaux(catalogueFourreaux, options);
    const raisonAucun = eligibles.length === 0 ? 'aucun fourreau éligible' : 'câble trop gros pour la taille max';

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
    const placeSingle = (c, sorted, index) => {
      const o = bestOpenFor(c.area);
      if (o) return addTo(o, [c]);
      const f = chooseFourreauSize(sorted, index, eligibles, tauxMax);
      if (f) return open.push({ fourreau: f, cables: [c], usedArea: c.area });
      nonPlaces.push({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, raison: raisonAucun });
    };

    for (let i = 0; i < liaisonEntries.length; i++) {
      const L = liaisonEntries[i];
      const o = bestOpenFor(L.area);                              // 1) regroupement croisé
      if (o) { addTo(o, L.cables); continue; }
      const f = chooseFourreauSize(liaisonEntries, i, eligibles, tauxMax); // 2) nouveau fourreau pour liaison entière
      if (f) { open.push({ fourreau: f, cables: [...L.cables], usedArea: L.area }); continue; }
      const sorted = [...L.cables].sort((a, b) => (b.area - a.area) || String(a.code).localeCompare(String(b.code)));
      sorted.forEach((c, idx) => placeSingle(c, sorted, idx));     // 3) split câble par câble
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
    __test: { aire, aireInt, capacite, expandCables, eligibleFourreaux, smallestFourreauFor, chooseFourreauSize, simulateBinCount },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CableAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);

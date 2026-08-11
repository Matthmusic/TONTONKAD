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
      if (bestCount === 1) break; // 1 seul fourreau pour tout le reste : optimum, aucune taille plus grande ne peut faire mieux
    }
    return best;
  }

  // Entrelace phases et neutre dans le même ratio que le circuit (ex. 3
  // phases pour 1 neutre), au lieu d'un tri par taille qui regroupe par bloc
  // (toutes les phases d'un côté, tout le neutre de l'autre). Sans le
  // courant de retour du neutre, un fourreau ne contenant que des phases
  // n'est plus magnétiquement équilibré — risque d'échauffement par
  // induction dans un fourreau métallique. Seul le PE (géré à part, jamais
  // ici) peut être isolé sans ce risque.
  function interleaveCore(core) {
    const phases = core.filter((c) => c.fonction === 'phase');
    const neutres = core.filter((c) => c.fonction === 'neutre');
    const others = core.filter((c) => c.fonction !== 'phase' && c.fonction !== 'neutre');
    if (!phases.length || !neutres.length) return [...core]; // rien à entrelacer (ex. multi, ou pas de neutre)
    const ratio = phases.length / neutres.length;
    const out = [];
    let pi = 0;
    for (let ni = 0; ni < neutres.length; ni++) {
      const take = Math.round((ni + 1) * ratio) - Math.round(ni * ratio); // répartit un reliquat non entier
      for (let k = 0; k < take && pi < phases.length; k++) out.push(phases[pi++]);
      out.push(neutres[ni]);
    }
    while (pi < phases.length) out.push(phases[pi++]);
    out.push(...others);
    return out;
  }

  // options.harmonie (bool, défaut false) : ISOLATION TOTALE — chaque liaison
  // est empaquetée dans SES PROPRES fourreaux, jamais partagés avec une autre
  // liaison. Deux liaisons de composition identique produisent alors
  // toujours le même résultat, quel que soit leur rang dans la file ou la
  // forme de leurs voisines (sans ça, le regroupement croisé et
  // l'anticipation de chooseFourreauSize peuvent traiter différemment deux
  // liaisons pourtant identiques, selon ce qui les entoure — visuellement
  // incohérent pour des circuits censés être symétriques). Coût : perd
  // l'optimisation croisée entre liaisons différentes (parfois 1-2 fourreaux
  // de plus au total qu'un optimum global).
  //
  // liaisons[i].tailleImposee = { type, code } (optionnel) : fige le
  // fourreau de CETTE liaison à ce type+code exact du catalogue, en ignorant
  // tailleMaxFourreauOd/typesAutorises (un choix explicite par liaison prime
  // sur le réglage global). La liaison est scindée sur autant de fourreaux
  // de CETTE MÊME taille que nécessaire (jamais une autre), et — comme pour
  // harmonie — n'est jamais partagée avec une autre liaison (prévisible,
  // indépendant de la case Harmonie). Si le type+code n'existe pas au
  // catalogue, ou qu'un câble est trop gros même pour cette taille, les
  // câbles concernés partent en nonPlaces avec une raison dédiée.
  function assignCablesToFourreaux(liaisons, catalogueFourreaux, options = {}) {
    const tauxMax = (typeof options.tauxMax === 'number' && options.tauxMax > 0) ? options.tauxMax : 0.33;
    const eligibles = eligibleFourreaux(catalogueFourreaux, options);
    const raisonAucun = eligibles.length === 0 ? 'aucun fourreau éligible' : 'câble trop gros pour la taille max';
    const harmonie = !!options.harmonie;

    // Taille imposée par liaison : Map liaisonId → spec du catalogue, ou
    // `null` si le type+code demandé n'existe pas (imposée invalide).
    // Absence de clé = pas d'imposition pour cette liaison (comportement
    // normal : eligibles/harmonie globaux).
    const forcedSpecById = new Map();
    (liaisons || []).forEach((l) => {
      if (l && l.tailleImposee && l.tailleImposee.type != null && l.tailleImposee.code != null) {
        const spec = (catalogueFourreaux || []).find(
          (f) => f.type === l.tailleImposee.type && f.code === l.tailleImposee.code
        );
        forcedSpecById.set(l.id, spec || null);
      }
    });
    // Isolée = jamais de partage croisé avec une autre liaison : en harmonie
    // (toutes), ou individuellement pour toute liaison à taille imposée.
    const isIsolated = (liaisonId) => harmonie || forcedSpecById.has(liaisonId);
    // Tailles éligibles pour CETTE liaison : la taille imposée seule (ou
    // aucune, si introuvable au catalogue), sinon le catalogue filtré global.
    const eligiblesFor = (liaisonId) => {
      if (!forcedSpecById.has(liaisonId)) return eligibles;
      const spec = forcedSpecById.get(liaisonId);
      return spec ? [spec] : [];
    };
    const raisonFor = (liaisonId) => {
      if (forcedSpecById.has(liaisonId)) {
        return forcedSpecById.get(liaisonId)
          ? 'câble trop gros pour la taille imposée'
          : 'taille imposée introuvable au catalogue';
      }
      return raisonAucun;
    };

    const open = [];        // { fourreau, cables:[], usedArea, liaisonId }
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
    // Isolée (harmonie, ou taille imposée) : recherche bornée aux fourreaux
    // déjà ouverts pour CETTE liaison — jamais ceux d'une autre.
    const bestOpenFor = (area, liaisonId) => {
      const isolated = isIsolated(liaisonId);
      let best = null;
      for (const o of open) {
        if (isolated && o.liaisonId !== liaisonId) continue;
        if (o.usedArea + area <= capacite(o.fourreau, tauxMax) + EPS && (!best || o.usedArea > best.usedArea)) best = o;
      }
      return best;
    };
    const addTo = (o, cs) => { for (const c of cs) { o.cables.push(c); o.usedArea += c.area; } };
    // Place un bloc (liaison entière, ou noyau phase+neutre) : dans un
    // fourreau ouvert qui a encore de la place (regroupement croisé, sauf si
    // isolée), sinon dans un fourreau neuf dimensionné en anticipant
    // `items[index..]` — parmi les tailles éligibles de CETTE liaison (voir
    // eligiblesFor). Retourne true si placé.
    const tryPlaceBlock = (area, cables, items, index, liaisonId) => {
      const o = bestOpenFor(area, liaisonId);
      if (o) { addTo(o, cables); return true; }
      const f = chooseFourreauSize(items, index, eligiblesFor(liaisonId), tauxMax);
      if (f) { open.push({ fourreau: f, cables: [...cables], usedArea: area, liaisonId }); return true; }
      return false;
    };
    const placeSingle = (c, sorted, index) => {
      const o = bestOpenFor(c.area, c.liaisonId);
      if (o) return addTo(o, [c]);
      const f = chooseFourreauSize(sorted, index, eligiblesFor(c.liaisonId), tauxMax);
      if (f) return open.push({ fourreau: f, cables: [c], usedArea: c.area, liaisonId: c.liaisonId });
      nonPlaces.push({ liaisonId: c.liaisonId, fam: c.fam, code: c.code, od: c.od, raison: raisonFor(c.liaisonId) });
    };
    const placeAll = (arr) => arr.forEach((c, idx) => placeSingle(c, arr, idx));

    for (let i = 0; i < liaisonEntries.length; i++) {
      const L = liaisonEntries[i];
      // 1+2) regroupement croisé (sauf isolée), sinon nouveau fourreau, pour
      // la liaison entière (PE compris). Isolée (harmonie ou taille
      // imposée) : l'anticipation ne porte que sur CETTE liaison ([L] au
      // lieu de toute la file) : le choix de taille ne dépend plus des
      // liaisons voisines.
      const isolatedL = isIsolated(L.id);
      const lookahead = isolatedL ? [L] : liaisonEntries;
      const lookaheadIndex = isolatedL ? 0 : i;
      if (tryPlaceBlock(L.area, L.cables, lookahead, lookaheadIndex, L.id)) continue;

      // 3) La liaison entière (PE compris) ne tient nulle part. Le PE ne
      // transporte pas de courant en régime normal (pas d'échauffement
      // inductif s'il est isolé) et peut donc être détaché sans risque
      // électrique ; les phases et le neutre, eux, doivent rester groupés au
      // maximum. On tente donc le NOYAU phase+neutre comme un bloc avant
      // d'envisager de le scinder, et on place le PE séparément en dernier —
      // il peut retomber dans le même fourreau que le noyau s'il reste de la
      // place, sinon ailleurs.
      const core = L.cables.filter((c) => c.fonction !== 'PE');
      const peUnits = L.cables.filter((c) => c.fonction === 'PE');
      const coreArea = core.reduce((s, c) => s + c.area, 0);
      const sortedPE = [...peUnits].sort((a, b) => (b.area - a.area) || String(a.code).localeCompare(String(b.code)));

      // Anticipe le PE en attente (comme chooseFourreauSize anticipe déjà les
      // liaisons/câbles suivants) en le passant à la suite du noyau, plutôt
      // qu'un dimensionnement du noyau seul qui ne lui laisserait aucune
      // marge. Si tout tenir ensemble (noyau + PE) était possible, l'étape
      // 1/2 aurait déjà réussi ; ici on ne peut donc pas accueillir la
      // totalité du PE, mais laisser de la marge en accueille souvent une
      // partie. Cette anticipation-ci est déjà scopée à la liaison courante
      // (jamais aux voisines), donc inchangée en harmonie.
      if (core.length && !tryPlaceBlock(coreArea, core, [{ area: coreArea }, ...peUnits], 0, L.id)) {
        // Même le noyau phase+neutre ne tient nulle part en bloc : dernier
        // recours, on le scinde câble par câble — en ENTRELAÇANT phases et
        // neutre (pas un tri par taille) pour qu'aucun fourreau ne reçoive
        // que des phases sans leur neutre. Le PE en attente rejoint la MÊME
        // file plutôt qu'une passe séparée après coup : sans ça,
        // chooseFourreauSize ne voit que le reliquat du noyau quand il
        // dimensionne chaque nouveau fourreau, le sous-dimensionne, et force
        // le PE dans des fourreaux à part — plus petits et plus nombreux —
        // alors qu'il aurait pu partager la place restante.
        placeAll([...interleaveCore(core), ...sortedPE]);
      } else if (peUnits.length) {
        placeAll(sortedPE);
      }
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
    __test: { aire, aireInt, capacite, expandCables, eligibleFourreaux, chooseFourreauSize, simulateBinCount, interleaveCore },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CableAssign = api;
})(typeof window !== 'undefined' ? window : globalThis);

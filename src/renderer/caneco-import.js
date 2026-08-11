'use strict';
// BIG BRAIN — import d'un carnet de câbles Caneco (.xls/.xlsx) vers des
// liaisons BIG BRAIN. PUR : ni lecture de fichier ni DOM ici (délégués à
// big-brain-panel.js, façon packer.js) — seulement lignes brutes → brouillons
// de liaisons. Format d'entrée par ligne (sans en-tête, colonnes A-F du
// classeur Caneco) : [origine, nom, longueurM, codeBrut, codeElementaire, familleBrute].
(function (root) {
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  // ── Famille : le texte Caneco ("U1000R2V (90°C)") ne correspond jamais
  // littéralement au nom du catalogue ("U1000 R2V") — on compare une forme
  // normalisée (parenthèses/espaces/tirets retirés, casse ignorée). ──
  function normalizeFamille(s) {
    return String(s || '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[\s-]/g, '')
      .toUpperCase();
  }

  function matchFamille(familleBrute, catalogueFamilies) {
    const target = normalizeFamille(familleBrute);
    if (!target) return null;
    const found = (catalogueFamilies || []).find((f) => normalizeFamille(f) === target);
    return found || null;
  }

  // Comparaison de codes tolérante à virgule/point décimal et aux espaces —
  // le catalogue mélange les deux conventions selon les familles/lignes.
  function normalizeCodeForCompare(code) {
    return String(code || '').replace(/\s/g, '').replace(/,/g, '.').toUpperCase();
  }

  // Cherche un SKU multiconducteur EXACT au catalogue pour cette famille, en
  // essayant les DEUX séparateurs "x" et "G" : le catalogue les utilise de
  // façon interchangeable selon la famille pour désigner la MÊME chose (un
  // câble à N âmes de section S) — ex. U1000 R2V écrit "5x4", H07RN-F écrit
  // "5G4". Un "NGS"/"NxS" Caneco ne devient un câble multiconducteur réel
  // que si l'un des deux existe vraiment pour la famille visée.
  function findMultiSku(n, sectionRaw, fam, catalogue) {
    const candidates = [
      normalizeCodeForCompare(`${n}x${sectionRaw}`),
      normalizeCodeForCompare(`${n}g${sectionRaw}`),
    ];
    const entry = (catalogue || []).find(
      (c) => c.fam === fam && candidates.includes(normalizeCodeForCompare(c.code))
    );
    return entry ? entry.code : null;
  }

  // Parse la colonne "Code câble" (+ "Code élémentaire" en colonne E) d'une
  // ligne Caneco. `fam` doit déjà être la famille RÉSOLUE du catalogue (pas
  // le texte brut Caneco) — nécessaire pour la vérification du SKU multi.
  // Retourne { recognized, mode, parallele, nbConducteurs, codeUnitaire, codeMulti }.
  function parseCode(codeBrut, codeElementaire, fam, catalogue) {
    const code = String(codeBrut || '').trim();
    if (!code) return { recognized: false };

    // NxMx(1xS) — ex. "4X3X(1x400)" : N conducteurs, M en parallèle chacun,
    // section élémentaire en colonne E si renseignée (source la plus fiable),
    // sinon dérivée de la parenthèse. Toujours des conducteurs unipolaires
    // séparés (jamais un câble multiconducteur unique) — vérifié en premier
    // car "4X3X(...)" matcherait sinon partiellement le motif NxS simple.
    let m = code.match(/^(\d+)X(\d+)X\(1[xX]([\d,.]+)\)$/i);
    if (m) {
      const nbConducteurs = parseInt(m[1], 10);
      const parallele = Math.max(1, parseInt(m[2], 10));
      const codeUnitaire = (codeElementaire && String(codeElementaire).trim()) || `1x${m[3]}`;
      return { recognized: true, mode: 'mono', parallele, nbConducteurs, codeUnitaire };
    }

    // NGS ou NxS avec N > 1 — ex. "3G2,5", "5x4" : désignent tous les deux un
    // câble à N âmes de section S. Multiconducteur SI un SKU exact existe
    // pour cette famille au catalogue (le cas courant — voir findMultiSku),
    // sinon replié en N conducteurs unipolaires séparés de section S.
    m = code.match(/^(\d+)[xXgG]([\d,.]+)$/);
    if (m) {
      const nbConducteurs = parseInt(m[1], 10);
      if (nbConducteurs > 1) {
        const sku = findMultiSku(nbConducteurs, m[2], fam, catalogue);
        if (sku) {
          return { recognized: true, mode: 'multi', parallele: 1, nbConducteurs, codeMulti: sku };
        }
      }
      return { recognized: true, mode: 'mono', parallele: 1, nbConducteurs, codeUnitaire: `1x${m[2]}` };
    }

    return { recognized: false };
  }

  // Convention de répartition phase/neutre/PE à l'import (confirmée) :
  // 3→3P, 4→3P+PE, 5→3P+N+PE. Tout autre compte est renvoyé tel quel en
  // "tout phase", marqué incertain — l'utilisateur corrige avant de générer.
  function defaultPhaseSplit(nbConducteurs) {
    if (nbConducteurs === 3) return { nbPhases: 3, neutre: false, pe: false, uncertain: false };
    if (nbConducteurs === 4) return { nbPhases: 3, neutre: false, pe: true, uncertain: false };
    if (nbConducteurs === 5) return { nbPhases: 3, neutre: true, pe: true, uncertain: false };
    return { nbPhases: nbConducteurs, neutre: false, pe: false, uncertain: true };
  }

  // Une ligne "réserve" Caneco (position prévue mais jamais câblée) a une
  // longueur nulle et aucun code câble — rien à importer.
  function isReserve(longueurM, codeBrut) {
    return (!codeBrut || !String(codeBrut).trim()) && num(longueurM, 0) === 0;
  }

  // Transforme UNE ligne brute du carnet en brouillon de liaison BIG BRAIN.
  // row = [origine, nom, longueurM, codeBrut, codeElementaire, familleBrute].
  // catalogueFamilies (optionnel) : familles distinctes déjà dédupliquées —
  // parseWorkbook le calcule UNE fois pour tout le classeur plutôt que de le
  // refaire à chaque ligne (recalculée ici si absente, ex. appel direct
  // depuis les tests).
  function parseRow(row, catalogue, catalogueFamilies) {
    const [, nomRaw, longueurM, codeBrut, codeElementaire, familleBrute] = row || [];
    const nom = String(nomRaw || '').trim() || '(sans nom)';
    const families = catalogueFamilies || [...new Set((catalogue || []).map((c) => c.fam))];

    if (isReserve(longueurM, codeBrut)) {
      return { nom, selectable: false, warning: null, liaison: null };
    }

    const fam = matchFamille(familleBrute, families);
    const codeInfo = parseCode(codeBrut, codeElementaire, fam, catalogue);

    const warnings = [];
    if (!fam) warnings.push('famille non reconnue au catalogue — à choisir manuellement');
    if (!codeInfo.recognized) warnings.push(`code câble « ${codeBrut} » non reconnu — à saisir manuellement`);

    const circuit = { mode: 'mono', fam: fam || '', parallele: 1, nbPhases: 3, neutre: false, pe: false,
      codePhase: '', codeNeutre: '', codePE: '', codeMulti: '' };

    if (codeInfo.recognized && codeInfo.mode === 'multi') {
      circuit.mode = 'multi';
      circuit.codeMulti = codeInfo.codeMulti;
      circuit.parallele = codeInfo.parallele;
    } else if (codeInfo.recognized) {
      const split = defaultPhaseSplit(codeInfo.nbConducteurs);
      circuit.parallele = codeInfo.parallele;
      circuit.nbPhases = split.nbPhases;
      circuit.neutre = split.neutre;
      circuit.pe = split.pe;
      circuit.codePhase = codeInfo.codeUnitaire;
      circuit.codeNeutre = codeInfo.codeUnitaire;
      circuit.codePE = codeInfo.codeUnitaire;
      if (split.uncertain) warnings.push(`${codeInfo.nbConducteurs} conducteurs : répartition phase/neutre/PE à vérifier`);
    }

    return {
      nom,
      selectable: true,
      warning: warnings.length ? warnings.join(' · ') : null,
      liaison: { nom, circuit },
    };
  }

  // Déplie toutes les lignes d'une feuille (déjà extraites par XLSX.utils
  // .sheet_to_json({header:1}) côté DOM) en brouillons, avec leur index de
  // ligne d'origine (pour la sélection dans le panneau).
  function parseWorkbook(rows, catalogue) {
    const catalogueFamilies = [...new Set((catalogue || []).map((c) => c.fam))];
    return (rows || []).map((row, rowIndex) => ({ rowIndex, ...parseRow(row, catalogue, catalogueFamilies) }));
  }

  const api = {
    parseRow,
    parseWorkbook,
    __test: { normalizeFamille, matchFamille, normalizeCodeForCompare, parseCode, defaultPhaseSplit, isReserve },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CanecoImport = api;
})(typeof window !== 'undefined' ? window : globalThis);

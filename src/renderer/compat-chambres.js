'use strict';
// Chambres de tirage compatibles — cœur PUR (aucun DOM, aucun canvas, aucun état
// global muté). Extrait de script.js pour être testable isolément.
// Exposé sur window.CompatChambres (runtime) et module.exports (Jest), à la
// manière de packer.js. Les parties DOM/canvas (render/draw/setup) restent dans
// script.js et délèguent ici.
(function (root) {

  // Reconstruit les modèles de chambres {ref, L (long-pan), l (pignon), H} à
  // partir d'une liste de faces (CHAMBRES_TIRAGE : 2 faces par modèle, colonnes
  // nom/largeur/hauteur).
  function getChamberModels(chambres) {
    const byBase = new Map();
    (chambres || []).forEach(ch => {
      const base = String(ch.nom || '').replace(/\s*(Long-pan|Pignon)\s*$/i, '').trim() || String(ch.nom || '');
      const w = Number(ch.largeur), h = Number(ch.hauteur);
      if (!Number.isFinite(w) || w <= 0) return;
      const cur = byBase.get(base) || { L: 0, l: Infinity, H: 0 };
      cur.L = Math.max(cur.L, w);
      cur.l = Math.min(cur.l, w);
      if (Number.isFinite(h) && h > 0) cur.H = h;
      byBase.set(base, cur);
    });
    return Array.from(byBase.entries())
      .map(([ref, m]) => ({ ref, L: m.L, l: (m.l === Infinity ? m.L : m.l), H: m.H }));
  }

  // Logique :
  //  1) chambre PRÉFORMÉE (StradEasy) : la boîte tient dedans (pignon l >= largeur
  //     ET hauteur H >= hauteur boîte). Une entrée PAR RÉFÉRENCE, triée par marge.
  //  2) sinon : chambre MAÇONNÉE sur mesure + TAMPONS (couvercles) posés dessus.
  //     Le tampon ne couvre que le dessus → on ne raisonne que sur la LARGEUR ;
  //     la hauteur est libre (maçonnerie), donc PAS de filtre hauteur ici.
  function computeCompatibleChambers(models, largeur, hauteur, maxN = 3) {
    models = models || [];

    // 1) Chambres préformées compatibles — une entrée par référence (plusieurs
    //    réfs pouvant partager les mêmes cotes).
    const unit = models
      .filter(m => m.l >= largeur && m.H >= hauteur)
      .map(m => ({ ref: m.ref, l: m.l, H: m.H, marginW: m.l - largeur, marginH: m.H - hauteur }))
      .sort((a, b) => (a.marginW + a.marginH) - (b.marginW + b.marginH) || a.ref.localeCompare(b.ref));

    // 2) Sinon : maçonné sur mesure + tampons (couverture de la largeur)
    let tiling = [];
    if (unit.length === 0) {
      const byL = new Map();
      models.forEach(m => {
        const g = byL.get(m.l) || { l: m.l, refs: [] };
        g.refs.push(m.ref);
        byL.set(m.l, g);
      });
      byL.forEach(g => {
        const N = Math.ceil(largeur / g.l);
        if (N >= 1 && N <= maxN && N * g.l >= largeur) {
          tiling.push({ l: g.l, refs: g.refs.sort(), N, total: N * g.l, margin: N * g.l - largeur });
        }
      });
      tiling.sort((a, b) => (a.margin - b.margin) || (a.N - b.N));
    }
    return { unit, tiling };
  }

  // Schéma chambre unitaire : la boîte (largeur × hauteur) imbriquée dans la
  // chambre (pignon l × hauteur H), ancrée en bas-gauche. Retourne du SVG.
  function buildUnitSchema(W, H, s) {
    if (!s) return '';
    const pad = 4, maxW = 140, maxH = 92;
    const scale = Math.min(maxW / s.l, maxH / s.H);
    const chW = s.l * scale, chH = s.H * scale;
    const bxW = Math.min(W, s.l) * scale, bxH = Math.min(H, s.H) * scale;
    const ox = pad, oy = pad;
    const bx = ox + (chW - bxW) / 2, by = oy + (chH - bxH) / 2;
    const w = Math.max(chW + pad * 2 + 96, 210);
    const h = chH + pad * 2;
    return `<svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" width="100%" role="img">` +
      `<rect x="${ox}" y="${oy}" width="${chW.toFixed(1)}" height="${chH.toFixed(1)}" rx="2" fill="rgba(255,145,77,0.10)" stroke="#ff914d" stroke-width="1.5"/>` +
      `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bxW.toFixed(1)}" height="${bxH.toFixed(1)}" fill="rgba(130,130,130,0.20)" stroke="currentColor" stroke-width="1.2"/>` +
      `<text x="${(ox + chW + 8).toFixed(1)}" y="${(oy + 12)}" font-size="10" fill="#ff914d" font-family="monospace">${s.ref ? s.ref + ' ' : ''}${s.l}×${s.H}</text>` +
      `<text x="${(ox + chW + 8).toFixed(1)}" y="${(oy + 26)}" font-size="10" fill="currentColor" font-family="monospace">boîte ${W}×${H}</text>` +
      `</svg>`;
  }

  // Schéma repli : les N tampons alignés AU-DESSUS de la ligne de largeur boîte.
  function buildTileSchema(W, s) {
    if (!s) return '';
    const pad = 6, w = 276, rowH = 24, gap = 12, labelH = 12;
    const totalMax = Math.max(W, s.total, 1);
    const scale = (w - pad * 2) / totalMax;
    const bw = W * scale;
    const rowY = pad;                 // tampons en haut
    const barY = rowY + rowH + gap;   // ligne boîte en dessous
    const h = barY + labelH + pad;
    let tampons = '';
    for (let i = 0; i < s.N; i++) {
      const x = pad + i * s.l * scale;
      const tw = s.l * scale;
      tampons +=
        `<rect x="${x.toFixed(1)}" y="${rowY}" width="${Math.max(1, tw - 2).toFixed(1)}" height="${rowH}" rx="3" fill="rgba(255,145,77,0.18)" stroke="#ff914d" stroke-width="1.5"/>` +
        `<text x="${(x + tw / 2).toFixed(1)}" y="${(rowY + rowH / 2 + 4)}" font-size="10" fill="#ff914d" text-anchor="middle" font-family="monospace">${s.l}</text>`;
    }
    const boxBar =
      `<line x1="${pad}" y1="${barY}" x2="${(pad + bw).toFixed(1)}" y2="${barY}" stroke="currentColor" stroke-width="1.5"/>` +
      `<line x1="${pad}" y1="${barY - 4}" x2="${pad}" y2="${barY + 4}" stroke="currentColor" stroke-width="1.5"/>` +
      `<line x1="${(pad + bw).toFixed(1)}" y1="${barY - 4}" x2="${(pad + bw).toFixed(1)}" y2="${barY + 4}" stroke="currentColor" stroke-width="1.5"/>` +
      `<text x="${pad}" y="${(barY + labelH + 1)}" font-size="10" fill="currentColor" font-family="monospace">boîte ${W} mm</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${tampons}${boxBar}</svg>`;
  }

  const api = { getChamberModels, computeCompatibleChambers, buildUnitSchema, buildTileSchema };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CompatChambres = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

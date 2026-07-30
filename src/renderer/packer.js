'use strict';
(function (root) {
  const MRP = (typeof module !== 'undefined' && module.exports)
    ? require('maxrects-packer')
    : root.MaxRectsPacker;
  const MaxRectsPacker = MRP.MaxRectsPacker;
  const PACKING_LOGIC  = MRP.PACKING_LOGIC;

  // Défauts à 0 : l'écart (entraxe) et le lit de pose sont réglés par
  // l'utilisateur via le pop-over de la barre de contrôle (gapSlider /
  // litDePoseSlider), qui mute GEO. Doit rester cohérent avec index.html.
  const GEO  = { gap: 0, margin: 0 };
  const OPTS = { smart: true, pot: false, square: false, allowRotation: false, border: 0, logic: PACKING_LOGIC.MAX_EDGE };

  const cell = (d) => d + GEO.gap;

  // Somme des cellules = borne "tout sur une ligne/colonne" (axe non contraint).
  // On l'utilise plutôt qu'une borne infinie : maxrects empaquette différemment
  // selon les bornes, et une borne énorme (1e6) le fait empiler en portrait.
  const span = (tubes) => tubes.reduce((s, t) => s + cell(t.d), 0);

  function sortTubes(tubes) {
    return [...tubes].sort((a, b) => (b.d - a.d) || String(a.id).localeCompare(String(b.id)));
  }

  // Empaquette les cellules dans une boîte (maxW × maxH).
  // Pour étaler en LARGEUR : contraindre maxH, laisser maxW = span.
  // Pour étaler en HAUTEUR : contraindre maxW, laisser maxH = span.
  // Retourne le contenu en Y-up (origine bas-gauche) ; null si ça ne tient pas.
  function packBox(tubes, maxW, maxH) {
    const packer = new MaxRectsPacker(maxW, maxH, 0, OPTS);
    for (const t of tubes) { const c = cell(t.d); packer.add(c, c, { id: t.id, d: t.d }); }
    if (packer.bins.length !== 1) return null; // contenu trop grand pour la contrainte
    const bin = packer.bins[0];
    if (!bin) return null;
    const cw = bin.width, ch = bin.height;
    // maxrects-packer (smart:true) ne fait pas toujours grandir bins.length quand le
    // contenu dépasse la borne demandée sur le 2e axe (observé : un bin peut dépasser
    // maxH tout en restant bins.length===1) : on vérifie donc les dimensions réelles
    // du bin plutôt que de faire confiance à bins.length seul.
    if (cw > maxW + 1e-6 || ch > maxH + 1e-6) return null;
    const placed = bin.rects.map(r => ({
      id: r.data.id, d: r.data.d,
      x: r.x,   // maxrects place les gros en premier près de l'origine
      y: r.y,   // origine = bas-gauche (Y-up) → gros fourreaux posés en bas (gravité)
    }));
    return { cw, ch, placed };
  }

  // Largeur imposée → on étale en hauteur (maxW = innerW).
  function packWidth(tubes, innerW) { return packBox(tubes, innerW, span(tubes)); }
  // Hauteur imposée → on étale en largeur (maxH = innerH).
  function packHeight(tubes, innerH) { return packBox(tubes, span(tubes), innerH); }

  function toLayout(pack, tag, outW, outH) {
    const w = outW != null ? outW : pack.cw + 2 * GEO.margin;
    const h = outH != null ? outH : pack.ch + 2 * GEO.margin;
    const items = pack.placed.map(p => ({ id: p.id, d: p.d, x: GEO.margin + p.x, y: GEO.margin + p.y }));
    const cellArea = items.reduce((s, p) => s + cell(p.d) * cell(p.d), 0);
    return { w, h, items, ratio: w / h, fill: cellArea / (w * h), tag };
  }

  // Tailles candidates (de la plus grande cellule à la somme), N pas fixes → déterministe.
  function candidateSizes(tubes) {
    const cells = tubes.map(t => cell(t.d));
    const lo = Math.max(...cells);
    const hi = cells.reduce((s, c) => s + c, 0);
    if (hi <= lo) return [lo];
    const N = 40, set = new Set();
    for (let i = 0; i <= N; i++) set.add(Math.round(lo + (hi - lo) * i / N));
    return [...set].sort((a, b) => a - b);
  }

  function emptyLayout() {
    return { w: 2 * GEO.margin, h: 2 * GEO.margin, items: [], ratio: 1, fill: 0, tag: 'empty' };
  }

  // Balaye les hauteurs candidates → produit une gamme de layouts (plat → carré).
  function sweepByHeight(list, tag) {
    const out = [];
    for (const ih of candidateSizes(list)) {
      const pk = packHeight(list, ih);
      if (pk) out.push(toLayout(pk, tag, null, null));
    }
    return out;
  }

  // Mode libre : on veut une nappe "tranchée" (large : w >= h), compacte.
  function solveFree(list) {
    const all = sweepByHeight(list, 'compact');
    if (!all.length) return emptyLayout();
    // Idéal tranchée : 1 <= ratio <= 2 (ni portrait, ni trop plat) ; sinon w >= h ; sinon tout.
    const good = all.filter(L => L.ratio >= 1 && L.ratio <= 2);
    const wide = all.filter(L => L.w >= L.h);
    const pool = good.length ? good : (wide.length ? wide : all);
    return pool.reduce((best, L) => (L.fill > best.fill ? L : best));
  }

  function solve(tubes, opts) {
    const list = sortTubes(tubes);
    if (list.length === 0) return emptyLayout();
    const lock = (opts && opts.lock) || null;
    if (lock === 'w') {
      const pk = packWidth(list, opts.w - 2 * GEO.margin);
      return pk ? toLayout(pk, 'locked', opts.w, null) : emptyLayout();
    }
    if (lock === 'h') {
      const pk = packHeight(list, opts.h - 2 * GEO.margin);
      return pk ? toLayout(pk, 'locked', null, opts.h) : emptyLayout();
    }
    return solveFree(list);
  }

  function variants(tubes, opts) {
    const list = sortTubes(tubes);
    if (list.length === 0) return [];
    if (opts && opts.lock) return [solve(tubes, opts)];

    const all = sweepByHeight(list, '');
    if (!all.length) return [];

    const pickMax = (arr, f) => arr.reduce((b, L) => (f(L) > f(b) ? L : b));
    const pickMin = (arr, f) => arr.reduce((b, L) => (f(L) < f(b) ? L : b));

    const wide = all.filter(L => L.w >= L.h);
    const out = [];
    // compact : meilleure compacité parmi les layouts "tranchée" (w >= h), sinon global
    out.push({ ...pickMax(wide.length ? wide : all, L => L.fill), tag: 'compact' });
    // tranchee : ratio proche de 1.4 (large équilibré)
    if (wide.length) out.push({ ...pickMin(wide, L => Math.abs(L.ratio - 1.4)), tag: 'tranchee' });
    // rect43 : ratio proche de 4/3
    out.push({ ...pickMin(all, L => Math.abs(L.ratio - 4 / 3)), tag: 'rect43' });

    const seen = new Set();
    return out.filter(L => {
      const k = `${Math.round(L.w)}x${Math.round(L.h)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // Ancre un layout (Y-up, origine bas-gauche) dans une boîte existante et
  // convertit en positions canvas (Y-down, centres des cercles, en mm).
  // La boîte GARDE ses dimensions ; un axe libre n'est agrandi que si la nappe
  // ne tient pas. La nappe est posée au FOND (lit de pose) et centrée en largeur.
  // box = { w, h, lockW, lockH } → { w, h, positions: [{id, d, x, y}] }
  function anchorLayout(cfg, box) {
    const round5 = (v) => Math.ceil(v / 5) * 5;
    let maxX = 0, maxY = 0;
    for (const it of cfg.items) {
      const c = cell(it.d);
      if (it.x + c > maxX) maxX = it.x + c;
      if (it.y + c > maxY) maxY = it.y + c;
    }
    const hasItems = cfg.items.length > 0;
    const contentW = hasItems ? maxX + GEO.margin : 0;
    const contentH = hasItems ? maxY + GEO.margin : 0;
    const w = box.lockW ? box.w : Math.max(box.w, round5(contentW));
    const h = box.lockH ? box.h : Math.max(box.h, round5(contentH));
    const offsetX = Math.max(0, (w - contentW) / 2);
    const positions = cfg.items.map(it => {
      const c = cell(it.d);
      const yUp = it.y + c / 2; // centre en repère moteur (Y=0 en bas)
      return { id: it.id, d: it.d, x: offsetX + it.x + c / 2, y: h - yUp, yUp };
    });
    return { w, h, positions };
  }

  const api = {
    GEO, cell, solve, variants, anchorLayout,
    __test: { sortTubes, packWidth, packHeight, packAt: packWidth, toLayout, candidateSizes },
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants; root.anchorLayout = anchorLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);

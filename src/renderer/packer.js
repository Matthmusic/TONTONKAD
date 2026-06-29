'use strict';
(function (root) {
  const MRP = (typeof module !== 'undefined' && module.exports)
    ? require('maxrects-packer')
    : root.MaxRectsPacker;
  const MaxRectsPacker = MRP.MaxRectsPacker;
  const PACKING_LOGIC  = MRP.PACKING_LOGIC;

  const GEO  = { gap: 30, margin: 40 };
  const EDGE = 1e6; // borne "infinie" pour l'axe libre
  const OPTS = { smart: true, pot: false, square: false, allowRotation: false, border: 0, logic: PACKING_LOGIC.MAX_EDGE };

  const cell = (d) => d + GEO.gap;

  function sortTubes(tubes) {
    return [...tubes].sort((a, b) => (b.d - a.d) || String(a.id).localeCompare(String(b.id)));
  }

  // Pack des cellules dans une largeur intérieure ; retourne contenu en Y-up.
  function packAt(tubes, innerW) {
    const packer = new MaxRectsPacker(innerW, EDGE, 0, OPTS);
    for (const t of tubes) { const c = cell(t.d); packer.add(c, c, { id: t.id, d: t.d }); }
    const bin = packer.bins[0];
    if (!bin) return null;
    const cw = bin.width, ch = bin.height;
    const placed = bin.rects.map(r => ({
      id: r.data.id, d: r.data.d,
      x: r.x,                  // maxrects : origine haut-gauche, y vers le bas
      y: ch - r.y - r.height,  // flip vers Y-up
    }));
    return { cw, ch, placed };
  }

  function toLayout(pack, tag, outW, outH) {
    const w = outW != null ? outW : pack.cw + 2 * GEO.margin;
    const h = outH != null ? outH : pack.ch + 2 * GEO.margin;
    const items = pack.placed.map(p => ({ id: p.id, d: p.d, x: GEO.margin + p.x, y: GEO.margin + p.y }));
    const cellArea = items.reduce((s, p) => s + cell(p.d) * cell(p.d), 0);
    return { w, h, items, ratio: w / h, fill: cellArea / (w * h), tag };
  }

  function candidateWidths(tubes) {
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

  function solveLockedHeight(list, H) {
    const innerH = H - 2 * GEO.margin;
    let best = null;
    for (const iw of candidateWidths(list)) {
      const pack = packAt(list, iw);
      if (!pack || pack.ch > innerH) continue;
      const L = toLayout(pack, 'locked', null, H);
      if (!best || L.w < best.w) best = L;
    }
    if (!best) {
      const widths = candidateWidths(list);
      best = toLayout(packAt(list, widths[widths.length - 1]), 'locked', null, H);
    }
    return best;
  }

  function solveFree(list) {
    const all = candidateWidths(list)
      .map(iw => { const p = packAt(list, iw); return p ? toLayout(p, 'compact', null, null) : null; })
      .filter(Boolean);
    if (!all.length) return emptyLayout();
    const tranchee = all.filter(L => L.w >= L.h);
    const pool = tranchee.length ? tranchee : all;
    return pool.reduce((best, L) => (L.fill > best.fill ? L : best));
  }

  function solve(tubes, opts) {
    const list = sortTubes(tubes);
    if (list.length === 0) return emptyLayout();
    const lock = opts && opts.lock || null;
    if (lock === 'w') return toLayout(packAt(list, opts.w - 2 * GEO.margin), 'locked', opts.w, null);
    if (lock === 'h') return solveLockedHeight(list, opts.h);
    return solveFree(list); // implémenté en Task 5
  }

  function variants(tubes, opts) { throw new Error('not implemented'); }

  const api = { GEO, cell, solve, variants, __test: { sortTubes, packAt, toLayout, candidateWidths } };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants;
  }
})(typeof window !== 'undefined' ? window : globalThis);

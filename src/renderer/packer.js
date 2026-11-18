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
  const EPS  = 1e-6; // tolérance flottante pour les comparaisons de dimensions

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
  // stable=false : gravité seule (rapide), pour le balayage ; la stabilisation
  // complète n'est faite que sur le(s) layout(s) retenu(s), voir finalize().
  function packBox(tubes, maxW, maxH, stable = true) {
    const packer = new MaxRectsPacker(maxW, maxH, 0, OPTS);
    for (const t of tubes) { const c = cell(t.d); packer.add(c, c, { id: t.id, d: t.d }); }
    if (packer.bins.length !== 1) return null; // contenu trop grand pour la contrainte
    const bin = packer.bins[0];
    if (!bin) return null;
    // maxrects-packer (smart:true) ne fait pas toujours grandir bins.length quand le
    // contenu dépasse la borne demandée sur le 2e axe (observé : un bin peut dépasser
    // maxH tout en restant bins.length===1) : on vérifie donc les dimensions réelles
    // du bin plutôt que de faire confiance à bins.length seul.
    if (bin.width > maxW + EPS || bin.height > maxH + EPS) return null;
    const placed = settle(bin.rects.map(r => ({
      id: r.data.id, d: r.data.d,
      x: r.x,   // maxrects place les gros en premier près de l'origine
      y: r.y,   // origine = bas-gauche (Y-up) → gros fourreaux posés en bas (gravité)
    })), maxW, maxH, stable);
    let cw = 0, ch = 0;
    for (const p of placed) {
      const c = cell(p.d);
      if (p.x + c > cw) cw = p.x + c;
      if (p.y + c > ch) ch = p.y + c;
    }
    return { cw, ch, placed };
  }

  // Gravité : maxrects remplit des trous rectangulaires sans regarder ce qu'il
  // y a dessous, d'où des fourreaux « en l'air » (rien sous eux sur toute leur
  // largeur). On les fait descendre un par un, du bas vers le haut, jusqu'au
  // premier appui (fourreau déjà posé dont la cellule recouvre leur largeur, ou
  // le lit de pose). Ne fait que descendre → aucun chevauchement créé, et la
  // hauteur de la nappe ne peut que diminuer.
  function settle(placed, maxW = Infinity, maxH = Infinity, stable = true) {
    const order = [...placed].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const done = [];
    for (const p of order) {
      const c = cell(p.d);
      let y = 0;
      for (const q of done) {
        const cq = cell(q.d);
        if (q.x < p.x + c - EPS && q.x + cq > p.x + EPS && q.y + cq > y) y = q.y + cq;
      }
      p.y = y;
      done.push(p);
    }
    return stable ? stabilize(placed, maxW, maxH) : placed;
  }

  const overlapX = (a, ca, b, cb) => a.x < b.x + cb - EPS && b.x < a.x + ca - EPS;
  const overlap  = (a, ca, b, cb) => overlapX(a, ca, b, cb) && a.y < b.y + cb - EPS && b.y < a.y + ca - EPS;

  // Stable = posé sur le lit de pose, ou appuyé de part et d'autre de son
  // centre (un appui sous le centre compte des deux côtés). Un fourreau posé
  // sur la seule arête d'un voisin roulerait : il n'est pas stable.
  function isStable(p, others) {
    if (p.y <= EPS) return true;
    const c = cell(p.d), cx = p.x + c / 2;
    let left = false, right = false;
    for (const q of others) {
      const cq = cell(q.d);
      if (q === p || Math.abs(q.y + cq - p.y) > EPS || !overlapX(p, c, q, cq)) continue;
      if (q.x < cx - EPS) left = true;
      if (q.x + cq > cx + EPS) right = true;
    }
    return left && right;
  }

  // Déplace chaque fourreau instable vers la position stable la plus basse
  // (puis la plus proche) dans l'emprise actuelle de la nappe. S'il n'y en a
  // aucune, on accepte d'élargir/rehausser la nappe dans la limite de la boîte
  // (maxW × maxH) ; sinon il reste où il est.
  function stabilize(placed, maxW = Infinity, maxH = Infinity) {
    let W = 0, H = 0;
    for (const p of placed) { const c = cell(p.d); W = Math.max(W, p.x + c); H = Math.max(H, p.y + c); }
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      const order = [...placed].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      for (const p of order) {
        if (isStable(p, placed)) continue;
        const c = cell(p.d);
        const others = placed.filter(q => q !== p);
        const xs = new Set([0, W - c, W]);
        for (const q of others) { const cq = cell(q.d); xs.add(q.x); xs.add(q.x + cq); xs.add(q.x + cq - c); xs.add(q.x - c); xs.add(q.x + cq / 2 - c / 2); }
        let best = null;
        for (const [lw, lh] of [[W, H], [maxW, maxH]]) {
        if (best) break;
        for (const x of xs) {
          if (x < -EPS || x + c > lw + EPS) continue;
          const ys = new Set([0]);
          for (const q of others) { const cq = cell(q.d); if (overlapX({ x }, c, q, cq)) ys.add(q.y + cq); }
          for (const y of [...ys].sort((a, b) => a - b)) {
            if (y > p.y + EPS || y + c > lh + EPS) break;
            if (best && (y > best.y + EPS || (Math.abs(y - best.y) <= EPS && Math.abs(x - p.x) >= Math.abs(best.x - p.x)))) break;
            const cand = { x, y, d: p.d };
            if (others.some(q => overlap(cand, c, q, cell(q.d)))) continue;
            if (!isStable(cand, others)) continue;
            best = { x, y };
            break;
          }
        }
        }
        if (best) {
          p.x = best.x; p.y = best.y; changed = true;
          W = Math.max(W, p.x + c); H = Math.max(H, p.y + c);
        }
      }
      if (!changed) break;
      // Ce qui reposait sur un fourreau déplacé peut maintenant descendre.
      const order2 = [...placed].sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const done = [];
      for (const p of order2) {
        const c = cell(p.d);
        let y = 0;
        for (const q of done) { const cq = cell(q.d); if (overlapX(p, c, q, cq) && q.y + cq > y) y = q.y + cq; }
        p.y = y; done.push(p);
      }
    }
    return placed;
  }

  // Largeur imposée → on étale en hauteur (maxW = innerW).
  function packWidth(tubes, innerW) { return packBox(tubes, innerW, span(tubes)); }
  // Hauteur imposée → on étale en largeur (maxH = innerH).
  function packHeight(tubes, innerH, stable = true) { return packBox(tubes, span(tubes), innerH, stable); }

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
      const pk = packHeight(list, ih, false);
      if (pk) out.push({ ...toLayout(pk, tag, null, null), ih });
    }
    return out;
  }

  // Refait le layout retenu par le balayage avec la stabilisation complète.
  function finalize(list, L) {
    if (L.ih == null) return L;
    const pk = packHeight(list, L.ih, true);
    if (!pk) return L;
    const { ih, ...rest } = L;
    return { ...rest, ...toLayout(pk, L.tag, null, null) };
  }

  // Mode libre : on veut une nappe "tranchée" (large : w >= h), compacte.
  function solveFree(list) {
    const all = sweepByHeight(list, 'compact');
    if (!all.length) return emptyLayout();
    // Idéal tranchée : 1 <= ratio <= 2 (ni portrait, ni trop plat) ; sinon w >= h ; sinon tout.
    const good = all.filter(L => L.ratio >= 1 && L.ratio <= 2);
    const wide = all.filter(L => L.w >= L.h);
    const pool = good.length ? good : (wide.length ? wide : all);
    return finalize(list, pool.reduce((best, L) => (L.fill > best.fill ? L : best)));
  }

  function solve(tubes, opts) {
    const list = sortTubes(tubes);
    if (list.length === 0) return emptyLayout();
    if (opts && opts.shape === 'circ') return solveCircle(list);
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
    if (opts && opts.lock && opts.shape !== 'circ') return [solve(tubes, opts)];

    const all = sweepByHeight(list, '');
    if (!all.length) return [];

    const pickMin = (arr, f) => arr.reduce((b, L) => (f(L) < f(b) ? L : b));

    const wide = all.filter(L => L.w >= L.h);
    const out = [];
    // compact : le même layout que solve() en mode libre — la carte « compact »
    // du panneau doit correspondre à ce qui est posé par défaut.
    out.push({ ...solveFree(list), tag: 'compact' });
    // tranchee : ratio proche de 1.4 (large équilibré)
    if (wide.length) out.push(finalize(list, { ...pickMin(wide, L => Math.abs(L.ratio - 1.4)), tag: 'tranchee' }));
    // rect43 : ratio proche de 4/3
    out.push(finalize(list, { ...pickMin(all, L => Math.abs(L.ratio - 4 / 3)), tag: 'rect43' }));

    const seen = new Set();
    return out.filter(L => {
      const k = `${Math.round(L.w)}x${Math.round(L.h)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // ── Conduit circulaire ────────────────────────────────────────────────
  // Un layout rectangulaire ne tient PAS dans le cercle de diamètre max(w, h) :
  // les fourreaux des coins dépassent. On calcule le vrai diamètre requis :
  // D = 2·(max des |centre fourreau − centre| + cellule/2) + 2·lit de pose,
  // le centre étant optimisé (problème convexe : recherche par motif).
  function circleFit(items) {
    if (!items.length) return { D: 2 * GEO.margin, cx: 0, cy: 0 };
    const pts = items.map(it => { const c = cell(it.d); return { x: it.x + c / 2, y: it.y + c / 2, r: c / 2 }; });
    const radius = (cx, cy) => pts.reduce((m, p) => Math.max(m, Math.hypot(p.x - cx, p.y - cy) + p.r), 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x - p.r); x1 = Math.max(x1, p.x + p.r);
      y0 = Math.min(y0, p.y - p.r); y1 = Math.max(y1, p.y + p.r);
    }
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, best = radius(cx, cy);
    let step = Math.max(x1 - x0, y1 - y0) / 4;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (step > 0.05) {
      let moved = false;
      for (const [dx, dy] of dirs) {
        const r = radius(cx + dx * step, cy + dy * step);
        if (r < best - EPS) { best = r; cx += dx * step; cy += dy * step; moved = true; break; }
      }
      if (!moved) step /= 2;
    }
    return { D: 2 * (best + GEO.margin), cx, cy };
  }

  // Meilleur layout pour un conduit circulaire : celui qui minimise D.
  function solveCircle(list) {
    const all = sweepByHeight(list, 'cercle');
    if (!all.length) return emptyLayout();
    let best = null;
    for (const L of all) {
      const D = circleFit(L.items).D;
      if (!best || D < best.D - EPS) best = { L, D };
    }
    const L = finalize(list, best.L);
    best.D = circleFit(L.items).D;
    const cellArea = L.items.reduce((s, p) => s + cell(p.d) * cell(p.d), 0);
    return { ...L, w: best.D, h: best.D, ratio: 1, fill: cellArea / (Math.PI * best.D * best.D / 4), tag: 'cercle' };
  }

  // Ancrage dans un conduit circulaire de diamètre box.w (= box.h) : nappe
  // centrée sur le centre optimal ; le diamètre n'est agrandi que si besoin.
  function anchorCircle(cfg, box) {
    const round5 = (v) => Math.ceil(v / 5) * 5;
    const locked = !!(box.lockW || box.lockH);
    const boxD = Math.max(box.w || 0, box.h || 0);
    let items = cfg.items;
    let fit = circleFit(items);
    // Diamètre verrouillé dépassé : on retente avec le layout optimal pour un cercle.
    if (items.length && locked && fit.D > boxD + EPS) {
      const alt = solveCircle(sortTubes(items.map(it => ({ id: it.id, d: it.d }))));
      const altFit = circleFit(alt.items);
      if (altFit.D < fit.D) { items = alt.items; fit = altFit; }
    }
    const D = (locked && fit.D <= boxD + EPS) ? boxD : Math.max(boxD, round5(fit.D));
    const positions = items.map(it => {
      const c = cell(it.d);
      const yUp = D / 2 + (it.y + c / 2 - fit.cy);
      return { id: it.id, d: it.d, x: D / 2 + (it.x + c / 2 - fit.cx), y: D - yUp, yUp };
    });
    return { w: D, h: D, positions };
  }

  // Bornes (Y-up, marge incluse) de la nappe la plus à droite / en haut.
  function contentBounds(items) {
    let maxX = 0, maxY = 0;
    for (const it of items) {
      const c = cell(it.d);
      if (it.x + c > maxX) maxX = it.x + c;
      if (it.y + c > maxY) maxY = it.y + c;
    }
    const hasItems = items.length > 0;
    return { contentW: hasItems ? maxX + GEO.margin : 0, contentH: hasItems ? maxY + GEO.margin : 0 };
  }

  // Ancre un layout (Y-up, origine bas-gauche) dans une boîte existante et
  // convertit en positions canvas (Y-down, centres des cercles, en mm).
  // La boîte GARDE ses dimensions ; un axe libre n'est agrandi que si la nappe
  // ne tient pas. La nappe est posée au FOND (lit de pose) et centrée en largeur.
  // box = { w, h, lockW, lockH, shape? } → { w, h, positions: [{id, d, x, y}] }
  // shape === 'circ' : conduit circulaire (diamètre = w = h), voir anchorCircle.
  function anchorLayout(cfg, box) {
    if (box.shape === 'circ') return anchorCircle(cfg, box);
    const round5 = (v) => Math.ceil(v / 5) * 5;
    let items = cfg.items;
    let { contentW, contentH } = contentBounds(items);

    // Un axe VERROUILLÉ doit contenir la nappe. Si cfg vient d'un layout LIBRE
    // plus grand (ex. une variante choisie alors qu'un axe est verrouillé sur
    // une boîte plus étroite), la nappe ne rentre pas dans la boîte affichée :
    // on recalcule le placement pour respecter la boîte plutôt que de garder
    // des positions qui déborderaient (fourreaux dessinés hors du chemin de
    // câble, sans aucun signal).
    if (items.length && ((box.lockW && contentW > box.w + EPS) || (box.lockH && contentH > box.h + EPS))) {
      const tubes = sortTubes(items.map((it) => ({ id: it.id, d: it.d })));
      let pk = null;
      if (box.lockW && box.lockH) pk = packBox(tubes, box.w - 2 * GEO.margin, box.h - 2 * GEO.margin);
      else if (box.lockW) pk = packWidth(tubes, box.w - 2 * GEO.margin);
      else pk = packHeight(tubes, box.h - 2 * GEO.margin);
      if (pk) {
        items = toLayout(pk, cfg.tag, box.lockW ? box.w : null, box.lockH ? box.h : null).items;
        ({ contentW, contentH } = contentBounds(items));
      }
      // Sinon (même un placement dédié à cette boîte ne tient pas — ex. un seul
      // fourreau plus gros que l'axe verrouillé) : on ne perd pas les fourreaux
      // pour autant, ils restent visibles au prix d'un dépassement de CET axe
      // (fitsW/fitsH ci-dessous retombent alors sur la croissance normale).
    }

    const fitsW = contentW <= box.w + EPS;
    const fitsH = contentH <= box.h + EPS;
    const w = (box.lockW && fitsW) ? box.w : Math.max(box.w, round5(contentW));
    const h = (box.lockH && fitsH) ? box.h : Math.max(box.h, round5(contentH));
    const offsetX = Math.max(0, (w - contentW) / 2);
    const positions = items.map(it => {
      const c = cell(it.d);
      const yUp = it.y + c / 2; // centre en repère moteur (Y=0 en bas)
      return { id: it.id, d: it.d, x: offsetX + it.x + c / 2, y: h - yUp, yUp };
    });
    return { w, h, positions };
  }

  const api = {
    GEO, cell, solve, variants, anchorLayout,
    __test: { sortTubes, packWidth, packHeight, packAt: packWidth, toLayout, candidateSizes, settle, isStable, circleFit },
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants; root.anchorLayout = anchorLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
(function (root) {
  // ─── Moteur de placement des fourreaux ─────────────────────────────────
  //
  // Boîte / tranchée rectangulaire : rangement PAR GROUPES DE DIAMÈTRE.
  //   Les fourreaux d'un même diamètre forment un bloc compact (grille, la
  //   rangée incomplète en haut et centrée). Les blocs sont posés du plus gros
  //   diamètre au plus petit, chacun à l'endroit le plus bas possible, sur le
  //   fond ou bien à plat sur un bloc déjà posé (centré dessus). On balaie la
  //   largeur pour choisir la forme de la nappe.
  //
  // Conduit circulaire : pas d'écart entre fourreaux, rangement en nid
  //   d'abeille (chaque fourreau vient se loger contre deux autres, au plus
  //   près du centre). Une grille carrée est aussi essayée : on garde celle
  //   qui donne le plus petit diamètre.
  //
  // Repère moteur : Y=0 en bas (Y-up), origine bas-gauche, en mm.

  // Défauts à 0 : l'écart (bord à bord) et le lit de pose sont réglés par
  // l'utilisateur via le pop-over de la barre de contrôle (gapSlider /
  // litDePoseSlider), qui mute GEO. Doit rester cohérent avec index.html.
  const GEO = { gap: 0, margin: 0 };
  const EPS = 1e-6; // tolérance flottante pour les comparaisons de dimensions

  const cell = (d) => d + GEO.gap;
  const span = (tubes) => tubes.reduce((s, t) => s + cell(t.d), 0);

  function sortTubes(tubes) {
    return [...tubes].sort((a, b) => (b.d - a.d) || String(a.id).localeCompare(String(b.id)));
  }

  // ─── Rectangle : blocs par diamètre sur une ligne d'horizon ────────────

  function groupsOf(list) {
    const groups = [];
    for (const t of list) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(g.d - t.d) < EPS) g.tubes.push(t);
      else groups.push({ d: t.d, tubes: [t] });
    }
    return groups;
  }

  // Ligne d'horizon : segments contigus [x, x+w) de hauteur y, couvrant [0, W).
  function skyHeight(sky, x0, x1) {
    let h = 0, flat = true, first = null;
    for (const s of sky) {
      if (s.x + s.w <= x0 + EPS || s.x >= x1 - EPS) continue;
      if (first === null) first = s.y;
      else if (Math.abs(s.y - first) > EPS) flat = false;
      if (s.y > h) h = s.y;
    }
    return { h, flat };
  }

  function skyRaise(sky, x0, x1, y) {
    const out = [];
    for (const s of sky) {
      const a = s.x, b = s.x + s.w;
      if (b <= x0 + EPS || a >= x1 - EPS) { out.push(s); continue; }
      if (a < x0 - EPS) out.push({ x: a, w: x0 - a, y: s.y });
      const lo = Math.max(a, x0), hi = Math.min(b, x1);
      out.push({ x: lo, w: hi - lo, y: Math.max(s.y, y) });
      if (b > x1 + EPS) out.push({ x: x1, w: b - x1, y: s.y });
    }
    // fusion des voisins de même hauteur
    const merged = [];
    for (const s of out) {
      const p = merged[merged.length - 1];
      if (p && Math.abs(p.y - s.y) < EPS && Math.abs(p.x + p.w - s.x) < EPS) p.w += s.w;
      else merged.push({ ...s });
    }
    return merged;
  }

  // Positions candidates pour un bloc de largeur bw : bords de chaque
  // segment, et centre de chaque plateau (suite de segments de même hauteur).
  function candidateXs(sky, bw, W) {
    const xs = new Set([0, W - bw]);
    for (let i = 0; i < sky.length; i++) {
      const s = sky[i];
      xs.add(s.x); xs.add(s.x + s.w - bw);
      let j = i, end = s.x + s.w;
      while (j + 1 < sky.length && Math.abs(sky[j + 1].y - s.y) < EPS) { j++; end = sky[j].x + sky[j].w; }
      xs.add(s.x + (end - s.x - bw) / 2);
    }
    return [...xs].filter(x => x > -EPS && x + bw < W + EPS).map(x => Math.max(0, x));
  }

  // Centre du plateau qui porte un bloc posé en [x, x+bw) à la hauteur y.
  function plateauCenter(sky, x, bw, y) {
    let lo = x, hi = x + bw;
    for (const s of sky) if (Math.abs(s.y - y) < EPS && s.x <= lo + EPS && s.x + s.w >= lo - EPS) lo = Math.min(lo, s.x);
    // étend à gauche / à droite tant que la hauteur est la même
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of sky) {
        if (Math.abs(s.y - y) > EPS) continue;
        if (Math.abs(s.x + s.w - lo) < EPS) { lo = s.x; changed = true; }
        if (Math.abs(s.x - hi) < EPS) { hi = s.x + s.w; changed = true; }
        if (s.x < hi - EPS && s.x + s.w > hi + EPS) { hi = s.x + s.w; changed = true; }
      }
    }
    return (lo + hi) / 2;
  }

  // Place tous les groupes dans une largeur W (et une hauteur maxH).
  // Retourne { cw, ch, placed } en Y-up sans marge, ou null.
  function groupLayout(list, W, maxH = Infinity) {
    let sky = [{ x: 0, w: W, y: 0 }];
    const placed = [];
    for (const g of groupsOf(list)) {
      const c = cell(g.d), n = g.tubes.length;
      const maxCols = Math.min(n, Math.floor(W / c + EPS));
      if (maxCols < 1) return null;
      let best = null;
      for (const pass of [true, false]) { // 1er passage : seulement à plat
        for (let cols = 1; cols <= maxCols; cols++) {
          const rows = Math.ceil(n / cols), bw = cols * c, bh = rows * c;
          for (const x of candidateXs(sky, bw, W)) {
            const { h: y, flat } = skyHeight(sky, x, x + bw);
            if (pass && !flat) continue;
            if (y + bh > maxH + EPS) continue;
            // posé sur un bloc : on préfère être centré sur le plateau
            const off = y > EPS ? Math.abs(x + bw / 2 - plateauCenter(sky, x, bw, y)) : x;
            const key = [y + bh, y, off, cols];
            if (!best || lexLess(key, best.key)) {
              best = { key, x, y, cols, rows, bw, bh };
            }
          }
        }
        if (best) break;
      }
      if (!best) return null;
      // tubes du bloc : rangées pleines en bas, rangée incomplète en haut, centrée
      let k = 0;
      for (let r = 0; r < best.rows; r++) {
        const inRow = r < best.rows - 1 ? best.cols : n - best.cols * (best.rows - 1);
        const offset = (best.cols - inRow) * c / 2;
        for (let i = 0; i < inRow; i++) {
          const t = g.tubes[k++];
          placed.push({ id: t.id, d: t.d, x: best.x + offset + i * c, y: best.y + r * c });
        }
      }
      // l'horizon suit chaque colonne (la rangée incomplète laisse des creux)
      for (const p of placed.slice(placed.length - n)) sky = skyRaise(sky, p.x, p.x + c, p.y + c);
    }
    settle(placed, W, maxH);
    let cw = 0, ch = 0;
    for (const p of placed) {
      const c = cell(p.d);
      if (p.x + c > cw) cw = p.x + c;
      if (p.y + c > ch) ch = p.y + c;
    }
    if (ch > maxH + EPS) return null;
    return { cw, ch, placed };
  }

  function lexLess(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i] - EPS) return true;
      if (a[i] > b[i] + EPS) return false;
    }
    return false;
  }

  // Gravité de sécurité : un fourreau sans rien dessous descend jusqu'au
  // premier appui. Avec des blocs posés à plat il ne se passe rien ; ça ne
  // sert que si un bloc a dû être posé sur un horizon inégal.
  function settle(placed, maxW = Infinity, maxH = Infinity) {
    const order = [...placed].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const done = [];
    for (const p of order) {
      const c = cell(p.d);
      let y = 0;
      for (const q of done) {
        const cq = cell(q.d);
        if (overlapX(p, c, q, cq) && q.y + cq > y) y = q.y + cq;
      }
      p.y = y;
      done.push(p);
    }
    return stabilize(placed, maxW, maxH);
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
  // (puis la plus proche) dans l'emprise actuelle ; à défaut dans la limite
  // de la boîte (maxW × maxH) ; sinon il reste où il est.
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

  // Largeur imposée → la nappe monte autant que nécessaire.
  function packWidth(tubes, innerW) { return groupLayout(tubes, innerW, Infinity); }
  // Hauteur imposée → la nappe la plus ÉTROITE qui tient dans cette hauteur.
  function packHeight(tubes, innerH) {
    let best = null;
    for (const w of candidateSizes(tubes)) {
      const pk = groupLayout(tubes, w, innerH);
      if (pk && (!best || pk.cw < best.cw - EPS)) best = pk;
    }
    return best;
  }
  function packBox(tubes, innerW, innerH) { return groupLayout(tubes, innerW, innerH); }

  function toLayout(pack, tag, outW, outH) {
    const w = outW != null ? outW : pack.cw + 2 * GEO.margin;
    const h = outH != null ? outH : pack.ch + 2 * GEO.margin;
    const items = pack.placed.map(p => ({ id: p.id, d: p.d, x: GEO.margin + p.x, y: GEO.margin + p.y }));
    const cellArea = items.reduce((s, p) => s + cell(p.d) * cell(p.d), 0);
    return { w, h, items, ratio: w / h, fill: cellArea / (w * h), tag };
  }

  // Tailles candidates (de la plus grande cellule à la somme), pas fixes → déterministe.
  function candidateSizes(tubes) {
    const cells = tubes.map(t => cell(t.d));
    const lo = Math.max(...cells);
    const hi = cells.reduce((s, c) => s + c, 0);
    if (hi <= lo) return [lo];
    const N = 40, set = new Set();
    for (let i = 0; i <= N; i++) set.add(Math.round(lo + (hi - lo) * i / N));
    // largeurs « justes » : k cellules du plus gros diamètre
    for (let k = 1; k * lo <= hi; k++) set.add(k * lo);
    return [...set].sort((a, b) => a - b);
  }

  function emptyLayout() {
    return { w: 2 * GEO.margin, h: 2 * GEO.margin, items: [], ratio: 1, fill: 0, tag: 'empty' };
  }

  // Balaye les largeurs candidates → une gamme de layouts (haut → plat).
  function sweep(list, tag) {
    const out = [], seen = new Set();
    for (const w of candidateSizes(list)) {
      const pk = groupLayout(list, w);
      if (!pk) continue;
      const L = toLayout(pk, tag, null, null);
      const k = `${Math.round(L.w)}x${Math.round(L.h)}|` + L.items.map(i => `${Math.round(i.x)},${Math.round(i.y)}`).join(';');
      if (seen.has(k)) continue;
      seen.add(k); out.push(L);
    }
    return out;
  }

  // Mode libre : nappe "tranchée" (large : w >= h), compacte.
  function solveFree(list) {
    const all = sweep(list, 'compact');
    if (!all.length) return emptyLayout();
    const good = all.filter(L => L.ratio >= 1 && L.ratio <= 2);
    const wide = all.filter(L => L.w >= L.h);
    const pool = good.length ? good : (wide.length ? wide : all);
    return pool.reduce((best, L) => (L.fill > best.fill + EPS ? L : best));
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
    if (opts && opts.shape === 'circ') return [solveCircle(list)];
    if (opts && opts.lock) return [solve(tubes, opts)];

    const all = sweep(list, '');
    if (!all.length) return [];
    const pickMin = (arr, f) => arr.reduce((b, L) => (f(L) < f(b) - EPS ? L : b));
    const wide = all.filter(L => L.w >= L.h);
    const out = [];
    // compact : le même layout que solve() — la carte « compact » du panneau
    // doit correspondre à ce qui est posé par défaut.
    out.push({ ...solveFree(list), tag: 'compact' });
    if (wide.length) out.push({ ...pickMin(wide, L => Math.abs(L.ratio - 1.4)), tag: 'tranchee' });
    out.push({ ...pickMin(all, L => Math.abs(L.ratio - 4 / 3)), tag: 'rect43' });

    const seen = new Set();
    return out.filter(L => {
      const k = `${Math.round(L.w)}x${Math.round(L.h)}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // ─── Conduit circulaire : nid d'abeille, sans écart ────────────────────

  // Plus petit cercle (centre optimisé) contenant des disques {x, y, r}.
  function enclose(pts) {
    if (!pts.length) return { R: 0, cx: 0, cy: 0 };
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
    return { R: best, cx, cy };
  }

  // Glouton : chaque fourreau (du plus gros au plus petit) se loge contre deux
  // fourreaux déjà posés, à la place qui agrandit le moins l'ensemble.
  function honeycomb(list) {
    const P = [];
    for (const t of list) {
      const r = t.d / 2;
      if (!P.length) { P.push({ id: t.id, d: t.d, x: 0, y: 0, r }); continue; }
      const cands = [];
      if (P.length === 1) cands.push({ x: P[0].r + r, y: 0 });
      for (let i = 0; i < P.length; i++) {
        for (let j = i + 1; j < P.length; j++) {
          const A = P[i], B = P[j];
          const ra = A.r + r, rb = B.r + r;
          const dx = B.x - A.x, dy = B.y - A.y, dd = Math.hypot(dx, dy);
          if (dd > ra + rb + EPS || dd < Math.abs(ra - rb) - EPS || dd < EPS) continue;
          const a = (ra * ra - rb * rb + dd * dd) / (2 * dd);
          const h = Math.sqrt(Math.max(0, ra * ra - a * a));
          const mx = A.x + a * dx / dd, my = A.y + a * dy / dd;
          cands.push({ x: mx + h * dy / dd, y: my - h * dx / dd }, { x: mx - h * dy / dd, y: my + h * dx / dd });
        }
      }
      // repère : centre de gravité (pondéré par la surface) des fourreaux posés
      let sw = 0, gx = 0, gy = 0;
      for (const p of P) { const w = p.r * p.r; sw += w; gx += p.x * w; gy += p.y * w; }
      gx /= sw; gy /= sw;
      let best = null;
      for (const c of cands) {
        if (P.some(p => Math.hypot(p.x - c.x, p.y - c.y) < p.r + r - 1e-4)) continue;
        const ext = Math.hypot(c.x - gx, c.y - gy) + r;
        if (!best || ext < best.ext - EPS || (Math.abs(ext - best.ext) <= EPS && (c.y < best.c.y - EPS || (Math.abs(c.y - best.c.y) <= EPS && c.x < best.c.x)))) best = { c, ext };
      }
      if (!best) { // ne devrait pas arriver : on pose à l'extérieur
        const R = enclose(P).R;
        best = { c: { x: R + r, y: 0 } };
      }
      P.push({ id: t.id, d: t.d, x: best.c.x, y: best.c.y, r });
    }
    return P;
  }

  // Grille carrée sans écart (meilleure que le nid d'abeille pour 4 fourreaux
  // identiques, par exemple) : on balaie les largeurs.
  function squareGrids(list) {
    const saved = GEO.gap;
    GEO.gap = 0;
    try {
      return sweep(list, '').map(L => L.items.map(it => ({ id: it.id, d: it.d, x: it.x + it.d / 2, y: it.y + it.d / 2, r: it.d / 2 })));
    } finally { GEO.gap = saved; }
  }

  function solveCircle(list) {
    if (!list.length) return emptyLayout();
    let best = null;
    for (const pts of [honeycomb(list), ...squareGrids(list)]) {
      const e = enclose(pts);
      if (!best || e.R < best.e.R - EPS) best = { pts, e };
    }
    const D = 2 * (best.e.R + GEO.margin);
    const items = best.pts.map(p => ({ id: p.id, d: p.d, cx: p.x - best.e.cx, cy: p.y - best.e.cy }));
    const area = items.reduce((s, p) => s + Math.PI * p.d * p.d / 4, 0);
    return { w: D, h: D, ratio: 1, fill: area / (Math.PI * D * D / 4), tag: 'cercle', circle: true, items };
  }

  // Ancrage dans un conduit circulaire de diamètre box.w (= box.h) : ensemble
  // centré ; le diamètre n'est agrandi que si besoin. Un layout rectangulaire
  // reçu ici est recalculé pour le cercle.
  function anchorCircle(cfg, box) {
    const round5 = (v) => Math.ceil(v / 5) * 5;
    if (!cfg.circle) cfg = solveCircle(sortTubes(cfg.items.map(it => ({ id: it.id, d: it.d }))));
    const locked = !!(box.lockW || box.lockH);
    const boxD = Math.max(box.w || 0, box.h || 0);
    const need = cfg.items.length ? cfg.w : 0;
    const D = (locked && need <= boxD + EPS) ? boxD : Math.max(boxD, round5(need));
    const positions = cfg.items.map(it => {
      const yUp = D / 2 + it.cy;
      return { id: it.id, d: it.d, x: D / 2 + it.cx, y: D - yUp, yUp };
    });
    return { w: D, h: D, positions };
  }

  // ─── Ancrage dans une boîte rectangulaire ──────────────────────────────

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
    let items = cfg.circle ? [] : cfg.items;
    if (cfg.circle) {
      cfg = solveFree(sortTubes(cfg.items.map(it => ({ id: it.id, d: it.d }))));
      items = cfg.items;
    }
    let { contentW, contentH } = contentBounds(items);

    // Un axe VERROUILLÉ doit contenir la nappe : sinon on recalcule le
    // placement pour cette boîte plutôt que de dessiner hors du chemin de câble.
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
      // Sinon (ex. un seul fourreau plus gros que l'axe verrouillé) : les
      // fourreaux restent visibles au prix d'un dépassement de CET axe.
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
    __test: { sortTubes, packWidth, packHeight, packAt: packWidth, toLayout, candidateSizes, settle, isStable, groupLayout, honeycomb, enclose },
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PACKER = api;
    root.GEO = GEO; root.cell = cell; root.solve = solve; root.variants = variants; root.anchorLayout = anchorLayout;
  }
})(typeof window !== 'undefined' ? window : globalThis);

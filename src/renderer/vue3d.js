'use strict';
// Vues 3D des masques (perspective cavalière, matières texturées) en
// opérateurs PDF bruts — PUR, sans DOM : partagé par l'export PDF de
// l'application (jsPDF, via internal.write) et par le serveur MCP.
// Exposé sur window.Vue3D et module.exports.
// Coordonnées en points PDF, origine en bas à gauche de la page.
(function (root) {
const PAGE_W = 842, PAGE_H = 595, MARGE = 36; // A4 paysage, en points
const K = 0.5522847498; // approximation d'un quart de cercle en Bézier
const PHASE_RGB = { L1: [0.55, 0.3, 0.1], L2: [0.1, 0.1, 0.1], L3: [0.5, 0.5, 0.5], N: [0.1, 0.3, 0.8], PE: [0.1, 0.6, 0.2], PEN: [0.1, 0.3, 0.8] };
const GRILLAGE_RGB = { rouge: [0.85, 0.1, 0.1], vert: [0.1, 0.6, 0.2], bleu: [0.1, 0.3, 0.8], jaune: [0.9, 0.75, 0], marron: [0.5, 0.3, 0.1] };

// Texte PDF en WinAnsi : on garde le latin-1, on remplace le reste.
const WINANSI = { '\u2014': '\x97', '\u2013': '\x96', '\u2026': '\x85', '\u2022': '\x95', '\u2019': '\x92', '\u20AC': '\x80' };
const pdfStr = (s) => '(' + String(s).replace(/\u2192/g, '->').replace(/\u2265/g, '>=').replace(/[\u2014\u2013\u2026\u2022\u2019\u20AC]/g, (c) => WINANSI[c]).replace(/[^\x20-\x7E\x80-\x97\u00A0-\u00FF]/g, '?')
  .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
const f = (v) => (Math.round(v * 100) / 100).toString();

class Page {
  // emitText=false : les textes ne sont pas écrits dans le flux (polices
  // inconnues de l'hôte, ex. jsPDF) mais rendus via `labels` par l'appelant.
  // ombre=false : pas d'état graphique de transparence (/GS1) requis.
  constructor({ emitText = true, ombre = true } = {}) { this.ops = []; this.labels = []; this.emitText = emitText; this.ombre = ombre; this.fill = [0, 0, 0]; }
  rgb(c, stroke = true) { if (!stroke) this.fill = c; this.ops.push(`${c.map(f).join(' ')} ${stroke ? 'RG' : 'rg'}`); return this; }
  width(w) { this.ops.push(`${f(w)} w`); return this; }
  dash(on) { this.ops.push(on ? '[3 2] 0 d' : '[] 0 d'); return this; }
  line(x1, y1, x2, y2) { this.ops.push(`${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S`); return this; }
  rect(x, y, w, h, mode = 'S') { this.ops.push(`${f(x)} ${f(y)} ${f(w)} ${f(h)} re ${mode}`); return this; }
  poly(pts, mode = 'S') { this.ops.push(pts.map(([x, y], i) => `${f(x)} ${f(y)} ${i ? 'l' : 'm'}`).join(' ') + ` h ${mode}`); return this; }
  circle(cx, cy, r, mode = 'S') {
    const k = r * K;
    this.ops.push(`${f(cx + r)} ${f(cy)} m ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c `
      + `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c `
      + `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c `
      + `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c ${mode}`);
    return this;
  }
  text(x, y, size, s, { bold = false, align = 'left' } = {}) {
    this.labels.push({ x, y, size, text: String(s), bold, align, rgb: this.fill });
    if (!this.emitText) return this;
    // largeur approximative Helvetica (0.5 em / caractère) pour centrer / aligner à droite
    const w = String(s).length * size * 0.5;
    const dx = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${f(x + dx)} ${f(y)} Td ${pdfStr(s)} Tj ET`);
    return this;
  }
  // Dessine fn() à l'intérieur du polygone seulement.
  clip(pts, fn) {
    this.ops.push('q', pts.map(([x, y], i) => `${f(x)} ${f(y)} ${i ? 'l' : 'm'}`).join(' ') + ' h W n');
    fn(); this.ops.push('Q'); return this;
  }
  // Polygone rempli d'une matière : fond + grains aléatoires (graine fixe → même rendu).
  texture(pts, base, { grains = 0.35, taille = 0.9, contraste = 0.12, seed = 1, contour = null } = {}) {
    this.rgb(base, false).poly(pts, 'f');
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const n = Math.min(1800, Math.round((x1 - x0) * (y1 - y0) * grains / 10));
    let r = seed * 9301 + 49297;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    this.clip(pts, () => {
      for (let k = 0; k < n; k++) {
        const d = (rnd() - 0.5) * 2 * contraste;
        this.rgb(base.map((c) => Math.max(0, Math.min(1, c + d))), false);
        const t = taille * (0.4 + rnd());
        this.ops.push(`${f(x0 + rnd() * (x1 - x0))} ${f(y0 + rnd() * (y1 - y0))} ${f(t)} ${f(t)} re f`);
      }
    });
    if (contour) this.rgb(contour).poly(pts, 'S');
    return this;
  }
  // Cylindre ombré de a (face avant) vers b (arrière) : bandes de teinte
  // (reflet en haut à gauche), extrémité avant creuse.
  cylindre(ax, ay, bx, by, r, ri, base) {
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const n = [-(by - ay) / len, (bx - ax) / len]; // normale à l'axe
    const shade = (k) => base.map((c) => Math.max(0, Math.min(1, c * k + (k > 1 ? (k - 1) * 0.6 : 0))));
    this.rgb(shade(0.55), false).circle(bx, by, r, 'f');
    const K = 14;
    for (let i = 0; i < K; i++) {
      const t0 = -1 + 2 * i / K, t1 = -1 + 2 * (i + 1) / K, tm = (t0 + t1) / 2;
      const light = 0.55 + 0.75 * Math.max(0, Math.cos((tm - 0.45) * 1.4)); // reflet décalé
      const q = (t) => [n[0] * t * r, n[1] * t * r];
      const [p0x, p0y] = q(t0), [p1x, p1y] = q(t1);
      this.rgb(shade(light), false).poly([[ax + p0x, ay + p0y], [bx + p0x, by + p0y], [bx + p1x, by + p1y], [ax + p1x, ay + p1y]], 'f');
    }
    this.rgb(shade(0.45)).width(0.4);
    this.line(ax + n[0] * r, ay + n[1] * r, bx + n[0] * r, by + n[1] * r).line(ax - n[0] * r, ay - n[1] * r, bx - n[0] * r, by - n[1] * r);
    // face avant : couronne claire + intérieur sombre (creux)
    this.rgb(shade(1.15), false).circle(ax, ay, r, 'B');
    this.rgb([0.18, 0.16, 0.15], false).circle(ax, ay, ri, 'f');
    this.rgb([0.32, 0.29, 0.27], false).circle(ax + r * 0.08, ay - r * 0.08, ri * 0.82, 'f');
    return this;
  }
  toString() { return this.ops.join('\n'); }
}

// Matières (RVB 0-1)
const MAT = {
  terre: [0.52, 0.39, 0.27], sable: [0.86, 0.77, 0.56], beton: [0.72, 0.71, 0.68],
  betonClair: [0.80, 0.79, 0.76], betonSombre: [0.62, 0.61, 0.58], tpc: [0.80, 0.14, 0.10],
  surface: { chaussee: [0.30, 0.30, 0.32], trottoir: [0.68, 0.66, 0.62], espace_vert: [0.38, 0.58, 0.28], prive: [0.55, 0.62, 0.40] },
};

// Échelle qui fait tenir une boîte (mm) dans un cadre (pt).
const fit = (wMm, hMm, wPt, hPt) => Math.min(wPt / wMm, hPt / hMm);

function drawCoupe(p, m, x0, y0, wPt, hPt) {
  const top = m.tranchee ? m.tranchee.profondeur : m.hauteur;
  const s = fit(m.largeur, top, wPt, hPt);
  const ox = x0 + (wPt - m.largeur * s) / 2, oy = y0;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;
  p.rgb([0, 0, 0]).width(1);
  if (m.forme === 'circ') p.circle(X(m.largeur / 2), Y(m.largeur / 2), m.largeur / 2 * s);
  else {
    p.rgb([0.96, 0.93, 0.85], false).rect(X(0), Y(0), m.largeur * s, top * s, 'B');
    if (m.tranchee) {
      p.rgb([0.6, 0.6, 0.6]).width(0.5).dash(true).line(X(0), Y(m.hauteur), X(m.largeur), Y(m.hauteur)).dash(false);
      const g = m.tranchee.grillage;
      p.rgb(GRILLAGE_RGB[g.couleur] || [0.85, 0.1, 0.1]).width(1.5).line(X(10), Y(g.y), X(m.largeur - 10), Y(g.y));
      p.rgb([0, 0, 0]).rgb([0, 0, 0], false);
      p.text(X(m.largeur) + 4, Y(g.y) - 3, 7, `grillage ${g.couleur}`);
    }
  }
  for (const fo of m.fourreaux) {
    p.rgb([1, 1, 1], false).rgb([0.85, 0.4, 0.05]).width(1).circle(X(fo.x), Y(fo.y), fo.od / 2 * s, 'B');
    p.width(0.5).circle(X(fo.x), Y(fo.y), fo.di / 2 * s);
    p.rgb([0, 0, 0], false).text(X(fo.x), Y(fo.y + fo.od / 2) + 2, 7, fo.id, { align: 'center', bold: true });
  }
  for (const c of m.cables) {
    p.rgb(PHASE_RGB[c.phase] || [0.2, 0.2, 0.2]).width(0.6).circle(X(c.x), Y(c.y), c.od / 2 * s);
  }
  // cotes
  p.rgb([0.8, 0, 0], false);
  p.text(X(m.largeur / 2), oy - 12, 8, m.forme === 'circ' ? `Ø ${m.largeur} mm` : `L = ${m.largeur} mm`, { align: 'center' });
  if (m.forme !== 'circ') p.text(X(0) - 4, Y(top / 2), 8, `P = ${top} mm`, { align: 'right' });
  p.rgb([0, 0, 0], false);
  return s;
}

// Vue 3D cavalière : la coupe est la face avant, le tronçon file vers
// l'arrière en haut à droite. Les cercles restent des cercles (face avant
// parallèle au plan du dessin) : un cylindre = cercle arrière + cercle avant
// + deux génératrices tangentes.
function draw3D(p, m, x0, y0, wPt, hPt, longueurMm) {
  const top = m.tranchee ? m.tranchee.profondeur : m.hauteur;
  const ang = Math.PI / 6, red = 0.5; // 30°, réduction 0.5 sur la fuyante
  const dx = Math.cos(ang) * red * longueurMm, dy = Math.sin(ang) * red * longueurMm;
  // bloc de terre autour de la tranchée : 35 % de largeur de chaque côté, 18 % sous le fond
  const MG = m.forme === 'circ' ? 0 : 0.35, SG = m.forme === 'circ' ? 0 : 0.18;
  const s = fit(m.largeur * (1 + 2 * MG) + dx, top * (1 + SG) + dy, wPt, hPt);
  const ox = x0 + (wPt - (m.largeur * (1 + 2 * MG) + dx) * s) / 2 + m.largeur * MG * s, oy = y0 + top * SG * s;
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;
  const ex = dx * s, ey = dy * s;
  const W = m.largeur * s, H = top * s;

  p.width(0.7);
  if (m.forme === 'circ') {
    const r = m.largeur / 2 * s, cx = X(m.largeur / 2), cy = Y(m.largeur / 2), n = [-Math.sin(ang), Math.cos(ang)];
    p.rgb([0, 0, 0]).circle(cx + ex, cy + ey, r);
    p.line(cx + n[0] * r, cy + n[1] * r, cx + n[0] * r + ex, cy + n[1] * r + ey);
    p.line(cx - n[0] * r, cy - n[1] * r, cx - n[0] * r + ex, cy - n[1] * r + ey);
  } else {
    // terrain coupé : bloc de terre autour de la tranchée, vu de face et de dessus
    const M = W * MG, sol = H * SG;                    // marge de terre autour (pt)
    const x0 = X(0), y0 = Y(0), lit = (m.reglages.litDePose || 0) * s;
    const surf = MAT.surface[(m.tranchee && m.tranchee.zone) || 'trottoir'] || MAT.surface.trottoir;
    // dessus du terrain (gauche et droite de la tranchée)
    p.texture([[x0 - M, y0 + H], [x0 - M + ex, y0 + H + ey], [x0 + ex, y0 + H + ey], [x0, y0 + H]], surf, { seed: 3, contraste: 0.08 });
    p.texture([[x0 + W, y0 + H], [x0 + W + ex, y0 + H + ey], [x0 + W + M + ex, y0 + H + ey], [x0 + W + M, y0 + H]], surf, { seed: 4, contraste: 0.08 });
    // fond et paroi droite intérieurs de la tranchée (terre), lit de sable au fond
    p.texture([[x0 + W, y0], [x0 + W + ex, y0 + ey], [x0 + W + ex, y0 + H + ey], [x0 + W, y0 + H]], MAT.terre.map((c) => c * 0.85), { seed: 5 });
    p.texture([[x0, y0], [x0 + ex, y0 + ey], [x0 + W + ex, y0 + ey], [x0 + W, y0]], MAT.sable, { seed: 6, taille: 0.7 });
    if (lit > 0) p.texture([[x0 + W, y0], [x0 + W + ex, y0 + ey], [x0 + W + ex, y0 + ey + lit], [x0 + W, y0 + lit]], MAT.sable.map((c) => c * 0.92), { seed: 7, taille: 0.7 });
    // face avant coupée du terrain (avec le trou de la tranchée)
    p.texture([[x0 - M, y0 - sol], [x0 + W + M, y0 - sol], [x0 + W + M, y0 + H], [x0 + W, y0 + H], [x0 + W, y0], [x0, y0], [x0, y0 + H], [x0 - M, y0 + H]], MAT.terre, { seed: 8, contour: [0.3, 0.22, 0.15] });
    p.texture([[x0, y0], [x0 + W, y0], [x0 + W, y0 - Math.min(lit, sol)], [x0, y0 - Math.min(lit, sol)]], MAT.sable, { seed: 9, taille: 0.7 });
    p.rgb([0.3, 0.22, 0.15]).width(0.6).line(x0 + W, y0, x0 + W + ex, y0 + ey).line(x0 + W + ex, y0 + ey, x0 + W + ex, y0 + H + ey);
    if (m.tranchee) {
      const g = m.tranchee.grillage;
      p.rgb(GRILLAGE_RGB[g.couleur] || [0.85, 0.1, 0.1], false).rgb(GRILLAGE_RGB[g.couleur] || [0.85, 0.1, 0.1]).width(0.4);
      const gy = Y(g.y);
      p.poly([[X(10), gy], [X(10) + ex, gy + ey], [X(m.largeur - 10) + ex, gy + ey], [X(m.largeur - 10), gy]], 'S');
      for (let t = 0.1; t < 1; t += 0.1) p.line(X(10) + ex * t, gy + ey * t, X(m.largeur - 10) + ex * t, gy + ey * t);
    }
  }
  // fourreaux, du fond vers l'avant-plan (les plus hauts et les plus à droite d'abord)
  const n = [-Math.sin(ang), Math.cos(ang)];
  const order = [...m.fourreaux].sort((a, b) => (b.y - a.y) || (b.x - a.x));
  for (const fo of order) {
    const r = fo.od / 2 * s, cx = X(fo.x), cy = Y(fo.y);
    void n;
    p.cylindre(cx, cy, cx + ex, cy + ey, r, fo.di / 2 * s, MAT.tpc);
  }
  for (const c of m.cables) {
    p.rgb(PHASE_RGB[c.phase] || [0.25, 0.25, 0.25], false).rgb([0, 0, 0]).width(0.3).circle(X(c.x), Y(c.y), Math.max(0.6, c.od / 2 * s), 'B');
  }
  p.rgb([0, 0, 0], false);
}


// Chambre de tirage : volume intérieur + parois/tampons indicatifs, face
// d'entrée au premier plan avec les fourreaux du masque.
// zone = cadre (pt) où tenir le dessin : zx, zy (coin bas-gauche), zw, zh.
function drawChambre3D(p, m, zx, zy, zw, zh) {
  const ch = m.chambre;
  const Fw = ch.face.largeur, Hu = ch.face.hauteur, D = ch.profondeur;
  const inf = ch.infos || {};
  const H = Hu + (inf.reserveHauteur || 0); // hauteur intérieure totale (indicative)
  const e = inf.paroi || 0;                  // épaisseur de paroi (indicative)
  const ang = Math.PI / 6, red = 0.5;
  const cx = Math.cos(ang) * red, cy = Math.sin(ang) * red;
  const sortie = Math.max(400, D * 0.6); // longueur de fourreau dessinée hors chambre
  const minX = -sortie * cx - e, maxX = Fw + e + (D + e) * cx, minY = -sortie * cy, maxY = H + (D + e) * cy;
  const s = fit(maxX - minX, maxY - minY, zw, zh);
  const ox = zx + (zw - (maxX - minX) * s) / 2 - minX * s, oy = zy - minY * s;
  // projection : (x sur la face, y hauteur, z profondeur vers l'arrière)
  const P = (x, y, z) => [ox + (x + z * cx) * s, oy + (y + z * cy) * s];

  // béton : extérieur (paroi droite, dessus des parois), puis intérieur
  const cont = [0.35, 0.35, 0.33];
  if (e) {
    p.texture([P(Fw + e, 0, 0), P(Fw + e, 0, D + e), P(Fw + e, H, D + e), P(Fw + e, H, 0)], MAT.betonSombre, { seed: 11, contour: cont });
    // couronne du dessus (tranche des parois autour de l'ouverture)
    p.texture([P(-e, H, 0), P(Fw + e, H, 0), P(Fw + e, H, D + e), P(-e, H, D + e)], MAT.betonClair, { seed: 12, contour: cont });
  }
  p.texture([P(0, 0, 0), P(Fw, 0, 0), P(Fw, 0, D), P(0, 0, D)], MAT.betonSombre, { seed: 13, contour: cont });
  p.texture([P(0, 0, 0), P(0, 0, D), P(0, H, D), P(0, H, 0)], MAT.beton, { seed: 14, contour: cont });
  p.texture([P(0, 0, D), P(Fw, 0, D), P(Fw, H, D), P(0, H, D)], MAT.betonClair, { seed: 15, contour: cont });
  // ombre portée dans l'angle du radier
  if (p.ombre) {
    p.rgb([0, 0, 0], false).ops.push('q /GS1 gs');
    p.poly([P(0, 0, 0), P(Fw * 0.25, 0, 0), P(Fw * 0.25, 0, D), P(0, 0, D)], 'f');
    p.ops.push('Q');
  }
  // tranche des parois coupées sur la face d'entrée (béton en coupe)
  if (e) {
    p.texture([P(-e, 0, 0), P(0, 0, 0), P(0, H, 0), P(-e, H, 0)], MAT.betonSombre.map((c) => c * 0.9), { seed: 16, contour: cont });
    p.texture([P(Fw, 0, 0), P(Fw + e, 0, 0), P(Fw + e, H, 0), P(Fw, H, 0)], MAT.betonSombre.map((c) => c * 0.9), { seed: 17, contour: cont });
  }
  p.width(0.8).rgb(cont);
  // arêtes restantes (paroi droite, ouverture haute en tirets = tampon)
  p.line(...P(Fw, 0, 0), ...P(Fw, H, 0)).line(...P(Fw, H, 0), ...P(Fw, H, D));
  p.dash(true).poly([P(0, H, 0), P(Fw, H, 0), P(Fw, H, D), P(0, H, D)], 'S').dash(false);

  // hauteur utile TONTONKAD (sous cadre + tampon) en tirets
  if (H > Hu) {
    p.rgb([0.2, 0.4, 0.8]).width(0.6).dash(true).poly([P(0, Hu, 0), P(Fw, Hu, 0), P(Fw, Hu, D), P(0, Hu, D)], 'S').dash(false);
  }
  // tampons : l'ouverture du dessus partagée en N le long de la grande longueur
  if (inf.tampons > 1) {
    p.rgb([0.35, 0.35, 0.35]).width(0.5);
    for (let k = 1; k < inf.tampons; k++) {
      if (ch.entree === 'pignon') p.line(...P(0, H, D * k / inf.tampons), ...P(Fw, H, D * k / inf.tampons));
      else p.line(...P(Fw * k / inf.tampons, H, 0), ...P(Fw * k / inf.tampons, H, D));
    }
  }
  // parois (épaisseur indicative) : contour extérieur
  if (e) {
    p.rgb([0.45, 0.45, 0.45]).width(0.6);
    p.poly([P(-e, 0, 0), P(Fw + e, 0, 0), P(Fw + e, H, 0), P(-e, H, 0)], 'S');
    p.line(...P(Fw + e, 0, 0), ...P(Fw + e, 0, D + e)).line(...P(Fw + e, 0, D + e), ...P(Fw + e, H, D + e));
    p.line(...P(Fw + e, H, 0), ...P(Fw + e, H, D + e)).line(...P(Fw + e, H, D + e), ...P(-e, H, D + e)).line(...P(-e, H, D + e), ...P(-e, H, 0));
  }
  // face d'entrée (au premier plan) avec les réservations des fourreaux
  const dxNappe = (Fw - m.largeur) / 2;
  const fx = (f) => dxNappe + f.x;
  p.rgb([0.15, 0.15, 0.15]).width(1.2).poly([P(0, 0, 0), P(Fw, 0, 0), P(Fw, H, 0), P(0, H, 0)], 'S');
  // fourreaux : du fond vers l'avant-plan, ils sortent vers le spectateur
  const order = [...m.fourreaux].sort((a, b) => (b.y - a.y) || (b.x - a.x));
  for (const f of order) {
    const r = f.od / 2 * s, [ax, ay] = P(fx(f), f.y, 0), [bx, by] = P(fx(f), f.y, -sortie);
    const n = [-Math.sin(ang) * r, Math.cos(ang) * r];
    void n;
    p.cylindre(bx, by, ax, ay, r, f.di / 2 * s, MAT.tpc);
    p.rgb([0, 0, 0], false).text(bx, by - r - 9, 7, f.id, { align: 'center', bold: true });
  }
  for (const c of m.cables) {
    const f = m.fourreaux.find((x) => x.id === c.fourreau);
    const [bx, by] = P(dxNappe + c.x, c.y, -sortie);
    p.rgb(PHASE_RGB[c.phase] || [0.25, 0.25, 0.25], false).rgb([0, 0, 0]).width(0.3).circle(bx, by, Math.max(0.6, c.od / 2 * s), 'B');
    void f;
  }
  // cotes
  p.rgb([0.8, 0, 0], false);
  const [a1x, a1y] = P(Fw / 2, 0, 0);
  p.text(a1x, a1y - 34, 8, `${ch.entree === 'pignon' ? 'pignon' : 'long-pan'} ${Fw} mm (intérieur)`, { align: 'center' });
  const [a2x, a2y] = P(0, H / 2, 0);
  p.text(a2x - 6 - e * s, a2y, 8, H > Hu ? `H ${H} mm (utile ${Hu})` : `H ${H} mm`, { align: 'right' });
  const [a3x, a3y] = P(Fw, 0, D / 2);
  p.text(a3x + 6, a3y - 4, 8, `${D} mm`);
  p.rgb([0, 0, 0], false);

}

// Vue de dessus 2D d'une chambre à plusieurs faces (étude chambre-faces.js).
// masques = { pignonA?: masque, … } (fourreaux avec x en mm le long de la face).
// Repère plan : x le long du long-pan (0 → L), y le long du pignon (0 → l).
const estPignonCle = (k) => k.startsWith('pignon');
const COUL_LIAISON = [[0.85, 0.33, 0.1], [0.13, 0.45, 0.8], [0.2, 0.6, 0.25], [0.6, 0.25, 0.65], [0.85, 0.6, 0.05], [0.1, 0.6, 0.65], [0.55, 0.35, 0.2], [0.8, 0.2, 0.45]];
// Coupe posée en miroir sur une face de chambre ? La coupe d'un tronçon se lit
// dans le sens départ → arrivée, x vers la droite du sens de marche. Le sens de
// marche sort par la face au départ, y entre à l'arrivée. Repère de la vue de
// dessus : y vers le haut ; pignons le long de y, long-pans le long de x.
const NORMALE_FACE = { pignonA: [-1, 0], pignonB: [1, 0], longPanA: [0, -1], longPanB: [0, 1] };
function coupeEnMiroir(face, sens) {
  const n = NORMALE_FACE[face];
  if (!n || (sens !== 'depart' && sens !== 'arrivee')) return false;
  const d = sens === 'depart' ? n : [-n[0], -n[1]];
  const droite = [d[1], -d[0]], tangente = face.startsWith('pignon') ? [0, 1] : [1, 0];
  return droite[0] * tangente[0] + droite[1] * tangente[1] < 0;
}

function drawChambreDessus(p, etude, masques, zx, zy, zw, zh) {
  const L = etude.L, l = etude.l, e = (etude.infos && etude.infos.paroi) || 0, sortie = 350;
  const ext = e + sortie + 60;
  const s = fit(L + 2 * ext, l + 2 * ext, zw, zh);
  const ox = zx + (zw - (L + 2 * ext) * s) / 2 + ext * s, oy = zy + (zh - (l + 2 * ext) * s) / 2 + ext * s;
  const P = (x, y) => [ox + x * s, oy + y * s];
  p.geoDessus = { ox, oy, s, L, l, e }; // pour retrouver une face à partir d'un clic
  // terrain autour, parois en béton, intérieur
  p.texture([P(-ext + 40, -ext + 40), P(L + ext - 40, -ext + 40), P(L + ext - 40, l + ext - 40), P(-ext + 40, l + ext - 40)], [0.9, 0.86, 0.78], { seed: 21, contraste: 0.05 });
  if (e) p.texture([P(-e, -e), P(L + e, -e), P(L + e, l + e), P(-e, l + e)], MAT.beton, { seed: 22, contour: [0.3, 0.3, 0.3] });
  p.rgb([0.97, 0.97, 0.96], false).rgb([0.2, 0.2, 0.2]).width(e ? 0.6 : 2).poly([P(0, 0), P(L, 0), P(L, l), P(0, l)], 'B');
  // tampons (séparations) le long de L
  const nt = etude.infos && etude.infos.tampons, tp = etude.infos && etude.infos.tampon;
  if (tp && nt) {
    // chambre maçonnée : ouvertures réelles des tampons, réparties le long de L
    const a = Math.min(Math.max(tp.L, tp.l), L / nt), b = Math.min(Math.min(tp.L, tp.l), l);
    p.rgb([0.45, 0.45, 0.45]).width(0.6).dash(true);
    for (let k = 0; k < nt; k++) { const cx = L * (k + 0.5) / nt; p.poly([P(cx - a / 2, (l - b) / 2), P(cx + a / 2, (l - b) / 2), P(cx + a / 2, (l + b) / 2), P(cx - a / 2, (l + b) / 2)], 'S'); }
    p.dash(false);
    p.rgb([0.35, 0.35, 0.35], false).text(...P(L / 2, l - 40).map((v, i) => i ? v - 9 : v), 7, `${nt} tampon(s) ${tp.L}×${tp.l} ${tp.classe} — paroi ${e} mm (à valider)`, { align: 'center' });
  } else if (nt > 1) { p.rgb([0.6, 0.6, 0.6]).width(0.4).dash(true); for (let k = 1; k < nt; k++) p.line(...P(L * k / nt, 0), ...P(L * k / nt, l)); p.dash(false); }

  // géométrie d'une face : point le long du mur, normale vers l'intérieur
  const faceGeo = {
    pignonA: { long: l, at: (t) => [0, t], n: [1, 0], out: [-1, 0] },
    pignonB: { long: l, at: (t) => [L, t], n: [-1, 0], out: [1, 0] },
    longPanA: { long: L, at: (t) => [t, 0], n: [0, 1], out: [0, -1] },
    longPanB: { long: L, at: (t) => [t, l], n: [0, -1], out: [0, 1] },
  };
  const couleur = new Map();
  [...etude.traversees.map((t) => t.liaison), ...etude.arrets.map((a) => a.liaison)].forEach((n, i) => couleur.set(n, COUL_LIAISON[i % COUL_LIAISON.length]));
  const ancre = {}; // ancre[face][liaison] = point intérieur moyen

  for (const k of Object.keys(faceGeo)) {
    const mq = masques[k];
    if (!mq) continue;
    const g = faceGeo[k], off = (g.long - mq.largeur) / 2;
    // Une coupe se lit dans le sens de son tronçon (départ → arrivée), x vers la
    // droite du sens de marche. Sur une face, le sens de marche sort de la chambre
    // si le tronçon part d'ici, y entre s'il arrive : selon l'orientation de la
    // face, la coupe est posée telle quelle ou en miroir (vue de dos).
    const miroir = coupeEnMiroir(k, mq.sens);
    ancre[k] = {};
    const vus = new Set();
    for (const f of mq.fourreaux) {
      const t = off + (miroir ? mq.largeur - f.x : f.x), [bx, by] = g.at(t);
      const r = f.od / 2;
      // tube vu de dessus : bande de largeur od, du dehors jusqu'à 40 mm dans la chambre
      const a0 = [bx + g.out[0] * (e + sortie), by + g.out[1] * (e + sortie)], a1 = [bx - g.out[0] * 40, by - g.out[1] * 40];
      const tx = g.out[1] !== 0 ? 1 : 0, ty = g.out[0] !== 0 ? 1 : 0; // axe le long de la face
      const key = Math.round(t);
      const bandes = [[-1, -0.5, 0.75], [-0.5, 0, 1.05], [0, 0.5, 0.95], [0.5, 1, 0.65]];
      for (const [u0, u1, k2] of bandes) {
        p.rgb(MAT.tpc.map((c) => Math.min(1, c * k2)), false).poly([
          P(a0[0] + tx * r * u0, a0[1] + ty * r * u0), P(a1[0] + tx * r * u0, a1[1] + ty * r * u0),
          P(a1[0] + tx * r * u1, a1[1] + ty * r * u1), P(a0[0] + tx * r * u1, a0[1] + ty * r * u1)], 'f');
      }
      if (!vus.has(key)) {
        vus.add(key);
        const nb = mq.fourreaux.filter((x) => Math.round(off + (miroir ? mq.largeur - x.x : x.x)) === key).length;
        const [lx, ly] = P(a0[0] + g.out[0] * 30, a0[1] + g.out[1] * 30);
        p.rgb([0, 0, 0], false).text(lx, ly - 3, 6, nb > 1 ? `${f.id}…×${nb}` : f.id, { align: g.out[0] < 0 ? 'right' : g.out[0] > 0 ? 'left' : 'center', bold: true });
      }
      for (const nom of f.liaisons || []) {
        const A = ancre[k][nom] || (ancre[k][nom] = { x: 0, y: 0, n: 0 });
        A.x += a1[0]; A.y += a1[1]; A.n++;
      }
    }
    // nom de la face et du masque, côté extérieur
    const libelle = `${etude.faces[k].face} : ${mq.nom}`;
    if (estPignonCle(k)) {
      // pignon : au-dessus du mur, aligné sur l'extrémité intérieure du mur
      const [px, py] = P(g.out[0] < 0 ? -e : L + e, l + e + 25);
      p.rgb([0.15, 0.15, 0.15], false).text(px, py, 8, libelle, { align: g.out[0] < 0 ? 'right' : 'left', bold: true });
    } else {
      const [mx, my] = g.at(g.long / 2);
      const d = e + sortie + 45;
      const [tx2, ty2] = P(mx + g.out[0] * d, my + g.out[1] * d);
      p.rgb([0.15, 0.15, 0.15], false).text(tx2, ty2 + (g.out[1] > 0 ? 4 : -10), 8, libelle, { align: 'center', bold: true });
    }
  }
  const pt = (k, nom) => { const A = ancre[k] && ancre[k][nom]; return A && A.n ? [A.x / A.n, A.y / A.n] : null; };
  // traversées : droite ou en angle (en L), de face à face
  const dejaVu = new Map(); // même couple de points → décalage parallèle
  etude.traversees.forEach((t, i) => {
    const [a, b] = t.cles, A0 = pt(a, t.liaison), B0 = pt(b, t.liaison);
    if (!A0 || !B0) return;
    const cle = `${a}|${b}|${Math.round(A0[0])},${Math.round(A0[1])}|${Math.round(B0[0])},${Math.round(B0[1])}`;
    const rang = dejaVu.get(cle) || 0; dejaVu.set(cle, rang + 1);
    const pas = Math.min(l, L) / 14, d = (rang % 2 ? -1 : 1) * Math.ceil(rang / 2) * pas;
    const na = faceGeo[a].n, ta = [na[1], -na[0]]; // tangente à la face d'entrée
    const nb = faceGeo[b].n, tb = [nb[1], -nb[0]];
    const A = [A0[0] + ta[0] * d, A0[1] + ta[1] * d], B = [B0[0] + tb[0] * d * (t.type === 'droite' ? -1 : 1), B0[1] + tb[1] * d * (t.type === 'droite' ? -1 : 1)];
    const c = couleur.get(t.liaison);
    let chemin = [A, B];
    if (t.type === 'angle') {
      const na = faceGeo[a].n;
      chemin = [A, na[0] !== 0 ? [B[0], A[1]] : [A[0], B[1]], B];
    }
    p.rgb(c).width(1.6);
    for (let j = 0; j + 1 < chemin.length; j++) p.line(...P(...chemin[j]), ...P(...chemin[j + 1]));
    const mid = chemin[Math.floor(chemin.length / 2)];
    const [qx, qy] = P(...mid);
    p.rgb([1, 1, 1], false).rgb(c).width(1).circle(qx, qy, 6, 'B');
    p.rgb(c, false).text(qx, qy - 2.5, 7, String(i + 1), { align: 'center', bold: true });
  });
  etude.arrets.forEach((a) => {
    const A = pt(a.cle, a.liaison);
    if (!A) return;
    const [qx, qy] = P(A[0] + faceGeo[a.cle].n[0] * 60, A[1] + faceGeo[a.cle].n[1] * 60);
    p.rgb(couleur.get(a.liaison), false).circle(qx, qy, 3, 'f');
  });
  // cotes
  p.rgb([0.8, 0, 0], false);
  const [c1x, c1y] = P(L / 2, l * 0.12);
  p.text(c1x, c1y, 8, `${etude.ref} — ${L} × ${l} mm (intérieur)`, { align: 'center' });
  p.rgb([0, 0, 0], false);
  return couleur;
}

// Page « chambre vue de dessus » : faces, fourreaux par face, traversées.
function dessinerEtudeChambre(p, e, masques) {
  p.text(MARGE, PAGE_H - MARGE - 4, 16, `${e.nom || 'Chambre'} — ${e.ok ? e.ref : 'aucune chambre'} — vue de dessus`, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, 'TONTONKAD — étude de chambre', { align: 'right' });
  p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);
  const x = 560;
  let y = PAGE_H - MARGE - 40;
  if (!e.ok) {
    for (const l of e.erreurs || []) { p.rgb([0.8, 0.1, 0.1], false).text(MARGE, y, 10, l, { bold: true }); y -= 14; }
    return p;
  }
  const couleurs = drawChambreDessus(p, e, masques || {}, MARGE, 60, 500, PAGE_H - MARGE - 60 - 60);
  p.rgb([0, 0, 0], false).text(x, y, 11, `Chambre ${e.ref}`, { bold: true }); y -= 14;
  p.text(x, y, 8, `Intérieur ${e.L} × ${e.l} mm, H ${e.H} mm (utile)`); y -= 18;
  p.text(x, y, 9, 'Faces', { bold: true }); y -= 12;
  for (const f of Object.values(e.faces)) {
    p.rgb(f.tient ? [0.1, 0.5, 0.2] : [0.8, 0.1, 0.1], false).text(x, y, 8, `${f.tient ? 'OK' : 'NON'}  ${f.face} : ${f.masque}`, { bold: true }); y -= 10;
    p.rgb([0.35, 0.35, 0.35], false).text(x + 14, y, 7, `masque ${f.largeurMasque} × ${f.hauteurMasque} dans ${f.largeurFace} × ${f.hauteurFace} mm`); y -= 12;
  }
  y -= 4;
  p.rgb([0, 0, 0], false).text(x, y, 9, 'Traversées', { bold: true }); y -= 12;
  if (!e.traversees.length) { p.text(x, y, 8, 'aucune'); y -= 11; }
  e.traversees.forEach((t, i) => {
    p.rgb(couleurs.get(t.liaison) || [0, 0, 0], false).text(x, y, 8, `${i + 1}. ${t.liaison}`.slice(0, 48), { bold: true }); y -= 10;
    p.rgb([0.2, 0.2, 0.2], false).text(x + 12, y, 7, `entre ${t.entree}, sort ${t.sortie} (${t.type})${t.changementFourreau ? ', fourreau ' + t.changementFourreau : ''}`); y -= 11;
  });
  if (e.arrets.length) {
    y -= 4; p.rgb([0, 0, 0], false).text(x, y, 9, 'Liaisons qui s\'arrêtent dans la chambre', { bold: true }); y -= 12;
    for (const a of e.arrets.slice(0, 8)) { p.rgb(couleurs.get(a.liaison) || [0, 0, 0], false).text(x, y, 7, `• ${a.liaison} (${a.face})`.slice(0, 60)); y -= 10; }
  }
  if (e.avertissements && e.avertissements.length) {
    y -= 4; p.rgb([0, 0, 0], false).text(x, y, 9, 'À vérifier', { bold: true }); y -= 12;
    for (const a of e.avertissements.slice(0, 6)) { p.rgb([0.6, 0.2, 0.1], false).text(x, y, 7, `• ${a}`.slice(0, 62)); y -= 10; }
  }
  p.rgb([0.4, 0.4, 0.4], false).text(MARGE, MARGE - 14, 7, 'Vue de dessus : pignon A à gauche, pignon B à droite, long-pan A en bas, long-pan B en haut. Positions des fourreaux le long de chaque face reprises des masques (centrés).');
  return p;
}

// Rejoue une Page (opérateurs PDF + labels) sur un canvas 2D d'écran :
// même dessin à l'écran et dans le PDF. hauteurPt = hauteur du repère PDF.
function rejouerSurCanvas(ctx, page, hauteurPt) {
  ctx.save();
  ctx.transform(1, 0, 0, -1, 0, hauteurPt); // repère PDF (Y vers le haut)
  const rgb = (a) => `rgb(${Math.round(a[0] * 255)},${Math.round(a[1] * 255)},${Math.round(a[2] * 255)})`;
  let pile = [];
  ctx.beginPath();
  for (const ligne of page.ops) {
    if (/^\[.*\] 0 d$/.test(ligne)) { ctx.setLineDash(ligne.startsWith('[]') ? [] : [3, 2]); continue; }
    for (const tok of ligne.split(/\s+/)) {
      if (tok === '') continue;
      if (/^-?[\d.]+$/.test(tok)) { pile.push(Number(tok)); continue; }
      if (tok.startsWith('/')) { pile.push(tok); continue; }
      const n = pile;
      switch (tok) {
        case 'RG': ctx.strokeStyle = rgb(n.slice(-3)); break;
        case 'rg': ctx.fillStyle = rgb(n.slice(-3)); break;
        case 'w': ctx.lineWidth = n[n.length - 1]; break;
        case 'm': ctx.moveTo(n[0], n[1]); break;
        case 'l': ctx.lineTo(n[0], n[1]); break;
        case 'c': ctx.bezierCurveTo(n[0], n[1], n[2], n[3], n[4], n[5]); break;
        case 're': ctx.rect(n[0], n[1], n[2], n[3]); break;
        case 'h': ctx.closePath(); break;
        case 'S': ctx.stroke(); ctx.beginPath(); break;
        case 'f': ctx.fill(); ctx.beginPath(); break;
        case 'B': ctx.fill(); ctx.stroke(); ctx.beginPath(); break;
        case 'W': ctx.clip(); break;
        case 'n': ctx.beginPath(); break;
        case 'q': ctx.save(); break;
        case 'Q': ctx.restore(); break;
        case 'gs': ctx.globalAlpha = 0.12; break;
        default: break;
      }
      pile = [];
    }
  }
  ctx.restore();
  // textes
  for (const l of page.labels) {
    ctx.save();
    ctx.fillStyle = rgb(l.rgb);
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = l.align === 'center' ? 'center' : l.align === 'right' ? 'right' : 'left';
    ctx.fillText(l.text, l.x, hauteurPt - l.y);
    ctx.restore();
  }
}

// ─── Synoptique du réseau (2D et isométrique) ─────────────────────────
// data = { noeuds: [{ nom, type, couleur '#rrggbb', x, y, sous }], troncons: [{ a: {x,y}, b: {x,y}, label }] }
// (x, y) = positions du synoptique de l'application (y vers le bas).
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0x5d6a70; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const nuance = (c, k) => c.map((v) => Math.max(0, Math.min(1, k >= 1 ? v + (1 - v) * (k - 1) : v * k)));

// Cartouche multiligne d'un tronçon (lignes = diamètres, dernière = distance en gras).
function cartouche(p, mx, my, label) {
  const lignes = Array.isArray(label) ? label : [String(label)], lh = 9.5;
  const w = Math.max(...lignes.map((l) => l.length)) * 4.3 + 12, h = lignes.length * lh + 5;
  p.rgb([1, 1, 1], false).rgb([0.6, 0.6, 0.6]).width(0.5).rect(mx - w / 2, my - h / 2, w, h, 'B');
  lignes.forEach((l, i) => {
    const der = i === lignes.length - 1 && lignes.length > 1;
    p.rgb(der ? [0.75, 0.32, 0.05] : [0.1, 0.1, 0.1], false).text(mx, my + h / 2 - 3 - lh * (i + 0.75), 7.5, l, { align: 'center', bold: der });
  });
}

function drawSynoptique2D(p, data, zx, zy, zw, zh) {
  if (!data.noeuds.length) return;
  const xs = data.noeuds.map((n) => n.x), ys = data.noeuds.map((n) => n.y);
  const x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70, y0 = Math.min(...ys) - 50, y1 = Math.max(...ys) + 50;
  const s = Math.min(zw / (x1 - x0), zh / (y1 - y0), 1.6);
  const ox = zx + (zw - (x1 - x0) * s) / 2, oy = zy + (zh - (y1 - y0) * s) / 2;
  const P = (x, y) => [ox + (x - x0) * s, oy + (y1 - y) * s]; // y vers le bas → repère PDF
  for (const t of data.troncons) {
    p.rgb([0.35, 0.38, 0.42]).width(2).line(...P(t.a.x, t.a.y), ...P(t.b.x, t.b.y));
    const [mx, my] = P((t.a.x + t.b.x) / 2, (t.a.y + t.b.y) / 2);
    cartouche(p, mx, my, t.label);
  }
  for (const n of data.noeuds) {
    const c = hexRgb(n.couleur), [cx, cy] = P(n.x, n.y);
    const w = (n.type === 'chambre' ? 92 : n.type === 'coffret' ? 54 : 66) * s * 0.75, h = (n.type === 'coffret' ? 54 : 44) * s * 0.75;
    p.rgb(nuance(c, 1.75), false).rgb(c).width(1.6);
    if (n.type === 'sortie') p.poly([[cx - w / 2, cy - h / 2], [cx + w / 2 - 10, cy - h / 2], [cx + w / 2, cy], [cx + w / 2 - 10, cy + h / 2], [cx - w / 2, cy + h / 2]], 'B');
    else p.rect(cx - w / 2, cy - h / 2, w, h, 'B');
    p.rgb([0.1, 0.1, 0.1], false).text(cx, cy + (n.sous ? 1 : -3), 9, n.nom, { align: 'center', bold: true });
    if (n.sous) p.rgb([0.35, 0.35, 0.35], false).text(cx, cy - 9, 7, n.sous, { align: 'center' });
  }
}

// Isométrique : sol (x, y), hauteur z. Chambres = caissons enterrés vus en
// volume, coffrets = armoires, sorties = bornes ; tranchées = bandes de terre.
function drawSynoptiqueIso(p, data, zx, zy, zw, zh) {
  if (!data.noeuds.length) return;
  const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
  const iso = (x, y, z) => [(x - y) * C, -(x + y) * S + z];
  const dims = { chambre: [64, 40, 26], coffret: [30, 22, 60], sortie: [14, 14, 34] };
  // cadrage sur l'emprise projetée
  const pts = [];
  data.noeuds.forEach((n) => { const [a, b, h] = dims[n.type] || dims.sortie; [[-a, -b, 0], [a, b, 0], [-a, b, h], [a, -b, h]].forEach(([dx, dy, z]) => pts.push(iso(n.x + dx / 2, n.y + dy / 2, z + 18))); });
  const X0 = Math.min(...pts.map((q) => q[0])) - 20, X1 = Math.max(...pts.map((q) => q[0])) + 20;
  const Y0 = Math.min(...pts.map((q) => q[1])) - 20, Y1 = Math.max(...pts.map((q) => q[1])) + 20;
  const s = Math.min(zw / (X1 - X0), zh / (Y1 - Y0), 1.8);
  const ox = zx + (zw - (X1 - X0) * s) / 2 - X0 * s, oy = zy + (zh - (Y1 - Y0) * s) / 2 - Y0 * s;
  const P = (x, y, z = 0) => { const [u, v] = iso(x, y, z); return [ox + u * s, oy + v * s]; };
  const LARG = 7, HAUT = 6; // demi-largeur et demi-hauteur des tranchées
  // Point de raccordement d'un bout de tranchée : sur la face de la chambre
  // (pignon A/B, long-pan A/B), à mi-hauteur du caisson ; au pied sinon.
  const bout = (e) => {
    // coffret / sortie : les fourreaux remontent par le dessous → arrivée sous le
    // centre du socle, tranchée enterrée (dessus au niveau du sol)
    if (e.type !== 'chambre') return { x: e.x, y: e.y, z: -HAUT };
    const [a, b, h] = dims.chambre, z = -8 + h / 2;
    const off = { pignonA: [-a / 2, 0], pignonB: [a / 2, 0], longPanA: [0, b / 2], longPanB: [0, -b / 2] }[e.face] || [0, 0];
    return { x: e.x + off[0], y: e.y + off[1], z };
  };
  // Tranchée en volume : prisme de terre (largeur 14, hauteur 12) entre les
  // deux raccordements, centré sur leur hauteur. On dessine le flanc et
  // l'extrémité tournés vers l'observateur, puis le dessus (grillage rouge).
  const vue = (vx, vy) => vx + vy; // > 0 : tourné vers l'observateur (x + y croissant)
  function tranchee(t) {
    const A = bout(t.a), B = bout(t.b);
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * LARG, ny = dx / L * LARG;
    const coin = (E, sgn, dz) => P(E.x + sgn * nx, E.y + sgn * ny, E.z + dz);
    const terre = MAT.terre, bord = [0.3, 0.22, 0.15];
    // flanc visible : celui dont la normale regarde l'observateur
    const sg = vue(nx, ny) >= 0 ? 1 : -1;
    p.texture([coin(A, sg, -HAUT), coin(B, sg, -HAUT), coin(B, sg, HAUT), coin(A, sg, HAUT)], nuance(terre, 0.78), { seed: 33, taille: 0.6, contour: bord });
    // extrémité visible (côté coffret / sortie uniquement : côté chambre elle entre dans la face)
    [[B, t.b, 1], [A, t.a, -1]].forEach(([E, e, sens]) => {
      if (e.type === 'chambre' || vue(dx * sens, dy * sens) <= 0) return;
      p.texture([coin(E, 1, -HAUT), coin(E, -1, -HAUT), coin(E, -1, HAUT), coin(E, 1, HAUT)], nuance(terre, 0.66), { seed: 34, taille: 0.6, contour: bord });
    });
    // dessus
    p.texture([coin(A, 1, HAUT), coin(B, 1, HAUT), coin(B, -1, HAUT), coin(A, -1, HAUT)], nuance(terre, 1.08), { seed: 31, taille: 0.6, contour: bord });
    p.rgb([0.85, 0.12, 0.1]).width(0.9).line(...P(A.x, A.y, A.z + HAUT + 0.3), ...P(B.x, B.y, B.z + HAUT + 0.3)); // grillage
    const [mx, my] = P((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2 + HAUT + 12);
    etiquettes.push(() => cartouche(p, mx, my, t.label));
  }
  function volume(n) {
    const [a, b, h] = dims[n.type] || dims.sortie, c = hexRgb(n.couleur);
    const x0 = n.x - a / 2, x1 = n.x + a / 2, y0 = n.y - b / 2, y1 = n.y + b / 2;
    const z0 = n.type === 'chambre' ? -8 : 0, z1 = z0 + h;
    const mat = n.type === 'chambre' ? MAT.beton : c;
    p.texture([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], nuance(mat, 0.72), { seed: 41, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    p.texture([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], nuance(mat, 0.88), { seed: 42, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    p.texture([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], nuance(mat, 1.12), { seed: 43, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    if (n.type === 'chambre') { // tampon de la couleur de la chambre
      p.rgb(nuance(c, 0.9), false).rgb([0.2, 0.2, 0.2]).width(0.6)
        .poly([P(x0 + 6, y0 + 6, z1 + 0.5), P(x1 - 6, y0 + 6, z1 + 0.5), P(x1 - 6, y1 - 6, z1 + 0.5), P(x0 + 6, y1 - 6, z1 + 0.5)], 'B');
    }
    const [tx, ty] = P(n.x, n.y, z1 + 14);
    etiquettes.push(() => {
      // cadre à fond blanc bordé de la couleur de l'élément : lisible sur les volumes
      const w = Math.max(n.nom.length * 5.4, (n.sous || '').length * 3.9) + 12, h = n.sous ? 22 : 14;
      p.rgb([1, 1, 1], false).rgb(c).width(1.2).rect(tx - w / 2, ty - h + 10, w, h, 'B');
      p.rgb([0.08, 0.08, 0.08], false).text(tx, ty, 8.5, n.nom, { align: 'center', bold: true });
      if (n.sous) p.rgb([0.3, 0.3, 0.3], false).text(tx, ty - 9, 6.5, n.sous, { align: 'center' });
    });
  }
  // Ordre de profondeur commun (peintre) : du fond (x + y petit) vers l'avant ;
  // une tranchée se range à son milieu. Étiquettes en dernier, toujours lisibles.
  const etiquettes = [];
  const elements = [
    ...data.troncons.map((t) => ({ cle: (t.a.x + t.a.y + t.b.x + t.b.y) / 2, dessiner: () => tranchee(t) })),
    ...data.noeuds.map((n) => {
      let cle = n.x + n.y;
      if (n.type !== 'chambre') data.troncons.forEach((t) => {
        const ici = (t.a.x === n.x && t.a.y === n.y) || (t.b.x === n.x && t.b.y === n.y);
        if (ici) cle = Math.max(cle, (t.a.x + t.a.y + t.b.x + t.b.y) / 2 + 0.01); // recouvre l'arrivée
      });
      return { cle, dessiner: () => volume(n) };
    }),
  ].sort((u, v) => u.cle - v.cle);
  elements.forEach((e) => e.dessiner());
  etiquettes.forEach((f) => f());
}

const api = { Page, MAT, fit, drawCoupe, draw3D, drawChambre3D, drawChambreDessus, dessinerEtudeChambre, rejouerSurCanvas, drawSynoptique2D, drawSynoptiqueIso, coupeEnMiroir, COUL_LIAISON, PAGE_W, PAGE_H, MARGE, PHASE_RGB, GRILLAGE_RGB };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Vue3D = api;
})(typeof window !== 'undefined' ? window : globalThis);

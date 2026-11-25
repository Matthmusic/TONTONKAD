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
const WINANSI = { '\u2014': '\x97', '\u2013': '\x96', '\u2026': '\x85', '\u2022': '\x95', '\u2019': '\x92', '\u20AC': '\x80', '\u0153': '\x9c', '\u0152': '\x8c', '\u2018': '\x91', '\u201C': '\x93', '\u201D': '\x94' };
const pdfStr = (s) => '(' + String(s).replace(/\u2192/g, '->').replace(/\u2265/g, '>=').replace(/[\u2014\u2013\u2026\u2022\u2019\u20AC\u0153\u0152\u2018\u201C\u201D]/g, (c) => WINANSI[c]).replace(/[^\x20-\x7E\x80-\x9F\u00A0-\u00FF]/g, '?')
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
  // vertical = true : texte tourné de 90° (se lit de bas en haut), (x, y) = point d'ancrage.
  text(x, y, size, s, { bold = false, align = 'left', vertical = false } = {}) {
    this.labels.push({ x, y, size, text: String(s), bold, align, rgb: this.fill, vertical });
    if (!this.emitText) return this;
    // largeur approximative Helvetica (0.5 em / caractère) pour centrer / aligner à droite
    const w = String(s).length * size * 0.5;
    const dx = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    if (vertical) this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf 0 1 -1 0 ${f(x)} ${f(y + dx)} Tm ${pdfStr(s)} Tj ET`);
    else this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${f(x + dx)} ${f(y)} Td ${pdfStr(s)} Tj ET`);
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
  }
  for (const c of m.cables) {
    p.rgb(PHASE_RGB[c.phase] || [0.2, 0.2, 0.2]).width(0.6).circle(X(c.x), Y(c.y), c.od / 2 * s);
  }
  // cotes
  p.rgb([0.8, 0, 0], false);
  // cotes regroupées sous la coupe : rien ne déborde à gauche sur un cadre voisin
  p.text(X(m.largeur / 2), oy - 12, 8, m.forme === 'circ' ? `Ø ${m.largeur} mm` : `L = ${m.largeur} mm × P = ${top} mm`, { align: 'center' });
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
  const n = [-Math.sin(ang), Math.cos(ang)];
  // Ordre de peinture (du plus loin au plus proche) : fond et paroi visible de la
  // tranchée, puis les fourreaux (qui partent en profondeur), puis ce qui est
  // devant eux : dessus du terrain, face avant coupée, grillage.
  const fourreaux = () => {
    const order = [...m.fourreaux].sort((a2, b2) => (b2.y - a2.y) || (b2.x - a2.x));
    for (const fo of order) {
      const r = fo.od / 2 * s, cx = X(fo.x), cy = Y(fo.y);
      p.cylindre(cx, cy, cx + ex, cy + ey, r, fo.di / 2 * s, MAT.tpc);
    }
    for (const c of m.cables) {
      p.rgb(PHASE_RGB[c.phase] || [0.25, 0.25, 0.25], false).rgb([0, 0, 0]).width(0.3).circle(X(c.x), Y(c.y), Math.max(0.6, c.od / 2 * s), 'B');
    }
  };
  if (m.forme === 'circ') {
    const r = m.largeur / 2 * s, cx = X(m.largeur / 2), cy = Y(m.largeur / 2);
    p.rgb([0, 0, 0]).circle(cx + ex, cy + ey, r);
    p.line(cx + n[0] * r, cy + n[1] * r, cx + n[0] * r + ex, cy + n[1] * r + ey);
    p.line(cx - n[0] * r, cy - n[1] * r, cx - n[0] * r + ex, cy - n[1] * r + ey);
    fourreaux();
  } else {
    const M = W * MG, sol = H * SG;                    // marge de terre autour (pt)
    const x0 = X(0), y0 = Y(0), lit = (m.reglages.litDePose || 0) * s;
    const surf = MAT.surface[(m.tranchee && m.tranchee.zone) || 'trottoir'] || MAT.surface.trottoir;
    // 1. au fond : sol de la tranchée (lit de sable) et paroi gauche, vue de l'intérieur
    p.texture([[x0, y0], [x0 + ex, y0 + ey], [x0 + W + ex, y0 + ey], [x0 + W, y0]], MAT.sable, { seed: 6, taille: 0.7 });
    p.texture([[x0, y0], [x0 + ex, y0 + ey], [x0 + ex, y0 + H + ey], [x0, y0 + H]], MAT.terre.map((c) => c * 0.8), { seed: 5 });
    if (lit > 0) p.texture([[x0, y0], [x0 + ex, y0 + ey], [x0 + ex, y0 + ey + lit], [x0, y0 + lit]], MAT.sable.map((c) => c * 0.92), { seed: 7, taille: 0.7 });
    // 2. les fourreaux
    fourreaux();
    // 3. devant eux : grillage (au-dessus de la nappe), dessus du terrain, face avant coupée
    if (m.tranchee) {
      const g = m.tranchee.grillage;
      p.rgb(GRILLAGE_RGB[g.couleur] || [0.85, 0.1, 0.1], false).rgb(GRILLAGE_RGB[g.couleur] || [0.85, 0.1, 0.1]).width(0.4);
      const gy = Y(g.y);
      p.poly([[X(10), gy], [X(10) + ex, gy + ey], [X(m.largeur - 10) + ex, gy + ey], [X(m.largeur - 10), gy]], 'S');
      for (let t = 0.1; t < 1; t += 0.1) p.line(X(10) + ex * t, gy + ey * t, X(m.largeur - 10) + ex * t, gy + ey * t);
    }
    p.texture([[x0 - M, y0 + H], [x0 - M + ex, y0 + H + ey], [x0 + ex, y0 + H + ey], [x0, y0 + H]], surf, { seed: 3, contraste: 0.08 });
    // bloc de terre de droite : il cache la partie des fourreaux qui file derrière lui
    p.texture([[x0 + W, y0 - sol], [x0 + W + ex, y0 - sol + ey], [x0 + W + M + ex, y0 - sol + ey], [x0 + W + M + ex, y0 + H + ey], [x0 + W + ex, y0 + H + ey], [x0 + W, y0 + H]], MAT.terre.map((c) => c * 0.85), { seed: 10 });
    p.texture([[x0 + W, y0 + H], [x0 + W + ex, y0 + H + ey], [x0 + W + M + ex, y0 + H + ey], [x0 + W + M, y0 + H]], surf, { seed: 4, contraste: 0.08 });
    p.texture([[x0 - M, y0 - sol], [x0 + W + M, y0 - sol], [x0 + W + M, y0 + H], [x0 + W, y0 + H], [x0 + W, y0], [x0, y0], [x0, y0 + H], [x0 - M, y0 + H]], MAT.terre, { seed: 8, contour: [0.3, 0.22, 0.15] });
    p.texture([[x0, y0], [x0 + W, y0], [x0 + W, y0 - Math.min(lit, sol)], [x0, y0 - Math.min(lit, sol)]], MAT.sable, { seed: 9, taille: 0.7 });
    p.rgb([0.3, 0.22, 0.15]).width(0.6).line(x0 + W, y0 + H, x0 + W + ex, y0 + H + ey).line(x0, y0 + H, x0 + ex, y0 + H + ey);
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

// Faisceaux de traversées (même règle que ChambreFaces.regrouperTraversees).
const NUMERO_COTE = { longPanB: 1, pignonB: 2, longPanA: 3, pignonA: 4 };
function regrouperFaisceaux(etude) {
  const g = new Map();
  for (const t of (etude && etude.traversees) || []) {
    const [a, b] = t.cles, cle = NUMERO_COTE[a] <= NUMERO_COTE[b] ? `${a}|${b}` : `${b}|${a}`;
    if (!g.has(cle)) g.set(cle, { cles: cle.split('|'), type: t.type, liaisons: [] });
    g.get(cle).liaisons.push(t.liaison);
  }
  return [...g.values()].sort((x, y) => y.liaisons.length - x.liaisons.length || NUMERO_COTE[x.cles[0]] - NUMERO_COTE[y.cles[0]]);
}

function drawChambreDessus(p, etude, masques, zx, zy, zw, zh) {
  const L = etude.L, l = etude.l, e = (etude.infos && etude.infos.paroi) || 0, sortie = 350;
  const ext = e + sortie + 110; // place pour l'étiquette de chaque côté, au bout des tubes
  // marge fixe (pt) en plus : étiquettes et pastilles des côtés restent dans le cadre
  const MPT = 30, s = fit(L + 2 * ext, l + 2 * ext, Math.max(10, zw - 2 * MPT), Math.max(10, zh - 2 * MPT));
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
  } else if (nt > 1) { p.rgb([0.6, 0.6, 0.6]).width(0.4).dash(true); for (let k = 1; k < nt; k++) p.line(...P(L * k / nt, 0), ...P(L * k / nt, l)); p.dash(false); }

  // géométrie d'une face : point le long du mur, normale vers l'intérieur
  const faceGeo = {
    pignonA: { long: l, at: (t) => [0, t], n: [1, 0], out: [-1, 0] },
    pignonB: { long: l, at: (t) => [L, t], n: [-1, 0], out: [1, 0] },
    longPanA: { long: L, at: (t) => [t, 0], n: [0, 1], out: [0, -1] },
    longPanB: { long: L, at: (t) => [t, l], n: [0, -1], out: [0, 1] },
  };
  const couleur = new Map();
  // Une couleur par liaison pour TOUT le projet : etude.ordreLiaisons (fourni par
  // l'appelant, ordre stable sur le réseau) ; à défaut, ordre propre à la chambre.
  const ordre = Array.isArray(etude.ordreLiaisons) ? etude.ordreLiaisons : [];
  [...etude.traversees.map((t) => t.liaison), ...etude.arrets.map((a) => a.liaison)].forEach((n, i) => {
    const j = ordre.indexOf(n);
    couleur.set(n, COUL_LIAISON[(j >= 0 ? j : ordre.length + i) % COUL_LIAISON.length]);
  });
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
    // Vue de dessus : les fourreaux superposés d'une même colonne se confondent.
    // Une bande par colonne, teintée de la couleur de sa liaison, cerclée, cotée Ø.
    const colonnes = new Map();
    for (const f of mq.fourreaux) {
      const t = off + (miroir ? mq.largeur - f.x : f.x), key = Math.round(t);
      const c = colonnes.get(key) || { t, od: 0, n: 0, liaisons: [] };
      c.od = Math.max(c.od, f.od); c.n++;
      (f.liaisons || []).forEach((nom) => { if (!c.liaisons.includes(nom)) c.liaisons.push(nom); });
      colonnes.set(key, c);
      const [bx, by] = g.at(t), a1 = [bx - g.out[0] * 40, by - g.out[1] * 40];
      for (const nom of f.liaisons || []) {
        const A = ancre[k][nom] || (ancre[k][nom] = { x: 0, y: 0, n: 0 });
        A.x += a1[0]; A.y += a1[1]; A.n++;
      }
    }
    const tx = g.out[1] !== 0 ? 1 : 0, ty = g.out[0] !== 0 ? 1 : 0; // axe le long de la face
    for (const c of colonnes.values()) {
      const [bx, by] = g.at(c.t), r = c.od / 2 * 0.9;
      const a0 = [bx + g.out[0] * (e + sortie), by + g.out[1] * (e + sortie)], a1 = [bx - g.out[0] * 40, by - g.out[1] * 40];
      const base = c.liaisons.length ? couleur.get(c.liaisons[0]) || [0.45, 0.45, 0.45] : [0.45, 0.45, 0.45];
      p.rgb(nuance(base, 1.75), false).rgb(nuance(base, 0.7)).width(0.7).poly([
        P(a0[0] - tx * r, a0[1] - ty * r), P(a1[0] - tx * r, a1[1] - ty * r),
        P(a1[0] + tx * r, a1[1] + ty * r), P(a0[0] + tx * r, a0[1] + ty * r)], 'B');
      // axe du tube
      p.rgb(nuance(base, 0.85)).width(0.4).dash(true).line(...P(...a0), ...P(...a1)).dash(false);
      // cote Ø dans le tube, à mi-longueur de sa partie hors chambre
      const m = e + sortie / 2, [lx, ly] = P(bx + g.out[0] * m, by + g.out[1] * m);
      const txt = `Ø${Math.round(c.od)}${c.n > 1 ? ` ×${c.n}` : ''}`;
      const fs = Math.max(5, Math.min(7.5, c.od * 0.9 * s * 0.75));
      // tubes verticaux (côtés 1 et 3) : texte tourné dans l'axe du tube ;
      // tubes horizontaux (côtés 2 et 4) : texte à plat. Omis s'il ne tient pas.
      const vertical = g.out[0] === 0;
      if (vertical) {
        if (fs <= c.od * 0.9 * s && txt.length * fs * 0.55 <= sortie * s) p.rgb([0.08, 0.08, 0.08], false).text(lx + fs * 0.35, ly, fs, txt, { align: 'center', bold: true, vertical: true });
      } else p.rgb([0.08, 0.08, 0.08], false).text(lx, ly - fs * 0.35, fs, txt, { align: 'center', bold: true });
    }
    // nom de la face et du tronçon, dans un cadre, côté extérieur
    const libelle = `${etude.nom ? etude.nom + '.' + NUMERO_COTE[k] : etude.faces[k].face.toUpperCase()} · ${mq.nom}`;
    const lw = libelle.length * 8 * 0.5 + 10, lh = 13;
    // contre SON côté, au bout de ses fourreaux et centré sur eux (côtés 2 et 4 :
    // texte vertical), pour qu'on voie tout de suite à quel côté il appartient
    const cols = [...colonnes.values()];
    const tmin = Math.min(...cols.map((c) => c.t - c.od / 2)), tmax = Math.max(...cols.map((c) => c.t + c.od / 2));
    const [ex, ey] = g.at(cols.length ? (tmin + tmax) / 2 : g.long / 2);
    const [bx2, by2] = P(ex + g.out[0] * (e + sortie), ey + g.out[1] * (e + sortie));
    const vert = g.out[0] !== 0, demi = (vert ? lh : lh) / 2 + 4;
    const cx2 = bx2 + g.out[0] * demi, cy2 = by2 + g.out[1] * demi;
    const [rw, rh] = vert ? [lh, lw] : [lw, lh];
    p.rgb([1, 1, 1], false).rgb(nuance(couleur.get((mq.liaisons || [])[0]) || [0.45, 0.45, 0.45], 0.7)).width(0.9).rect(cx2 - rw / 2, cy2 - rh / 2, rw, rh, 'B');
    if (vert) p.rgb([0.12, 0.12, 0.12], false).text(cx2 + 3, cy2, 8, libelle, { align: 'center', bold: true, vertical: true });
    else p.rgb([0.12, 0.12, 0.12], false).text(cx2, cy2 - 3, 8, libelle, { align: 'center', bold: true });
    (p.libellesCotes || (p.libellesCotes = {}))[k] = { x: cx2, y: cy2, w: rw, h: rh };
  }
  // Pastilles « numéro de côté » (1 haut, 2 droite, 3 bas, 4 gauche), à l'extérieur
  // du mur, à côté des fourreaux (pas dessus). Positions gardées pour le clic dans l'app.
  p.pastillesCotes = {};
  for (const k of Object.keys(faceGeo)) {
    const g = faceGeo[k], rp = 10, lb = p.libellesCotes && p.libellesCotes[k];
    let qx, qy;
    if (lb) { // collée à l'étiquette du masque : à gauche (côtés 1, 3), au-dessus (côtés 2, 4)
      // décalée vers l'extérieur pour ne pas toucher le bout des tubes
      if (g.out[0] !== 0) { qx = lb.x + g.out[0] * (rp + 4 - lb.w / 2); qy = lb.y + lb.h / 2 + rp + 5; }
      else { qx = lb.x - lb.w / 2 - rp - 5; qy = lb.y + g.out[1] * (rp + 4 - lb.h / 2); }
    } else { // côté libre : au milieu, juste à l'extérieur du mur
      const [bx, by] = g.at(g.long / 2); [qx, qy] = P(bx + g.out[0] * (e + 120), by + g.out[1] * (e + 120));
    }
    p.rgb([0.1, 0.12, 0.16], false).rgb([1, 1, 1]).width(1.5).circle(qx, qy, rp, 'B');
    p.rgb([1, 1, 1], false).text(qx, qy - 4, 11, String(NUMERO_COTE[k]), { align: 'center', bold: true });
    p.pastillesCotes[k] = { x: qx, y: qy, r: rp };
  }
  const pt = (k, nom) => { const A = ancre[k] && ancre[k][nom]; return A && A.n ? [A.x / A.n, A.y / A.n] : null; };
  // Traversées regroupées en FAISCEAUX : un trait par couple de côtés (épaisseur
  // selon le nombre de liaisons), numéroté ; la liste détaillée est dans la légende.
  const faisceaux = regrouperFaisceaux(etude);
  const moyenne = (k, noms) => {
    const pts = noms.map((nom) => pt(k, nom)).filter(Boolean);
    return pts.length ? [pts.reduce((s2, q) => s2 + q[0], 0) / pts.length, pts.reduce((s2, q) => s2 + q[1], 0) / pts.length] : null;
  };
  faisceaux.forEach((fx, i) => {
    const [a, b] = fx.cles, A = moyenne(a, fx.liaisons), B = moyenne(b, fx.liaisons);
    if (!A || !B) return;
    const c = fx.liaisons.length === 1 ? couleur.get(fx.liaisons[0]) : [0.2, 0.32, 0.5];
    const chemin = fx.type === 'angle' ? [A, faceGeo[a].n[0] !== 0 ? [B[0], A[1]] : [A[0], B[1]], B] : [A, B];
    p.rgb(c).width(Math.min(9, 1.8 + fx.liaisons.length * 0.45));
    for (let j = 0; j + 1 < chemin.length; j++) p.line(...P(...chemin[j]), ...P(...chemin[j + 1]));
    const mid = chemin.length === 3 ? chemin[1] : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const [qx, qy] = P(...mid), txt = fx.liaisons.length > 1 ? `${i + 1} ×${fx.liaisons.length}` : String(i + 1);
    const rw = Math.max(9, txt.length * 3.1 + 5);
    p.rgb([1, 1, 1], false).rgb(c).width(1.2).rect(qx - rw, qy - 7.5, 2 * rw, 15, 'B');
    p.rgb(c, false).text(qx, qy - 3, 8.5, txt, { align: 'center', bold: true });
  });
  // liaisons qui s'arrêtent : une pastille par côté, avec leur nombre
  const arretsParCote = new Map();
  etude.arrets.forEach((x) => { if (!arretsParCote.has(x.cle)) arretsParCote.set(x.cle, []); arretsParCote.get(x.cle).push(x.liaison); });
  arretsParCote.forEach((noms, k) => {
    const A = moyenne(k, noms);
    if (!A) return;
    const [qx, qy] = P(A[0] + faceGeo[k].n[0] * 80, A[1] + faceGeo[k].n[1] * 80);
    p.rgb([0.55, 0.12, 0.1], false).rgb([1, 1, 1]).width(1).circle(qx, qy, 7, 'B');
    p.rgb([1, 1, 1], false).text(qx, qy - 3, 7.5, String(noms.length), { align: 'center', bold: true });
  });
  // cotes
  // Nom, modèle, dimensions et tampons : dans l'en-tête et le cartouche de la page,
  // et dans le panneau de l'app (dans le dessin, ils se superposaient aux faisceaux).
  p.rgb([0, 0, 0], false);
  return couleur;
}

// Page « chambre vue de dessus » : faces, fourreaux par face, traversées.
function dessinerEtudeChambre(p, e, masques) {
  p.text(MARGE, PAGE_H - MARGE - 4, 16, `${e.nom || 'Chambre'} — ${e.ok ? e.ref : 'aucune chambre'} — vue de dessus`, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, 'nodial — étude de chambre', { align: 'right' });
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
  const LIB = { longPanB: 'côté 1', pignonB: 'côté 2', longPanA: 'côté 3', pignonA: 'côté 4' };
  const assez = () => y > MARGE + 24;
  const parLignes = (noms, n) => { const out = []; for (let i = 0; i < noms.length; i += n) out.push(noms.slice(i, i + n).map(nomCourt).join(' · ')); return out; };
  p.rgb([0, 0, 0], false).text(x, y, 9, 'Traversées (faisceaux)', { bold: true }); y -= 12;
  if (!e.traversees.length) { p.text(x, y, 8, 'aucune'); y -= 11; }
  regrouperFaisceaux(e).forEach((fx, i) => {
    if (!assez()) return;
    const c = fx.liaisons.length === 1 ? (couleurs.get(fx.liaisons[0]) || [0, 0, 0]) : [0.2, 0.32, 0.5];
    p.rgb(c, false).text(x, y, 8, `${i + 1}. ${LIB[fx.cles[0]]} → ${LIB[fx.cles[1]]} · ${fx.liaisons.length} liaison${fx.liaisons.length > 1 ? 's' : ''} (${fx.type})`, { bold: true }); y -= 10;
    for (const l of parLignes(fx.liaisons, 3)) { if (!assez()) break; p.rgb([0.25, 0.25, 0.25], false).text(x + 10, y, 6.5, l.slice(0, 80)); y -= 8.5; }
    y -= 3;
  });
  if (e.arrets.length && assez()) {
    y -= 4; p.rgb([0, 0, 0], false).text(x, y, 9, 'Liaisons qui s\'arrêtent dans la chambre', { bold: true }); y -= 12;
    const parCote = new Map(); e.arrets.forEach((a) => { if (!parCote.has(a.cle)) parCote.set(a.cle, []); parCote.get(a.cle).push(a.liaison); });
    parCote.forEach((noms, k) => {
      if (!assez()) return;
      p.rgb([0.55, 0.12, 0.1], false).text(x, y, 8, `${LIB[k] || k} : ${noms.length}`, { bold: true }); y -= 10;
      for (const l of parLignes(noms, 3)) { if (!assez()) break; p.rgb([0.25, 0.25, 0.25], false).text(x + 10, y, 6.5, l.slice(0, 80)); y -= 8.5; }
    });
  }
  if (e.avertissements && e.avertissements.length) {
    y -= 4; p.rgb([0, 0, 0], false).text(x, y, 9, 'À vérifier', { bold: true }); y -= 12;
    for (const a of e.avertissements.slice(0, 6)) { p.rgb([0.6, 0.2, 0.1], false).text(x, y, 7, `• ${a}`.slice(0, 62)); y -= 10; }
  }
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
    if (l.vertical) { ctx.translate(l.x, hauteurPt - l.y); ctx.rotate(-Math.PI / 2); ctx.fillText(l.text, 0, 0); }
    else ctx.fillText(l.text, l.x, hauteurPt - l.y);
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

// ─── Synoptique ancré (disposition calculée par Reseau.dispositionAncree) ───
// Étiquette d'un tronçon en deux colonnes : à gauche la liste des fourreaux
// (« 11 × Ø200 », une ligne par Ø), à droite les liaisons avec leurs
// sections ; la longueur en bas à droite. Unités du schéma (≈ px à l'échelle 1).
const SYN = { police: 11, lh: 14, pad: 8, gouttiere: 14, carMono: 6.6, carTexte: 6.4, carSection: 6.0 };
const nomCourt = (nom) => String(nom).replace(/^TGBT\s*(\d+)\s*(→|->)\s*/i, 'T$1 → ');
function lignesPhi(e) { return (e.phi || []).map(([d, q]) => `${q} × Ø${d}`); }
// Étiquette de tronçon (disposition « B » validée dans l'atelier) : une ligne par
// liaison en 4 colonnes alignées — nom · câbles (cuivre) · nb de fourreaux ·
// Ø utilisés — sous une ligne d'en-têtes ; puis le récapitulatif des fourreaux
// du tronçon ; puis la longueur, à droite. Largeurs estimées (Helvetica).
const COL_SYN = { nom: 5.6, sec: 5.2, nf: 5.8, phi: 4.8, entete: 5.0, recap: 5.8, gout: 12 };
function phiLiaison(l) { return (l.phi || []).map(([d, q]) => `${q} Ø${d}`).join(' + '); }
function recapSyn(e) {
  const total = e.total != null ? e.total : (e.phi || []).reduce((a, [, q]) => a + q, 0);
  return { txt: lignesPhi(e).join('  ·  '), fin: `= ${total} fourreau${total > 1 ? 'x' : ''}${e.reserve ? `, dont ${e.reserve} de réserve` : ''}` };
}
function mesureEtiquetteSyn(e) {
  const lia = e.liaisons || [], C = COL_SYN, larg = (arr, k, min = 0) => Math.max(min, ...arr.map((t) => String(t).length * k));
  const wNom = lia.length ? larg(lia.map((l) => nomCourt(l.nom)), C.nom, 'LIAISON'.length * C.entete) : 0;
  const wSec = lia.length ? larg(lia.map((l) => l.sections || ''), C.sec, 'CÂBLES'.length * C.entete) : 0;
  const wNf = lia.length ? larg(lia.map((l) => String(l.nf != null ? l.nf : '')), C.nf, 'FOURREAUX'.length * C.entete) : 0;
  const wPhi = lia.length ? larg(lia.map(phiLiaison), C.phi, 'Ø UTILISÉS'.length * C.entete) : 0;
  const r = recapSyn(e), wRecap = (r.txt.length * C.recap) + 8 + r.fin.length * C.phi;
  const wTable = lia.length ? wNom + wSec + wNf + wPhi + 3 * C.gout : 0;
  const lignes = lia.length ? 1 + lia.length : 1; // en-têtes + liaisons (ou « coupe vide »)
  return { w: Math.round(2 * SYN.pad + Math.max(wTable, wRecap, 90)), h: Math.round(2 * SYN.pad + lignes * SYN.lh + 6 + 2 * SYN.lh), cols: { wNom, wSec, wNf, wPhi } };
}
// data = { noeuds: [{nom, type, couleur, x, y, w, h, sous}], troncons: [{a:{x,y}, b:{x,y}, e:{x,y,w,h, phi, liaisons, L}}], largeur, hauteur }
function drawSynoptiqueAncre(p, data, zx, zy, zw, zh, echelleMax = 2) {
  if (!data.noeuds.length) return null;
  const s = Math.min(zw / data.largeur, zh / data.hauteur, echelleMax);
  const ox = zx + (zw - data.largeur * s) / 2, oy = zy + (zh - data.hauteur * s) / 2;
  const P = (x, y) => [ox + x * s, oy + (data.hauteur - y) * s]; // y vers le bas → repère PDF
  p.rgb([0.36, 0.39, 0.45]).width(Math.max(0.6, 2.2 * s));
  for (const t of data.troncons) {
    const A = P(t.a.x, t.a.y), B = P(t.b.x, t.b.y);
    if (Math.abs(A[0] - B[0]) < 0.5 || Math.abs(A[1] - B[1]) < 0.5) p.line(A[0], A[1], B[0], B[1]);
    else p.line(A[0], A[1], B[0], A[1]).line(B[0], A[1], B[0], B[1]); // en équerre
  }
  for (const t of data.troncons) {
    const e = t.e; if (!e) continue;
    const m = mesureEtiquetteSyn(e), [x0, yHaut] = P(e.x - e.w / 2, e.y - e.h / 2), w = e.w * s, h = e.h * s;
    const f = SYN.police * s, lh = SYN.lh * s, pad = SYN.pad * s;
    p.rgb([1, 1, 1], false).rgb([0.75, 0.78, 0.83]).width(Math.max(0.3, 0.8 * s)).rect(x0, yHaut - h, w, h, 'B');
    const lia = e.liaisons || [], { wNom, wSec, wNf } = m.cols, g = COL_SYN.gout * s;
    const xNom = x0 + pad, xSec = xNom + wNom * s + g, xNf = xSec + wSec * s + g + wNf * s, xPhi = xNf + g;
    let y = yHaut - pad - lh * 0.78;
    if (lia.length) {
      // en-têtes + filet
      const fh = f * 0.66;
      p.rgb([0.48, 0.51, 0.56], false).text(xNom, y, fh, 'LIAISON', { bold: true }).text(xSec, y, fh, 'CÂBLES', { bold: true })
        .text(xNf, y, fh, 'FOURREAUX', { bold: true, align: 'right' }).text(xPhi, y, fh, 'Ø UTILISÉS', { bold: true });
      p.rgb([0.88, 0.89, 0.91]).width(Math.max(0.3, 0.7 * s)).line(xNom, y - lh * 0.32, x0 + w - pad, y - lh * 0.32);
      lia.forEach((l) => {
        y -= lh;
        p.rgb([0.16, 0.18, 0.22], false).text(xNom, y, f * 0.9, nomCourt(l.nom));
        if (l.sections) p.rgb([0.48, 0.29, 0.12], false).text(xSec, y, f * 0.84, l.sections);
        p.rgb([0.1, 0.11, 0.12], false).text(xNf, y, f * 0.86, String(l.nf != null ? l.nf : ''), { bold: true, align: 'right' });
        p.rgb([0.48, 0.51, 0.56], false).text(xPhi, y, f * 0.76, phiLiaison(l));
      });
    } else p.rgb([0.45, 0.45, 0.45], false).text(xNom, y, f * 0.9, (e.phi || []).length ? 'fourreaux de réserve' : 'coupe vide');
    // récapitulatif du tronçon, puis longueur
    y -= lh + 6 * s;
    p.rgb([0.88, 0.89, 0.91]).width(Math.max(0.3, 0.7 * s)).line(xNom, y + lh * 0.72, x0 + w - pad, y + lh * 0.72);
    const r = recapSyn(e);
    if (r.txt) {
      p.rgb([0.1, 0.11, 0.12], false).text(xNom, y, f * 0.9, r.txt, { bold: true });
      p.rgb([0.48, 0.51, 0.56], false).text(x0 + w - pad, y, f * 0.8, r.fin, { align: 'right' }); // total à droite, au-dessus de la longueur
    }
    const L = e.L ? `${String(Math.round(e.L * 10) / 10).replace('.', ',')} m` : '? m';
    p.rgb([0.66, 0.27, 0.04], false).text(x0 + w - pad, yHaut - h + pad * 0.9, f, L, { bold: true, align: 'right' });
  }
  for (const n of data.noeuds) {
    const c = hexRgb(n.couleur), [cx, cy] = P(n.x, n.y), w = n.w * s, h = n.h * s;
    p.rgb([1, 1, 1], false).rgb(c).width(Math.max(0.6, 2.4 * s));
    // sortie : forme en flèche ; le fond teinté suit la même forme (rentrée d'un
    // trait), il ne déborde plus de la pointe
    const fleche = (i) => [[cx - w / 2 + i, cy - h / 2 + i], [cx + w / 2 - 12 * s - i * 0.4, cy - h / 2 + i], [cx + w / 2 - i * 1.6, cy],
      [cx + w / 2 - 12 * s - i * 0.4, cy + h / 2 - i], [cx - w / 2 + i, cy + h / 2 - i]];
    if (n.type === 'sortie') p.poly(fleche(0), 'B');
    else p.rect(cx - w / 2, cy - h / 2, w, h, 'B');
    if (n.type === 'sortie') p.rgb(nuance(c, 1.85), false).poly(fleche(1.2 * s), 'f');
    else p.rgb(nuance(c, 1.85), false).rect(cx - w / 2 + 1.2 * s, cy - h / 2 + 1.2 * s, w - 2.4 * s, h - 2.4 * s, 'f');
    p.rgb([0.1, 0.1, 0.1], false).text(cx - (n.type === 'sortie' ? 5 * s : 0), cy + (n.sous ? 1.5 * s : -4.5 * s), 15 * s, n.nom, { align: 'center', bold: true });
    if (n.sous) p.rgb([0.62, 0.26, 0.04], false).text(cx, cy - 13 * s, 10 * s, n.sous, { align: 'center' });
  }
  return { s, ox, oy };
}
// Formats de page (pt, paysage) pour le synoptique.
const FORMATS_PAGE = { a4: [842, 595], a3: [1191, 842], a2: [1684, 1191], a1: [2384, 1684], a0: [3370, 2384] };

// ─── Page chambre A3 (mise en page choisie dans l'atelier) ──────────────────
// Grille 12 × 8 : vue de dessus à gauche, masques des côtés 1 à 4 en 2 × 2 à
// droite, contenu des fourreaux en bas à gauche, câbles par liaison et
// cartouche en bas à droite.
// Grille 12 × 8 (validée dans l'atelier) : situation dans le réseau à gauche,
// masques des côtés 1 à 4 en 2 × 2 à droite, contenu des fourreaux en bas à
// gauche, cartouche personnalisable en bas à droite.
const MISE_EN_PAGE_CHAMBRE = [
  { type: 'situation', x: 0, y: 0, w: 5, h: 4.7 },
  { type: 'masque', cote: 1, x: 5, y: 0, w: 3.5, h: 2.35 }, { type: 'masque', cote: 2, x: 8.5, y: 0, w: 3.5, h: 2.35 },
  { type: 'masque', cote: 3, x: 5, y: 2.35, w: 3.5, h: 2.35 }, { type: 'masque', cote: 4, x: 8.5, y: 2.35, w: 3.5, h: 2.35 },
  { type: 'contenu', x: 0, y: 4.7, w: 8.5, h: 3.3 }, { type: 'cartouche', x: 8.5, y: 4.7, w: 3.5, h: 3.3 },
];
const FACE_DU_COTE = { 1: 'longPanB', 2: 'pignonB', 3: 'longPanA', 4: 'pignonA' };
// Teinte légère par côté : en-tête du masque et lignes du tableau (1 rouge, 2 vert, 3 bleu, 4 ambre)
const TEINTE_COTE = { 1: [0.984, 0.89, 0.882], 2: [0.886, 0.953, 0.898], 3: [0.882, 0.922, 0.98], 4: [0.984, 0.937, 0.835] };
const TEINTE_LIGNE = { 1: [0.992, 0.945, 0.94], 2: [0.94, 0.976, 0.949], 3: [0.94, 0.961, 0.992], 4: [0.992, 0.969, 0.918] };
const couper = (t, taille, largeur) => { t = String(t); const n = Math.max(3, Math.floor(largeur / (taille * 0.5))); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// Couleur CSS (#rrggbb, rgb(), hsl()) → [r, g, b] entre 0 et 1 ; null si illisible.
function cssRgb(c) {
  const s0 = String(c || '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s0);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(s0);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%/i.exec(s0);
  if (m) {
    const h = +m[1] / 360, sa = +m[2] / 100, l = +m[3] / 100, q = l < 0.5 ? l * (1 + sa) : l + sa - l * sa, pp = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  }
  return null;
}
// Phase d'un câble d'après sa couleur (convention de l'app : marron L1, noir L2, gris L3, vert-jaune PE, bleu N)
function phaseDeCouleur(rgb) {
  if (!rgb) return null;
  const [r, g, b] = rgb, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx - mn < 0.08) return l < 0.35 ? 'L2' : 'L3';
  if (r > g && g > b && r - b > 0.15) return 'L1';
  if (g >= r && g > b) return 'PE';
  if (b > r && b > g) return 'N';
  return null;
}
// Câbles « 12×1x240 » → « 3×4×1x240 » (3 phases × 4 en parallèle) ; « 13×1x300 » → « 3×4×1x300 + 1×1x300 »
function sectionsParPhases(m) { // m : Map code → quantité (PE préfixé « PE »)
  return [...m].sort((a, b) => (a[0].startsWith('PE') - b[0].startsWith('PE')) || b[1] - a[1]).map(([k, q]) => {
    if (k.startsWith('PE')) return q === 1 ? k : `${q}×${k.slice(3)} PE`;
    if (q >= 3 && q % 3 === 0) return q === 3 ? `3×${k}` : `3×${q / 3}×${k}`;
    if (q > 3 && q % 3 === 1) return `${q === 4 ? '3' : `3×${(q - 1) / 3}`}×${k} + 1×${k}`;
    return `${q}×${k}`;
  }).join(' + ');
}

// Cartouche personnalisable : libellés et valeurs libres ; {projet} {chambre}
// {modele} {interieur} {tampons} {date} {indice} {format} {folio} sont remplis tout seuls.
const CARTOUCHE_DEFAUT = [
  { libelle: 'Projet', valeur: '{projet}', large: true }, { libelle: 'Objet', valeur: 'Étude de chambre {chambre}', large: true },
  { libelle: 'Chambre', valeur: '{modele}', large: true }, { libelle: 'Intérieur', valeur: '{interieur}' }, { libelle: 'Tampons', valeur: '{tampons}' },
  { libelle: 'Phase', valeur: '' }, { libelle: 'N° plan', valeur: '' }, { libelle: 'Indice', valeur: '{indice}' }, { libelle: 'Date', valeur: '{date}' },
  { libelle: 'Dessiné', valeur: '' }, { libelle: 'Vérifié', valeur: '' }, { libelle: 'Échelle', valeur: 'sans' }, { libelle: 'Format', valeur: '{format}' },
  { libelle: 'Folio', valeur: '{folio}' },
];
function remplirCartouche(champs, valeurs) {
  return (Array.isArray(champs) && champs.length ? champs : CARTOUCHE_DEFAUT).map((c) => ({
    libelle: String(c.libelle || ''), large: !!c.large,
    valeur: String(c.valeur == null ? '' : c.valeur).replace(/\{(\w+)\}/g, (t, k) => (valeurs[k] != null ? String(valeurs[k]) : t)),
  }));
}

// Situation de la chambre dans le réseau : le synoptique en bandes (comme la
// sortie A0), la chambre entourée en rouge avec ses côtés 1 (haut) à 4 (gauche).
// sit = { noeuds:[{nom,type,couleur,x,y,w,h}], troncons:[{a,b,e}], coupes, ys }
function drawSituation(p, sit, nomChambre, z) {
  if (!sit || !sit.noeuds || !sit.noeuds.length || !sit.coupes) return;
  const bandes = sit.coupes.slice(0, -1).map((c0, b) => ({ c0, c1: sit.coupes[b + 1], y0: sit.ys[b][0], y1: sit.ys[b][1] }));
  const gap = 120, H = bandes.reduce((a, b) => a + (b.y1 - b.y0), 0) + gap * (bandes.length - 1), W = Math.max(...bandes.map((b) => b.c1 - b.c0)) + 160;
  const s = Math.min((z.w - 8) / W, (z.h - 8) / H), ox = z.x + (z.w - W * s) / 2 + 80 * s;
  let yHaut = z.y + z.h - (z.h - H * s) / 2; // haut de la bande courante (repère PDF)
  bandes.forEach((b, i) => {
    const hb = (b.y1 - b.y0) * s, yb = yHaut - hb;
    const X = (x) => ox + (x - b.c0) * s, Y = (y) => yb + (b.y1 - y) * s;
    const n0 = p.labels.length;
    p.clip([[ox, yb], [ox + (b.c1 - b.c0) * s, yb], [ox + (b.c1 - b.c0) * s, yHaut], [ox, yHaut]], () => {
      p.rgb([0.36, 0.39, 0.45]).width(Math.max(0.4, 4 * s));
      sit.troncons.forEach((t) => { if (!t.a || !t.b) return; p.line(X(t.a.x), Y(t.a.y), X(t.b.x), Y(t.a.y)).line(X(t.b.x), Y(t.a.y), X(t.b.x), Y(t.b.y)); });
      sit.troncons.forEach((t) => { const e = t.e; if (!e) return; p.rgb([1, 1, 1], false).rgb([0.8, 0.82, 0.86]).width(Math.max(0.2, 2 * s)).rect(X(e.x - e.w / 2), Y(e.y + e.h / 2), e.w * s, e.h * s, 'B'); });
      sit.noeuds.forEach((n) => {
        p.rgb([1, 1, 1], false).rgb(cssRgb(n.couleur) || [0.36, 0.42, 0.44]).width(Math.max(0.4, 4 * s)).rect(X(n.x - n.w / 2), Y(n.y + n.h / 2), n.w * s, n.h * s, 'B');
        const f = Math.min(7, 30 * s); if (f >= 2.2) p.rgb([0.1, 0.1, 0.1], false).text(X(n.x), Y(n.y) - f * 0.35, f, n.nom, { align: 'center', bold: true });
      });
    });
    const xd = ox + (b.c1 - b.c0) * s; // textes hors de la bande : écrits à part par jsPDF, le découpage ne les retient pas
    const garder = p.labels.slice(n0).filter((l) => l.y >= yb - 1 && l.y <= yHaut + 1 && l.x >= ox - 1 && l.x <= xd + 1); p.labels.length = n0; p.labels.push(...garder);
    if (i < bandes.length - 1) p.rgb([0.48, 0.51, 0.56], false).text(ox + (b.c1 - b.c0) * s + 3, yb + hb / 2 - 3, 9, '…', { bold: true });
    if (i > 0) p.rgb([0.48, 0.51, 0.56], false).text(ox - 9, yb + hb / 2 - 3, 9, '…', { bold: true });
    const n = sit.noeuds.find((x) => x.nom === nomChambre);
    if (n && n.x >= b.c0 && n.x <= b.c1) {
      const cx = X(n.x), cy = Y(n.y), rx = Math.max(10, n.w * s * 0.95), ry = Math.max(9, n.h * s * 1.6), k = 0.5523;
      p.rgb([0.85, 0.11, 0.11]).width(1.6);
      p.ops.push(`${(cx + rx).toFixed(2)} ${cy.toFixed(2)} m ${(cx + rx).toFixed(2)} ${(cy + ry * k).toFixed(2)} ${(cx + rx * k).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c ${(cx - rx * k).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy + ry * k).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c ${(cx - rx).toFixed(2)} ${(cy - ry * k).toFixed(2)} ${(cx - rx * k).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c ${(cx + rx * k).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy - ry * k).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c S`);
      // côtés : 1 en haut, 2 à droite, 3 en bas, 4 à gauche (nord = côté 1, partout)
      [[1, 0, ry], [2, rx, 0], [3, 0, -ry], [4, -rx, 0]].forEach(([k2, ex, ey]) => {
        p.rgb([0.1, 0.11, 0.12], false).rgb([1, 1, 1]).width(0.8).circle(cx + ex, cy + ey, 4.6, 'B');
        p.rgb([1, 1, 1], false).text(cx + ex, cy + ey - 2, 5.6, String(k2), { align: 'center', bold: true });
      });
      p.rgb([0.85, 0.11, 0.11], false).text(cx + rx + 7, cy + ry - 2, 8, n.nom, { bold: true });
    }
    yHaut = yb - gap * s;
  });
}

// Masque d'un côté, au rendu de la coupe de l'app (couleur et n° de chaque
// fourreau, câbles L1/L2/L3/PE), posé dans la face réelle de la chambre
// (long-pan L × H, pignon l × H, paroi en gris). Nappe centrée en largeur, son
// dessus à 250 mm sous le haut de la chambre (dégagement par défaut, à valider).
function drawMasqueFace(p, mq, cote, e, z) {
  const FW = cote % 2 ? e.L : e.l, FH = e.H, ep = Math.max(80, ((e.infos && e.infos.paroi) || 150) * 0.5);
  // 12 pt en bas pour la légende, 10 pt en haut pour le libellé de la face
  const s = Math.min(z.w / (FW + 2 * ep), (z.h - 22) / (FH + 2 * ep)), ox = z.x + (z.w - (FW + 2 * ep) * s) / 2 + ep * s, oy = z.y + 12 + (z.h - 22 - (FH + 2 * ep) * s) / 2 + ep * s;
  p.rgb([0.79, 0.77, 0.72], false).rgb([0.44, 0.42, 0.38]).width(0.6).rect(ox - ep * s, oy - ep * s, (FW + 2 * ep) * s, (FH + 2 * ep) * s, 'B');
  p.rgb([1, 1, 1], false).rect(ox, oy, FW * s, FH * s, 'B');
  p.rgb([0.29, 0.33, 0.41], false).text(ox + FW * s / 2, oy + (FH + ep) * s + 2.5, 6, `${cote % 2 ? 'Long-pan' : 'Pignon'} · ${FW} × ${FH} mm intérieur`, { align: 'center', bold: true });
  const nx = (FW - mq.largeur) / 2, nyHaut = Math.min(FH, Math.max(mq.hauteur, FH - 250)), ny = nyHaut - mq.hauteur; // bas de la nappe depuis le bas de la face
  const X = (x) => ox + (nx + x) * s, Y = (y) => oy + (ny + y) * s;
  p.rgb([0.69, 0.19, 0.16], false);
  if (nx > 40) p.text(ox + nx * s / 2, Y(mq.hauteur / 2) - 2, 5.5, String(Math.round(nx)), { align: 'center' });
  if (FH - nyHaut > 40) p.text(X(mq.largeur / 2), oy + (nyHaut + (FH - nyHaut) / 2) * s - 2, 5.5, String(Math.round(FH - nyHaut)), { align: 'center' });
  p.rgb([0.984, 0.965, 0.933], false).rgb([0.23, 0.25, 0.28]).width(0.6).rect(X(0), Y(0), mq.largeur * s, mq.hauteur * s, 'B');
  const ordre = [];
  (mq.cables || []).forEach((c) => { const l = String(c.liaison || '').replace(/\s*-\s*PE$/i, ''); if (l && !ordre.includes(l)) ordre.push(l); });
  const coulF = (f) => cssRgb(f.couleur) || COUL_LIAISON[Math.max(0, ordre.indexOf(String((f.liaisons || [])[0] || '').replace(/\s*-\s*PE$/i, ''))) % COUL_LIAISON.length];
  const fs = Math.max(4.5, Math.min(8, Math.max(mq.largeur, mq.hauteur) * s / 22));
  mq.fourreaux.forEach((f) => {
    const c = coulF(f), ro = f.od / 2 * s, ri = (f.di || f.od * 0.8) / 2 * s;
    p.rgb(nuance(c, 1.82), false).rgb(c).width(Math.max(0.5, 1.1 * s * 10)).circle(X(f.x), Y(f.y), ro, 'B');
    p.rgb([1, 1, 1], false).width(Math.max(0.3, 0.6 * s * 10)).circle(X(f.x), Y(f.y), ri, 'B');
    p.rgb([0.1, 0.11, 0.12], false).text(X(f.x), Y(f.y) + ro + 1.2, fs, String(f.id).replace(/^F/, ''), { align: 'center', bold: true });
  });
  (mq.cables || []).forEach((c) => {
    const rgb = cssRgb(c.couleur), ph = c.phase || phaseDeCouleur(rgb), col = rgb || PHASE_RGB[ph] || [0.5, 0.5, 0.5], r = c.od / 2 * s;
    p.rgb(col, false).rgb([0.04, 0.06, 0.08]).width(0.3).circle(X(c.x), Y(c.y), r, 'B');
    if (ph && r >= 2.6) p.rgb([1, 1, 1], false).text(X(c.x), Y(c.y) - r * 0.32, Math.min(r * 0.9, 5), ph, { align: 'center', bold: true });
  });
  // pied : récapitulatif et nappe
  const nb = new Map(); mq.fourreaux.forEach((f) => { const d = Math.round(f.od); nb.set(d, (nb.get(d) || 0) + 1); });
  p.rgb([0.29, 0.33, 0.41], false).text(z.x + 2, z.y + 2, 6.5, couper([...nb].sort((a, b) => b[0] - a[0]).map(([d, q]) => `${q}×Ø${d}`).join(' · '), 6.5, z.w * 0.62));
  p.rgb([0.69, 0.19, 0.16], false).text(z.x + z.w - 2, z.y + 2, 6.5, `nappe ${Math.round(mq.largeur)} × ${Math.round(mq.hauteur)} mm`, { align: 'right', bold: true });
}

// Lignes du tableau « contenu des fourreaux » : une par côté et par liaison.
function lignesContenuChambre(e, masques) {
  const lignes = [];
  for (let c = 1; c <= 4; c++) {
    const mq = (masques || {})[FACE_DU_COTE[c]]; if (!mq) continue;
    const parL = new Map(), od = new Map(mq.fourreaux.map((f) => [f.id, Math.round(f.od)]));
    (mq.cables || []).forEach((cb) => {
      const nom = String(cb.liaison || '').trim(); if (!nom) return;
      const base = nom.replace(/\s*-\s*PE$/i, ''), pe = base !== nom || cb.phase === 'PE' || cb.fonction === 'PE';
      if (!parL.has(base)) parL.set(base, { f: new Set(), cab: new Map() });
      const g = parL.get(base); if (cb.fourreau) g.f.add(cb.fourreau);
      const k = (pe ? 'PE ' : '') + (cb.code || `Ø${cb.od}`); g.cab.set(k, (g.cab.get(k) || 0) + 1);
    });
    [...parL].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })).forEach(([nom, g]) => {
      const ids = [...g.f].sort((a, b) => Number(String(a).slice(1)) - Number(String(b).slice(1)));
      const parOd = new Map(); ids.forEach((id) => { const d = od.get(id); if (d) parOd.set(d, (parOd.get(d) || 0) + 1); });
      lignes.push({ cote: c, cells: [`${e.nom}.${c}`, nomCourt(nom), ids.join(', '), [...parOd].sort((a, b) => b[0] - a[0]).map(([d, q]) => `${q}×Ø${d}`).join(' '), sectionsParPhases(g.cab)] });
    });
  }
  return lignes;
}

// Page A3 d'une chambre. opts = { projet, date, indice, situation, cartouche: { champs, logoMOA, logoMOE } }
// (logo : { src: dataURL ou octets, format: 'PNG'|'JPEG' }, rendu par l'écrivain du PDF via p.images).
function dessinerPageChambreA3(p, e, masques, opts = {}) {
  const [PW, PH] = FORMATS_PAGE.a3, M = 28, ENT = 34;
  const gx = M, gy = M, gw = PW - 2 * M, gh = PH - 2 * M - ENT, CW = gw / 12, CH = gh / 8, G = 5;
  const zone = (b) => ({ x: gx + b.x * CW + G / 2, y: gy + (8 - b.y - b.h) * CH + G / 2, w: b.w * CW - G, h: b.h * CH - G });
  const masquesM = masques || {}, etudeOk = e && e.ok;
  if (!p.images) p.images = [];
  enteteChambre(p, `${e.nom || 'Chambre'} — ${etudeOk ? e.ref : 'aucune chambre'}`, opts);
  const cadre = (z, titre, teinte) => {
    p.rgb([1, 1, 1], false).rgb([0.79, 0.81, 0.84]).width(0.7).rect(z.x, z.y, z.w, z.h, 'B');
    if (!titre) return { ...z };
    p.rgb(teinte || [0.93, 0.945, 0.965], false).rect(z.x + 0.35, z.y + z.h - 15, z.w - 0.7, 14.65, 'f');
    p.rgb([0.1, 0.1, 0.1], false).text(z.x + 6, z.y + z.h - 11, 8.5, couper(titre, 8.5, z.w - 12), { bold: true });
    return { x: z.x + 4, y: z.y + 4, w: z.w - 8, h: z.h - 23 };
  };
  for (const b of MISE_EN_PAGE_CHAMBRE) {
    const z = zone(b);
    if (b.type === 'situation') {
      const zi = cadre(z, 'Situation dans le réseau');
      drawSituation(p, opts.situation, e.nom, zi);
    } else if (b.type === 'masque') {
      const mq = masquesM[FACE_DU_COTE[b.cote]];
      const L = mq && mq.longueurM ? ` · ${String(mq.longueurM).replace('.', ',')} m` : '';
      const zi = cadre(z, `${e.nom || 'C'}.${b.cote} · ${mq ? mq.nom + L : 'côté libre'}`, TEINTE_COTE[b.cote]);
      if (mq && etudeOk) drawMasqueFace(p, mq, b.cote, e, zi);
    } else if (b.type === 'contenu') {
      const zi = cadre(z, 'Contenu des fourreaux, par côté et par liaison');
      // ce qui ne tient pas part sur une page dédiée (dessinerPageContenuA3)
      p.lignesRestantes = tableauQuadrille(p, zi, ENTETES_CONTENU, PARTS_CONTENU, lignesContenuChambre(e, masquesM), 'suite sur la page suivante');
    } else if (b.type === 'cartouche') {
      cadre(z, null);
      dessinerCartouche(p, { x: z.x + 5, y: z.y + 5, w: z.w - 10, h: z.h - 10 }, opts.cartouche || {}, valeursCartouche(e, opts));
    }
  }
  return p;
}
function valeursCartouche(e, opts) {
  const ok2 = e && e.ok;
  return {
    projet: opts.projet || '', chambre: e.nom || '', modele: ok2 ? e.ref : '—', date: opts.date || '', indice: opts.indice || 'A', format: 'A3',
    interieur: ok2 ? `${e.L} × ${e.l} × ${e.H} mm` : '—',
    tampons: ok2 && e.infos && e.infos.tampon && e.infos.tampons ? `${e.infos.tampons} × ${e.infos.tampon.L}×${e.infos.tampon.l} ${e.infos.tampon.classe}` : '—',
    folio: opts.folio ? `${opts.folio.i} / ${opts.folio.n}` : '1 / 1',
  };
}
// En-tête d'une page chambre : titre, projet, et « Folio i / n » quand la chambre tient sur plusieurs pages.
function enteteChambre(p, titre, opts) {
  const [PW, PH] = FORMATS_PAGE.a3, M = 28;
  p.rgb([0.1, 0.1, 0.1], false).text(M, PH - M - 16, 18, titre, { bold: true });
  const folio = opts.folio && opts.folio.n > 1 ? `Folio ${opts.folio.i} / ${opts.folio.n}  ·  ` : '';
  p.rgb([0.35, 0.35, 0.35], false).text(PW - M, PH - M - 16, 9, `${folio}${opts.projet || ''} · nodial — étude de chambre`, { align: 'right' });
  p.rgb([0.72, 0.3, 0.07]).width(1.2).line(M, PH - M - 24, PW - M, PH - M - 24);
}
// Toutes les pages d'une chambre : la page principale puis, si le tableau
// déborde, des pages de suite (tableau + même cartouche), numérotées en folios.
// nouvellePage() → Page vierge (selon l'écrivain : jsPDF ou PDF brut).
function pagesChambreA3(e, masques, opts, nouvellePage) {
  const essai = (folio) => {
    const pages = [], o = { ...opts, folio };
    const p0 = nouvellePage(); dessinerPageChambreA3(p0, e, masques, o); pages.push(p0);
    let reste = p0.lignesRestantes || [];
    while (reste.length && pages.length < 50) { const ps = nouvellePage(); reste = dessinerPageContenuA3(ps, e, reste, { ...o, folio: folio && { ...folio, i: pages.length + 1 } }); pages.push(ps); }
    return pages;
  };
  const n = essai(null).length;
  return n > 1 ? essai({ i: 1, n }) : essai(null);
}
const ENTETES_CONTENU = ['Masque', 'Liaison', 'N° fourreaux', 'Fourreaux', 'Câbles'], PARTS_CONTENU = [0.08, 0.26, 0.17, 0.2, 0.29];
// Page dédiée à la suite du tableau « contenu des fourreaux » d'une chambre.
// Retourne les lignes qui ne tiennent toujours pas (page suivante à créer).
function dessinerPageContenuA3(p, e, lignes, opts = {}) {
  const [PW, PH] = FORMATS_PAGE.a3, M = 28, ENT = 34, gw = PW - 2 * M, gh = PH - 2 * M - ENT, CW = gw / 12, CH = gh / 8, G = 5;
  if (!p.images) p.images = [];
  enteteChambre(p, `${e.nom || 'Chambre'} — contenu des fourreaux (suite)`, opts);
  // tableau sur 8,5 colonnes et toute la hauteur ; cartouche au même endroit que sur la page principale
  const zt = { x: M + G / 2, y: M + G / 2, w: 8.5 * CW - G, h: gh - G };
  p.rgb([1, 1, 1], false).rgb([0.79, 0.81, 0.84]).width(0.7).rect(zt.x, zt.y, zt.w, zt.h, 'B');
  p.rgb([0.93, 0.945, 0.965], false).rect(zt.x + 0.35, zt.y + zt.h - 15, zt.w - 0.7, 14.65, 'f');
  p.rgb([0.1, 0.1, 0.1], false).text(zt.x + 6, zt.y + zt.h - 11, 8.5, 'Contenu des fourreaux, par côté et par liaison (suite)', { bold: true });
  const reste = tableauQuadrille(p, { x: zt.x + 4, y: zt.y + 4, w: zt.w - 8, h: zt.h - 23 }, ENTETES_CONTENU, PARTS_CONTENU, lignes, 'suite sur la page suivante');
  const zc = { x: M + 8.5 * CW + G / 2, y: M + G / 2, w: 3.5 * CW - G, h: 3.3 * CH - G };
  p.rgb([1, 1, 1], false).rgb([0.79, 0.81, 0.84]).width(0.7).rect(zc.x, zc.y, zc.w, zc.h, 'B');
  dessinerCartouche(p, { x: zc.x + 5, y: zc.y + 5, w: zc.w - 10, h: zc.h - 10 }, opts.cartouche || {}, valeursCartouche(e, opts));
  return reste;
}
// Cartouche : logo MOA en haut à gauche, logo MOE en haut à droite (carrés),
// puis les champs (pleine largeur, ou deux par ligne).
function dessinerCartouche(p, z, cart, valeurs) {
  const cote = Math.min(58, z.h * 0.3), yLogo = z.y + z.h - cote;
  [['MOA', cart.logoMOA, z.x], ['MOE', cart.logoMOE, z.x + z.w - cote]].forEach(([nom, logo, x]) => {
    if (logo && logo.src) { if (!p.images) p.images = []; p.images.push({ src: logo.src, format: logo.format, x, y: yLogo, w: cote, h: cote }); }
    else {
      p.rgb([0.6, 0.64, 0.69]).width(0.6).dash(true).rect(x, yLogo, cote, cote, 'S').dash(false);
      p.rgb([0.48, 0.51, 0.56], false).text(x + cote / 2, yLogo + cote / 2 - 3, 7.5, `Logo ${nom}`, { align: 'center', bold: true });
    }
  });
  p.rgb([0.48, 0.51, 0.56], false).text(z.x + z.w / 2, yLogo + cote / 2 - 3, 6.5, 'Maître d’ouvrage · Maître d’œuvre', { align: 'center' });
  const champs = remplirCartouche(cart.champs, valeurs);
  const rangees = []; let cur = [];
  champs.forEach((c) => { if (c.large) { if (cur.length) { rangees.push(cur); cur = []; } rangees.push([c]); } else { cur.push(c); if (cur.length === 2) { rangees.push(cur); cur = []; } } });
  if (cur.length) rangees.push(cur);
  const haut = yLogo - 6, lh = Math.min(24, (haut - z.y) / Math.max(1, rangees.length)), fl = Math.min(8.5, lh * 0.5);
  rangees.forEach((r, i) => {
    const y = haut - (i + 1) * lh, n = r.length, wc = z.w / n;
    r.forEach((c, k) => {
      const x = z.x + k * wc, wl = Math.min(wc * 0.42, 62);
      p.rgb([0.965, 0.97, 0.976], false).rgb([0.81, 0.83, 0.86]).width(0.5).rect(x, y, wl, lh, 'B');
      p.rgb([1, 1, 1], false).rect(x + wl, y, wc - wl, lh, 'B');
      p.rgb([0.29, 0.33, 0.41], false).text(x + 3, y + lh / 2 - fl * 0.35, fl, couper(c.libelle, fl, wl - 5));
      p.rgb([0.1, 0.1, 0.1], false).text(x + wl + 3, y + lh / 2 - fl * 0.35, fl, couper(c.valeur, fl, wc - wl - 5), { bold: true });
    });
  });
}
// Tableau quadrillé (traits de colonne et de ligne), lignes teintées par côté.
function tableauQuadrille(p, z, entetes, parts, lignes, renvoi) {
  const f = 6.8, lh = 9.4, x0 = z.x, w = z.w, xs = []; let acc = x0;
  parts.forEach((q) => { xs.push(acc); acc += q * w; }); xs.push(x0 + w);
  let y = z.y + z.h - lh;
  const max = Math.max(1, Math.floor((z.h - lh) / lh));
  const vis = lignes.length > max ? lignes.slice(0, max - 1) : lignes, reste = lignes.slice(vis.length);
  p.rgb([0.953, 0.961, 0.973], false).rect(x0, y, w, lh, 'f');
  entetes.forEach((t, i) => p.rgb([0.18, 0.2, 0.25], false).text(xs[i] + 3, y + 3, f, t, { bold: true }));
  vis.forEach((l) => {
    y -= lh;
    p.rgb(TEINTE_LIGNE[l.cote] || [1, 1, 1], false).rect(x0, y, w, lh, 'f');
    l.cells.forEach((c, i) => p.rgb(i === 0 ? [0.1, 0.1, 0.1] : i === 2 ? [0.72, 0.3, 0.07] : i === 4 ? [0.42, 0.25, 0.08] : [0.18, 0.2, 0.25], false)
      .text(xs[i] + 3, y + 3, f, couper(c, f, parts[i] * w - 6), { bold: i === 0 || i === 2 }));
  });
  // quadrillage
  p.rgb([0.81, 0.83, 0.86]).width(0.5);
  const yb = y; for (let k = 0; k <= vis.length + 1; k++) p.line(x0, yb + k * lh, x0 + w, yb + k * lh);
  xs.forEach((x) => p.line(x, yb, x, z.y + z.h));
  if (reste.length) p.rgb([0.55, 0.2, 0.1], false).text(x0 + 3, yb - 8, f, `… ${reste.length} ligne${reste.length > 1 ? 's' : ''} de plus : ${renvoi || 'voir les tableaux détaillés du rapport'}`);
  return reste;
}
// Petit tableau dans une case (texte tronqué ; « … et n autres » si ça déborde).
function tableauPdf(p, z, entetes, parts, lignes) {
  const f = 6.6, lh = 8.6, x0 = z.x + 4, w = z.w - 8;
  let y = z.y + z.h - 15 - 11;
  const xs = []; let acc = x0; parts.forEach((q) => { xs.push(acc); acc += q * w; });
  p.rgb([0.25, 0.27, 0.32], false);
  entetes.forEach((t, i) => p.text(xs[i] + 2, y, f, t, { bold: true }));
  p.rgb([0.8, 0.82, 0.86]).width(0.4).line(x0, y - 2.5, x0 + w, y - 2.5);
  y -= lh + 1;
  const max = Math.floor((y - z.y - 4) / lh) + 1;
  const vis = lignes.length > max ? lignes.slice(0, max - 1) : lignes;
  vis.forEach((l, k) => {
    if (k % 2) p.rgb([0.96, 0.97, 0.98], false).rect(x0, y - 2.4, w, lh, 'f');
    l.forEach((c, i) => p.rgb(i === 0 ? [0.1, 0.1, 0.1] : [0.2, 0.22, 0.26], false).text(xs[i] + 2, y, f, couper(c, f, parts[i] * w - 4), { bold: i === 0 }));
    y -= lh;
  });
  if (lignes.length > vis.length) p.rgb([0.55, 0.2, 0.1], false).text(x0 + 2, y, f, `… et ${lignes.length - vis.length} autres lignes (voir les tableaux détaillés du rapport)`);
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
function drawSynoptiqueIso(p, data, zx, zy, zw, zh, { echelleMax = 1.8 } = {}) {
  if (!data.noeuds.length) return;
  const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6);
  const iso = (x, y, z) => [(x - y) * C, -(x + y) * S + z];
  // Volumes proportionnés aux éléments du synoptique 2D (w × h, mêmes positions) ;
  // à défaut (ancien appel), tailles fixes.
  const DEF = { chambre: [64, 40, 26], coffret: [30, 22, 60], sortie: [14, 14, 34] };
  const dimsDe = (n) => {
    if (!(n.w > 0 && n.h > 0)) return DEF[n.type] || DEF.sortie;
    if (n.type === 'chambre') return [n.w * 0.8, n.h * 0.8, n.h * 0.55];
    if (n.type === 'coffret') return [n.w * 0.45, n.h * 0.55, n.h * 1.3];
    return [n.h * 0.45, n.h * 0.45, n.h * 0.9];
  };
  const unite = data.noeuds.some((n) => n.w > 0) ? 1.9 : 1; // tranchées à l'échelle des volumes
  // cadrage sur l'emprise projetée
  const pts = [];
  data.noeuds.forEach((n) => { const [a, b, h] = dimsDe(n); [[-a, -b, 0], [a, b, 0], [-a, b, h], [a, -b, h]].forEach(([dx, dy, z]) => pts.push(iso(n.x + dx / 2, n.y + dy / 2, z + 18 * unite))); });
  const X0 = Math.min(...pts.map((q) => q[0])) - 20, X1 = Math.max(...pts.map((q) => q[0])) + 20;
  const Y0 = Math.min(...pts.map((q) => q[1])) - 20, Y1 = Math.max(...pts.map((q) => q[1])) + 20;
  // marge pour les étiquettes (taille fixe en points, elles débordent des volumes)
  const MX = Math.min(90, zw * 0.12), MY = Math.min(40, zh * 0.08);
  const s = Math.min((zw - 2 * MX) / (X1 - X0), (zh - 2 * MY) / (Y1 - Y0), echelleMax);
  const ox = zx + (zw - (X1 - X0) * s) / 2 - X0 * s, oy = zy + (zh - (Y1 - Y0) * s) / 2 - Y0 * s;
  const P = (x, y, z = 0) => { const [u, v] = iso(x, y, z); return [ox + u * s, oy + v * s]; };
  const LARG = 7 * unite, HAUT = 6 * unite; // demi-largeur et demi-hauteur des tranchées
  // Point de raccordement d'un bout de tranchée : sur la face de la chambre
  // (pignon A/B, long-pan A/B), à mi-hauteur du caisson ; au pied sinon.
  const bout = (e) => {
    // coffret / sortie : les fourreaux remontent par le dessous → arrivée sous le
    // centre du socle, tranchée enterrée (dessus au niveau du sol)
    if (e.type !== 'chambre') return { x: e.x, y: e.y, z: -HAUT };
    const [a, b, h] = dimsDe(e), z = -8 * unite + h / 2;
    const off = { pignonA: [-a / 2, 0], pignonB: [a / 2, 0], longPanA: [0, b / 2], longPanB: [0, -b / 2] }[e.face] || [0, 0];
    return { x: e.x + off[0], y: e.y + off[1], z };
  };
  // Tracé d'une tranchée : sortie perpendiculaire au côté de la chambre, puis
  // virages à angle droit jusqu'à l'autre bout (plus de diagonale qui part du côté).
  const NORMALE = { pignonA: [-1, 0], pignonB: [1, 0], longPanA: [0, 1], longPanB: [0, -1] };
  const SORTIE = 30 * unite; // longueur droite à la sortie d'une face
  function trace(t) {
    const A = bout(t.a), B = bout(t.b);
    const na = t.a.type === 'chambre' && NORMALE[t.a.face], nb = t.b.type === 'chambre' && NORMALE[t.b.face];
    const A2 = na ? { x: A.x + na[0] * SORTIE, y: A.y + na[1] * SORTIE } : { x: A.x, y: A.y };
    const B2 = nb ? { x: B.x + nb[0] * SORTIE, y: B.y + nb[1] * SORTIE } : { x: B.x, y: B.y };
    // premier virage : on prolonge d'abord dans l'axe de la sortie de A
    const horizA = na ? na[0] !== 0 : Math.abs(B2.x - A2.x) >= Math.abs(B2.y - A2.y);
    const coude = horizA ? { x: B2.x, y: A2.y } : { x: A2.x, y: B2.y };
    const pts = [A, A2, coude, B2, B].map((q) => ({ x: q.x, y: q.y }));
    const net = pts.filter((q, k) => k === 0 || Math.hypot(q.x - pts[k - 1].x, q.y - pts[k - 1].y) > 0.5);
    // hauteur interpolée le long du tracé
    let L = 0; const cum = net.map((q, k) => (k ? (L += Math.hypot(q.x - net[k - 1].x, q.y - net[k - 1].y)) : 0));
    return net.map((q, k) => ({ ...q, z: A.z + (B.z - A.z) * (L ? cum[k] / L : 0) }));
  }
  // Un tronçon droit de tranchée en volume (prisme de terre) ; ext* : prolongé
  // d'une demi-largeur pour fermer les coudes.
  const vue = (vx, vy) => vx + vy; // > 0 : tourné vers l'observateur (x + y croissant)
  function segment(A0, B0, extA, extB, finA, finB) {
    const dx0 = B0.x - A0.x, dy0 = B0.y - A0.y, L0 = Math.hypot(dx0, dy0) || 1, ux = dx0 / L0, uy = dy0 / L0;
    const A = { ...A0, x: A0.x - (extA ? ux * LARG : 0), y: A0.y - (extA ? uy * LARG : 0) };
    const B = { ...B0, x: B0.x + (extB ? ux * LARG : 0), y: B0.y + (extB ? uy * LARG : 0) };
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L * LARG, ny = dx / L * LARG;
    const coin = (E, sgn, dz) => P(E.x + sgn * nx, E.y + sgn * ny, E.z + dz);
    const terre = MAT.terre, bord = [0.3, 0.22, 0.15];
    const sg = vue(nx, ny) >= 0 ? 1 : -1;
    p.texture([coin(A, sg, -HAUT), coin(B, sg, -HAUT), coin(B, sg, HAUT), coin(A, sg, HAUT)], nuance(terre, 0.78), { seed: 33, taille: 0.6, contour: bord });
    [[B, finB, 1], [A, finA, -1]].forEach(([E, fin, sens]) => {
      if (!fin || vue(dx * sens, dy * sens) <= 0) return;
      p.texture([coin(E, 1, -HAUT), coin(E, -1, -HAUT), coin(E, -1, HAUT), coin(E, 1, HAUT)], nuance(terre, 0.66), { seed: 34, taille: 0.6, contour: bord });
    });
    p.texture([coin(A, 1, HAUT), coin(B, 1, HAUT), coin(B, -1, HAUT), coin(A, -1, HAUT)], nuance(terre, 1.08), { seed: 31, taille: 0.6, contour: bord });
    p.rgb([0.85, 0.12, 0.1]).width(0.9).line(...P(A0.x, A0.y, A0.z + HAUT + 0.3), ...P(B0.x, B0.y, B0.z + HAUT + 0.3)); // grillage
  }
  // Étiquettes sans chevauchement : celles des éléments d'abord (fixes), puis
  // celles des tronçons, placées au premier endroit libre le long du tracé.
  const occupes = [];
  const chevauche = (r) => occupes.reduce((acc, o) => {
    const ix = Math.min(r.x1, o.x1) - Math.max(r.x0, o.x0), iy = Math.min(r.y1, o.y1) - Math.max(r.y0, o.y0);
    return acc + (ix > 0 && iy > 0 ? ix * iy : 0);
  }, 0);
  const tailleCartouche = (label) => { const l = Array.isArray(label) ? label : [String(label)]; return [Math.max(...l.map((x) => x.length)) * 4.3 + 12, l.length * 9.5 + 5]; };
  const etiquettesTroncons = [];
  function placerEtiquetteTroncon(t, pts) {
    const [w, h] = tailleCartouche(t.label);
    // segments du plus long au plus court, positions du milieu vers les bouts
    const segs = pts.slice(1).map((q, k) => ({ a: pts[k], b: q, L: Math.hypot(q.x - pts[k].x, q.y - pts[k].y) })).sort((u, v) => v.L - u.L);
    let best = null;
    const decalages = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2], [2, 0], [-2, 0]];
    for (const sg of segs) {
      for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        for (const [ox2, oy2] of decalages) {
          const x = sg.a.x + (sg.b.x - sg.a.x) * f, y = sg.a.y + (sg.b.y - sg.a.y) * f, z = sg.a.z + (sg.b.z - sg.a.z) * f;
          const [cx, cy] = P(x, y, z + HAUT + 12), mx = cx + ox2 * (w / 2 + 8), my = cy + oy2 * (h + 4);
          const r = { x0: mx - w / 2 - 2, x1: mx + w / 2 + 2, y0: my - h / 2 - 2, y1: my + h / 2 + 2 };
          const c = chevauche(r);
          if (!best || c < best.c) best = { c, mx, my, r, cx, cy, decale: ox2 !== 0 || oy2 !== 0 };
          if (c === 0) break;
        }
        if (best.c === 0) break;
      }
      if (best && best.c === 0) break;
    }
    if (best) {
      occupes.push(best.r);
      etiquettesTroncons.push(() => {
        if (best.decale) { // trait de rappel vers la tranchée
          const bx = Math.max(best.r.x0 + 2, Math.min(best.r.x1 - 2, best.cx)), by = Math.max(best.r.y0 + 2, Math.min(best.r.y1 - 2, best.cy));
          p.rgb([0.45, 0.45, 0.45]).width(0.6).line(bx, by, best.cx, best.cy);
          p.rgb([0.45, 0.45, 0.45], false).circle(best.cx, best.cy, 1.6, 'F');
        }
        cartouche(p, best.mx, best.my, t.label);
      });
    }
  }
  function tranchee(t) { // conservé pour l'ordre de dessin : un élément par segment
    const pts = trace(t);
    return pts.slice(1).map((q, k) => ({
      cle: (pts[k].x + pts[k].y + q.x + q.y) / 2,
      dessiner: () => segment(pts[k], q, k > 0, k < pts.length - 2, k === 0 && t.a.type !== 'chambre', k === pts.length - 2 && t.b.type !== 'chambre'),
    }));
  }
  function volume(n) {
    const [a, b, h] = dimsDe(n), c = hexRgb(n.couleur);
    const x0 = n.x - a / 2, x1 = n.x + a / 2, y0 = n.y - b / 2, y1 = n.y + b / 2;
    const z0 = n.type === 'chambre' ? -8 * unite : 0, z1 = z0 + h;
    const mat = n.type === 'chambre' ? MAT.beton : c;
    p.texture([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], nuance(mat, 0.72), { seed: 41, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    p.texture([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], nuance(mat, 0.88), { seed: 42, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    p.texture([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], nuance(mat, 1.12), { seed: 43, taille: 0.6, contour: [0.25, 0.25, 0.25] });
    if (n.type === 'chambre') { // tampon de la couleur de la chambre
      p.rgb(nuance(c, 0.9), false).rgb([0.2, 0.2, 0.2]).width(0.6)
        .poly([P(x0 + 6, y0 + 6, z1 + 0.5), P(x1 - 6, y0 + 6, z1 + 0.5), P(x1 - 6, y1 - 6, z1 + 0.5), P(x0 + 6, y1 - 6, z1 + 0.5)], 'B');
    }
    const [tx, ty] = n._etiq || P(n.x, n.y, z1 + 14);
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
  // réserve des étiquettes d'éléments (fixes), puis placement de celles des tronçons
  data.noeuds.forEach((n) => {
    const [, , h0] = dimsDe(n), z1 = (n.type === 'chambre' ? -8 * unite : 0) + h0;
    const [tx0, ty0] = P(n.x, n.y, z1 + 14), w = Math.max(n.nom.length * 5.4, (n.sous || '').length * 3.9) + 12, h = n.sous ? 22 : 14;
    const rect = (tx, ty) => ({ x0: tx - w / 2 - 3, x1: tx + w / 2 + 3, y0: ty - h + 7, y1: ty + 13 });
    let best = null; // au-dessus du volume de préférence, sinon décalé
    for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [1, 0], [-1, 0], [1, 1], [-1, 1], [0, -2]]) {
      const tx = tx0 + dx * (w / 2 + 10), ty = ty0 + dy * (h + 6), c = chevauche(rect(tx, ty));
      if (!best || c < best.c) best = { c, tx, ty };
      if (c === 0) break;
    }
    n._etiq = [best.tx, best.ty]; occupes.push(rect(best.tx, best.ty));
  });
  data.troncons.forEach((t) => placerEtiquetteTroncon(t, trace(t)));
  const elements = [
    ...data.troncons.flatMap((t) => tranchee(t)),
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
  etiquettesTroncons.forEach((f) => f());
  etiquettes.forEach((f) => f());
}

// Coupes en largeur (unités du schéma) tous les Wu au plus, dans un espace libre
// (jamais au milieu d'un élément ou d'une étiquette).
function couperEnLargeur(data, Wu) {
  const pris = [];
  data.noeuds.forEach((n) => pris.push([n.x - n.w / 2 - 34, n.x + n.w / 2 + 34])); // + poignée « + »
  data.troncons.forEach((t) => { if (t.e) pris.push([t.e.x - t.e.w / 2 - 8, t.e.x + t.e.w / 2 + 8]); });
  const libre = (x) => pris.every(([a, b]) => x <= a || x >= b);
  const coupes = [0];
  while (data.largeur - coupes[coupes.length - 1] > Wu + 1e-6) {
    const c = coupes[coupes.length - 1], cible = c + Wu;
    let x = null;
    for (let v = cible; v > c + Wu * 0.4; v -= 4) if (libre(v)) { x = v; break; }
    coupes.push(x == null ? cible : x);
  }
  coupes.push(data.largeur);
  return coupes;
}
// Liaisons coupées (segments horizontaux du dessin) → renvois numérotés R1, R2…
function renvoisCoupes(data, coupes) {
  const renvois = [];
  data.troncons.forEach((t) => {
    const x0 = Math.min(t.a.x, t.b.x), x1 = Math.max(t.a.x, t.b.x), y = t.a.y;
    coupes.slice(1, -1).forEach((c) => { if (c > x0 && c < x1) renvois.push({ x: c, y, n: renvois.length + 1 }); });
  });
  return renvois;
}

// ─── Synoptique en BANDES sur une grande feuille ──────────────────────────
// Toujours la même ligne, coupée en bandes empilées : on part en haut à gauche,
// « … » + renvois au bout d'une bande, on repart à gauche sur la bande du
// dessous. Échelle la plus grande (texte ≤ texteMax) pour laquelle toutes les
// bandes tiennent sur la feuille ; sinon texte minimal et plusieurs feuilles.
function decouperBandes(data, fmt, { texteMax = 10, texteMin = 7 } = {}) {
  const [PW, PH] = FORMATS_PAGE[fmt] || FORMATS_PAGE.a0, k = PW / PAGE_W, M = MARGE * k;
  const bandeTitre = 30 * k, bandePied = 18, garde = 46, ecartB = 28;
  const zx = M, zy = M + bandePied, zw = PW - 2 * M, zh = PH - 2 * M - bandeTitre - bandePied;
  // hauteur propre à chaque bande : seulement ce qui tombe dans sa tranche [c0, c1]
  const boites = [];
  data.noeuds.forEach((n) => boites.push([n.x - n.w / 2, n.x + n.w / 2 + 30, n.y - n.h / 2, n.y + n.h / 2]));
  data.troncons.forEach((t) => { if (t.e) boites.push([t.e.x - t.e.w / 2, t.e.x + t.e.w / 2, t.e.y - t.e.h / 2, t.e.y + t.e.h / 2]); });
  const etendue = (c0, c1) => {
    let y0 = Infinity, y1 = -Infinity;
    boites.forEach(([a, b, h0, h1]) => { if (b > c0 && a < c1) { y0 = Math.min(y0, h0); y1 = Math.max(y1, h1); } });
    return Number.isFinite(y0) ? [y0 - 14, y1 + 14] : [0, data.hauteur];
  };
  const essai = (s2) => {
    const coupes = couperEnLargeur(data, (zw - 2 * garde) / s2), n = coupes.length - 1;
    const ys = coupes.slice(0, -1).map((c, b) => etendue(c, coupes[b + 1]));
    // bandes rangées feuille par feuille, de haut en bas
    const feuille = [], places = []; let f = 0, h = 0;
    ys.forEach(([y0, y1]) => {
      const hb = (y1 - y0) * s2, besoin = (h ? ecartB : 0) + hb;
      if (h && h + besoin > zh) { f += 1; h = 0; }
      places.push({ f, haut: h ? h + ecartB : 0, hb }); h += (h ? ecartB : 0) + hb; feuille[f] = h;
    });
    return { s: s2, coupes, bandes: n, ys, places, feuilles: f + 1 };
  };
  const sMax = Math.min(texteMax / SYN.police, zh / data.hauteur), sMin = texteMin / SYN.police;
  let r = null;
  for (let s2 = sMax; s2 >= sMin * 0.999; s2 *= 0.96) { const e = essai(s2); if (e.feuilles === 1) { r = e; break; } }
  if (!r) r = essai(Math.min(sMax, sMin));
  return { fmt, PW, PH, k, M, bandeTitre, bandePied, garde, ecartB, zx, zy, zw, zh, ...r, folios: r.bandes, texte: SYN.police * r.s };
}
// Format conseillé en bandes : le plus petit où tout tient sur UNE feuille lisible.
function formatOptimalBandes(data, { texteMin = 7 } = {}) {
  const essais = ['a4', 'a3', 'a2', 'a1', 'a0'].map((f) => decouperBandes(data, f, { texteMin }));
  return essais.find((d) => d.feuilles === 1 && d.texte >= texteMin) || essais[essais.length - 1];
}
function synoptiqueEnBandes(data, fmt, titre, opts = {}) {
  const D = decouperBandes(data, fmt, opts);
  const { PW, PH, k, M, garde, ecartB, zx, zy, zh, s, coupes, ys, places, feuilles } = D, N = coupes.length - 1;
  const renvois = renvoisCoupes(data, coupes), pages = [];
  for (let f = 0; f < feuilles; f++) {
    const p = new Page({ emitText: false, ombre: false });
    p.rgb([0, 0, 0], false).text(M, PH - M - 4, 16 * k, `${titre} — synoptique du réseau`, { bold: true });
    if (feuilles > 1) p.rgb([0.35, 0.35, 0.35], false).text(PW - M, PH - M - 4, 11 * k, `Feuille ${f + 1} / ${feuilles}`, { align: 'right', bold: true });
    p.rgb([0, 0, 0]).width(0.8).line(M, PH - M - 12 * k, PW - M, PH - M - 12 * k);
    for (let b = 0; b < N; b++) {
      if (places[b].f !== f) continue;
      const c0 = coupes[b], c1 = coupes[b + 1], lw = (c1 - c0) * s, y1 = ys[b][1], hb = places[b].hb;
      const gx = zx + garde, ybb = zy + zh - places[b].haut - hb; // bas de la bande (repère PDF), départ en haut à gauche
      const oy = ybb - (data.hauteur - y1) * s, Y = (y) => oy + (data.hauteur - y) * s;
      const n0 = p.labels.length;
      p.clip([[gx, ybb], [gx + lw, ybb], [gx + lw, ybb + hb], [gx, ybb + hb]], () => {
        drawSynoptiqueAncre(p, data, gx - c0 * s, oy, data.largeur * s, data.hauteur * s, s);
      });
      const garder = p.labels.slice(n0).filter((l) => l.x >= gx - 1 && l.x <= gx + lw + 1 && l.y >= ybb - 1 && l.y <= ybb + hb + 1);
      p.labels.length = n0; p.labels.push(...garder);
      const bord = (x, sens, cx0) => {
        renvois.filter((r) => Math.abs(r.x - cx0) < 1e-6).forEach((r) => {
          const y = Y(r.y), cx = x + sens * 22;
          p.rgb([0.36, 0.39, 0.45]).width(1.4).line(x, y, cx - sens * 10, y);
          p.rgb([1, 1, 1], false).rgb([0.66, 0.27, 0.04]).width(1.2).circle(cx, y, 10, 'B');
          p.rgb([0.66, 0.27, 0.04], false).text(cx, y - 3, 8, `R${r.n}`, { align: 'center', bold: true });
        });
        // « … » : la ligne continue sur la bande suivante / vient de la précédente
        const yr = renvois.find((r) => Math.abs(r.x - cx0) < 1e-6);
        p.rgb([0.45, 0.45, 0.45], false).text(x + sens * 42, (yr ? Y(yr.y) : ybb + hb / 2) - 5, 16, '…', { align: 'center', bold: true });
      };
      if (b < N - 1) bord(gx + lw, 1, c1);
      if (b > 0) bord(gx, -1, c0);
      const suivante = places[b + 1];
      if (suivante && suivante.f === f) p.rgb([0.82, 0.83, 0.86]).width(0.5).dash(true).line(zx, ybb - ecartB / 2, PW - M, ybb - ecartB / 2).dash(false);
    }
    p.rgb([0.45, 0.45, 0.45], false).text(M, M + 4, 7, `${N} bande${N > 1 ? 's' : ''} : « … » et renvois R en bout de bande, la suite reprend à gauche en dessous${f < feuilles - 1 ? ` — suite feuille ${f + 2}` : ''}.`, {});
    pages.push(p);
  }
  return { pages, echelle: s, texte: SYN.police * s, format: fmt, PH, bandes: N, feuilles };
}

// Découpage en folios (sans dessin) : échelle, coupes en unités du schéma.
// Si tout tient sur UNE page avec un texte d'au moins texteMin, une seule page
// (échelle ajustée) ; sinon échelle fixée par la hauteur et coupes en largeur.
function decouperFolios(data, fmt, { texteMax = 10, texteMin = 7 } = {}) {
  const [PW, PH] = FORMATS_PAGE[fmt] || FORMATS_PAGE.a3, k = PW / PAGE_W, M = MARGE * k;
  const bandeTitre = 30 * k, bandePied = 18, garde = 46; // garde : place des renvois de chaque côté
  const zx = M, zy = M + bandePied, zw = PW - 2 * M, zh = PH - 2 * M - bandeTitre - bandePied;
  const sMax = texteMax / SYN.police, sH = zh / data.hauteur;
  const sUne = Math.min(sMax, sH, (zw - 2 * garde) / data.largeur);
  const s = SYN.police * sUne >= texteMin ? sUne : Math.min(sH, sMax);
  const Wu = (zw - 2 * garde) / s; // largeur utile d'un folio, en unités du schéma
  const coupes = couperEnLargeur(data, Wu);
  return { fmt, PW, PH, k, M, bandeTitre, bandePied, garde, zx, zy, zw, zh, s, Wu, coupes, folios: coupes.length - 1, texte: SYN.police * s };
}
// Format conseillé : le plus petit où tout tient sur une page lisible ; sinon le
// plus petit où les folios sont lisibles (texte ≥ texteMin).
function formatOptimalSynoptique(data, { texteMin = 7 } = {}) {
  const ordre = ['a4', 'a3', 'a2', 'a1', 'a0'], essais = ordre.map((f) => decouperFolios(data, f, { texteMin }));
  return essais.find((d) => d.folios === 1 && d.texte >= texteMin)
    || essais.slice(1).find((d) => d.texte >= texteMin) || essais[essais.length - 1];
}

// ─── Synoptique en longueur, découpé en folios ───────────────────────────
// Le schéma reste sur une seule ligne (entrées et sorties dans l'ordre) ; il est
// coupé en pages de même format, à une échelle lisible. Les coupes tombent dans
// un espace libre (entre chambres et étiquettes) ; chaque liaison coupée porte un
// renvoi numéroté (R1, R2…) au bord droit d'un folio et au bord gauche du suivant.
// Chaque morceau est centré dans son folio. Retourne { pages: [Page], echelle, texte (pt) }.
function synoptiqueEnFolios(data, fmt, titre, opts = {}) {
  const D = decouperFolios(data, fmt, opts);
  const { PW, PH, k, M, garde, zx, zy, zw, zh, s, Wu, coupes } = D;
  const N = coupes.length - 1, renvois = renvoisCoupes(data, coupes);
  const pages = [];
  for (let i = 0; i < N; i++) {
    const p = new Page({ emitText: false, ombre: false }), c0 = coupes[i], c1 = coupes[i + 1];
    p.rgb([0, 0, 0], false).text(M, PH - M - 4, 16 * k, `${titre} — synoptique du réseau`, { bold: true });
    p.rgb([0.35, 0.35, 0.35], false).text(PW - M, PH - M - 4, 11 * k, `Folio ${i + 1} / ${N}`, { align: 'right', bold: true });
    p.rgb([0, 0, 0]).width(0.8).line(M, PH - M - 12 * k, PW - M, PH - M - 12 * k);
    const lw = (c1 - c0) * s, gx = zx + garde + (Wu * s - lw) / 2; // morceau centré dans le folio
    // fenêtre : le schéma entier, décalé, découpé à la largeur du folio
    const n0 = p.labels.length;
    p.clip([[gx, zy], [gx + lw, zy], [gx + lw, zy + zh], [gx, zy + zh]], () => {
      drawSynoptiqueAncre(p, data, gx - c0 * s, zy, data.largeur * s, zh, s);
    });
    // textes hors de la fenêtre : écrits à part (jsPDF), le découpage ne les coupe pas
    const garder = p.labels.slice(n0).filter((l) => l.x >= gx - 1 && l.x <= gx + lw + 1);
    p.labels.length = n0; p.labels.push(...garder);
    const oy = zy + (zh - data.hauteur * s) / 2, Y = (y) => oy + (data.hauteur - y) * s;
    const bord = (x, sens) => { // trait de coupe + renvois
      p.rgb([0.55, 0.55, 0.55]).width(0.6).dash(true).line(x, zy, x, zy + zh).dash(false);
      renvois.filter((r) => Math.abs(r.x - (sens > 0 ? c1 : c0)) < 1e-6).forEach((r) => {
        const y = Y(r.y), cx = x + sens * 22, autre = sens > 0 ? i + 2 : i;
        p.rgb([0.36, 0.39, 0.45]).width(1.4).line(x, y, cx - sens * 10, y);
        p.rgb([1, 1, 1], false).rgb([0.66, 0.27, 0.04]).width(1.2).circle(cx, y, 10, 'B');
        p.rgb([0.66, 0.27, 0.04], false).text(cx, y - 3, 8, `R${r.n}`, { align: 'center', bold: true });
        p.rgb([0.3, 0.3, 0.3], false).text(cx, y - 20, 6.5, sens > 0 ? `→ folio ${autre}` : `folio ${autre} →`, { align: 'center' });
      });
    };
    if (i < N - 1) bord(gx + lw, 1);
    if (i > 0) bord(gx, -1);
    p.rgb([0.45, 0.45, 0.45], false).text(M, M + 4, 7, i < N - 1 ? `Suite au folio ${i + 2} : renvois R repérés au bord droit.` : 'Fin du synoptique.', {});
    pages.push(p);
  }
  return { pages, echelle: s, texte: SYN.police * s, format: fmt, PH };
}

// Icône nodial (64 px, PNG) pour la mention « Réalisé avec nodial » en pied de page.
const ICONE_NODIAL_PNG = 'data:image/png;base64,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';
const MENTION_NODIAL = 'Réalisé avec nodial';

const api = { Page, MAT, fit, drawCoupe, draw3D, drawChambre3D, drawChambreDessus, dessinerEtudeChambre, rejouerSurCanvas, drawSynoptique2D, drawSynoptiqueIso, drawSynoptiqueAncre, synoptiqueEnFolios, decouperFolios, formatOptimalSynoptique, synoptiqueEnBandes, decouperBandes, formatOptimalBandes, mesureEtiquetteSyn, FORMATS_PAGE, dessinerPageChambreA3, dessinerPageContenuA3, pagesChambreA3, ICONE_NODIAL_PNG, MENTION_NODIAL, MISE_EN_PAGE_CHAMBRE, CARTOUCHE_DEFAUT, remplirCartouche, sectionsParPhases, cssRgb, coupeEnMiroir, COUL_LIAISON, PAGE_W, PAGE_H, MARGE, PHASE_RGB, GRILLAGE_RGB };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Vue3D = api;
})(typeof window !== 'undefined' ? window : globalThis);

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
function mesureEtiquetteSyn(e) {
  const phi = lignesPhi(e), lia = e.liaisons || [];
  const wPhi = Math.max(60, ...phi.map((l) => l.length * SYN.carMono));
  const wLia = lia.length ? Math.max(...lia.map((l) => nomCourt(l.nom).length * SYN.carTexte + 10 + String(l.sections || '').length * SYN.carSection)) : 0;
  const n = Math.max(1, phi.length, lia.length);
  return { w: Math.round(2 * SYN.pad + wPhi + (lia.length ? SYN.gouttiere + wLia : 0)), h: Math.round(2 * SYN.pad + n * SYN.lh + SYN.lh + 2), wPhi };
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
    const phi = lignesPhi(e), xs = x0 + pad + m.wPhi * s + SYN.gouttiere * s / 2;
    if ((e.liaisons || []).length) p.rgb([0.86, 0.88, 0.91]).line(xs, yHaut - pad * 0.6, xs, yHaut - h + lh + pad * 0.4);
    phi.forEach((l, i) => p.rgb([0.08, 0.08, 0.08], false).text(x0 + pad, yHaut - pad - lh * (i + 0.78), f, l, { bold: true }));
    if (!phi.length) p.rgb([0.45, 0.45, 0.45], false).text(x0 + pad, yHaut - pad - lh * 0.78, f, 'coupe vide');
    (e.liaisons || []).forEach((l, i) => {
      const y = yHaut - pad - lh * (i + 0.78), nom = nomCourt(l.nom);
      p.rgb([0.16, 0.18, 0.22], false).text(xs + SYN.gouttiere * s / 2, y, f * 0.92, nom);
      if (l.sections) p.rgb([0.5, 0.27, 0.08], false).text(xs + SYN.gouttiere * s / 2 + (nom.length * SYN.carTexte + 10) * s, y, f * 0.86, l.sections);
    });
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
const MISE_EN_PAGE_CHAMBRE = [
  { type: 'vuedessus', x: 0, y: 0, w: 5, h: 5 },
  { type: 'masque', cote: 1, x: 5, y: 0, w: 3.5, h: 3 }, { type: 'masque', cote: 2, x: 8.5, y: 0, w: 3.5, h: 3 },
  { type: 'masque', cote: 3, x: 5, y: 3, w: 3.5, h: 3 }, { type: 'masque', cote: 4, x: 8.5, y: 3, w: 3.5, h: 3 },
  { type: 'fourreaux', x: 0, y: 5, w: 5, h: 3 }, { type: 'cables', x: 5, y: 6, w: 4, h: 2 }, { type: 'cartouche', x: 9, y: 6, w: 3, h: 2 },
];
const FACE_DU_COTE = { 1: 'longPanB', 2: 'pignonB', 3: 'longPanA', 4: 'pignonA' };
const couper = (t, taille, largeur) => { t = String(t); const n = Math.max(3, Math.floor(largeur / (taille * 0.5))); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
function dessinerPageChambreA3(p, e, masques, opts = {}) {
  const [PW, PH] = FORMATS_PAGE.a3, M = 28, ENT = 34;
  const gx = M, gy = M, gw = PW - 2 * M, gh = PH - 2 * M - ENT, CW = gw / 12, CH = gh / 8, G = 5;
  const zone = (b) => ({ x: gx + b.x * CW + G / 2, y: gy + (8 - b.y - b.h) * CH + G / 2, w: b.w * CW - G, h: b.h * CH - G });
  const masquesM = masques || {};
  // en-tête
  p.rgb([0.1, 0.1, 0.1], false).text(M, PH - M - 16, 18, `${e.nom || 'Chambre'} — ${e.ok ? e.ref : 'aucune chambre'}`, { bold: true });
  p.rgb([0.35, 0.35, 0.35], false).text(PW - M, PH - M - 16, 9, `${opts.projet || ''} · TONTONKAD — étude de chambre`, { align: 'right' });
  p.rgb([0.66, 0.27, 0.04]).width(1.2).line(M, PH - M - 24, PW - M, PH - M - 24);
  const cadre = (z, titre) => {
    p.rgb([0.995, 0.995, 0.99], false).rgb([0.78, 0.8, 0.84]).width(0.7).rect(z.x, z.y, z.w, z.h, 'B');
    if (titre) {
      p.rgb([0.93, 0.94, 0.96], false).rect(z.x, z.y + z.h - 15, z.w, 15, 'f');
      p.rgb([0.1, 0.1, 0.1], false).text(z.x + 6, z.y + z.h - 11, 8.5, couper(titre, 8.5, z.w - 12), { bold: true });
    }
  };
  const etudeOk = e && e.ok;
  for (const b of MISE_EN_PAGE_CHAMBRE) {
    const z = zone(b);
    if (b.type === 'vuedessus') {
      cadre(z, 'Vue de dessus');
      if (etudeOk) drawChambreDessus(p, e, masquesM, z.x + 4, z.y + 4, z.w - 8, z.h - 24);
    } else if (b.type === 'masque') {
      const k = FACE_DU_COTE[b.cote], mq = masquesM[k];
      const L = mq && mq.longueurM ? ` · ${String(mq.longueurM).replace('.', ',')} m` : '';
      cadre(z, `${e.nom || 'C'}.${b.cote} · ${mq ? mq.nom + L : 'côté libre'}`);
      if (mq) {
        drawCoupe(p, mq, z.x + 40, z.y + 34, z.w - 80, z.h - 64);
        const nb = new Map(); mq.fourreaux.forEach((f) => { const d = Math.round(f.od); nb.set(d, (nb.get(d) || 0) + 1); });
        p.rgb([0.25, 0.25, 0.25], false).text(z.x + 6, z.y + 6, 7, couper([...nb].sort((a, c) => c[0] - a[0]).map(([d, q]) => `${q} × Ø${d}`).join('   ') + `   ·   nappe ${Math.round(mq.largeur)} × ${Math.round(mq.hauteur)} mm`, 7, z.w - 12));
      }
    } else if (b.type === 'fourreaux') {
      cadre(z, 'Contenu des fourreaux, par côté et par liaison');
      const lignes = [];
      for (let c = 1; c <= 4; c++) {
        const mq = masquesM[FACE_DU_COTE[c]]; if (!mq) continue;
        const parLiaison = new Map();
        mq.fourreaux.forEach((f) => {
          const nom = String((f.liaisons && f.liaisons[0]) || f.libelle || 'réserve').replace(/\s*-\s*PE$/i, '');
          if (!parLiaison.has(nom)) parLiaison.set(nom, { f: new Map(), c: new Map() });
          const g = parLiaison.get(nom), d = Math.round(f.od); g.f.set(d, (g.f.get(d) || 0) + 1);
          (mq.cables || []).filter((x) => x.fourreau === f.id).forEach((x) => { const k2 = x.code || `Ø${x.od}`; g.c.set(k2, (g.c.get(k2) || 0) + 1); });
        });
        [...parLiaison].sort((a, c2) => a[0].localeCompare(c2[0], 'fr', { numeric: true })).forEach(([nom, g]) => lignes.push([
          `${e.nom}.${c}`, nomCourt(nom), [...g.f].sort((a, c2) => c2[0] - a[0]).map(([d, q]) => `${q}×Ø${d}`).join(' '), [...g.c].map(([k2, q]) => `${q}×${k2}`).join(' + ') || '—']));
      }
      tableauPdf(p, z, ['Masque', 'Liaison', 'Fourreaux', 'Câbles'], [0.11, 0.42, 0.17, 0.30], lignes);
    } else if (b.type === 'cables') {
      cadre(z, 'Traversées de la chambre (faisceaux)');
      const LIB = { longPanB: 1, pignonB: 2, longPanA: 3, pignonA: 4 };
      const lignes = [];
      regrouperFaisceaux(e).forEach((fx, i) => [...new Set(fx.liaisons.map((x) => String(x).replace(/\s*-\s*PE$/i, '')))].forEach((l, j) => lignes.push([j ? '' : `${i + 1}`, j ? '' : `${e.nom}.${LIB[fx.cles[0]]} → ${e.nom}.${LIB[fx.cles[1]]}`, nomCourt(l)])));
      const arr = new Map(); (e.arrets || []).forEach((a) => { if (!arr.has(a.cle)) arr.set(a.cle, []); arr.get(a.cle).push(a.liaison); });
      arr.forEach((noms, k) => [...new Set(noms.map((x) => String(x).replace(/\s*-\s*PE$/i, '')))].forEach((l, j) => lignes.push([j ? '' : '■', j ? '' : `s'arrête en ${e.nom}.${LIB[k]}`, nomCourt(l)])));
      tableauPdf(p, z, ['N°', 'Côtés', 'Liaison'], [0.08, 0.3, 0.62], lignes);
    } else if (b.type === 'cartouche') {
      cadre(z, 'Cartouche');
      const L2 = [['Projet', opts.projet || '—'], ['Chambre', `${e.nom || '—'} · ${etudeOk ? e.ref : '—'}`],
        ['Intérieur', etudeOk ? `${e.L} × ${e.l} × ${e.H} mm` : '—'],
        ...(etudeOk && e.infos && e.infos.tampon && e.infos.tampons ? [['Tampons', `${e.infos.tampons} × ${e.infos.tampon.L}×${e.infos.tampon.l} ${e.infos.tampon.classe} (à valider)`]] : []), ['Date', opts.date || ''], ['Indice', opts.indice || 'A'], ['Établi par', 'CEA — TONTONKAD']];
      L2.forEach(([k, v], i) => {
        const y = z.y + z.h - 30 - i * 13;
        p.rgb([0.4, 0.4, 0.4], false).text(z.x + 8, y, 7.5, k);
        p.rgb([0.1, 0.1, 0.1], false).text(z.x + 70, y, 8, couper(v, 8, z.w - 78), { bold: true });
      });
    }
  }
  return p;
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
  // intervalles occupés (éléments, étiquettes) : on ne coupe pas dedans
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
  const N = coupes.length - 1;
  // liaisons coupées : segments horizontaux du dessin (droits ou en équerre)
  const renvois = []; // { x, y, n }
  data.troncons.forEach((t) => {
    const x0 = Math.min(t.a.x, t.b.x), x1 = Math.max(t.a.x, t.b.x), y = t.a.y;
    coupes.slice(1, -1).forEach((c) => { if (c > x0 && c < x1) renvois.push({ x: c, y, n: renvois.length + 1 }); });
  });
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

const api = { Page, MAT, fit, drawCoupe, draw3D, drawChambre3D, drawChambreDessus, dessinerEtudeChambre, rejouerSurCanvas, drawSynoptique2D, drawSynoptiqueIso, drawSynoptiqueAncre, synoptiqueEnFolios, decouperFolios, formatOptimalSynoptique, mesureEtiquetteSyn, FORMATS_PAGE, dessinerPageChambreA3, MISE_EN_PAGE_CHAMBRE, coupeEnMiroir, COUL_LIAISON, PAGE_W, PAGE_H, MARGE, PHASE_RGB, GRILLAGE_RGB };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Vue3D = api;
})(typeof window !== 'undefined' ? window : globalThis);

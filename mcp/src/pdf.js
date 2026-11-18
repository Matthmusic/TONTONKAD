'use strict';
// Planche PDF des masques : une page A4 paysage par masque, avec la coupe à
// l'échelle, une vue 3D en perspective cavalière (tronçon de tranchée
// extrudé), la légende des fourreaux et les contrôles de conformité.
// PDF écrit à la main (aucune dépendance) : traits, cercles, texte Helvetica.

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
  constructor() { this.ops = []; }
  rgb(c, stroke = true) { this.ops.push(`${c.map(f).join(' ')} ${stroke ? 'RG' : 'rg'}`); return this; }
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
    // largeur approximative Helvetica (0.5 em / caractère) pour centrer / aligner à droite
    const w = String(s).length * size * 0.5;
    const dx = align === 'center' ? -w / 2 : align === 'right' ? -w : 0;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${f(x + dx)} ${f(y)} Td ${pdfStr(s)} Tj ET`);
    return this;
  }
  toString() { return this.ops.join('\n'); }
}

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
  const s = fit(m.largeur + dx, top + dy, wPt, hPt);
  const ox = x0 + (wPt - (m.largeur + dx) * s) / 2, oy = y0;
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
    // terrain : faces de la tranchée (fond, paroi droite, terrain fini)
    p.rgb([0.92, 0.88, 0.78], false).rgb([0.3, 0.3, 0.3]);
    p.poly([[X(0), Y(0)], [X(0) + ex, Y(0) + ey], [X(0) + W + ex, Y(0) + ey], [X(0) + W, Y(0)]], 'B');
    p.poly([[X(0) + W, Y(0)], [X(0) + W + ex, Y(0) + ey], [X(0) + W + ex, Y(0) + H + ey], [X(0) + W, Y(0) + H]], 'B');
    p.rgb([0.85, 0.85, 0.85], false).poly([[X(0), Y(0) + H], [X(0) + ex, Y(0) + H + ey], [X(0) + W + ex, Y(0) + H + ey], [X(0) + W, Y(0) + H]], 'S');
    p.line(X(0), Y(0), X(0), Y(0) + H).line(X(0) + ex, Y(0) + ey, X(0) + ex, Y(0) + H + ey);
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
    // corps du cylindre (rempli pour masquer ce qui est derrière)
    p.rgb([0.98, 0.8, 0.6], false).rgb([0.75, 0.35, 0.05]).width(0.6);
    p.poly([[cx + n[0] * r, cy + n[1] * r], [cx + n[0] * r + ex, cy + n[1] * r + ey], [cx - n[0] * r + ex, cy - n[1] * r + ey], [cx - n[0] * r, cy - n[1] * r]], 'B');
    p.circle(cx + ex, cy + ey, r, 'B');
    p.rgb([1, 0.9, 0.8], false).circle(cx, cy, r, 'B');
    p.rgb([1, 1, 1], false).circle(cx, cy, fo.di / 2 * s, 'B');
  }
  for (const c of m.cables) {
    p.rgb(PHASE_RGB[c.phase] || [0.25, 0.25, 0.25], false).rgb([0, 0, 0]).width(0.3).circle(X(c.x), Y(c.y), Math.max(0.6, c.od / 2 * s), 'B');
  }
  p.rgb([0, 0, 0], false);
}

function pageMasque(m, i, total, opts) {
  const p = new Page();
  const L = Number(opts.longueur3dMm) > 0 ? Number(opts.longueur3dMm) : 1500;
  // cartouche haut
  p.text(MARGE, PAGE_H - MARGE - 4, 16, m.nom, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, `TONTONKAD — masque ${i + 1}/${total}`, { align: 'right' });
  p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);

  const zoneY = 215, zoneH = PAGE_H - MARGE - 40 - zoneY;
  p.text(MARGE, zoneY + zoneH + 10, 9, 'Coupe', { bold: true });
  drawCoupe(p, m, MARGE + 50, zoneY, 300, zoneH - 10);
  p.text(440, zoneY + zoneH + 10, 9, `Vue 3D (tronçon de ${L / 1000} m, perspective cavalière)`, { bold: true });
  draw3D(p, m, 440, zoneY, PAGE_W - MARGE - 440, zoneH - 10, L);

  // bas de page : légende, tranchée, conformité, avertissements
  let y = 185;
  p.width(0.5).line(MARGE, y + 12, PAGE_W - MARGE, y + 12);
  p.text(MARGE, y, 9, 'Fourreaux', { bold: true });
  y -= 13;
  for (const fo of m.fourreaux.slice(0, 9)) {
    p.text(MARGE, y, 8, `${fo.id}  ${fo.type} ${fo.code}  (Øint ${fo.di})  ${fo.libelle || ''}  ${fo.taux ? fo.taux + ' %' : 'réserve'}`);
    y -= 11;
  }
  if (m.fourreaux.length > 9) p.text(MARGE, y, 8, `… et ${m.fourreaux.length - 9} autres (voir DXF)`);

  let y2 = 185;
  const x2 = 430;
  p.text(x2, y2, 9, 'Tranchée et conformité', { bold: true });
  y2 -= 13;
  if (m.tranchee) {
    p.text(x2, y2, 8, `Profondeur ${m.tranchee.profondeur} mm — recouvrement ${m.tranchee.recouvrement} mm — zone ${m.tranchee.zone.replace('_', ' ')}`); y2 -= 11;
    for (const c of m.tranchee.conformite) {
      p.rgb(c.ok ? [0.1, 0.5, 0.2] : [0.8, 0.1, 0.1], false).text(x2, y2, 8, `${c.ok ? 'OK' : 'NON CONFORME'}  ${c.regle}`, { bold: true });
      p.rgb([0, 0, 0], false); y2 -= 11;
    }
    p.rgb([0.4, 0.4, 0.4], false).text(x2, y2, 7, 'Règles issues de NF P 98-331 et NF EN 12613 (ex NF T 54-080), valeurs à valider sur les textes en vigueur.');
    p.rgb([0, 0, 0], false); y2 -= 13;
  } else {
    p.text(x2, y2, 8, `Conduit Ø ${m.largeur} mm — occupation ${m.occupation} %`); y2 -= 13;
  }
  if (m.avertissements && m.avertissements.length) {
    p.text(x2, y2, 9, 'À vérifier', { bold: true }); y2 -= 12;
    for (const a of m.avertissements.slice(0, 5)) { p.text(x2, y2, 7, `• ${a}`.slice(0, 110)); y2 -= 10; }
  }
  p.rgb([0.4, 0.4, 0.4], false).text(MARGE, MARGE - 14, 7, `Écart ${m.reglages.ecart} mm — lit de pose ${m.reglages.litDePose} mm — remplissage max ${Math.round(m.reglages.tauxMax * 100)} % — généré le ${new Date().toLocaleDateString('fr-FR')}`);
  return p.toString();
}

/** @returns {Buffer} un PDF, une page par masque réussi */
function masquesToPdf(masques, opts = {}) {
  const ok = masques.filter((m) => m && m.ok);
  if (!ok.length) throw new Error('Aucun masque à mettre en page');
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null), pagesId = add(null);
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  ok.forEach((m, i) => {
    const content = Buffer.from(pageMasque(m, i, ok.length, opts), 'latin1');
    const cid = add(`<< /Length ${content.length} >>\nstream\n${content.toString('latin1')}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${cid} 0 R >>`));
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { masquesToPdf };

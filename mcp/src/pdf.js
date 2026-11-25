'use strict';
// Planche PDF des masques (serveur MCP) : une page A4 paysage par masque
// (coupe, vue 3D, légende, conformité) + une page chambre de tirage.
// Le dessin est dans src/renderer/vue3d.js, partagé avec l'application ;
// ici seulement la mise en page et l'écriture du fichier PDF.
const { ICONE_NODIAL_PNG, MENTION_NODIAL } = require('../../src/renderer/vue3d.js');
const { Page, fit, drawCoupe, draw3D, drawChambre3D, dessinerEtudeChambre, drawSynoptique2D, drawSynoptiqueIso, PAGE_W, PAGE_H, MARGE } = require('../../src/renderer/vue3d.js');
void fit;

function pageMasque(m, i, total, opts) {
  const p = new Page();
  const L = Number(opts.longueur3dMm) > 0 ? Number(opts.longueur3dMm) : 1500;
  // cartouche haut
  p.text(MARGE, PAGE_H - MARGE - 4, 16, m.nom, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, `nodial — masque ${i + 1}/${total}`, { align: 'right' });
  p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);

  const zoneY = 215, zoneH = PAGE_H - MARGE - 40 - zoneY;
  p.text(MARGE, zoneY + zoneH + 10, 9, 'Coupe', { bold: true });
  drawCoupe(p, m, MARGE + 50, zoneY, 300, zoneH - 10);
  p.text(440, zoneY + zoneH + 10, 9, `Vue 3D (tronçon de ${L / 1000} m, perspective cavalière)`, { bold: true });
  draw3D(p, m, 440, zoneY, PAGE_W - MARGE - 440, zoneH - 10, L, { teinte: opts.teinteFourreaux });

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

// Page « chambre de tirage » : volume INTÉRIEUR de la chambre (cotes du
// catalogue) en perspective cavalière, ouvert en partie haute, la face
// d'entrée au premier plan avec les fourreaux du masque qui y arrivent.
function pageChambre(m, i, total) {
  const p = new Page();
  const ch = m.chambre;
  p.text(MARGE, PAGE_H - MARGE - 4, 16, `${m.nom} — chambre de tirage ${ch.ref}`, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, `nodial — masque ${i + 1}/${total}`, { align: 'right' });
  p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);

  drawChambre3D(p, m, MARGE + 20, 120, 520, PAGE_H - MARGE - 60 - 120);
  const inf = ch.infos || {};
  // informations
  let y = PAGE_H - MARGE - 50;
  const x = 590;
  p.text(x, y, 11, `Chambre ${ch.ref}`, { bold: true }); y -= 16;
  for (const l of [
    `Intérieur : ${ch.L} × ${ch.l} mm, H ${ch.H} mm`,
    `Entrée par le ${ch.entree} (${ch.face.largeur} × ${ch.face.hauteur} mm)`,
    `Nappe : ${m.largeur} × ${m.hauteur} mm`,
    `Marge : ${ch.marge.largeur} mm en largeur, ${ch.marge.hauteur} mm en hauteur`,
    `${m.fourreaux.length} fourreau(x), centrés sur la face, posés au fond`,
  ]) { p.text(x, y, 8, l); y -= 12; }
  y -= 6;
  p.rgb(ch.tient ? [0.1, 0.5, 0.2] : [0.8, 0.1, 0.1], false).text(x, y, 9, ch.tient ? 'La nappe passe dans la chambre' : 'La nappe ne passe PAS dans cette chambre', { bold: true });
  p.rgb([0.4, 0.4, 0.4], false);
  y -= 22;
  const notes = ch.infos ? [
    'Largeur, longueur, hauteur utile : catalogue nodial.',
    `Hauteur totale${inf.paroi ? ', parois ' + inf.paroi + ' mm' : ''}${inf.tampons ? ', ' + inf.tampons + ' tampon(s)' : ''} :`,
    'indicatif, sources publiques (pas une fiche fabricant).',
    'Hauteur utile en tirets bleus.',
    ...(inf.aVerifier ? [`À vérifier : ${inf.aVerifier}.`] : []),
  ] : ['Cotes intérieures du catalogue nodial.', 'Parois, cadre et tampon non représentés.'];
  for (const l of notes) { p.text(x, y, 7, l.slice(0, 70)); y -= 10; }
  p.rgb([0, 0, 0], false);
  return p.toString();
}

// Page « chambre vue de dessus » (dessin partagé : vue3d.js dessinerEtudeChambre).
function pageChambreDessus(e) {
  return dessinerEtudeChambre(new Page(), e, e._masques || {}).toString();
}


// Pages « réseau » (mêmes dessins que l'application) : synoptique 2D,
// isométrique, puis métré et continuité.
function pagesReseau({ titre, data, metre, continuite }) {
  const fr = (v) => String(v).replace('.', ',');
  const entete = (p, sous) => {
    p.rgb([0, 0, 0], false).text(MARGE, PAGE_H - MARGE - 4, 16, `${titre} - ${sous}`, { bold: true });
    p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);
  };
  const p1 = new Page({ ombre: false }); entete(p1, 'synoptique du réseau');
  drawSynoptique2D(p1, data, MARGE, MARGE, PAGE_W - 2 * MARGE, PAGE_H - 2 * MARGE - 30);
  const p2 = new Page({ ombre: false }); entete(p2, 'vue isométrique');
  drawSynoptiqueIso(p2, data, MARGE, MARGE, PAGE_W - 2 * MARGE, PAGE_H - 2 * MARGE - 30);
  const p3 = new Page({ ombre: false }); entete(p3, 'métré et continuité');
  let y = PAGE_H - MARGE - 40;
  p3.rgb([0, 0, 0], false).text(MARGE, y, 11, 'Métré des fourreaux', { bold: true }); y -= 16;
  p3.text(MARGE, y, 8, 'Fourreau', { bold: true }); p3.text(MARGE + 160, y, 8, 'Tubes x tronçons', { bold: true }); p3.text(MARGE + 280, y, 8, 'Longueur (m)', { bold: true }); y -= 12;
  metre.lignes.forEach((l) => { p3.text(MARGE, y, 8, l.fourreau); p3.text(MARGE + 160, y, 8, String(l.nombre)); p3.text(MARGE + 280, y, 8, fr(l.metres)); y -= 11; });
  p3.text(MARGE, y - 2, 8.5, `Total : ${fr(metre.totalMetres)} m de fourreaux - ${fr(metre.longueurReseau)} m de tranchée`, { bold: true }); y -= 16;
  metre.sansLongueur.forEach((t) => { p3.rgb([0.7, 0.15, 0.1], false).text(MARGE, y, 7.5, `Longueur manquante, non compté : ${t}`); y -= 10; });
  let y2 = PAGE_H - MARGE - 40; const x2 = 440;
  p3.rgb([0, 0, 0], false).text(x2, y2, 11, 'Continuité des liaisons', { bold: true }); y2 -= 16;
  continuite.liaisons.slice(0, 30).forEach((l) => {
    const okL = !l.problemes.length;
    p3.rgb(okL ? [0.1, 0.45, 0.2] : [0.75, 0.12, 0.1], false).text(x2, y2, 8, `${okL ? 'OK' : 'NON'}  ${l.nom}`.slice(0, 60), { bold: true }); y2 -= 10;
    p3.rgb([0.25, 0.25, 0.25], false).text(x2 + 14, y2, 7, `${l.chemin.join(' -> ')} - ${fr(l.longueurM)} m${l.longueurIncomplete ? ' (incomplète)' : ''}${okL ? '' : ' - ' + l.problemes.join(', ')}`.slice(0, 95)); y2 -= 12;
  });
  return [p1, p2, p3].map((p) => p.toString());
}

// Image (logo) → objets PDF. PNG (gris, RVB, avec ou sans transparence) ou JPEG.
// Retourne { dict, data, smask? } : dict sans /Length, data = octets du flux.
function imageVersPdf(octets) {
  const b = Buffer.isBuffer(octets) ? octets : Buffer.from(String(octets).replace(/^data:[^,]+,/, ''), 'base64');
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG : flux recopié tel quel (DCTDecode)
    let i = 2, w = 0, h = 0, comp = 3;
    while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); comp = b[i + 9]; break; } i += 2 + len; }
    return { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${comp === 1 ? 'DeviceGray' : comp === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode`, data: b };
  }
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('Logo : seuls les PNG et JPEG sont acceptés');
  const zlib = require('zlib');
  let i = 8, w = 0, h = 0, prof = 8, type = 2; const idat = [];
  while (i < b.length) { const len = b.readUInt32BE(i), t = b.toString('latin1', i + 4, i + 8), d = b.subarray(i + 8, i + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); prof = d[8]; type = d[9]; if (d[12]) throw new Error('Logo PNG entrelacé non pris en charge : réenregistrez-le sans entrelacement'); }
    else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break; i += 12 + len; }
  if (prof !== 8 || ![0, 2, 4, 6].includes(type)) throw new Error('Logo PNG : 8 bits gris ou RVB attendus');
  const nc = { 0: 1, 2: 3, 4: 2, 6: 4 }[type], bpp = nc, ligne = w * bpp, brut = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * ligne); // défiltrage PNG (None, Sub, Up, Average, Paeth)
  for (let y = 0; y < h; y++) {
    const f = brut[y * (ligne + 1)], src = y * (ligne + 1) + 1, dst = y * ligne;
    for (let x = 0; x < ligne; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, up = y ? px[dst - ligne + x] : 0, c = y && x >= bpp ? px[dst - ligne + x - bpp] : 0, v = brut[src + x];
      let r = v;
      if (f === 1) r = v + a; else if (f === 2) r = v + up; else if (f === 3) r = v + ((a + up) >> 1);
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
      px[dst + x] = r & 255;
    }
  }
  const coul = type === 0 || type === 4 ? 1 : 3, alpha = type === 4 || type === 6;
  const rgb = Buffer.alloc(w * h * coul), al = alpha ? Buffer.alloc(w * h) : null;
  for (let k = 0; k < w * h; k++) { for (let c = 0; c < coul; c++) rgb[k * coul + c] = px[k * nc + c]; if (al) al[k] = px[k * nc + nc - 1]; }
  const res = { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${coul === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /FlateDecode`, data: zlib.deflateSync(rgb) };
  if (al) res.smask = { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, data: zlib.deflateSync(al) };
  return res;
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
  const flux = (dict, data) => add(Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]));
  // page : texte du flux (A4 paysage), ou { contenu, largeur, hauteur, images: [{ octets, x, y, w, h }] }
  const addPage = (pg) => {
    const o = typeof pg === 'string' ? { contenu: pg } : pg;
    const W = o.largeur || PAGE_W;
    // pied de page : « Réalisé avec nodial » + icône, en bas à droite
    const pied = new Page({ ombre: false });
    pied.rgb([0.55, 0.57, 0.61], false).text(W - 17, 10.2, 6.5, MENTION_NODIAL, { align: 'right' });
    const largTexte = MENTION_NODIAL.length * 6.5 * 0.5;
    let texte = o.contenu + '\n' + pied.toString(), xo = '';
    const images = [...(o.images || []), { octets: ICONE_NODIAL_PNG, x: W - 17 - largTexte - 12, y: 8.5, w: 9, h: 9 }];
    images.forEach((im, k) => {
      try {
        const img = imageVersPdf(im.octets);
        const sm = img.smask ? flux(img.smask.dict, img.smask.data) : null;
        const id = flux(img.dict + (sm ? ` /SMask ${sm} 0 R` : ''), img.data);
        xo += ` /Im${k} ${id} 0 R`;
        texte += `\nq ${im.w.toFixed(2)} 0 0 ${im.h.toFixed(2)} ${im.x.toFixed(2)} ${im.y.toFixed(2)} cm /Im${k} Do Q`;
      } catch (e) { /* logo illisible : emplacement laissé vide */ }
    });
    const content = Buffer.from(texte, 'latin1');
    const cid = flux('', content);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${o.largeur || PAGE_W} ${o.hauteur || PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /ExtGState << /GS1 << /ca 0.12 /CA 0.12 >> >>${xo ? ` /XObject <<${xo} >>` : ''} >> /Contents ${cid} 0 R >>`));
  };
  for (const t of opts.pagesAvant || []) addPage(t);
  ok.forEach((m, i) => {
    addPage(pageMasque(m, i, ok.length, opts));
    if (m.chambre && m.chambre.face && opts.chambre !== false) addPage(pageChambre(m, i, ok.length));
  });
  // pages chambre A3 (même dessin que l'application) ou, à défaut, vue de dessus A4
  if (opts.pagesChambres) opts.pagesChambres.forEach(addPage);
  else for (const e of opts.etudesChambres || []) addPage(pageChambreDessus(e));
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  const morceaux = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let taille = morceaux[0].length;
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(taille);
    const corps = Buffer.isBuffer(o) ? o : Buffer.from(String(o), 'latin1');
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), corps, Buffer.from('\nendobj\n', 'latin1')]);
    morceaux.push(b); taille += b.length;
  });
  const fin = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${taille}\n%%EOF\n`;
  morceaux.push(Buffer.from(fin, 'latin1'));
  return Buffer.concat(morceaux);
}

module.exports = { masquesToPdf, pagesReseau, imageVersPdf };

'use strict';
// Planche PDF des masques (serveur MCP) : une page A4 paysage par masque
// (coupe, vue 3D, légende, conformité) + une page chambre de tirage.
// Le dessin est dans src/renderer/vue3d.js, partagé avec l'application ;
// ici seulement la mise en page et l'écriture du fichier PDF.
const { Page, fit, drawCoupe, draw3D, drawChambre3D, drawChambreDessus, PAGE_W, PAGE_H, MARGE } = require('../../src/renderer/vue3d.js');
void fit;

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

// Page « chambre de tirage » : volume INTÉRIEUR de la chambre (cotes du
// catalogue) en perspective cavalière, ouvert en partie haute, la face
// d'entrée au premier plan avec les fourreaux du masque qui y arrivent.
function pageChambre(m, i, total) {
  const p = new Page();
  const ch = m.chambre;
  p.text(MARGE, PAGE_H - MARGE - 4, 16, `${m.nom} — chambre de tirage ${ch.ref}`, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, `TONTONKAD — masque ${i + 1}/${total}`, { align: 'right' });
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
    'Largeur, longueur, hauteur utile : catalogue TONTONKAD.',
    `Hauteur totale${inf.paroi ? ', parois ' + inf.paroi + ' mm' : ''}${inf.tampons ? ', ' + inf.tampons + ' tampon(s)' : ''} :`,
    'indicatif, sources publiques (pas une fiche fabricant).',
    'Hauteur utile en tirets bleus.',
    ...(inf.aVerifier ? [`À vérifier : ${inf.aVerifier}.`] : []),
  ] : ['Cotes intérieures du catalogue TONTONKAD.', 'Parois, cadre et tampon non représentés.'];
  for (const l of notes) { p.text(x, y, 7, l.slice(0, 70)); y -= 10; }
  p.rgb([0, 0, 0], false);
  return p.toString();
}

// Page « chambre vue de dessus » : faces, fourreaux par face, traversées.
function pageChambreDessus(e) {
  const p = new Page();
  p.text(MARGE, PAGE_H - MARGE - 4, 16, `${e.nom || 'Chambre'} — ${e.ok ? e.ref : 'aucune chambre'} — vue de dessus`, { bold: true });
  p.text(PAGE_W - MARGE, PAGE_H - MARGE - 4, 8, 'TONTONKAD — étude de chambre', { align: 'right' });
  p.rgb([0, 0, 0]).width(0.8).line(MARGE, PAGE_H - MARGE - 12, PAGE_W - MARGE, PAGE_H - MARGE - 12);
  const x = 560;
  let y = PAGE_H - MARGE - 40;
  if (!e.ok) {
    for (const l of e.erreurs || []) { p.rgb([0.8, 0.1, 0.1], false).text(MARGE, y, 10, l, { bold: true }); y -= 14; }
    return p.toString();
  }
  const couleurs = drawChambreDessus(p, e, e._masques || {}, MARGE, 60, 500, PAGE_H - MARGE - 60 - 60);
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
  const addPage = (text) => {
    const content = Buffer.from(text, 'latin1');
    const cid = add(`<< /Length ${content.length} >>\nstream\n${content.toString('latin1')}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /ExtGState << /GS1 << /ca 0.12 /CA 0.12 >> >> >> /Contents ${cid} 0 R >>`));
  };
  ok.forEach((m, i) => {
    addPage(pageMasque(m, i, ok.length, opts));
    if (m.chambre && m.chambre.face && opts.chambre !== false) addPage(pageChambre(m, i, ok.length));
  });
  for (const e of opts.etudesChambres || []) addPage(pageChambreDessus(e));
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

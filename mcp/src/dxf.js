'use strict';
// Export DXF R12 (AC1009, ASCII) d'un ou plusieurs masques. Calques et
// couleurs alignés sur l'export de l'application (script.js generateDXF) :
// _CEAI_BOITE, _CEAI_COTES, _CEAI_FOURREAU_<type>_<code>, _CEAI_CABLE_<fam>_<code>_<phase>.
// Le fichier s'ouvre dans AutoCAD, ZWCAD, nanoCAD/MultiCAD, ou s'insère
// comme bloc dans un plan existant.

const R12_NAME_MAX = 31;
const PHASE_ACI = { L1: 24, L2: 8, L3: 250, N: 5, PE: 3, PEN: 5 };

const clean = (s) => String(s).replace(/[\s/\-.,()]/g, '_');
const layerName = (s) => s.slice(0, R12_NAME_MAX);
// R12 : texte en Windows-1252 ; on remplace ce qui n'y existe pas.
const txt = (s) => String(s).replace(/→/g, '->').replace(/[^\x20-\x7E -ÿ]/g, '?');
const n = (v) => (Math.round(v * 1e4) / 1e4).toString();

/**
 * @param {Array}  masques   sorties de buildMasque (ok: true)
 * @param {object} [opts]    { unite: 'mm'|'m', origine: {x, y}, espacement (mm) }
 * @returns {string} contenu DXF
 */
function masquesToDxf(masques, opts = {}) {
  const k = opts.unite === 'm' ? 0.001 : 1;
  const ox = (opts.origine && Number(opts.origine.x)) || 0;
  const oy = (opts.origine && Number(opts.origine.y)) || 0;
  const gapMm = Number(opts.espacement) > 0 ? Number(opts.espacement) : 500;

  const layers = new Map([['0', 7], ['_CEAI_BOITE', 1], ['_CEAI_COTES', 1], ['_CEAI_TEXTES', 7]]);
  const ents = [];
  const X = (x) => n(ox + x * k), Y = (y) => n(oy + y * k);
  const line = (layer, x1, y1, x2, y2) => ents.push(`0\nLINE\n8\n${layer}\n10\n${X(x1)}\n20\n${Y(y1)}\n30\n0\n11\n${X(x2)}\n21\n${Y(y2)}\n31\n0\n`);
  const circle = (layer, x, y, r) => ents.push(`0\nCIRCLE\n8\n${layer}\n10\n${X(x)}\n20\n${Y(y)}\n30\n0\n40\n${n(r * k)}\n`);
  const text = (layer, x, y, h, s, align = 'center') => {
    const hj = align === 'left' ? 0 : align === 'right' ? 2 : 1;
    ents.push(`0\nTEXT\n8\n${layer}\n10\n${X(x)}\n20\n${Y(y)}\n30\n0\n40\n${n(h * k)}\n1\n${txt(s)}\n72\n${hj}\n11\n${X(x)}\n21\n${Y(y)}\n31\n0\n`);
  };
  const rect = (layer, x, y, w, h) => { line(layer, x, y, x + w, y); line(layer, x + w, y, x + w, y + h); line(layer, x + w, y + h, x, y + h); line(layer, x, y + h, x, y); };

  let cursorX = 0;
  for (const m of masques) {
    if (!m || !m.ok) continue;
    const bx = cursorX;
    const W = m.largeur;
    const top = m.tranchee ? m.tranchee.profondeur : m.hauteur;
    const th = Math.max(25, Math.min(80, W / 18)); // hauteur de texte (mm)

    // Contenant : tranchée (fond → terrain fini) ou boîte, ou conduit circulaire
    if (m.forme === 'circ') {
      circle('_CEAI_BOITE', bx + W / 2, W / 2, W / 2);
    } else {
      rect('_CEAI_BOITE', bx, 0, W, top);
      if (m.tranchee) {
        // limite de la zone d'enrobage / lit de pose
        line('_CEAI_COTES', bx, m.hauteur, bx + W, m.hauteur);
        const g = m.tranchee.grillage;
        const lg = layerName(`_CEAI_GRILLAGE_${g.couleur.toUpperCase()}`);
        layers.set(lg, g.aci);
        line(lg, bx + 20, g.y, bx + W - 20, g.y);
        text('_CEAI_TEXTES', bx + W + th * 0.6, g.y - th * 0.3, th * 0.6, `Grillage avertisseur ${g.couleur}`, 'left');
      }
    }

    for (const f of m.fourreaux) {
      const lf = layerName(`_CEAI_FOURREAU_${clean(f.type)}_${clean(f.code)}`);
      if (!layers.has(lf)) layers.set(lf, 30);
      circle(lf, bx + f.x, f.y, f.od / 2);
      circle(lf, bx + f.x, f.y, f.di / 2);
      // repère au-dessus du fourreau, détail dans la légende sous la coupe
      text('_CEAI_TEXTES', bx + f.x, f.y + f.od / 2 + th * 0.25, Math.min(th * 0.6, f.od * 0.45), f.id);
    }
    for (const c of m.cables) {
      const phase = c.phase || 'STANDARD';
      const lc = layerName(`_CEAI_CABLE_${clean(c.fam)}_${clean(c.code)}_${phase}`);
      if (!layers.has(lc)) layers.set(lc, PHASE_ACI[phase] || 7);
      circle(lc, bx + c.x, c.y, c.od / 2);
    }

    // Cotes et titre
    const dimL = m.forme === 'circ' ? `Ø ${W} mm` : `L = ${W} mm`;
    text('_CEAI_COTES', bx + W / 2, -th * 1.6, th, dimL);
    if (m.forme !== 'circ') text('_CEAI_COTES', bx - th * 0.6, top / 2, th, `P = ${top} mm`, 'right');
    text('_CEAI_TEXTES', bx + W / 2, top + th * 1.2, th * 1.2, m.nom);
    // Légende : une ligne par fourreau, puis le recouvrement
    let ly = -th * 3.2;
    for (const f of m.fourreaux) {
      text('_CEAI_TEXTES', bx, ly, th * 0.55, `${f.id}  ${f.type} ${f.code}  ${f.libelle || ''}${f.taux ? `  (${f.taux} %)` : ''}`, 'left');
      ly -= th * 0.9;
    }
    if (m.tranchee) text('_CEAI_TEXTES', bx, ly - th * 0.2, th * 0.55, `Recouvrement ${m.tranchee.recouvrement} mm (${m.tranchee.zone.replace('_', ' ')})`, 'left');

    cursorX += W + Math.max(gapMm, th * 12);
  }

  const layerTable = [...layers].map(([name, color]) => `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n`).join('');
  return '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1252\n9\n$INSUNITS\n70\n' + (k === 1 ? 4 : 6) + '\n0\nENDSEC\n'
    + '0\nSECTION\n2\nTABLES\n'
    + '0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n'
    + `0\nTABLE\n2\nLAYER\n70\n${layers.size}\n${layerTable}0\nENDTAB\n`
    + '0\nENDSEC\n'
    + '0\nSECTION\n2\nENTITIES\n' + ents.join('') + '0\nENDSEC\n0\nEOF\n';
}

module.exports = { masquesToDxf };

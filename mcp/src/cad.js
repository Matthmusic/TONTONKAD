'use strict';
// Dessin CAO commun : coupes (masques) et vues de dessus de chambres en
// ENTITÉS en mm (ligne, cercle, polyligne, texte), puis deux sorties :
//  - commandes « multiCAD MCP » (outil draw_entities, une commande par ligne,
//    calques via manage_layers) — https://github.com/AnCode666/multiCAD-mcp ;
//  - DXF R12 (repli, insertion manuelle).
// Calques alignés sur l'export DXF de l'application (_CEAI_…).

const V = require('../../src/renderer/vue3d.js');

const PHASE_ACI = { L1: 24, L2: 8, L3: 250, N: 5, PE: 3, PEN: 5 };
const ACI_LIAISON = [1, 5, 3, 6, 2, 4, 30, 140];
const clean = (s) => String(s).replace(/[\s/\-.,()]/g, '_');
const calque = (s) => String(s).slice(0, 31);
const r1 = (v) => Math.round(v * 10) / 10;

function Dessin() {
  const ents = [], calques = new Map([['_CEAI_TEXTES', 7]]);
  const d = {
    ents, calques,
    calque(nom, aci) { if (!calques.has(nom)) calques.set(nom, aci); return nom; },
    line(c, x1, y1, x2, y2, aci) { ents.push({ t: 'line', c, a: [x1, y1], b: [x2, y2], aci }); return d; },
    circle(c, x, y, r, aci) { ents.push({ t: 'circle', c, p: [x, y], r, aci }); return d; },
    poly(c, pts, ferme, aci) { ents.push({ t: 'poly', c, pts, ferme: !!ferme, aci }); return d; },
    rect(c, x, y, w, h, aci) { return d.poly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, aci); },
    text(c, x, y, h, s, align = 'center', aci) { ents.push({ t: 'text', c, p: [x, y], h, s: String(s), align, aci }); return d; },
    // Légende : lignes empilées vers le bas depuis une origine ; l'empilement
    // reste vertical sur le plan même si le dessin est tourné (texte horizontal).
    legende(c, x, y, h, pas) {
      let k = 0;
      return (s, aci) => { ents.push({ t: 'text', c, p: [x, y], h, s: String(s), align: 'left', aci, rang: k++, pas }); };
    },
  };
  return d;
}

// ─── Coupe d'un masque : origine = coin bas-gauche (fond de fouille) ───
function dessinMasque(m) {
  const d = Dessin();
  const W = m.largeur, top = m.tranchee ? m.tranchee.profondeur : m.hauteur;
  const th = Math.max(25, Math.min(80, W / 18));
  d.calque('_CEAI_BOITE', 1); d.calque('_CEAI_COTES', 1);
  if (m.forme === 'circ') d.circle('_CEAI_BOITE', W / 2, W / 2, W / 2);
  else {
    d.rect('_CEAI_BOITE', 0, 0, W, top);
    if (m.tranchee) {
      d.line('_CEAI_COTES', 0, m.hauteur, W, m.hauteur);
      const g = m.tranchee.grillage, lg = d.calque(calque(`_CEAI_GRILLAGE_${g.couleur.toUpperCase()}`), g.aci);
      d.line(lg, 20, g.y, W - 20, g.y);
      d.text('_CEAI_TEXTES', W + th * 0.6, g.y - th * 0.3, th * 0.6, `Grillage avertisseur ${g.couleur}`, 'left');
    }
  }
  for (const f of m.fourreaux) {
    const lf = d.calque(calque(`_CEAI_FOURREAU_${clean(f.type)}_${clean(f.code)}`), 30);
    d.circle(lf, f.x, f.y, f.od / 2).circle(lf, f.x, f.y, f.di / 2);
    d.text('_CEAI_TEXTES', f.x, f.y + f.od / 2 + th * 0.25, Math.min(th * 0.6, f.od * 0.45), f.id);
  }
  for (const c of m.cables) {
    const ph = c.phase || 'STANDARD';
    d.circle(d.calque(calque(`_CEAI_CABLE_${clean(c.fam)}_${clean(c.code)}_${ph}`), PHASE_ACI[ph] || 7), c.x, c.y, c.od / 2);
  }
  d.text('_CEAI_COTES', W / 2, -th * 1.6, th, m.forme === 'circ' ? `Ø ${W} mm` : `L = ${W} mm`);
  if (m.forme !== 'circ') d.text('_CEAI_COTES', -th * 0.6, top / 2, th, `P = ${top} mm`, 'right');
  d.text('_CEAI_TEXTES', W / 2, top + th * 1.2, th * 1.2, m.nom);
  const leg = d.legende('_CEAI_TEXTES', 0, -th * 3.2, th * 0.55, th * 0.9);
  for (const f of m.fourreaux) leg(`${f.id}  ${f.type} ${f.code}  ${f.libelle || ''}${f.taux ? `  (${f.taux} %)` : ''}`);
  if (m.tranchee) leg(`Recouvrement ${m.tranchee.recouvrement} mm (${m.tranchee.zone.replace('_', ' ')})`);
  return { nom: `Coupe ${m.nom}`, base: 'coin bas-gauche du fond de fouille', ...fin(d) };
}

// ─── Vue de dessus d'une chambre : origine = centre de l'intérieur ───
// Faces vues de dessus : pignon A à gauche (x−), pignon B à droite (x+),
// long-pan A en bas (y−), long-pan B en haut (y+). Même logique que vue3d.js.
function dessinChambre(etude, masques) {
  const d = Dessin();
  const L = etude.L, l = etude.l, inf = etude.infos || {}, e = inf.paroi || 0, sortie = 350;
  const X = (x) => x - L / 2, Y = (y) => y - l / 2; // repère coin → centre
  const th = Math.max(30, Math.min(90, Math.min(L, l) / 14));
  d.calque('_CEAI_CHAMBRE', 8); d.calque('_CEAI_TAMPON', 30); d.calque('_CEAI_TRAVERSEES', 1);
  d.rect('_CEAI_CHAMBRE', X(0), Y(0), L, l);
  if (e) d.rect('_CEAI_CHAMBRE', X(-e), Y(-e), L + 2 * e, l + 2 * e);
  // tampons
  const nt = inf.tampons, tp = inf.tampon;
  if (tp && nt) {
    const a = Math.min(Math.max(tp.L, tp.l), L / nt), b = Math.min(Math.min(tp.L, tp.l), l);
    for (let k = 0; k < nt; k++) { const cx = L * (k + 0.5) / nt; d.rect('_CEAI_TAMPON', X(cx - a / 2), Y((l - b) / 2), a, b); }
  } else if (nt > 1) for (let k = 1; k < nt; k++) d.line('_CEAI_TAMPON', X(L * k / nt), Y(0), X(L * k / nt), Y(l));
  // couleurs des liaisons : ordre global si fourni (mêmes couleurs partout)
  const ordre = Array.isArray(etude.ordreLiaisons) ? etude.ordreLiaisons : [];
  const noms = [...etude.traversees.map((t) => t.liaison), ...etude.arrets.map((a) => a.liaison)];
  const aci = new Map(noms.map((n, i) => { const j = ordre.indexOf(n); return [n, ACI_LIAISON[(j >= 0 ? j : ordre.length + i) % ACI_LIAISON.length]]; }));
  const G = {
    pignonA: { long: l, at: (t) => [0, t], out: [-1, 0] }, pignonB: { long: l, at: (t) => [L, t], out: [1, 0] },
    longPanA: { long: L, at: (t) => [t, 0], out: [0, -1] }, longPanB: { long: L, at: (t) => [t, l], out: [0, 1] },
  };
  const ancre = {};
  for (const k of Object.keys(G)) {
    const mq = masques[k];
    if (!mq) continue;
    const g = G[k], off = (g.long - mq.largeur) / 2, miroir = V.coupeEnMiroir(k, mq.sens);
    const tx = g.out[1] !== 0 ? 1 : 0, ty = g.out[0] !== 0 ? 1 : 0;
    const cols = new Map();
    ancre[k] = {};
    for (const f of mq.fourreaux) {
      const t = off + (miroir ? mq.largeur - f.x : f.x), key = Math.round(t);
      const c = cols.get(key) || { t, od: 0, n: 0, f };
      c.od = Math.max(c.od, f.od); c.n++; cols.set(key, c);
      const [bx, by] = g.at(t), a1 = [bx - g.out[0] * 40, by - g.out[1] * 40];
      for (const nom of f.liaisons || []) { const A = ancre[k][nom] || (ancre[k][nom] = { x: 0, y: 0, n: 0 }); A.x += a1[0]; A.y += a1[1]; A.n++; }
    }
    for (const c of cols.values()) {
      const [bx, by] = g.at(c.t), r = c.od / 2;
      const a0 = [bx + g.out[0] * (e + sortie), by + g.out[1] * (e + sortie)], a1 = [bx - g.out[0] * 40, by - g.out[1] * 40];
      const lf = d.calque(calque(`_CEAI_FOURREAU_${clean(c.f.type)}_${clean(c.f.code)}`), 30);
      d.poly(lf, [[X(a0[0] - tx * r), Y(a0[1] - ty * r)], [X(a1[0] - tx * r), Y(a1[1] - ty * r)], [X(a1[0] + tx * r), Y(a1[1] + ty * r)], [X(a0[0] + tx * r), Y(a0[1] + ty * r)]], true);
      const m = e + sortie / 2;
      d.text('_CEAI_TEXTES', X(bx + g.out[0] * m), Y(by + g.out[1] * m) - th * 0.2, Math.min(th * 0.5, c.od * 0.5), `Ø${Math.round(c.od)}${c.n > 1 ? ` x${c.n}` : ''}`);
    }
    // nom de la face, au-delà des tubes
    const [mx, my] = g.at(g.long / 2), dist = e + sortie + th * 1.5;
    d.text('_CEAI_TEXTES', X(mx + g.out[0] * dist), Y(my + g.out[1] * dist) - th * 0.3, th * 0.6,
      `${(etude.faces[k] && etude.faces[k].face) || k} : ${mq.nom}`, g.out[0] < 0 ? 'right' : g.out[0] > 0 ? 'left' : 'center');
  }
  const pt = (k, nom) => { const A = ancre[k] && ancre[k][nom]; return A && A.n ? [A.x / A.n, A.y / A.n] : null; };
  etude.traversees.forEach((t, i) => {
    const [a, b] = t.cles, A = pt(a, t.liaison), B = pt(b, t.liaison);
    if (!A || !B) return;
    const pts = t.type === 'angle' ? [A, G[a].out[0] !== 0 ? [B[0], A[1]] : [A[0], B[1]], B] : [A, B];
    d.poly('_CEAI_TRAVERSEES', pts.map(([x, y]) => [X(x), Y(y)]), false, aci.get(t.liaison));
    const mid = pts[Math.floor(pts.length / 2)];
    d.text('_CEAI_TRAVERSEES', X(mid[0]), Y(mid[1]) + th * 0.2, th * 0.5, String(i + 1), 'center', aci.get(t.liaison));
  });
  etude.arrets.forEach((a) => {
    const A = pt(a.cle, a.liaison);
    if (A) d.circle('_CEAI_TRAVERSEES', X(A[0]), Y(A[1]), th * 0.25, aci.get(a.liaison));
  });
  d.text('_CEAI_TEXTES', 0, l / 2 - th * 1.3, th * 0.8, `${etude.nom ? etude.nom + ' - ' : ''}${etude.ref}`);
  d.text('_CEAI_TEXTES', 0, l / 2 - th * 2.3, th * 0.5, `${L} x ${l} mm interieur${tp ? ` - ${nt} tampon(s) ${tp.L}x${tp.l} ${tp.classe}` : ''}`);
  // légende des traversées sous la chambre
  const leg = d.legende('_CEAI_TRAVERSEES', -L / 2 - e, -l / 2 - e - sortie - th * 3, th * 0.5, th * 0.8);
  etude.traversees.forEach((t, i) => leg(`${i + 1}. ${t.liaison} (${t.entree} -> ${t.sortie}, ${t.type})`, aci.get(t.liaison)));
  etude.arrets.forEach((a) => leg(`o ${a.liaison} s'arrete (${a.face})`, aci.get(a.liaison)));
  return { nom: `Chambre ${etude.nom || etude.ref}`, base: 'centre de l\'intérieur de la chambre ; pignon A vers −X, long-pan B vers +Y', ...fin(d) };
}

function fin(d) {
  return { entites: d.ents, calques: [...d.calques].map(([nom, aci]) => ({ nom, aci })) };
}

// ─── Placement (rotation autour de la base, puis translation) ───
function placer(obj, pl) {
  const x0 = Number(pl && pl.x) || 0, y0 = Number(pl && pl.y) || 0, a = (Number(pl && pl.rotation) || 0) * Math.PI / 180;
  const ech = Number(pl && pl.echelle) > 0 ? Number(pl.echelle) : 1;
  const c = Math.cos(a), s = Math.sin(a);
  const T = ([x, y]) => [x0 + ech * (x * c - y * s), y0 + ech * (x * s + y * c)];
  return obj.entites.map((e) => {
    if (e.t === 'line') return { ...e, a: T(e.a), b: T(e.b) };
    if (e.t === 'circle') return { ...e, p: T(e.p), r: e.r * ech };
    if (e.t === 'poly') return { ...e, pts: e.pts.map(T) };
    if (e.rang != null) { const [px, py] = T(e.p); return { ...e, p: [px, py - e.rang * e.pas * ech], h: e.h * ech }; }
    return { ...e, p: T(e.p), h: e.h * ech };
  });
}

// ─── Sortie multiCAD MCP (draw_entities / manage_layers) ───
const COULEUR = { 1: 'red', 2: 'yellow', 3: 'green', 4: 'cyan', 5: 'blue', 6: 'magenta', 7: 'white' };
const nomCouleur = (aci) => COULEUR[aci] || (aci === 30 || aci === 24 ? 'red' : aci === 140 ? 'cyan' : 'white');
const P = ([x, y]) => `${r1(x)},${r1(y)}`;
const texteSur = (s) => String(s).replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');

function versMultiCAD(objets, placements = {}) {
  const calques = new Map();
  const blocs = objets.map((o) => {
    o.calques.forEach((c) => { if (!calques.has(c.nom)) calques.set(c.nom, c.aci); });
    const aciCalque = new Map(o.calques.map((c) => [c.nom, c.aci]));
    const pl = placements[o.nom] || null;
    const cmds = placer(o, pl).map((e) => {
      const col = nomCouleur(e.aci || aciCalque.get(e.c) || 7);
      if (e.t === 'line') return `line|${P(e.a)}|${P(e.b)}|${col}|${e.c}`;
      if (e.t === 'circle') return `circle|${P(e.p)}|${r1(e.r)}|${col}|${e.c}`;
      if (e.t === 'poly') return `polyline|${e.pts.map(P).join(';')}|${e.ferme}|${col}|${e.c}`;
      // multiCAD pose le texte par son point d'insertion (gauche) : on décale le centré
      const w = e.s.length * e.h * 0.6, dx = e.align === 'center' ? -w / 2 : e.align === 'right' ? -w : 0;
      return `text|${P([e.p[0] + dx, e.p[1]])}|${texteSur(e.s)}|${r1(e.h)}|${col}|${e.c}`;
    });
    return { nom: o.nom, base: o.base, placement: pl || { x: 0, y: 0, rotation: 0, note: 'non placé : à l\'origine du dessin' }, commandes: cmds.join('\n'), nombre: cmds.length };
  });
  return {
    calques: [...calques].map(([nom, aci]) => `create|${nom}|${nomCouleur(aci)}|25`).join('\n'),
    blocs,
  };
}

// ─── DXF R12 d'objets posés côte à côte (ou aux placements donnés) ───
const txt = (s) => String(s).replace(/→/g, '->').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
function versDxf(objets, placements = {}, espacement = 1000) {
  const calques = new Map([['0', 7]]);
  const out = [];
  const n = (v) => (Math.round(v * 1e4) / 1e4).toString();
  let cx = 0;
  for (const o of objets) {
    o.calques.forEach((c) => { if (!calques.has(c.nom)) calques.set(c.nom, c.aci); });
    const xs = o.entites.flatMap((e) => (e.t === 'line' ? [e.a[0], e.b[0]] : e.t === 'poly' ? e.pts.map((p) => p[0]) : [e.p[0]]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const pl = placements[o.nom] || { x: cx - minX, y: 0 };
    for (const e of placer(o, pl)) {
      const col = e.aci ? `62\n${e.aci}\n` : '';
      if (e.t === 'line') out.push(`0\nLINE\n8\n${e.c}\n${col}10\n${n(e.a[0])}\n20\n${n(e.a[1])}\n30\n0\n11\n${n(e.b[0])}\n21\n${n(e.b[1])}\n31\n0\n`);
      else if (e.t === 'circle') out.push(`0\nCIRCLE\n8\n${e.c}\n${col}10\n${n(e.p[0])}\n20\n${n(e.p[1])}\n30\n0\n40\n${n(e.r)}\n`);
      else if (e.t === 'poly') out.push(`0\nPOLYLINE\n8\n${e.c}\n${col}66\n1\n10\n0\n20\n0\n30\n0\n70\n${e.ferme ? 1 : 0}\n` + e.pts.map(([x, y]) => `0\nVERTEX\n8\n${e.c}\n10\n${n(x)}\n20\n${n(y)}\n30\n0\n`).join('') + `0\nSEQEND\n8\n${e.c}\n`);
      else {
        const hj = e.align === 'left' ? 0 : e.align === 'right' ? 2 : 1;
        out.push(`0\nTEXT\n8\n${e.c}\n${col}10\n${n(e.p[0])}\n20\n${n(e.p[1])}\n30\n0\n40\n${n(e.h)}\n1\n${txt(e.s)}\n72\n${hj}\n11\n${n(e.p[0])}\n21\n${n(e.p[1])}\n31\n0\n`);
      }
    }
    cx += (maxX - minX) + espacement;
  }
  const table = [...calques].map(([nom, aci]) => `0\nLAYER\n2\n${nom}\n70\n0\n62\n${aci}\n6\nCONTINUOUS\n`).join('');
  return '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1252\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n'
    + '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n'
    + `0\nTABLE\n2\nLAYER\n70\n${calques.size}\n${table}0\nENDTAB\n0\nENDSEC\n`
    + '0\nSECTION\n2\nENTITIES\n' + out.join('') + '0\nENDSEC\n0\nEOF\n';
}

module.exports = { dessinMasque, dessinChambre, versMultiCAD, versDxf, placer };

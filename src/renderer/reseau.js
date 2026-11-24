'use strict';
// Réseau de chambres — PUR, sans DOM. Exposé sur window.Reseau et module.exports.
//
// Un projet décrit un réseau :
//   noeuds   : chambres, coffrets/tableaux, sorties (nom, couleur, position)
//   troncons : liaison entre deux nœuds, par une face de chacun, avec une
//              longueur (m) et UNE coupe (les fourreaux), la même aux deux bouts.
// Faces : chambre → pignonA (gauche), pignonB (droite), longPanA (bas),
//         longPanB (haut) ; coffret → 'bas' (une seule entrée, plusieurs tronçons
//         possibles) ; sortie → 'sortie'.
(function (root) {
  const FACES_CHAMBRE = ['pignonA', 'pignonB', 'longPanA', 'longPanB'];
  const COULEURS = ['#e8661c', '#2459c9', '#16857a', '#b0302a', '#6b4fd0', '#c78a00', '#3f8f3a', '#5d6a70'];
  const TYPES = { chambre: 'Chambre', coffret: 'Coffret / tableau', sortie: 'Sortie' };
  const LIBELLE_FACE = { longPanB: 'côté 1', pignonB: 'côté 2', longPanA: 'côté 3', pignonA: 'côté 4', bas: 'face du bas', sortie: 'sortie' };

  function creerReseau() { return { noeuds: [], troncons: [], seq: 1, actif: { vue: 'coupe', noeud: null, troncon: null } }; }

  const noeud = (r, id) => r.noeuds.find((n) => n.id === id) || null;
  const troncon = (r, id) => r.troncons.find((t) => t.id === id) || null;

  function prefixe(type) { return type === 'chambre' ? 'C' : type === 'coffret' ? 'CF' : 'S'; }

  function ajouterNoeud(r, type, opts = {}) {
    if (!TYPES[type]) throw new Error(`Type de nœud inconnu : ${type}`);
    const n = r.noeuds.filter((x) => x.type === type).length + 1;
    const nd = {
      id: `n${r.seq++}`, type,
      nom: opts.nom || `${prefixe(type)}${n}`,
      couleur: opts.couleur || COULEURS[(r.noeuds.length) % COULEURS.length],
      x: Number.isFinite(opts.x) ? opts.x : 120 + (r.noeuds.length % 5) * 160,
      y: Number.isFinite(opts.y) ? opts.y : 120 + Math.floor(r.noeuds.length / 5) * 140,
    };
    if (type === 'chambre') nd.ref = opts.ref || null; // null = choix automatique
    if (type === 'coffret') nd.coffret = { genre: 'coffret', largeur: null, profondeur: null, source: 'manuel', ...(opts.coffret || {}) };
    r.noeuds.push(nd);
    return nd;
  }

  // Faces encore sans tronçon d'un nœud. Un côté de chambre peut porter PLUSIEURS
  // tronçons (coupes accolées dans le même masque, vers des destinations
  // différentes) : les faces libres ne servent qu'au choix automatique.
  function facesLibres(r, nd) {
    if (nd.type !== 'chambre') return [nd.type === 'coffret' ? 'bas' : 'sortie'];
    const prises = new Set(r.troncons.flatMap((t) => [t.a, t.b]).filter((e) => e.noeud === nd.id).map((e) => e.face));
    return FACES_CHAMBRE.filter((f) => !prises.has(f));
  }

  // Face « naturelle » d'une chambre vers un point (repère synoptique, y vers le bas) :
  // à droite → pignon B, à gauche → pignon A, en bas → long-pan A, en haut → long-pan B.
  function faceVers(nd, x, y) {
    const dx = x - nd.x, dy = y - nd.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'pignonB' : 'pignonA';
    return dy >= 0 ? 'longPanA' : 'longPanB';
  }
  function choisirFace(r, nd, vers) {
    const libres = facesLibres(r, nd);
    if (nd.type !== 'chambre') return libres[0];
    const ideale = faceVers(nd, vers.x, vers.y);
    if (!libres.length) return ideale; // tous les côtés portent déjà un tronçon : on partage
    if (libres.includes(ideale)) return ideale;
    const ordre = { pignonA: ['longPanA', 'longPanB', 'pignonB'], pignonB: ['longPanB', 'longPanA', 'pignonA'],
      longPanA: ['pignonA', 'pignonB', 'longPanB'], longPanB: ['pignonB', 'pignonA', 'longPanA'] }[ideale];
    return ordre.find((f) => libres.includes(f)) || libres[0];
  }

  function relier(r, idA, idB, opts = {}) {
    const A = noeud(r, idA), B = noeud(r, idB);
    if (!A || !B) throw new Error('Nœud introuvable');
    if (A.id === B.id) throw new Error('Impossible de relier un élément à lui-même');
    const faceA = opts.faceA || choisirFace(r, A, B);
    const faceB = opts.faceB || choisirFace(r, B, A);
    const valide = (nd, f) => (nd.type === 'chambre' ? FACES_CHAMBRE.includes(f) : f === facesLibres(r, nd)[0]);
    if (!valide(A, faceA)) throw new Error(`${A.nom} : face « ${faceA} » inconnue`);
    if (!valide(B, faceB)) throw new Error(`${B.nom} : face « ${faceB} » inconnue`);
    const t = { id: `t${r.seq++}`, a: { noeud: A.id, face: faceA }, b: { noeud: B.id, face: faceB },
      longueurM: Number(opts.longueurM) > 0 ? Number(opts.longueurM) : null, coupe: opts.coupe || null };
    r.troncons.push(t);
    return t;
  }

  // Change la face d'un bout de tronçon (si libre).
  function changerFace(r, tId, bout, face) {
    const t = troncon(r, tId);
    const nd = noeud(r, t[bout].noeud);
    if (t[bout].face === face) return t;
    if (nd.type === 'chambre' && !FACES_CHAMBRE.includes(face)) throw new Error(`${nd.nom} : face « ${face} » inconnue`);
    t[bout].face = face;
    return t;
  }

  function supprimerTroncon(r, tId) { r.troncons = r.troncons.filter((t) => t.id !== tId); }
  function supprimerNoeud(r, id) {
    r.troncons = r.troncons.filter((t) => t.a.noeud !== id && t.b.noeud !== id);
    r.noeuds = r.noeuds.filter((n) => n.id !== id);
  }

  // Tronçons d'un nœud, avec la face côté nœud et l'élément à l'autre bout.
  function tronconsDe(r, id) {
    return r.troncons.filter((t) => t.a.noeud === id || t.b.noeud === id).map((t) => {
      const ici = t.a.noeud === id ? t.a : t.b, la = t.a.noeud === id ? t.b : t.a;
      return { troncon: t, face: ici.face, autre: noeud(r, la.noeud), faceAutre: la.face };
    });
  }
  // Tronçon(s) arrivant sur une face donnée d'une chambre (surFace : le premier).
  function surFaceTous(r, id, face) { return tronconsDe(r, id).filter((x) => x.face === face); }
  function surFace(r, id, face) { return surFaceTous(r, id, face)[0] || null; }

  // Contrôle d'un coffret : la nappe (largeur × hauteur de la coupe) doit
  // passer dans la face du bas (largeur × profondeur), dans un sens ou l'autre.
  function verifierCoffret(cf, largeurNappe, hauteurNappe) {
    if (!cf || !(cf.largeur > 0) || !(cf.profondeur > 0)) return { connu: false, tient: null };
    const tient = (largeurNappe <= cf.largeur && hauteurNappe <= cf.profondeur) || (largeurNappe <= cf.profondeur && hauteurNappe <= cf.largeur);
    return { connu: true, tient, marge: { largeur: cf.largeur - largeurNappe, profondeur: cf.profondeur - hauteurNappe } };
  }

  // Reprise d'une « chambre » de la version précédente (faces → coupes) :
  // une chambre C1, et pour chaque face renseignée un tronçon vers une sortie.
  function depuisAncienneChambre(c, etatFaceActive) {
    const r = creerReseau();
    if (!c || !c.faces) return null;
    const ch = ajouterNoeud(r, 'chambre', { nom: c.nom || 'C1', ref: c.ref || null, x: 400, y: 260 });
    const pos = { pignonA: [140, 260], pignonB: [660, 260], longPanA: [400, 440], longPanB: [400, 80] };
    let actif = null;
    for (const f of FACES_CHAMBRE) {
      const etat = f === c.faceActive ? (etatFaceActive || null) : c.faces[f];
      if (!etat && f !== c.faceActive) continue;
      const s = ajouterNoeud(r, 'sortie', { nom: `Sortie ${LIBELLE_FACE[f]}`, x: pos[f][0], y: pos[f][1] });
      const t = relier(r, ch.id, s.id, { faceA: f, faceB: 'sortie', coupe: f === c.faceActive ? null : etat });
      if (f === c.faceActive) actif = t.id;
    }
    r.actif = { vue: 'coupe', noeud: ch.id, troncon: actif };
    return r;
  }

  // Continuité des liaisons sur tout le réseau.
  // liaisonsDe(t) → noms des liaisons portées par le tronçon t.
  // Une liaison doit former une chaîne qui ne s'arrête que sur un coffret /
  // tableau ou une sortie : finir dans une chambre = interruption ; y passer
  // par plus de deux faces = embranchement à vérifier.
  function continuite(r, liaisonsDe) {
    const parLiaison = new Map();
    for (const t of r.troncons) {
      for (const nom of liaisonsDe(t) || []) {
        if (!nom) continue;
        if (!parLiaison.has(nom)) parLiaison.set(nom, []);
        parLiaison.get(nom).push(t);
      }
    }
    const liaisons = [], problemes = [];
    for (const [nom, ts] of parLiaison) {
      const degre = new Map();
      ts.forEach((t) => [t.a.noeud, t.b.noeud].forEach((n) => degre.set(n, (degre.get(n) || 0) + 1)));
      const pb = [];
      for (const [nid, d] of degre) {
        const nd = noeud(r, nid);
        if (!nd) continue;
        if (nd.type === 'chambre' && d === 1) pb.push(`s'interrompt dans ${nd.nom}`);
        if (nd.type === 'chambre' && d > 2) pb.push(`se divise dans ${nd.nom} (${d} tronçons)`);
      }
      // chemin : d'une extrémité (degré 1) en suivant les tronçons
      const bouts = [...degre].filter(([, d]) => d === 1).map(([n]) => n);
      const chemin = [];
      if (bouts.length) {
        let cur = bouts[0], restants = [...ts];
        chemin.push(cur);
        while (restants.length) {
          const i = restants.findIndex((t) => t.a.noeud === cur || t.b.noeud === cur);
          if (i < 0) break;
          const t = restants.splice(i, 1)[0];
          cur = t.a.noeud === cur ? t.b.noeud : t.a.noeud;
          chemin.push(cur);
        }
        if (restants.length) pb.push('tronçons non reliés entre eux');
      }
      const manque = ts.some((t) => !(t.longueurM > 0));
      const longueurM = ts.reduce((s, t) => s + (t.longueurM || 0), 0);
      const l = { nom, troncons: ts.map((t) => t.id), chemin: chemin.map((id) => (noeud(r, id) || {}).nom), longueurM, longueurIncomplete: manque, problemes: pb };
      liaisons.push(l);
      pb.forEach((x) => problemes.push(`${nom} ${x}`));
    }
    liaisons.sort((a, b) => a.nom.localeCompare(b.nom));
    return { liaisons, problemes };
  }

  // Métré des fourreaux : par type+code, longueur = Σ (nombre × longueur du tronçon).
  // fourreauxDe(t) → [{ type, code }] du tronçon t.
  function metre(r, fourreauxDe) {
    const lignes = new Map(), sansLongueur = [];
    for (const t of r.troncons) {
      const fs = fourreauxDe(t) || [];
      if (!fs.length) continue;
      if (!(t.longueurM > 0)) { sansLongueur.push(nomTroncon(r, t)); continue; }
      for (const f of fs) {
        const k = `${f.type || ''} ${f.code || ''}`.trim();
        const l = lignes.get(k) || { fourreau: k, nombre: 0, metres: 0 };
        l.nombre += 1; l.metres += t.longueurM;
        lignes.set(k, l);
      }
    }
    const tab = [...lignes.values()].sort((a, b) => a.fourreau.localeCompare(b.fourreau, 'fr', { numeric: true }));
    const longueurReseau = r.troncons.reduce((s, t) => s + (t.longueurM || 0), 0);
    return { lignes: tab, totalMetres: tab.reduce((s, l) => s + l.metres, 0), longueurReseau, sansLongueur };
  }

  // Libellé court d'un tronçon : « C1 → C2 ».
  function nomTroncon(r, t) {
    const A = noeud(r, t.a.noeud), B = noeud(r, t.b.noeud);
    return `${A ? A.nom : '?'} → ${B ? B.nom : '?'}`;
  }


  // Contenu de l'étiquette d'un tronçon (synoptique) à partir de sa coupe :
  // fourreaux par Ø (du plus gros au plus petit) et liaisons avec leurs
  // sections, le PE regroupé avec sa liaison (« … - PE »).
  //   coupe = { fourreaux: [{od|code}], cables: [{liaison, code}] } → { phi: [[Ø, nb]], liaisons: [{nom, sections}] }
  function contenuEtiquette(coupe) {
    if (!coupe || !(coupe.fourreaux || []).length) return { phi: [], liaisons: [] };
    const nb = new Map();
    coupe.fourreaux.forEach((f) => { const d = Math.round(Number(f.od) || Number(f.code) || 0); nb.set(d, (nb.get(d) || 0) + 1); });
    const lia = new Map();
    (coupe.cables || []).forEach((c) => {
      const nom = String(c.liaison || c.label || '').trim();
      if (!nom) return;
      const base = nom.replace(/\s*-\s*PE$/i, ''), pe = base !== nom;
      if (!lia.has(base)) lia.set(base, new Map());
      const k = (pe ? 'PE ' : '') + c.code;
      lia.get(base).set(k, (lia.get(base).get(k) || 0) + 1);
    });
    const liaisons = [...lia].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })).map(([nom, m]) => ({
      nom,
      sections: [...m].sort((a, b) => (a[0].startsWith('PE') - b[0].startsWith('PE')) || b[1] - a[1])
        .map(([k, q]) => (k.startsWith('PE') && q === 1 ? k : `${q}×${k}`)).join(' + '),
    }));
    return { phi: [...nb].sort((a, b) => b[0] - a[0]), liaisons };
  }

  // ─── Disposition ancrée du synoptique ─────────────────────────────────────
  // Pas de placement libre : la chaîne principale des chambres est alignée,
  // les dérivations partent à la perpendiculaire (au-dessus si côté haut,
  // en dessous si côté bas, sinon du côté libre). Écart entre un élément et
  // l'étiquette d'un tronçon : `ecart` × largeur de l'étiquette (horizontal)
  // ou × hauteur (vertical). Avec `ratio` (largeur/hauteur de la page), la
  // chaîne est repliée en rangées (aller-retour) pour remplir au mieux la page.
  //   opts = { tailleNoeud(n) → {w,h}, tailleEtiquette(t) → {w,h}, ecart = 0.5, ratio, marge = 40 }
  //   → { noeuds: {id: {x,y}}, etiquettes: {tId: {x,y,w,h,sens}}, largeur, hauteur, rangs }
  function dispositionAncree(r, opts) {
    const E = opts.ecart == null ? 0.5 : opts.ecart, G = opts.marge == null ? 40 : opts.marge;
    const tN = (id) => opts.tailleNoeud(noeud(r, id)), tE = (t) => opts.tailleEtiquette(t);
    const adj = new Map(r.noeuds.map((n) => [n.id, []]));
    r.troncons.forEach((t) => {
      if (!adj.has(t.a.noeud) || !adj.has(t.b.noeud)) return;
      adj.get(t.a.noeud).push({ v: t.b.noeud, t, face: t.a.face });
      adj.get(t.b.noeud).push({ v: t.a.noeud, t, face: t.b.face });
    });
    const nomDe = (id) => (noeud(r, id) || {}).nom || '';
    const parNom = (a, b) => nomDe(a).localeCompare(nomDe(b), 'fr', { numeric: true });
    const pos = {}, etiq = {}, place = new Set(), arete = new Set();
    let decalY = 0, largeurMax = 0, rangsTotal = 0;

    // Sous-arbre d'une dérivation verticale (sens -1 haut, +1 bas) : liste
    // d'éléments relatifs { id|t, dx, dy } et encombrement { gauche, droite, prof }.
    function derivation(parent, lien, sens) {
      const items = [], dejaVus = new Set([parent]);
      let y = sens * tN(parent).h / 2, gauche = 0, droite = 0, cur = lien;
      while (cur) {
        const e = tE(cur.t), n2 = tN(cur.v);
        const yL = y + sens * (e.h * E + e.h / 2);
        items.push({ t: cur.t, dx: 0, dy: yL, w: e.w, h: e.h });
        y = yL + sens * (e.h / 2 + e.h * E + n2.h / 2);
        items.push({ id: cur.v, dx: 0, dy: y });
        arete.add(cur.t.id); dejaVus.add(cur.v);
        gauche = Math.max(gauche, e.w / 2, n2.w / 2); droite = Math.max(droite, e.w / 2, n2.w / 2);
        y += sens * n2.h / 2;
        const suite = adj.get(cur.v).filter((x) => !arete.has(x.t.id) && !place.has(x.v) && !dejaVus.has(x.v)).sort((a, b) => parNom(a.v, b.v));
        cur = suite[0] || null;
        // les autres enfants éventuels : petites dérivations à droite (rare)
        suite.slice(1).forEach((x, k) => {
          const e2 = tE(x.t), n3 = tN(x.v), dx = droite + G + Math.max(e2.w, n3.w) / 2;
          items.push({ t: x.t, dx, dy: y + sens * (e2.h * E + e2.h / 2), w: e2.w, h: e2.h });
          items.push({ id: x.v, dx, dy: y + sens * (e2.h * (1 + 2 * E) + n3.h / 2) });
          arete.add(x.t.id); dejaVus.add(x.v);
          droite = dx + Math.max(e2.w, n3.w) / 2;
          void k;
        });
      }
      return { items, gauche, droite, prof: Math.abs(y), vus: dejaVus };
    }

    const restants = () => r.noeuds.map((n) => n.id).filter((id) => !place.has(id));
    while (restants().length) {
      // chaîne principale de la composante : plus long chemin entre chambres
      const comp = new Set(), q0 = [restants().sort(parNom)[0]];
      while (q0.length) { const u = q0.shift(); if (comp.has(u)) continue; comp.add(u); adj.get(u).forEach((x) => q0.push(x.v)); }
      const chambres = [...comp].filter((id) => (noeud(r, id) || {}).type === 'chambre');
      const base = new Set(chambres.length >= 2 ? chambres : [...comp]);
      const bfs = (s0) => {
        const prec = new Map([[s0, null]]), q = [s0]; let der = s0;
        while (q.length) { const u = q.shift(); der = u; adj.get(u).filter((x) => base.has(x.v) && !prec.has(x.v)).sort((a, b) => parNom(a.v, b.v)).forEach((x) => { prec.set(x.v, u); q.push(x.v); }); }
        return { der, prec };
      };
      const debut = [...base].sort(parNom)[0];
      const a = bfs(bfs(debut).der).der, b = bfs(a);
      let chaine = []; for (let u = b.der; u != null; u = b.prec.get(u)) chaine.push(u);
      if (parNom(chaine[0], chaine[chaine.length - 1]) > 0) chaine.reverse();
      const liens = chaine.slice(1).map((v, i) => adj.get(chaine[i]).find((x) => x.v === v));
      liens.forEach((l) => arete.add(l.t.id));
      chaine.forEach((id) => place.add(id));

      // dérivations de chaque nœud de la chaîne
      const ensChaine = new Set(chaine);
      const branches = chaine.map((id) => adj.get(id).filter((x) => !arete.has(x.t.id) && !ensChaine.has(x.v)).sort((x, y) => parNom(x.v, y.v)));

      // découpe en rangées
      const calc = (k) => {
        const n = chaine.length, coupes = [0];
        if (k > 1) {
          const cumul = [0]; for (let i = 0; i < liens.length; i++) cumul.push(cumul[i] + tE(liens[i].t).w * (1 + 2 * E));
          for (let j = 1; j < k; j++) { const cible = cumul[cumul.length - 1] * j / k; let i = coupes[j - 1] + 1; while (i < n - 1 && cumul[i] < cible) i++; coupes.push(Math.min(i, n - 1)); }
        }
        coupes.push(n);
        return coupes;
      };
      const essai = (k) => {
        const coupes = calc(k);
        if (new Set(coupes).size !== coupes.length) return null;
        arete.clear(); r.troncons.forEach((t) => { if (liens.some((l) => l.t.id === t.id)) arete.add(t.id); });
        const P = {}, L = {}, rangs = [];
        let yRang = 0, xMax = 0, yMin = Infinity, yMax = -Infinity;
        for (let j = 0; j < coupes.length - 1; j++) {
          const ids = chaine.slice(coupes[j], coupes[j + 1]), dir = j % 2 ? -1 : 1;
          // côtés interdits aux extrémités de rangée (le lien vers la rangée suivante passe là)
          const interdit = (i) => {
            const g = coupes[j] + i;
            if (j < coupes.length - 2 && g === coupes[j + 1] - 1) return 1;   // fin de rangée : pas en dessous
            if (j > 0 && g === coupes[j]) return -1;                          // début : pas au-dessus
            return 0;
          };
          const der = ids.map((id, i) => {
            const nb = { '-1': 0, 1: 0 }, res = [];
            branches[coupes[j] + i].forEach((x) => {
              if (arete.has(x.t.id)) return; // déjà dessiné par une autre dérivation
              // long-pan B en haut, long-pan A en bas ; pignon : le côté le moins chargé
              let s2 = x.face === 'longPanB' ? -1 : x.face === 'longPanA' ? 1 : (nb[1] <= nb[-1] ? 1 : -1);
              if (s2 === interdit(i)) s2 = -s2;
              if (s2 === interdit(i)) return;
              nb[s2] += 1;
              const d = derivation(ids[i], x, s2);
              d.sens = s2; res.push(d);
            });
            // plusieurs dérivations du même côté : en éventail, côte à côte, centrées
            [-1, 1].forEach((sg) => {
              const ds = res.filter((d) => d.sens === sg);
              if (ds.length < 2) return;
              const total = ds.reduce((a2, d) => a2 + d.gauche + d.droite, 0) + G * (ds.length - 1);
              let x0 = -total / 2;
              ds.forEach((d) => {
                const off = x0 + d.gauche;
                d.items.forEach((it) => { it.dx += off; });
                const g0 = d.gauche, d0 = d.droite;
                d.gauche = Math.max(0, g0 - off); d.droite = Math.max(0, d0 + off);
                x0 += g0 + d0 + G;
              });
            });
            return res;
          });
          const haut = Math.max(...ids.map((id, i) => Math.max(tN(id).h / 2, ...der[i].filter((d) => d.sens < 0).map((d) => d.prof))));
          const bas = Math.max(...ids.map((id, i) => Math.max(tN(id).h / 2, ...der[i].filter((d) => d.sens > 0).map((d) => d.prof))));
          if (j > 0) {
            const lienRang = liens[coupes[j] - 1], e = tE(lienRang.t);
            const pas = Math.max(rangs[j - 1].bas + haut + G, e.h * (1 + 2 * E) + (tN(chaine[coupes[j] - 1]).h + tN(ids[0]).h) / 2);
            yRang = rangs[j - 1].y + pas;
          }
          // abscisses
          const xs = [];
          ids.forEach((id, i) => {
            const demi = (cote) => Math.max(tN(id).w / 2, ...der[i].map((d) => (cote > 0 ? d.droite : d.gauche)));
            if (i === 0) { xs.push(j === 0 ? demi(-1) : (j % 2 ? rangs[j - 1].xFin : rangs[j - 1].xFin)); return; }
            const e = tE(liens[coupes[j] + i - 1].t), prec = i - 1;
            const demiPrec = Math.max(tN(ids[prec]).w / 2, ...der[prec].map((d) => (dir > 0 ? d.droite : d.gauche)));
            const pas = Math.max(e.w * (1 + 2 * E) + (tN(ids[prec]).w + tN(id).w) / 2, demiPrec + demi(-dir) + G);
            xs.push(xs[i - 1] + dir * pas);
          });
          ids.forEach((id, i) => {
            P[id] = { x: xs[i], y: yRang };
            der[i].forEach((d) => d.items.forEach((it) => {
              if (it.id != null) P[it.id] = { x: xs[i] + it.dx, y: yRang + it.dy };
              else L[it.t.id] = { x: xs[i] + it.dx, y: yRang + it.dy, w: it.w, h: it.h, sens: 'v' };
            }));
            if (i > 0) {
              const t = liens[coupes[j] + i - 1].t, e = tE(t);
              const a1 = xs[i - 1] + dir * tN(ids[i - 1]).w / 2, b1 = xs[i] - dir * tN(id).w / 2;
              L[t.id] = { x: (a1 + b1) / 2, y: yRang, w: e.w, h: e.h, sens: 'h' };
            }
          });
          if (j > 0) {
            const t = liens[coupes[j] - 1].t, e = tE(t), A = P[chaine[coupes[j] - 1]], B = P[ids[0]];
            L[t.id] = { x: A.x, y: (A.y + tN(chaine[coupes[j] - 1]).h / 2 + B.y - tN(ids[0]).h / 2) / 2, w: e.w, h: e.h, sens: 'v' };
          }
          rangs.push({ y: yRang, bas, xFin: xs[xs.length - 1] });
        }
        const pts = [];
        Object.entries(P).forEach(([id, p2]) => { const z = tN(id); pts.push([p2.x - z.w / 2, p2.y - z.h / 2], [p2.x + z.w / 2, p2.y + z.h / 2]); });
        Object.values(L).forEach((l) => pts.push([l.x - l.w / 2, l.y - l.h / 2], [l.x + l.w / 2, l.y + l.h / 2]));
        const minX = Math.min(...pts.map((q) => q[0])), maxX2 = Math.max(...pts.map((q) => q[0]));
        yMin = Math.min(...pts.map((q) => q[1])); yMax = Math.max(...pts.map((q) => q[1])); xMax = maxX2;
        return { P, L, k, minX, largeur: xMax - minX, hauteur: yMax - yMin, yMin };
      };
      let meilleur = essai(1);
      if (opts.ratio) {
        const score = (s2) => Math.min(opts.ratio / s2.largeur, 1 / s2.hauteur);
        for (let k = 2; k <= Math.min(8, chaine.length); k++) { const s2 = essai(k); if (s2 && score(s2) > score(meilleur)) meilleur = s2; }
      }
      const fin = essai(meilleur.k); // reconstruit les arêtes de la solution retenue
      Object.entries(fin.P).forEach(([id, p2]) => { pos[id] = { x: p2.x - fin.minX + G, y: p2.y - fin.yMin + G + decalY }; place.add(id); });
      Object.entries(fin.L).forEach(([id, l]) => { etiq[id] = { ...l, x: l.x - fin.minX + G, y: l.y - fin.yMin + G + decalY }; });
      decalY += fin.hauteur + 2 * G; largeurMax = Math.max(largeurMax, fin.largeur + 2 * G); rangsTotal += fin.k;
    }
    // tronçons restés sans étiquette (cycles) : au milieu du segment
    r.troncons.forEach((t) => {
      if (etiq[t.id] || !pos[t.a.noeud] || !pos[t.b.noeud]) return;
      const e = tE(t), A = pos[t.a.noeud], B = pos[t.b.noeud];
      etiq[t.id] = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, w: e.w, h: e.h, sens: Math.abs(A.x - B.x) > Math.abs(A.y - B.y) ? 'h' : 'v' };
    });
    return { noeuds: pos, etiquettes: etiq, largeur: largeurMax, hauteur: decalY, rangs: rangsTotal };
  }

  const api = {
    FACES_CHAMBRE, COULEURS, TYPES, LIBELLE_FACE,
    creerReseau, ajouterNoeud, relier, changerFace, supprimerNoeud, supprimerTroncon,
    noeud, troncon, tronconsDe, surFace, surFaceTous, facesLibres, faceVers, verifierCoffret,
    depuisAncienneChambre, nomTroncon, continuite, metre, dispositionAncree, contenuEtiquette,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reseau = api;
})(typeof window !== 'undefined' ? window : globalThis);

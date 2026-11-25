#!/usr/bin/env node
'use strict';
// Serveur MCP nodial (stdio) — génère les masques de liaisons à partir
// d'une note de calcul Caneco, avec les moteurs de l'application.
// Les géométries rendues (mm, Y vers le haut) sont faites pour être dessinées
// par un autre MCP de CAO (ex. MultiCAD) ; l'export DXF sert de repli.
const fs = require('fs');
const path = require('path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { loadCatalogues } = require('./catalogue.js');
const { readNote, findLiaisons } = require('./note.js');
const { buildMasque, DEFAULTS } = require('./masque.js');
const { masquesToDxf } = require('./dxf.js');
const { masquesToPdf, pagesReseau } = require('./pdf.js');
const normes = require('./normes.js');
const { preparerEtude, RENDUS } = require('./etude.js');
const ChambreFaces = require('../../src/renderer/chambre-faces.js');
const CompatChambres = require('../../src/renderer/compat-chambres.js');
const { infosChambre, chambreMaconnee } = require('./chambres-infos.js');
const Reseau = require('../../src/renderer/reseau.js');
const { dessinMasque, dessinChambre, versMultiCAD, versDxf } = require('./cad.js');
const Vue3D = require('../../src/renderer/vue3d.js');

const cat = loadCatalogues();
const notes = new Map(); // chemin absolu → { mtime, liaisons }

function getNote(chemin) {
  const abs = path.resolve(chemin);
  if (!fs.existsSync(abs)) throw new Error(`Note de calcul introuvable : ${abs}`);
  const mtime = fs.statSync(abs).mtimeMs;
  const cached = notes.get(abs);
  if (cached && cached.mtime === mtime) return cached.liaisons;
  const liaisons = readNote(abs, cat.cables);
  notes.set(abs, { mtime, liaisons });
  return liaisons;
}

const resume = (l) => ({
  ref: l.ref, origine: l.origine, destination: l.nom, cable: [l.famille, l.codeBrut].filter(Boolean).join(' '),
  longueurM: l.longueurM, utilisable: l.selectable, ...(l.avertissement ? { avertissement: l.avertissement } : {}),
});
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });


// Un masque à partir des critères de liaisons (note de calcul facultative si
// le masque ne contient que des réserves).
function construireMasque(all, m, options) {
  const seen = new Set(), liaisons = [], vides = [];
  for (const crit of m.liaisons || []) {
    if (!all) throw new Error(`« ${m.nom} » : une note de calcul est nécessaire pour trouver des liaisons`);
    const found = findLiaisons(all, crit);
    if (!found.length) vides.push(crit);
    found.forEach((l) => { if (!seen.has(l.ref)) { seen.add(l.ref); liaisons.push(l); } });
  }
  const res = buildMasque({ nom: m.nom, liaisons, reserves: m.reserves || [], options: { ...(options || {}), ...(m.options || {}) } }, cat);
  if (vides.length) (res.avertissements = res.avertissements || []).unshift(`Aucune liaison trouvée pour : ${vides.map((c) => JSON.stringify(c)).join(', ')}`);
  res.liaisonsRetenues = liaisons.map(resume);
  return res;
}

// Étude d'une chambre : faces = { pignonA: masque, … } ; catalogue, sinon maçonnée.
function etudierUneChambre(c, faces, tousMasques) {
  const besoins = () => Object.fromEntries(Object.entries(faces).map(([k, m]) => [k, { largeur: m.largeur, hauteur: m.hauteur }]));
  const maconnee = () => ChambreFaces.etudierChambre(faces, cat.chambres, CompatChambres, { modele: chambreMaconnee(besoins(), c.maconnee || {}) });
  const n = Object.keys(faces).length;
  let e = !n ? { ok: false, erreurs: ['Aucune face renseignée'] }
    : c.maconnee ? maconnee()
      : ChambreFaces.etudierChambre(faces, cat.chambres, CompatChambres, { ref: c.ref, infos: infosChambre });
  if (!e.ok && !c.ref && n) {
    e = maconnee();
    e.avertissements.unshift('Aucune chambre préfabriquée ne reçoit toutes ces faces : chambre maçonnée proposée (valeurs par défaut à valider)');
  }
  e.nom = c.nom;
  // mêmes couleurs de liaison dans toutes les chambres de la demande
  e.ordreLiaisons = [...new Set(tousMasques.filter((m) => m.ok).flatMap((m) => [...(m.liaisons || []), ...(m.fourreaux || []).flatMap((f) => f.liaisons || [])]))];
  e._masques = faces;
  return e;
}

function ecrireNeuf(chemin, ext, contenu, encodage) {
  const abs = path.resolve(chemin);
  if (!new RegExp(`\\.${ext}$`, 'i').test(abs)) throw new Error(`Le fichier doit se terminer par .${ext}`);
  if (fs.existsSync(abs)) throw new Error(`${abs} existe déjà : choisis un nouveau nom (aucun fichier n'est écrasé)`);
  fs.writeFileSync(abs, contenu, encodage);
  return abs;
}

// Dessins CAO (coupes + vues de dessus des chambres) pour multiCAD et/ou DXF.
function dessinsCao(masques, etudes) {
  return [...masques.filter((m) => m.ok).map(dessinMasque), ...etudes.filter((e) => e.ok).map((e) => dessinChambre(e, e._masques || {}))];
}

const placementSchema = z.record(z.string(), z.object({
  x: z.number(), y: z.number(), rotation: z.number().optional().describe('Degrés, sens trigonométrique'), echelle: z.number().optional(),
})).optional().describe('Placement de chaque dessin sur le plan, par nom de dessin (« Coupe <masque> », « Chambre <nom> ») : point de base en unités du plan (mm), rotation en degrés. Sans placement, le dessin est à l\'origine.');

const INSTRUCTIONS = `nodial produit les masques de liaisons électriques (coupes de tranchée ou de conduit) à partir des notes de calcul Caneco.
Avant toute génération, réunis dans le chat : la ou les notes de calcul (NDC), les tronçons voulus, le rendu souhaité (AutoCAD, ZWCAD, MultiCAD sur le plan DWG, Revit, PDF avec vue 3D), le plan si les masques doivent y être posés, et la zone (chaussée, trottoir…).
Appelle preparer_etude avec ce que tu sais ; s'il manque quelque chose, pose TOUTES ses questions à l'utilisateur en un seul message, puis rappelle-le avec les réponses. Ne devine jamais un fichier ou une liaison.
Si plusieurs masques arrivent dans une même chambre de tirage, demande quelle face reçoit quel masque (pignon A à gauche, pignon B à droite, long-pan A en bas, long-pan B en haut, vu de dessus) et passe-les dans le paramètre chambres de generer_masques : la chambre est choisie pour recevoir toutes les faces et les traversées sont déduites. Demande aussi si la chambre est préfabriquée ou MAÇONNÉE ; si maçonnée, demande l'épaisseur des parois, le tampon (ouverture et classe) et la zone (paramètre maconnee), sinon les valeurs par défaut sont prises et doivent être signalées comme à valider.
Pour un RÉSEAU (plusieurs chambres, coffrets, sorties reliés par des tronçons), utilise etudier_reseau : un appel donne les coupes de chaque tronçon, l'étude de chaque chambre, le contrôle des coffrets, la continuité des liaisons et le métré.
Dessin sur un plan DWG avec le MCP multiCAD (AutoCAD, ZWCAD, GstarCAD, BricsCAD) : passe cad=true. Demande à l'utilisateur le point d'insertion (x, y en mm) et l'orientation de chaque chambre et de chaque coupe (ou lis-les sur le plan si multiCAD te le permet), et passe-les dans placements. Puis, côté multiCAD : manage_layers avec le texte « calques » de la réponse, puis draw_entities avec les « commandes » de chaque bloc (une commande par ligne ; découpe en paquets si c'est long). Si un calque est ignoré, regroupe ensuite par manage_entities set_layer. Sans multiCAD, propose le DXF (sortieDxf) à insérer à la main.
Quand preparer_etude répond pret=true : montre les liaisons retenues par tronçon, fais-les valider, puis appelle generer_masques (ou etudier_reseau). Relaie toujours les avertissements et les contrôles de conformité, en rappelant que les règles normatives sont à valider.`;

const server = new McpServer({ name: 'nodial', version: '0.4.0' }, { instructions: INSTRUCTIONS });

server.registerTool('preparer_etude', {
  title: 'Préparer une étude de masques',
  description: 'À appeler EN PREMIER. Vérifie ce que l\'utilisateur a fourni (notes de calcul, plans, tronçons, rendus, zone) et renvoie la liste des questions à lui poser pour ce qui manque, ainsi que les liaisons trouvées pour chaque tronçon. Rappeler après chaque réponse jusqu\'à pret=true.',
  inputSchema: {
    notesCalcul: z.array(z.string()).optional().describe('Chemins des notes de calcul (NDC) Caneco .xls/.xlsx'),
    plans: z.array(z.string()).optional().describe('Chemins des plans DWG/DXF/PDF/RVT'),
    surPlan: z.boolean().optional().describe('Les masques doivent-ils être posés sur un plan ?'),
    troncons: z.array(z.object({
      nom: z.string().optional(), origine: z.string().optional(), destination: z.string().optional(),
      refs: z.array(z.string()).optional(), texte: z.string().optional(),
    })).optional().describe('Tronçons voulus, ex. [{nom:"TGBT → COFFRET 1", origine:"TGBT", destination:"COFFRET 1"}]'),
    rendus: z.array(z.string()).optional().describe(`Rendus souhaités : ${Object.keys(RENDUS).join(', ')}`),
    zone: z.string().optional().describe('chaussee | trottoir | espace_vert | prive'),
  },
}, async (args) => {
  try { return ok(preparerEtude(args, cat)); } catch (e) { return fail(String(e.message || e)); }
});

server.registerPrompt('etude_masques', {
  title: 'Nouvelle étude de masques',
  description: 'Lance une étude : Claude demande les notes de calcul, les plans, les tronçons et le rendu souhaité, puis génère les masques.',
  argsSchema: { demande: z.string().optional().describe('Ce que tu veux, en une phrase (facultatif)') },
}, ({ demande }) => ({
  messages: [{ role: 'user', content: { type: 'text', text:
`Je veux préparer des masques de liaisons avec nodial.${demande ? `\nMa demande : ${demande}` : ''}

Mène l'étude ainsi :
1. Appelle preparer_etude avec ce que tu sais déjà de ma demande.
2. S'il manque des éléments, pose-moi toutes ses questions en un seul message, de façon simple : notes de calcul (NDC), plans, tronçons, rendu souhaité (AutoCAD, ZWCAD, MultiCAD sur le plan DWG, Revit, PDF avec vue 3D), zone de la tranchée. Dis-moi aussi quels rendus ne sont pas encore disponibles.
3. Quand tout est prêt, montre-moi les liaisons retenues pour chaque tronçon et attends ma validation.
4. Génère les masques avec generer_masques, puis résume : dimensions, fourreaux, profondeur, contrôles de conformité (à valider) et avertissements.` } }],
}));

const critereSchema = z.object({
  refs: z.array(z.string()).optional().describe('Références exactes renvoyées par lire_note_calcul (ex. ["L12","L13"])'),
  origine: z.string().optional().describe('Origine de la liaison, colonne A de la note (ex. "TGBT")'),
  destination: z.string().optional().describe('Destination / nom du circuit, colonne B (ex. "COFFRET 1")'),
  texte: z.string().optional().describe('Texte libre cherché dans origine + destination'),
});

const optionsSchema = z.object({
  forme: z.enum(['rect', 'circ']).optional().describe('rect = tranchée / multitubulaire, circ = conduit circulaire'),
  ecart: z.number().optional().describe(`Écart bord à bord entre fourreaux en mm (défaut ${DEFAULTS.ecart}, ignoré en conduit)`),
  litDePose: z.number().optional().describe(`Lit de pose autour de la nappe en mm (défaut ${DEFAULTS.litDePose})`),
  largeurImposee: z.number().optional().describe('Largeur de tranchée imposée en mm'),
  hauteurImposee: z.number().optional().describe('Hauteur de nappe imposée en mm'),
  tauxMax: z.number().optional().describe(`Remplissage max d'un fourreau, 0-1 (défaut ${DEFAULTS.tauxMax})`),
  typesAutorises: z.array(z.string()).optional().describe('Types de fourreaux autorisés (défaut ["TPC"])'),
  tailleMaxFourreauOd: z.number().optional().describe('Ø extérieur max des fourreaux en mm'),
  harmonie: z.boolean().optional().describe('Même taille de fourreau pour toute la liaison'),
  zone: z.enum(['chaussee', 'trottoir', 'espace_vert', 'prive']).optional().describe(`Zone de la tranchée, fixe le recouvrement mini (défaut ${DEFAULTS.zone})`),
  reseau: z.string().optional().describe('electricite | telecom | eclairage… : couleur du grillage avertisseur'),
  recouvrementMm: z.number().optional().describe('Recouvrement minimal imposé (surcharge la zone)'),
  grillageAuDessusMm: z.number().optional().describe('Hauteur du grillage au-dessus des fourreaux (défaut 200)'),
  profondeurFouilleMm: z.number().optional().describe('Profondeur de fouille imposée (fond → terrain fini)'),
  chambre: z.string().optional().describe('Chambre de tirage imposée (ex. "L2T") ; sinon choisie automatiquement'),
}).optional();

server.registerTool('lire_note_calcul', {
  title: 'Lire une note de calcul',
  description: 'Lit une note de calcul Caneco (.xls/.xlsx, carnet de câbles) et liste ses liaisons : référence, origine, destination, câble, longueur. À appeler en premier pour connaître les références.',
  inputSchema: { chemin: z.string().describe('Chemin du fichier .xls/.xlsx'), ...critereSchema.shape },
}, async ({ chemin, ...critere }) => {
  try {
    const all = getNote(chemin);
    const list = Object.values(critere).some((v) => v != null) ? findLiaisons(all, critere) : all;
    return ok({ fichier: path.resolve(chemin), total: all.length, affichees: list.length, liaisons: list.map(resume) });
  } catch (e) { return fail(String(e.message || e)); }
});

server.registerTool('generer_masques', {
  title: 'Générer des masques de liaisons',
  description: 'Génère un masque (coupe de tranchée ou de conduit) par tronçon : fourreaux choisis et placés, câbles répartis avec leurs phases, profondeur et grillage avertisseur selon les normes. Renvoie la géométrie en mm (Y vers le haut, origine = coin bas-gauche du masque) pour la dessiner en CAO, et écrit un DXF (sortieDxf) et/ou une planche PDF avec vue 3D (sortiePdf).',
  inputSchema: {
    noteCalcul: z.string().optional().describe('Chemin de la note de calcul Caneco (facultatif si les masques ne contiennent que des réserves)'),
    masques: z.array(z.object({
      nom: z.string().describe('Nom du masque, ex. "TGBT → COFFRET 1"'),
      liaisons: z.array(critereSchema).describe('Une ou plusieurs recherches ; leurs résultats sont réunis dans ce masque'),
      reserves: z.array(z.object({ type: z.string(), code: z.string(), qty: z.number().int().min(1), nom: z.string().optional() })).optional()
        .describe('Fourreaux de réserve vides à ajouter, ex. [{type:"TPC", code:"160", qty:2}]'),
      options: optionsSchema,
    })).min(1),
    options: optionsSchema.describe('Options communes à tous les masques (surchargées par celles de chaque masque)'),
    chambres: z.array(z.object({
      nom: z.string().describe('Nom de la chambre, ex. "Chambre C1 (coffret 1)"'),
      ref: z.string().optional().describe('Modèle imposé (ex. "L3T") ; sinon le plus petit qui reçoit toutes les faces'),
      faces: z.object({
        pignonA: z.string().optional(), pignonB: z.string().optional(),
        longPanA: z.string().optional(), longPanB: z.string().optional(),
      }).describe('Nom du masque arrivant sur chaque face. Vue de dessus : pignon A à gauche, pignon B à droite, long-pan A en bas, long-pan B en haut. Une liaison présente dans deux masques traverse la chambre.'),
      maconnee: z.object({
        paroi: z.number().optional().describe('Épaisseur des parois en mm (défaut 200)'),
        tampon: z.object({ L: z.number(), l: z.number(), classe: z.enum(['A15', 'B125', 'C250', 'D400', 'E600', 'F900']) }).partial().optional()
          .describe('Ouverture du tampon en mm et classe NF EN 124 (défaut 600 × 600 D400)'),
        zone: z.enum(['espaceVert', 'trottoir', 'bordure', 'chaussee', 'lourd']).optional().describe('Zone : contrôle la classe minimale du tampon (défaut chaussée)'),
      }).optional().describe('Chambre MAÇONNÉE sur mesure (au lieu d\'un modèle préfabriqué) : dimensions déduites des nappes, valeurs par défaut à valider. Utilisée aussi d\'office si aucune préfabriquée ne convient.'),
    })).optional().describe('Chambres de tirage à étudier (plusieurs faces, traversées) — ajoute une vue de dessus au PDF'),
    sortieDxf: z.string().optional().describe('Chemin du fichier .dxf à écrire (jamais un plan existant : un nouveau fichier)'),
    sortiePdf: z.string().optional().describe('Chemin du fichier .pdf à écrire : une page par masque, coupe + vue 3D + conformité'),
    longueur3dMm: z.number().optional().describe('Longueur du tronçon montré dans la vue 3D du PDF (défaut 1500 mm)'),
    unite: z.enum(['mm', 'm']).optional().describe('Unité du DXF (défaut mm)'),
    origine: z.object({ x: z.number(), y: z.number() }).optional().describe('Point d\'insertion du premier masque dans le DXF, dans son unité'),
    cad: z.boolean().optional().describe('Renvoie aussi les commandes de dessin pour le MCP multiCAD (calques + draw_entities), coupes et vues de dessus des chambres'),
    placements: placementSchema,
  },
}, async ({ noteCalcul, masques, chambres, options, sortieDxf, sortiePdf, longueur3dMm, unite, origine, cad, placements }) => {
  try {
    const all = noteCalcul ? getNote(noteCalcul) : null;
    const out = masques.map((m) => construireMasque(all, m, options));
    // Chambres multi-faces : chaque face reçoit un masque déjà généré (par son nom)
    const etudes = (chambres || []).map((c) => {
      const faces = {}, manquants = [];
      for (const [k, nomMasque] of Object.entries(c.faces || {})) {
        if (!nomMasque) continue;
        const mq = out.find((m) => m.ok && m.nom === nomMasque);
        if (mq) faces[k] = mq; else manquants.push(nomMasque);
      }
      const e = etudierUneChambre(c, faces, out);
      if (manquants.length) (e.avertissements = e.avertissements || []).unshift(`Masque(s) introuvable(s) : ${manquants.join(', ')} (utiliser le nom exact d'un masque de cette demande)`);
      return e;
    });
    const dxf = sortieDxf ? ecrireNeuf(sortieDxf, 'dxf', masquesToDxf(out, { unite, origine }), 'latin1') : null;
    const pdf = sortiePdf ? ecrireNeuf(sortiePdf, 'pdf', masquesToPdf(out, { longueur3dMm, etudesChambres: etudes })) : null;
    const caoMulti = cad ? versMultiCAD(dessinsCao(out, etudes), placements || {}) : undefined;
    return ok({ dxf, pdf, masques: out, chambres: etudes.map(({ _masques, ...e }) => e), ...(caoMulti ? { multicad: caoMulti } : {}) });
  } catch (e) { return fail(String(e.message || e)); }
});


// ─── Réseau complet : chambres, coffrets, sorties, tronçons ───────────────
const FACE_ENUM = z.enum(['pignonA', 'pignonB', 'longPanA', 'longPanB']);

// Positions du synoptique : profondeur depuis le premier élément (en largeur
// d'abord) → colonne ; rang dans la colonne → ligne. Sert au choix des faces
// quand elles ne sont pas imposées, et au dessin du synoptique.
function positions(elements, troncons) {
  const voisins = new Map(elements.map((e) => [e.nom, []]));
  troncons.forEach((t) => { voisins.get(t.de).push(t.vers); voisins.get(t.vers).push(t.de); });
  const prof = new Map(), file = [];
  for (const e of elements) {
    if (prof.has(e.nom)) continue;
    prof.set(e.nom, 0); file.push(e.nom);
    while (file.length) { const n = file.shift(); voisins.get(n).forEach((v) => { if (!prof.has(v)) { prof.set(v, prof.get(n) + 1); file.push(v); } }); }
  }
  const rang = new Map(), pos = {};
  for (const e of elements) {
    const p = prof.get(e.nom), k = rang.get(p) || 0; rang.set(p, k + 1);
    pos[e.nom] = { x: 150 + p * 280, y: 150 + k * 190 };
  }
  return pos;
}

server.registerTool('etudier_reseau', {
  title: 'Étudier un réseau de chambres',
  description: 'Étudie un réseau complet en un appel : éléments (chambres, coffrets/tableaux, sorties) reliés par des tronçons portant des liaisons de la note de calcul et des réserves. Renvoie la coupe de chaque tronçon, l\'étude de chaque chambre (modèle préfabriqué ou maçonnée, faces, traversées, arrêts), le contrôle des coffrets, la continuité des liaisons et le métré des fourreaux. PDF : synoptique 2D + isométrique + métré, puis coupes et chambres. cad=true : commandes de dessin pour le MCP multiCAD.',
  inputSchema: {
    noteCalcul: z.string().optional().describe('Chemin de la note de calcul Caneco (facultatif si les tronçons ne portent que des réserves)'),
    elements: z.array(z.object({
      nom: z.string().describe('Nom unique, ex. "TGBT", "C1", "CF1 Atelier"'),
      type: z.enum(['chambre', 'coffret', 'sortie']),
      ref: z.string().optional().describe('Chambre : modèle imposé (ex. "L2T") ; sinon le plus petit qui reçoit toutes les faces'),
      maconnee: z.object({
        paroi: z.number().optional(),
        tampon: z.object({ L: z.number(), l: z.number(), classe: z.enum(['A15', 'B125', 'C250', 'D400', 'E600', 'F900']) }).partial().optional(),
        zone: z.enum(['espaceVert', 'trottoir', 'bordure', 'chaussee', 'lourd']).optional(),
      }).optional().describe('Chambre maçonnée sur mesure (paroi mm, tampon, zone) — valeurs par défaut à valider'),
      coffret: z.object({ largeur: z.number().optional(), profondeur: z.number().optional(), genre: z.enum(['coffret', 'tableau', 'autre']).optional() }).optional()
        .describe('Coffret / tableau : face du bas en mm, pour vérifier que la nappe y passe'),
    })).min(2),
    troncons: z.array(z.object({
      de: z.string().describe('Nom de l\'élément de départ'),
      vers: z.string().describe('Nom de l\'élément d\'arrivée'),
      longueurM: z.number().optional().describe('Longueur du tronçon en mètres (métré)'),
      faceDe: FACE_ENUM.optional().describe('Indicatif : les côtés suivent le synoptique (nord = côté 1 = long-pan B en haut, 2 = pignon B à droite, 3 = long-pan A en bas, 4 = pignon A à gauche ; vers la droite on sort par 2 et on arrive par 4, vers le bas on sort par 3 et on arrive par 1), comme dans l\'application'),
      faceVers: FACE_ENUM.optional().describe('Indicatif, voir faceDe'),
      liaisons: z.array(critereSchema).optional().describe('Liaisons de la note qui passent dans ce tronçon'),
      reserves: z.array(z.object({ type: z.string(), code: z.string(), qty: z.number().int().min(1), nom: z.string().optional() })).optional(),
      options: optionsSchema,
    })).min(1),
    options: optionsSchema.describe('Options communes à toutes les coupes'),
    titre: z.string().optional().describe('Titre du dossier (PDF)'),
    cartouche: z.object({
      champs: z.array(z.object({ libelle: z.string(), valeur: z.string(), large: z.boolean().optional() })).optional()
        .describe('Champs du cartouche des pages chambre, dans l\'ordre (large = pleine largeur). Valeurs automatiques : {projet} {chambre} {modele} {interieur} {tampons} {date} {indice} {format} {folio}. Par défaut : Projet, Objet, Chambre, Intérieur, Tampons, Phase, N° plan, Indice, Date, Dessiné, Vérifié, Échelle, Format, Folio'),
      logoMOA: z.string().optional().describe('Chemin d\'une image PNG ou JPEG (carrée de préférence) : logo du maître d\'ouvrage, en haut à gauche du cartouche'),
      logoMOE: z.string().optional().describe('Chemin d\'une image PNG ou JPEG : logo du maître d\'œuvre, en haut à droite'),
      indice: z.string().optional().describe('Indice du plan (défaut A)'),
    }).optional().describe('Cartouche des pages chambre (PDF), comme dans l\'application'),
    sortiePdf: z.string().optional().describe('Nouveau fichier .pdf : synoptique, isométrique, métré, puis coupes et chambres'),
    sortieDxf: z.string().optional().describe('Nouveau fichier .dxf : coupes et vues de dessus des chambres (côte à côte, ou aux placements donnés)'),
    cad: z.boolean().optional().describe('Renvoie les commandes de dessin pour le MCP multiCAD'),
    placements: placementSchema,
  },
}, async ({ noteCalcul, elements, troncons, options, titre, cartouche, sortiePdf, sortieDxf, cad, placements }) => {
  try {
    const noms = new Set();
    for (const e of elements) { if (noms.has(e.nom)) throw new Error(`Élément en double : ${e.nom}`); noms.add(e.nom); }
    for (const t of troncons) for (const n of [t.de, t.vers]) if (!noms.has(n)) throw new Error(`Tronçon ${t.de} → ${t.vers} : élément « ${n} » inconnu (éléments : ${[...noms].join(', ')})`);
    const all = noteCalcul ? getNote(noteCalcul) : null;

    // 1. réseau (mêmes règles que l'application : faces, continuité, métré)
    const r = Reseau.creerReseau(), pos = positions(elements, troncons), id = {};
    for (const e of elements) id[e.nom] = Reseau.ajouterNoeud(r, e.type, { nom: e.nom, ...pos[e.nom], ref: e.ref, coffret: e.coffret }).id;
    const tr = troncons.map((t) => ({ t, rt: Reseau.relier(r, id[t.de], id[t.vers], { longueurM: t.longueurM, faceA: t.faceDe, faceB: t.faceVers }) }));

    // 2. coupe de chaque tronçon
    const masques = tr.map(({ t }) => construireMasque(all, { nom: `${t.de} → ${t.vers}`, liaisons: t.liaisons || [], reserves: t.reserves || [], options: t.options }, options));
    const mDe = new Map(tr.map(({ rt }, i) => [rt.id, masques[i]]));

    // 2 bis. synoptique en ligne (même disposition que l'application) ; les côtés
    // des chambres suivent le synoptique : nord = côté 1, vers la droite 2 → 4, vers le bas 3 → 1
    const tailleNoeud = (n) => ({ w: Math.max(n.type === 'chambre' ? 120 : 140, n.nom.length * 9.5 + (n.type === 'sortie' ? 34 : 24)), h: n.type === 'chambre' ? 62 : 48 });
    const coupeDe = (m) => (m && m.ok ? { fourreaux: m.fourreaux.map((f) => ({ id: f.id, od: f.od })), cables: (m.cables || []).map((c) => ({ liaison: c.liaison, code: c.code, parent: c.fourreau })) } : null);
    const contenus = new Map(tr.map(({ rt }, i) => [rt.id, { ...Reseau.contenuEtiquette(coupeDe(masques[i])), L: rt.longueurM }]));
    const dis = Reseau.dispositionAncree(r, { tailleNoeud, tailleEtiquette: (t) => Vue3D.mesureEtiquetteSyn(contenus.get(t.id)), ecart: 0.5, ratio: null });
    Reseau.alignerFaces(r, dis);
    const synData = {
      largeur: dis.largeur, hauteur: dis.hauteur,
      noeuds: r.noeuds.map((n) => ({ nom: n.nom, type: n.type, couleur: n.couleur, ...dis.noeuds[n.id], ...tailleNoeud(n) })),
      troncons: r.troncons.map((t) => ({ a: dis.noeuds[t.a.noeud], b: dis.noeuds[t.b.noeud], e: dis.etiquettes[t.id] && { ...dis.etiquettes[t.id], ...contenus.get(t.id) } })),
    };
    const bandes = Vue3D.decouperBandes(synData, 'a0');
    const situation = { noeuds: synData.noeuds, troncons: synData.troncons, coupes: bandes.coupes, ys: bandes.ys };

    // 3. chambres : un masque par face, vu dans le sens du tronçon
    const etudes = elements.filter((e) => e.type === 'chambre').map((e) => {
      const faces = {};
      Reseau.tronconsDe(r, id[e.nom]).forEach((v) => {
        const m = mDe.get(v.troncon.id);
        if (m && m.ok && m.forme !== 'circ') faces[v.face] = { ...m, longueurM: v.troncon.longueurM || null, sens: v.troncon.a.noeud === id[e.nom] && v.troncon.a.face === v.face ? 'depart' : 'arrivee' };
      });
      return etudierUneChambre(e, faces, masques);
    });

    // 4. coffrets : la nappe passe-t-elle dans la face du bas ?
    const coffrets = elements.filter((e) => e.type === 'coffret').map((e) => ({
      nom: e.nom,
      troncons: Reseau.tronconsDe(r, id[e.nom]).map((v) => {
        const m = mDe.get(v.troncon.id), c = m && m.ok ? Reseau.verifierCoffret(e.coffret || {}, m.largeur, m.hauteur) : { connu: false };
        return { troncon: m ? m.nom : '?', nappe: m && m.ok ? `${m.largeur} x ${m.hauteur} mm` : null,
          verdict: !c.connu ? 'cotes du coffret à fournir' : c.tient ? 'passe' : 'NE PASSE PAS' };
      }),
    }));

    // 5. continuité et métré
    const continuite = Reseau.continuite(r, (t) => { const m = mDe.get(t.id); return m && m.ok ? m.liaisons : []; });
    const metre = Reseau.metre(r, (t) => { const m = mDe.get(t.id); return m && m.ok ? m.fourreaux.map((f) => ({ type: f.type, code: f.code })) : []; });

    // 6. sorties
    const lignes = (m) => {
      if (!m || !m.ok || !m.fourreaux.length) return ['coupe vide'];
      const n = new Map(); m.fourreaux.forEach((f) => { const d = Math.round(f.od); n.set(d, (n.get(d) || 0) + 1); });
      return [...n].sort((a, b) => b[0] - a[0]).map(([d, q]) => `${q} Ø${d}`);
    };
    const synoptique = {
      noeuds: r.noeuds.map((n) => {
        const et = etudes.find((x) => x.nom === n.nom);
        return { nom: n.nom, type: n.type, couleur: n.couleur, x: n.x, y: n.y,
          sous: n.type === 'chambre' ? (et && et.ok ? et.ref : 'à étudier') : n.type === 'coffret' ? n.coffret.genre : '' };
      }),
      troncons: tr.map(({ rt }, i) => {
        const A = Reseau.noeud(r, rt.a.noeud), B = Reseau.noeud(r, rt.b.noeud);
        return { a: { x: A.x, y: A.y, face: rt.a.face, type: A.type }, b: { x: B.x, y: B.y, face: rt.b.face, type: B.type },
          label: [...lignes(masques[i]), rt.longueurM ? `${rt.longueurM} m` : '? m'] };
      }),
    };
    const titreDossier = titre || 'Réseau nodial';
    // pages chambre A3 : même dessin que l'application (situation, masques, contenu, cartouche, folios)
    const lireLogo = (chemin) => { if (!chemin) return null; const abs = path.resolve(chemin); if (!fs.existsSync(abs)) throw new Error(`Logo introuvable : ${abs}`); return { src: fs.readFileSync(abs) }; };
    const cart = { champs: cartouche && cartouche.champs, logoMOA: lireLogo(cartouche && cartouche.logoMOA), logoMOE: lireLogo(cartouche && cartouche.logoMOE) };
    const [A3W, A3H] = Vue3D.FORMATS_PAGE.a3;
    const optsPage = { projet: titreDossier, date: new Date().toLocaleDateString('fr-FR'), indice: (cartouche && cartouche.indice) || 'A', situation, cartouche: cart };
    const pagesChambres = etudes.filter((e) => e.ok).flatMap((e) => Vue3D.pagesChambreA3(e, e._masques, optsPage, () => new Vue3D.Page({ ombre: false })))
      .map((pg) => ({ contenu: pg.toString(), largeur: A3W, hauteur: A3H, images: (pg.images || []).map((im) => ({ octets: im.src, x: im.x, y: im.y, w: im.w, h: im.h })) }));
    const pdf = sortiePdf ? ecrireNeuf(sortiePdf, 'pdf', masquesToPdf(masques, { pagesChambres, pagesAvant: pagesReseau({ titre: titreDossier, data: synoptique, metre, continuite }) })) : null;
    const dessins = (cad || sortieDxf) ? dessinsCao(masques, etudes) : [];
    const dxf = sortieDxf ? ecrireNeuf(sortieDxf, 'dxf', versDxf(dessins, placements || {}), 'latin1') : null;

    return ok({
      pdf, dxf,
      troncons: tr.map(({ t, rt }, i) => {
        const m = masques[i];
        return { nom: m.nom, longueurM: rt.longueurM, faces: { [t.de]: rt.a.face, [t.vers]: rt.b.face },
          ...(m.ok ? { largeur: m.largeur, hauteur: m.hauteur, profondeur: m.tranchee ? m.tranchee.profondeur : null, fourreaux: lignes(m), liaisons: m.liaisonsRetenues, avertissements: m.avertissements } : { erreurs: m.erreurs }) };
      }),
      chambres: etudes.map(({ _masques, ordreLiaisons, ...e }) => e),
      coffrets,
      continuite: { liaisons: continuite.liaisons.map((l) => ({ nom: l.nom, chemin: l.chemin.join(' → '), longueurM: l.longueurM, ...(l.longueurIncomplete ? { longueurIncomplete: true } : {}), problemes: l.problemes })), problemes: continuite.problemes },
      metre,
      ...(cad ? { multicad: versMultiCAD(dessins, placements || {}) } : {}),
    });
  } catch (e) { return fail(String(e.message || e)); }
});

server.registerTool('regles_normes', {
  title: 'Règles normatives appliquées',
  description: 'Affiche les règles de tranchée appliquées aux masques (recouvrement par zone selon NF P 98-331, grillage avertisseur selon NF EN 12613 / ex NF T 54-080) avec leurs sources et leur statut de validation.',
  inputSchema: {},
}, async () => ok({
  recouvrementMinimalMm: normes.RECOUVREMENT_MIN_MM,
  grillageAvertisseur: normes.GRILLAGE,
  sources: normes.SOURCES,
  statut: 'Valeurs par défaut issues de sources secondaires, à valider sur les textes AFNOR en vigueur.',
}));

(async () => {
  await server.connect(new StdioServerTransport());
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
'use strict';
// Serveur MCP TONTONKAD (stdio) — génère les masques de liaisons à partir
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
const { masquesToPdf } = require('./pdf.js');
const normes = require('./normes.js');
const { preparerEtude, RENDUS } = require('./etude.js');
const ChambreFaces = require('../../src/renderer/chambre-faces.js');
const CompatChambres = require('../../src/renderer/compat-chambres.js');
const { infosChambre, chambreMaconnee } = require('./chambres-infos.js');

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

const INSTRUCTIONS = `TONTONKAD produit les masques de liaisons électriques (coupes de tranchée ou de conduit) à partir des notes de calcul Caneco.
Avant toute génération, réunis dans le chat : la ou les notes de calcul (NDC), les tronçons voulus, le rendu souhaité (AutoCAD, ZWCAD, MultiCAD sur le plan DWG, Revit, PDF avec vue 3D), le plan si les masques doivent y être posés, et la zone (chaussée, trottoir…).
Appelle preparer_etude avec ce que tu sais ; s'il manque quelque chose, pose TOUTES ses questions à l'utilisateur en un seul message, puis rappelle-le avec les réponses. Ne devine jamais un fichier ou une liaison.
Si plusieurs masques arrivent dans une même chambre de tirage, demande quelle face reçoit quel masque (pignon A à gauche, pignon B à droite, long-pan A en bas, long-pan B en haut, vu de dessus) et passe-les dans le paramètre chambres de generer_masques : la chambre est choisie pour recevoir toutes les faces et les traversées sont déduites. Demande aussi si la chambre est préfabriquée ou MAÇONNÉE ; si maçonnée, demande l'épaisseur des parois, le tampon (ouverture et classe) et la zone (paramètre maconnee), sinon les valeurs par défaut sont prises et doivent être signalées comme à valider.
Quand preparer_etude répond pret=true : montre les liaisons retenues par tronçon, fais-les valider, puis appelle generer_masques. Relaie toujours les avertissements et les contrôles de conformité, en rappelant que les règles normatives sont à valider.`;

const server = new McpServer({ name: 'tontonkad', version: '0.2.0' }, { instructions: INSTRUCTIONS });

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
`Je veux préparer des masques de liaisons avec TONTONKAD.${demande ? `\nMa demande : ${demande}` : ''}

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
    noteCalcul: z.string().describe('Chemin de la note de calcul Caneco'),
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
  },
}, async ({ noteCalcul, masques, chambres, options, sortieDxf, sortiePdf, longueur3dMm, unite, origine }) => {
  try {
    const all = getNote(noteCalcul);
    const out = masques.map((m) => {
      const seen = new Set(), liaisons = [], vides = [];
      for (const crit of m.liaisons) {
        const found = findLiaisons(all, crit);
        if (!found.length) vides.push(crit);
        found.forEach((l) => { if (!seen.has(l.ref)) { seen.add(l.ref); liaisons.push(l); } });
      }
      const res = buildMasque({ nom: m.nom, liaisons, reserves: m.reserves || [], options: { ...(options || {}), ...(m.options || {}) } }, cat);
      if (vides.length) (res.avertissements = res.avertissements || []).unshift(`Aucune liaison trouvée pour : ${vides.map((c) => JSON.stringify(c)).join(', ')}`);
      res.liaisonsRetenues = liaisons.map(resume);
      return res;
    });
    // Chambres multi-faces : chaque face reçoit un masque déjà généré (par son nom)
    const etudes = (chambres || []).map((c) => {
      const faces = {}, manquants = [];
      for (const [k, nomMasque] of Object.entries(c.faces || {})) {
        if (!nomMasque) continue;
        const mq = out.find((m) => m.ok && m.nom === nomMasque);
        if (mq) faces[k] = mq; else manquants.push(nomMasque);
      }
      const maconnee = () => ChambreFaces.etudierChambre(faces, cat.chambres, CompatChambres, {
        modele: chambreMaconnee(Object.fromEntries(Object.entries(faces).map(([k, m]) => [k, { largeur: m.largeur, hauteur: m.hauteur }])), c.maconnee || {}) });
      let e = c.maconnee && Object.keys(faces).length ? maconnee()
        : ChambreFaces.etudierChambre(faces, cat.chambres, CompatChambres, { ref: c.ref, infos: infosChambre });
      if (!e.ok && !c.ref && Object.keys(faces).length) {
        e = maconnee();
        e.avertissements.unshift('Aucune chambre préfabriquée ne reçoit toutes ces faces : chambre maçonnée proposée (valeurs par défaut à valider)');
      }
      e.nom = c.nom;
      // mêmes couleurs de liaison dans toutes les chambres de la demande
      e.ordreLiaisons = [...new Set(out.filter((m) => m.ok).flatMap((m) => [...(m.liaisons || []), ...(m.fourreaux || []).flatMap((f) => f.liaisons || [])]))];
      if (manquants.length) (e.avertissements = e.avertissements || []).unshift(`Masque(s) introuvable(s) : ${manquants.join(', ')} (utiliser le nom exact d'un masque de cette demande)`);
      e._masques = faces;
      return e;
    });
    let dxf = null;
    if (sortieDxf) {
      const abs = path.resolve(sortieDxf);
      if (!/\.dxf$/i.test(abs)) throw new Error('sortieDxf doit se terminer par .dxf');
      if (fs.existsSync(abs)) throw new Error(`${abs} existe déjà : choisis un nouveau nom (aucun fichier n'est écrasé)`);
      fs.writeFileSync(abs, masquesToDxf(out, { unite, origine }), 'latin1');
      dxf = abs;
    }
    let pdf = null;
    if (sortiePdf) {
      const abs = path.resolve(sortiePdf);
      if (!/\.pdf$/i.test(abs)) throw new Error('sortiePdf doit se terminer par .pdf');
      if (fs.existsSync(abs)) throw new Error(`${abs} existe déjà : choisis un nouveau nom (aucun fichier n'est écrasé)`);
      fs.writeFileSync(abs, masquesToPdf(out, { longueur3dMm, etudesChambres: etudes }));
      pdf = abs;
    }
    return ok({ dxf, pdf, masques: out, chambres: etudes.map(({ _masques, ...e }) => e) });
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

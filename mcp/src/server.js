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
const normes = require('./normes.js');

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

const server = new McpServer({ name: 'tontonkad', version: '0.1.0' });

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
  description: 'Génère un masque (coupe de tranchée ou de conduit) par tronçon : fourreaux choisis et placés, câbles répartis avec leurs phases, profondeur et grillage avertisseur selon les normes. Renvoie la géométrie en mm (Y vers le haut, origine = coin bas-gauche du masque) pour la dessiner en CAO, et écrit un DXF si sortieDxf est fourni.',
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
    sortieDxf: z.string().optional().describe('Chemin du fichier .dxf à écrire (jamais un plan existant : un nouveau fichier)'),
    unite: z.enum(['mm', 'm']).optional().describe('Unité du DXF (défaut mm)'),
    origine: z.object({ x: z.number(), y: z.number() }).optional().describe('Point d\'insertion du premier masque dans le DXF, dans son unité'),
  },
}, async ({ noteCalcul, masques, options, sortieDxf, unite, origine }) => {
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
    let dxf = null;
    if (sortieDxf) {
      const abs = path.resolve(sortieDxf);
      if (!/\.dxf$/i.test(abs)) throw new Error('sortieDxf doit se terminer par .dxf');
      if (fs.existsSync(abs)) throw new Error(`${abs} existe déjà : choisis un nouveau nom (aucun fichier n'est écrasé)`);
      fs.writeFileSync(abs, masquesToDxf(out, { unite, origine }), 'latin1');
      dxf = abs;
    }
    return ok({ dxf, masques: out });
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

'use strict';
// Préparation d'une étude de masques : vérifie ce que l'utilisateur a fourni
// (notes de calcul, plans, tronçons, rendus) et liste les QUESTIONS à lui
// poser pour ce qui manque. Claude s'en sert pour mener l'échange dans le chat
// toujours de la même façon, au lieu d'improviser.
const fs = require('fs');
const path = require('path');
const { readNote, findLiaisons } = require('./note.js');
const { RECOUVREMENT_MIN_MM } = require('./normes.js');

const RENDUS = {
  autocad: { libelle: 'AutoCAD', disponible: true, comment: 'Fichier DXF (generer_masques, sortieDxf) à ouvrir ou insérer dans AutoCAD.' },
  zwcad: { libelle: 'ZWCAD', disponible: true, comment: 'Fichier DXF (generer_masques, sortieDxf) à ouvrir ou insérer dans ZWCAD.' },
  dxf: { libelle: 'DXF seul', disponible: true, comment: 'Fichier DXF R12, lisible par tous les logiciels de CAO.' },
  multicad: { libelle: 'MultiCAD / nanoCAD (sur le plan DWG)', disponible: 'mcp', comment: 'Géométrie de generer_masques dessinée par le MCP MultiCAD, s\'il est branché, au repère posé sur le plan.' },
  revit: { libelle: 'Revit (maquette 3D)', disponible: false, comment: 'Prévu : familles .rfa des chambres + conduits, via un MCP Revit. Pas encore disponible.' },
  pdf3d: { libelle: 'PDF avec vue 3D', disponible: false, comment: 'Prévu : planche PDF des masques avec une vue 3D de la chambre. Pas encore disponible.' },
};
const ALIAS = { 'autocad': 'autocad', 'acad': 'autocad', 'zwcad': 'zwcad', 'dxf': 'dxf', 'multicad': 'multicad', 'nanocad': 'multicad',
  'revit': 'revit', 'pdf': 'pdf3d', 'pdf3d': 'pdf3d', 'pdf 3d': 'pdf3d', '3d': 'pdf3d' };

const EXT_NOTE = ['.xls', '.xlsx'];
const EXT_PLAN = ['.dwg', '.dxf', '.pdf', '.rvt'];

function checkFile(p, exts) {
  const abs = path.resolve(p);
  const ext = path.extname(abs).toLowerCase();
  if (!fs.existsSync(abs)) return { fichier: abs, ok: false, probleme: 'introuvable' };
  if (!exts.includes(ext)) return { fichier: abs, ok: false, probleme: `format ${ext || 'inconnu'} non pris en charge (attendu : ${exts.join(', ')})` };
  return { fichier: abs, ok: true };
}

/**
 * @param {object} e
 * @param {string[]} [e.notesCalcul]   chemins des notes de calcul (NDC) Caneco
 * @param {string[]} [e.plans]         chemins des plans (DWG/DXF/PDF/RVT)
 * @param {boolean}  [e.surPlan]       les masques doivent-ils être posés sur un plan ?
 * @param {Array}    [e.troncons]      [{ nom, origine, destination }]
 * @param {string[]} [e.rendus]        autocad | zwcad | dxf | multicad | revit | pdf3d
 * @param {string}   [e.zone]          chaussee | trottoir | espace_vert | prive
 * @param {object}   cat               catalogues (pour lire les notes)
 */
function preparerEtude(e = {}, cat) {
  const manquant = [];
  const ask = (champ, question, pourquoi, obligatoire = true) => manquant.push({ champ, question, pourquoi, obligatoire });

  // 1. Notes de calcul
  const notes = (e.notesCalcul || []).map((p) => checkFile(p, EXT_NOTE));
  if (!notes.length) {
    ask('notesCalcul', 'Quelle(s) note(s) de calcul (NDC) Caneco dois-je utiliser ? Donne le chemin du fichier .xls/.xlsx.', 'Les câbles de chaque liaison en viennent.');
  }
  notes.filter((n) => !n.ok).forEach((n) => ask('notesCalcul', `La note ${n.fichier} est ${n.probleme} : peux-tu me redonner le bon fichier ?`, 'Impossible de lire les liaisons.'));

  // Liaisons de toutes les notes lisibles
  let liaisons = [];
  for (const n of notes.filter((x) => x.ok)) {
    try { liaisons = liaisons.concat(readNote(n.fichier, cat.cables).map((l) => ({ ...l, note: n.fichier }))); }
    catch (err) { n.ok = false; n.probleme = `illisible (${err.message})`; ask('notesCalcul', `Je n'arrive pas à lire ${n.fichier} : est-ce bien un export Caneco ?`, String(err.message)); }
  }

  // 2. Tronçons
  const troncons = (e.troncons || []).map((t) => {
    const found = liaisons.length ? findLiaisons(liaisons, t) : [];
    return { ...t, liaisonsTrouvees: found.length, refs: found.map((l) => l.ref) };
  });
  if (!troncons.length) {
    ask('troncons', 'Quels tronçons veux-tu ? Par exemple « TGBT → COFFRET 1 puis COFFRET 1 → PIT 1 ».', 'Un masque est produit par tronçon.');
  }
  troncons.filter((t) => liaisons.length && t.liaisonsTrouvees === 0).forEach((t) => ask('troncons',
    `Je ne trouve aucune liaison pour « ${t.nom || `${t.origine || '?'} → ${t.destination || '?'}`} » dans la note. Quelle est l'origine / la destination exacte, ou les références (L…) ?`,
    'Origine comparée à l\'identique, destination par mots entiers.'));

  // 3. Rendus
  const demandes = (e.rendus || []).map((r) => ({ brut: r, cle: ALIAS[String(r).trim().toLowerCase()] }));
  if (!demandes.length) {
    ask('rendus', 'Quel rendu veux-tu : AutoCAD, ZWCAD, MultiCAD (posé sur le plan DWG), Revit, ou un PDF avec vue 3D ?', 'Le format de sortie en dépend.');
  }
  demandes.filter((d) => !d.cle).forEach((d) => ask('rendus', `Je ne connais pas le rendu « ${d.brut} ». Choisis parmi : ${Object.values(RENDUS).map((r) => r.libelle).join(', ')}.`, 'Rendu inconnu.'));
  const rendus = demandes.filter((d) => d.cle).map((d) => ({ rendu: d.cle, ...RENDUS[d.cle] }));

  // 4. Plans (utiles seulement si les masques sont posés sur un plan)
  const plans = (e.plans || []).map((p) => checkFile(p, EXT_PLAN));
  const veutPlan = e.surPlan === true || rendus.some((r) => r.rendu === 'multicad' || r.rendu === 'revit');
  if (e.surPlan == null && !plans.length && !rendus.some((r) => r.rendu === 'multicad' || r.rendu === 'revit')) {
    ask('plans', 'Faut-il poser les masques sur un plan ? Si oui, lequel (DWG/DXF), et as-tu placé les repères à l\'endroit de chaque masque ?', 'Sans plan, les masques sont livrés seuls.', false);
  } else if (veutPlan && !plans.length) {
    ask('plans', 'Sur quel plan dois-je poser les masques ? Donne le chemin du DWG/DXF.', 'Le rendu demandé se fait sur le plan.');
  }
  plans.filter((p) => !p.ok).forEach((p) => ask('plans', `Le plan ${p.fichier} est ${p.probleme} : peux-tu me redonner le bon fichier ?`, 'Plan inutilisable.'));

  // 5. Zone (fixe le recouvrement normatif) : recommandée, défaut trottoir
  if (!e.zone) {
    ask('zone', 'Les tranchées passent sous chaussée, trottoir, espace vert ou terrain privé ? (ça fixe la profondeur minimale)', `Recouvrement mini : ${Object.entries(RECOUVREMENT_MIN_MM).map(([z, v]) => `${z.replace('_', ' ')} ${v} mm`).join(', ')}. Défaut : trottoir.`, false);
  } else if (RECOUVREMENT_MIN_MM[e.zone] == null) {
    ask('zone', `Zone « ${e.zone} » inconnue : chaussée, trottoir, espace vert ou terrain privé ?`, 'Recouvrement normatif.');
  }

  const bloquants = manquant.filter((m) => m.obligatoire);
  const indisponibles = rendus.filter((r) => r.disponible === false);
  return {
    pret: bloquants.length === 0,
    fourni: {
      notesCalcul: notes, liaisonsLues: liaisons.length, troncons,
      rendus, plans, zone: e.zone || null,
    },
    manquant,
    ...(indisponibles.length ? { aSignaler: indisponibles.map((r) => `${r.libelle} : ${r.comment}`) } : {}),
    prochaineEtape: bloquants.length
      ? 'Pose ces questions à l\'utilisateur dans le chat (toutes en un seul message), puis rappelle preparer_etude avec ses réponses.'
      : 'Montre à l\'utilisateur les liaisons retenues par tronçon et fais-les valider, puis appelle generer_masques.',
  };
}

module.exports = { preparerEtude, RENDUS };

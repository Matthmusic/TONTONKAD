// Transition TONTONKAD → nodial : reprise des données utilisateur.
//
// nodial a son propre dossier %APPDATA%\nodial (productName différent). Au premier
// lancement, on y recopie ce que TONTONKAD avait dans %APPDATA%\TONTONKAD :
// config.json, catalogues (data/) et réglages de l'interface (Local Storage).
// L'ancien dossier n'est jamais modifié : il reste un filet de sécurité.
// Sans effet tant que l'app s'appelle encore TONTONKAD (même dossier).

const path = require('path');

const ANCIEN_NOM = 'TONTONKAD';
const MARQUEUR = 'reprise-tontonkad.json';
// Ce qui vaut la peine d'être repris ; les caches Chromium sont laissés de côté.
const ELEMENTS = ['config.json', 'data', 'Local Storage'];

function memeChemin(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

// Décide quoi faire, sans toucher au disque : `existe(p)` est fourni par l'appelant.
function planReprise({ userData, existe }) {
  const ancien = path.join(path.dirname(userData), ANCIEN_NOM);
  if (memeChemin(ancien, userData)) return { action: 'rien', raison: 'meme_dossier' };
  if (existe(path.join(userData, MARQUEUR))) return { action: 'rien', raison: 'deja_faite' };
  if (!existe(ancien)) return { action: 'rien', raison: 'pas_de_tontonkad' };
  // nodial a déjà servi sans reprise (installé à neuf puis TONTONKAD retrouvé) :
  // on n'écrase rien de ce que l'utilisateur a déjà réglé.
  const copies = ELEMENTS
    .filter(e => existe(path.join(ancien, e)) && !existe(path.join(userData, e)))
    .map(e => ({ de: path.join(ancien, e), vers: path.join(userData, e) }));
  return { action: copies.length ? 'copier' : 'marquer', ancien, copies };
}

// Un dossier de données personnalisé qui pointait dans l'ancien %APPDATA%\TONTONKAD
// est redirigé vers la copie ; un chemin réseau ou ailleurs reste tel quel.
function reecrireConfig(texte, ancien, nouveau) {
  let cfg;
  try { cfg = JSON.parse(texte); } catch { return texte; }
  if (typeof cfg.dataPath === 'string') {
    const rel = path.relative(ancien, cfg.dataPath);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) cfg.dataPath = path.join(nouveau, rel);
  }
  return JSON.stringify(cfg, null, 2);
}

async function reprendreDonnees({ userData, fs }) {
  const existe = p => { try { require('fs').accessSync(p); return true; } catch { return false; } };
  const plan = planReprise({ userData, existe });
  if (plan.action === 'rien') return plan;
  await fs.mkdir(userData, { recursive: true });
  for (const { de, vers } of plan.copies) {
    if (path.basename(de) === 'config.json') {
      await fs.writeFile(vers, reecrireConfig(await fs.readFile(de, 'utf8'), plan.ancien, userData), 'utf8');
    } else {
      await fs.cp(de, vers, { recursive: true, errorOnExist: false, force: false });
    }
  }
  await fs.writeFile(path.join(userData, MARQUEUR), JSON.stringify({
    date: new Date().toISOString(), depuis: plan.ancien, elements: plan.copies.map(c => path.basename(c.de)),
  }, null, 2), 'utf8');
  return plan;
}

module.exports = { ANCIEN_NOM, MARQUEUR, ELEMENTS, planReprise, reecrireConfig, reprendreDonnees };

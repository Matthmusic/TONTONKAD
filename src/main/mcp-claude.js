'use strict';
// Branchement du serveur MCP TONTONKAD dans Claude — PUR (aucun accès disque ici).
// Le serveur est livré avec l'application (resources/mcp) et tourne avec le
// moteur Node intégré à TONTONKAD.exe (ELECTRON_RUN_AS_NODE=1) : rien à
// installer sur le poste. main.js lit/écrit les fichiers.

const path = require('path');

const NOM = 'tontonkad';

/** Fichier de configuration de l'application de bureau Claude. */
function cheminConfigClaude(platform, env, home) {
  if (platform === 'win32') return path.win32.join(env.APPDATA || path.win32.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  return path.posix.join(env.XDG_CONFIG_HOME || path.posix.join(home, '.config'), 'Claude', 'claude_desktop_config.json');
}

/** Entrée mcpServers.tontonkad : l'exécutable de l'app en mode Node. */
function entreeServeur({ execPath, serveur, dataDir }) {
  const env = { ELECTRON_RUN_AS_NODE: '1' };
  if (dataDir) env.TONTONKAD_DATA = dataDir; // mêmes catalogues que l'application
  return { command: execPath, args: [serveur], env };
}

const memeEntree = (a, b) => !!a && !!b && a.command === b.command
  && JSON.stringify(a.args || []) === JSON.stringify(b.args || [])
  && JSON.stringify(a.env || {}) === JSON.stringify(b.env || {});

/**
 * Ajoute (ou met à jour) TONTONKAD dans la configuration existante, sans
 * toucher aux autres serveurs ni aux autres réglages.
 * @param {string|null} texte contenu actuel du fichier (null = absent)
 * @returns {{ texte: string, etat: 'ajoute'|'mis_a_jour'|'deja_a_jour' }}
 * @throws si le fichier existe mais n'est pas un JSON objet (on n'écrase rien)
 */
function fusionnerConfig(texte, entree) {
  let cfg = {};
  if (texte != null && String(texte).trim()) {
    try { cfg = JSON.parse(texte); } catch (e) {
      throw new Error(`La configuration de Claude n'est pas un JSON valide (${e.message}) : rien n'a été modifié`);
    }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new Error('La configuration de Claude a un format inattendu : rien n\'a été modifié');
  }
  const serveurs = cfg.mcpServers && typeof cfg.mcpServers === 'object' ? cfg.mcpServers : {};
  const avant = serveurs[NOM];
  const etat = !avant ? 'ajoute' : memeEntree(avant, entree) ? 'deja_a_jour' : 'mis_a_jour';
  cfg.mcpServers = { ...serveurs, [NOM]: entree };
  return { texte: JSON.stringify(cfg, null, 2) + '\n', etat };
}

/** État du branchement lu dans la configuration (sans la modifier). */
function etatBranchement(texte, entree) {
  if (texte == null) return 'absent';
  try {
    const s = (JSON.parse(texte).mcpServers || {})[NOM];
    return !s ? 'non_branche' : memeEntree(s, entree) ? 'branche' : 'a_mettre_a_jour';
  } catch (_) { return 'illisible'; }
}

/** Commande équivalente pour Claude Code (terminal). */
function commandeClaudeCode(entree, platform) {
  const q = (s) => (platform === 'win32' ? `"${s}"` : `'${String(s).replace(/'/g, "'\\''")}'`);
  const envs = Object.entries(entree.env || {}).map(([k, v]) => `-e ${k}=${q(v)}`).join(' ');
  return `claude mcp add ${NOM} ${envs} -- ${q(entree.command)} ${entree.args.map(q).join(' ')}`;
}

module.exports = { NOM, cheminConfigClaude, entreeServeur, fusionnerConfig, etatBranchement, commandeClaudeCode };

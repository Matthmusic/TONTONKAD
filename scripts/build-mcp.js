#!/usr/bin/env node
'use strict';
// Fabrique le serveur MCP en UN SEUL fichier autonome : mcp/dist/tontonkad-mcp.js
// (serveur + modules de src/renderer + @modelcontextprotocol/sdk + zod + xlsx).
// Ce fichier est livré tel quel par l'installeur (resources/mcp) : aucun
// node_modules, aucun NODE_PATH, rien à installer sur le poste.
//
// Il est VERSIONNÉ dans le dépôt : la compilation de l'application n'en
// dépend pas. À relancer après toute modification de mcp/src ou des modules
// métier qu'il utilise :
//   npm install --prefix mcp      (une fois, pour ses dépendances)
//   npm run build:mcp
const path = require('path');
const { execFileSync } = require('child_process');

const racine = path.join(__dirname, '..');
const entree = path.join(racine, 'mcp', 'src', 'server.js');
const sortie = path.join(racine, 'mcp', 'dist', 'tontonkad-mcp.js');
const options = {
  entryPoints: [entree], outfile: sortie, bundle: true, platform: 'node', format: 'cjs', target: 'node18',
  legalComments: 'none', logLevel: 'warning',
  banner: { js: '// TONTONKAD — serveur MCP autonome. FICHIER GÉNÉRÉ par scripts/build-mcp.js : ne pas modifier.' },
};

let esbuild = null;
try { esbuild = require('esbuild'); } catch (_) { /* repli : npx */ }
if (esbuild) {
  esbuild.buildSync(options);
} else {
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'esbuild@0.25.10', entree, '--bundle', '--platform=node',
    '--format=cjs', '--target=node18', '--legal-comments=none', `--outfile=${sortie}`, `--banner:js=${options.banner.js}`], { stdio: 'inherit' });
}
console.log(`Serveur MCP autonome : ${path.relative(racine, sortie)}`);

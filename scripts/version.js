#!/usr/bin/env node
// Passe le projet à une nouvelle version : package.json, package-lock.json et
// cea-app.json (version, lien de téléchargement, changelog).
//
//   node scripts/version.js 2.9.2            → entrée de changelog « 2.9.2 » créée
//   node scripts/version.js 2.9.2 --remplace → l'entrée de la version actuelle (jamais
//                                              publiée) est renommée en 2.9.2
// Sans effet si le projet est déjà dans cette version.
'use strict';
const fs = require('fs');
const path = require('path');

const racine = path.resolve(__dirname, '..');
const V = process.argv[2];
const remplace = process.argv.includes('--remplace');
if (!/^\d+\.\d+\.\d+$/.test(V || '')) { console.error('Usage : node scripts/version.js X.Y.Z [--remplace]'); process.exit(1); }

const lire = (f) => JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8'));
const ecrire = (f, o, indent = 2) => fs.writeFileSync(path.join(racine, f), JSON.stringify(o, null, indent) + '\n', 'utf8');

const pkg = lire('package.json');
const ancienne = pkg.version;
if (ancienne === V) { console.log(`Déjà en ${V}.`); process.exit(0); }
pkg.version = V; ecrire('package.json', pkg);

const lock = lire('package-lock.json');
lock.version = V;
if (lock.packages && lock.packages['']) lock.packages[''].version = V;
ecrire('package-lock.json', lock);

const cea = lire('cea-app.json');
cea.app.version = V;
if (cea.installation && cea.installation.downloadUrl) {
  cea.installation.downloadUrl = cea.installation.downloadUrl.replace(/Setup-\d+\.\d+\.\d+\.exe$/, `Setup-${V}.exe`);
}
const date = new Date().toISOString().slice(0, 10);
const ch = cea.changelog || {};
const reste = Object.fromEntries(Object.entries(ch).filter(([k]) => k !== V && !(remplace && k === ancienne)));
const entree = remplace && ch[ancienne]
  ? { date, changes: ch[ancienne].changes }
  : (ch[V] || { date, changes: ['Corrections et améliorations'] });
cea.changelog = { [V]: entree, ...reste };
ecrire('cea-app.json', cea);

console.log(`Version ${ancienne} → ${V}${remplace ? ` (changelog de la ${ancienne}, jamais publiée, repris)` : ''}.`);

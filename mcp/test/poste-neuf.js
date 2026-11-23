'use strict';
// Vérifie le serveur LIVRÉ (mcp/dist/tontonkad-mcp.js) comme sur un poste neuf :
// copié seul dans un dossier vide avec les catalogues, sans node_modules ni NODE_PATH.
//   node mcp/test/poste-neuf.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { makeNote } = require('./fixtures/make-note.js');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-poste-'));
  fs.mkdirSync(path.join(dir, 'mcp'));
  const serveur = path.join(dir, 'mcp', 'tontonkad-mcp.js');
  fs.copyFileSync(path.join(__dirname, '..', 'dist', 'tontonkad-mcp.js'), serveur);
  fs.cpSync(path.join(__dirname, '..', '..', 'data'), path.join(dir, 'data'), { recursive: true });
  const c = new Client({ name: 'poste-neuf', version: '0' });
  await c.connect(new StdioClientTransport({ command: process.execPath, args: [serveur], env: { PATH: process.env.PATH || '' }, cwd: dir }));
  const outils = (await c.listTools()).tools.map((t) => t.name);
  const note = makeNote(path.join(dir, 'note.xlsx'));
  const lu = JSON.parse((await c.callTool({ name: 'lire_note_calcul', arguments: { chemin: note } })).content[0].text);
  const r = await c.callTool({ name: 'etudier_reseau', arguments: {
    noteCalcul: note,
    elements: [{ nom: 'TGBT', type: 'coffret' }, { nom: 'C1', type: 'chambre' }, { nom: 'COFFRET 1', type: 'coffret' }],
    troncons: [{ de: 'TGBT', vers: 'C1', longueurM: 20, liaisons: [{ destination: 'COFFRET 1' }] },
      { de: 'C1', vers: 'COFFRET 1', longueurM: 12, liaisons: [{ destination: 'COFFRET 1' }] }],
    cad: true } });
  if (r.isError) throw new Error(r.content[0].text);
  const j = JSON.parse(r.content[0].text);
  console.log(JSON.stringify({ outils, liaisons: lu.total, chambre: j.chambres[0].ref, metre: j.metre.totalMetres, multicad: j.multicad.blocs.length }));
  await c.close();
})().catch((e) => { console.error(e.message); process.exit(1); });

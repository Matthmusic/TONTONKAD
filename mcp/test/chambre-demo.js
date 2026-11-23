'use strict';
// Démo : une chambre avec traversée droite et traversée en angle, via le protocole MCP.
//   node test/chambre-demo.js [sortie.pdf]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { makeNote } = require('./fixtures/make-note.js');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-ch-'));
  const note = makeNote(path.join(dir, 'note.xlsx'));
  const client = new Client({ name: 'demo', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, '..', 'src', 'server.js')] }));
  const pdf = process.argv[2] || path.join(dir, 'chambre.pdf');
  const r = await client.callTool({ name: 'generer_masques', arguments: {
    noteCalcul: note,
    masques: [
      { nom: 'Arrivée TGBT', liaisons: [{ refs: ['L1', 'L2', 'L3', 'L4'] }] },
      { nom: 'Vers COFFRET 1', liaisons: [{ refs: ['L1', 'L2', 'L3'] }] },
      { nom: 'Vers COFFRET 2', liaisons: [{ refs: ['L4'] }] },
    ],
    chambres: [{ nom: 'Chambre C1', faces: { pignonA: 'Arrivée TGBT', pignonB: 'Vers COFFRET 1', longPanB: 'Vers COFFRET 2' } }],
    sortiePdf: pdf,
  } });
  if (r.isError) { console.error(r.content[0].text); process.exit(1); }
  const res = JSON.parse(r.content[0].text);
  const e = res.chambres[0];
  console.log('CHAMBRE', e.ok, e.ref, `${e.L}x${e.l}x${e.H}`);
  for (const f of Object.values(e.faces || {})) console.log('  face', f.face, f.masque, f.tient, `${f.largeurMasque}x${f.hauteurMasque} dans ${f.largeurFace}x${f.hauteurFace}`);
  for (const t of e.traversees || []) console.log('  traverse', t.liaison, ':', t.entree, '->', t.sortie, t.type, t.changementFourreau || '');
  for (const a of e.arrets || []) console.log('  arret', a.liaison, a.face);
  console.log('  avert', e.avertissements);
  console.log('PDF', res.pdf);
  await client.close();
})().catch((err) => { console.error(err); process.exit(1); });

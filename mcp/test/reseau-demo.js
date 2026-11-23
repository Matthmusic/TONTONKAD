'use strict';
// Démo : un réseau complet via le protocole MCP (etudier_reseau), avec sortie multiCAD.
//   node test/reseau-demo.js [dossier]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { makeNote } = require('./fixtures/make-note.js');

(async () => {
  const dir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-res-'));
  const stamp = Date.now();
  const note = makeNote(path.join(dir, `note-${stamp}.xlsx`));
  const client = new Client({ name: 'demo', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, '..', 'src', 'server.js')] }));
  const r = await client.callTool({ name: 'etudier_reseau', arguments: {
    noteCalcul: note, titre: 'Démo réseau',
    elements: [
      { nom: 'TGBT', type: 'coffret', coffret: { genre: 'tableau', largeur: 1200, profondeur: 600 } },
      { nom: 'C1', type: 'chambre' },
      { nom: 'C2', type: 'chambre', maconnee: { paroi: 200, tampon: { L: 800, l: 800, classe: 'D400' }, zone: 'chaussee' } },
      { nom: 'COFFRET 1', type: 'coffret', coffret: { largeur: 400, profondeur: 200 } },
      { nom: 'COFFRET 2', type: 'coffret' },
    ],
    troncons: [
      { de: 'TGBT', vers: 'C1', longueurM: 20, liaisons: [{ origine: 'TGBT' }], reserves: [{ type: 'TPC', code: '160', qty: 1 }] },
      { de: 'C1', vers: 'COFFRET 1', longueurM: 12, liaisons: [{ destination: 'COFFRET 1' }] },
      { de: 'C1', vers: 'C2', longueurM: 45, liaisons: [{ refs: [] , destination: 'COFFRET 2' }], reserves: [{ type: 'TPC', code: '160', qty: 1 }] },
      { de: 'C2', vers: 'COFFRET 2', longueurM: 8, liaisons: [{ destination: 'COFFRET 2' }] },
    ],
    sortiePdf: path.join(dir, `reseau-${stamp}.pdf`),
    sortieDxf: path.join(dir, `reseau-${stamp}.dxf`),
    cad: true,
    placements: { 'Chambre C1': { x: 10000, y: 5000, rotation: 90 } },
  } });
  if (r.isError) { console.error(r.content[0].text); process.exit(1); }
  const res = JSON.parse(r.content[0].text);
  for (const t of res.troncons) console.log('TRONCON', t.nom, JSON.stringify(t.faces), t.largeur ? `${t.largeur}x${t.hauteur}` : t.erreurs, (t.fourreaux || []).join(' + '));
  for (const c of res.chambres) console.log('CHAMBRE', c.nom, c.ok, c.ref, (c.traversees || []).map((x) => `${x.liaison}:${x.type}`).join(', '), (c.avertissements || []).join(' ; '));
  for (const c of res.coffrets) console.log('COFFRET', c.nom, JSON.stringify(c.troncons.map((x) => x.verdict)));
  console.log('CONTINUITE', JSON.stringify(res.continuite.problemes));
  console.log('METRE', res.metre.totalMetres, 'm sur', res.metre.longueurReseau, 'm');
  console.log('MULTICAD calques', res.multicad.calques.split('\n').length, '| blocs', res.multicad.blocs.map((b) => `${b.nom}(${b.nombre})`).join(', '));
  console.log(res.multicad.blocs.find((b) => b.nom === 'Chambre C1').commandes.split('\n').slice(0, 4).join('\n'));
  console.log('PDF', res.pdf, '\nDXF', res.dxf);
  await client.close();
})().catch((err) => { console.error(err); process.exit(1); });

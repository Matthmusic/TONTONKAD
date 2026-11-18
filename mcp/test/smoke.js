'use strict';
// Essai de bout en bout par le protocole MCP (client stdio → serveur).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { makeNote } = require('./fixtures/make-note.js');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttk-mcp-'));
  const note = makeNote(path.join(dir, 'note.xlsx'));
  const client = new Client({ name: 'essai', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, '..', 'src', 'server.js')] }));

  const tools = await client.listTools();
  console.log('OUTILS', tools.tools.map((t) => t.name).join(', '));

  console.log('INSTRUCTIONS', (client.getInstructions() || '').split('\n')[0]);
  const prompts = await client.listPrompts();
  console.log('PROMPTS', prompts.prompts.map((p) => p.name).join(', '));
  const pr = await client.getPrompt({ name: 'etude_masques', arguments: { demande: 'masques TGBT vers COFFRET 1' } });
  console.log('PROMPT OK', pr.messages[0].content.text.includes('preparer_etude'));

  const vide = JSON.parse((await client.callTool({ name: 'preparer_etude', arguments: {} })).content[0].text);
  console.log('ETUDE VIDE pret=', vide.pret);
  vide.manquant.forEach((m) => console.log(`  ${m.obligatoire ? '*' : ' '} [${m.champ}] ${m.question}`));
  const partiel = JSON.parse((await client.callTool({ name: 'preparer_etude', arguments: {
    notesCalcul: [note], troncons: [{ nom: 'TGBT → COFFRET 1', origine: 'TGBT', destination: 'COFFRET 1' }, { nom: 'X', origine: 'TGBT', destination: 'PIT 9' }],
    rendus: ['zwcad', 'pdf'],
  } })).content[0].text);
  console.log('ETUDE PARTIELLE pret=', partiel.pret, 'troncons', partiel.fourni.troncons.map((t) => `${t.nom}:${t.liaisonsTrouvees}`).join(' '));
  partiel.manquant.forEach((m) => console.log(`  ${m.obligatoire ? '*' : ' '} [${m.champ}] ${m.question}`));
  console.log('  aSignaler', partiel.aSignaler);
  const complet = JSON.parse((await client.callTool({ name: 'preparer_etude', arguments: {
    notesCalcul: [note], troncons: [{ nom: 'TGBT → COFFRET 1', origine: 'TGBT', destination: 'COFFRET 1' }],
    rendus: ['autocad'], surPlan: false, zone: 'trottoir',
  } })).content[0].text);
  console.log('ETUDE COMPLETE pret=', complet.pret, complet.prochaineEtape);

  const lu = await client.callTool({ name: 'lire_note_calcul', arguments: { chemin: note } });
  console.log('NOTE', lu.content[0].text);

  const dxf = path.join(dir, 'masques.dxf');
  const gen = await client.callTool({ name: 'generer_masques', arguments: {
    noteCalcul: note,
    masques: [
      { nom: 'TGBT → COFFRET 1', liaisons: [{ origine: 'TGBT', destination: 'COFFRET 1' }], reserves: [{ type: 'TPC', code: '160', qty: 1 }] },
      { nom: 'COFFRET 1 → PIT 1', liaisons: [{ origine: 'COFFRET 1', destination: 'PIT 1' }], options: { zone: 'chaussee' } },
    ],
    sortieDxf: dxf,
  } });
  if (gen.isError) { console.error('ERREUR', gen.content[0].text); process.exit(1); }
  const res = JSON.parse(gen.content[0].text);
  for (const m of res.masques) {
    console.log(`\nMASQUE ${m.nom} ok=${m.ok} ${m.largeur}x${m.hauteur} occ=${m.occupation}%`);
    console.log('  liaisons', m.liaisons);
    console.log('  fourreaux', m.fourreaux.map((f) => `${f.id} ${f.type}${f.code} @${f.x},${f.y} [${f.libelle}] ${f.taux}%`).join(' | '));
    console.log('  cables', m.cables.length, m.cables.slice(0, 6).map((c) => `${c.code}:${c.phase}`).join(' '));
    console.log('  tranchee', JSON.stringify(m.tranchee && { prof: m.tranchee.profondeur, rec: m.tranchee.recouvrement, grill: m.tranchee.grillage }));
    console.log('  conformite', (m.tranchee ? m.tranchee.conformite : []).map((c) => `${c.ok ? 'OK' : 'KO'} ${c.regle}`).join(' / '));
    console.log('  avertissements', m.avertissements);
  }
  console.log('\nDXF', res.dxf, fs.statSync(res.dxf).size, 'octets');
  const again = await client.callTool({ name: 'generer_masques', arguments: { noteCalcul: note, masques: [{ nom: 'x', liaisons: [{ texte: 'COFFRET 2' }] }], sortieDxf: dxf } });
  console.log('REECRITURE REFUSEE', again.isError === true, again.content[0].text.slice(0, 80));
  await client.close();
  console.log('DIR', dir);
})().catch((e) => { console.error(e); process.exit(1); });

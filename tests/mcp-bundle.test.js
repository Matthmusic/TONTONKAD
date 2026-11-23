// Le serveur MCP livré par l'installeur est UN fichier autonome (mcp/dist/tontonkad-mcp.js).
// Ce test le lance seul dans un dossier vide (+ les catalogues), sans node_modules ni
// NODE_PATH — exactement comme sur un poste neuf — et vérifie qu'il répond.
const fs = require('fs');
const os = require('os');
const path = require('path');

const bundle = path.join(__dirname, '..', 'mcp', 'dist', 'tontonkad-mcp.js');
const sdk = path.join(__dirname, '..', 'mcp', 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client');
const avecSdk = fs.existsSync(sdk);

describe('serveur MCP autonome (installeur)', () => {
  test('le fichier livré existe et ne dépend d\'aucun paquet externe', () => {
    const src = fs.readFileSync(bundle, 'utf8');
    const externes = [...new Set([...src.matchAll(/\brequire\("([^"./][^"]*)"\)/g)].map((m) => m[1]))]
      .filter((m) => !/^(node:)?(fs|path|os|stream|events|util|crypto|process|child_process|url|buffer|zlib|string_decoder|readline|assert|tty|net)$/.test(m))
      .filter((m) => !m.startsWith('ajv')); // chaînes de code généré par ajv (mode standalone, jamais exécutées)
    expect(externes).toEqual([]);
  });

  (avecSdk ? test : test.skip)('démarre seul sur un « poste neuf » : outils, note Caneco, étude réseau', () => {
    const out = require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'mcp', 'test', 'poste-neuf.js')], { encoding: 'utf8', timeout: 60000 });
    const r = JSON.parse(out.trim().split('\n').pop());
    expect(r.outils).toEqual(expect.arrayContaining(['lire_note_calcul', 'generer_masques', 'etudier_reseau']));
    expect(r.liaisons).toBe(7);
    expect(r.metre).toBe(32);
    expect(r.multicad).toBeGreaterThan(0);
  }, 60000);
});

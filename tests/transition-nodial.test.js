const path = require('path');
const fs = require('fs');
const os = require('os');
const T = require('../src/main/transition-nodial.js');

const racine = path.join('C:', 'Users', 'x', 'AppData', 'Roaming');
const ancien = path.join(racine, 'TONTONKAD');
const nouveau = path.join(racine, 'nodial');
const existePour = liste => p => liste.some(e => path.resolve(e) === path.resolve(p));

describe('transition TONTONKAD → nodial : reprise des données', () => {
  test('tant que l\'app s\'appelle TONTONKAD : rien à faire', () => {
    expect(T.planReprise({ userData: ancien, existe: () => true })).toEqual({ action: 'rien', raison: 'meme_dossier' });
  });
  test('premier lancement de nodial : config, catalogues et réglages repris', () => {
    const p = T.planReprise({ userData: nouveau, existe: existePour([ancien, ...T.ELEMENTS.map(e => path.join(ancien, e))]) });
    expect(p.action).toBe('copier');
    expect(p.copies.map(c => path.basename(c.vers))).toEqual(['config.json', 'data', 'Local Storage']);
  });
  test('reprise déjà faite, ou pas de TONTONKAD sur le poste', () => {
    expect(T.planReprise({ userData: nouveau, existe: existePour([ancien, path.join(nouveau, T.MARQUEUR)]) }).raison).toBe('deja_faite');
    expect(T.planReprise({ userData: nouveau, existe: () => false }).raison).toBe('pas_de_tontonkad');
  });
  test('ce que nodial a déjà n\'est pas écrasé', () => {
    const p = T.planReprise({ userData: nouveau, existe: existePour([ancien, path.join(ancien, 'config.json'), path.join(ancien, 'data'), path.join(nouveau, 'config.json')]) });
    expect(p.copies.map(c => path.basename(c.vers))).toEqual(['data']);
  });
  test('dossier de données dans l\'ancien APPDATA redirigé ; chemin réseau conservé', () => {
    const c1 = JSON.parse(T.reecrireConfig(JSON.stringify({ dataPath: path.join(ancien, 'data'), useCustomPath: false }), ancien, nouveau));
    expect(c1.dataPath).toBe(path.join(nouveau, 'data'));
    const reseau = path.join(path.sep, 'serveur', 'be', 'catalogues');
    expect(JSON.parse(T.reecrireConfig(JSON.stringify({ dataPath: reseau, useCustomPath: true }), ancien, nouveau)).dataPath).toBe(reseau);
    expect(T.reecrireConfig('{ cassé', ancien, nouveau)).toBe('{ cassé');
  });
  test('copie réelle sur disque, ancien dossier intact, une seule fois', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'transition-'));
    const a = path.join(base, 'TONTONKAD'); const n = path.join(base, 'nodial');
    fs.mkdirSync(path.join(a, 'data'), { recursive: true });
    fs.mkdirSync(path.join(a, 'Local Storage', 'leveldb'), { recursive: true });
    fs.writeFileSync(path.join(a, 'data', 'cables.csv'), 'perso');
    fs.writeFileSync(path.join(a, 'Local Storage', 'leveldb', '000003.log'), 'theme');
    fs.writeFileSync(path.join(a, 'config.json'), JSON.stringify({ dataPath: path.join(a, 'data'), useCustomPath: false }));
    const r = await T.reprendreDonnees({ userData: n, fs: fs.promises });
    expect(r.action).toBe('copier');
    expect(fs.readFileSync(path.join(n, 'data', 'cables.csv'), 'utf8')).toBe('perso');
    expect(fs.existsSync(path.join(n, 'Local Storage', 'leveldb', '000003.log'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(n, 'config.json'), 'utf8')).dataPath).toBe(path.join(n, 'data'));
    expect(fs.existsSync(path.join(a, 'config.json'))).toBe(true);
    expect((await T.reprendreDonnees({ userData: n, fs: fs.promises })).raison).toBe('deja_faite');
    fs.rmSync(base, { recursive: true, force: true });
  });
});

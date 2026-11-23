const M = require('../src/main/mcp-claude.js');

const entree = M.entreeServeur({ execPath: 'C:\\Program Files\\TONTONKAD\\TONTONKAD.exe', serveur: 'C:\\Program Files\\TONTONKAD\\resources\\mcp\\src\\server.js', dataDir: 'C:\\Users\\x\\AppData\\Roaming\\tontonkad\\data' });

describe('branchement du serveur MCP intégré dans Claude', () => {
  test('entrée : exécutable de l\'app en mode Node, catalogues de l\'app', () => {
    expect(entree.command).toMatch(/TONTONKAD\.exe$/);
    expect(entree.env.ELECTRON_RUN_AS_NODE).toBe('1');
    expect(entree.env.TONTONKAD_DATA).toMatch(/data$/);
  });
  test('chemin de la configuration Claude selon le système', () => {
    expect(M.cheminConfigClaude('win32', { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' }, 'C:\\Users\\x')).toBe('C:\\Users\\x\\AppData\\Roaming\\Claude\\claude_desktop_config.json');
    expect(M.cheminConfigClaude('darwin', {}, '/Users/x')).toBe('/Users/x/Library/Application Support/Claude/claude_desktop_config.json');
    expect(M.cheminConfigClaude('linux', {}, '/home/x')).toBe('/home/x/.config/Claude/claude_desktop_config.json');
  });
  test('fichier absent : configuration créée', () => {
    const r = M.fusionnerConfig(null, entree);
    expect(r.etat).toBe('ajoute');
    expect(JSON.parse(r.texte).mcpServers.tontonkad).toEqual(entree);
  });
  test('les autres serveurs et réglages sont conservés', () => {
    const avant = JSON.stringify({ theme: 'dark', mcpServers: { autre: { command: 'x', args: [] } } });
    const r = JSON.parse(M.fusionnerConfig(avant, entree).texte);
    expect(r.theme).toBe('dark');
    expect(r.mcpServers.autre).toEqual({ command: 'x', args: [] });
    expect(r.mcpServers.tontonkad).toEqual(entree);
  });
  test('déjà à jour, ou à mettre à jour après déplacement de l\'app', () => {
    const t = M.fusionnerConfig(null, entree).texte;
    expect(M.fusionnerConfig(t, entree).etat).toBe('deja_a_jour');
    expect(M.etatBranchement(t, entree)).toBe('branche');
    const ailleurs = { ...entree, command: 'D:\\Apps\\TONTONKAD.exe' };
    expect(M.etatBranchement(t, ailleurs)).toBe('a_mettre_a_jour');
    expect(M.fusionnerConfig(t, ailleurs).etat).toBe('mis_a_jour');
  });
  test('JSON illisible : rien n\'est écrasé', () => {
    expect(() => M.fusionnerConfig('{ cassé', entree)).toThrow(/rien n'a été modifié/);
    expect(M.etatBranchement('{ cassé', entree)).toBe('illisible');
    expect(M.etatBranchement(null, entree)).toBe('absent');
  });
  test('commande Claude Code équivalente', () => {
    const c = M.commandeClaudeCode(entree, 'win32');
    expect(c).toMatch(/^claude mcp add tontonkad -e ELECTRON_RUN_AS_NODE="1" -e TONTONKAD_DATA=".+" -- "C:\\Program Files\\TONTONKAD\\TONTONKAD\.exe" ".+server\.js"$/);
  });
});

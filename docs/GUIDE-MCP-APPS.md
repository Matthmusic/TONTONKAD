# Livrer un serveur MCP avec une application — règles maison

Leçons de TONTONKAD 2.8.2 → 2.8.3 : le serveur MCP « intégré » ne démarrait
sur aucun poste (dépendances absentes de l'installeur) et ne s'inscrivait dans
Claude Code que pour un dossier. À appliquer à **toute** application qui
embarque un serveur MCP pour Claude.

## 1. Un seul fichier autonome

- Fabriquer le serveur en **un seul fichier JavaScript** qui contient tout :
  son code, les modules de l'app qu'il utilise et ses paquets npm (esbuild,
  `--bundle --platform=node --format=cjs`).
- **Versionner ce fichier** dans le dépôt (exception dans `.gitignore` si
  `dist/` est ignoré) : la compilation de l'app ne doit rien avoir à installer
  ni à fabriquer pour le MCP.
- **Jamais** de `node_modules` dans `extraResources`, **jamais** de `NODE_PATH`.
- Après toute modification du serveur : régénérer le fichier, puis le test
  « poste neuf » (§ 5).

## 2. Aucun logiciel à installer sur le poste

- Électron : lancer le fichier avec l'exécutable de l'app,
  `ELECTRON_RUN_AS_NODE=1` (vérifier que le fusible RunAsNode n'est pas
  désactivé). Pas de Node.js requis.
- Chemins de données passés par variable d'environnement, avec un repli
  relatif au fichier livré (ex. `resources/data`).

## 3. Inscription dans Claude, pour toutes les sessions

Un bouton dans l'app (Paramètres) qui inscrit le serveur aux **deux** endroits :

- **Application de bureau Claude** : `%APPDATA%\Claude\claude_desktop_config.json`
  (macOS `~/Library/Application Support/Claude/…`, Linux `~/.config/Claude/…`),
  clé `mcpServers.<nom>` = `{ command, args, env }`.
- **Claude Code, portée utilisateur** : `~/.claude.json`, clé de premier niveau
  `mcpServers.<nom>` = `{ type: "stdio", command, args, env }`. Seulement si
  le fichier existe (Claude Code installé).
  - Retirer les anciennes inscriptions **par dossier**
    (`projects[*].mcpServers.<nom>`) : elles masquent celle de l'utilisateur.
  - Toute commande affichée : `claude mcp add <nom> --scope user …` —
    **jamais** sans `--scope user` (sinon : un seul dossier).

Écriture prudente : lire, **abandonner si le JSON est illisible** (rien
n'est écrit), **copie de sauvegarde**, conserver tous les autres serveurs et
réglages. Afficher l'état (branché / à mettre à jour / non branché) et la
commande à copier. Demander de fermer Claude Code avant (il réécrit
`~/.claude.json`) et de rouvrir Claude après.

## 4. Mises à jour

- Le chemin du fichier livré ne change pas d'une version à l'autre : pas
  besoin de rebrancher. S'il change, l'état passe à « à mettre à jour ».
- Prévenir : fermer Claude avant de mettre à jour l'app (l'exécutable de
  l'app tourne pour le serveur MCP), le rouvrir après.

## 5. Ne jamais annoncer que ça marche sans le test « poste neuf »

Copier le fichier livré **seul** dans un dossier vide (avec ses données),
environnement minimal (`PATH` seulement, pas de `NODE_PATH`), le lancer et
l'interroger par le protocole MCP : liste des outils **et** un vrai appel
d'outil. Ce test est automatique (Jest) dans le dépôt. Exemple TONTONKAD :
`mcp/test/poste-neuf.js` et `tests/mcp-bundle.test.js`.

Référence d'implémentation : `scripts/build-mcp.js`, `src/main/mcp-claude.js`
(+ `tests/mcp-claude.test.js`), IPC `mcp-etat` / `mcp-brancher-claude` dans
`src/main/main.js`, panneau dans `src/renderer/settings-modal.js`.

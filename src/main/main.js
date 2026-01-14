const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
let autoUpdater = null; // Chargé de façon lazy après que l'app soit prête
const isDev = process.argv.includes('--dev');

// Ces variables seront initialisées après que l'app soit prête
let userDataPath;
let defaultDataFolder;
let configPath;

// Configuration par défaut
let config = {
  dataPath: defaultDataFolder,
  useCustomPath: false
};

// Variable pour le dossier actuellement utilisé
let activeDataFolder = defaultDataFolder;

// Charger la configuration
async function loadConfig() {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    config = { ...config, ...JSON.parse(data) };
    console.log('[OK] Configuration chargee:', config);
  } catch (error) {
    console.log('[INFO] Utilisation de la configuration par defaut');
  }
}

// Sauvegarder la configuration
async function saveConfig() {
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[OK] Configuration sauvegardee');
  } catch (error) {
    console.error('[ERROR] Erreur lors de la sauvegarde de la configuration:', error);
  }
}

// Déterminer le dossier de données à utiliser
async function determineDataFolder() {
  // Si un chemin personnalisé est configuré, essayer de l'utiliser
  if (config.useCustomPath && config.dataPath !== defaultDataFolder) {
    try {
      // Vérifier si le chemin est accessible
      await fs.access(config.dataPath);
      activeDataFolder = config.dataPath;
      console.log(`[OK] Utilisation du chemin personnalise: ${activeDataFolder}`);
      return;
    } catch (error) {
      console.warn(`[WARN] Chemin personnalise non accessible (${config.dataPath}), fallback vers APPDATA`);
      activeDataFolder = defaultDataFolder;
    }
  } else {
    activeDataFolder = defaultDataFolder;
    console.log(`[OK] Utilisation du chemin par defaut: ${activeDataFolder}`);
  }
}

// Fonction pour initialiser le dossier data dans APPDATA
async function initializeUserDataFolder() {
  try {
    // Créer le dossier s'il n'existe pas
    await fs.mkdir(activeDataFolder, { recursive: true });

    // Liste des fichiers CSV à copier
    const csvFiles = ['cables.csv', 'chemins_de_cable.csv', 'fourreaux.csv'];

    for (const file of csvFiles) {
      const userFilePath = path.join(activeDataFolder, file);

      // Vérifier si le fichier existe déjà
      try {
        await fs.access(userFilePath);
        console.log(`[OK] ${file} existe deja`);
      } catch {
        // Le fichier n'existe pas, le copier depuis les ressources
        const sourceFile = isDev
          ? path.join(__dirname, '../../data', file)
          : path.join(process.resourcesPath, 'data', file);

        try {
          const data = await fs.readFile(sourceFile, 'utf8');
          await fs.writeFile(userFilePath, data, 'utf8');
          console.log(`[OK] ${file} copie vers ${activeDataFolder}`);
        } catch (err) {
          console.error(`[ERROR] Erreur lors de la copie de ${file}:`, err);
        }
      }
    }

    console.log(`[INFO] Dossier de donnees actif: ${activeDataFolder}`);
  } catch (error) {
    console.error('[ERROR] Erreur lors de l\'initialisation du dossier data:', error);
  }
}

// Fonction pour initialiser l'auto-updater (seulement en production)
function initAutoUpdater() {
  if (isDev || autoUpdater) return;

  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('Mise à jour disponible:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', {
          version: info.version,
          releaseNotes: info.releaseNotes || 'Nouvelles fonctionnalités et corrections de bugs.',
          releaseDate: info.releaseDate
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      console.log('Aucune mise à jour disponible');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`Téléchargement: ${progressObj.percent}%`);
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', progressObj.percent);
      }
    });

    autoUpdater.on('update-downloaded', () => {
      console.log('Mise à jour téléchargée avec succès');
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('Erreur auto-updater:', err);
      if (mainWindow) {
        mainWindow.webContents.send('update-error', err.message);
      }
    });

    console.log('[OK] Auto-updater initialise');
  } catch (error) {
    console.error('[ERROR] Erreur lors de l\'initialisation de l\'auto-updater:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Désactiver la frame native pour custom titlebar
    icon: path.join(__dirname, '../../assets/icons/ico/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    backgroundColor: '#f0f2f5', // Light par défaut
    show: false
  });

  // Charger l'application
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Afficher la fenêtre une fois prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Une fois le contenu chargé, appliquer le thème depuis localStorage
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      localStorage.getItem('tontonkad-theme') || 'light'
    `).then(theme => {
      const backgroundColor = theme === 'dark' ? '#12121c' : '#f0f2f5';
      mainWindow.setBackgroundColor(backgroundColor);
    });
  });

  // DevTools en mode développement
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Créer le menu
  createMenu();

  // Initialiser l'auto-updater (seulement en production)
  initAutoUpdater();

  // Vérifier les mises à jour (seulement en production)
  if (!isDev) {
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouveau projet',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-project');
          }
        },
        {
          label: 'Ouvrir un projet...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            openProject();
          }
        },
        {
          label: 'Sauvegarder le projet',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            saveProject();
          }
        },
        {
          label: 'Sauvegarder sous...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            saveProjectAs();
          }
        },
        { type: 'separator' },
        {
          label: 'Exporter en PDF',
          click: () => {
            mainWindow.webContents.send('menu-export-pdf');
          }
        },
        {
          label: 'Exporter en DXF',
          click: () => {
            mainWindow.webContents.send('menu-export-dxf');
          }
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        {
          label: 'Annuler',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            mainWindow.webContents.send('menu-undo');
          }
        },
        {
          label: 'Refaire',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => {
            mainWindow.webContents.send('menu-redo');
          }
        },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'delete', label: 'Supprimer' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Tout sélectionner' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Grille',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            mainWindow.webContents.send('menu-toggle-grid');
          }
        },
        {
          label: 'Mode sombre/clair',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('menu-toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom réel' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            mainWindow.webContents.send('menu-help');
          }
        },
        {
          label: 'Raccourcis clavier',
          click: () => {
            mainWindow.webContents.send('menu-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'Vérifier les mises à jour',
          click: () => {
            checkForUpdates(true);
          }
        },
        {
          label: 'À propos',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos de TONTONKAD',
              message: `TONTONKAD v${app.getVersion()}`,
              detail: 'Application de dimensionnement de chemins de câbles et fourreaux\n\n© 2025 TONTONKAD Team',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  if (isDev) {
    template.push({
      label: 'Développement',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Forcer le rechargement' },
        { role: 'toggleDevTools', label: 'Outils de développement' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Auto-updater
function checkForUpdates(manual = false) {
  autoUpdater.checkForUpdates().catch(err => {
    if (manual) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Erreur de mise à jour',
        message: 'Impossible de vérifier les mises à jour',
        detail: err.message
      });
    }
  });
}

// Listener pour déclencher le téléchargement depuis le renderer
ipcMain.on('download-update', () => {
  if (autoUpdater) {
    console.log('Démarrage du téléchargement de la mise à jour...');
    autoUpdater.downloadUpdate();
    if (mainWindow) {
      mainWindow.webContents.send('update-downloading');
    }
  }
});

// Listener pour redémarrer et installer
ipcMain.on('restart-and-install', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  }
});

// IPC Handlers pour les opérations fichiers

// Ouvrir un projet
async function openProject() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [
      { name: 'Projets TONTONKAD', extensions: ['json'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const data = await fs.readFile(result.filePaths[0], 'utf8');
      mainWindow.webContents.send('project-loaded', {
        path: result.filePaths[0],
        data: JSON.parse(data)
      });
    } catch (error) {
      dialog.showErrorBox('Erreur', `Impossible d'ouvrir le projet: ${error.message}`);
    }
  }
}

// Sauvegarder un projet
ipcMain.handle('save-project', async (event, data) => {
  if (data.path) {
    try {
      await fs.writeFile(data.path, JSON.stringify(data.content, null, 2), 'utf8');
      return { success: true, path: data.path };
    } catch (error) {
      throw new Error(`Impossible de sauvegarder: ${error.message}`);
    }
  } else {
    return saveProjectAs(data.content);
  }
});

// Sauvegarder sous
async function saveProjectAs(content = null) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Sauvegarder le projet',
    defaultPath: 'projet-tontonkad.json',
    filters: [
      { name: 'Projets TONTONKAD', extensions: ['json'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      if (content) {
        await fs.writeFile(result.filePath, JSON.stringify(content, null, 2), 'utf8');
        return { success: true, path: result.filePath };
      } else {
        mainWindow.webContents.send('save-project-as', result.filePath);
        return { success: true, path: result.filePath };
      }
    } catch (error) {
      throw new Error(`Impossible de sauvegarder: ${error.message}`);
    }
  }
  return { success: false };
}

// Exporter un fichier (PDF, DXF)
ipcMain.handle('export-file', async (event, { type, content, defaultName }) => {
  const filters = type === 'pdf'
    ? [{ name: 'PDF', extensions: ['pdf'] }]
    : [{ name: 'DXF', extensions: ['dxf'] }];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Exporter en ${type.toUpperCase()}`,
    defaultPath: defaultName || `export-tontonkad.${type}`,
    filters
  });

  if (!result.canceled && result.filePath) {
    try {
      // Spécifier l'encodage UTF-8 pour les fichiers DXF (important pour les caractères accentués)
      const encoding = type === 'dxf' ? 'utf8' : undefined;
      await fs.writeFile(result.filePath, content, encoding ? { encoding } : {});
      return { success: true, path: result.filePath };
    } catch (error) {
      throw new Error(`Impossible d'exporter: ${error.message}`);
    }
  }
  return { success: false };
});

// Charger les données CSV depuis le dossier actif
ipcMain.handle('load-csv', async (event, filename) => {
  try {
    const csvPath = path.join(activeDataFolder, filename);
    const data = await fs.readFile(csvPath, 'utf8');
    return { success: true, data };
  } catch (error) {
    throw new Error(`Impossible de charger ${filename}: ${error.message}`);
  }
});

// Ouvrir le dossier data dans l'explorateur
ipcMain.handle('open-data-folder', async () => {
  try {
    await shell.openPath(activeDataFolder);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Ouvrir un chemin spécifique ou montrer un fichier dans son dossier
ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
  try {
    shell.showItemInFolder(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (event, fullPath) => {
  try {
    await shell.openPath(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Obtenir la configuration actuelle
ipcMain.handle('get-config', async () => {
  return {
    ...config,
    activeDataFolder,
    defaultDataFolder
  };
});

// Définir le chemin personnalisé de la base de données
ipcMain.handle('set-data-path', async (event, newPath) => {
  try {
    // Vérifier si le chemin est accessible
    await fs.access(newPath);

    config.dataPath = newPath;
    config.useCustomPath = true;
    await saveConfig();

    // Redéterminer le dossier actif
    await determineDataFolder();
    await initializeUserDataFolder();

    return { success: true, path: activeDataFolder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Réinitialiser au chemin par défaut
ipcMain.handle('reset-data-path', async () => {
  try {
    config.dataPath = defaultDataFolder;
    config.useCustomPath = false;
    await saveConfig();

    activeDataFolder = defaultDataFolder;
    await initializeUserDataFolder();

    return { success: true, path: activeDataFolder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Sélectionner un dossier via dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Sélectionner le dossier de la base de données CSV',
    buttonLabel: 'Sélectionner'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

// Récupérer la version de l'application
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Gérer le changement de thème
ipcMain.on('set-theme', (event, theme) => {
  if (mainWindow && mainWindow.webContents) {
    const backgroundColor = theme === 'dark' ? '#12121c' : '#f0f2f5';

    // Méthode 1: Changer le backgroundColor de la fenêtre
    mainWindow.setBackgroundColor(backgroundColor);

    // Méthode 2: Injecter du CSS dans la page pour forcer la couleur de fond
    mainWindow.webContents.executeJavaScript(`
      document.body.style.backgroundColor = '${backgroundColor}';
      document.documentElement.style.backgroundColor = '${backgroundColor}';
    `).catch(err => console.error('Erreur lors du changement de thème:', err));
  }
});

// Handlers pour les contrôles de fenêtre (custom titlebar)
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Désactiver le cache GPU pour éviter les erreurs de permissions
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');

// Configurer le cache dans le dossier temporaire système
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('temp'), 'tontonkad-cache'));

// App lifecycle
app.whenReady().then(async () => {
  // Initialiser les chemins après que l'app soit prête
  userDataPath = app.getPath('userData');
  configPath = path.join(userDataPath, 'config.json');

  // En mode dev, utiliser directement le dossier data du projet
  // En production, utiliser APPDATA
  if (isDev) {
    defaultDataFolder = path.join(__dirname, '../../data');
    console.log('[DEV] Mode developpement: utilisation du dossier data local');
  } else {
    defaultDataFolder = path.join(userDataPath, 'data');
  }

  // Mettre à jour la config par défaut avec le bon chemin
  config.dataPath = defaultDataFolder;

  await loadConfig();
  await determineDataFolder();

  // Initialiser le dossier utilisateur seulement en production
  // (en dev, on utilise directement les fichiers du projet)
  if (!isDev) {
    await initializeUserDataFolder();
  }

  console.log(`[INFO] Dossier de donnees actif: ${activeDataFolder}`);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

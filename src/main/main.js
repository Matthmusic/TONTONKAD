const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;
const isDev = process.argv.includes('--dev');

// Configuration de l'auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../../assets/icons/ico/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js')
    },
    backgroundColor: '#1a1a1a',
    show: false
  });

  // Charger l'application
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Afficher la fenêtre une fois prête
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools en mode développement
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Créer le menu
  createMenu();

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

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Mise à jour disponible',
    message: `Une nouvelle version (${info.version}) est disponible !`,
    detail: 'Voulez-vous la télécharger maintenant ?',
    buttons: ['Télécharger', 'Plus tard'],
    defaultId: 0
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();

      // Notification de téléchargement
      mainWindow.webContents.send('update-downloading');
    }
  });
});

autoUpdater.on('update-not-available', () => {
  // Optionnel: afficher un message seulement si vérification manuelle
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow.webContents.send('update-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Mise à jour prête',
    message: 'La mise à jour a été téléchargée',
    detail: 'Elle sera installée au redémarrage de l\'application',
    buttons: ['Redémarrer maintenant', 'Plus tard'],
    defaultId: 0
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Erreur auto-updater:', err);
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
      await fs.writeFile(result.filePath, content);
      return { success: true, path: result.filePath };
    } catch (error) {
      throw new Error(`Impossible d'exporter: ${error.message}`);
    }
  }
  return { success: false };
});

// Charger les données CSV
ipcMain.handle('load-csv', async (event, filename) => {
  try {
    const csvPath = path.join(__dirname, '../../data', filename);
    const data = await fs.readFile(csvPath, 'utf8');
    return { success: true, data };
  } catch (error) {
    throw new Error(`Impossible de charger ${filename}: ${error.message}`);
  }
});

// App lifecycle
app.whenReady().then(createWindow);

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

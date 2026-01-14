const { contextBridge, ipcRenderer } = require('electron');

// Exposer l'API Electron au renderer de manière sécurisée
contextBridge.exposeInMainWorld('electronAPI', {
  // Opérations sur les projets
  saveProject: (data) => ipcRenderer.invoke('save-project', data),

  // Export de fichiers
  exportFile: (type, content, defaultName) =>
    ipcRenderer.invoke('export-file', { type, content, defaultName }),

  // Charger les données CSV
  loadCSV: (filename) => ipcRenderer.invoke('load-csv', filename),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
  openPath: (path) => ipcRenderer.invoke('open-path', path),

  // Configuration de la base de données
  getConfig: () => ipcRenderer.invoke('get-config'),
  setDataPath: (newPath) => ipcRenderer.invoke('set-data-path', newPath),
  resetDataPath: () => ipcRenderer.invoke('reset-data-path'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Gestion du thème
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),

  // Contrôles de fenêtre (custom titlebar)
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Recevoir les événements du menu
  onMenuNewProject: (callback) => ipcRenderer.on('menu-new-project', callback),
  onProjectLoaded: (callback) => ipcRenderer.on('project-loaded', (event, data) => callback(data)),
  onSaveProjectAs: (callback) => ipcRenderer.on('save-project-as', (event, path) => callback(path)),
  onMenuExportPDF: (callback) => ipcRenderer.on('menu-export-pdf', callback),
  onMenuExportDXF: (callback) => ipcRenderer.on('menu-export-dxf', callback),
  onMenuUndo: (callback) => ipcRenderer.on('menu-undo', callback),
  onMenuRedo: (callback) => ipcRenderer.on('menu-redo', callback),
  onMenuToggleGrid: (callback) => ipcRenderer.on('menu-toggle-grid', callback),
  onMenuToggleTheme: (callback) => ipcRenderer.on('menu-toggle-theme', callback),
  onMenuHelp: (callback) => ipcRenderer.on('menu-help', callback),
  onMenuShortcuts: (callback) => ipcRenderer.on('menu-shortcuts', callback),

  // Mises à jour
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
  onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, message) => callback(message)),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),

  // Nettoyer les listeners
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),

  // Informations système
  platform: process.platform,
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});

console.log('Preload script chargé avec succès');

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
  onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', callback),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),

  // Nettoyer les listeners
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),

  // Informations système
  platform: process.platform,
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});

console.log('Preload script chargé avec succès');

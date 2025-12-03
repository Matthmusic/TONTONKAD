// Custom Titlebar pour Electron
// Gestion des contrôles de fenêtre et de la barre de titre personnalisée

(function() {
  'use strict';

  // Initialiser la custom titlebar (Electron uniquement)
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.electronAPI || !window.electronAPI.isElectron) {
      return; // Ne rien faire si on n'est pas dans Electron
    }

    // Ajouter la classe electron-mode au body
    document.body.classList.add('electron-mode');

    const minimizeBtn = document.getElementById('titlebar-minimize');
    const maximizeBtn = document.getElementById('titlebar-maximize');
    const closeBtn = document.getElementById('titlebar-close');

    // Boutons de contrôle
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.electronAPI.windowMinimize();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        window.electronAPI.windowMaximize();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.electronAPI.windowClose();
      });
    }
  });

})();

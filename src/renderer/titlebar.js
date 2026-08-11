// Custom Titlebar pour Electron
// Gestion des contrôles de fenêtre et de la barre de titre personnalisée

(function() {
  'use strict';

  // Initialiser la custom titlebar
  document.addEventListener('DOMContentLoaded', () => {
    // Contrôles de fenêtre (minimiser/agrandir/fermer) : Electron uniquement,
    // fenêtre frameless — sans objet en mode web (fenêtre du navigateur).
    if (window.electronAPI && window.electronAPI.isElectron) {
      document.body.classList.add('electron-mode');

      const minimizeBtn = document.getElementById('titlebar-minimize');
      const maximizeBtn = document.getElementById('titlebar-maximize');
      const closeBtn = document.getElementById('titlebar-close');

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
    }

    // Recharger l'application : équivalent du Ctrl+R développeur, mais
    // accessible en permanence (y compris en build packagée, où le menu
    // "Développement" n'existe pas) — et jamais silencieux, vu que ça vide
    // tout objet non sauvegardé du canvas (fourreaux, câbles, historique).
    const refreshBtn = document.getElementById('titlebar-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const message = 'Toutes les modifications non sauvegardées seront perdues. Recharger l\'application ?';
        const confirmed = (typeof window.customConfirm === 'function')
          ? await window.customConfirm(message, 'Recharger l\'application')
          : window.confirm(message);
        if (confirmed) window.location.reload();
      });
    }
  });

})();

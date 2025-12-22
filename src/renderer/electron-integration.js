// Integration Electron pour TONTONKAD
// Ce fichier gère la communication avec le process principal Electron

(function() {
  'use strict';

  // Vérifier si on est dans Electron
  const isElectron = window.electronAPI && window.electronAPI.isElectron;

  if (!isElectron) {
    console.log('Mode web - APIs Electron non disponibles');
    return;
  }

  console.log('Mode Electron activé');

  // Afficher la version de l'application
  (async () => {
    const versionElement = document.getElementById('version-number');
    if (versionElement && window.electronAPI.getAppVersion) {
      try {
        const version = await window.electronAPI.getAppVersion();
        versionElement.textContent = `v${version}`;
        console.log('Version de l\'application:', version);
      } catch (error) {
        console.error('Erreur lors de la récupération de la version:', error);
      }
    }
  })();

  // Variables globales pour le tracking du projet
  let currentProjectPath = null;
  let projectModified = false;

  // Marquer le projet comme modifié
  window.markProjectAsModified = function() {
    projectModified = true;
    updateTitle();
  };

  // Mettre à jour le titre de la fenêtre
  function updateTitle() {
    const baseName = currentProjectPath
      ? currentProjectPath.split(/[\\/]/).pop()
      : 'Nouveau projet';
    document.title = `${baseName}${projectModified ? ' *' : ''} - TONTONKAD`;
  }

  // Override des fonctions de sauvegarde/chargement du LocalStorage
  // pour utiliser le système de fichiers Electron

  // Sauvegarder le projet
  window.saveProjectToFile = async function(projectData) {
    try {
      const result = await window.electronAPI.saveProject({
        path: currentProjectPath,
        content: projectData
      });

      if (result.success) {
        currentProjectPath = result.path;
        projectModified = false;
        updateTitle();
        console.log('Projet sauvegardé:', result.path);
        return true;
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du projet: ' + error.message);
    }
    return false;
  };

  // Export de fichiers (PDF, DXF)
  window.exportToFile = async function(type, content, defaultName) {
    try {
      const result = await window.electronAPI.exportFile(type, content, defaultName);
      if (result.success) {
        console.log(`Export ${type} réussi:`, result.path);
        return result.path;
      }
    } catch (error) {
      console.error(`Erreur lors de l'export ${type}:`, error);
      alert(`Erreur lors de l'export: ${error.message}`);
    }
    return null;
  };

  // Charger les CSV via Electron
  window.loadCSVFromElectron = async function(filename) {
    try {
      const result = await window.electronAPI.loadCSV(filename);
      if (result.success) {
        return result.data;
      }
    } catch (error) {
      console.error('Erreur chargement CSV:', error);
      throw error;
    }
  };

  // Listeners pour les événements du menu
  window.electronAPI.onMenuNewProject(() => {
    if (projectModified) {
      if (confirm('Voulez-vous sauvegarder le projet actuel avant de créer un nouveau projet ?')) {
        // Trigger save from main script
        const event = new CustomEvent('electron-save-before-new');
        window.dispatchEvent(event);
      }
    }
    // Trigger new project
    const event = new CustomEvent('electron-new-project');
    window.dispatchEvent(event);
  });

  window.electronAPI.onProjectLoaded((data) => {
    currentProjectPath = data.path;
    projectModified = false;
    updateTitle();

    // Trigger project load event
    const event = new CustomEvent('electron-load-project', { detail: data.data });
    window.dispatchEvent(event);
  });

  window.electronAPI.onSaveProjectAs((path) => {
    currentProjectPath = path;
    // Trigger save
    const event = new CustomEvent('electron-save-project');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuExportPDF(() => {
    const event = new CustomEvent('electron-export-pdf');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuExportDXF(() => {
    const event = new CustomEvent('electron-export-dxf');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuUndo(() => {
    const event = new CustomEvent('electron-undo');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuRedo(() => {
    const event = new CustomEvent('electron-redo');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuToggleGrid(() => {
    const event = new CustomEvent('electron-toggle-grid');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuToggleTheme(() => {
    const event = new CustomEvent('electron-toggle-theme');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuHelp(() => {
    const event = new CustomEvent('electron-help');
    window.dispatchEvent(event);
  });

  window.electronAPI.onMenuShortcuts(() => {
    const event = new CustomEvent('electron-shortcuts');
    window.dispatchEvent(event);
  });

  // Gestion de la notification de mise à jour
  const updateNotification = document.getElementById('update-notification');
  const updateVersionNumber = document.getElementById('update-version-number');
  const updateDescription = document.getElementById('update-description');
  const updateProgressContainer = document.getElementById('update-progress-container');
  const updateProgressFill = document.getElementById('update-progress-fill');
  const updateProgressText = document.getElementById('update-progress-text');
  const updateBtnLater = document.getElementById('update-btn-later');
  const updateBtnDownload = document.getElementById('update-btn-download');
  const updateCloseBtn = document.getElementById('update-close-btn');
  const updateCard = document.querySelector('.update-notification-card');

  const applyUpdateToastStyles = () => {
    if (updateNotification) {
      updateNotification.style.position = 'fixed';
      updateNotification.style.top = '64px';
      updateNotification.style.right = '20px';
      updateNotification.style.zIndex = '12000';
      updateNotification.style.pointerEvents = 'none';
    }
    if (updateCard) updateCard.style.pointerEvents = 'auto';
  };

  // Stocker les infos de mise à jour
  let updateInfo = null;

  // Listener pour l'événement update-available depuis le main process
  window.electronAPI.onUpdateAvailable((info) => {
    console.log('Mise à jour disponible:', info);
    window.showUpdateNotification(info);
  });

  // Afficher la notification de mise à jour
  window.showUpdateNotification = (info) => {
    applyUpdateToastStyles();
    updateInfo = info;
    updateVersionNumber.textContent = info.version;

    if (info.releaseNotes) {
      updateDescription.textContent = info.releaseNotes;
    }

    updateNotification.classList.remove('hidden');
  };

  // Bouton de test (dev) pour afficher la notification de mise à jour
  const devUpdateBtn = document.getElementById('dev-update-btn');
  if (devUpdateBtn) {
    devUpdateBtn.addEventListener('click', () => {
      applyUpdateToastStyles();
      window.showUpdateNotification({
        version: '9.9.9-dev',
        releaseNotes: 'Aperçu visuel de la notification de mise à jour. Les boutons fonctionnent comme en production.'
      });
    });
  }

  // Bouton "Plus tard"
  updateBtnLater.addEventListener('click', () => {
    updateNotification.classList.add('hidden');
  });

  if (updateCloseBtn) {
    updateCloseBtn.addEventListener('click', () => {
      updateNotification.classList.add('hidden');
    });
  }

  // Simuler la fin du download en mode dev : switch vers "Redémarrer maintenant"
  const restartActions = document.getElementById('update-actions-restart');
  const downloadActions = document.getElementById('update-actions-download');
  const restartBtn = document.getElementById('update-btn-restart');
  const showRestartCTA = () => {
    if (downloadActions) downloadActions.classList.add('hidden');
    if (restartActions) restartActions.classList.remove('hidden');
    if (restartBtn) {
      restartBtn.onclick = () => window.electronAPI.restartAndInstall && window.electronAPI.restartAndInstall();
    }
  };

  // Bouton "Télécharger maintenant"
  updateBtnDownload.addEventListener('click', () => {
    updateBtnDownload.disabled = true;
    updateBtnDownload.textContent = 'Téléchargement...';
    if (updateBtnLater) updateBtnLater.disabled = true;

    if (updateProgressContainer) {
      updateProgressContainer.classList.remove('hidden');
      updateProgressFill.style.width = '0%';
      updateProgressText.textContent = 'Téléchargement en cours...';
    }

    // Mode Electron : appel réel, sinon simulation rapide pour le test
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    } else {
      // Simulation : barre à 100% puis affichage du CTA restart
      setTimeout(() => {
        if (updateProgressFill) updateProgressFill.style.width = '100%';
        updateProgressText.textContent = 'Téléchargement terminé !';
        showRestartCTA();
      }, 700);
    }
  });

  // Notifications de mise à jour
  window.electronAPI.onUpdateDownloading(() => {
    console.log('Téléchargement de la mise à jour...');
    updateProgressContainer.classList.remove('hidden');
    updateProgressText.textContent = 'Téléchargement en cours...';
  });

  window.electronAPI.onUpdateProgress((percent) => {
    console.log(`Progression de la mise à jour: ${percent.toFixed(1)}%`);
    updateProgressFill.style.width = `${percent}%`;
    updateProgressText.textContent = `Téléchargement en cours... ${percent.toFixed(0)}%`;
  });

  // Mise à jour téléchargée
  window.electronAPI.onUpdateDownloaded(() => {
    console.log('Mise à jour téléchargée avec succès');
    updateProgressContainer.classList.add('hidden');
    showRestartCTA();
    updateProgressText.textContent = 'Téléchargement terminé !';
    updateDescription.textContent = 'La mise à jour a été téléchargée. Cliquez sur "Redémarrer maintenant" pour l\'installer.';
  });

  // Erreur de mise à jour
  window.electronAPI.onUpdateError((message) => {
    console.error('Erreur de mise à jour:', message);
    updateProgressContainer.classList.add('hidden');
    updateBtnDownload.textContent = 'Télécharger maintenant';
    updateBtnDownload.disabled = false;
    updateBtnLater.disabled = false;
    updateDescription.textContent = `Erreur lors du téléchargement: ${message}`;
    updateDescription.style.color = '#dc2626';
  });

  // Détection de changements pour marquer comme modifié
  // Cette fonction devra être appelée dans script.js quand des modifications sont faites
  window.addEventListener('project-modified', () => {
    markProjectAsModified();
  });

  console.log('Intégration Electron initialisée avec succès');
})();

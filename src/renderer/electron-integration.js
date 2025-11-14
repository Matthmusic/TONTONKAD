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

  // Notifications de mise à jour
  window.electronAPI.onUpdateDownloading(() => {
    console.log('Téléchargement de la mise à jour...');
    // Optionnel: afficher une notification dans l'UI
  });

  window.electronAPI.onUpdateProgress((percent) => {
    console.log(`Progression de la mise à jour: ${percent.toFixed(1)}%`);
    // Optionnel: afficher une barre de progression
  });

  // Détection de changements pour marquer comme modifié
  // Cette fonction devra être appelée dans script.js quand des modifications sont faites
  window.addEventListener('project-modified', () => {
    markProjectAsModified();
  });

  console.log('Intégration Electron initialisée avec succès');
})();

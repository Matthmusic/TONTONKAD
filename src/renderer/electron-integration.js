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

  // Gestion de la modale de mise à jour
  const updateModal = document.getElementById('update-modal');
  const updateVersionNumber = document.getElementById('update-version-number');
  const updateDescription = document.getElementById('update-description');
  const updateProgressContainer = document.getElementById('update-progress-container');
  const updateProgressFill = document.getElementById('update-progress-fill');
  const updateProgressText = document.getElementById('update-progress-text');
  const updateProgressPercent = document.getElementById('update-progress-percent');
  const updateBtnLater = document.getElementById('update-btn-later');
  const updateBtnDownload = document.getElementById('update-btn-download');
  const updateBtnDownloadText = document.getElementById('update-btn-download-text');
  const updateBtnRestart = document.getElementById('update-btn-restart');
  const updateCloseBtn = document.getElementById('update-close-btn');
  if (updateDescription) {
    updateDescription.style.whiteSpace = 'pre-line';
  }

  // Nettoyer les release notes pour éviter l'affichage HTML brut
  function normalizeReleaseNotes(info) {
    if (!info || !info.releaseNotes) return '';

    const raw = info.releaseNotes;
    let text = '';

    if (Array.isArray(raw)) {
      text = raw.map(item => {
        if (!item) return '';
        const value = typeof item === 'string' ? item : (item.note || item.body || '');
        const div = document.createElement('div');
        div.innerHTML = value;
        return (div.textContent || '').trim();
      }).filter(Boolean).join('\n');
    } else if (typeof raw === 'string') {
      const div = document.createElement('div');
      div.innerHTML = raw;
      text = (div.textContent || '').trim();
    }

    return text || '';
  }

  // Stocker les infos de mise à jour
  let updateInfo = null;

  // Listener pour l'événement update-available depuis le main process
  window.electronAPI.onUpdateAvailable((info) => {
    console.log('Mise à jour disponible:', info);
    window.showUpdateModal(info);
  });

  // Afficher la modale de mise à jour
  window.showUpdateModal = (info) => {
    updateInfo = info;
    updateVersionNumber.textContent = info.version;

    const releaseNotesText = normalizeReleaseNotes(info);
    const finalNotes = releaseNotesText || 'Notes de version non disponibles.';
    updateDescription.textContent = finalNotes;

    // Appliquer les styles manuellement via JS (le CSS ne fonctionne pas à cause du cache)
    const modalContent = updateModal.querySelector('.update-modal-content');
    if (modalContent) {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

      // Styles pour le conteneur modal
      Object.assign(modalContent.style, {
        background: isDark ?
          'linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(20, 20, 36, 0.96))' :
          'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 250, 0.96))',
        border: '1px solid rgba(255, 145, 77, 0.3)',
        borderRadius: '24px',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 145, 77, 0.15)',
        backdropFilter: 'blur(20px)',
        width: '90%',
        maxWidth: '540px',
        color: isDark ? '#fff' : '#1a1d1f',
        overflow: 'hidden',
        animation: 'modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      });

      // Styles pour le header
      const header = modalContent.querySelector('.update-modal-header');
      if (header) {
        Object.assign(header.style, {
          padding: '24px 24px 20px',
          borderBottom: '1px solid rgba(255, 145, 77, 0.15)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          background: isDark ?
            'linear-gradient(135deg, rgba(255, 145, 77, 0.08), rgba(255, 117, 31, 0.05))' :
            'linear-gradient(135deg, rgba(255, 145, 77, 0.06), rgba(255, 117, 31, 0.03))'
        });
      }

      // Styles pour l'icône de mise à jour
      const iconLarge = modalContent.querySelector('.update-icon-large');
      if (iconLarge) {
        Object.assign(iconLarge.style, {
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ff914d, #ff751f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 12px 28px rgba(255, 145, 77, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          flexShrink: '0',
          color: '#ffffff'
        });

        // Assurer que le SVG soit blanc
        const svgIcon = iconLarge.querySelector('svg');
        if (svgIcon) {
          svgIcon.style.color = '#ffffff';
        }
      }

      // Styles pour le body
      const body = modalContent.querySelector('.update-modal-body');
      if (body) {
        Object.assign(body.style, {
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        });
      }

      // Styles pour la version card
      const versionCard = modalContent.querySelector('.update-version-card');
      if (versionCard) {
        Object.assign(versionCard.style, {
          padding: '16px 20px',
          background: 'rgba(255, 145, 77, 0.1)',
          border: '1px solid rgba(255, 145, 77, 0.25)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        });
      }

      // Styles pour le numéro de version
      const versionNum = modalContent.querySelector('.update-version-number');
      if (versionNum) {
        Object.assign(versionNum.style, {
          fontSize: '24px',
          fontWeight: '800',
          color: '#ff914d',
          letterSpacing: '-0.5px'
        });
      }

      // Styles pour la description box
      const descBox = modalContent.querySelector('.update-description-box');
      if (descBox) {
        Object.assign(descBox.style, {
          padding: '16px 20px',
          background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
          borderLeft: '3px solid #ff914d',
          borderRadius: '12px'
        });
      }

      // Styles pour les actions (boutons)
      const actions = modalContent.querySelector('.modal-actions');
      if (actions) {
        Object.assign(actions.style, {
          padding: '20px 24px',
          borderTop: '1px solid rgba(255, 145, 77, 0.15)',
          background: isDark ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.02)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        });
      }

      // Styles pour le bouton close
      const closeBtn = modalContent.querySelector('.update-modal-close');
      if (closeBtn) {
        Object.assign(closeBtn.style, {
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.5)',
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)',
          cursor: 'pointer',
          fontSize: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: '0',
          transition: 'all 0.3s ease'
        });
      }

      // Styles pour le header left (icône + texte)
      const headerLeft = modalContent.querySelector('.update-header-left');
      if (headerLeft) {
        Object.assign(headerLeft.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flex: '1'
        });
      }

      // Styles pour le header text container
      const headerText = modalContent.querySelector('.update-header-text');
      if (headerText) {
        Object.assign(headerText.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        });
      }

      // Styles pour le titre de la modale
      const modalTitle = modalContent.querySelector('.update-modal-title');
      if (modalTitle) {
        Object.assign(modalTitle.style, {
          margin: '0',
          fontSize: '20px',
          fontWeight: '700',
          color: isDark ? '#fff' : '#1a1d1f',
          lineHeight: '1.3'
        });
      }

      // Styles pour le sous-titre de la modale
      const modalSubtitle = modalContent.querySelector('.update-modal-subtitle');
      if (modalSubtitle) {
        Object.assign(modalSubtitle.style, {
          margin: '0',
          fontSize: '14px',
          fontWeight: '400',
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
          lineHeight: '1.4'
        });
      }

      // Styles pour le label de version
      const versionLabel = modalContent.querySelector('.update-version-label');
      if (versionLabel) {
        Object.assign(versionLabel.style, {
          fontSize: '13px',
          fontWeight: '600',
          color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        });
      }

      // Styles pour la description
      const description = modalContent.querySelector('.update-description');
      if (description) {
        Object.assign(description.style, {
          margin: '0',
          fontSize: '14px',
          lineHeight: '1.6',
          color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'
        });
      }

      // Styles pour le conteneur de progression
      const progressContainer = modalContent.querySelector('.update-progress');
      if (progressContainer) {
        Object.assign(progressContainer.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        });
      }

      // Styles pour le header de progression
      const progressHeader = modalContent.querySelector('.update-progress-header');
      if (progressHeader) {
        Object.assign(progressHeader.style, {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: '600'
        });
      }

      // Styles pour le texte de progression
      const progressText = modalContent.querySelector('.update-progress-text');
      if (progressText) {
        Object.assign(progressText.style, {
          color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.75)'
        });
      }

      // Styles pour le pourcentage
      const progressPercent = modalContent.querySelector('.update-progress-percent');
      if (progressPercent) {
        Object.assign(progressPercent.style, {
          color: '#ff914d',
          fontWeight: '700'
        });
      }

      // Styles pour la barre de progression
      const progressBar = modalContent.querySelector('.update-progress-bar');
      if (progressBar) {
        Object.assign(progressBar.style, {
          width: '100%',
          height: '8px',
          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative'
        });
      }

      // Styles pour le remplissage de la barre
      const progressFill = modalContent.querySelector('.update-progress-fill');
      if (progressFill) {
        Object.assign(progressFill.style, {
          height: '100%',
          background: 'linear-gradient(90deg, #ff914d, #ff751f)',
          borderRadius: '12px',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 12px rgba(255, 145, 77, 0.6)',
          position: 'relative'
        });
      }

      // Styles pour les boutons
      const btnPrimary = modalContent.querySelectorAll('.btn-primary');
      btnPrimary.forEach(btn => {
        Object.assign(btn.style, {
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #ff914d, #ff751f)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s ease',
          boxShadow: '0 6px 20px rgba(255, 145, 77, 0.3)'
        });
      });

      const btnCancel = modalContent.querySelector('.btn-cancel');
      if (btnCancel) {
        Object.assign(btnCancel.style, {
          padding: '12px 24px',
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)',
          border: '1px solid ' + (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'),
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        });
      }

    }

    // Afficher la modale
    updateModal.style.display = 'flex';

    // Réinitialiser l'état
    updateBtnDownload.style.display = 'flex';
    updateBtnRestart.style.display = 'none';
    updateProgressContainer.classList.add('hidden');
    updateBtnDownload.disabled = false;
    updateBtnLater.disabled = false;
    updateBtnDownloadText.textContent = 'Télécharger maintenant';
  };

  // Bouton "Plus tard"
  updateBtnLater.addEventListener('click', () => {
    updateModal.style.display = 'none';
  });

  // Bouton fermer
  if (updateCloseBtn) {
    updateCloseBtn.addEventListener('click', () => {
      updateModal.style.display = 'none';
    });
  }

  // Fermer en cliquant sur l'overlay
  updateModal.addEventListener('click', (e) => {
    if (e.target === updateModal) {
      updateModal.style.display = 'none';
    }
  });

  // Fonction pour afficher le bouton redémarrer
  const showRestartButton = () => {
    updateBtnDownload.style.display = 'none';
    updateBtnRestart.style.display = 'flex';
    updateBtnLater.disabled = false;
  };

  // Bouton "Télécharger maintenant"
  updateBtnDownload.addEventListener('click', () => {
    updateBtnDownload.disabled = true;
    updateBtnDownloadText.textContent = 'Téléchargement...';
    updateBtnLater.disabled = true;

    // Afficher la barre de progression
    updateProgressContainer.classList.remove('hidden');
    updateProgressFill.style.width = '0%';
    updateProgressText.textContent = 'Préparation...';
    updateProgressPercent.textContent = '0%';

    // Appeler l'API Electron pour télécharger la mise à jour
    if (window.electronAPI && window.electronAPI.downloadUpdate) {
      window.electronAPI.downloadUpdate();
    }
  });

  // Bouton "Redémarrer maintenant"
  if (updateBtnRestart) {
    updateBtnRestart.addEventListener('click', () => {
      if (window.electronAPI && window.electronAPI.restartAndInstall) {
        window.electronAPI.restartAndInstall();
      }
    });
  }

  // Notifications de mise à jour depuis le main process
  window.electronAPI.onUpdateDownloading(() => {
    console.log('Téléchargement de la mise à jour...');
    updateProgressContainer.classList.remove('hidden');
    updateProgressText.textContent = 'Téléchargement en cours...';
    updateProgressPercent.textContent = '0%';
  });

  window.electronAPI.onUpdateProgress((percent) => {
    console.log(`Progression de la mise à jour: ${percent.toFixed(1)}%`);
    const percentRounded = Math.round(percent);
    updateProgressFill.style.width = `${percentRounded}%`;
    updateProgressPercent.textContent = `${percentRounded}%`;
    updateProgressText.textContent = 'Téléchargement en cours...';
  });

  // Mise à jour téléchargée
  window.electronAPI.onUpdateDownloaded(() => {
    console.log('Mise à jour téléchargée avec succès');
    updateProgressText.textContent = 'Téléchargement terminé !';
    updateProgressPercent.textContent = '100%';
    updateProgressFill.style.width = '100%';
    setTimeout(() => {
      showRestartButton();
      updateDescription.textContent = 'La mise à jour a été téléchargée avec succès. Redémarrez l\'application pour l\'installer.';
    }, 500);
  });

  // Erreur de mise à jour
  window.electronAPI.onUpdateError((message) => {
    console.error('Erreur de mise à jour:', message);
    updateProgressContainer.classList.add('hidden');
    updateBtnDownloadText.textContent = 'Télécharger maintenant';
    updateBtnDownload.disabled = false;
    updateBtnLater.disabled = false;
    updateDescription.textContent = `❌ Erreur lors du téléchargement: ${message}`;
    updateDescription.style.color = 'var(--error-color)';
  });

  // Détection de changements pour marquer comme modifié
  // Cette fonction devra être appelée dans script.js quand des modifications sont faites
  window.addEventListener('project-modified', () => {
    markProjectAsModified();
  });

  console.log('Intégration Electron initialisée avec succès');
})();

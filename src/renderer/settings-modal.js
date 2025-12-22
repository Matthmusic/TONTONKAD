// Gestion de la modal de paramètres de la base de données
// Permet de configurer le dossier des fichiers CSV

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const manualButton = document.getElementById('manual-button');
    const manualModal = document.getElementById('manual-modal');
    const manualCloseBtn = document.getElementById('manual-close-btn');
    const radioDefault = document.getElementById('radio-default');
    const radioCustom = document.getElementById('radio-custom');
    const customPathContainer = document.getElementById('custom-path-container');
    const customPathInput = document.getElementById('custom-path-input');
    const browseFolderBtn = document.getElementById('browse-folder-btn');
    const defaultPathInfo = document.getElementById('default-path-info');
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');
    const settingsSaveBtn = document.getElementById('settings-save-btn');
    const settingsStatus = document.getElementById('settings-status');

    // Vérifier si on est dans Electron
    if (!window.electronAPI || !window.electronAPI.getConfig) {
      if (settingsButton) settingsButton.style.display = 'none';
      return;
    }

    let currentConfig = null;

    // Charger la configuration actuelle
    async function loadCurrentConfig() {
      try {
        currentConfig = await window.electronAPI.getConfig();
        defaultPathInfo.textContent = currentConfig.defaultDataFolder;

        if (currentConfig.useCustomPath) {
          radioCustom.checked = true;
          customPathContainer.style.display = 'block';
          customPathInput.value = currentConfig.dataPath;
        } else {
          radioDefault.checked = true;
          customPathContainer.style.display = 'none';
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la config:', error);
      }
    }

    // Ouvrir la modal
    settingsButton.addEventListener('click', async () => {
      await loadCurrentConfig();
      settingsModal.style.display = 'flex';
      settingsStatus.style.display = 'none';
    });

    // Fermer la modal
    const closeModal = () => {
      settingsModal.style.display = 'none';
    };

    settingsCancelBtn.addEventListener('click', closeModal);
    settingsCloseBtn.addEventListener('click', closeModal);

    // Fermer en cliquant sur l'overlay
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeModal();
      }
    });

    // Fermer avec Echap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsModal.style.display === 'flex') {
        closeModal();
      }
    });

    // Toggle custom path container
    radioDefault.addEventListener('change', () => {
      if (radioDefault.checked) {
        customPathContainer.style.display = 'none';
      }
    });

    radioCustom.addEventListener('change', () => {
      if (radioCustom.checked) {
        customPathContainer.style.display = 'block';
      }
    });

    // Permettre le clic sur toute la carte pour sélectionner l'option
    const optionLocalCard = document.getElementById('option-local');
    const optionCustomCard = document.getElementById('option-custom');

    if (optionLocalCard) {
      optionLocalCard.addEventListener('click', (e) => {
        // Ne pas déclencher si on clique déjà sur le radio button
        if (e.target !== radioDefault && !radioDefault.contains(e.target)) {
          radioDefault.checked = true;
          radioDefault.dispatchEvent(new Event('change'));
        }
      });
    }

    if (optionCustomCard) {
      optionCustomCard.addEventListener('click', (e) => {
        // Ne pas déclencher si on clique sur le radio button, l'input ou le bouton parcourir
        if (e.target !== radioCustom &&
            !radioCustom.contains(e.target) &&
            e.target !== customPathInput &&
            e.target !== browseFolderBtn &&
            !browseFolderBtn.contains(e.target)) {
          radioCustom.checked = true;
          radioCustom.dispatchEvent(new Event('change'));
        }
      });
    }

    // Parcourir les dossiers
    browseFolderBtn.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.selectFolder();
        if (result.success) {
          customPathInput.value = result.path;
        }
      } catch (error) {
        console.error('Erreur lors de la sélection du dossier:', error);
      }
    });

    // Sauvegarder la configuration
    settingsSaveBtn.addEventListener('click', async () => {
      try {
        settingsSaveBtn.disabled = true;
        settingsSaveBtn.textContent = 'Enregistrement...';

        let result;
        if (radioCustom.checked) {
          const customPath = customPathInput.value.trim();
          if (!customPath) {
            showStatus('Veuillez sélectionner un dossier', 'error');
            return;
          }
          result = await window.electronAPI.setDataPath(customPath);
        } else {
          result = await window.electronAPI.resetDataPath();
        }

        if (result.success) {
          showStatus(`Configuration enregistrée ! Dossier actif : ${result.path}`, 'success');
          setTimeout(() => {
            closeModal();
            // Recharger la page pour utiliser la nouvelle base de données
            window.location.reload();
          }, 2000);
        } else {
          showStatus(`Erreur : ${result.error}`, 'error');
        }
      } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showStatus(`Erreur : ${error.message}`, 'error');
      } finally {
        settingsSaveBtn.disabled = false;
        settingsSaveBtn.textContent = 'Enregistrer';
      }
    });

    function showStatus(message, type) {
      settingsStatus.textContent = message;
      settingsStatus.style.display = 'block';
      settingsStatus.style.background = type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)';
      settingsStatus.style.color = type === 'success' ? 'var(--success-color)' : 'var(--error-color)';
    }

    // Manuel utilisateur
    if (manualButton && manualModal && manualCloseBtn) {
      manualButton.addEventListener('click', () => {
        manualModal.style.display = 'flex';
      });
      manualCloseBtn.addEventListener('click', () => {
        manualModal.style.display = 'none';
      });
      manualModal.addEventListener('click', (e) => {
        if (e.target === manualModal) {
          manualModal.style.display = 'none';
        }
      });
      // Fermer avec Echap
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && manualModal.style.display === 'flex') {
          manualModal.style.display = 'none';
        }
      });
    }
  });

})();

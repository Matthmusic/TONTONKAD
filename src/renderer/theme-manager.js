// Theme Manager pour TONTONKAD
// Gestion centralisée du thème sombre/clair

(function() {
  'use strict';

  // Fonction pour mettre à jour tous les éléments visuels selon le thème
  function updateThemeElements(theme) {
    const brandLogo = document.getElementById('brandLogo');
    const favicon = document.getElementById('favicon');
    const titlebarLogo = document.getElementById('titlebar-logo');

    if (brandLogo) {
      brandLogo.src = theme === 'dark'
        ? '../../assets/icons/ico/TONTONKADB.png'
        : '../../assets/icons/ico/TONTONKADN.png';
    }

    if (favicon) {
      favicon.href = theme === 'dark'
        ? '../../assets/icons/ico/TONTONKADB.ico'
        : '../../assets/icons/ico/TONTONKADN.ico';
    }

    if (titlebarLogo) {
      titlebarLogo.src = theme === 'dark'
        ? '../../assets/icons/ico/TONTONKADB.png'
        : '../../assets/icons/ico/TONTONKADN.png';
    }
  }

  // Fonction pour appliquer le thème
  function applyTheme(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    localStorage.setItem('tontonkad-theme', theme);
    updateThemeElements(theme);

    // Notifier Electron du changement de thème
    if (window.electronAPI && window.electronAPI.setTheme) {
      window.electronAPI.setTheme(theme);
    }

    // Redessiner le canvas si la fonction existe
    if (window.redraw) {
      window.redraw();
    }
  }

  // Fonction pour basculer le thème
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);

    // Afficher une notification
    if (window.showToast) {
      window.showToast(`Thème ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`);
    }
  }

  // Initialisation au chargement de la page
  document.addEventListener('DOMContentLoaded', () => {
    // Appliquer le thème sauvegardé
    const savedTheme = localStorage.getItem('tontonkad-theme') || 'light';
    applyTheme(savedTheme);

    // Observer les changements de thème pour synchroniser les éléments
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme');
          updateThemeElements(newTheme);
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Ajouter le listener pour le bouton de thème dans la titlebar (Electron)
    const titlebarThemeToggle = document.getElementById('titlebar-theme-toggle');
    if (titlebarThemeToggle) {
      titlebarThemeToggle.addEventListener('click', toggleTheme);
    }
  });

  // Exposer les fonctions globalement
  window.themeManager = {
    toggle: toggleTheme,
    apply: applyTheme,
    getCurrent: () => document.documentElement.getAttribute('data-theme')
  };

})();

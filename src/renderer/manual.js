// Manuel d'Utilisation TontonKAD v2
// Structure moderne et professionnelle

(function() {
  'use strict';

  // Injection des styles pour les raccourcis clavier
  const style = document.createElement('style');
  style.textContent = `
    .manual-kbd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 10px;
      margin: 16px 0;
    }
    .manual-kbd-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--glass-bg);
      border: 1px solid rgba(255,145,77,0.25);
      border-radius: 8px;
    }
    .manual-kbd-item:hover {
      background: rgba(255,145,77,0.12);
    }
    .manual-kbd-key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: Consolas, monospace;
      font-size: 12px;
      font-weight: 700;
      color: #ff914d;
      padding: 5px 10px;
      background: rgba(255,145,77,0.15);
      border: 1px solid rgba(255,145,77,0.3);
      border-radius: 5px;
      white-space: nowrap;
    }
    .manual-kbd-icon { font-size: 14px; }
    .manual-kbd-action { font-size: 12px; color: var(--text-secondary); }

    /* Mode clair - plus contrasté */
    [data-theme="light"] .manual-kbd-item {
      background: rgba(255,145,77,0.18);
      border-color: rgba(255,145,77,0.5);
    }
    [data-theme="light"] .manual-kbd-key {
      background: rgba(255,145,77,0.35);
      border-color: rgba(255,145,77,0.65);
      color: #111111;
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    const manualContainer = document.getElementById('manual-wrapper');
    if (!manualContainer) {
      console.error('[MANUAL] Container #manual-wrapper not found!');
      return;
    }

    // Contenu structuré du manuel
    const sections = [
      {
        title: '📘 Présentation Générale',
        content: `
          <p>
            <strong>TontonKAD</strong> est une application d'ingénierie assistée par ordinateur (CAO/DAO) spécialisée dans l'organisation de fourreaux et câbles électriques.
          </p>
          <p>
            L'application permet de :
          </p>
          <ul>
            <li>Organiser visuellement des fourreaux et des câbles dans un contenant (tranchée, chemin de câble, fourreau principal)</li>
            <li>Calculer automatiquement le taux d'occupation (essentiel pour les normes électriques)</li>
            <li>Générer des livrables professionnels (Plans PDF, Export DXF)</li>
          </ul>
          <p>
            La version v2 apporte une refonte graphique complète avec le <strong>Thème CEA</strong>, un mode sombre/clair, et une ergonomie fluide avec effet Glassmorphism.
          </p>
        `
      },
      {
        title: '🖥️ Interface Utilisateur',
        content: `
          <p>L'interface est divisée en 3 zones principales :</p>
        `,
        subsections: [
          {
            title: 'A. Le Panneau Latéral (Gauche) - Centre de Contrôle',
            items: [
              'Disposition "Deux zones" : l\'en-tête et la barre de statistiques restent fixes, seule la zone de travail (inventaires) défile — vous gardez toujours les totaux sous les yeux',
              'En-tête compact : Logo, numéro de version, bouton ⓘ (ce manuel) et bouton ⚙️ pour configurer l\'emplacement de la base de données (CSV)',
              'Configuration du Contenant (ligne compacte) : Forme (Rectangulaire, Circulaire, Chemin de câble) qui occupe la moitié de la ligne, puis les Dimensions L / H (ou Ø) avec icône "Cadenas" 🔓 pour verrouiller une dimension. Le bouton "Appliquer" apparaît sous la ligne quand une valeur change',
              'Ajout de Composants sur une seule ligne : Onglets FOURREAU / CÂBLE, recherche intelligente de la référence, réglage de la quantité et bouton "+ Ajouter" alignés côte à côte. L\'icône ⓘ rappelle la règle (le fourreau est un anneau)',
              'Inventaires (zone de travail défilante) : Deux listes côte à côte (Fourreaux et Câbles) qui récapitulent ce qui a été ajouté au projet, avec le bouton ⚡ PLACEMENT AUTO',
              'Barre de Statistiques (fixe, en bas) : quatre tuiles horizontales — Total Fourreaux, Total Câbles, Taux d\'occupation (KPI critique) et Échelle d\'affichage'
            ]
          },
          {
            title: 'B. L\'Espace de Travail (Centre) - Planche à Dessin',
            items: [
              'Canvas : Visualisation en temps réel de la coupe transversale',
              'Lignes de cotation : Affiche les dimensions totales (Largeur/Hauteur) autour du dessin',
              'Navigation : Zoom avec Ctrl + Molette souris, Panoramique avec Clic Molette (ou barre espace + clic gauche)'
            ]
          },
          {
            title: 'C. La Barre d\'Outils (Bas) - Les Actions',
            items: [
              'Édition : Éditer (E), Infos (I), Supprimer, Tout vider',
              'Organisation : Grille (Ctrl+G) pour ranger automatiquement les fourreaux, Figer (G) pour empêcher un objet de bouger',
              'Projet : Gestionnaire de sauvegardes (Sauvegarder/Charger/Créer dossier), Export DXF/PDF pour sortir les plans'
            ]
          }
        ]
      },
      {
        title: '🚀 Guide Pas à Pas',
        content: `<p>Voici le scénario type pour créer un nouveau projet :</p>`,
        steps: [
          '<strong>Définir le contenant</strong> : Choisir la forme (Boîte rectangulaire, Conduit circulaire ou Chemin de câble) et saisir les dimensions (ex: 1000 x 200 mm)',
          '<strong>Ajouter des éléments</strong> : Aller dans l\'onglet FOURREAU ou CÂBLE, chercher une référence dans la liste déroulante (ex: "TPC 63"), puis survoler le canvas et cliquer avec la molette pour déposer l\'objet',
          '<strong>Manipuler et Organiser</strong> : Cliquer gauche pour sélectionner, maintenir et glisser pour déplacer. Utiliser le bouton Grille (Ctrl+G) pour aligner proprement tous les fourreaux',
          '<strong>Édition avancée (Clic Droit)</strong> : Ajouter un libellé/commentaire, changer la couleur (couleurs AutoCAD), définir les phases (L1/L2/L3/N/PE) pour les câbles, remplir automatiquement un fourreau',
          '<strong>Analyser et Exporter</strong> : Vérifier le taux d\'occupation en bas à gauche, sauvegarder le projet (Ctrl+S), puis générer le rapport PDF ou exporter en DXF'
        ]
      },
      {
        title: '⌨️ Raccourcis Clavier',
        shortcuts: [
          { key: 'Molette (clic)', desc: 'Placer un objet', icon: '🖱️' },
          { key: 'Ctrl + Molette', desc: 'Zoom Avant / Arrière', icon: '🖱️' },
          { key: 'E', desc: 'Éditer l\'objet sélectionné', icon: '⌨️' },
          { key: 'I', desc: 'Informations de l\'objet', icon: '⌨️' },
          { key: 'G', desc: 'Figer l\'objet (Ghost/Freeze)', icon: '⌨️' },
          { key: 'Ctrl + G', desc: 'Arranger en Grille (Grid)', icon: '⌨️' },
          { key: 'Suppr', desc: 'Supprimer la sélection', icon: '⌨️' },
          { key: 'Ctrl + S', desc: 'Sauvegarde rapide', icon: '⌨️' },
          { key: 'Ctrl + Z', desc: 'Annuler la dernière action', icon: '⌨️' }
        ]
      },
      {
        title: '💡 Astuces & Fonctionnalités Cachées',
        content: `
          <ul>
            <li><strong>Mode Sombre 🌙</strong> : Un bouton dans la barre de titre permet de basculer l'interface en mode sombre pour moins de fatigue visuelle</li>
            <li><strong>Réduire au minimum</strong> : Le bouton "Réduire au minimum" redimensionne automatiquement le contenant pour coller au plus près des objets placés (optimisation de tranchée)</li>
            <li><strong>Base de Données Personnalisée</strong> : Via le bouton ⚙️ (Settings), vous pouvez pointer vers un dossier réseau contenant vos propres fichiers cables.csv et fourreaux.csv pour que toute l'équipe partage les mêmes références</li>
            <li><strong>Cadenas de dimensions</strong> : Verrouillez une dimension (largeur ou hauteur) pour les redimensionnements automatiques</li>
          </ul>
        `
      }
    ];

    // Génération du HTML
    let html = '';

    sections.forEach(section => {
      html += `<div class="manual-section">`;
      html += `<h2 class="manual-section-title">${section.title}</h2>`;
      html += `<div class="manual-section-content">`;

      if (section.content) {
        html += section.content;
      }

      if (section.subsections) {
        section.subsections.forEach(sub => {
          html += `<div class="manual-subsection">`;
          html += `<div class="manual-subsection-title">${sub.title}</div>`;
          html += `<ul>`;
          sub.items.forEach(item => {
            html += `<li>${item}</li>`;
          });
          html += `</ul></div>`;
        });
      }

      if (section.steps) {
        html += `<ol>`;
        section.steps.forEach(step => {
          html += `<li>${step}</li>`;
        });
        html += `</ol>`;
      }

      if (section.shortcuts) {
        html += `<div class="manual-kbd-grid">`;
        section.shortcuts.forEach(shortcut => {
          const icon = shortcut.icon || '⌨️';
          html += `
            <div class="manual-kbd-item">
              <span class="manual-kbd-key"><span class="manual-kbd-icon">${icon}</span>${shortcut.key}</span>
              <span class="manual-kbd-action">${shortcut.desc}</span>
            </div>
          `;
        });
        html += `</div>`;
      }

      html += `</div></div>`;
    });

    manualContainer.innerHTML = html;
  });
})();

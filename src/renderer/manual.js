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
              'Barre de titre (Electron) : Logo, nom de l\'application et numéro de version à gauche ; boutons ⓘ (ce manuel), ⚙️ (dossier de données CSV), 🔄 (recharger l\'application — demande toujours confirmation, tout objet non sauvegardé du canvas est perdu), 🌙 (thème) et les contrôles de fenêtre à droite',
              'Disposition "Deux zones" : la configuration du contenant reste fixe en haut, tout le reste (ajout d\'objets, inventaires, détails) défile ensemble dans une seule zone de travail — la barre de statistiques, elle, reste fixe en bas',
              'Configuration du Contenant (ligne compacte) : Forme (Rectangulaire, Circulaire, Chemin de câble, Chambre de tirage) qui occupe la moitié de la ligne, puis les Dimensions L / H (ou Ø) avec icône "Cadenas" 🔓 pour verrouiller une dimension. Le bouton "Appliquer" apparaît sous la ligne quand une valeur change',
              'Ajout de Composants sur trois onglets : FOURREAU (recherche + quantité + "+ Ajouter"), CÂBLE (même principe), et 🧠 BIG BRAIN pour générer automatiquement des fourreaux à partir de circuits électriques (voir la section dédiée ci-dessous)',
              'Inventaires (dans la zone de travail) : Deux listes côte à côte (Fourreaux et Câbles) qui récapitulent ce qui a été ajouté au projet, avec le bouton ⚡ PLACEMENT AUTO. S\'il y a déjà un plan en cours, une confirmation demande de Remplacer ou d\'Ajouter au plan existant — rien n\'est jamais effacé sans le demander',
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
        title: '🧠 BIG BRAIN — Génération depuis des liaisons électriques',
        content: `
          <p>
            Plutôt que de placer chaque câble et fourreau à la main, l'onglet <strong>BIG BRAIN</strong> génère automatiquement tout un plan à partir d'une description électrique : vous décrivez vos <strong>liaisons</strong> (circuits), le moteur déplie les câbles (phases, neutre, PE), les répartit dans des fourreaux en respectant le taux d'occupation, puis les place sur le canvas.
          </p>
        `,
        subsections: [
          {
            title: 'Décrire une liaison',
            items: [
              '<strong>+ Nouvelle</strong> crée une liaison ; l\'icône ⧉ la duplique (utile pour plusieurs circuits identiques ou très proches), 🗑 la supprime',
              '<strong>Import Caneco</strong> : importe un carnet de câbles Caneco (.xls/.xlsx) — choisissez le fichier, puis cochez les liaisons à importer dans la liste détectée (les réserves non câblées sont exclues d\'office, une ⚠️ signale une famille ou un code à vérifier manuellement)',
              '<strong>+ Réserve</strong> : ajoute des <strong>fourreaux de réserve vides</strong> (aucun câble) — choisissez juste un type de fourreau et une quantité ; reconnaissables dans la liste par leur contour en pointillés et l\'icône 📦',
              '<strong>Mode Mono</strong> : un câble par conducteur — nombre de phases, section de phase, neutre (oui/non + section), PE (oui/non + section), chacun avec son propre code catalogue',
              '<strong>Mode Multi</strong> : un seul câble multiconducteur (ex. 5G16) qui porte déjà tous les conducteurs',
              '<strong>Parallèle</strong> : nombre de circuits en parallèle. Il multiplie les phases et le neutre, mais jamais le PE — un seul conducteur de protection suffit quel que soit le nombre de circuits en parallèle',
              '<strong>Taille imposée</strong> (optionnelle) : fige le fourreau de cette liaison à un type/diamètre précis du catalogue, plutôt que de laisser le moteur choisir. La liaison est alors scindée sur plusieurs fourreaux de cette même taille si besoin, jamais une autre'
            ]
          },
          {
            title: 'Paramètres de génération',
            items: [
              '<strong>Taux max</strong> : taux d\'occupation maximal autorisé par fourreau (33% par défaut)',
              '<strong>Taille max fourreau</strong> et <strong>Types</strong> (TPC / IRL / ICTA) : bornent le catalogue dans lequel le moteur choisit — ignorés pour une liaison à taille imposée',
              '<strong>Harmonie</strong> : chaque liaison reçoit ses propres fourreaux, jamais partagés avec une autre liaison — deux liaisons identiques obtiennent alors toujours la même taille de fourreau. Sans cette option, le moteur peut regrouper des liaisons différentes dans un même fourreau pour optimiser le nombre total de fourreaux, au prix d\'un résultat parfois moins homogène visuellement'
            ]
          },
          {
            title: 'Générer',
            items: [
              'Le bouton <strong>Générer ▶</strong> calcule le plan puis, s\'il y a déjà des objets sur le canvas, demande de <strong>Remplacer</strong> le plan actuel ou d\'<strong>Ajouter</strong> au plan existant — jamais d\'écrasement silencieux',
              'Un câble qu\'aucun fourreau ne peut accueillir (trop gros, catalogue trop restreint) apparaît dans un message d\'avertissement avec la raison précise plutôt que de disparaître silencieusement',
              'La console de développement (Ctrl+Maj+I) affiche le détail complet de chaque génération (liaisons, câbles, fourreaux, taux) — utile pour comprendre un regroupement inattendu'
            ]
          }
        ]
      },
      {
        title: '⌨️ Raccourcis Clavier',
        shortcuts: [
          { key: 'Molette (clic)', desc: 'Placer un objet', icon: '🖱️' },
          { key: 'Ctrl + Molette', desc: 'Zoom avant / arrière', icon: '🖱️' },
          { key: 'Flèches', desc: 'Déplacer la sélection (canvas focalisé ; Maj = pas fin)', icon: '⌨️' },
          { key: 'Entrée', desc: 'Sélectionner l\'objet suivant (canvas focalisé)', icon: '⌨️' },
          { key: 'E', desc: 'Éditer l\'objet sélectionné', icon: '⌨️' },
          { key: 'I', desc: 'Afficher/masquer les informations', icon: '⌨️' },
          { key: 'D', desc: 'Déplacer un groupe de fourreaux (mode AutoCAD MOVE)', icon: '⌨️' },
          { key: 'X', desc: 'Figer/dégeler la sélection', icon: '⌨️' },
          { key: 'Ctrl + X', desc: 'Figer/dégeler tous les objets', icon: '⌨️' },
          { key: 'G', desc: 'Activer/désactiver la gravité', icon: '⌨️' },
          { key: 'Maj + G', desc: 'Afficher/masquer la grille', icon: '⌨️' },
          { key: 'Ctrl + G', desc: 'Ranger tous les fourreaux en grille', icon: '⌨️' },
          { key: 'F8', desc: 'Mode ORTHO (déplacement horizontal/vertical strict)', icon: '⌨️' },
          { key: 'F3', desc: 'Mode OSNAP (accrochage aux fourreaux fixes)', icon: '⌨️' },
          { key: 'Ctrl + C / Ctrl + V', desc: 'Copier / coller la sélection', icon: '⌨️' },
          { key: 'Suppr', desc: 'Supprimer la sélection', icon: '⌨️' },
          { key: 'Ctrl + Suppr', desc: 'Vider complètement le canvas', icon: '⌨️' },
          { key: 'Échap', desc: 'Annuler le mode en cours (déplacement, collage)', icon: '⌨️' },
          { key: 'Ctrl + S', desc: 'Ouvrir le gestionnaire de projets', icon: '⌨️' },
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

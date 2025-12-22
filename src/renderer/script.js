(function() {
  "use strict";

  /* ====== Constantes & DOM ====== */
  // Mode production - logs désactivés pour optimisation
  const MM_TO_PX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mm-to-px")) || 0.5;
  const VIEWPORT_DEFAULT_W = 900;
  const VIEWPORT_DEFAULT_H = 900;
  const MIN_DISPLAY_SIZE = 260;
  const CIRC_VIEW_MARGIN = 1.1;

  // Physique
  const GRAVITY = 0.25;
  const AIR_DRAG = 0.995;
  const RESTITUTION = 0.25;
  const FRICTION_GROUND = 0.98;
  const MASS_K = 0.02;
  const DYNAMIC_COLLISION_DAMPING = 0.9;
  const PHYSICS_ITERATIONS = 8; // Plus d'itérations = plus de précision, moins de chevauchement

  // Constantes d'affichage
  const CANVAS_MARGIN = 40; // Marge pour les cotations
  const TOTAL_CANVAS_MARGIN = CANVAS_MARGIN * 2; // 80px total
  const DEFAULT_STROKE_WIDTH = -3; // Épaisseur de trait par défaut
  
  // Constantes de grille
  const EXTERNAL_GAP = 30; // Écart extérieur souhaité (3 cm = 30 mm)
  const GRID_MARGIN = 20; // Marge depuis les bords en pixels

  // Zoom et historique
  let currentZoom = 100; // Zoom actuel en pourcentage
  const ZOOM_MIN = 25;
  const ZOOM_MAX = 500;
  const ZOOM_STEP = 10;

  // Système d'annulation (Ctrl+Z)
  let actionHistory = [];
  const MAX_HISTORY = 50;

  // Éléments du DOM
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  
  // Variables pour la haute résolution - Optimisation adaptative
  let basePixelRatio = window.devicePixelRatio || 1;
  let pixelRatio = basePixelRatio;
  let displayScale = 1;

  // Fonctions utilitaires pour les calculs canvas
  function getLogicalCanvasDimensions() {
    return {
      width: canvas.width / pixelRatio,
      height: canvas.height / pixelRatio
    };
  }

  function getCanvasCenter() {
    const { width, height } = getLogicalCanvasDimensions();
    return {
      x: (width - TOTAL_CANVAS_MARGIN) / 2,
      y: (height - TOTAL_CANVAS_MARGIN) / 2
    };
  }

  function getLogicalCanvasSize() {
    const { width, height } = getLogicalCanvasDimensions();
    return {
      width: width - TOTAL_CANVAS_MARGIN,
      height: height - TOTAL_CANVAS_MARGIN
    };
  }
  
  // Configuration canvas haute résolution
  function setupHighResCanvas(logicalWidth, logicalHeight) {
    // Ajouter de l'espace pour les cotes
    const totalWidth = logicalWidth + TOTAL_CANVAS_MARGIN;
    const totalHeight = logicalHeight + TOTAL_CANVAS_MARGIN;

    // Adapter pixelRatio pour les petites boîtes afin d'éviter la pixelisation
    // Pour les boîtes < 500mm, augmenter la résolution pour maintenir une qualité minimale
    const minDimension = Math.min(WORLD_W_MM, WORLD_H_MM);
    if (minDimension < 500) {
      // Augmenter progressivement le pixelRatio pour les petites dimensions
      // À 250mm : 2x, à 100mm : 3x, etc.
      const scaleFactor = Math.min(3, 500 / minDimension);
      pixelRatio = basePixelRatio * scaleFactor;
    } else {
      pixelRatio = basePixelRatio;
    }

    // Taille physique (pixels réels)
    canvas.width = totalWidth * pixelRatio;
    canvas.height = totalHeight * pixelRatio;

    // Taille d'affichage CSS (taille logique)
    canvas.style.width = totalWidth + 'px';
    canvas.style.height = totalHeight + 'px';

    // Réinitialiser et appliquer la transformation pour la haute résolution avec offset
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, CANVAS_MARGIN * pixelRatio, CANVAS_MARGIN * pixelRatio);

    // Activation de l'antialiasing optimisé pour 300 DPI
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Optimisations supplémentaires pour le rendu haute résolution
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  
  // Fonction pour obtenir les épaisseurs de ligne adaptées au zoom et à la résolution 300 DPI
  function getScaledLineWidth(baseWidth) {
    // À 300 DPI, ajuster les épaisseurs pour maintenir un rendu optimal
    return Math.max(0.25, baseWidth * 0.75);
  }
  const canvasWrap = document.querySelector(".canvas-wrap");
  const shapeSel = document.getElementById("shape");
  const shapeDisplayInput = document.getElementById("shapeDisplay");
  const shapeSelectList = document.getElementById("shapeSelectList");
  const shapeSelectContainer = document.getElementById("shapeSelectContainer");
  const rectInputs = document.getElementById("rectInputs");
  const circInputs = document.getElementById("circInputs");
  const boxWInput = document.getElementById("boxW");
  const boxHInput = document.getElementById("boxH");
  const boxDInput = document.getElementById("boxD");
  const applyBtn = document.getElementById("apply");
  const applyCircBtn = document.getElementById("applyCirc");
  const targetPxPerMmInput = document.getElementById("targetPxPerMm");
  const scaleInfo = document.getElementById("scaleInfo");
  const tabFOURREAU = document.getElementById("tabFOURREAU");
  const tabCABLE = document.getElementById("tabCABLE");
  const paneFOURREAU = document.getElementById("paneFOURREAU");
  const paneCABLE = document.getElementById("paneCABLE");
  const listCable = document.getElementById("listCable");
  const listFourreau = document.getElementById("listFourreau");
  const countInvC = document.getElementById("countInvC");
  const countInvF = document.getElementById("countInvF");
  const typesInvC = document.getElementById("typesInvC");
  const typesInvF = document.getElementById("typesInvF");
  const searchCable = document.getElementById("searchCable");
  const searchFourreau = document.getElementById("searchFourreau");
  const toolDelete = document.getElementById("toolDelete");
  const statFourreau = document.getElementById("statFourreau");
  const statCable = document.getElementById("statCable");

  const statOccupation = document.getElementById("statOccupation");
  const selInfo = document.getElementById("selInfo");
  const notificationContainer = document.getElementById("notification-container");
  const freezeBtn = document.getElementById("freezeBtn");
  const panel = document.querySelector(".panel");
  const resizeHandle = document.querySelector(".panel-resize-handle");

  // Inputs pour le chemin de câble (créés dynamiquement)
  let cheminCableInputs, cheminCableSelect;

  /* ====== Données de référence ====== */
/* ====== Données de référence (chargées depuis des fichiers CSV) ====== */
let FOURREAUX = [];
let CABLES = [];
let CHEMINS_CABLE = [];

// Données de fallback intégrées (utilisées si les fichiers CSV ne peuvent pas être chargés)
const FOURREAUX_FALLBACK = [
  {type: "TPC", code: "40", od: 40, id: 30},
  {type: "TPC", code: "50", od: 50, id: 37},
  {type: "TPC", code: "63", od: 63, id: 47},
  {type: "TPC", code: "75", od: 75, id: 56},
  {type: "TPC", code: "90", od: 90, id: 67},
  {type: "TPC", code: "110", od: 110, id: 82},
  {type: "TPC", code: "125", od: 125, id: 94},
  {type: "TPC", code: "160", od: 160, id: 120},
  {type: "TPC", code: "200", od: 200, id: 150},
  {type: "IRL", code: "16", od: 16, id: 13},
  {type: "IRL", code: "20", od: 20, id: 16.9},
  {type: "IRL", code: "25", od: 25, id: 21.4},
  {type: "IRL", code: "32", od: 32, id: 27.8},
  {type: "IRL", code: "40", od: 40, id: 35.4},
  {type: "IRL", code: "50", od: 50, id: 44.3},
  {type: "IRL", code: "63", od: 63, id: 57.3},
  {type: "ICTA", code: "16", od: 16, id: 10.7},
  {type: "ICTA", code: "20", od: 20, id: 14.1},
  {type: "ICTA", code: "25", od: 25, id: 18.3},
  {type: "ICTA", code: "32", od: 32, id: 24.3},
  {type: "ICTA", code: "40", od: 40, id: 31.2},
  {type: "ICTA", code: "50", od: 50, id: 39.6},
  {type: "ICTA", code: "63", od: 63, id: 52.6}
];

const CABLES_FALLBACK = [
  {fam: "U1000 R2V", code: "1x1,5", od: 6.4},
  {fam: "U1000 R2V", code: "1x2,5", od: 6.8},
  {fam: "U1000 R2V", code: "1x4", od: 7.2},
  {fam: "U1000 R2V", code: "1x6", od: 8.2},
  {fam: "U1000 R2V", code: "1x10", od: 9.2},
  {fam: "U1000 R2V", code: "1x16", od: 10.5},
  {fam: "U1000 R2V", code: "1x25", od: 12.5},
  {fam: "U1000 R2V", code: "2x1,5", od: 10.5},
  {fam: "U1000 R2V", code: "2x2,5", od: 11.5},
  {fam: "U1000 R2V", code: "3x1,5", od: 11},
  {fam: "U1000 R2V", code: "3x2,5", od: 12.5},
  {fam: "U1000 R2V", code: "4x1,5", od: 12},
  {fam: "U1000 R2V", code: "4x2,5", od: 13},
  {fam: "U1000 R2V", code: "5x1,5", od: 13},
  {fam: "U1000 R2V", code: "5x2,5", od: 14.5},
  {fam: "H07RN-F", code: "2x1", od: 10},
  {fam: "H07RN-F", code: "2x1.5", od: 11},
  {fam: "H07RN-F", code: "3G1", od: 10.7},
  {fam: "H07RN-F", code: "4G1", od: 12},
  {fam: "H07RN-F", code: "5G1.5", od: 14.4}
];

const CHEMINS_CABLE_FALLBACK = [
  {nom: "Petit 100x50", largeur: 100, hauteur: 50},
  {nom: "Moyen 200x75", largeur: 200, hauteur: 75},
  {nom: "Large 300x100", largeur: 300, hauteur: 100},
  {nom: "Très Large 400x100", largeur: 400, hauteur: 100}
];

  /* ====== État de l'application ====== */
  let nextId = 1;
  const fourreaux = [];
  const cables = [];
  let selected = null;
  let selectedMultiple = []; // Pour la sélection multiple
  let clipboard = null; // Pour stocker l'élément copié
  let pasteMode = false; // Mode collage actif
  let mode = "place";
  let selectedFourreau = null;
  let selectedCable = null;
  // Variables pour la sélection par rectangle (marquee)
  let isMarqueeSelecting = false;
  let marqueeStart = { x: 0, y: 0 };
  let marqueeEnd = { x: 0, y: 0 };

  let activeTab = "FOURREAU";
  let showInfo = true;
  let arrangeInProgress = false; // Flag pour éviter la suppression durant l'arrangement en grille

  // Monde
  let SHAPE = "rect";
  let WORLD_W_MM = 1000;
  let WORLD_H_MM = 1000;
  let WORLD_D_MM = 1000;
  let WORLD_W = 0;
  let WORLD_H = 0;
  let WORLD_R = 0;
  const shapeDropdownOptionEls = new Map();
  let shapeDropdownOpen = false;
  let shapeDropdownEventsBound = false;

  function syncDimensionState() {
    window.SHAPE = SHAPE;
    window.WORLD_W_MM = WORLD_W_MM;
    window.WORLD_H_MM = WORLD_H_MM;
    window.WORLD_D_MM = WORLD_D_MM;
  }

  syncDimensionState();

  /* ====== Chargement des données ====== */
  function parseCSV(text, delimiter = ';') {
    const lines = text.replace(/\r/g, '').trim().split('\n');
    if (lines.length < 2) return []; // Pas assez de données (au moins un en-tête et une ligne)
    const header = lines[0].split(delimiter).map(h => h.trim());
    const numericHeaders = ['od', 'id', 'largeur', 'hauteur'];
    const rows = lines.slice(1).map(line => {
      const values = line.split(delimiter);
      const obj = {};
      header.forEach((key, i) => {
        const value = (values[i] || '').trim();
        // Convertit en nombre les colonnes qui doivent l'être
        if (numericHeaders.includes(key)) {
          obj[key] = parseFloat(value.replace(',', '.')) || 0;
        } else {
          obj[key] = value;
        }
      });
      return obj;
    });
    return rows;
  }

  async function loadData() {
    try {
      let tpcText, cableText, cheminsCableText;

      // Vérifier si on est en mode Electron
      if (window.electronAPI?.isElectron && window.electronAPI.loadCSV) {
        const readElectronCsv = async (filename) => {
          const result = await window.electronAPI.loadCSV(filename);
          if (!result || result.success === false || typeof result.data !== 'string') {
            throw new Error(`Réponse CSV invalide pour ${filename}`);
          }
          return result.data;
        };

        [tpcText, cableText, cheminsCableText] = await Promise.all([
          readElectronCsv('fourreaux.csv'),
          readElectronCsv('cables.csv'),
          readElectronCsv('chemins_de_cable.csv')
        ]);
      } else {
        console.debug('[DATA] Chargement des CSV depuis fetch (mode web)');
        // Mode web - chargement classique
        const [tpcResponse, cableResponse, cheminsCableResponse] = await Promise.all([
          fetch('./data/fourreaux.csv'),
          fetch('./data/cables.csv'),
          fetch('./data/chemins_de_cable.csv')
        ]);

        if (!tpcResponse.ok || !cableResponse.ok || !cheminsCableResponse.ok) {
          let msg = '';
          if (!tpcResponse.ok) msg += `./data/fourreaux.csv: ${tpcResponse.statusText}. `;
          if (!cableResponse.ok) msg += `./data/cables.csv: ${cableResponse.statusText}.`;
          if (!cheminsCableResponse.ok) msg += `./data/chemins_de_cable.csv: ${cheminsCableResponse.statusText}.`;
          throw new Error(`Erreur réseau: ${msg}`);
        }

        tpcText = await tpcResponse.text();
        cableText = await cableResponse.text();
        cheminsCableText = await cheminsCableResponse.text();
      }

      FOURREAUX = parseCSV(tpcText);
      CABLES = parseCSV(cableText);
      CHEMINS_CABLE = parseCSV(cheminsCableText, ',');

      console.debug('[DATA] Données chargées', {
        fourreaux: FOURREAUX.length,
        cables: CABLES.length,
        chemins: CHEMINS_CABLE.length
      });

      if (FOURREAUX.length === 0 || CABLES.length === 0 || CHEMINS_CABLE.length === 0) {
        throw new Error('Les données CSV sont vides ou n\'ont pas pu être analysées.');
      }
      
      // Données CSV chargées avec succès
      
    } catch (error) {
      // Impossible de charger les fichiers CSV externes - utilisation des données intégrées
      console.error('Erreur lors du chargement des CSV:', error);
      console.warn('Utilisation des données de fallback (base limitée)');

      // Utiliser les données de fallback
      FOURREAUX = [...FOURREAUX_FALLBACK];
      CABLES = [...CABLES_FALLBACK];
      CHEMINS_CABLE = [...CHEMINS_CABLE_FALLBACK];

      // Afficher un message d'avertissement à l'utilisateur après initialisation
      setTimeout(() => {
        if (typeof showToast === 'function') {
          showToast('⚠️ Erreur chargement CSV: ' + error.message + ' - Données de secours utilisées', 8000);
        }
      }, 1000);
    }
  }

  /* ====== Sélecteurs & Listes ====== */
  function createSearchableDropdown(config) {
    const { containerId, data, groupBy, optionValue, optionText, placeholder, onSelect } = config;

    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.search-select-input');
    const dropdown = container.querySelector('.search-dropdown');

    input.placeholder = placeholder;

    // Function to render options
    function renderOptions(filter = '') {
        dropdown.innerHTML = '';
        const filterLower = filter.toLowerCase();
        const groupedData = {};

        // Group data
        data.forEach(item => {
            const group = item[groupBy];
            if (!groupedData[group]) {
                groupedData[group] = [];
            }
            groupedData[group].push(item);
        });

        let hasResults = false;
        Object.keys(groupedData).sort().forEach(groupName => {
            const items = groupedData[groupName];
            const filteredItems = items.filter(item => 
                optionText(item).toLowerCase().includes(filterLower) || 
                groupName.toLowerCase().includes(filterLower)
            );

            if (filteredItems.length > 0) {
                hasResults = true;
                const groupEl = document.createElement('div');
                groupEl.className = 'search-dropdown-group';
                
                const labelEl = document.createElement('div');
                labelEl.className = 'search-dropdown-group-label';
                labelEl.textContent = groupName;
                groupEl.appendChild(labelEl);

                filteredItems.forEach(item => {
                    const optionEl = document.createElement('div');
                    optionEl.className = 'search-dropdown-option';
                    optionEl.dataset.value = optionValue(item);
                    optionEl.textContent = optionText(item);

                    optionEl.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        onSelect(optionValue(item), optionText(item));
                        closeDropdown();
                    });
                    groupEl.appendChild(optionEl);
                });
                dropdown.appendChild(groupEl);
            }
        });

        if (!hasResults) {
            dropdown.innerHTML = '<div class="search-no-results">Aucun résultat</div>';
        }
    }

    function openDropdown() {
        renderOptions(input.value);
        dropdown.style.display = 'block';
        container.classList.add('dropdown-open');
    }

    function closeDropdown() {
        dropdown.style.display = 'none';
        container.classList.remove('dropdown-open');
    }

    // Event Listeners
    input.addEventListener('focus', openDropdown);
    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('click', openDropdown);

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeDropdown();
        }
    });

    // Set initial selection
    if (data.length > 0) {
        const firstItem = data[0];
        onSelect(optionValue(firstItem), optionText(firstItem));
    }
}

function initSearchableLists() {
    // Initialiser la liste des fourreaux avec recherche
    const fourreauSearch = document.getElementById('fourreauSearch');
    const fourreauSelect = document.getElementById('fourreauSelect');
    let fourreauOptions = [];

    if (fourreauSelect && fourreauSearch && FOURREAUX) {
        // Créer la liste complète des options avec recherche
        FOURREAUX.forEach(f => {
            fourreauOptions.push({
                value: `${f.type}|${f.code}`,
                text: `${f.type} ${f.code} — Øint ≥ ${f.id} mm`,
                searchText: `${f.type} ${f.code} ${f.id}`.toLowerCase(),
                group: f.type
            });
        });

        // Fonction pour filtrer et afficher les fourreaux
        function filterFourreaux(searchTerm = '') {
            const term = searchTerm.toLowerCase();
            fourreauSelect.innerHTML = '';

            const filteredOptions = fourreauOptions.filter(opt =>
                opt.searchText.includes(term)
            );

            // Grouper les résultats filtrés
            const groups = {};
            filteredOptions.forEach(opt => {
                if (!groups[opt.group]) {
                    groups[opt.group] = [];
                }
                groups[opt.group].push(opt);
            });

            // Créer les groupes
            for (const [groupName, options] of Object.entries(groups)) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'searchable-group';

                const groupLabel = document.createElement('div');
                groupLabel.className = 'searchable-group-label';
                groupLabel.textContent = groupName;
                groupDiv.appendChild(groupLabel);

                options.forEach(opt => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'searchable-option';
                    optionDiv.dataset.value = opt.value;
                    optionDiv.textContent = opt.text;
                    optionDiv.addEventListener('click', function() {
                        selectedFourreau = opt.value;
                        fourreauSearch.value = opt.text;
                        hideFourreauList();
                    });
                    groupDiv.appendChild(optionDiv);
                });

                fourreauSelect.appendChild(groupDiv);
            }
        }

        // Événement de recherche
        fourreauSearch.addEventListener('input', function() {
            filterFourreaux(this.value);
            showFourreauList();
        });

        // Événements de focus/blur pour afficher/masquer la liste
        fourreauSearch.addEventListener('focus', function() {
            // Sélectionner tout le texte pour faciliter le remplacement
            this.select();
            // Afficher tous les fourreaux (filtre vide)
            filterFourreaux('');
            showFourreauList();
        });

        fourreauSearch.addEventListener('blur', function() {
            // Délai pour permettre le clic sur la liste
            setTimeout(() => hideFourreauList(), 150);
        });


        // Fonctions pour afficher/masquer la liste
        function showFourreauList() {
            fourreauSelect.classList.add('show');
            fourreauSearch.setAttribute('aria-expanded', 'true');
        }

        function hideFourreauList() {
            fourreauSelect.classList.remove('show');
            fourreauSearch.setAttribute('aria-expanded', 'false');
        }

        // Initialiser avec tous les fourreaux (mais masqué)
        filterFourreaux();
    }

    // Initialiser la liste des câbles avec recherche
    const cableSearch = document.getElementById('cableSearch');
    const cableSelect = document.getElementById('cableSelect');
    let cableOptions = [];

    if (cableSelect && cableSearch && CABLES) {
        // Créer la liste complète des options avec recherche
        CABLES.forEach(c => {
            cableOptions.push({
                value: `${c.fam}|${c.code}`,
                text: `${c.fam} – ${c.code} (Ø ${c.od} mm)`,
                searchText: `${c.fam} ${c.code} ${c.od}`.toLowerCase(),
                group: c.fam
            });
        });
        console.debug('[DATA] Options de câbles préparées', cableOptions.length);

        // Fonction pour filtrer et afficher les câbles
        function filterCables(searchTerm = '') {
            const term = searchTerm.toLowerCase();
            cableSelect.innerHTML = '';

            const filteredOptions = cableOptions.filter(opt =>
                opt.searchText.includes(term)
            );

            // Grouper les résultats filtrés
            const groups = {};
            filteredOptions.forEach(opt => {
                if (!groups[opt.group]) {
                    groups[opt.group] = [];
                }
                groups[opt.group].push(opt);
            });

            // Créer les groupes
            for (const [groupName, options] of Object.entries(groups)) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'searchable-group';

                const groupLabel = document.createElement('div');
                groupLabel.className = 'searchable-group-label';
                groupLabel.textContent = groupName;
                groupDiv.appendChild(groupLabel);

                options.forEach(opt => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'searchable-option';
                    optionDiv.dataset.value = opt.value;
                    optionDiv.textContent = opt.text;
                    optionDiv.addEventListener('click', function() {
                        selectedCable = opt.value;
                        cableSearch.value = opt.text;
                        hideCableList();
                    });
                    groupDiv.appendChild(optionDiv);
                });

                cableSelect.appendChild(groupDiv);
            }
        }

        // Événement de recherche
        cableSearch.addEventListener('input', function() {
            filterCables(this.value);
            showCableList();
        });

        // Événements de focus/blur pour afficher/masquer la liste
        cableSearch.addEventListener('focus', function() {
            // Sélectionner tout le texte pour faciliter le remplacement
            this.select();
            // Afficher tous les câbles (filtre vide)
            filterCables('');
            showCableList();
        });

        cableSearch.addEventListener('blur', function() {
            // Délai pour permettre le clic sur la liste
            setTimeout(() => hideCableList(), 150);
        });


        // Fonctions pour afficher/masquer la liste
        function showCableList() {
            cableSelect.classList.add('show');
            cableSearch.setAttribute('aria-expanded', 'true');
        }

        function hideCableList() {
            cableSelect.classList.remove('show');
            cableSearch.setAttribute('aria-expanded', 'false');
        }

        // Initialiser avec tous les câbles (mais masqué)
        filterCables();
    }
    if (CHEMINS_CABLE && CHEMINS_CABLE.length > 0 && cheminCableSelect) {
      cheminCableSelect.innerHTML = '';
      CHEMINS_CABLE.forEach(cdc => {
        const option = document.createElement('option');
        option.value = `${cdc.largeur}|${cdc.hauteur}`;
        option.textContent = `${cdc.nom} (${cdc.largeur}x${cdc.hauteur} mm)`;
        cheminCableSelect.appendChild(option);
      });
    }
}
  /* ====== Monde & Canvas ====== */
  function setCanvasSize() {
    if (SHAPE === "rect" || SHAPE === "chemin_de_cable") {
      WORLD_W = WORLD_W_MM * MM_TO_PX;
      WORLD_H = WORLD_H_MM * MM_TO_PX;
      setupHighResCanvas(WORLD_W, WORLD_H);
      canvas.classList.remove("no-frame");
    } else {
      WORLD_R = WORLD_D_MM * MM_TO_PX / 2;
      const pad = Math.max(WORLD_R * CIRC_VIEW_MARGIN, WORLD_R + 8) + 4;
      setupHighResCanvas(2 * pad, 2 * pad);
      canvas.classList.add("no-frame");
    }
    fitCanvas();
    redraw();
  }

  function computedDisplayScale() {
    const { width: w, height: h } = getLogicalCanvasDimensions();
    const maxW = canvasWrap.clientWidth - 16, maxH = canvasWrap.clientHeight - 16;
    const fit = Math.min(maxW / w, maxH / h);
    const def = Math.min(VIEWPORT_DEFAULT_W / w, VIEWPORT_DEFAULT_H / h);
    let s = Math.min(def, fit);
    let tpp = parseFloat(targetPxPerMmInput.value);
    if (!isNaN(tpp) && tpp > 0) s = Math.min(s, tpp / MM_TO_PX);
    const zr = currentZoom / 100;
    // Le zoom appliqué mais toujours limité par la taille du viewport
    let out = Math.min(s * zr, fit * zr);
    // Garder une limite minimale
    out = Math.max(out, MIN_DISPLAY_SIZE / Math.max(w, h));
    return out * .98
  }

  function fitCanvas() {
    displayScale = computedDisplayScale();
    const { width: logicalW, height: logicalH } = getLogicalCanvasDimensions();
    const finalW = logicalW * displayScale;
    const finalH = logicalH * displayScale;
    
    canvas.style.width = finalW + "px";
    canvas.style.height = finalH + "px";
    
    // Toujours garder overflow visible (pas de scroll)
    canvasWrap.style.overflow = "visible";
    
    scaleInfo.textContent = `${(MM_TO_PX * displayScale).toFixed(3)} px/mm (zoom ≈ ${(displayScale * 100).toFixed(0)}%)`;
  }

  /* ====== Couleurs déterministes ====== */
  const COL_CABLE = new Map, COL_FOURREAU = new Map;
  const hashHue = s => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h) % 360;
  };
  const colorForCable = (fam, code) => {
    const k = `CABLE|${fam}|${code}`;
    if (!COL_CABLE.has(k)) COL_CABLE.set(k, `hsl(${hashHue(k)} 72% 52%)`);
    return COL_CABLE.get(k);
  };
  const colorForFourreau = (type, code) => {
    const k = `FOURREAU|${type}|${code}`;
    if (!COL_FOURREAU.has(k)) COL_FOURREAU.set(k, `hsl(${(hashHue(k) + 160) % 360} 68% 56%)`);
    return COL_FOURREAU.get(k);
  };
  
  // Table complète des couleurs AutoCAD (256 couleurs ACI)
  const AUTOCAD_COLORS = [
    {aci:0,hex:'#000000',rgb:[0,0,0]},{aci:1,hex:'#FF0000',rgb:[255,0,0]},{aci:2,hex:'#FFFF00',rgb:[255,255,0]},{aci:3,hex:'#00FF00',rgb:[0,255,0]},
    {aci:4,hex:'#00FFFF',rgb:[0,255,255]},{aci:5,hex:'#0000FF',rgb:[0,0,255]},{aci:6,hex:'#FF00FF',rgb:[255,0,255]},{aci:7,hex:'#FFFFFF',rgb:[255,255,255]},
    {aci:8,hex:'#414141',rgb:[65,65,65]},{aci:9,hex:'#808080',rgb:[128,128,128]},{aci:10,hex:'#FF0000',rgb:[255,0,0]},{aci:11,hex:'#FFAAAA',rgb:[255,170,170]},
    {aci:12,hex:'#BD0000',rgb:[189,0,0]},{aci:13,hex:'#BD7E7E',rgb:[189,126,126]},{aci:14,hex:'#810000',rgb:[129,0,0]},{aci:15,hex:'#815656',rgb:[129,86,86]},
    {aci:16,hex:'#680000',rgb:[104,0,0]},{aci:17,hex:'#684545',rgb:[104,69,69]},{aci:18,hex:'#4F0000',rgb:[79,0,0]},{aci:19,hex:'#4F3535',rgb:[79,53,53]},
    {aci:20,hex:'#FF3F00',rgb:[255,63,0]},{aci:21,hex:'#FFBFAA',rgb:[255,191,170]},{aci:22,hex:'#BD2E00',rgb:[189,46,0]},{aci:23,hex:'#BD8D7E',rgb:[189,141,126]},
    {aci:24,hex:'#811F00',rgb:[129,31,0]},{aci:25,hex:'#816056',rgb:[129,96,86]},{aci:26,hex:'#681900',rgb:[104,25,0]},{aci:27,hex:'#684E45',rgb:[104,78,69]},
    {aci:28,hex:'#4F1300',rgb:[79,19,0]},{aci:29,hex:'#4F3B35',rgb:[79,59,53]},{aci:30,hex:'#FF7F00',rgb:[255,127,0]},{aci:31,hex:'#FFD4AA',rgb:[255,212,170]},
    {aci:32,hex:'#BD5E00',rgb:[189,94,0]},{aci:33,hex:'#BD9D7E',rgb:[189,157,126]},{aci:34,hex:'#814000',rgb:[129,64,0]},{aci:35,hex:'#816B56',rgb:[129,107,86]},
    {aci:36,hex:'#683400',rgb:[104,52,0]},{aci:37,hex:'#685645',rgb:[104,86,69]},{aci:38,hex:'#4F2700',rgb:[79,39,0]},{aci:39,hex:'#4F4235',rgb:[79,66,53]},
    {aci:40,hex:'#FFBF00',rgb:[255,191,0]},{aci:41,hex:'#FFEAAA',rgb:[255,234,170]},{aci:42,hex:'#BD8D00',rgb:[189,141,0]},{aci:43,hex:'#BDAD7E',rgb:[189,173,126]},
    {aci:44,hex:'#816000',rgb:[129,96,0]},{aci:45,hex:'#817656',rgb:[129,118,86]},{aci:46,hex:'#684E00',rgb:[104,78,0]},{aci:47,hex:'#685F45',rgb:[104,95,69]},
    {aci:48,hex:'#4F3B00',rgb:[79,59,0]},{aci:49,hex:'#4F4935',rgb:[79,73,53]},{aci:50,hex:'#FFFF00',rgb:[255,255,0]},{aci:51,hex:'#FFFFAA',rgb:[255,255,170]},
    {aci:52,hex:'#BDBD00',rgb:[189,189,0]},{aci:53,hex:'#BDBD7E',rgb:[189,189,126]},{aci:54,hex:'#818100',rgb:[129,129,0]},{aci:55,hex:'#818156',rgb:[129,129,86]},
    {aci:56,hex:'#686800',rgb:[104,104,0]},{aci:57,hex:'#686845',rgb:[104,104,69]},{aci:58,hex:'#4F4F00',rgb:[79,79,0]},{aci:59,hex:'#4F4F35',rgb:[79,79,53]},
    {aci:60,hex:'#BFFF00',rgb:[191,255,0]},{aci:61,hex:'#EAFFAA',rgb:[234,255,170]},{aci:62,hex:'#8DBD00',rgb:[141,189,0]},{aci:63,hex:'#ADBD7E',rgb:[173,189,126]},
    {aci:64,hex:'#608100',rgb:[96,129,0]},{aci:65,hex:'#768156',rgb:[118,129,86]},{aci:66,hex:'#4E6800',rgb:[78,104,0]},{aci:67,hex:'#5F6845',rgb:[95,104,69]},
    {aci:68,hex:'#3B4F00',rgb:[59,79,0]},{aci:69,hex:'#494F35',rgb:[73,79,53]},{aci:70,hex:'#7FFF00',rgb:[127,255,0]},{aci:71,hex:'#D4FFAA',rgb:[212,255,170]},
    {aci:72,hex:'#5EBD00',rgb:[94,189,0]},{aci:73,hex:'#9DBD7E',rgb:[157,189,126]},{aci:74,hex:'#408100',rgb:[64,129,0]},{aci:75,hex:'#6B8156',rgb:[107,129,86]},
    {aci:76,hex:'#346800',rgb:[52,104,0]},{aci:77,hex:'#566845',rgb:[86,104,69]},{aci:78,hex:'#274F00',rgb:[39,79,0]},{aci:79,hex:'#424F35',rgb:[66,79,53]},
    {aci:80,hex:'#3FFF00',rgb:[63,255,0]},{aci:81,hex:'#BFFFAA',rgb:[191,255,170]},{aci:82,hex:'#2EBD00',rgb:[46,189,0]},{aci:83,hex:'#8DBD7E',rgb:[141,189,126]},
    {aci:84,hex:'#1F8100',rgb:[31,129,0]},{aci:85,hex:'#608156',rgb:[96,129,86]},{aci:86,hex:'#196800',rgb:[25,104,0]},{aci:87,hex:'#4E6845',rgb:[78,104,69]},
    {aci:88,hex:'#134F00',rgb:[19,79,0]},{aci:89,hex:'#3B4F35',rgb:[59,79,53]},{aci:90,hex:'#00FF00',rgb:[0,255,0]},{aci:91,hex:'#AAFFAA',rgb:[170,255,170]},
    {aci:92,hex:'#00BD00',rgb:[0,189,0]},{aci:93,hex:'#7EBD7E',rgb:[126,189,126]},{aci:94,hex:'#008100',rgb:[0,129,0]},{aci:95,hex:'#568156',rgb:[86,129,86]},
    {aci:96,hex:'#006800',rgb:[0,104,0]},{aci:97,hex:'#456845',rgb:[69,104,69]},{aci:98,hex:'#004F00',rgb:[0,79,0]},{aci:99,hex:'#354F35',rgb:[53,79,53]},
    {aci:100,hex:'#00FF3F',rgb:[0,255,63]},{aci:101,hex:'#AAFFBF',rgb:[170,255,191]},{aci:102,hex:'#00BD2E',rgb:[0,189,46]},{aci:103,hex:'#7EBD8D',rgb:[126,189,141]},
    {aci:104,hex:'#00811F',rgb:[0,129,31]},{aci:105,hex:'#568160',rgb:[86,129,96]},{aci:106,hex:'#006819',rgb:[0,104,25]},{aci:107,hex:'#45684E',rgb:[69,104,78]},
    {aci:108,hex:'#004F13',rgb:[0,79,19]},{aci:109,hex:'#354F3B',rgb:[53,79,59]},{aci:110,hex:'#00FF7F',rgb:[0,255,127]},{aci:111,hex:'#AAFFD4',rgb:[170,255,212]},
    {aci:112,hex:'#00BD5E',rgb:[0,189,94]},{aci:113,hex:'#7EBD9D',rgb:[126,189,157]},{aci:114,hex:'#008140',rgb:[0,129,64]},{aci:115,hex:'#56816B',rgb:[86,129,107]},
    {aci:116,hex:'#006834',rgb:[0,104,52]},{aci:117,hex:'#456856',rgb:[69,104,86]},{aci:118,hex:'#004F27',rgb:[0,79,39]},{aci:119,hex:'#354F42',rgb:[53,79,66]},
    {aci:120,hex:'#00FFBF',rgb:[0,255,191]},{aci:121,hex:'#AAFFEA',rgb:[170,255,234]},{aci:122,hex:'#00BD8D',rgb:[0,189,141]},{aci:123,hex:'#7EBDAD',rgb:[126,189,173]},
    {aci:124,hex:'#008160',rgb:[0,129,96]},{aci:125,hex:'#568176',rgb:[86,129,118]},{aci:126,hex:'#00684E',rgb:[0,104,78]},{aci:127,hex:'#45685F',rgb:[69,104,95]},
    {aci:128,hex:'#004F3B',rgb:[0,79,59]},{aci:129,hex:'#354F49',rgb:[53,79,73]},{aci:130,hex:'#00FFFF',rgb:[0,255,255]},{aci:131,hex:'#AAFFFF',rgb:[170,255,255]},
    {aci:132,hex:'#00BDBD',rgb:[0,189,189]},{aci:133,hex:'#7EBDBD',rgb:[126,189,189]},{aci:134,hex:'#008181',rgb:[0,129,129]},{aci:135,hex:'#568181',rgb:[86,129,129]},
    {aci:136,hex:'#006868',rgb:[0,104,104]},{aci:137,hex:'#456868',rgb:[69,104,104]},{aci:138,hex:'#004F4F',rgb:[0,79,79]},{aci:139,hex:'#354F4F',rgb:[53,79,79]},
    {aci:140,hex:'#00BFFF',rgb:[0,191,255]},{aci:141,hex:'#AAEAFF',rgb:[170,234,255]},{aci:142,hex:'#008DBD',rgb:[0,141,189]},{aci:143,hex:'#7EADBD',rgb:[126,173,189]},
    {aci:144,hex:'#006081',rgb:[0,96,129]},{aci:145,hex:'#567681',rgb:[86,118,129]},{aci:146,hex:'#004E68',rgb:[0,78,104]},{aci:147,hex:'#455F68',rgb:[69,95,104]},
    {aci:148,hex:'#003B4F',rgb:[0,59,79]},{aci:149,hex:'#35494F',rgb:[53,73,79]},{aci:150,hex:'#007FFF',rgb:[0,127,255]},{aci:151,hex:'#AAD4FF',rgb:[170,212,255]},
    {aci:152,hex:'#005EBD',rgb:[0,94,189]},{aci:153,hex:'#7E9DBD',rgb:[126,157,189]},{aci:154,hex:'#004081',rgb:[0,64,129]},{aci:155,hex:'#566B81',rgb:[86,107,129]},
    {aci:156,hex:'#003468',rgb:[0,52,104]},{aci:157,hex:'#455668',rgb:[69,86,104]},{aci:158,hex:'#00274F',rgb:[0,39,79]},{aci:159,hex:'#35424F',rgb:[53,66,79]},
    {aci:160,hex:'#003FFF',rgb:[0,63,255]},{aci:161,hex:'#AABFFF',rgb:[170,191,255]},{aci:162,hex:'#002EBD',rgb:[0,46,189]},{aci:163,hex:'#7E8DBD',rgb:[126,141,189]},
    {aci:164,hex:'#001F81',rgb:[0,31,129]},{aci:165,hex:'#566081',rgb:[86,96,129]},{aci:166,hex:'#001968',rgb:[0,25,104]},{aci:167,hex:'#454E68',rgb:[69,78,104]},
    {aci:168,hex:'#00134F',rgb:[0,19,79]},{aci:169,hex:'#353B4F',rgb:[53,59,79]},{aci:170,hex:'#0000FF',rgb:[0,0,255]},{aci:171,hex:'#AAAAFF',rgb:[170,170,255]},
    {aci:172,hex:'#0000BD',rgb:[0,0,189]},{aci:173,hex:'#7E7EBD',rgb:[126,126,189]},{aci:174,hex:'#000081',rgb:[0,0,129]},{aci:175,hex:'#565681',rgb:[86,86,129]},
    {aci:176,hex:'#000068',rgb:[0,0,104]},{aci:177,hex:'#454568',rgb:[69,69,104]},{aci:178,hex:'#00004F',rgb:[0,0,79]},{aci:179,hex:'#35354F',rgb:[53,53,79]},
    {aci:180,hex:'#3F00FF',rgb:[63,0,255]},{aci:181,hex:'#BFAAFF',rgb:[191,170,255]},{aci:182,hex:'#2E00BD',rgb:[46,0,189]},{aci:183,hex:'#8D7EBD',rgb:[141,126,189]},
    {aci:184,hex:'#1F0081',rgb:[31,0,129]},{aci:185,hex:'#605681',rgb:[96,86,129]},{aci:186,hex:'#190068',rgb:[25,0,104]},{aci:187,hex:'#4E4568',rgb:[78,69,104]},
    {aci:188,hex:'#13004F',rgb:[19,0,79]},{aci:189,hex:'#3B354F',rgb:[59,53,79]},{aci:190,hex:'#7F00FF',rgb:[127,0,255]},{aci:191,hex:'#D4AAFF',rgb:[212,170,255]},
    {aci:192,hex:'#5E00BD',rgb:[94,0,189]},{aci:193,hex:'#9D7EBD',rgb:[157,126,189]},{aci:194,hex:'#400081',rgb:[64,0,129]},{aci:195,hex:'#6B5681',rgb:[107,86,129]},
    {aci:196,hex:'#340068',rgb:[52,0,104]},{aci:197,hex:'#564568',rgb:[86,69,104]},{aci:198,hex:'#27004F',rgb:[39,0,79]},{aci:199,hex:'#42354F',rgb:[66,53,79]},
    {aci:200,hex:'#BF00FF',rgb:[191,0,255]},{aci:201,hex:'#EAAAFF',rgb:[234,170,255]},{aci:202,hex:'#8D00BD',rgb:[141,0,189]},{aci:203,hex:'#AD7EBD',rgb:[173,126,189]},
    {aci:204,hex:'#600081',rgb:[96,0,129]},{aci:205,hex:'#765681',rgb:[118,86,129]},{aci:206,hex:'#4E0068',rgb:[78,0,104]},{aci:207,hex:'#5F4568',rgb:[95,69,104]},
    {aci:208,hex:'#3B004F',rgb:[59,0,79]},{aci:209,hex:'#49354F',rgb:[73,53,79]},{aci:210,hex:'#FF00FF',rgb:[255,0,255]},{aci:211,hex:'#FFAAFF',rgb:[255,170,255]},
    {aci:212,hex:'#BD00BD',rgb:[189,0,189]},{aci:213,hex:'#BD7EBD',rgb:[189,126,189]},{aci:214,hex:'#810081',rgb:[129,0,129]},{aci:215,hex:'#815681',rgb:[129,86,129]},
    {aci:216,hex:'#680068',rgb:[104,0,104]},{aci:217,hex:'#684568',rgb:[104,69,104]},{aci:218,hex:'#4F004F',rgb:[79,0,79]},{aci:219,hex:'#4F354F',rgb:[79,53,79]},
    {aci:220,hex:'#FF00BF',rgb:[255,0,191]},{aci:221,hex:'#FFAAEA',rgb:[255,170,234]},{aci:222,hex:'#BD008D',rgb:[189,0,141]},{aci:223,hex:'#BD7EAD',rgb:[189,126,173]},
    {aci:224,hex:'#810060',rgb:[129,0,96]},{aci:225,hex:'#815676',rgb:[129,86,118]},{aci:226,hex:'#68004E',rgb:[104,0,78]},{aci:227,hex:'#68455F',rgb:[104,69,95]},
    {aci:228,hex:'#4F003B',rgb:[79,0,59]},{aci:229,hex:'#4F3549',rgb:[79,53,73]},{aci:230,hex:'#FF007F',rgb:[255,0,127]},{aci:231,hex:'#FFAAD4',rgb:[255,170,212]},
    {aci:232,hex:'#BD005E',rgb:[189,0,94]},{aci:233,hex:'#BD7E9D',rgb:[189,126,157]},{aci:234,hex:'#810040',rgb:[129,0,64]},{aci:235,hex:'#81566B',rgb:[129,86,107]},
    {aci:236,hex:'#680034',rgb:[104,0,52]},{aci:237,hex:'#684556',rgb:[104,69,86]},{aci:238,hex:'#4F0027',rgb:[79,0,39]},{aci:239,hex:'#4F3542',rgb:[79,53,66]},
    {aci:240,hex:'#FF003F',rgb:[255,0,63]},{aci:241,hex:'#FFAABF',rgb:[255,170,191]},{aci:242,hex:'#BD002E',rgb:[189,0,46]},{aci:243,hex:'#BD7E8D',rgb:[189,126,141]},
    {aci:244,hex:'#81001F',rgb:[129,0,31]},{aci:245,hex:'#815660',rgb:[129,86,96]},{aci:246,hex:'#680019',rgb:[104,0,25]},{aci:247,hex:'#68454E',rgb:[104,69,78]},
    {aci:248,hex:'#4F0013',rgb:[79,0,19]},{aci:249,hex:'#4F353B',rgb:[79,53,59]},{aci:250,hex:'#333333',rgb:[51,51,51]},{aci:251,hex:'#505050',rgb:[80,80,80]},
    {aci:252,hex:'#696969',rgb:[105,105,105]},{aci:253,hex:'#828282',rgb:[130,130,130]},{aci:254,hex:'#BEBEBE',rgb:[190,190,190]},{aci:255,hex:'#FFFFFF',rgb:[255,255,255]}
  ];

  // Système centralisé de gestion des couleurs avec phases électriques
  const COLOR_SYSTEM = {
    // Index des couleurs principales par phase
    PHASE_COLORS: {
      'L1': 24,  // Marron - ACI 24
      'L2': 8,   // Gris - ACI 8  
      'L3': 250, // Noir - ACI 250
      'N': 5,    // Bleu - ACI 5
      'PE': 3    // Vert - ACI 3
    },

    // Méthodes utilitaires
    getByACI: (aci) => AUTOCAD_COLORS.find(c => c.aci === aci),
    getByHex: (hex) => AUTOCAD_COLORS.find(c => c.hex.toUpperCase() === hex.toUpperCase()),
    getByPhase: (phase) => {
      const aci = COLOR_SYSTEM.PHASE_COLORS[phase];
      return aci ? COLOR_SYSTEM.getByACI(aci) : null;
    },
    getDxfValue: (hex) => {
      const color = COLOR_SYSTEM.getByHex(hex);
      return color ? color.aci : 7; // Blanc par défaut
    },
    getPhaseFromHex: (hex) => {
      const color = COLOR_SYSTEM.getByHex(hex);
      if (!color) return null;
      // Chercher quelle phase correspond à cet ACI
      for (const [phase, aci] of Object.entries(COLOR_SYSTEM.PHASE_COLORS)) {
        if (aci === color.aci) return phase;
      }
      return null;
    }
  };

  // Couleurs des conducteurs unifilaires (compatibilité)
  const PHASE_COLORS = {
    ph1: COLOR_SYSTEM.getByACI(24).hex, // Marron
    ph2: COLOR_SYSTEM.getByACI(8).hex,  // Gris
    ph3: COLOR_SYSTEM.getByACI(250).hex, // Noir
    n: COLOR_SYSTEM.getByACI(5).hex,    // Bleu
    pe: COLOR_SYSTEM.getByACI(3).hex    // Vert
  };
  
  const withAlpha = (hsl, a) => hsl.includes("/") ? hsl : hsl.replace(")", ` / ${a})`);
  
  // Convertir HSL en format hex pour les inputs color
  const hslToHex = (hslString) => {
    if (hslString.startsWith('#')) return hslString;
    
    // Extraire h, s, l de "hsl(180 72% 52%)" ou "hsl(180, 72%, 52%)"
    const match = hslString.match(/hsl\((\d+)(?:,?\s*)(\d+)%(?:,?\s*)(\d+)%\)/);
    if (!match) return '#ff0000';
    
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  /* ====== Utilitaires ====== */
  const areaCircle = d => { const r = d / 2; return Math.PI * r * r };

  /* ====== Système de zoom ====== */
  function setZoom(newZoom) {
    currentZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    scaleInfo.textContent = `${(MM_TO_PX * displayScale).toFixed(3)} px/mm (zoom ≈ ${currentZoom.toFixed(0)}%)`;
    fitCanvas();
  }

  function zoomIn() {
    setZoom(currentZoom + ZOOM_STEP);
  }

  function zoomOut() {
    setZoom(currentZoom - ZOOM_STEP);
  }

  /* ====== Système d'historique pour Ctrl+Z ====== */
  function saveStateToHistory() {
    const state = {
      fourreaux: fourreaux.map(f => ({...f, children: [...f.children]})),
      cables: cables.map(c => ({...c})),
      timestamp: Date.now()
    };

    actionHistory.push(state);

    // Limiter la taille de l'historique
    if (actionHistory.length > MAX_HISTORY) {
      actionHistory.shift();
    }

  }

  function restorePreviousState() {
    if (actionHistory.length === 0) {
      return false;
    }

    const previousState = actionHistory.pop();

    // Restaurer les fourreaux
    fourreaux.length = 0;
    fourreaux.push(...previousState.fourreaux.map(f => ({...f, children: [...f.children]})));

    // Restaurer les câbles
    cables.length = 0;
    cables.push(...previousState.cables.map(c => ({...c})));

    // Mettre à jour l'affichage
    updateInventory();
    redraw();

    return true;
  }

  function parseSectionFromCode(code) {
    try {
      let sum = 0;
      const cleaned = String(code).replace(/\s/g, '');
      for (const part of cleaned.split('+')) {
        if (!part) continue;
        const m = part.match(/(\d+)x([\d.,]+)/i);
        if (m) {
          const qty = parseInt(m[1], 10), unit = parseFloat(m[2].replace(',', '.'));
          if (!isNaN(qty) && !isNaN(unit)) sum += qty * unit;
        } else {
          const v = parseFloat(part.replace(',', '.'));
          if (!isNaN(v)) sum += v;
        }
      }
      return sum;
    } catch {
      return NaN;
    }
  }

  /* ====== Logique de Placement ====== */
  function isInsideBox(x, y, r) {
    if (SHAPE === "rect") {
      return x - r >= 0 && x + r <= WORLD_W && y - r >= 0 && y + r <= WORLD_H;
    }
    if (SHAPE === "chemin_de_cable") {
      // Pas de limite en haut pour permettre aux objets de déborder
      return x - r >= 0 && x + r <= WORLD_W && y + r <= WORLD_H;
    }
    const { x: cx, y: cy } = getCanvasCenter();
    return Math.hypot(x - cx, y - cy) + r <= WORLD_R;
  }

  function collidesWithFourreau(x, y, r, ignoreId) {
    for (const f of fourreaux) {
      if (ignoreId && f.id === ignoreId) continue;
      const R = f.od * MM_TO_PX / 2;
      if (Math.hypot(x - f.x, y - f.y) < r + R) return true;
    }
    return false;
  }

  function collidesWithCable(x, y, r, ignoreId) {
    for (const c of cables) {
      if (ignoreId && c.id === ignoreId) continue;
      const R = c.od * MM_TO_PX / 2;
      if (Math.hypot(x - c.x, y - c.y) < r + R) return true;
    }
    return false;
  }

  function findFreeSpot(x, y, r, ignoreId) {
    if (isInsideBox(x, y, r) && !collidesWithFourreau(x, y, r, ignoreId) && !collidesWithCable(x, y, r, ignoreId)) return { x, y };
    const { width, height } = getLogicalCanvasDimensions();
    const maxR = Math.max(width, height), step = Math.max(2, r * .25);
    for (let rad = step; rad < maxR; rad += step) {
      const n = Math.ceil(2 * Math.PI * rad / step);
      for (let i = 0; i < n; i++) {
        const a = i / n * 2 * Math.PI, nx = x + rad * Math.cos(a), ny = y + rad * Math.sin(a);
        if (isInsideBox(nx, ny, r) && !collidesWithFourreau(nx, ny, r, ignoreId) && !collidesWithCable(nx, ny, r, ignoreId)) return { x: nx, y: ny }
      }
    }
    return null;
  }

  function fitsInFourreau(cable, fourreau) { return cable.od <= fourreau.idm; }

  function findFourreauUnder(x, y, needOD) {
    return fourreaux.filter(t => {
      const ri = t.idm * MM_TO_PX / 2;
      return Math.hypot(x - t.x, y - t.y) <= ri && (!needOD || needOD <= t.idm)
    }).sort((a, b) => a.idm - b.idm)[0] || null;
  }

  function findFreeSpotInFourreau(x, y, r, fourreau, ignoreId, forcePlace = false) {
    const ri = fourreau.idm * MM_TO_PX / 2;
    const inside = (nx, ny) => Math.hypot(nx - fourreau.x, ny - fourreau.y) <= ri - r;
    const hits = (nx, ny) => {
      for (const cid of fourreau.children) {
        const cab = cables.find(c => c.id === cid);
        if (!cab) continue;
        if (ignoreId && cab.id === ignoreId) continue;
        const R = cab.od * MM_TO_PX / 2;
        if (Math.hypot(nx - cab.x, ny - cab.y) < r + R) return true;
      }
      return false;
    };
    if (inside(x, y) && !hits(x, y)) return { x, y };
    const step = Math.max(2, r * .25);
    const maxRad = forcePlace ? ri * 3 : ri; // Chercher plus loin si forcePlace
    for (let rad = step; rad < maxRad; rad += step) {
      const n = Math.ceil(2 * Math.PI * rad / step);
      for (let i = 0; i < n; i++) {
        const a = i / n * 2 * Math.PI, nx = x + rad * Math.cos(a), ny = y + rad * Math.sin(a);
        if (inside(nx, ny) && !hits(nx, ny)) return { x: nx, y: ny }
      }
    }
    // Si forcePlace et toujours pas de place, placer au centre même si collision
    if (forcePlace && inside(fourreau.x, fourreau.y)) {
      return { x: fourreau.x, y: fourreau.y };
    }
    return null;
  }

  /* ====== Fonctions d'arrangement en grille ====== */
  // Fonction principale d'arrangement - utilise la nouvelle méthode avec fallback
  function arrangeConduitGrid() {
    arrangeConduitGridOptimized();
  }

  // Rendre la fonction accessible globalement
  window.arrangeConduitGrid = arrangeConduitGrid;

  /**
   * Calcule le placement optimal en grille pour un ensemble d'items dans un conteneur.
   * @param {Array<Object>} items - Tableau d'objets avec {id, diameter}.
   * @param {Object} container - Dimensions du conteneur {width, height}.
   * @param {Object} options - Options de placement {margin, gap}.
   * @returns {Object} - Résultat du placement.
   */
  function calculateGridPlacement(items, container, options) {
    const { margin = 0, gap = 0 } = options || {};
    const numItems = items.length;

    if (numItems === 0) {
      return { fits: true, placements: [], grid: { cols: 0, rows: 0 } };
    }

    const sortedItems = [...items].sort((a, b) => b.diameter - a.diameter);

    const availableWidth = container.width - 2 * margin;
    const availableHeight = container.height - 2 * margin;

    const getGridSize = (cols, rows) => {
      if (cols === 0 || rows === 0) return { width: 0, height: 0, grid: [] };

      const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
      let itemIndex = 0;
      for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < cols; c++) {
          if (itemIndex < numItems) {
            grid[r][c] = sortedItems[itemIndex++];
          }
        }
      }

      const colWidths = Array(cols).fill(0);
      for (let c = 0; c < cols; c++) {
        let maxDiameter = 0;
        for (let r = 0; r < rows; r++) {
          if (grid[r][c]) maxDiameter = Math.max(maxDiameter, grid[r][c].diameter);
        }
        if (maxDiameter > 0) colWidths[c] = maxDiameter + gap;
      }

      const rowHeights = Array(rows).fill(0);
      for (let r = 0; r < rows; r++) {
        let maxDiameter = 0;
        for (let c = 0; c < cols; c++) {
          if (grid[r][c]) maxDiameter = Math.max(maxDiameter, grid[r][c].diameter);
        }
        if (maxDiameter > 0) rowHeights[r] = maxDiameter + gap;
      }

      const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
      const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

      return { totalWidth, totalHeight, grid, colWidths, rowHeights };
    };

    let validGrids = [];
    for (let cols = 1; cols <= numItems; cols++) {
      const rows = Math.ceil(numItems / cols);
      const { totalWidth, totalHeight } = getGridSize(cols, rows);
      if (totalWidth <= availableWidth && totalHeight <= availableHeight) {
        validGrids.push({ cols, rows, ratio: cols / rows });
      }
    }

    if (validGrids.length > 0) {
      // Privilégier la grille la plus large
      validGrids.sort((a, b) => b.ratio - a.ratio || b.cols - a.cols);
      const bestGrid = validGrids[0];

      const { totalWidth, totalHeight, grid, colWidths, rowHeights } = getGridSize(bestGrid.cols, bestGrid.rows);

      const startX = (container.width - totalWidth) / 2;
      const startY = (container.height - totalHeight) / 2;

      const placements = [];
      let currentY = startY;
      for (let r = 0; r < bestGrid.rows; r++) {
        let currentX = startX;
        for (let c = 0; c < bestGrid.cols; c++) {
          const item = grid[r][c];
          if (item) {
            placements.push({
              id: item.id,
              x: currentX + colWidths[c] / 2,
              y: currentY + rowHeights[r] / 2,
            });
          }
          currentX += colWidths[c];
        }
        currentY += rowHeights[r];
      }

      return { fits: true, placements, grid: { cols: bestGrid.cols, rows: bestGrid.rows } };
    } else {
      // Aucune grille ne rentre, calculer la taille suggérée
      const aspectRatio = container.width / container.height;
      const cols = Math.ceil(Math.sqrt(numItems * aspectRatio));
      const rows = Math.ceil(numItems / cols);

      const { totalWidth, totalHeight } = getGridSize(cols, rows);

      return {
        fits: false,
        suggestedContainer: {
          width: Math.ceil((totalWidth + 2 * margin) / 10) * 10,
          height: Math.ceil((totalHeight + 2 * margin) / 10) * 10,
        },
        grid: { cols, rows },
      };
    }
  }

  /* ====== Ajout/Suppression d'objets ====== */
  function addFourreauAt(x, y, type, code) {
    const spec = FOURREAUX.find(f => f.type === type && f.code === code);
    if (!spec) return false;
    const ro = spec.od * MM_TO_PX / 2, spot = findFreeSpot(x, y, ro, null);
    if (!spot) return false;
    saveStateToHistory(); // Sauver l'état avant modification
    const obj = { id: nextId++, x: spot.x, y: spot.y, od: spec.od, idm: spec.id, color: colorForFourreau(type, code), customColor: null, label: '', children: [], vx: 0, vy: 0, dragging: false, frozen: false, _px: spot.x, _py: spot.y, type, code };
    fourreaux.push(obj);
    updateStats();
    updateInventory();
    redraw();
    return obj;
  }

  function addCableAt(x, y, fam, code, prefTPC, options = {}) {
    const { silent = false, forcePlace = false } = options;
    const spec = CABLES.find(c => c.fam === fam && c.code === code);
    if (!spec) return null;
    const r = spec.od * MM_TO_PX / 2;
    let container = prefTPC && fitsInFourreau(spec, prefTPC) ? prefTPC : findFourreauUnder(x, y, spec.od);
    if (container && !fitsInFourreau(spec, container)) container = null;
    const spot = container ? findFreeSpotInFourreau(x, y, r, container, null, forcePlace) : findFreeSpot(x, y, r, null);
    if (!spot) return null;
    if (!silent) saveStateToHistory(); // Sauver l'état avant modification (sauf si silent)
    const obj = { id: nextId++, x: spot.x, y: spot.y, od: spec.od, parent: container ? container.id : null, color: colorForCable(fam, code), customColor: null, label: '', fam, code, vx: 0, vy: 0, dragging: false, frozen: false, _px: spot.x, _py: spot.y };
    cables.push(obj);
    if (container) container.children.push(obj.id);

    if (!silent) {
      updateStats();
      updateInventory();
      redraw();
    }

    return obj;
  }



  /* ====== Grille virtuelle adaptative pour multitubulaires (VRD/BTP) ====== */
  function arrangeConduitGridOptimized() {
    if (fourreaux.length === 0) {
      showToast('Aucun fourreau à disposer en grille');
      return;
    }

    arrangeInProgress = true;

    const shape = shapeSel.value;
    if (shape === 'chemin_de_cable') {
      showToast('Grille non supportée pour les chemins de câbles');
      arrangeInProgress = false;
      return;
    }

    const itemsToPlace = fourreaux.map(f => ({ id: f.id, diameter: f.od }));
    const container = {
      width: (shape === 'rect' ? parseFloat(boxWInput.value) : parseFloat(boxDInput.value)),
      height: (shape === 'rect' ? parseFloat(boxHInput.value) : parseFloat(boxDInput.value))
    };
    const options = { margin: 20, gap: 30 }; // 20mm margin, 30mm gap

    const result = calculateGridPlacement(itemsToPlace, container, options);

    if (result.fits) {
      result.placements.forEach(p => {
        const fourreau = fourreaux.find(f => f.id === p.id);
        if (fourreau) {
          fourreau.x = p.x * MM_TO_PX;
          fourreau.y = p.y * MM_TO_PX;
          fourreau.frozen = true;
          fourreau.vx = 0;
          fourreau.vy = 0;
        }
      });

      showToast(`✅ ${fourreaux.length} fourreaux placés en grille ${result.grid.cols}x${result.grid.rows} (Ctrl+X pour dégeler)`);
    } else {
      const { width: newWidth, height: newHeight } = result.suggestedContainer;
      const lockWidth = document.getElementById('lockWidth')?.checked;
      const lockHeight = document.getElementById('lockHeight')?.checked;


      if (lockWidth && lockHeight) {
        showToast(`🔒 Impossible : dimensions verrouillées (${newWidth}×${newHeight}mm requis)`);
        arrangeInProgress = false;
        return;
      }

      const finalWidth = lockWidth ? container.width : newWidth;
      const finalHeight = lockHeight ? container.height : newHeight;

      if (shape === 'rect') {
        if (!lockWidth) boxWInput.value = finalWidth;
        if (!lockHeight) boxHInput.value = finalHeight;
      } else if (shape === 'circ') {
        const newDiameter = Math.max(finalWidth, finalHeight);
        boxDInput.value = newDiameter;
      }

      applyDimensions();
      showToast(`🔧 Redimensionnement à ${finalWidth}x${finalHeight}mm. Relance de l'arrangement...`);

      // Utiliser un timeout pour laisser le DOM se mettre à jour avant de relancer
      setTimeout(() => {
        arrangeConduitGridOptimized();
      }, 100);
      return; // Sortir pour éviter de déverrouiller arrangeInProgress trop tôt
    }

    arrangeInProgress = false;
    updateStats();
    redraw();
  }


  // Cache pour éviter les recalculs inutiles
  let dimensionsCache = { count: -1, result: null };

  // Fonction pour calculer les dimensions minimales nécessaires
  function calculateMinimumDimensions() {
    if (fourreaux.length === 0) return null;

    // Utiliser le cache si le nombre de fourreaux n'a pas changé
    if (dimensionsCache.count === fourreaux.length && dimensionsCache.result) {
      return dimensionsCache.result;
    }

    // === SYNCHRONISATION AVEC arrangeConduitGridOptimized ===
    const MARGIN_MM = 30;  // Espacement entre fourreaux (30mm requis)
    const CONTAINER_MARGIN_MM = 20; // Marge depuis les bords du conteneur

    // Vérifier les verrous
    const lockWidth = document.getElementById('lockWidth')?.checked;
    const lockHeight = document.getElementById('lockHeight')?.checked;
    const currentWidth = SHAPE === 'rect' ? WORLD_W_MM : WORLD_D_MM;
    const currentHeight = SHAPE === 'rect' ? WORLD_H_MM : WORLD_D_MM;

    // Modélisation : Chaque tube représenté par son encombrement carré/rectangulaire
    function getFourreauData(fourreau) {
      const spec = FOURREAUX.find(s => s.type === fourreau.type && s.code === fourreau.code);
      const diameter = spec ? spec.od : 40;
      return {
        fourreau,
        diameter,
        encombrement: diameter + MARGIN_MM, // Encombrement = taille + marge
        width: diameter + MARGIN_MM,
        height: diameter + MARGIN_MM
      };
    }

    // Trier par ordre décroissant de taille (comme Ctrl+G)
    const sortedFourreaux = [...fourreaux]
      .map(getFourreauData)
      .sort((a, b) => b.diameter - a.diameter);

    // Calculer la grille optimale avec la MÊME LOGIQUE que Ctrl+G
    let optimalCols, optimalRows;
    const totalFourreaux = sortedFourreaux.length;
    const availableWidth = currentWidth - 2 * CONTAINER_MARGIN_MM;
    const availableHeight = currentHeight - 2 * CONTAINER_MARGIN_MM;
    const aspectRatio = availableWidth / availableHeight;

    if (lockWidth && lockHeight) {
      // Les deux dimensions verrouillées = pas de redimensionnement possible
      return null;
    } else if (lockHeight) {
      // Hauteur verrouillée : calculer combien de lignes on peut avoir
      const avgEncombrement = sortedFourreaux.reduce((sum, f) => sum + f.height, 0) / totalFourreaux;
      const maxRows = Math.floor(availableHeight / avgEncombrement);
      optimalRows = Math.min(maxRows, totalFourreaux);
      optimalCols = Math.ceil(totalFourreaux / optimalRows);
    } else if (lockWidth) {
      // Largeur verrouillée : calculer combien de colonnes on peut avoir
      const avgEncombrement = sortedFourreaux.reduce((sum, f) => sum + f.width, 0) / totalFourreaux;
      const maxCols = Math.floor(availableWidth / avgEncombrement);
      optimalCols = Math.min(maxCols, totalFourreaux);
      optimalRows = Math.ceil(totalFourreaux / optimalCols);
    } else {
      // MÊME LOGIQUE que Ctrl+G : privilégier horizontal
      optimalCols = Math.ceil(Math.sqrt(totalFourreaux * aspectRatio * 1.5)); // Facteur 1.5 pour favoriser horizontal
      optimalRows = Math.ceil(totalFourreaux / optimalCols);

      // Optimiser pour éviter les lignes avec trop peu de fourreaux
      if (totalFourreaux > 2) {
        const lastRowItems = totalFourreaux % optimalCols;
        if (lastRowItems > 0 && lastRowItems < optimalCols * 0.3) {
          optimalCols = Math.max(1, optimalCols - 1);
          optimalRows = Math.ceil(totalFourreaux / optimalCols);
        }
      }

      // Forcer un minimum horizontal si possible
      if (totalFourreaux >= 4 && optimalRows > optimalCols) {
        optimalCols = Math.ceil(totalFourreaux / 2); // Maximum 2 lignes si possible
        optimalRows = Math.ceil(totalFourreaux / optimalCols);
      }
    }
    
    // === MÊME ALGORITHME DE PLACEMENT que Ctrl+G ===
    const grid = Array(optimalRows).fill(null).map(() => Array(optimalCols).fill(null));
    const rowHeights = new Array(optimalRows).fill(0);
    const colWidths = new Array(optimalCols).fill(0);

    // Placement séquentiel dans la grille (depuis le bas - multitubulaire)
    let fourreauIndex = 0;
    for (let row = optimalRows - 1; row >= 0; row--) {
      for (let col = 0; col < optimalCols && fourreauIndex < totalFourreaux; col++) {
        const item = sortedFourreaux[fourreauIndex];

        // Placer dans la grille virtuelle
        grid[row][col] = item;

        // Ajustement dimensionnel : plus gros tube de la ligne/colonne
        rowHeights[row] = Math.max(rowHeights[row], item.height);
        colWidths[col] = Math.max(colWidths[col], item.width);

        fourreauIndex++;
      }
    }

    // Calculer les dimensions totales (MÊME MÉTHODE que Ctrl+G)
    const totalGridWidth = colWidths.reduce((sum, w) => sum + w, 0);
    const totalGridHeight = rowHeights.reduce((sum, h) => sum + h, 0);

    // Ajouter les marges du conteneur
    const totalWidthMM = totalGridWidth + 2 * CONTAINER_MARGIN_MM;
    const totalHeightMM = totalGridHeight + 2 * CONTAINER_MARGIN_MM;
    
    // Respecter les verrous dans les dimensions finales
    const finalWidth = lockWidth ? currentWidth : Math.ceil(totalWidthMM / 10) * 10;
    const finalHeight = lockHeight ? currentHeight : Math.ceil(totalHeightMM / 10) * 10;

    const result = {
      width: finalWidth,
      height: finalHeight
    };

    // Mettre à jour le cache
    dimensionsCache = { count: fourreaux.length, result };

    return result;
  }

  // Vérifier s'il est possible de redimensionner la boîte
  function checkForPossibleReduction() {
    if (fourreaux.length === 0) {
      hideReduceButton();
      return;
    }

    const minDims = calculateMinimumDimensions();
    if (!minDims) {
      hideReduceButton();
      return;
    }

    const currentWidth = SHAPE === 'rect' ? WORLD_W_MM : WORLD_D_MM;
    const currentHeight = SHAPE === 'rect' ? WORLD_H_MM : WORLD_D_MM;
    
    // Vérifier les verrous
    const lockWidth = document.getElementById('lockWidth')?.checked;
    const lockHeight = document.getElementById('lockHeight')?.checked;
    
    // Si tout est verrouillé, pas de redimensionnement possible
    if (lockWidth && lockHeight) {
      hideReduceButton();
      return;
    }
    
    // Calculer la différence seulement pour les dimensions non verrouillées
    let hasSignificantChange = false;
    
    if (!lockWidth) {
      const widthDiff = Math.abs(currentWidth - minDims.width);
      const widthChange = widthDiff / currentWidth;
      if (widthChange > 0.05) hasSignificantChange = true;
    }
    
    if (!lockHeight) {
      const heightDiff = Math.abs(currentHeight - minDims.height);
      const heightChange = heightDiff / currentHeight;
      if (heightChange > 0.05) hasSignificantChange = true;
    }
    
    if (hasSignificantChange) {
      showReduceButton(minDims);
    } else {
      hideReduceButton();
    }
  }

  function showReduceButton(minDims) {
    const container = document.getElementById('reduceButtonContainer');
    const button = document.getElementById('reduceToMinimum');
    
    if (container && button) {
      const currentWidth = SHAPE === 'rect' ? WORLD_W_MM : WORLD_D_MM;
      const currentHeight = SHAPE === 'rect' ? WORLD_H_MM : WORLD_D_MM;
      
      // Vérifier les verrous
      const lockWidth = document.getElementById('lockWidth')?.checked;
      const lockHeight = document.getElementById('lockHeight')?.checked;
      
      // Ajuster les dimensions proposées selon les verrous
      const proposedWidth = lockWidth ? currentWidth : minDims.width;
      const proposedHeight = lockHeight ? currentHeight : minDims.height;
      
      const needsEnlarge = proposedWidth > currentWidth || proposedHeight > currentHeight;
      const needsReduce = proposedWidth < currentWidth || proposedHeight < currentHeight;
      
      // Créer le texte du bouton en tenant compte des verrous
      let buttonText = '';
      if (lockWidth && lockHeight) {
        buttonText = 'Dimensions verrouillées';
        container.style.display = 'none';
        return;
      } else if (lockWidth) {
        buttonText = `${needsEnlarge ? 'Agrandir hauteur' : needsReduce ? 'Réduire hauteur' : 'Ajuster hauteur'} (${proposedHeight}mm)`;
      } else if (lockHeight) {
        buttonText = `${needsEnlarge ? 'Agrandir largeur' : needsReduce ? 'Réduire largeur' : 'Ajuster largeur'} (${proposedWidth}mm)`;
      } else {
        if (needsEnlarge && !needsReduce) {
          buttonText = `Agrandir (${proposedWidth}×${proposedHeight}mm)`;
        } else if (needsReduce && !needsEnlarge) {
          buttonText = `Réduire (${proposedWidth}×${proposedHeight}mm)`;
        } else {
          buttonText = `Redimensionner (${proposedWidth}×${proposedHeight}mm)`;
        }
      }
      
      button.textContent = buttonText;
      button.setAttribute('data-width', proposedWidth);
      button.setAttribute('data-height', proposedHeight);
      container.style.display = 'block';
    }
  }

  function hideReduceButton() {
    const container = document.getElementById('reduceButtonContainer');
    if (container) {
      container.style.display = 'none';
    }
  }

  function reduceToMinimum() {
    const button = document.getElementById('reduceToMinimum');
    if (!button) return;

    const width = parseFloat(button.getAttribute('data-width'));
    const height = parseFloat(button.getAttribute('data-height'));
    if (isNaN(width) || isNaN(height)) return;

    const lockWidth = document.getElementById('lockWidth')?.checked;
    const lockHeight = document.getElementById('lockHeight')?.checked;
    
    if (SHAPE === 'rect') {
      if (!lockWidth) {
        boxWInput.value = width;
      }
      if (!lockHeight) {
        boxHInput.value = height;
      }
    } else if (SHAPE === 'circ') {
      const diameter = Math.max(width, height);
      boxDInput.value = diameter;
    }
    
    applyDimensions();
    hideReduceButton();
    
    showToast(`Boîte ajustée à ${width} x ${height} mm`);
  }

  // Fonctions de copier-coller
  function copySelected() {
    if (!selected && selectedMultiple.length === 0) {
      showToast('Sélectionnez un élément à copier');
      return;
    }

    // Copie multiple de câbles (nouveau comportement pour Ctrl+C sur plusieurs câbles)
    if (selectedMultiple.length > 0) {
      const firstType = selectedMultiple[0].type;

      if (firstType === 'cable') {
        // Copier plusieurs câbles pour les coller dans un autre fourreau
        const copiedCables = [];
        for (const sel of selectedMultiple) {
          const cable = cables.find(c => c.id === sel.id);
          if (cable) {
            copiedCables.push({
              fam: cable.fam,
              code: cable.code,
              label: cable.label || '',
              customColor: cable.customColor,
              selectedPhase: cable.selectedPhase
            });
          }
        }

        clipboard = {
          type: 'cables', // Nouveau type pour plusieurs câbles
          cables: copiedCables
        };

        showToast(`${copiedCables.length} câbles copiés`);
        return;
      }
    }

    // Copie simple (comportement existant)
    if (selected) {
      if (selected.type === 'fourreau') {
        const fourreau = fourreaux.find(f => f.id === selected.id);
        if (!fourreau) return;

        // Copier le fourreau avec tous ses câbles
        const copiedCables = [];
        for (const cableId of fourreau.children) {
          const cable = cables.find(c => c.id === cableId);
          if (cable) {
            copiedCables.push({
              fam: cable.fam,
              code: cable.code,
              label: cable.label || '',
              customColor: cable.customColor,
              selectedPhase: cable.selectedPhase
            });
          }
        }

        clipboard = {
          type: 'fourreau',
          fourreauType: fourreau.type,
          fourreauCode: fourreau.code,
          label: fourreau.label || '',
          customColor: fourreau.customColor,
          cables: copiedCables
        };

        showToast(`Fourreau copié avec ${copiedCables.length} câbles`);
      } else {
        // Copier un câble simple
        const cable = cables.find(c => c.id === selected.id);
        if (!cable) return;

        clipboard = {
          type: 'cable',
          fam: cable.fam,
          code: cable.code,
          label: cable.label || '',
          customColor: cable.customColor,
          selectedPhase: cable.selectedPhase
        };

        showToast('Câble copié');
      }
    }
  }

  function pasteAtPosition(x, y) {
    if (!clipboard) {
      showToast('Rien dans le presse-papiers');
      return;
    }

    if (clipboard.type === 'cables') {
      // Coller plusieurs câbles dans le fourreau sous le curseur
      const targetFourreau = findFourreauUnder(x, y, null);
      if (!targetFourreau) {
        showToast('Sélectionnez un fourreau pour y coller les câbles');
        return;
      }

      let pastedCables = 0;
      for (const cableData of clipboard.cables) {
        const newCable = addCableAt(x, y, cableData.fam, cableData.code, targetFourreau);
        if (newCable) {
          newCable.label = cableData.label;
          newCable.customColor = cableData.customColor;
          newCable.selectedPhase = cableData.selectedPhase;
          pastedCables++;
        }
      }

      if (pastedCables > 0) {
        showToast(`${pastedCables} câbles collés dans le fourreau`);
        redraw();
        updateStats();
        updateInventory();
      } else {
        showToast('Impossible de coller les câbles dans ce fourreau');
      }
      return;
    }

    if (clipboard.type === 'fourreau') {
      // Créer le nouveau fourreau
      const newFourreau = addFourreauAt(x, y, clipboard.fourreauType, clipboard.fourreauCode);
      if (!newFourreau) {
        showToast('Impossible de coller le fourreau ici');
        return;
      }

      // Appliquer les propriétés copiées
      newFourreau.label = clipboard.label;
      newFourreau.customColor = clipboard.customColor;

      // Ajouter les câbles copiés dans le fourreau
      let pastedCables = 0;
      for (const cableData of clipboard.cables) {
        const newCable = addCableAt(x, y, cableData.fam, cableData.code, newFourreau);
        if (newCable) {
          newCable.label = cableData.label;
          newCable.customColor = cableData.customColor;
          newCable.selectedPhase = cableData.selectedPhase;
          pastedCables++;
        }
      }

      showToast(`Fourreau collé avec ${pastedCables} câbles`);
      redraw();
      updateStats();
      updateInventory();
    } else if (clipboard.type === 'cable') {
      // Coller un câble simple
      const newCable = addCableAt(x, y, clipboard.fam, clipboard.code);
      if (!newCable) {
        showToast('Impossible de coller le câble ici');
        return;
      }

      // Appliquer les propriétés copiées
      newCable.label = clipboard.label;
      newCable.customColor = clipboard.customColor;
      newCable.selectedPhase = clipboard.selectedPhase;

      showToast('Câble collé');
      redraw();
      updateStats();
      updateInventory();
    }
  }

  // Nouvelle fonction pour coller des câbles dans un fourreau sélectionné
  function pasteCablesIntoSelectedFourreau() {
    if (!clipboard || clipboard.type !== 'cables') {
      showToast('Copiez d\'abord des câbles avec Ctrl+C');
      return;
    }

    if (!selected || selected.type !== 'fourreau') {
      showToast('Sélectionnez un fourreau pour y coller les câbles');
      return;
    }

    const targetFourreau = fourreaux.find(f => f.id === selected.id);
    if (!targetFourreau) return;

    let pastedCables = 0;
    for (const cableData of clipboard.cables) {
      const newCable = addCableAt(targetFourreau.x, targetFourreau.y, cableData.fam, cableData.code, targetFourreau);
      if (newCable) {
        newCable.label = cableData.label;
        newCable.customColor = cableData.customColor;
        newCable.selectedPhase = cableData.selectedPhase;
        pastedCables++;
      }
    }

    if (pastedCables > 0) {
      showToast(`${pastedCables} câbles collés dans le fourreau`);
      redraw();
      updateStats();
      updateInventory();
    } else {
      showToast('Impossible de coller les câbles dans ce fourreau');
    }
  }

  function activatePasteMode() {
    if (!clipboard) {
      showToast('Rien à coller - copiez d\'abord un élément (Ctrl+C)');
      return;
    }
    
    pasteMode = true;
    canvas.style.cursor = 'crosshair';
    const type = clipboard.type === 'fourreau' ? 'fourreau' : 'câble';
    showToast(`Mode collage actif - cliquez pour coller le ${type}`);
  }

  function deactivatePasteMode() {
    pasteMode = false;
    canvas.style.cursor = 'default';
  }

  function deleteSelected() {
    if (!selected && selectedMultiple.length === 0) return;
    saveStateToHistory(); // Sauver l'état avant suppression
    let deletedCount = 0;

    // Fonction pour supprimer un élément
    const deleteObject = (sel) => {
      if (sel.type === 'fourreau') {
        const i = fourreaux.findIndex(o => o.id === sel.id);
        if (i >= 0) {
          for (const cid of fourreaux[i].children) {
            const j = cables.findIndex(k => k.id === cid);
            if (j >= 0) cables.splice(j, 1);
          }
          fourreaux.splice(i, 1);
          deletedCount++;
        }
      } else {
        const i = cables.findIndex(o => o.id === sel.id);
        if (i >= 0) {
          const p = cables[i].parent;
          if (p) {
            const t = fourreaux.find(o => o.id === p);
            if (t) t.children = t.children.filter(id => id !== cables[i].id);
          }
          cables.splice(i, 1);
          deletedCount++;
        }
      }
    };
    
    // Supprimer la sélection multiple ou simple
    if (selectedMultiple.length > 0) {
      selectedMultiple.forEach(deleteObject);
      selectedMultiple = [];
      showToast(`${deletedCount} éléments supprimés`);
    } else if (selected) {
      deleteObject(selected);
      selected = null;
      if (deletedCount > 0) {
        showToast('Élément supprimé');
      }
    }
    
    updateStats();
    updateInventory();
    updateSelectedInfo();
    redraw();
  }

  /* ====== Dessin sur le Canvas ====== */
  function clear() { 
    const { width: w, height: h } = getLogicalCanvasDimensions();
    // Clear avec une zone plus large pour inclure les cotes
    ctx.clearRect(-CANVAS_MARGIN, -CANVAS_MARGIN, w + TOTAL_CANVAS_MARGIN, h + TOTAL_CANVAS_MARGIN); 
  }

  function drawBox() {
    ctx.save();
    ctx.lineWidth = getScaledLineWidth(2);
    ctx.strokeStyle = "#475569";
    if (SHAPE === "rect") {
      // Polyligne fermée pour le rectangle
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(WORLD_W, 0);
      ctx.lineTo(WORLD_W, WORLD_H);
      ctx.lineTo(0, WORLD_H);
      ctx.closePath();
      ctx.stroke();
    } else if (SHAPE === "chemin_de_cable") {
      // Polyligne ouverte en U pour le chemin de câble
      ctx.beginPath();
      ctx.moveTo(WORLD_W, 0); // Haut-droite (point de départ)
      ctx.lineTo(WORLD_W, WORLD_H); // Mur droit
      ctx.lineTo(0, WORLD_H); // Sol
      ctx.lineTo(0, 0); // Mur gauche
      ctx.stroke();
    } else {
      // Cercle pour le conduit circulaire
      ctx.beginPath();
      const { x: cx, y: cy } = getCanvasCenter();
      ctx.arc(cx, cy, WORLD_R, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFourreau(f, numero) {
    // Assurer que l'objet a les nouvelles propriétés
    if (f.customColor === undefined) f.customColor = null;
    if (f.label === undefined) f.label = '';

    const ro = f.od * MM_TO_PX / 2, ri = f.idm * MM_TO_PX / 2;
    ctx.save();
    const col = f.customColor || f.color || colorForFourreau(f.type, f.code);
    ctx.fillStyle = withAlpha(col, .15);
    ctx.strokeStyle = col;
    ctx.lineWidth = getScaledLineWidth(2);

    // Coordonnées entières pour éviter le flou
    const x = Math.round(f.x), y = Math.round(f.y);

    ctx.beginPath();
    ctx.arc(x, y, ro, 0, 2 * Math.PI);
    ctx.arc(x, y, ri, 0, 2 * Math.PI, true);
    ctx.fill("evenodd");
    ctx.stroke();

    // Afficher le numéro du fourreau en haut du cercle (toujours visible)
    if (numero !== undefined) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = getScaledLineWidth(3);
      ctx.font = `bold ${getScaledLineWidth(14)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      // Positionner au-dessus du cercle
      ctx.strokeText(String(numero), x, y - ro - getScaledLineWidth(5));
      ctx.fillText(String(numero), x, y - ro - getScaledLineWidth(5));
    }

    // Afficher le libellé si présent et si showInfo est activé
    if (showInfo && f.label && f.label.trim()) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = getScaledLineWidth(2);
      ctx.font = `bold ${getScaledLineWidth(12)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      // Contour noir pour meilleure lisibilité
      ctx.strokeText(f.label, x, y + ro + getScaledLineWidth(18));
      ctx.fillText(f.label, x, y + ro + getScaledLineWidth(18));
    }

    ctx.restore();
  }

  function drawCable(c) {
    // Assurer que l'objet a les nouvelles propriétés
    if (c.customColor === undefined) c.customColor = null;
    if (c.label === undefined) c.label = '';
    
    const r = c.od * MM_TO_PX / 2;
    ctx.save();
    ctx.fillStyle = c.customColor || c.color;
    ctx.strokeStyle = "#0b0f14";
    ctx.lineWidth = getScaledLineWidth(1.5);
    
    // Coordonnées entières pour éviter le flou
    const x = Math.round(c.x), y = Math.round(c.y);
    
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    
    // Afficher la phase au centre si couleur custom
    if (c.customColor) {
      const phaseText = getPhaseFromColor(c.customColor);
      if (phaseText) {
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = getScaledLineWidth(3);
        const fontSize = Math.max(10, Math.min(r * 0.6, getScaledLineWidth(12))); // Taille adaptée au rayon
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Contour noir épais pour meilleure lisibilité
        ctx.strokeText(phaseText, x, y);
        ctx.fillText(phaseText, x, y);
      }
    }
    
    // Afficher le libellé si présent et si showInfo est activé
    if (showInfo && c.label && c.label.trim()) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = getScaledLineWidth(1.5);
      ctx.font = `bold ${getScaledLineWidth(10)}px Arial`;
      ctx.textAlign = "center";
      // Contour noir pour meilleure lisibilité
      ctx.strokeText(c.label, x, y + r + getScaledLineWidth(15));
      ctx.fillText(c.label, x, y + r + getScaledLineWidth(15));
    }
    
    ctx.restore();
  }

  function drawSelection() {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = getScaledLineWidth(2);
    
    // Dessiner la sélection simple
    if (selected) {
      ctx.strokeStyle = "#fbbf24";
      if (selected.type === "fourreau") {
        const f = fourreaux.find(o => o.id === selected.id);
        if (f) {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.od * MM_TO_PX / 2 + 4, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        const c = cables.find(o => o.id === selected.id);
        if (c) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.od * MM_TO_PX / 2 + 4, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
    }
    
    // Dessiner la sélection multiple
    if (selectedMultiple.length > 0) {
      ctx.strokeStyle = "#10b981"; // Vert pour la sélection multiple
      selectedMultiple.forEach(sel => {
        if (sel.type === "fourreau") {
          const f = fourreaux.find(o => o.id === sel.id);
          if (f) {
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.od * MM_TO_PX / 2 + 4, 0, 2 * Math.PI);
            ctx.stroke();
          }
        } else {
          const c = cables.find(o => o.id === sel.id);
          if (c) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.od * MM_TO_PX / 2 + 4, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      });
    }
    
    ctx.restore();
  }

  // Fonction pour dessiner le rectangle de sélection (marquee)
  function drawMarquee() {
    if (!isMarqueeSelecting) return;

    ctx.save();
    ctx.strokeStyle = "#fbbf24"; // Jaune pour la visibilité
    ctx.lineWidth = getScaledLineWidth(1.5);
    ctx.setLineDash([4, 2]);
    ctx.fillStyle = "rgba(251, 191, 36, 0.1)"; // Remplissage semi-transparent

    const x = Math.min(marqueeStart.x, marqueeEnd.x);
    const y = Math.min(marqueeStart.y, marqueeEnd.y);
    const width = Math.abs(marqueeStart.x - marqueeEnd.x);
    const height = Math.abs(marqueeStart.y - marqueeEnd.y);

    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }


  // Fonction pour gérer la sélection multiple
  function handleMultipleSelection(pick) {
    const existingIndex = selectedMultiple.findIndex(sel => sel.type === pick.type && sel.id === pick.id);
    
    if (existingIndex >= 0) {
      // Déjà sélectionné -> le désélectionner
      selectedMultiple.splice(existingIndex, 1);
    } else {
      // Vérifier si on peut l'ajouter
      if (selectedMultiple.length === 0) {
        // Premier Ctrl+Clic : inclure la sélection simple si elle existe et est du même type
        if (selected && selected.type === pick.type) {
          // Ajouter d'abord l'élément sélectionné simple
          selectedMultiple.push(selected);
          selected = null; // Plus de sélection simple
        }
        // Ajouter le nouvel élément
        selectedMultiple.push(pick);
      } else {
        // Vérifier le type avec les éléments déjà sélectionnés
        const firstType = selectedMultiple[0].type;
        if (pick.type === firstType) {
          selectedMultiple.push(pick);
        } else {
          showToast(`Sélectionnez uniquement des ${firstType === 'fourreau' ? 'fourreaux' : 'câbles'}`);
        }
      }
    }
  }

  // Fonction pour dessiner une flèche
  function drawArrow(x1, y1, x2, y2, size = 8) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowX = x2 - size * Math.cos(angle - Math.PI / 6);
    const arrowY = y2 - size * Math.sin(angle - Math.PI / 6);
    const arrowX2 = x2 - size * Math.cos(angle + Math.PI / 6);
    const arrowY2 = y2 - size * Math.sin(angle + Math.PI / 6);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Pointe de la flèche
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(arrowX, arrowY);
    ctx.moveTo(x2, y2);
    ctx.lineTo(arrowX2, arrowY2);
    ctx.stroke();
  }

  // Fonction pour dessiner les cotes
  function drawDimensions() {
    if (SHAPE !== "rect" && SHAPE !== "chemin_de_cable") return;

    // Détecter le thème actuel
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const dimensionColor = isDarkMode ? "#ffffff" : "#000000";
    const bgColor = isDarkMode ? "rgba(64, 64, 64, 0.8)" : "rgba(255, 255, 255, 0.9)";

    ctx.save();
    ctx.strokeStyle = dimensionColor;
    ctx.fillStyle = dimensionColor;
    ctx.lineWidth = 1.5;
    ctx.font = "14px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const offset = 5; // Distance des cotes par rapport à la boîte
    
    // Cote horizontale (largeur) - en dessous
    const y_dim = WORLD_H + offset;
    drawArrow(0, y_dim, WORLD_W, y_dim, 6);
    drawArrow(WORLD_W, y_dim, 0, y_dim, 6);
    
    // Lignes d'attache verticales
    ctx.beginPath();
    ctx.moveTo(0, WORLD_H + 10);
    ctx.lineTo(0, WORLD_H + offset + 10);
    ctx.moveTo(WORLD_W, WORLD_H + 10);
    ctx.lineTo(WORLD_W, WORLD_H + offset + 10);
    ctx.stroke();
    
    // Texte largeur avec fond
    const textW = `${WORLD_W_MM.toFixed(0)} mm`;
    const metricsW = ctx.measureText(textW);
    const bgWidthW = metricsW.width + 8;
    const bgHeightW = 18;

    // Fond semi-transparent
    ctx.fillStyle = bgColor;
    ctx.fillRect(WORLD_W / 2 - bgWidthW/2, y_dim + 20 - bgHeightW/2, bgWidthW, bgHeightW);

    // Texte
    ctx.fillStyle = dimensionColor;
    ctx.fillText(textW, WORLD_W / 2, y_dim + 20);
    
    // Cote verticale (hauteur) - à gauche
    const x_dim = -offset;
    drawArrow(x_dim, 0, x_dim, WORLD_H, 6);
    drawArrow(x_dim, WORLD_H, x_dim, 0, 6);
    
    // Lignes d'attache horizontales
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-offset - 10, 0);
    ctx.moveTo(-10, WORLD_H);
    ctx.lineTo(-offset - 10, WORLD_H);
    ctx.stroke();
    
    // Texte hauteur (rotated) avec fond
    const textH = `${WORLD_H_MM.toFixed(0)} mm`;
    const metricsH = ctx.measureText(textH);
    const bgWidthH = metricsH.width + 8;
    const bgHeightH = 18;

    ctx.save();
    ctx.translate(x_dim - 20, WORLD_H / 2);
    ctx.rotate(-Math.PI / 2);

    // Fond semi-transparent
    ctx.fillStyle = bgColor;
    ctx.fillRect(-bgWidthH/2, -bgHeightH/2, bgWidthH, bgHeightH);

    // Texte
    ctx.fillStyle = dimensionColor;
    ctx.fillText(textH, 0, 0);
    ctx.restore();
    
    ctx.restore();
  }

  function redraw() {
    // S'assurer que l'antialiasing et les optimisations sont activés à chaque frame
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    clear();
    drawBox();
    drawDimensions();
    drawMarquee(); // Dessiner le rectangle de sélection s'il est actif
    for (let i = 0; i < fourreaux.length; i++) {
      drawFourreau(fourreaux[i], i + 1); // Passer le numéro (index + 1)
    }
    for (const c of cables) drawCable(c);
    drawSelection();
  }

  /* ====== Export DXF ====== */
  // Fonction pour convertir une couleur hex en couleur DXF standard
  function convertHexToDXFColor(hexColor) {
    return COLOR_SYSTEM.getDxfValue(hexColor);
  }

  // Fonction pour déterminer la phase selon la couleur
  function getPhaseFromColor(hexColor) {
    return COLOR_SYSTEM.getPhaseFromHex(hexColor);
  }

  // Fonction pour générer le nom de calque logique pour un câble
  function generateCableLayerName(cable) {
    // Nettoyer le nom de famille et code pour AutoCAD
    const cleanFam = cable.fam.replace(/[\s\/\-\.\,\(\)]/g, '_');
    const cleanCode = cable.code.replace(/[\s\/\-\.\,\(\)]/g, '_');
    
    // Déterminer la phase
    let phase = 'STANDARD';
    if (cable.customColor) {
      const phaseFromColor = getPhaseFromColor(cable.customColor);
      if (phaseFromColor) {
        phase = phaseFromColor;
      } else if (cable.selectedPhase && cable.selectedPhase !== 'none') {
        // Mapper les phases internes vers les noms de calques
        const phaseMap = { 'ph1': 'L1', 'ph2': 'L2', 'ph3': 'L3', 'n': 'N', 'pe': 'PE' };
        phase = phaseMap[cable.selectedPhase] || 'CUSTOM';
      } else {
        phase = 'CUSTOM';
      }
    }
    
    return `_CEAI_CABLE_${cleanFam}_${cleanCode}_${phase}`;
  }

  // R12 : noms de calques/blocs limités à 31 caractères
  const R12_NAME_MAX = 31;
  function safeName(name) {
    return typeof name === 'string' && name.length > R12_NAME_MAX
      ? name.slice(0, R12_NAME_MAX)
      : name;
  }

  function generateDXF(acadVer = 'AC1009') {
    // Filtrer les entités pour éviter toute coordonnée ou diamètre invalide
    const fourreauxValid = fourreaux.filter(f =>
      Number.isFinite(f.x) && Number.isFinite(f.y) &&
      Number.isFinite(f.od) && f.od > 0 &&
      Number.isFinite(f.idm) && f.idm >= 0
    );
    const cablesValid = cables.filter(c =>
      Number.isFinite(c.x) && Number.isFinite(c.y) &&
      Number.isFinite(c.od) && c.od > 0
    );

    // Couleurs/calques pour fourreaux
    const fourreauTypes = [...new Set(fourreauxValid.map(f => `${f.type}_${f.code}`))];
    const fourreauColorMap = new Map();
    const fourreauLayerNameMap = new Map(); // type -> safe layer name
    fourreauTypes.forEach((type, index) => {
      const custom = fourreauxValid.find(f => `${f.type}_${f.code}` === type && f.customColor);
      const color = custom && custom.customColor
        ? convertHexToDXFColor(custom.customColor)
        : (index % 7) + 2; // couleurs 2-8
      fourreauColorMap.set(type, color);
      fourreauLayerNameMap.set(type, safeName(`_CEAI_FOURREAU_${type}`));
    });

    // Couleurs/calques pour câbles
    const cableLayerTypes = new Set();
    const layerColorMap = new Map();
    const layerNameMap = new Map(); // raw -> safe
    cablesValid.forEach((c, index) => {
      const rawLayerName = generateCableLayerName(c);
      const layerName = safeName(rawLayerName);
      cableLayerTypes.add(layerName);
      layerNameMap.set(rawLayerName, layerName);
      if (!layerColorMap.has(layerName)) {
        let color = (index % 6) + 10;
        if (c.customColor) {
          color = convertHexToDXFColor(c.customColor);
        } else {
          const phase = layerName.split('_').pop();
          const phaseColor = COLOR_SYSTEM.getByPhase(phase);
          if (phaseColor) color = phaseColor.dxf;
        }
        layerColorMap.set(layerName, color);
      }
    });

    // Liste des calques à déclarer
    const layers = [
      { name: '0', color: 7 }, // layer 0 requis
      { name: '_CEAI_BOITE', color: 1 }, // rouge
      { name: '_CEAI_COTES', color: 1 },
      ...fourreauTypes.map(type => ({ name: fourreauLayerNameMap.get(type), color: fourreauColorMap.get(type) })),
      ...Array.from(cableLayerTypes).map(name => ({ name, color: layerColorMap.get(name) })),
      { name: '_CEAI_INVENTAIRE', color: 7 }
    ];

    let dxf = '';

    // HEADER minimal (par défaut R12 AC1009, peut être AC1024 pour AutoCAD 2010+)
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += `9\n$ACADVER\n1\n${acadVer}\n`;
    dxf += '9\n$INSUNITS\n70\n6\n'; // mètres

    // Variables supplémentaires pour versions modernes
    if (acadVer !== 'AC1009') {
      dxf += '9\n$HANDSEED\n5\nFFFF\n'; // Handle seed (requis pour R2000+)
      dxf += '9\n$ACADMAINTVER\n70\n6\n'; // Maintenance version
    }

    // Style de texte pour les cotes et hauteur par défaut
    dxf += '9\n$DIMTXSTY\n7\nARIAL\n';
    dxf += '9\n$DIMTXT\n40\n0.1\n';
    dxf += '0\nENDSEC\n';

    // TABLES : LTYPE + LAYER + STYLE (+ VPORT si AC1032)
    dxf += '0\nSECTION\n2\nTABLES\n';
    if (acadVer !== 'AC1009') {
      dxf += '0\nTABLE\n2\nVPORT\n70\n1\n';
      dxf += '0\nVPORT\n2\n*ACTIVE\n70\n0\n10\n0.0\n20\n0.0\n11\n1.0\n21\n1.0\n12\n0.0\n22\n0.0\n13\n1.0\n23\n1.0\n40\n1.0\n41\n1.0\n42\n50.0\n43\n0.0\n44\n0.0\n50\n0.0\n51\n0.0\n71\n0\n72\n1000\n73\n1\n74\n3\n75\n0\n76\n0\n77\n0\n78\n0\n';
      dxf += '0\nENDTAB\n';
    }
    dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    dxf += '0\nENDTAB\n';
    dxf += `0\nTABLE\n2\nLAYER\n70\n${layers.length}\n`;
    layers.forEach(l => {
      dxf += '0\nLAYER\n70\n0\n';
      dxf += `2\n${l.name}\n62\n${l.color ?? 7}\n6\nCONTINUOUS\n`;
    });
    dxf += '0\nENDTAB\n';
    dxf += '0\nTABLE\n2\nSTYLE\n70\n1\n';
    dxf += '0\nSTYLE\n2\nARIAL\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n0.0\n3\narial.ttf\n4\n\n';
    dxf += '0\nENDTAB\n';
    if (acadVer !== 'AC1009') {
      // Table DIMSTYLE pour versions modernes (requis par AutoCAD 2000+)
      dxf += '0\nTABLE\n2\nDIMSTYLE\n70\n1\n';
      dxf += '0\nDIMSTYLE\n2\nSTANDARD\n70\n0\n';
      dxf += '0\nENDTAB\n';
    }
    if (acadVer !== 'AC1009') {
      dxf += '0\nTABLE\n2\nAPPID\n70\n1\n';
      dxf += '0\nAPPID\n2\nACAD\n70\n0\n';
      dxf += '0\nENDTAB\n';
      const blockRecordNames = ['*MODEL_SPACE', '*PAPER_SPACE', ...fourreauTypes.map(t => `_CEAI_FOURREAU_${t}`), ...Array.from(cableLayerTypes)];
      dxf += `0\nTABLE\n2\nBLOCK_RECORD\n70\n${blockRecordNames.length}\n`;
      blockRecordNames.forEach(name => {
        dxf += '0\nBLOCK_RECORD\n';
        dxf += `2\n${name}\n`;
        dxf += '70\n0\n';
      });
      dxf += '0\nENDTAB\n';
    }
    dxf += '0\nENDSEC\n';

    // BLOCKS : définitions simples pour fourreaux et câbles (couleur héritée du calque)
    dxf += '0\nSECTION\n2\nBLOCKS\n';

    // Blocs système requis pour R2000+
    if (acadVer !== 'AC1009') {
      dxf += '0\nBLOCK\n5\n1F\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockBegin\n2\n*MODEL_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*MODEL_SPACE\n1\n\n0\nENDBLK\n5\n20\n100\nAcDbEntity\n8\n0\n100\nAcDbBlockEnd\n';
      dxf += '0\nBLOCK\n5\n1B\n100\nAcDbEntity\n67\n1\n8\n0\n100\nAcDbBlockBegin\n2\n*PAPER_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*PAPER_SPACE\n1\n\n0\nENDBLK\n5\n1C\n100\nAcDbEntity\n67\n1\n8\n0\n100\nAcDbBlockEnd\n';
    } else {
      dxf += '0\nBLOCK\n8\n0\n2\n*MODEL_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*MODEL_SPACE\n1\n\n0\nENDBLK\n5\n0\n8\n0\n';
      dxf += '0\nBLOCK\n8\n0\n2\n*PAPER_SPACE\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*PAPER_SPACE\n1\n\n0\nENDBLK\n5\n0\n8\n0\n';
    }

    // Fourreaux (double cercle)
    fourreauTypes.forEach(type => {
      const f = fourreauxValid.find(ff => `${ff.type}_${ff.code}` === type);
      if (!f) return;
      const outerRadius = (f.od / 2 / 1000).toFixed(6);
      const innerRadius = f.idm > 0 ? (f.idm / 2 / 1000).toFixed(6) : null;
      const name = fourreauLayerNameMap.get(type);

      dxf += '0\nBLOCK\n8\n0\n';
      dxf += `2\n${name}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n${name}\n1\n\n`;
      dxf += '0\nCIRCLE\n8\n0\n';
      dxf += `10\n0.0\n20\n0.0\n40\n${outerRadius}\n`;
      if (innerRadius) {
        dxf += '0\nCIRCLE\n8\n0\n';
        dxf += `10\n0.0\n20\n0.0\n40\n${innerRadius}\n`;
      }
      dxf += '0\nENDBLK\n5\n0\n8\n0\n';
    });

    // Câbles (cercle simple)
    Array.from(cableLayerTypes).forEach(name => {
      const cable = cablesValid.find(c => safeName(generateCableLayerName(c)) === name);
      if (!cable) return;
      const radius = (cable.od / 2 / 1000).toFixed(6);
      const phase = name.split('_').pop();
      let textToShow = phase;
      if (phase === 'STANDARD' || phase === 'CUSTOM') textToShow = cable.code;
      if (phase === 'STANDARD') textToShow = cable.code || '';

      dxf += '0\nBLOCK\n8\n0\n';
      dxf += `2\n${name}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n${name}\n1\n\n`;
      dxf += '0\nCIRCLE\n8\n0\n';
      dxf += `10\n0.0\n20\n0.0\n40\n${radius}\n`;
      if (textToShow) {
        dxf += '0\nTEXT\n8\n0\n';
        dxf += '7\nARIAL\n';
        dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
        dxf += '40\n0.004\n';
        dxf += `1\n${textToShow}\n`;
        dxf += '50\n0.0\n72\n1\n73\n2\n';
      }
      dxf += '0\nENDBLK\n5\n0\n8\n0\n';
    });

    dxf += '0\nENDSEC\n';

    // ENTITIES : uniquement des primitives simples (lignes/cercle)
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Contour de la boîte
    if (SHAPE === 'rect' || SHAPE === 'chemin_de_cable') {
      const w = (WORLD_W_MM / 1000).toFixed(6);
      const h = (WORLD_H_MM / 1000).toFixed(6);
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n0.0\n20\n0.0\n11\n${w}\n21\n0.0\n`;
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n${w}\n20\n0.0\n11\n${w}\n21\n${h}\n`;
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n${w}\n20\n${h}\n11\n0.0\n21\n${h}\n`;
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n0.0\n20\n${h}\n11\n0.0\n21\n0.0\n`;
    } else {
      const center = (WORLD_D_MM / 1000 / 2).toFixed(6);
      const radius = center;
      dxf += '0\nCIRCLE\n8\n_CEAI_BOITE\n';
      dxf += `10\n${center}\n20\n${center}\n40\n${radius}\n`;
    }

    // Cotes simples (lignes + texte)
    const allowDims = acadVer === 'AC1009'; // pour AC1032 on évite les DIMENSION R12 qui peuvent faire planter AutoCAD

    if (SHAPE === 'rect' || SHAPE === 'chemin_de_cable') {
      const w = (WORLD_W_MM / 1000).toFixed(6);
      const h = (WORLD_H_MM / 1000).toFixed(6);
      const dimBlock = '*D';

      // Cote horizontale (type aligné)
      if (allowDims) {
        dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
        dxf += `2\n${dimBlock}\n3\nARIAL\n`;
        dxf += `10\n${(parseFloat(w) / 2).toFixed(6)}\n20\n-0.10\n30\n0.0\n`; // point texte
        dxf += '70\n0\n'; // alignée
        dxf += '140\n0.1\n'; // texte 0.1
        dxf += '1\n<>\n';
        dxf += `13\n0.0\n23\n0.0\n33\n0.0\n`;
        dxf += `14\n${w}\n24\n0.0\n34\n0.0\n`;
        dxf += `15\n0.0\n25\n-0.10\n35\n0.0\n`;
        dxf += `16\n${w}\n26\n-0.10\n36\n0.0\n`;
      }

      // Cote verticale (type verticale)
      if (allowDims) {
        dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
        dxf += `2\n${dimBlock}\n3\nARIAL\n`;
        dxf += `10\n${(parseFloat(w) + 0.10).toFixed(6)}\n20\n${(parseFloat(h) / 2).toFixed(6)}\n30\n0.0\n`; // point texte
        dxf += '70\n1\n'; // verticale
        dxf += '140\n0.1\n';
        dxf += '1\n<>\n';
        dxf += `13\n${w}\n23\n0.0\n33\n0.0\n`;
        dxf += `14\n${w}\n24\n${h}\n34\n0.0\n`;
        dxf += `15\n${(parseFloat(w) + 0.10).toFixed(6)}\n25\n0.0\n35\n0.0\n`;
        dxf += `16\n${(parseFloat(w) + 0.10).toFixed(6)}\n26\n${h}\n36\n0.0\n`;
      }
    } else {
      // Cote diamètre
      const d = (WORLD_D_MM / 1000).toFixed(6);
      const center = (WORLD_D_MM / 1000 / 2).toFixed(6);
      const dimBlock = '*D';
      if (allowDims) {
        dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
        dxf += `2\n${dimBlock}\n3\nARIAL\n`;
        dxf += `10\n${center}\n20\n${center}\n30\n0.0\n`;
        dxf += '70\n3\n'; // diamètre
        dxf += '140\n0.1\n';
        dxf += '1\n<>\n';
        dxf += `15\n0.0\n25\n${center}\n35\n0.0\n`;
        dxf += `16\n${d}\n26\n${center}\n36\n0.0\n`;
      }
    }

    // Fourreaux (blocs avec double cercle)
    fourreauxValid.forEach(f => {
      const x = (f.x / MM_TO_PX / 1000).toFixed(6);
      const y = ((SHAPE === 'rect' || SHAPE === 'chemin_de_cable' ? WORLD_H - f.y : f.y) / MM_TO_PX / 1000).toFixed(6);
      const layer = fourreauLayerNameMap.get(`${f.type}_${f.code}`) || safeName(`_CEAI_FOURREAU_${f.type}_${f.code}`);
      const color = fourreauColorMap.get(`${f.type}_${f.code}`) ?? 7;
      const blockName = layer;
      dxf += '0\nINSERT\n';
      dxf += `8\n${layer}\n`;
      dxf += `62\n${color}\n`;
      dxf += `2\n${blockName}\n`;
      dxf += `10\n${x}\n20\n${y}\n30\n0.0\n`;
      dxf += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';
    });

    // Câbles (cercle simple)
    cablesValid.forEach(c => {
      const x = (c.x / MM_TO_PX / 1000).toFixed(6);
      const y = ((SHAPE === 'rect' || SHAPE === 'chemin_de_cable' ? WORLD_H - c.y : c.y) / MM_TO_PX / 1000).toFixed(6);
      const layer = safeName(generateCableLayerName(c));
      const color = layerColorMap.get(layer) ?? 7;
      const r = (c.od / 2 / 1000).toFixed(6);
      dxf += '0\nINSERT\n';
      dxf += `8\n${layer}\n`;
      dxf += `62\n${color}\n`;
      dxf += `2\n${layer}\n`;
      dxf += `10\n${x}\n20\n${y}\n30\n0.0\n`;
      dxf += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';
    });

    // Inventaire (texte simple)
    const inventaire = countGroups();
    const tableauX = -1.0; // m
    let yPos = (WORLD_H_MM / 1000) + 0.1;

    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.02\n1\nINVENTAIRE\n`;
    dxf += '7\nARIAL\n';
    yPos -= 0.03;

    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nTYPE\n7\nARIAL\n`;
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nCODE\n7\nARIAL\n`;
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nQTE\n7\nARIAL\n`;
    yPos -= 0.02;

    dxf += '0\nLINE\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n11\n${(tableauX + 0.25).toFixed(3)}\n21\n${yPos.toFixed(3)}\n`;
    yPos -= 0.02;

    for (const [key, count] of Object.entries(inventaire.fc)) {
      const [type, code] = key.split('|');
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${type}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${code}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${count}\n7\nARIAL\n`;
      yPos -= 0.018;
    }
    for (const [key, count] of Object.entries(inventaire.cc)) {
      const [fam, code] = key.split('|');
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${fam}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${code}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${count}\n7\nARIAL\n`;
      yPos -= 0.018;
    }

    dxf += '0\nENDSEC\n';

    // Section OBJECTS (requise pour AutoCAD 2000+)
    if (acadVer !== 'AC1009') {
      dxf += '0\nSECTION\n2\nOBJECTS\n';
      // Dictionnaire principal
      dxf += '0\nDICTIONARY\n5\nC\n330\n0\n100\nAcDbDictionary\n281\n1\n3\nACAD_GROUP\n350\nD\n3\nACAD_LAYOUT\n350\n1A\n3\nACAD_MLINESTYLE\n350\n17\n3\nACAD_PLOTSETTINGS\n350\n19\n3\nACAD_PLOTSTYLENAME\n350\nE\n3\nAcDbVariableDictionary\n350\n66\n';
      dxf += '0\nENDSEC\n';
    }

    dxf += '0\nEOF\n';
    return dxf;
  }
  
  async function exportDXF() {
    // Export DXF R12 (compatible ZWCAD)
    const dxfContent = generateDXF('AC1009');

    const wM = (WORLD_W_MM / 1000).toFixed(1);
    const hM = (WORLD_H_MM / 1000).toFixed(1);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `tontonkad_${wM}x${hM}m_${date}_${time}.dxf`;

    // Mode Electron : utiliser l'API exportFile avec dialogue de sauvegarde
    if (window.electronAPI && window.electronAPI.exportFile) {
      try {
        const result = await window.electronAPI.exportFile('dxf', dxfContent, fileName);
        if (result.success) {
          showToast(`Export DXF terminé : ${result.path}`);
        } else {
          showToast('Export DXF annulé');
        }
      } catch (error) {
        console.error('Erreur export DXF:', error);
        showToast('Erreur lors de l\'export DXF');
      }
    } else {
      // Mode Web : utiliser Blob avec charset UTF-8 (sans BOM)
      const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export DXF terminé !');
    }
  }

  /* ====== Inventaires & Panneaux d'info ====== */
  function countGroups() {
    const fc = {}, cc = {};
    for (const f of fourreaux) {
      const k = `${f.type}|${f.code}`;
      fc[k] = (fc[k] || 0) + 1;
    }
    for (const c of cables) {
      const k = `${c.fam}|${c.code}`;
      cc[k] = (cc[k] || 0) + 1;
    }
    return { fc, cc };
  }

  const cycleIndex = new Map;
  function buildList(container, groups, kind, filter) {
    container.innerHTML = "";
    const entries = Object.entries(groups).filter(([k]) => k.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [key, qty] of entries) {
      let label, swatchColor;
      if (kind === 'c') {
        const [fam, code] = key.split('|');
        const spec = CABLES.find(c => c.fam === fam && c.code === code);
        label = `${fam} ${code} — Ø ${spec ? spec.od : '?'} mm`; // CÂBLE
        swatchColor = colorForCable(fam, code);
      } else if (kind === 'f') {
        const [type, code] = key.split('|');
        const spec = FOURREAUX.find(f => f.type === type && f.code === code);
        label = `${type} ${code} — Øext ${spec ? spec.od : '?'} / Øint ≥ ${spec ? spec.id : '?'} mm`;
        swatchColor = colorForFourreau(type, code);
      }
      const item = document.createElement('div');
      item.className = 'item';
      item.tabIndex = 0;
      item.setAttribute('role', 'option');
      item.dataset.kind = kind;
      item.dataset.key = key;
      item.innerHTML = `<span class="swatch" style="background:${swatchColor}"></span><span class="label">${label}</span><span class="qty">× ${qty}</span>`;
      item.addEventListener('click', () => selectFromGroup(kind, key, false));
      item.addEventListener('dblclick', () => selectFromGroup(kind, key, true));
      container.appendChild(item);
    }
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'item';
      empty.innerHTML = '<span class="label muted">Aucun résultat</span>';
      container.appendChild(empty);
    }
  }

  function selectFromGroup(kind, key, cycle) {
    if (kind === 'c') {
      const [fam, code] = key.split('|');

      // Toujours pré-sélectionner ce type de câble dans le formulaire
      selectedCable = key;
      const cableSearch = document.getElementById('cableSearch');
      if (cableSearch) {
        const spec = CABLES.find(c => c.fam === fam && c.code === code);
        if (spec) {
          cableSearch.value = `${spec.fam} – ${spec.code} (Ø ${spec.od} mm)`;
        }
      }
      // Basculer vers l'onglet CÂBLE
      setTab('CÂBLE');

      // Ne pas sélectionner d'objet existant, juste déselectionner
      selected = null;
      selectedMultiple = [];
    } else if (kind === 'f') {
      const [type, code] = key.split('|');

      // Toujours pré-sélectionner ce type de fourreau dans le formulaire
      selectedFourreau = key;
      const fourreauSearch = document.getElementById('fourreauSearch');
      if (fourreauSearch) {
        const spec = FOURREAUX.find(f => f.type === type && f.code === code);
        if (spec) {
          fourreauSearch.value = `${spec.type} ${spec.code} — Øint ≥ ${spec.id} mm`;
        }
      }
      // Basculer vers l'onglet FOURREAU
      setTab('FOURREAU');

      // Ne pas sélectionner d'objet existant, juste déselectionner
      selected = null;
      selectedMultiple = [];
    }
    updateSelectedInfo();
    redraw();
  }

  function updateInventory() {
    const { fc, cc } = countGroups();
    countInvF.textContent = fourreaux.length;
    countInvC.textContent = cables.length;
    typesInvF.textContent = Object.keys(fc).length;
    typesInvC.textContent = Object.keys(cc).length;
    buildList(listFourreau, fc, 'f', searchFourreau.value || "");
    buildList(listCable, cc, 'c', searchCable.value || "");
  }

  function updateSelectedInfo() {
    // Gestion de la sélection multiple
    if (selectedMultiple.length > 0) {
      selInfo.classList.remove('muted');
      const type = selectedMultiple[0].type === 'fourreau' ? 'fourreaux' : 'câbles';
      selInfo.innerHTML = `<div><b>SÉLECTION MULTIPLE</b> — ${selectedMultiple.length} ${type}</div><div><em>Utilisez Éditer (E) pour modifier tous les éléments sélectionnés</em></div>`;
      if (freezeBtn) {
        freezeBtn.disabled = false;
        freezeBtn.textContent = 'Figer sélection (X)';
      }
      return;
    }
    
    if (!selected) {
      selInfo.classList.add('muted');
      selInfo.innerHTML = '<em>Aucun objet sélectionné.</em>';
      if (freezeBtn) {
        freezeBtn.disabled = true;
        freezeBtn.textContent = 'Figer (X)';
      }
      return;
    }
    selInfo.classList.remove('muted');
    let frozen = false;
    if (selected.type === 'cable') {
      const c = cables.find(o => o.id === selected.id);
      if (!c) {
        selInfo.innerHTML = '<em>Introuvable</em>';
        if (freezeBtn) freezeBtn.disabled = true;
        return;
      }
      frozen = !!c.frozen;
      const sec = parseSectionFromCode(c.code), area = areaCircle(c.od).toFixed(1);
      const displayColor = c.customColor || c.color;
      const customLabel = c.label ? `<div>Libellé : <b>${c.label}</b></div>` : '';
      selInfo.innerHTML = `<div><span class='swatch' style='background:${displayColor}'></span><b>CÂBLE</b> — ${c.fam} ${c.code}</div>${customLabel}<div>Ø extérieur : <b>${c.od}</b> mm</div><div>Section nominale : <b>${isNaN(sec) ? '—' : sec.toLocaleString('fr-FR')}</b> mm²</div><div>Aire géométrique : <b>${area}</b> mm²</div><div>Localisation : <b>${c.parent ? ('dans Fourreau #' + c.parent) : 'hors Fourreau'}</b></div><div>Gelé : <b>${frozen ? 'Oui' : 'Non'}</b></div>`;
    } else if (selected.type === 'fourreau') {
      const f = fourreaux.find(o => o.id === selected.id);
      if (!f) {
        selInfo.innerHTML = '<em>Introuvable</em>';
        if (freezeBtn) freezeBtn.disabled = true;
        return;
      }
      frozen = !!f.frozen;
      const inner = areaCircle(f.idm), occ = f.children.map(id => cables.find(c => c.id === id)).filter(Boolean).reduce((s, c) => s + areaCircle(c.od), 0), used = inner ? occ / inner * 100 : 0, free = Math.max(0, 100 - used);
      const displayColor = f.customColor || f.color;
      const customLabel = f.label ? `<div>Libellé : <b>${f.label}</b></div>` : '';
      selInfo.innerHTML = `<div><span class='swatch' style='background:${displayColor}'></span><b>${f.type} ${f.code}</b></div>${customLabel}<div>Ø extérieur : <b>${f.od}</b> — Ø intérieur min : <b>${f.idm}</b> mm</div><div>Aire intérieure : <b>${inner.toFixed(1)}</b> mm²</div><div>Câbles contenus : <b>${f.children.length}</b></div><div>Occupation : <b>${used.toFixed(1)}%</b> — Libre : <b>${free.toFixed(1)}%</b></div><div>Gelé : <b>${frozen ? 'Oui' : 'Non'}</b></div>`;
    }
    if (freezeBtn) {
      freezeBtn.disabled = false;
      freezeBtn.textContent = frozen ? 'Dégeler (X)' : 'Figer (X)';
    }
  }

  function calculateBoxOccupancy() {
    let totalArea;
    if (SHAPE === 'rect' || SHAPE === 'chemin_de_cable') {
      totalArea = WORLD_W_MM * WORLD_H_MM;
    } else {
      totalArea = areaCircle(WORLD_D_MM);
    }

    if (totalArea <= 0) return 0;

    // L'occupation est basée sur l'aire des fourreaux (diamètre extérieur) et des câbles hors fourreaux
    const occupiedArea = fourreaux.reduce((sum, f) => sum + areaCircle(f.od), 0);
    const occupiedAreaCable = cables.filter(c => !c.parent).reduce((sum, cable) => sum + areaCircle(cable.od), 0);

    return ((occupiedArea + occupiedAreaCable) / totalArea) * 100;
  }

  let checkReductionTimeout;
  let lastFourreauxCount = -1;
  function updateStats() {
    statFourreau.textContent = fourreaux.length;
    statCable.textContent = cables.length;
    statOccupation.textContent = `${calculateBoxOccupancy().toFixed(1)} %`;

    // Ne déclencher checkForPossibleReduction que si le nombre de fourreaux a changé
    if (fourreaux.length !== lastFourreauxCount) {
      lastFourreauxCount = fourreaux.length;
      clearTimeout(checkReductionTimeout);
      checkReductionTimeout = setTimeout(checkForPossibleReduction, 500); // Augmenté à 500ms
    }
  }

  /* ====== Interaction Utilisateur ====== */
  function setMode(m) {
    mode = m;
    // toolPlace et toolSelect supprimés - plus de boutons mode
    toolDelete.classList.toggle('btn-active', m === 'delete');
  }

  function toggleFreezeSelected() {
    let frozenCount = 0;
    let unfrozenCount = 0;
    
    // Fonction pour basculer le gel d'un élément
    const toggleFreeze = (sel) => {
      let o = null;
      if (sel.type === 'fourreau') o = fourreaux.find(x => x.id === sel.id);
      else o = cables.find(x => x.id === sel.id);
      if (!o) return;
      
      o.frozen = !o.frozen;
      o.vx = 0;
      o.vy = 0;
      
      if (o.frozen) frozenCount++;
      else unfrozenCount++;
    };
    
    // Appliquer à la sélection multiple ou simple
    if (selectedMultiple.length > 0) {
      selectedMultiple.forEach(toggleFreeze);
      showToast(`${frozenCount} figés, ${unfrozenCount} dégelés`);
    } else if (selected) {
      toggleFreeze(selected);
      showToast(frozenCount > 0 ? 'Objet figé' : 'Objet dégelé');
    } else {
      return;
    }
    
    updateSelectedInfo();
    redraw();
  }

  function toggleFreezeAll() {
    // Compter les éléments gelés vs non-gelés
    const allElements = [...fourreaux, ...cables];
    const frozenCount = allElements.filter(obj => obj.frozen).length;
    const unfrozenCount = allElements.length - frozenCount;
    
    // Décider si on gèle tout ou on dégèle tout
    const shouldFreeze = unfrozenCount >= frozenCount;
    
    let changedCount = 0;
    allElements.forEach(obj => {
      if (obj.frozen !== shouldFreeze) {
        obj.frozen = shouldFreeze;
        obj.vx = 0;
        obj.vy = 0;
        changedCount++;
      }
    });
    
    if (changedCount > 0) {
      showToast(shouldFreeze ? `${changedCount} éléments figés` : `${changedCount} éléments dégelés`);
      updateSelectedInfo();
      redraw();
    }
  }

  function toggleShowInfo() {
    showInfo = !showInfo;
    const toolInfo = document.getElementById('toolInfo');
    if (toolInfo) {
      toolInfo.classList.toggle('btn-active', showInfo);
    }
    redraw();
    showToast(showInfo ? 'Infos affichées' : 'Infos masquées');
  }

  // Système de notifications intégrées
  function showToast(msg, type = 'default') {
    // Détecter automatiquement le type si msg contient des emojis
    if (!type || type === 'default') {
      if (msg.includes('✅') || msg.toLowerCase().includes('succès') || msg.toLowerCase().includes('terminé')) {
        type = 'success';
      } else if (msg.includes('❌') || msg.includes('🔒') || msg.toLowerCase().includes('impossible') || msg.toLowerCase().includes('erreur')) {
        type = 'error';
      } else if (msg.includes('⚠️') || msg.toLowerCase().includes('attention')) {
        type = 'warning';
      } else if (msg.includes('ℹ️') || msg.includes('🔧')) {
        type = 'info';
      }
    }

    // Icônes par type
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      default: '💬'
    };

    // Nettoyer les emojis du message s'ils sont déjà dans le texte
    const cleanMsg = msg.replace(/^(✅|❌|⚠️|ℹ️|💬|🔒|🔧)\s*/, '');

    // Créer la notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = icons[type] || icons.default;

    const content = document.createElement('span');
    content.className = 'notification-content';
    content.textContent = cleanMsg;

    notification.appendChild(icon);
    notification.appendChild(content);

    // Ajouter au conteneur
    notificationContainer.appendChild(notification);

    // Fermer au clic
    notification.addEventListener('click', () => {
      notification.classList.add('removing');
      setTimeout(() => notification.remove(), 300);
    });

    // Auto-suppression après 3 secondes
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  // Fonction de confirmation personnalisée
  function customConfirm(message, title = 'Confirmation') {
    return new Promise((resolve) => {
      const dialog = document.getElementById('confirmDialog');
      const titleEl = document.getElementById('confirmTitle');
      const messageEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('confirmOk');
      const cancelBtn = document.getElementById('confirmCancel');

      // Remplir le contenu
      titleEl.textContent = title;
      messageEl.textContent = message;

      // Afficher la modale
      document.body.appendChild(dialog);
      dialog.style.display = 'flex';
      dialog.style.position = 'fixed';
      dialog.style.top = '0';
      dialog.style.left = '0';
      dialog.style.width = '100vw';
      dialog.style.height = '100vh';
      dialog.style.zIndex = '99999';
      dialog.style.alignItems = 'center';
      dialog.style.justifyContent = 'center';
      dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

      // Gestionnaires d'événements
      const handleOk = () => {
        dialog.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(true);
      };

      const handleCancel = () => {
        dialog.style.display = 'none';
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        resolve(false);
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);

      // Focus sur OK
      setTimeout(() => okBtn.focus(), 100);
    });
  }

  // Boîte d'alerte simple (réutilise le même gabarit que customConfirm)
  function customAlert(message, title = 'Information') {
    return new Promise((resolve) => {
      const dialog = document.getElementById('confirmDialog');
      const titleEl = document.getElementById('confirmTitle');
      const messageEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('confirmOk');
      const cancelBtn = document.getElementById('confirmCancel');

      // Masquer temporairement le bouton Annuler
      const previousCancelDisplay = cancelBtn.style.display;
      cancelBtn.style.display = 'none';

      // Remplir le contenu
      titleEl.textContent = title;
      messageEl.textContent = message;

      // Afficher la modale
      document.body.appendChild(dialog);
      dialog.style.display = 'flex';
      dialog.style.position = 'fixed';
      dialog.style.top = '0';
      dialog.style.left = '0';
      dialog.style.width = '100vw';
      dialog.style.height = '100vh';
      dialog.style.zIndex = '99999';
      dialog.style.alignItems = 'center';
      dialog.style.justifyContent = 'center';
      dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

      const handleOk = () => {
        dialog.style.display = 'none';
        cancelBtn.style.display = previousCancelDisplay;
        okBtn.removeEventListener('click', handleOk);
        resolve(true);
      };

      okBtn.addEventListener('click', handleOk);

      // Focus sur OK
      setTimeout(() => okBtn.focus(), 100);
    });
  }

  function canvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    const { width: logicalW, height: logicalH } = getLogicalCanvasDimensions();
    const sx = logicalW / r.width;
    const sy = logicalH / r.height;
    // Soustraire l'offset de marge ajouté pour les cotes
    return { x: (e.clientX - r.left) * sx - CANVAS_MARGIN, y: (e.clientY - r.top) * sy - CANVAS_MARGIN }
  }

  function pickAt(x, y) {
    for (let i = cables.length - 1; i >= 0; i--) {
      const c = cables[i], r = c.od * MM_TO_PX / 2;
      if (Math.hypot(x - c.x, y - c.y) <= r) return { type: 'cable', id: c.id }
    }
    for (let i = fourreaux.length - 1; i >= 0; i--) {
      const f = fourreaux[i], ro = f.od * MM_TO_PX / 2, ri = f.idm * MM_TO_PX / 2, d = Math.hypot(x - f.x, y - f.y);
      if (d <= ro && d >= ri) return { type: 'fourreau', id: f.id }
    }
    return null;
  }

  function startDrag(obj, sel) {
    function onMove(ev) {
      const p = canvasCoords(ev);
      if (sel.type === 'fourreau') {
        const f = fourreaux.find(o => o.id === sel.id);
        if (!f) return;
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        f.x = p.x; f.y = p.y; f._px = p.x; f._py = p.y;
        // Déplacer les enfants avec le TPC (seulement si pas gelés)
        for (const id of f.children) {
          const child = cables.find(k => k.id === id);
          if (child && !child.frozen) {
            child.x += dx; child.y += dy;
            child._px = child.x; child._py = child.y;
          }
        }
      } else {
        const c = cables.find(o => o.id === sel.id);
        if (!c) return;
        c.x = p.x; c.y = p.y; c._px = p.x; c._py = p.y;
      }
      redraw();
    }
    function onUp() {
      const o = selected ? selected.type === 'fourreau' ? fourreaux.find(o => o.id === selected.id) : cables.find(o => o.id === selected.id) : null;
      if (o) o.dragging = false;
      updateSelectedInfo();
      removeEventListener('mousemove', onMove);
      removeEventListener('mouseup', onUp);
    }
    addEventListener('mousemove', onMove);
    addEventListener('mouseup', onUp);
  }
  
  // Logique pour la sélection par rectangle (marquee)
  function startMarqueeSelection(e) {
    isMarqueeSelecting = true;
    marqueeStart = canvasCoords(e);
    marqueeEnd = marqueeStart;

    // Si Shift n'est pas pressé, on commence une nouvelle sélection
    if (!e.shiftKey) {
      selected = null;
      selectedMultiple = [];
    }

    function onMarqueeMove(ev) {
      if (!isMarqueeSelecting) return;
      marqueeEnd = canvasCoords(ev);
      updateMarqueeSelection(e.shiftKey);
      redraw();
    }

    function onMarqueeUp(ev) {
      isMarqueeSelecting = false;
      document.removeEventListener('mousemove', onMarqueeMove);
      document.removeEventListener('mouseup', onMarqueeUp);
      redraw();
      updateSelectedInfo();
    }

    document.addEventListener('mousemove', onMarqueeMove);
    document.addEventListener('mouseup', onMarqueeUp);
  }

  function updateMarqueeSelection(isAdding) {
    const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
    const y1 = Math.min(marqueeStart.y, marqueeEnd.y);
    const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
    const y2 = Math.max(marqueeStart.y, marqueeEnd.y);

    const inMarquee = [];
    const allObjects = [...fourreaux, ...cables];

    allObjects.forEach(obj => {
      const r = (obj.od * MM_TO_PX) / 2;
      // Vérifier si le centre de l'objet est dans le rectangle
      if (obj.x >= x1 && obj.x <= x2 && obj.y >= y1 && obj.y <= y2) {
        const type = obj.hasOwnProperty('idm') ? 'fourreau' : 'cable';
        inMarquee.push({ type, id: obj.id });
      }
    });

    // Pour l'instant, on ne gère que la sélection de câbles OU de fourreaux, pas les deux
    if (inMarquee.length > 0) {
      const firstType = inMarquee[0].type;
      selectedMultiple = inMarquee.filter(item => item.type === firstType);
    }
  }

  function setTab(name) {
    activeTab = name;
    tabFOURREAU.classList.toggle('active', name === 'FOURREAU');
    tabCABLE.classList.toggle('active', name === 'CÂBLE');
    paneFOURREAU.classList.toggle('hidden', name !== 'FOURREAU');
    paneCABLE.classList.toggle('hidden', name !== 'CÂBLE');
  }

  function toggleInputGroups() {
    const shape = shapeSel.value;
    rectInputs.classList.toggle('hidden', shape !== 'rect');
    circInputs.classList.toggle('hidden', shape !== 'circ');
    if (cheminCableInputs) {
      cheminCableInputs.classList.toggle('hidden', shape !== 'chemin_de_cable');
    }
  }

  function buildShapeDropdownOptions() {
    if (!shapeSel || !shapeSelectList) return;
    shapeSelectList.innerHTML = '';
    shapeDropdownOptionEls.clear();

    Array.from(shapeSel.options).forEach((opt) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'searchable-option';
      optionEl.dataset.value = opt.value;
      optionEl.setAttribute('role', 'option');
      optionEl.textContent = opt.textContent;
      optionEl.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectShapeFromDropdown(opt.value);
      });
      shapeSelectList.appendChild(optionEl);
      shapeDropdownOptionEls.set(opt.value, optionEl);
    });
  }

  function updateShapeDropdownDisplay() {
    if (!shapeSel || !shapeDisplayInput) return;
    if (!shapeDropdownOptionEls.size && shapeSelectList) {
      buildShapeDropdownOptions();
    }
    const optionIndex = shapeSel.selectedIndex >= 0 ? shapeSel.selectedIndex : 0;
    const selectedOption = shapeSel.options[optionIndex];
    shapeDisplayInput.value = selectedOption ? selectedOption.textContent : '';
    shapeDropdownOptionEls.forEach((element, value) => {
      element.classList.toggle('selected', value === shapeSel.value);
    });
  }

  function closeShapeDropdown() {
    if (!shapeSelectList || !shapeDisplayInput || !shapeDropdownOpen) return;
    shapeDropdownOpen = false;
    shapeSelectList.classList.remove('show');
    shapeDisplayInput.setAttribute('aria-expanded', 'false');
    shapeSelectContainer?.classList.remove('dropdown-open');
  }

  function openShapeDropdown() {
    if (!shapeSelectList || !shapeDisplayInput || shapeDropdownOpen) return;
    shapeDropdownOpen = true;
    shapeSelectList.classList.add('show');
    shapeDisplayInput.setAttribute('aria-expanded', 'true');
    shapeSelectContainer?.classList.add('dropdown-open');
  }

  function selectShapeFromDropdown(value) {
    if (!shapeSel) return;
    if (shapeSel.value !== value) {
      shapeSel.value = value;
      const changeEvent = new Event('change', { bubbles: true });
      shapeSel.dispatchEvent(changeEvent);
    } else {
      updateShapeDropdownDisplay();
    }
    closeShapeDropdown();
  }

  function setupShapeDropdown() {
    if (!shapeDisplayInput || !shapeSelectList || !shapeSel || shapeDropdownEventsBound) return;
    shapeDropdownEventsBound = true;

    buildShapeDropdownOptions();
    updateShapeDropdownDisplay();

    shapeDisplayInput.addEventListener('click', (event) => {
      event.preventDefault();
      if (shapeDropdownOpen) {
        closeShapeDropdown();
      } else {
        openShapeDropdown();
      }
    });

    shapeDisplayInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (shapeDropdownOpen) {
          closeShapeDropdown();
        } else {
          openShapeDropdown();
        }
      } else if (event.key === 'Escape') {
        closeShapeDropdown();
      }
    });

    shapeDisplayInput.addEventListener('blur', () => {
      setTimeout(closeShapeDropdown, 150);
    });

    document.addEventListener('click', (event) => {
      if (!shapeSelectContainer?.contains(event.target)) {
        closeShapeDropdown();
      }
    });
  }

  function handleShapeSelectorChange() {
    toggleInputGroups();
    updateShapeDropdownDisplay();
  }

  function applyDimensions() {
    // Vérifier si les fourreaux sont déjà en grille (tous gelés)
    const wasInGrid = fourreaux.length > 0 && fourreaux.every(f => f.frozen);

    SHAPE = shapeSel.value;
    if (SHAPE === 'rect') {
      const lockWidth = document.getElementById('lockWidth')?.checked;
      const lockHeight = document.getElementById('lockHeight')?.checked;

      if (!lockWidth) {
        WORLD_W_MM = parseFloat(boxWInput.value);
      }
      if (!lockHeight) {
        WORLD_H_MM = parseFloat(boxHInput.value);
      }

      // Mettre à jour les inputs avec les valeurs actuelles (au cas où verrouillées)
      boxWInput.value = WORLD_W_MM;
      boxHInput.value = WORLD_H_MM;

    } else if (SHAPE === 'chemin_de_cable') {
      const [w, h] = cheminCableSelect.value.split('|').map(parseFloat);
      WORLD_W_MM = w || 0;
      WORLD_H_MM = h || 0;
    } else {
      WORLD_D_MM = parseFloat(boxDInput.value);
    }
    syncDimensionState();
    pruneOutside();
    setCanvasSize();
    updateStats();
    updateInventory();
    updateSelectedInfo();

    // Si les fourreaux étaient en grille, réappliquer la grille automatiquement
    if (wasInGrid && fourreaux.length > 0) {
      // Petite pause pour laisser le canvas se redimensionner
      setTimeout(() => {
        arrangeConduitGrid();
      }, 120);
    }
  }

  function pruneOutside() {
    if (arrangeInProgress) return; // Ne pas supprimer durant l'arrangement en grille
    
    for (let i = fourreaux.length - 1; i >= 0; i--) {
      const f = fourreaux[i], r = f.od * MM_TO_PX / 2;
      if (!isInsideBox(f.x, f.y, r)) {
        for (const cid of f.children) {
          const j = cables.findIndex(k => k.id === cid);
          if (j >= 0) cables.splice(j, 1);
        }
        fourreaux.splice(i, 1);
      }
    }
    for (let i = cables.length - 1; i >= 0; i--) {
      const c = cables[i], r = c.od * MM_TO_PX / 2;
      if (c.parent) {
        const f = fourreaux.find(f => f.id === c.parent);
        if (!f) {
          cables.splice(i, 1);
          continue;
        }
        const ri = f.idm * MM_TO_PX / 2;
        if (Math.hypot(c.x - f.x, c.y - f.y) > ri - r) cables.splice(i, 1);
      } else if (!isInsideBox(c.x, c.y, r)) {
        cables.splice(i, 1);
      }
    }
  }

  /* ====== Moteur Physique ====== */
  const mass = r => Math.max(1, r * r * MASS_K);

  function confineInBox(o, r) {
    if (SHAPE === 'rect' || SHAPE === 'chemin_de_cable') {
      // Mur gauche
      if (o.x - r < 0) { o.x = r; o.vx = -o.vx * RESTITUTION; o.vy *= FRICTION_GROUND; }
      // Mur droit
      if (o.x + r > WORLD_W) { o.x = WORLD_W - r; o.vx = -o.vx * RESTITUTION; o.vy *= FRICTION_GROUND; }
      // Sol
      if (o.y + r > WORLD_H) { o.y = WORLD_H - r; o.vy = -o.vy * RESTITUTION; o.vx *= FRICTION_GROUND; }
      // Plafond (uniquement pour la forme 'rect')
      if (SHAPE === 'rect' && o.y - r < 0) {
        o.y = r;
        o.vy = -o.vy * RESTITUTION;
        o.vx *= FRICTION_GROUND;
      }
    } else {
      const { x: cx, y: cy } = getCanvasCenter();
      const dx = o.x - cx, dy = o.y - cy, d = Math.hypot(dx, dy), lim = WORLD_R - r;
      if (d > lim) { const nx = dx / (d || 1), ny = dy / (d || 1); o.x = cx + nx * lim; o.y = cy + ny * lim; const vn = o.vx * nx + o.vy * ny; if (vn > 0) { o.vx -= (1 + RESTITUTION) * vn * nx; o.vy -= (1 + RESTITUTION) * vn * ny } }
    }
  }

  function separateCircles(a, ra, b, rb) {
    const dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.hypot(dx, dy);
    const min = ra + rb;
    if (d === 0) d = 1e-6;
    if (d < min) {
      const nx = dx / (d || 1), ny = dy / (d || 1), overlap = min - d;
      const aStatic = !!a.frozen, bStatic = !!b.frozen;
      if (aStatic && bStatic) return;

      // Correction de position (sépare les objets qui se chevauchent)
      if (aStatic) {
        b.x += nx * overlap; b.y += ny * overlap;
      } else if (bStatic) {
        a.x -= nx * overlap; a.y -= ny * overlap;
      } else {
        const ma = mass(ra), mb = mass(rb), sum = ma + mb;
        a.x -= nx * overlap * (mb / sum); a.y -= ny * overlap * (mb / sum);
        b.x += nx * overlap * (ma / sum); b.y += ny * overlap * (ma / sum);
      }

      // Réponse à l'impulsion (vitesse) pour un rebond réaliste
      const vdx = b.vx - a.vx, vdy = b.vy - a.vy;
      const dot = vdx * nx + vdy * ny;
      if (dot < 0) { // Ne réagir que s'ils se rapprochent
        const invMassA = aStatic ? 0 : 1 / mass(ra);
        const invMassB = bStatic ? 0 : 1 / mass(rb);
        // On intègre l'atténuation de l'exemple pour que les objets s'immobilisent plus vite après un choc.
        // L'impulsion est calculée puis atténuée par DYNAMIC_COLLISION_DAMPING.
        const j = -(1 + RESTITUTION) * dot / (invMassA + invMassB) * DYNAMIC_COLLISION_DAMPING;
        const impulseX = j * nx, impulseY = j * ny;
        if (!aStatic) { a.vx -= impulseX * invMassA; a.vy -= impulseY * invMassA; }
        if (!bStatic) { b.vx += impulseX * invMassB; b.vy += impulseY * invMassB; }
      }
    }
  }

  function confineCableInTPC(c, r, t) {
    const ri = t.idm * MM_TO_PX / 2 - r, dx = c.x - t.x, dy = c.y - t.y, d = Math.hypot(dx, dy);
    if (d > ri) { const nx = dx / (d || 1), ny = dy / (d || 1); c.x = t.x + nx * ri; c.y = t.y + ny * ri; const vn = c.vx * nx + c.vy * ny; if (vn > 0) { c.vx -= (1 + RESTITUTION) * vn * nx; c.vy -= (1 + RESTITUTION) * vn * ny; } }
  }

  function stepPhysics() {
    // 1. Intégration : Appliquer les forces et mettre à jour les positions de tous les objets.
    const allObjects = [...fourreaux, ...cables];
    for (const o of allObjects) {
      o._px = o.x; o._py = o.y;
      if (!o.dragging && !o.frozen) {
        o.vy += GRAVITY;
        o.vx *= AIR_DRAG;
        o.vy *= AIR_DRAG;
        o.x += o.vx;
        o.y += o.vy;
      }
    }

    // 2. Résolution des contraintes : Répéter plusieurs fois pour assurer la stabilité et éviter le chevauchement.
    for (let iter = 0; iter < PHYSICS_ITERATIONS; iter++) {
      // A. Confinement des objets dans leurs conteneurs respectifs
      for (const f of fourreaux) { confineInBox(f, f.od * MM_TO_PX / 2); }
      for (const c of cables) {
        const r = c.od * MM_TO_PX / 2;
        if (c.parent) {
          const f = fourreaux.find(fourreau => fourreau.id === c.parent);
          if (f) confineCableInTPC(c, r, f);
        } else {
          confineInBox(c, r);
        }
      }

      // B. Résolution des collisions entre les objets "libres" (TPC et câbles hors TPC)
      const outsideObjects = [...fourreaux, ...cables.filter(c => !c.parent)];
      for (let i = 0; i < outsideObjects.length; i++) {
        for (let j = i + 1; j < outsideObjects.length; j++) {
          separateCircles(outsideObjects[i], outsideObjects[i].od * MM_TO_PX / 2, outsideObjects[j], outsideObjects[j].od * MM_TO_PX / 2);
        }
      }

      // C. Résolution des collisions pour les câbles à l'intérieur de chaque TPC
      for (const f of fourreaux) {
        const kids = f.children.map(id => cables.find(c => c.id === id)).filter(Boolean);
        for (let i = 0; i < kids.length; i++) {
          for (let j = i + 1; j < kids.length; j++) {
            separateCircles(kids[i], kids[i].od * MM_TO_PX / 2, kids[j], kids[j].od * MM_TO_PX / 2);
          }
        }
      }
    }
  }

  function tick() {
    stepPhysics();
    redraw();
    requestAnimationFrame(tick);
  }

  /* ====== Redimensionnement du panneau ====== */
  function initPanelResize() {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      const containerWidth = document.querySelector('.wrap').offsetWidth;
      const minWidth = 320;
      const maxWidth = containerWidth * 0.5;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      const widthPercent = (clampedWidth / containerWidth) * 100;
      document.documentElement.style.setProperty('--panel-width', widthPercent + '%');
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  /* ====== Effet de scroll pour le panel ====== */
  function initPanelScrollEffect() {
    if (!panel) return;
    
    function updateScrollEffect() {
      const scrollTop = panel.scrollTop;
      const scrollHeight = panel.scrollHeight;
      const clientHeight = panel.clientHeight;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;
      
      // Si on est à moins de 5px du bas, cacher le fade
      if (scrollBottom <= 5) {
        panel.classList.add('scrolled-to-bottom');
      } else {
        panel.classList.remove('scrolled-to-bottom');
      }
    }
    
    panel.addEventListener('scroll', updateScrollEffect);
    // Vérification initiale
    updateScrollEffect();
  }

  /* ====== Export PDF Functions ====== */
  // Helpers de debug PDF
  const logPdf = (...args) => console.log('[PDF]', ...args);
  const warnPdf = (...args) => console.warn('[PDF]', ...args);
  const errorPdf = (...args) => console.error('[PDF]', ...args);

  // Catch global errors pour voir les blocages éventuels
  window.addEventListener('error', (e) => {
    errorPdf('window.error', e.message, e.error?.stack || '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    errorPdf('window.unhandledrejection', e.reason);
  });

  function openPdfExportModal() {
    const modal = document.getElementById('pdfExportModal');
    if (!modal) {
      console.error('[PDF] Modal element not found!');
      return;
    }

    const modalContent = modal.querySelector('.pdf-export-modal-enhanced');

    // Pré-remplir les valeurs
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const pdfProjectName = document.getElementById('pdfProjectName');
    const pdfViewName = document.getElementById('pdfViewName');
    const pdfDescriptionCounter = document.getElementById('pdfDescriptionCounter');

    if (pdfProjectName) pdfProjectName.value = `Projet ${currentDate}`;
    if (pdfViewName) pdfViewName.value = 'Vue principale';
    if (pdfDescriptionCounter) pdfDescriptionCounter.textContent = '0';

    // IMPORTANT : Déplacer la modale à la fin du body pour éviter les conflits de layout
    // Cela évite que des conteneurs parents avec height:0 ou overflow:hidden ne cachent la modale
    document.body.appendChild(modal);

    // Afficher la modale avec styles forcés
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.zIndex = '10001';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';

    // Styles du contenu
    if (modalContent) {
      modalContent.style.width = '700px';
      modalContent.style.minHeight = '500px';
      modalContent.style.display = 'flex';
      modalContent.style.flexDirection = 'column';
    }

    // Focus sur le premier champ
    setTimeout(() => {
      if (pdfProjectName) pdfProjectName.focus();
    }, 100);
  }

  let selectedImageBase64 = null;

  function setupImageDropZone() {
    const dropZone = document.getElementById('dynamicImageDropZone');
    const fileInput = document.getElementById('dynamicImageInput');
    const placeholder = document.getElementById('dynamicImagePlaceholder');

    // Clic pour ouvrir le sélecteur de fichier (uniquement sur le placeholder)
    if (placeholder) {
      placeholder.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    // Empêcher la dropZone de capturer les événements qui ne concernent pas le drag&drop
    dropZone.addEventListener('click', (e) => {
      // Ne rien faire si le clic est sur le placeholder ou sur l'input
      if (e.target === dropZone || e.target === placeholder || placeholder.contains(e.target)) {
        return;
      }
      e.stopPropagation();
    });

    // Glisser-déposer
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageFile(files[0]);
      }
    });

    // Sélection de fichier
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  function handleImageFile(file) {
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner un fichier image');
      return;
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Le fichier est trop volumineux (max 5MB)');
      return;
    }

    // Lire le fichier
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedImageBase64 = e.target.result;
      showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function showImagePreview(imageSrc) {
    const placeholder = document.getElementById('dynamicImagePlaceholder');
    const preview = document.getElementById('dynamicImagePreview');
    const previewImg = document.getElementById('dynamicImagePreviewImg');

    placeholder.style.display = 'none';
    preview.style.display = 'block';
    previewImg.src = imageSrc;
  }

  window.removeDynamicImage = function() {
    selectedImageBase64 = null;
    const placeholder = document.getElementById('dynamicImagePlaceholder');
    const preview = document.getElementById('dynamicImagePreview');

    placeholder.style.display = 'block';
    preview.style.display = 'none';

    // Reset input
    document.getElementById('dynamicImageInput').value = '';
  }

  function closePdfExportModal() {
    const modal = document.getElementById('pdfExportModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Nouvelles fonctions pour la modal dynamique
  window.closeDynamicPdfModal = function() {
    const modal = document.getElementById('tontonkadPdfExportModal');
    if (modal) {
      modal.remove();
    }
    // Reset de l'image sélectionnée pour éviter le cache
    selectedImageBase64 = null;
  }

  window.generateDynamicPDF = async function() {
    try {
      // Récupérer les valeurs des champs dynamiques
      const formData = {
        projectName: document.getElementById('dynamicPdfProjectName').value || 'Projet TontonKAD',
        viewName: document.getElementById('dynamicPdfViewName').value || 'Vue principale',
        author: document.getElementById('dynamicPdfAuthor').value || 'TontonKAD',
        client: document.getElementById('dynamicPdfClient').value || '',
        description: document.getElementById('dynamicPdfDescription').value || '',
        includeStats: document.getElementById('dynamicPdfIncludeStats').checked
      };

      // Afficher un indicateur de chargement
      showToast('Génération du PDF en cours...');

      // Générer le PDF avec les données du formulaire dynamique AVANT de fermer la modal
      await exportToPDFWithData(formData);

      // Fermer la modal APRÈS la génération du PDF
      closeDynamicPdfModal();
    } catch (error) {
      console.error('Erreur lors de la génération PDF:', error);
      showToast('Erreur: ' + error.message);
    }
  }

  function calculateFourreauOccupancy(fourreau) {
    // Calculer l'aire intérieure du fourreau (basée sur le diamètre intérieur)
    const fourreauInnerArea = areaCircle(fourreau.idm);

    if (fourreauInnerArea <= 0) return 0;

    // Calculer l'aire totale des câbles dans ce fourreau
    const cablesInFourreau = cables.filter(c => c.parent === fourreau.id);
    const cablesArea = cablesInFourreau.reduce((sum, c) => sum + areaCircle(c.od), 0);

    return (cablesArea / fourreauInnerArea) * 100;
  }

  function generatePdfStats() {
    const stats = {
      fourreaux: fourreaux.length,
      cables: cables.length,
      occupation: calculateBoxOccupancy().toFixed(1),
      dimensions: {
        width: (WORLD_W_MM / 1000).toFixed(2),
        height: (WORLD_H_MM / 1000).toFixed(2)
      }
    };

    // Compter les types de fourreaux et câbles
    const { fc, cc } = countGroups();
    stats.typesFourreaux = Object.keys(fc).length;
    stats.typesCables = Object.keys(cc).length;

    // Détail des fourreaux par type
    stats.detailFourreaux = Object.entries(fc).map(([type, count]) => ({ type, count }));
    stats.detailCables = Object.entries(cc).map(([type, count]) => ({ type, count }));

    // Détail de l'occupation par fourreau avec numérotation
    stats.fourreauxDetails = fourreaux.map((f, index) => ({
      numero: index + 1,
      id: f.id,
      type: f.type,
      code: f.code,
      od: f.od.toFixed(1),
      idm: f.idm.toFixed(1),
      nbCables: cables.filter(c => c.parent === f.id).length,
      occupation: calculateFourreauOccupancy(f).toFixed(1)
    }));

    return stats;
  }

  async function loadLogoAsBase64() {
    try {
      // Charger le logo SVG CEAON et le rasterizer en PNG pour jsPDF
      const response = await fetch('../../assets/icons/ico/CEAON.svg');
      const svgText = await response.text();
      const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));

      // Extraire le ratio depuis le viewBox pour éviter toute déformation
      let viewBoxWidth = null;
      let viewBoxHeight = null;
      const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/i);
      if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          viewBoxWidth = parts[2];
          viewBoxHeight = parts[3];
        }
      }

      const img = new Image();
      img.src = svgBase64;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Utiliser les dimensions natives si dispo, sinon celles du viewBox, sinon fallback
      let w = img.naturalWidth || viewBoxWidth || 256;
      let h = img.naturalHeight || viewBoxHeight || 256;

      // Garder le ratio, et réduire seulement si c'est très grand pour limiter le poids
      const maxDim = 512;
      if (Math.max(w, h) > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.max(1, Math.floor(w * scale));
        h = Math.max(1, Math.floor(h * scale));
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const pngDataUrl = canvas.toDataURL('image/png');
      logPdf('logo CEAON.svg rasterized', { width: w, height: h });
      return pngDataUrl;
    } catch (error) {
      warnPdf('Impossible de charger le logo CEAON.svg:', error);
      return null;
    }
  }

  async function getImageDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({
        width: img.naturalWidth || img.width || 1,
        height: img.naturalHeight || img.height || 1
      });
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function getCanvasImageData() {
    // Créer un canvas temporaire haute résolution pour éviter la pixelisation
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // Dimensions du contenu utile (sans marges)
    const contentWidth = canvas.width - (CANVAS_MARGIN * 2 * pixelRatio);
    const contentHeight = canvas.height - (CANVAS_MARGIN * 2 * pixelRatio);

    // Multiplier par 2 pour améliorer la qualité d'export
    const exportScale = 2;
    tempCanvas.width = contentWidth * exportScale;
    tempCanvas.height = contentHeight * exportScale;

    // Activer l'antialiasing pour un rendu de meilleure qualité
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Copier le contenu utile du canvas principal avec scaling
    tempCtx.drawImage(
      canvas,
      CANVAS_MARGIN * pixelRatio, CANVAS_MARGIN * pixelRatio, // source x, y
      contentWidth, contentHeight, // source width, height
      0, 0, // destination x, y
      tempCanvas.width, tempCanvas.height // destination width, height (upscaled)
    );

    return tempCanvas.toDataURL('image/png', 1.0);
  }

  async function exportToPDF() {
    // Pour compatibilité avec l'ancienne modal HTML
    const formData = {
      projectName: document.getElementById('pdfProjectName')?.value || 'Projet TontonKAD',
      viewName: document.getElementById('pdfViewName')?.value || 'Vue principale',
      author: document.getElementById('pdfAuthor')?.value || 'TontonKAD',
      client: document.getElementById('pdfClient')?.value || '',
      description: document.getElementById('pdfDescription')?.value || '',
      includeStats: document.getElementById('pdfIncludeStats')?.checked || true
    };

    return exportToPDFWithData(formData);
  }

  async function loadJsPDFIfNeeded() {
    logPdf('Vérification de jsPDF...');
    logPdf('window.jsPDF:', typeof window.jsPDF);
    logPdf('window.jspdf:', typeof window.jspdf);
    logPdf('Objets window avec "pdf":', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));

    if (typeof window.jsPDF !== 'undefined') {
      logPdf('jsPDF déjà disponible');
      return; // Déjà chargé
    }

    logPdf('Chargement dynamique de jsPDF...');

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'jspdf.min.js';
      script.onload = () => {
        logPdf('Script jsPDF chargé');
        logPdf('Après chargement - window.jsPDF:', typeof window.jsPDF);
        logPdf('Après chargement - window.jspdf:', typeof window.jspdf);
        logPdf('Objets window avec "pdf":', Object.keys(window).filter(k => k.toLowerCase().includes('pdf')));

        // Attendre un peu que la lib s'initialise
        setTimeout(() => {
          logPdf('Après timeout - window.jsPDF:', typeof window.jsPDF);
          resolve();
        }, 100);
      };
      script.onerror = () => {
        reject(new Error('Impossible de charger jsPDF (script onerror)'));
      };
      document.head.appendChild(script);
    });
  }

  async function exportToPDFWithData(formData) {
    try {
      logPdf('exportToPDFWithData start', formData);
      console.time('[PDF] total');
      // Charger jsPDF si nécessaire
      await loadJsPDFIfNeeded();

      // Vérifier si jsPDF est maintenant disponible
      logPdf('Final check - window.jsPDF:', typeof window.jsPDF);
      logPdf('Final check - window.jspdf:', typeof window.jspdf);

      let jsPDFClass;
      if (typeof window.jsPDF !== 'undefined') {
        jsPDFClass = window.jsPDF.jsPDF || window.jsPDF;
        logPdf('Utilisation de window.jsPDF');
      } else if (typeof window.jspdf !== 'undefined') {
        jsPDFClass = window.jspdf.jsPDF || window.jspdf;
        logPdf('Utilisation de window.jspdf');
      } else if (typeof jsPDF !== 'undefined') {
        jsPDFClass = jsPDF;
        logPdf('Utilisation de jsPDF global');
      } else {
        throw new Error('Bibliothèque jsPDF non disponible après chargement');
      }

      logPdf('jsPDFClass résolue');

      // Créer le PDF en format A4 portrait
      const pdf = new jsPDFClass('portrait', 'mm', 'a4');
      logPdf('instance jsPDF créée');

      // Dimensions A4 portrait : 210 x 297 mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Charger le logo
      const logoBase64 = await loadLogoAsBase64();
      let logoInfo = null;
      if (logoBase64) {
        const dims = await getImageDimensions(logoBase64);
        logoInfo = { data: logoBase64, ...dims };
        logPdf('logo chargé (bytes)', logoBase64.length, 'dims', dims);
      } else {
        logPdf('logo non chargé');
      }

      // === EN-TÊTE EN 3 SECTIONS === //

      // SECTION 1 : Logo CEAHN (quart gauche)
      const headerHeight = 25;
      const leftQuarterWidth = contentWidth * 0.25;
      const middleWidth = contentWidth * 0.5;
      const rightQuarterWidth = contentWidth * 0.25;

      if (logoInfo) {
        // Respecter le ratio du logo
        const maxLogoWidth = leftQuarterWidth * 0.7; // laisse de l'air
        const maxLogoHeight = headerHeight * 0.85;
        const ratio = logoInfo.width / logoInfo.height;
        let logoW = maxLogoWidth;
        let logoH = logoW / ratio;
        if (logoH > maxLogoHeight) {
          logoH = maxLogoHeight;
          logoW = logoH * ratio;
        }
        const logoX = margin + (leftQuarterWidth - logoW) / 2;
        const logoY = margin + (headerHeight - logoH) / 2;
        pdf.addImage(logoInfo.data, 'PNG', logoX, logoY, logoW, logoH);
      }

      // SECTION 2 : Informations centrées (milieu)
      const middleStartX = margin + leftQuarterWidth;
      const middleCenterX = middleStartX + (middleWidth / 2);

      // Nom du projet (centré)
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      const projectNameWidth = pdf.getTextWidth(formData.projectName);
      pdf.text(formData.projectName, middleCenterX - (projectNameWidth / 2), margin + 8);

      // Nom de la vue (centré)
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const viewNameWidth = pdf.getTextWidth(formData.viewName);
      pdf.text(formData.viewName, middleCenterX - (viewNameWidth / 2), margin + 14);

      // Auteur (centré, sans date)
      if (formData.author) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'italic');
        const authorText = `Auteur: ${formData.author}`;
        const authorWidth = pdf.getTextWidth(authorText);
        pdf.text(authorText, middleCenterX - (authorWidth / 2), margin + 20);
      }

      // SECTION 3 : Image client (quart droit) - Préserver l'aspect ratio
      if (selectedImageBase64) {
        // Calculer les dimensions de l'image client pour préserver l'aspect ratio
        const tempClientImg = new Image();
        tempClientImg.src = selectedImageBase64;
        await new Promise(resolve => {
          tempClientImg.onload = resolve;
        });

        const rightStartX = margin + leftQuarterWidth + middleWidth;
        const availableWidth = rightQuarterWidth;
        const availableHeight = 20; // Hauteur max dans l'en-tête

        // Calculer les dimensions en préservant l'aspect ratio
        const clientAspectRatio = tempClientImg.width / tempClientImg.height;
        let clientImageWidth = Math.min(availableWidth * 0.9, 25); // Max 25mm
        let clientImageHeight = clientImageWidth / clientAspectRatio;

        // Si l'image est trop haute, ajuster par la hauteur
        if (clientImageHeight > availableHeight) {
          clientImageHeight = availableHeight;
          clientImageWidth = clientImageHeight * clientAspectRatio;
        }

        // Centrer l'image dans le quart droit
        const clientImageX = rightStartX + (availableWidth - clientImageWidth) / 2;
        const clientImageY = margin + (availableHeight - clientImageHeight) / 2;

        try {
          pdf.addImage(selectedImageBase64, 'JPEG', clientImageX, clientImageY, clientImageWidth, clientImageHeight);
          logPdf('client image added', { clientImageWidth, clientImageHeight, clientImageX, clientImageY });
        } catch (err) {
          errorPdf('addImage client failed', err);
          throw err;
        }
      }

      // Description si fournie
      if (formData.description) {
        pdf.setFontSize(10);
        pdf.text(formData.description, margin, margin + 35, {maxWidth: contentWidth - 70});
      }

      // Image du canvas au centre
      const canvasImage = getCanvasImageData();
      logPdf('canvas image captured (bytes)', canvasImage.length);
      const canvasStartY = margin + 45;
      const statsAreaHeight = formData.includeStats ? 75 : 0; // Plus d'espace pour les stats
      const canvasAreaHeight = contentHeight - 80 - statsAreaHeight; // Hauteur disponible pour l'image + cotes

      // Calculer les dimensions pour centrer l'image (format portrait) avec place pour les cotes
      const maxImageWidth = contentWidth * 0.85; // Agrandi pour un meilleur affichage
      const maxImageHeight = canvasAreaHeight - 15; // Optimisé pour plus d'espace

      // Obtenir les dimensions réelles de l'image canvas
      const tempImg = new Image();
      tempImg.src = canvasImage;
      await new Promise(resolve => {
        tempImg.onload = resolve;
      });

      const aspectRatio = tempImg.width / tempImg.height;
      let imageWidth = maxImageWidth;
      let imageHeight = imageWidth / aspectRatio;

      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight;
        imageWidth = imageHeight * aspectRatio;
      }

      const imageX = margin + (contentWidth - imageWidth) / 2;
      const imageY = canvasStartY + (canvasAreaHeight - imageHeight) / 2;

      try {
        pdf.addImage(canvasImage, 'PNG', imageX, imageY, imageWidth, imageHeight);
        logPdf('canvas image added', { imageWidth, imageHeight, imageX, imageY });
      } catch (err) {
        errorPdf('addImage canvas failed', err);
        throw err;
      }

      // Ajouter les cotes autour du canvas
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setDrawColor(100, 100, 100);
      pdf.setLineWidth(0.3);

      // Dimensions réelles du projet en mm
      const realWidth = WORLD_W_MM;
      const realHeight = WORLD_H_MM;

      // Cote horizontale (largeur) - en bas
      const dimensionY = imageY + imageHeight + 8;
      pdf.line(imageX, dimensionY, imageX + imageWidth, dimensionY);
      pdf.line(imageX, dimensionY - 2, imageX, dimensionY + 2);
      pdf.line(imageX + imageWidth, dimensionY - 2, imageX + imageWidth, dimensionY + 2);

      const widthText = `${realWidth} mm`;
      const widthTextWidth = pdf.getTextWidth(widthText);
      pdf.text(widthText, imageX + (imageWidth - widthTextWidth) / 2, dimensionY + 5);

      // Cote verticale (hauteur) - à droite
      const dimensionX = imageX + imageWidth + 8;
      pdf.line(dimensionX, imageY, dimensionX, imageY + imageHeight);
      pdf.line(dimensionX - 2, imageY, dimensionX + 2, imageY);
      pdf.line(dimensionX - 2, imageY + imageHeight, dimensionX + 2, imageY + imageHeight);

      const heightText = `${realHeight} mm`;

      // Texte horizontal pour la hauteur (plus simple et lisible)
      pdf.text(heightText, dimensionX + 3, imageY + imageHeight / 2 + 2);

      // Statistiques en bas
      if (formData.includeStats) {
        const stats = generatePdfStats();
        logPdf('stats', stats);
        const statsY = pageHeight - 70; // Encore plus haut pour être sûr

        console.log(`Stats position: Y=${statsY}, pageHeight=${pageHeight}`);

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('STATISTIQUES DU PROJET', margin, statsY);

        // Rectangle de fond pour les stats
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, statsY + 2, contentWidth, 40, 'F');

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        let col1X = margin + 5;
        let col2X = margin + 70;
        let col3X = margin + 135;
        let statsLineY = statsY + 12;

        // === SECTION INVENTAIRE === //
        pdf.setFont('helvetica', 'bold');
        pdf.text('Inventaire', col1X, statsLineY);
        pdf.setFont('helvetica', 'normal');
        statsLineY += 6;
        pdf.text(`• Fourreaux: ${stats.fourreaux}`, col1X + 2, statsLineY);
        pdf.text(`• Câbles: ${stats.cables}`, col2X, statsLineY);

        // === SECTION OCCUPATION === //
        statsLineY += 8;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Taux d\'occupation', col1X, statsLineY);
        pdf.setFont('helvetica', 'normal');
        statsLineY += 6;

        // Occupation globale
        pdf.text(`• Conteneur: ${stats.occupation}%`, col1X + 2, statsLineY);

        // Fourreau le plus chargé et alertes
        if (stats.fourreauxDetails && stats.fourreauxDetails.length > 0) {
          const maxOccupation = stats.fourreauxDetails.reduce((max, f) => Math.max(max, parseFloat(f.occupation)), 0).toFixed(1);
          const fourreauMaxIdx = stats.fourreauxDetails.findIndex(f => parseFloat(f.occupation) === parseFloat(maxOccupation));
          pdf.text(`• Max fourreau: ${maxOccupation}% (#${fourreauMaxIdx + 1})`, col2X, statsLineY);

          // Fourreaux surchargés (>50%)
          const fourreauxSaturés = stats.fourreauxDetails.filter(f => parseFloat(f.occupation) > 50).length;
          if (fourreauxSaturés > 0) {
            statsLineY += 6;
            pdf.setTextColor(255, 0, 0);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`⚠ Attention: ${fourreauxSaturés} fourreau(x) saturé(s) (>50%)`, col1X + 2, statsLineY);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');
          }
        }

        // === SECTION DIMENSIONS === //
        statsLineY += 8;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Conteneur', col1X, statsLineY);
        pdf.setFont('helvetica', 'normal');
        statsLineY += 6;
        pdf.text(`• Dimensions: ${stats.dimensions.width} x ${stats.dimensions.height} m`, col1X + 2, statsLineY);

        const surfaceM2 = (parseFloat(stats.dimensions.width) * parseFloat(stats.dimensions.height)).toFixed(2);
        pdf.text(`• Surface: ${surfaceM2} m²`, col2X, statsLineY);

        // Ligne finale avec timestamp
        statsLineY += 10;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(100, 100, 100);
        const dateStr = new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
        pdf.text(`Généré par TontonKAD le ${dateStr}`, col1X, statsLineY);
        pdf.setTextColor(0, 0, 0);

        // === NOUVELLE PAGE : DÉTAIL DES FOURREAUX === //
        if (stats.fourreauxDetails && stats.fourreauxDetails.length > 0) {
          pdf.addPage();

          // Titre
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('DÉTAIL DES FOURREAUX', margin, margin + 10);

          // Note explicative
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.text('Les numéros correspondent aux étiquettes affichées sur le schéma (page précédente)', margin, margin + 17);

          // Configuration du tableau
          const tableStartY = margin + 25;
          const rowHeight = 7;
          const colWidths = {
            numero: 12,
            nom: 22,
            type: 48,
            code: 42,
            nbCables: 18,
            occupation: 38
          };
          // Total: 180mm (contentWidth)

          // En-tête du tableau
          pdf.setFillColor(41, 128, 185); // Bleu
          pdf.setDrawColor(0, 0, 0); // Bordures noires
          pdf.setTextColor(255, 255, 255); // Blanc
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');

          // Dessiner un grand rectangle de fond pour toute la ligne d'en-tête
          const totalWidth = colWidths.numero + colWidths.nom + colWidths.type + colWidths.code + colWidths.nbCables + colWidths.occupation;
          pdf.rect(margin, tableStartY, totalWidth, rowHeight, 'FD');

          // Écrire les textes d'en-tête
          let currentX = margin;
          pdf.text('N°', currentX + 2, tableStartY + 5);
          currentX += colWidths.numero;

          pdf.text('Nom', currentX + 2, tableStartY + 5);
          currentX += colWidths.nom;

          pdf.text('Type', currentX + 2, tableStartY + 5);
          currentX += colWidths.type;

          pdf.text('Code', currentX + 2, tableStartY + 5);
          currentX += colWidths.code;

          pdf.text('Câbles', currentX + 2, tableStartY + 5);
          currentX += colWidths.nbCables;

          pdf.text('Occupation', currentX + 2, tableStartY + 5);

          // Lignes de données
          pdf.setTextColor(0, 0, 0); // Noir
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);

          let currentY = tableStartY + rowHeight;
          stats.fourreauxDetails.forEach((f, idx) => {
            // Vérifier si on doit changer de page
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = margin + 10;

              // Répéter l'en-tête sur la nouvelle page
              pdf.setFillColor(41, 128, 185);
              pdf.setDrawColor(0, 0, 0);
              pdf.setTextColor(255, 255, 255);
              pdf.setFont('helvetica', 'bold');

              // Dessiner un grand rectangle pour l'en-tête
              const headerTotalWidth = colWidths.numero + colWidths.nom + colWidths.type + colWidths.code + colWidths.nbCables + colWidths.occupation;
              pdf.rect(margin, currentY, headerTotalWidth, rowHeight, 'FD');

              // Écrire les textes
              let headerX = margin;
              pdf.text('N°', headerX + 2, currentY + 5);
              headerX += colWidths.numero;
              pdf.text('Nom', headerX + 2, currentY + 5);
              headerX += colWidths.nom;
              pdf.text('Type', headerX + 2, currentY + 5);
              headerX += colWidths.type;
              pdf.text('Code', headerX + 2, currentY + 5);
              headerX += colWidths.code;
              pdf.text('Câbles', headerX + 2, currentY + 5);
              headerX += colWidths.nbCables;
              pdf.text('Occupation', headerX + 2, currentY + 5);

              currentY += rowHeight;
              pdf.setTextColor(0, 0, 0);
              pdf.setFont('helvetica', 'normal');
            }

            // Couleur alternée pour les lignes
            if (idx % 2 === 0) {
              pdf.setFillColor(248, 250, 252);
              pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
            }

            // Coloration selon le taux d'occupation
            const occupationRate = parseFloat(f.occupation);
            let occupationColor = [0, 128, 0]; // Vert par défaut (< 33%)
            if (occupationRate > 50) {
              occupationColor = [255, 0, 0]; // Rouge si > 50%
            } else if (occupationRate >= 33) {
              occupationColor = [255, 165, 0]; // Orange si 33-50%
            }

            currentX = margin;

            // Bordures
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(currentX, currentY, colWidths.numero, rowHeight);
            pdf.text(String(f.numero), currentX + 2, currentY + 5);
            currentX += colWidths.numero;

            // Nom du fourreau (label personnalisé ou auto-généré)
            pdf.rect(currentX, currentY, colWidths.nom, rowHeight);
            const fourreauObj = fourreaux.find(fo => fo.id === f.id);
            const nomFourreau = (fourreauObj && fourreauObj.customLabel) || `F${f.numero}`;
            pdf.text(nomFourreau, currentX + 2, currentY + 5);
            currentX += colWidths.nom;

            pdf.rect(currentX, currentY, colWidths.type, rowHeight);
            const typeText = f.type.length > 20 ? f.type.substring(0, 17) + '...' : f.type;
            pdf.text(typeText, currentX + 2, currentY + 5);
            currentX += colWidths.type;

            pdf.rect(currentX, currentY, colWidths.code, rowHeight);
            const codeText = f.code.length > 18 ? f.code.substring(0, 15) + '...' : f.code;
            pdf.text(codeText, currentX + 2, currentY + 5);
            currentX += colWidths.code;

            pdf.rect(currentX, currentY, colWidths.nbCables, rowHeight);
            pdf.text(String(f.nbCables), currentX + 2, currentY + 5);
            currentX += colWidths.nbCables;

            pdf.rect(currentX, currentY, colWidths.occupation, rowHeight);
            pdf.setTextColor(...occupationColor);
            pdf.setFont('helvetica', 'bold');
            pdf.text(f.occupation + ' %', currentX + 2, currentY + 5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);

            currentY += rowHeight;
          });

          // Légende des couleurs
          currentY += 5;
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');

          pdf.setFillColor(0, 128, 0);
          pdf.circle(margin + 2, currentY + 1, 1.5, 'F');
          pdf.text('Occupation < 33% (OK)', margin + 6, currentY + 2);

          pdf.setFillColor(255, 165, 0);
          pdf.circle(margin + 50, currentY + 1, 1.5, 'F');
          pdf.text('Occupation 33-50% (Attention)', margin + 54, currentY + 2);

          pdf.setFillColor(255, 0, 0);
          pdf.circle(margin + 110, currentY + 1, 1.5, 'F');
          pdf.text('Occupation > 50% (Saturé)', margin + 114, currentY + 2);
        }

        // === NOUVELLE PAGE : LISTING DÉTAILLÉ DES CÂBLES === //
        if (cables.length > 0) {
          pdf.addPage();

          // Titre
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('LISTING DÉTAILLÉ DES CÂBLES', margin, margin + 10);

          // Configuration du tableau
          const tableStartY = margin + 20;
          const rowHeight = 6;
          const colWidths = {
            numero: 10,
            nom: 18,
            famille: 45,
            section: 25,
            localisation: 55,
            phase: 27
          };
          // Total: 180mm (contentWidth)

          // En-tête du tableau
          pdf.setFillColor(52, 152, 219); // Bleu clair
          pdf.setDrawColor(0, 0, 0); // Bordures noires
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');

          // Dessiner un grand rectangle de fond pour toute la ligne d'en-tête
          const totalWidth = colWidths.numero + colWidths.nom + colWidths.famille + colWidths.section + colWidths.localisation + colWidths.phase;
          pdf.rect(margin, tableStartY, totalWidth, rowHeight, 'FD');

          // Écrire les textes d'en-tête
          let currentX = margin;
          pdf.text('N°', currentX + 2, tableStartY + 4);
          currentX += colWidths.numero;

          pdf.text('Nom', currentX + 2, tableStartY + 4);
          currentX += colWidths.nom;

          pdf.text('Famille', currentX + 2, tableStartY + 4);
          currentX += colWidths.famille;

          pdf.text('Section', currentX + 2, tableStartY + 4);
          currentX += colWidths.section;

          pdf.text('Localisation', currentX + 2, tableStartY + 4);
          currentX += colWidths.localisation;

          pdf.text('Phase', currentX + 2, tableStartY + 4);

          // Lignes de données
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);

          let currentY = tableStartY + rowHeight;
          cables.forEach((c, idx) => {
            // Vérifier si on doit changer de page
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = margin + 10;

              // Répéter l'en-tête
              pdf.setFillColor(52, 152, 219);
              pdf.setDrawColor(0, 0, 0);
              pdf.setTextColor(255, 255, 255);
              pdf.setFont('helvetica', 'bold');

              // Dessiner un grand rectangle pour l'en-tête
              const headerTotalWidth = colWidths.numero + colWidths.nom + colWidths.famille + colWidths.section + colWidths.localisation + colWidths.phase;
              pdf.rect(margin, currentY, headerTotalWidth, rowHeight, 'FD');

              // Écrire les textes
              let headerX = margin;
              pdf.text('N°', headerX + 2, currentY + 4);
              headerX += colWidths.numero;
              pdf.text('Nom', headerX + 2, currentY + 4);
              headerX += colWidths.nom;
              pdf.text('Famille', headerX + 2, currentY + 4);
              headerX += colWidths.famille;
              pdf.text('Section', headerX + 2, currentY + 4);
              headerX += colWidths.section;
              pdf.text('Localisation', headerX + 2, currentY + 4);
              headerX += colWidths.localisation;
              pdf.text('Phase', headerX + 2, currentY + 4);

              currentY += rowHeight;
              pdf.setTextColor(0, 0, 0);
              pdf.setFont('helvetica', 'normal');
            }

            // Couleur alternée
            if (idx % 2 === 0) {
              pdf.setFillColor(248, 250, 252);
              pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
            }

            currentX = margin;

            // Bordures et contenu
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(currentX, currentY, colWidths.numero, rowHeight);
            pdf.text(String(idx + 1), currentX + 2, currentY + 4);
            currentX += colWidths.numero;

            // Nom du câble (depuis la couleur, ou label personnalisé, ou numéro)
            pdf.rect(currentX, currentY, colWidths.nom, rowHeight);
            let nomCable = `L${idx + 1}`; // Par défaut
            if (c.customColor) {
              const phaseFromColor = getPhaseFromColor(c.customColor);
              if (phaseFromColor) {
                nomCable = phaseFromColor;
              }
            } else if (c.customLabel) {
              nomCable = c.customLabel;
            }
            pdf.text(nomCable, currentX + 2, currentY + 4);
            currentX += colWidths.nom;

            pdf.rect(currentX, currentY, colWidths.famille, rowHeight);
            const famText = c.fam.length > 28 ? c.fam.substring(0, 25) + '...' : c.fam;
            pdf.text(famText, currentX + 2, currentY + 4);
            currentX += colWidths.famille;

            pdf.rect(currentX, currentY, colWidths.section, rowHeight);
            const sectionText = c.code + '²';
            pdf.text(sectionText, currentX + 2, currentY + 4);
            currentX += colWidths.section;

            pdf.rect(currentX, currentY, colWidths.localisation, rowHeight);
            let locText = 'Hors fourreau';
            if (c.parent) {
              const parentIdx = fourreaux.findIndex(f => f.id === c.parent);
              if (parentIdx !== -1) {
                locText = `Fourreau #${parentIdx + 1}`;
              }
            }
            pdf.text(locText, currentX + 2, currentY + 4);
            currentX += colWidths.localisation;

            pdf.rect(currentX, currentY, colWidths.phase, rowHeight);
            let phaseText = 'N/A';
            if (c.customColor) {
              const phaseFromColor = getPhaseFromColor(c.customColor);
              if (phaseFromColor) {
                phaseText = phaseFromColor;
              }
            }
            pdf.text(phaseText, currentX + 2, currentY + 4);

            currentY += rowHeight;
          });

          // Résumé
          currentY += 5;
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Total: ${cables.length} câble(s)`, margin, currentY);
        }

        // === NOUVELLE PAGE : LISTING DÉTAILLÉ DES FOURREAUX === //
        if (fourreaux.length > 0) {
          pdf.addPage();

          // Titre
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('LISTING DÉTAILLÉ DES FOURREAUX', margin, margin + 10);

          // Configuration du tableau
          const tableStartY = margin + 20;
          const rowHeight = 6;
          const colWidths = {
            numero: 10,
            nom: 20,
            type: 45,
            code: 38,
            nbCables: 20,
            cables: 47
          };
          // Total: 180mm (contentWidth)

          // En-tête du tableau
          pdf.setFillColor(46, 204, 113); // Vert
          pdf.setDrawColor(0, 0, 0); // Bordures noires
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');

          // Dessiner un grand rectangle de fond pour toute la ligne d'en-tête
          const totalWidth = colWidths.numero + colWidths.nom + colWidths.type + colWidths.code + colWidths.nbCables + colWidths.cables;
          pdf.rect(margin, tableStartY, totalWidth, rowHeight, 'FD');

          // Écrire les textes d'en-tête
          let currentX = margin;
          pdf.text('N°', currentX + 2, tableStartY + 4);
          currentX += colWidths.numero;

          pdf.text('Nom', currentX + 2, tableStartY + 4);
          currentX += colWidths.nom;

          pdf.text('Type', currentX + 2, tableStartY + 4);
          currentX += colWidths.type;

          pdf.text('Code', currentX + 2, tableStartY + 4);
          currentX += colWidths.code;

          pdf.text('Nb câbles', currentX + 2, tableStartY + 4);
          currentX += colWidths.nbCables;

          pdf.text('Liste câbles', currentX + 2, tableStartY + 4);

          // Lignes de données
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);

          let currentY = tableStartY + rowHeight;
          fourreaux.forEach((f, idx) => {
            // Vérifier si on doit changer de page
            if (currentY > pageHeight - 30) {
              pdf.addPage();
              currentY = margin + 10;

              // Répéter l'en-tête
              pdf.setFillColor(46, 204, 113);
              pdf.setDrawColor(0, 0, 0);
              pdf.setTextColor(255, 255, 255);
              pdf.setFont('helvetica', 'bold');

              // Dessiner un grand rectangle pour l'en-tête
              const headerTotalWidth = colWidths.numero + colWidths.nom + colWidths.type + colWidths.code + colWidths.nbCables + colWidths.cables;
              pdf.rect(margin, currentY, headerTotalWidth, rowHeight, 'FD');

              // Écrire les textes
              let headerX = margin;
              pdf.text('N°', headerX + 2, currentY + 4);
              headerX += colWidths.numero;
              pdf.text('Nom', headerX + 2, currentY + 4);
              headerX += colWidths.nom;
              pdf.text('Type', headerX + 2, currentY + 4);
              headerX += colWidths.type;
              pdf.text('Code', headerX + 2, currentY + 4);
              headerX += colWidths.code;
              pdf.text('Nb câbles', headerX + 2, currentY + 4);
              headerX += colWidths.nbCables;
              pdf.text('Liste câbles', headerX + 2, currentY + 4);

              currentY += rowHeight;
              pdf.setTextColor(0, 0, 0);
              pdf.setFont('helvetica', 'normal');
            }

            // Couleur alternée
            if (idx % 2 === 0) {
              pdf.setFillColor(248, 250, 252);
              pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
            }

            currentX = margin;

            // Bordures et contenu
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(currentX, currentY, colWidths.numero, rowHeight);
            pdf.text(String(idx + 1), currentX + 2, currentY + 4);
            currentX += colWidths.numero;

            // Nom du fourreau
            pdf.rect(currentX, currentY, colWidths.nom, rowHeight);
            const nomFourreau = (f.customLabel) || `F${idx + 1}`;
            pdf.text(nomFourreau, currentX + 2, currentY + 4);
            currentX += colWidths.nom;

            pdf.rect(currentX, currentY, colWidths.type, rowHeight);
            const typeText = f.type.length > 23 ? f.type.substring(0, 20) + '...' : f.type;
            pdf.text(typeText, currentX + 2, currentY + 4);
            currentX += colWidths.type;

            pdf.rect(currentX, currentY, colWidths.code, rowHeight);
            const codeText = f.code.length > 20 ? f.code.substring(0, 17) + '...' : f.code;
            pdf.text(codeText, currentX + 2, currentY + 4);
            currentX += colWidths.code;

            // Compter les câbles dans ce fourreau
            const cablesInFourreau = cables.filter(c => c.parent === f.id);
            pdf.rect(currentX, currentY, colWidths.nbCables, rowHeight);
            pdf.text(String(cablesInFourreau.length), currentX + 2, currentY + 4);
            currentX += colWidths.nbCables;

            // Liste des noms des câbles
            pdf.rect(currentX, currentY, colWidths.cables, rowHeight);
            if (cablesInFourreau.length > 0) {
              const cableNames = cablesInFourreau.map(c => {
                const cIdx = cables.findIndex(cable => cable.id === c.id);
                // Déterminer le nom depuis la couleur
                if (c.customColor) {
                  const phaseFromColor = getPhaseFromColor(c.customColor);
                  if (phaseFromColor) return phaseFromColor;
                }
                return c.customLabel || `L${cIdx + 1}`;
              }).join(', ');
              const namesText = cableNames.length > 20 ? cableNames.substring(0, 17) + '...' : cableNames;
              pdf.text(namesText, currentX + 2, currentY + 4);
            } else {
              pdf.text('Aucun', currentX + 2, currentY + 4);
            }

            currentY += rowHeight;
          });

          // Résumé
          currentY += 5;
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Total: ${fourreaux.length} fourreau(x)`, margin, currentY);
        }
      }

      // Sauvegarder le PDF avec horodatage
      const now = new Date();
      const dateStr = now.toISOString().slice(0,10); // YYYY-MM-DD
      const timeStr = now.toTimeString().slice(0,8).replace(/:/g, '-'); // HH-MM-SS
      const fileName = `${formData.projectName.replace(/[^a-z0-9]/gi, '_')}_${dateStr}_${timeStr}.pdf`;
      logPdf('saving file', fileName);
      try {
        pdf.save(fileName);
      } catch (err) {
        errorPdf('pdf.save failed', err);
        throw err;
      }

      // Reset de l'image sélectionnée pour éviter le cache
      selectedImageBase64 = null;

      showToast('Export PDF terminé !');
      closePdfExportModal();

      console.timeEnd('[PDF] total');

    } catch (error) {
      errorPdf('Erreur export PDF:', error);
      showToast('Erreur lors de l\'export PDF: ' + error.message);
      // Reset de l'image même en cas d'erreur
      selectedImageBase64 = null;
    }
  }

  /* ====== Initialisation & Écouteurs d'événements ====== */
  async function init() {
    // 1. Charger les données en premier
    try {
      await loadData();
    } catch (error) {
      // Afficher un message d'erreur clair et bloquer l'application
      panel.innerHTML = `<div class="p-4 text-red-500 bg-red-100 border border-red-400 rounded"><b>Erreur critique :</b><br>Impossible de charger les fichiers de données (<code>./data/fourreaux.csv</code>, <code>./data/cables.csv</code>, ou <code>./data/chemins_de_cable.csv</code>).<br><br>Assurez-vous qu'ils sont présents dans le dossier <code>app/data/</code> et que leur format est correct.</div>`;
      document.querySelector('.canvas-wrap').innerHTML = ''; // Vider la zone du canvas
      return; // Arrêter l'initialisation
    }

    // Création dynamique des contrôles pour "chemin de câble"
    cheminCableInputs = document.createElement('div');
    cheminCableInputs.id = 'cheminCableInputs';
    cheminCableInputs.className = 'hidden'; // Conteneur principal

    const row = document.createElement('div');
    row.className = 'row';
    const cheminCableLabel = document.createElement('label');
    cheminCableLabel.htmlFor = 'cheminCableSelect';
    cheminCableLabel.textContent = 'Dimensions';
    cheminCableSelect = document.createElement('select');
    cheminCableSelect.id = 'cheminCableSelect';
    row.appendChild(cheminCableLabel);
    row.appendChild(cheminCableSelect);

    const applyBtnContainer = document.createElement('div');
    applyBtnContainer.className = 'apply-dimensions-btn';
    const newApplyBtn = document.createElement('button');
    newApplyBtn.className = 'btn';
    newApplyBtn.textContent = 'Appliquer les dimensions';
    newApplyBtn.addEventListener('click', applyDimensions);
    applyBtnContainer.appendChild(newApplyBtn);

    cheminCableInputs.appendChild(row);
    cheminCableInputs.appendChild(applyBtnContainer);

    // Insérer après le groupe d'inputs rectangulaires
    if (rectInputs && rectInputs.parentNode) {
      rectInputs.parentNode.insertBefore(cheminCableInputs, rectInputs.nextSibling);
    }


    // 2. Remplir les menus déroulants avec les données chargées
    initSearchableLists();
    setupShapeDropdown();

    // 3. Attacher les écouteurs d'événements
    addEventListener("resize", fitCanvas);
    targetPxPerMmInput.addEventListener("input", fitCanvas);

    // Gestionnaire de zoom par molette (Ctrl+molette)
    canvas.addEventListener("wheel", (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    });

    // Gestionnaire global pour Ctrl+Z et Ctrl+Suppr
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        restorePreviousState();
      } else if (e.ctrlKey && e.key === 'Delete') {
        e.preventDefault();
        // Sauvegarder l'état avant de tout vider
        saveStateToHistory();
        // Déclencher la fonction de vidage
        document.getElementById('clear').click();
      }
    });
    searchCable.addEventListener('input', updateInventory);
    searchFourreau.addEventListener('input', updateInventory);
    toolDelete.addEventListener('click', () => { setMode('delete'); if (selected) deleteSelected(); });

    const toolEdit = document.getElementById('toolEdit');
    const toolInfo = document.getElementById('toolInfo');
    const gridArrange = document.getElementById('gridArrange');

    if (toolEdit) toolEdit.addEventListener('click', openEditPopup);
    if (toolInfo) toolInfo.addEventListener('click', toggleShowInfo);
    if (gridArrange) gridArrange.addEventListener('click', arrangeConduitGrid);
    if (freezeBtn) freezeBtn.addEventListener('click', toggleFreezeSelected);
    canvas.addEventListener('mousedown', e => {
      const p = canvasCoords(e);
      if (e.button === 0) { // Clic gauche : sélection + glisser-déposer
        // Gérer le mode collage en priorité
        if (pasteMode) {
          pasteAtPosition(p.x, p.y);
          deactivatePasteMode();
          return;
        }

        const pick = pickAt(p.x, p.y);

        if (e.ctrlKey || e.metaKey) { // Sélection multiple avec Ctrl
          if (pick) {
            handleMultipleSelection(pick);
          }
          updateSelectedInfo();
          redraw();
          return;
        }

        // Sélection simple (comportement classique)
        if (pick) {
          selected = pick;
          selectedMultiple = []; // Réinitialiser sélection multiple
          const obj = pick.type === 'fourreau' ? fourreaux.find(o => o.id === pick.id) : cables.find(o => o.id === pick.id);
          if (obj) {
            obj.dragging = true; obj.vx = 0; obj.vy = 0;
            startDrag(obj, selected);
          }
        } else {
          // Clic sur le vide = démarrer la sélection par rectangle
          startMarqueeSelection(e);
        }
        updateSelectedInfo();
        redraw();
        return;
      }
      if (e.button === 1) { // Clic molette : placement
        e.preventDefault(); // Empêcher le comportement par défaut du clic molette
        if (activeTab === 'FOURREAU') {
          const v = selectedFourreau;
          if (!v) { showToast('Choisis un fourreau.'); return; }
          const [type, code] = v.split('|');
          addFourreauAt(p.x, p.y, type, code) || showToast('Emplacement occupé ou hors boîte.');
        } else {
          const v = selectedCable;
          if (!v) { showToast('Choisis un CÂBLE.'); return; }
          const [fam, code] = v.split('|');
          const f = findFourreauUnder(p.x, p.y, null);
          addCableAt(p.x, p.y, fam, code, f) || showToast('Impossible de poser le CÂBLE ici.');
        }
        return;
      }
      if (e.button === 2) { // Clic droit : édition
        e.preventDefault();
        const pick = pickAt(p.x, p.y);
        if (pick) {
          selected = pick;
          selectedMultiple = []; // Réinitialiser sélection multiple
          updateSelectedInfo();
          redraw();
          // Ouvrir la popup d'édition aux coordonnées du clic
          openEditPopup(e.clientX, e.clientY);
        }
        return;
      }
    });
    tabFOURREAU.addEventListener('click', () => setTab('FOURREAU'));
    tabCABLE.addEventListener('click', () => setTab('CÂBLE'));
    shapeSel.addEventListener('change', handleShapeSelectorChange);
    applyBtn.addEventListener('click', applyDimensions);
    applyCircBtn.addEventListener('click', applyDimensions);

    // Appliquer les dimensions avec la touche Entrée
    function handleDimensionEnter(e) {
      if (e.key === 'Enter') {
        applyDimensions();
      }
    }
    boxWInput.addEventListener('keydown', handleDimensionEnter);
    boxHInput.addEventListener('keydown', handleDimensionEnter);
    boxDInput.addEventListener('keydown', handleDimensionEnter);

    // Export PDF
    const exportPDF = document.getElementById('exportPDF');
    const confirmPdfExport = document.getElementById('confirmPdfExport');
    const cancelPdfExport = document.getElementById('cancelPdfExport');
    const closePdfExportBtn = document.getElementById('closePdfExportModal');
    const pdfExportModal = document.getElementById('pdfExportModal');
    const pdfDescription = document.getElementById('pdfDescription');
    const pdfDescriptionCounter = document.getElementById('pdfDescriptionCounter');
    const exportDXFBtn = document.getElementById('exportDXF');
    const clearBtn = document.getElementById('clear');
    const reduceToMinimumBtn = document.getElementById('reduceToMinimum');

    if (exportPDF) {
      exportPDF.addEventListener('click', openPdfExportModal);
    } else {
      console.error('[PDF] exportPDF button not found!');
    }
    if (confirmPdfExport) confirmPdfExport.addEventListener('click', exportToPDF);
    if (cancelPdfExport) cancelPdfExport.addEventListener('click', closePdfExportModal);
    if (closePdfExportBtn) closePdfExportBtn.addEventListener('click', closePdfExportModal);

    // Compteur de caractères pour la description
    if (pdfDescription && pdfDescriptionCounter) {
      pdfDescription.addEventListener('input', () => {
        pdfDescriptionCounter.textContent = pdfDescription.value.length;
      });
    }

    // Fermer le modal en cliquant en dehors
    if (pdfExportModal) {
      pdfExportModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          closePdfExportModal();
        }
      });
    }

    // Fermer le modal avec Échap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('pdfExportModal');
        if (modal && modal.style.display === 'flex') {
          closePdfExportModal();
        }
      }
    });

    // Exposer les fonctions globalement pour les onclick du HTML
    window.closePdfExportModal = closePdfExportModal;

    if (exportDXFBtn) exportDXFBtn.addEventListener('click', exportDXF);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        fourreaux.length = 0;
        cables.length = 0;
        selected = null;
        updateStats();
        updateInventory();
        updateSelectedInfo();
        hideReduceButton(); // Cacher le bouton de réduction
        redraw();
      });
    }

    // Event listener pour le bouton de réduction
    if (reduceToMinimumBtn) reduceToMinimumBtn.addEventListener('click', reduceToMinimum);
    
    // Fonction utilitaire pour gérer les changements de couleur des câbles
    function handleCableColorChange(obj, selectedPhase, colorInputValue) {
      // Vérifier si une couleur personnalisée a été définie
      const defaultColor = colorForCable(obj.fam, obj.code);
      const currentColor = colorInputValue;
      
      // Priorité : couleur personnalisée > couleur du conducteur > couleur par défaut
      if (currentColor !== hslToHex(defaultColor) && 
          (!selectedPhase || selectedPhase === 'none' || currentColor !== PHASE_COLORS[selectedPhase])) {
        // L'utilisateur a choisi une couleur personnalisée différente
        obj.customColor = currentColor;
      } else if (selectedPhase && selectedPhase !== 'none') {
        // Utiliser la couleur du conducteur sélectionné
        obj.customColor = PHASE_COLORS[selectedPhase];
      } else {
        // Revenir à la couleur par défaut
        obj.customColor = null;
      }
    }
    
    // Créer la grille de couleurs AutoCAD
    function createColorGrid() {
      const colorGrid = document.getElementById('colorGrid');
      colorGrid.innerHTML = ''; // Vider la grille existante
      
      AUTOCAD_COLORS.forEach((colorData, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = colorData.hex;
        swatch.title = `ACI ${colorData.aci} - ${colorData.hex}`;
        swatch.dataset.aci = colorData.aci;
        swatch.dataset.hex = colorData.hex;
        
        swatch.addEventListener('click', () => {
          // Appliquer cette couleur à la sélection
          const colorInput = document.getElementById('editColor');
          colorInput.value = colorData.hex;
          
          // Marquer comme sélectionné visuellement
          document.querySelectorAll('.color-swatch.selected').forEach(s => s.classList.remove('selected'));
          swatch.classList.add('selected');
          
          // Déclencher l'événement de changement de couleur
          colorInput.dispatchEvent(new Event('change'));
          
          // Fermer le dropdown après sélection
          closeColorDropdown();
        });
        
        colorGrid.appendChild(swatch);
      });
    }
    
    // Mettre à jour la grille selon la couleur actuelle
    function updateColorGridSelection(currentHex) {
      document.querySelectorAll('.color-swatch.selected').forEach(s => s.classList.remove('selected'));
      
      if (currentHex) {
        const matchingSwatch = document.querySelector(`.color-swatch[data-hex="${currentHex.toUpperCase()}"]`);
        if (matchingSwatch) {
          matchingSwatch.classList.add('selected');
        }
      }
    }

    // Synchroniser la couleur affichée quand on change de conducteur (phase)
    function syncColorInputWithPhase(phase) {
      const colorInput = document.getElementById('editColor');
      if (!colorInput) return;

      if (phase && phase !== 'none') {
        colorInput.value = PHASE_COLORS[phase] || colorInput.value;
      } else {
        const target = selectedMultiple.length > 0 ? selectedMultiple[0] : selected;
        if (target && target.type === 'cable') {
          const cable = cables.find(c => c.id === target.id);
          if (cable) {
            const base = cable.customColor
              || (cable.selectedPhase && cable.selectedPhase !== 'none' ? PHASE_COLORS[cable.selectedPhase] : null)
              || cable.color
              || colorForCable(cable.fam, cable.code);
            colorInput.value = hslToHex(base);
          }
        }
      }
      updateColorGridSelection(colorInput.value);
    }

    // Gestion du dropdown des couleurs AutoCAD
    function toggleColorDropdown() {
      const dropdown = document.getElementById('colorDropdown');
      const btn = document.getElementById('autocadColorBtn');
      
      if (dropdown.classList.contains('show')) {
        closeColorDropdown();
      } else {
        openColorDropdown();
      }
    }

    function openColorDropdown() {
      const dropdown = document.getElementById('colorDropdown');
      const btn = document.getElementById('autocadColorBtn');
      
      dropdown.classList.add('show');
      btn.classList.add('active');
    }

    function closeColorDropdown() {
      const dropdown = document.getElementById('colorDropdown');
      const btn = document.getElementById('autocadColorBtn');
      
      dropdown.classList.remove('show');
      btn.classList.remove('active');
    }

    // Fonctions popup d'édition
    function openEditPopup(mouseX, mouseY) {
      // Vérifier s'il y a une sélection simple ou multiple
      if (!selected && selectedMultiple.length === 0) {
        showToast('Sélectionnez un ou plusieurs objets pour les éditer (clic gauche + Ctrl)');
        return;
      }

      let obj = null;
      let isMultiple = false;

      if (selectedMultiple.length > 0) {
        // Sélection multiple - prendre le premier pour les valeurs par défaut
        isMultiple = true;
        obj = selectedMultiple[0].type === 'fourreau'
          ? fourreaux.find(f => f.id === selectedMultiple[0].id)
          : cables.find(c => c.id === selectedMultiple[0].id);
      } else {
        // Sélection simple
        obj = selected.type === 'fourreau'
          ? fourreaux.find(f => f.id === selected.id)
          : cables.find(c => c.id === selected.id);
      }

      if (!obj) return;

      const popup = document.getElementById('editPopup');
      const popupContent = popup.querySelector('.edit-popup-content');
      const labelInput = document.getElementById('editLabel');
      const colorInput = document.getElementById('editColor');
      const phaseSection = document.getElementById('cablePhaseSection');
      const fourreauFillSection = document.getElementById('fourreauFillSection');
      
      // Mettre à jour le titre du popup pour indiquer la sélection multiple
      const popupTitle = popup.querySelector('h3');
      if (isMultiple) {
        const type = selectedMultiple[0].type === 'fourreau' ? 'fourreaux' : 'câbles';
        popupTitle.textContent = `Éditer ${selectedMultiple.length} ${type}`;
        labelInput.placeholder = 'Libellé (appliqué à tous)';
      } else {
        const type = selected.type === 'fourreau' ? 'fourreau' : 'câble';
        popupTitle.textContent = `Éditer le ${type}`;
        labelInput.placeholder = 'Libellé';
      }
      
      // Remplir les champs avec les valeurs actuelles (du premier élément si multiple)
      labelInput.value = isMultiple ? '' : (obj.label || '');
      
      // Déterminer la couleur à afficher selon la priorité
      let displayColor;
      const currentType = isMultiple ? selectedMultiple[0].type : selected.type;
      if (currentType === 'fourreau') {
        const defaultColor = colorForFourreau(obj.type, obj.code);
        displayColor = obj.customColor || obj.color || defaultColor;
      } else {
        // Pour les câbles : priorité à customColor, puis couleur du conducteur, puis défaut
        const defaultColor = colorForCable(obj.fam, obj.code);
        if (obj.customColor) {
          displayColor = obj.customColor;
        } else if (obj.selectedPhase && obj.selectedPhase !== 'none') {
          displayColor = PHASE_COLORS[obj.selectedPhase];
        } else {
          displayColor = obj.color || defaultColor;
        }
      }
      
      // Convertir en hex pour l'input color
      colorInput.value = hslToHex(displayColor);
      
      // Afficher ou cacher la section des conducteurs selon le type d'objet
      if (currentType === 'cable') {
        phaseSection.style.display = 'block';
        fourreauFillSection.style.display = 'none';

        // Initialiser le bouton radio avec le conducteur actuel
        const currentPhase = obj.selectedPhase || 'none';
        const radioButton = document.getElementById(`phase-${currentPhase}`);
        if (radioButton) {
          radioButton.checked = true;
        } else {
          // Si pas de phase définie, sélectionner "none" par défaut
          document.getElementById('phase-none').checked = true;
        }
      } else {
        phaseSection.style.display = 'none';
        fourreauFillSection.style.display = 'block';
        populateUnipolarCableSelect();
      }
      
      popup.style.display = 'flex';

      // Positionner la popup aux coordonnées du clic si fournies
      if (mouseX !== undefined && mouseY !== undefined && popupContent) {
        // Attendre que le DOM soit rendu pour obtenir les bonnes dimensions
        requestAnimationFrame(() => {
          // Obtenir les dimensions de la popup et de la fenêtre
          const popupRect = popupContent.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          // Calculer la position en s'assurant que la popup reste dans la fenêtre
          let left = mouseX + 10; // Décalage de 10px à droite du curseur
          let top = mouseY + 10; // Décalage de 10px en bas du curseur

          // Ajuster si la popup dépasse à droite
          if (left + popupRect.width > viewportWidth) {
            left = mouseX - popupRect.width - 10; // Positionner à gauche du curseur
          }

          // Ajuster si la popup dépasse en bas
          if (top + popupRect.height > viewportHeight) {
            top = mouseY - popupRect.height - 10; // Positionner au-dessus du curseur
          }

          // S'assurer que la popup ne dépasse pas en haut ou à gauche
          left = Math.max(10, left);
          top = Math.max(10, top);

          popupContent.style.position = 'fixed';
          popupContent.style.left = `${left}px`;
          popupContent.style.top = `${top}px`;
        });
      } else if (popupContent) {
        // Position centrée par défaut
        popupContent.style.position = '';
        popupContent.style.left = '';
        popupContent.style.top = '';
      }

      setTimeout(() => labelInput.focus(), 100);
    }
    
    function closeEditPopup() {
      // Fermer le dropdown des couleurs s'il est ouvert
      closeColorDropdown();
      const popup = document.getElementById('editPopup');
      const popupContent = popup.querySelector('.edit-popup-content');

      // Réinitialiser la position pour la prochaine ouverture
      if (popupContent) {
        popupContent.style.position = '';
        popupContent.style.left = '';
        popupContent.style.top = '';
      }

      popup.style.display = 'none';
    }

    // Fonction pour initialiser le champ de recherche de câbles unipolaires
    function populateUnipolarCableSelect() {
      const fillCableSearch = document.getElementById('fillCableSearch');
      const fillCableSelect = document.getElementById('fillCableSelect');
      let fillCableOptions = [];

      if (!fillCableSearch || !fillCableSelect) return;

      // Filtrer uniquement les câbles unipolaires
      const unipolarCables = CABLES.filter(c => c.code.startsWith('1x'));

      // Créer la liste complète des options avec recherche
      unipolarCables.forEach(c => {
        fillCableOptions.push({
          value: `${c.fam}|${c.code}`,
          text: `${c.fam} – ${c.code} (Ø ${c.od} mm)`,
          searchText: `${c.fam} ${c.code} ${c.od}`.toLowerCase(),
          group: c.fam
        });
      });

      // Fonction pour filtrer et afficher les câbles unipolaires
      function filterFillCables(searchTerm = '') {
        const term = searchTerm.toLowerCase();
        fillCableSelect.innerHTML = '';

        const filteredOptions = fillCableOptions.filter(opt =>
          opt.searchText.includes(term)
        );

        // Grouper les résultats filtrés
        const groups = {};
        filteredOptions.forEach(opt => {
          if (!groups[opt.group]) {
            groups[opt.group] = [];
          }
          groups[opt.group].push(opt);
        });

        // Créer les groupes
        for (const [groupName, options] of Object.entries(groups)) {
          const groupDiv = document.createElement('div');
          groupDiv.className = 'searchable-group';

          const groupLabel = document.createElement('div');
          groupLabel.className = 'searchable-group-label';
          groupLabel.textContent = groupName;
          groupDiv.appendChild(groupLabel);

          options.forEach(opt => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'searchable-option';
            optionDiv.setAttribute('role', 'option');
            optionDiv.setAttribute('data-value', opt.value);
            optionDiv.textContent = opt.text;

            optionDiv.addEventListener('mousedown', function(e) {
              e.preventDefault();
              fillCableSearch.value = this.textContent;
              fillCableSearch.dataset.selectedValue = this.getAttribute('data-value');
              hideFillCableList();
            });

            groupDiv.appendChild(optionDiv);
          });

          fillCableSelect.appendChild(groupDiv);
        }
      }

      // Événement de recherche
      fillCableSearch.addEventListener('input', function() {
        filterFillCables(this.value);
        showFillCableList();
      });

      // Événements de focus/blur pour afficher/masquer la liste
      fillCableSearch.addEventListener('focus', function() {
        // Sélectionner tout le texte pour faciliter le remplacement
        this.select();
        // Afficher tous les câbles (filtre vide)
        filterFillCables('');
        showFillCableList();
      });

      fillCableSearch.addEventListener('blur', function() {
        // Délai pour permettre le clic sur la liste
        setTimeout(() => hideFillCableList(), 150);
      });

      // Fonctions pour afficher/masquer la liste
      function showFillCableList() {
        fillCableSelect.classList.add('show');
        fillCableSearch.setAttribute('aria-expanded', 'true');
      }

      function hideFillCableList() {
        fillCableSelect.classList.remove('show');
        fillCableSearch.setAttribute('aria-expanded', 'false');
      }

      // Initialiser avec tous les câbles (mais masqué)
      filterFillCables();
    }

    // Fonction pour gérer le remplissage rapide d'un fourreau
    async function handleFillFourreau(mode) {
      if (!selected || selected.type !== 'fourreau') return;

      const fourreau = fourreaux.find(f => f.id === selected.id);
      if (!fourreau) return;

      const fillCableSearch = document.getElementById('fillCableSearch');
      const selectedCableValue = fillCableSearch.dataset.selectedValue;
      if (!selectedCableValue) {
        showToast('Veuillez sélectionner un type de câble.');
        return;
      }

      const [fam, code] = selectedCableValue.split('|');

      // Vérifier si le remplissage sera possible
      const selectedCable = CABLES.find(c => c.fam === fam && c.code === code);
      if (!selectedCable) {
        showToast('Câble non trouvé dans la base de données.');
        return;
      }

      const nbCables = mode === 'tetra' ? 5 : 4; // tetra = 5 câbles, tri = 4 câbles
      const totalCableArea = nbCables * areaCircle(selectedCable.od);
      const fourreauInnerArea = areaCircle(fourreau.idm);
      const occupationRate = (totalCableArea / fourreauInnerArea) * 100;
      const maxOccupationRate = 40; // seuil de blocage du remplissage

      if (occupationRate > maxOccupationRate) {
        await customAlert(
          `Impossible de remplir le fourreau :\n\n` +
          `• Câble : ${fam} ${code} (Ø ${selectedCable.od} mm)\n` +
          `• Nombre de câbles : ${nbCables}\n` +
          `• Occupation totale : ${occupationRate.toFixed(1)}%\n\n` +
          `Le taux d'occupation dépasse ${maxOccupationRate}%. Veuillez choisir un câble de section plus petite ou un fourreau de diamètre supérieur.`,
          'Remplissage impossible'
        );
        return;
      }

      const confirmed = await customConfirm(
        'Attention : les câbles existants dans ce fourreau seront supprimés. Continuer ?',
        'Remplissage du fourreau'
      );
      if (!confirmed) {
        return;
      }

      const childrenIds = [...fourreau.children];
      for (const cableId of childrenIds) {
        const cableIndex = cables.findIndex(c => c.id === cableId);
        if (cableIndex > -1) cables.splice(cableIndex, 1);
      }
      fourreau.children = [];
      const phases = mode === 'tetra' ? ['ph1', 'ph2', 'ph3', 'n', 'pe'] : ['ph1', 'ph2', 'ph3', 'n'];
      const phaseNames = { ph1: 'L1', ph2: 'L2', ph3: 'L3', n: 'N', pe: 'PE' };

      let addedCount = 0;
      for (const phase of phases) {
        const newCable = addCableAt(fourreau.x, fourreau.y, fam, code, fourreau, { silent: true, forcePlace: true });
        if (newCable) {
          newCable.selectedPhase = phase;
          newCable.customColor = PHASE_COLORS[phase];
          newCable.label = phaseNames[phase];
          addedCount++;
        }
      }

      showToast(`${addedCount} câbles ajoutés au fourreau.`);
      closeEditPopup();
      redraw();
      updateStats();
      updateInventory();
      updateSelectedInfo();
    }
    
    function saveEdit() {
      // Vérifier qu'il y a une sélection
      if (!selected && selectedMultiple.length === 0) {
        closeEditPopup();
        return;
      }
      
      const labelInput = document.getElementById('editLabel');
      const colorInput = document.getElementById('editColor');
      
      // Fonction pour appliquer les modifications à un objet
      const applyChangesToObject = (obj, type) => {
        // Sauvegarder le libellé (seulement si pas vide en mode multiple)
        if (selectedMultiple.length === 0 || labelInput.value.trim()) {
          obj.label = labelInput.value;
        }
        
        // Si c'est un câble, gérer le conducteur sélectionné
        if (type === 'cable') {
          // Trouver quel bouton radio est sélectionné
          const selectedRadio = document.querySelector('input[name="cablePhase"]:checked');
          const selectedPhase = selectedRadio ? selectedRadio.dataset.phase : 'none';
          
          obj.selectedPhase = selectedPhase;
          
          // Gestion des couleurs pour les câbles
          handleCableColorChange(obj, selectedPhase, colorInput.value);
        } else {
          // Pour les fourreaux : couleur personnalisée simple
          obj.customColor = colorInput.value !== obj.color ? colorInput.value : null;
        }
      };
      
      // Appliquer à tous les objets sélectionnés
      if (selectedMultiple.length > 0) {
        selectedMultiple.forEach(sel => {
          const obj = sel.type === 'fourreau' 
            ? fourreaux.find(f => f.id === sel.id)
            : cables.find(c => c.id === sel.id);
          if (obj) {
            applyChangesToObject(obj, sel.type);
          }
        });
        showToast(`${selectedMultiple.length} éléments modifiés`);
      } else {
        const obj = selected.type === 'fourreau' 
          ? fourreaux.find(f => f.id === selected.id)
          : cables.find(c => c.id === selected.id);
        if (obj) {
          applyChangesToObject(obj, selected.type);
        }
      }
      
      closeEditPopup();
      redraw();
      updateSelectedInfo();
    }

    // Gestionnaires d'événements popup
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    document.getElementById('cancelEdit').addEventListener('click', closeEditPopup);
    document.querySelectorAll('input[name="cablePhase"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const phase = radio.dataset.phase || 'none';
        syncColorInputWithPhase(phase);
      });
    });
    // Fermer la popup en cliquant en dehors (sur la zone transparente du popup)
    document.getElementById('editPopup').addEventListener('click', (e) => {
      // Fermer si on clique sur le fond transparent du popup (pas sur le contenu)
      if (e.target.id === 'editPopup') {
        closeEditPopup();
      }
    });

    // Gestionnaires pour le remplissage rapide
    document.getElementById('fillTetra').addEventListener('click', () => handleFillFourreau('tetra'));
    document.getElementById('fillTri').addEventListener('click', () => handleFillFourreau('tri'));

    document.getElementById('resetColor').addEventListener('click', () => {
      if (!selected) return;
      const obj = selected.type === 'fourreau' 
        ? fourreaux.find(f => f.id === selected.id)
        : cables.find(c => c.id === selected.id);
      if (obj) {
        const defaultColor = selected.type === 'fourreau' 
          ? colorForFourreau(obj.type, obj.code)
          : colorForCable(obj.fam, obj.code);
        document.getElementById('editColor').value = hslToHex(obj.color || defaultColor);
      }
    });

    // Événement pour changement de couleur avec l'input color (pipette)
    document.getElementById('editColor').addEventListener('input', (e) => {
      // Mettre à jour la sélection dans la grille AutoCAD
      updateColorGridSelection(e.target.value);
    });

    // Événement pour le bouton des couleurs AutoCAD
    document.getElementById('autocadColorBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Créer la grille si elle n'existe pas encore
      const colorGrid = document.getElementById('colorGrid');
      if (!colorGrid.children.length) {
        createColorGrid();
        // Mettre à jour la sélection avec la couleur actuelle
        const currentColor = document.getElementById('editColor').value;
        updateColorGridSelection(currentColor);
      }
      
      toggleColorDropdown();
    });

    // Fermer le dropdown quand on clique ailleurs
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('colorDropdown');
      const btn = document.getElementById('autocadColorBtn');
      
      if (dropdown && dropdown.classList.contains('show') && 
          !dropdown.contains(e.target) && !btn.contains(e.target)) {
        closeColorDropdown();
      }
    });

    // Gestionnaires pour les boutons radio des phases
    ['none', 'ph1', 'ph2', 'ph3', 'n', 'pe'].forEach(phase => {
      const radioButton = document.getElementById(`phase-${phase}`);
      if (radioButton) {
        radioButton.addEventListener('change', () => {
          if (!selected || selected.type !== 'cable') return;
          
          const colorInput = document.getElementById('editColor');
          const obj = cables.find(c => c.id === selected.id);
          if (!obj) return;
          
          // Proposer la couleur du conducteur mais permettre de la modifier
          if (phase === 'none') {
            // Si aucune couleur personnalisée n'existe, proposer la couleur par défaut
            if (!obj.customColor) {
              const defaultColor = colorForCable(obj.fam, obj.code);
              colorInput.value = hslToHex(defaultColor);
            }
            // Sinon, garder la couleur personnalisée actuelle
          } else {
            // Si aucune couleur personnalisée n'existe, proposer la couleur du conducteur
            if (!obj.customColor || obj.customColor === PHASE_COLORS[obj.selectedPhase]) {
              colorInput.value = PHASE_COLORS[phase];
            }
            // Sinon, garder la couleur personnalisée actuelle
          }
        });
      }
    });

    addEventListener('keydown', e => {
      const t = e.target; const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'a') { setMode('place'); return; }
      if (k === 's') { setMode('select'); return; }
      if (e.key === 'Delete') { deleteSelected(); return; }
      if (k === 'x' && e.ctrlKey) { e.preventDefault(); toggleFreezeAll(); return; }
      if (k === 'g' && e.ctrlKey) { e.preventDefault(); arrangeConduitGrid(); return; }
      if (k === 'c' && e.ctrlKey) { e.preventDefault(); copySelected(); return; }
      if (k === 'v' && e.ctrlKey) {
        e.preventDefault();
        // Si on a copié des câbles et qu'un fourreau est sélectionné, coller directement
        if (clipboard && clipboard.type === 'cables' && selected && selected.type === 'fourreau') {
          pasteCablesIntoSelectedFourreau();
        } else {
          activatePasteMode();
        }
        return;
      }
      if (k === 'x') { toggleFreezeSelected(); return; }
      if (k === 'e') { openEditPopup(); return; }
      if (k === 'i') { toggleShowInfo(); return; }
      if (k === 'escape') { deactivatePasteMode(); return; }
    });

    /* ====== Système de Sauvegarde de Projets ====== */
    class ProjectManager {
      constructor() {
        this.storageKey = 'tontonkad_projects';
        this.autoSaveKey = 'tontonkad_autosave';
        this.autoSaveInterval = 30000; // 30 secondes
        this.autoSaveTimer = null;
        this.setupAutoSave();
      }

      // Capture l'état actuel de l'application
      captureCurrentState() {
        return {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          nextId: nextId, // Sauvegarder le prochain ID à utiliser
          container: {
            shape: SHAPE,
            width: WORLD_W_MM,
            height: WORLD_H_MM,
            diameter: WORLD_D_MM
          },
          fourreaux: fourreaux.map(f => ({
            ...f,
            // Assurer la sérialisation complète
            type: f.type,
            code: f.code,
            x: f.x,
            y: f.y,
            id: f.id,
            customColor: f.customColor,
            customLabel: f.customLabel,
            frozen: f.frozen,
            phase: f.phase
          })),
          cables: cables.map(c => ({
            ...c,
            // Assurer la sérialisation complète
            fam: c.fam,
            code: c.code,
            x: c.x,
            y: c.y,
            id: c.id,
            customColor: c.customColor,
            customLabel: c.customLabel,
            frozen: c.frozen,
            phase: c.phase
          })),
          metadata: {
            totalFourreaux: fourreaux.length,
            totalCables: cables.length,
            occupationRate: this.calculateOccupationRate()
          }
        };
      }

      // Calcule le taux d'occupation pour les métadonnées
      calculateOccupationRate() {
        try {
          let totalArea;
          if (SHAPE === 'rect' || SHAPE === 'chemin_de_cable') {
            totalArea = WORLD_W_MM * WORLD_H_MM;
          } else {
            totalArea = Math.PI * (WORLD_D_MM / 2) * (WORLD_D_MM / 2);
          }

          if (totalArea <= 0) return 0;

          let occupiedArea = 0;
          fourreaux.forEach(f => {
            const spec = FOURREAUX.find(fs => fs.type === f.type && fs.code === f.code);
            if (spec) occupiedArea += Math.PI * (spec.od / 2) * (spec.od / 2);
          });

          cables.filter(c => !c.inFourreau).forEach(c => {
            const spec = CABLES.find(cs => cs.fam === c.fam && cs.code === c.code);
            if (spec) occupiedArea += Math.PI * (spec.od / 2) * (spec.od / 2);
          });

          return (occupiedArea / totalArea) * 100;
        } catch (e) {
          return 0;
        }
      }

      // Restaure l'état de l'application
      restoreState(projectData) {
        try {
          // Validation des données
          if (!projectData || !projectData.container) {
            throw new Error('Données de projet invalides');
          }

          // Nettoyer l'état actuel
          fourreaux.length = 0;
          cables.length = 0;

          // Restaurer le nextId
          if (projectData.nextId !== undefined) {
            nextId = projectData.nextId;
          } else {
            // Si nextId n'est pas dans les données (anciens projets), le calculer
            const maxId = Math.max(
              0,
              ...projectData.fourreaux?.map(f => f.id) || [],
              ...projectData.cables?.map(c => c.id) || []
            );
            nextId = maxId + 1;
          }

          // Restaurer le conteneur
          SHAPE = projectData.container.shape || 'rect';
          WORLD_W_MM = projectData.container.width || 1000;
          WORLD_H_MM = projectData.container.height || 1000;
          WORLD_D_MM = projectData.container.diameter || 1000;
          syncDimensionState();

          // Mettre à jour l'interface
          shapeSel.value = SHAPE;
          boxWInput.value = WORLD_W_MM;
          boxHInput.value = WORLD_H_MM;
          boxDInput.value = WORLD_D_MM;
          updateShapeDropdownDisplay();

          // Restaurer les objets
          if (projectData.fourreaux) {
            projectData.fourreaux.forEach(f => {
              fourreaux.push({
                ...f,
                vx: 0, vy: 0, // Réinitialiser la physique
                dragging: false,
                mass: (f.od || 40) * MASS_K
              });
            });
          }

          if (projectData.cables) {
            projectData.cables.forEach(c => {
              cables.push({
                ...c,
                vx: 0, vy: 0, // Réinitialiser la physique
                dragging: false,
                mass: (c.od || 6) * MASS_K
              });
            });
          }

          // Mettre à jour l'affichage
          toggleInputGroups();
          setCanvasSize();
          updateStats();
          updateInventory();
          updateSelectedInfo();
          redraw();

          return true;
        } catch (error) {
          console.error('Erreur lors de la restauration:', error);
          showToast('Erreur lors du chargement du projet');
          return false;
        }
      }

      // Sauvegarde automatique
      setupAutoSave() {
        // Nettoyer le timer existant
        if (this.autoSaveTimer) {
          clearInterval(this.autoSaveTimer);
        }

        // Auto-save toutes les 30 secondes
        this.autoSaveTimer = setInterval(() => {
          this.autoSave();
        }, this.autoSaveInterval);

        // Auto-save avant fermeture
        window.addEventListener('beforeunload', () => {
          this.autoSave();
        });
      }

      autoSave() {
        try {
          const state = this.captureCurrentState();
          localStorage.setItem(this.autoSaveKey, JSON.stringify(state));
        } catch (error) {
          console.warn('Erreur auto-sauvegarde:', error);
        }
      }

      // Récupérer l'auto-sauvegarde
      loadAutoSave() {
        try {
          const saved = localStorage.getItem(this.autoSaveKey);
          if (saved) {
            const data = JSON.parse(saved);
            return data;
          }
        } catch (error) {
          console.warn('Erreur chargement auto-sauvegarde:', error);
        }
        return null;
      }

      // Sauvegarder un projet nommé
      saveProject(projectName, folderName = null) {
        if (!projectName || projectName.trim() === '') {
          throw new Error('Nom de projet requis');
        }

        try {
          const data = this.getAllProjects();
          const projectData = this.captureCurrentState();

          const finalProjectData = {
            ...projectData,
            name: projectName.trim(),
            folder: folderName,
            lastModified: new Date().toISOString()
          };

          if (folderName) {
            // Sauvegarder dans un dossier
            if (!data.folders[folderName]) {
              data.folders[folderName] = {
                name: folderName,
                created: new Date().toISOString(),
                projects: {}
              };
            }

            // Conserver la date de création si le projet existe déjà
            const existingProject = data.folders[folderName].projects[projectName.trim()];
            finalProjectData.created = existingProject?.created || new Date().toISOString();

            data.folders[folderName].projects[projectName.trim()] = finalProjectData;
          } else {
            // Sauvegarder à la racine
            const existingProject = data.projects[projectName.trim()];
            finalProjectData.created = existingProject?.created || new Date().toISOString();

            data.projects[projectName.trim()] = finalProjectData;
          }

          localStorage.setItem(this.storageKey, JSON.stringify(data));

          const location = folderName ? `dans "${folderName}"` : '';
          showToast(`💾 Projet "${projectName}" sauvegardé ${location}`);
          return true;
        } catch (error) {
          console.error('Erreur sauvegarde projet:', error);
          showToast('Erreur lors de la sauvegarde');
          return false;
        }
      }

      // Charger un projet
      loadProject(projectName) {
        try {
          const projects = this.getAllProjects();
          const project = projects[projectName];

          if (!project) {
            throw new Error(`Projet "${projectName}" introuvable`);
          }

          if (this.restoreState(project)) {
            showToast(`📂 Projet "${projectName}" chargé`);
            return true;
          }
          return false;
        } catch (error) {
          console.error('Erreur chargement projet:', error);
          showToast(`Erreur lors du chargement de "${projectName}"`);
          return false;
        }
      }

      // Supprimer un projet
      renameProject(oldName, newName) {
        try {
          const projects = this.getAllProjects();

          if (!projects[oldName]) {
            showToast(`⚠️ Projet "${oldName}" introuvable`);
            return false;
          }

          if (projects[newName]) {
            showToast(`⚠️ Un projet nommé "${newName}" existe déjà`);
            return false;
          }

          // Copier le projet avec le nouveau nom
          const projectData = { ...projects[oldName] };
          projectData.name = newName;
          projectData.lastModified = new Date().toISOString();

          // Ajouter avec le nouveau nom et supprimer l'ancien
          projects[newName] = projectData;
          delete projects[oldName];

          localStorage.setItem(this.storageKey, JSON.stringify(projects));
          return true;
        } catch (error) {
          console.error('Erreur renommage projet:', error);
          showToast('Erreur lors du renommage');
          return false;
        }
      }

      deleteProject(projectName) {
        try {
          const projects = this.getAllProjects();
          if (projects[projectName]) {
            delete projects[projectName];
            localStorage.setItem(this.storageKey, JSON.stringify(projects));
            showToast(`🗑️ Projet "${projectName}" supprimé`);
            return true;
          }
          return false;
        } catch (error) {
          console.error('Erreur suppression projet:', error);
          showToast('Erreur lors de la suppression');
          return false;
        }
      }

      // Obtenir tous les projets (migration automatique vers nouvelle structure)
      getAllProjects() {
        try {
          const saved = localStorage.getItem(this.storageKey);
          if (!saved) {
            return { folders: {}, projects: {} };
          }

          const data = JSON.parse(saved);

          // Migration automatique depuis l'ancienne structure plate
          if (!data.folders && !data.projects) {
            // Migration vers structure avec dossiers
            const newStructure = {
              folders: {},
              projects: data // Anciens projets restent à la racine
            };
            localStorage.setItem(this.storageKey, JSON.stringify(newStructure));
            return newStructure;
          }

          // Structure déjà moderne
          return {
            folders: data.folders || {},
            projects: data.projects || {}
          };
        } catch (error) {
          console.warn('Erreur lecture projets:', error);
          return { folders: {}, projects: {} };
        }
      }

      // Obtenir tous les projets dans un format plat (pour compatibilité)
      getAllProjectsFlat() {
        const data = this.getAllProjects();
        const allProjects = { ...data.projects };

        // Ajouter les projets des dossiers
        Object.values(data.folders).forEach(folder => {
          Object.entries(folder.projects || {}).forEach(([name, project]) => {
            allProjects[`${folder.name}/${name}`] = project;
          });
        });

        return allProjects;
      }

      // Créer un nouveau dossier
      createFolder(folderName) {
        if (!folderName || folderName.trim() === '') {
          throw new Error('Nom de dossier requis');
        }

        try {
          const data = this.getAllProjects();
          const trimmedName = folderName.trim();

          if (data.folders[trimmedName]) {
            showToast(`⚠️ Le dossier "${trimmedName}" existe déjà`);
            return false;
          }

          data.folders[trimmedName] = {
            name: trimmedName,
            created: new Date().toISOString(),
            projects: {}
          };

          localStorage.setItem(this.storageKey, JSON.stringify(data));
          showToast(`📁 Dossier "${trimmedName}" créé`);
          return true;
        } catch (error) {
          console.error('Erreur création dossier:', error);
          showToast('Erreur lors de la création du dossier');
          return false;
        }
      }

      // Supprimer un dossier (doit être vide)
      deleteFolder(folderName) {
        try {
          const data = this.getAllProjects();
          const folder = data.folders[folderName];

          if (!folder) {
            showToast(`⚠️ Dossier "${folderName}" introuvable`);
            return false;
          }

          if (Object.keys(folder.projects || {}).length > 0) {
            showToast(`⚠️ Le dossier "${folderName}" contient des projets`);
            return false;
          }

          delete data.folders[folderName];
          localStorage.setItem(this.storageKey, JSON.stringify(data));
          showToast(`🗑️ Dossier "${folderName}" supprimé`);
          return true;
        } catch (error) {
          console.error('Erreur suppression dossier:', error);
          showToast('Erreur lors de la suppression du dossier');
          return false;
        }
      }

      // Exporter un projet vers fichier
      exportProject(projectName = null) {
        try {
          let data;
          let filename;

          if (projectName) {
            const projects = this.getAllProjects();
            data = projects[projectName];
            filename = `${projectName.replace(/[^a-z0-9]/gi, '_')}.tontonkad`;
          } else {
            data = this.captureCurrentState();
            filename = `projet_${new Date().toISOString().slice(0, 16).replace(/[:-]/g, '')}.tontonkad`;
          }

          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
          });

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(`📤 Projet exporté: ${filename}`);
          return true;
        } catch (error) {
          console.error('Erreur export:', error);
          showToast('Erreur lors de l\'export');
          return false;
        }
      }

      // Importer un projet depuis fichier
      importProject(file) {
        return new Promise((resolve, reject) => {
          if (!file) {
            reject(new Error('Aucun fichier sélectionné'));
            return;
          }

          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = JSON.parse(e.target.result);

              // Validation basique
              if (!data.container && !data.fourreaux && !data.cables) {
                throw new Error('Format de fichier invalide');
              }

              if (this.restoreState(data)) {
                showToast(`📥 Projet importé avec succès`);
                resolve(true);
              } else {
                reject(new Error('Erreur lors de l\'import'));
              }
            } catch (error) {
              console.error('Erreur import:', error);
              showToast('Fichier invalide ou corrompu');
              reject(error);
            }
          };

          reader.onerror = () => {
            reject(new Error('Erreur lecture fichier'));
          };

          reader.readAsText(file);
        });
      }

      // Obtenir des statistiques de stockage
      getStorageStats() {
        try {
          const projects = this.getAllProjects();
          const autoSave = this.loadAutoSave();

          return {
            projectCount: Object.keys(projects).length,
            hasAutoSave: !!autoSave,
            totalSize: JSON.stringify(projects).length + (autoSave ? JSON.stringify(autoSave).length : 0),
            projects: Object.keys(projects).map(name => ({
              name,
              lastModified: projects[name].lastModified,
              objectCount: (projects[name].fourreaux?.length || 0) + (projects[name].cables?.length || 0)
            }))
          };
        } catch (error) {
          console.error('Erreur stats stockage:', error);
          return { projectCount: 0, hasAutoSave: false, totalSize: 0, projects: [] };
        }
      }
    }

    // 4. Démarrage de l'application
    toggleInputGroups();
    setCanvasSize();
    updateStats();
    updateInventory();
    updateSelectedInfo();
    setMode('place');
    initPanelResize();
    initPanelScrollEffect();
    // Initialiser le bouton Infos comme actif
    document.getElementById('toolInfo').classList.add('btn-active');
    
    // Initialiser les verrous de dimensions
    setupDimensionLocks();

    requestAnimationFrame(tick);

    // Initialiser le système de sauvegarde après que tout soit prêt
    window.projectManager = new ProjectManager();
    window.projectUI = new ProjectUI();

    // Initialiser le sélecteur de thème
    initThemeSwitcher();

    // Gérer le positionnement des tooltips en position fixed
    setupTooltipPositioning();
  }

function setupTooltipPositioning() {
    // Créer un seul élément tooltip réutilisable
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);

    let currentBtn = null;

    // Fonction pour afficher le tooltip
    function showTooltip(btn) {
      const text = btn.getAttribute('data-tooltip');
      if (!text) return;

      currentBtn = btn;
      tooltip.textContent = text;
      tooltip.style.display = 'block';

      // Positionner le tooltip
      const rect = btn.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + 'px';
      tooltip.style.top = rect.top - 8 + 'px';

      // Couleur selon la classe du bouton
      let color = 'rgba(30, 30, 30, 0.95)'; // Défaut
      if (btn.classList.contains('btn-load')) color = '#ff914d';
      else if (btn.classList.contains('btn-save')) color = '#f59e0b';
      else if (btn.classList.contains('btn-rename') || btn.classList.contains('btn-rename-folder')) color = '#8b5cf6';
      else if (btn.classList.contains('btn-export')) color = '#059669';
      else if (btn.classList.contains('btn-delete') || btn.classList.contains('btn-delete-folder')) color = '#dc2626';

      tooltip.style.backgroundColor = color;
    }

    // Fonction pour masquer le tooltip
    function hideTooltip() {
      tooltip.style.display = 'none';
      currentBtn = null;
    }

    // Events
    document.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('[data-tooltip]');
      if (btn) showTooltip(btn);
    });

    document.addEventListener('mouseout', (e) => {
      const btn = e.target.closest('[data-tooltip]');
      if (btn === currentBtn) hideTooltip();
    });
  }
  
  /* ====== Gestion des verrous de dimensions ====== */
  function setupDimensionLocks() {
    const lockWidth = document.getElementById('lockWidth');
    const lockHeight = document.getElementById('lockHeight');
    const boxW = document.getElementById('boxW');
    const boxH = document.getElementById('boxH');
    
    if (lockWidth && boxW) {
      lockWidth.addEventListener('change', function() {
        boxW.disabled = this.checked;
        if (this.checked) {
          // Sauvegarder la valeur actuelle si on verrouille
          WORLD_W_MM = parseFloat(boxW.value);
          syncDimensionState();
        }
        // Mettre à jour l'icône
        const icon = document.querySelector('.lock-icon[data-target="lockWidth"] .cadenas-icon');
        if (icon) {
          icon.src = this.checked
            ? '../../assets/icons/ico/cadenas.ico'
            : '../../assets/icons/ico/cadenas-ouvert.ico';
        }
        // Recalculer les possibilités de redimensionnement
        checkForPossibleReduction();
      });
    }

    if (lockHeight && boxH) {
      lockHeight.addEventListener('change', function() {
        boxH.disabled = this.checked;
        if (this.checked) {
          // Sauvegarder la valeur actuelle si on verrouille
          WORLD_H_MM = parseFloat(boxH.value);
          syncDimensionState();
        }
        // Mettre à jour l'icône
        const icon = document.querySelector('.lock-icon[data-target="lockHeight"] .cadenas-icon');
        if (icon) {
          icon.src = this.checked
            ? '../../assets/icons/ico/cadenas.ico'
            : '../../assets/icons/ico/cadenas-ouvert.ico';
        }
        // Recalculer les possibilités de redimensionnement
        checkForPossibleReduction();
      });
    }

    // Rendre les icônes de cadenas cliquables
    const lockIcons = document.querySelectorAll('.lock-icon');
    lockIcons.forEach(icon => {
      icon.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Trouver la checkbox cachée dans cette icône
        const checkbox = this.querySelector('input[type="checkbox"]');
        const img = this.querySelector('.cadenas-icon');

        if (checkbox && img) {
          checkbox.checked = !checkbox.checked;

          // Mettre à jour l'icône en fonction de l'état
          img.src = checkbox.checked
            ? '../../assets/icons/ico/cadenas.ico'        // Fermé
            : '../../assets/icons/ico/cadenas-ouvert.ico'; // Ouvert

          // Déclencher l'événement change pour activer la logique existante
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  /* ====== Gestion du thème Light/Dark ====== */
  function updateLogo(theme) {
    const isDark = theme === 'dark';
    const brandLogo = document.getElementById('brandLogo');
    const titlebarLogo = document.getElementById('titlebar-logo');
    const favicon = document.getElementById('favicon');

    if (brandLogo) {
      brandLogo.src = isDark
        ? '../../assets/icons/ico/TONTONKADB.png'
        : '../../assets/icons/ico/TONTONKADN.png';
    }

    if (titlebarLogo) {
      titlebarLogo.src = isDark
        ? '../../assets/icons/ico/TONTONKADB.png'
        : '../../assets/icons/ico/TONTONKADN.png';
    }

    if (favicon) {
      favicon.href = isDark
        ? '../../assets/icons/ico/TONTONKADB.ico'
        : '../../assets/icons/ico/TONTONKADN.ico';
    }
  }
  function initThemeSwitcher() {
      const themeSwitcher = document.getElementById('theme-switcher');
      const html = document.documentElement;

      // Appliquer le thème sauvegardé au chargement
      const savedTheme = localStorage.getItem('tontonkad-theme') || 'light';
      html.setAttribute('data-theme', savedTheme);
      updateLogo(savedTheme);

      // Notifier Electron du thème au chargement
      if (window.electronAPI && window.electronAPI.setTheme) {
        window.electronAPI.setTheme(savedTheme);
      }

      if (themeSwitcher) {
        // Fonction toggle
        const toggleTheme = () => {
          const currentTheme = html.getAttribute('data-theme');
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

          html.setAttribute('data-theme', newTheme);
          localStorage.setItem('tontonkad-theme', newTheme);

          // Mettre à jour le logo
          updateLogo(newTheme);

          // Notifier Electron du changement de thème
          if (window.electronAPI && window.electronAPI.setTheme) {
            window.electronAPI.setTheme(newTheme);
          }

          // Afficher le toast APRÈS avoir changé le thème
          showToast(`Thème ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`);

          // Redessiner pour que les couleurs du canvas (si elles dépendent des variables) soient mises à jour
          redraw();
        };

        // Gestionnaires d'événements
        themeSwitcher.addEventListener('click', toggleTheme);
        themeSwitcher.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleTheme();
          }
        });
      }

      // Mettre à jour l'icône du sélecteur de thème en fonction du thème actuel
      const observer = new MutationObserver(() => {
        // Pas besoin de faire quoi que ce soit ici, le CSS gère l'affichage des icônes
      });
      observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  }


  /* ====== Interface de Gestion des Projets ====== */
  class ProjectUI {
    constructor() {
      this.modal = document.getElementById('projectModal');
      this.projectsList = document.getElementById('projectsList');
      this.newProjectName = document.getElementById('newProjectName');
      this.newFolderName = document.getElementById('newFolderName');
      this.projectFolder = document.getElementById('projectFolder');
      this.autoSaveStatus = document.getElementById('autoSaveStatus');
      this.autoSaveText = document.getElementById('autoSaveText');
      this.autoSaveDetails = document.getElementById('autoSaveDetails');
      this.restoreAutoSave = document.getElementById('restoreAutoSave');
      this.folderCreationField = document.getElementById('folderCreationField');
      this.toggleFolderCreation = document.getElementById('toggleFolderCreation');
      this.renameModal = document.getElementById('renameModal');
      this.currentProjectName = document.getElementById('currentProjectName');
      this.newProjectNameInput = document.getElementById('newProjectNameInput');
      this.confirmRename = document.getElementById('confirmRename');
      this.cancelRename = document.getElementById('cancelRename');
      this.setupEventListeners();
      this.refreshUI();
    }

    setupEventListeners() {
      // Bouton d'ouverture de la modal
      const projectSaveBtn = document.getElementById('projectSave');
      if (projectSaveBtn) {
        projectSaveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.debug('[ProjectUI] Bouton Projets clique');
          this.openModal();
        });
        console.debug('[ProjectUI] Event listener attaché au bouton Projets');
      } else {
        console.error('[ProjectUI] Bouton #projectSave introuvable !');
      }


      // Bouton de fermeture dans le header
      const closeBtn = document.getElementById('closeProjectModal');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal();
        });
      }

      // Fermeture de la modal par clic sur l'overlay (pas sur le contenu)
      this.modal.addEventListener('click', (e) => {
        // Fermer seulement si on clique directement sur l'overlay, pas sur le contenu de la modale
        if (e.target === this.modal) {
          this.closeModal();
        }
      });

      // Toggle création de dossier
      this.toggleFolderCreation.addEventListener('click', () => {
        this.toggleFolderCreationField();
      });

      // Bouton restaurer auto-save
      this.restoreAutoSave.addEventListener('click', () => {
        this.loadAutoSave();
      });

      // Popup de renommage
      this.confirmRename.addEventListener('click', () => {
        this.confirmRenameProject();
      });

      this.cancelRename.addEventListener('click', () => {
        this.closeRenameModal();
      });

      // Bouton de fermeture dans le header
      const closeRenameBtn = document.getElementById('closeRenameModal');
      if (closeRenameBtn) {
        closeRenameBtn.addEventListener('click', () => {
          this.closeRenameModal();
        });
      }

      // Clic en dehors de la modale
      this.renameModal.addEventListener('click', (e) => {
        if (e.target === this.renameModal) {
          this.closeRenameModal();
        }
      });

      // Confirmer avec Entrée dans le champ de renommage
      this.newProjectNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.confirmRenameProject();
        }
      });


      // Créer nouveau dossier
      document.getElementById('createNewFolder').addEventListener('click', () => {
        this.createNewFolder();
      });

      // Annuler création de dossier
      document.getElementById('cancelFolderCreation').addEventListener('click', () => {
        this.hideFolderCreationField();
      });

      // Entrée pour créer dossier
      this.newFolderName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.createNewFolder();
        } else if (e.key === 'Escape') {
          this.hideFolderCreationField();
        }
      });

      // Sauvegarder nouveau projet
      document.getElementById('saveNewProject').addEventListener('click', () => {
        this.saveNewProject();
      });

      // Entrée pour sauvegarder
      this.newProjectName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.saveNewProject();
        }
      });

      // Export projet actuel
      document.getElementById('exportCurrentProject').addEventListener('click', () => {
        window.projectManager.exportProject();
      });

      // Import projet
      document.getElementById('importProject').addEventListener('click', () => {
        document.getElementById('importProjectFile').click();
      });

      document.getElementById('importProjectFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            await window.projectManager.importProject(file);
            this.refreshUI();
          } catch (error) {
            console.error('Erreur import:', error);
          }
          e.target.value = ''; // Reset input
        }
      });

      // Raccourci clavier Ctrl+S pour sauvegarder
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          this.openModal();
        }
      });

      // Échappement pour fermer
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal.style.display !== 'none') {
          this.closeModal();
        }
      });

      // Event delegation pour les boutons tooltip dans la liste des projets
      this.projectsList.addEventListener('click', (e) => {
        const tooltipBtn = e.target.closest('.tooltip-btn');
        if (!tooltipBtn) return;

        const projectItem = tooltipBtn.closest('.project-item');
        const folderItem = tooltipBtn.closest('.folder-item');

        // Actions sur les dossiers
        if (tooltipBtn.classList.contains('btn-rename-folder')) {
          const folderName = folderItem?.dataset.folderName;
          if (folderName) this.renameFolder(folderName);
        } else if (tooltipBtn.classList.contains('btn-delete-folder')) {
          const folderName = folderItem?.dataset.folderName;
          if (folderName) this.deleteFolder(folderName);
        }
        // Actions sur les projets
        else if (projectItem) {
          const projectName = projectItem.dataset.projectName;
          const currentFolder = projectItem.dataset.currentFolder || null;

          if (tooltipBtn.classList.contains('btn-load')) {
            this.loadProjectFromFolder(projectName, currentFolder);
          } else if (tooltipBtn.classList.contains('btn-save')) {
            this.overwriteProjectInFolder(projectName, currentFolder);
          } else if (tooltipBtn.classList.contains('btn-rename')) {
            this.renameProjectInFolder(projectName, currentFolder);
          } else if (tooltipBtn.classList.contains('btn-export')) {
            this.exportProjectFromFolder(projectName, currentFolder);
          } else if (tooltipBtn.classList.contains('btn-delete')) {
            this.deleteProjectFromFolder(projectName, currentFolder);
          }
        }
      });

      // Event delegation pour le drag & drop
      this.projectsList.addEventListener('dragstart', (e) => {
        const projectItem = e.target.closest('.project-item');
        if (projectItem) this.handleDragStart(e);
      });

      this.projectsList.addEventListener('dragend', (e) => {
        const projectItem = e.target.closest('.project-item');
        if (projectItem) this.handleDragEnd(e);
      });

      this.projectsList.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) this.handleDragOver(e);
      });

      this.projectsList.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) this.handleDrop(e);
      });

      this.projectsList.addEventListener('dragenter', (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) this.handleDragEnter(e);
      });

      this.projectsList.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.drop-zone');
        if (dropZone) this.handleDragLeave(e);
      });
    }

    openModal() {
      if (!this.modal) {
        console.error('[ProjectUI] Modal element introuvable !');
        return;
      }

      const modalContent = this.modal.querySelector('.project-modal-enhanced');

      // Move modal to end of body to avoid layout conflicts
      document.body.appendChild(this.modal);

      // Display modal with forced styles
      this.modal.style.display = 'flex';
      this.modal.style.position = 'fixed';
      this.modal.style.top = '0';
      this.modal.style.left = '0';
      this.modal.style.width = '100vw';
      this.modal.style.height = '100vh';
      this.modal.style.zIndex = '10001';
      this.modal.style.alignItems = 'center';
      this.modal.style.justifyContent = 'center';
      this.modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';

      if (modalContent) {
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';

        // Masquer les tooltips lors du scroll pour éviter les décalages
        const modalBody = modalContent.querySelector('.project-modal-body');
        if (modalBody) {
          modalBody.addEventListener('scroll', () => {
            const visibleTooltips = modalContent.querySelectorAll('.tooltip.is-visible');
            visibleTooltips.forEach(tooltip => tooltip.classList.remove('is-visible'));
          });
        }
      }

      this.refreshUI();

      // Focus sur le champ de nom
      setTimeout(() => {
        this.newProjectName.focus();
      }, 100);
    }

    closeModal() {
      this.modal.style.display = 'none';
      this.newProjectName.value = '';
      this.hideFolderCreationField();
    }

    openRenameModal(oldName, folderName = null, isFolder = false) {
      this.currentRenameData = { oldName, folderName, isFolder };

      if (isFolder) {
        this.currentProjectName.textContent = `📁 ${oldName}`;
        document.getElementById('renameModalTitle').textContent = '✏️ Renommer le dossier';
      } else {
        this.currentProjectName.textContent = folderName ? `${folderName}/${oldName}` : oldName;
        document.getElementById('renameModalTitle').textContent = '✏️ Renommer le projet';
      }

      this.newProjectNameInput.value = oldName;

      // Move modal to end of body to avoid layout conflicts
      document.body.appendChild(this.renameModal);

      // Display modal with forced styles - z-index plus élevé que la modale projets
      this.renameModal.style.display = 'flex';
      this.renameModal.style.position = 'fixed';
      this.renameModal.style.top = '0';
      this.renameModal.style.left = '0';
      this.renameModal.style.width = '100vw';
      this.renameModal.style.height = '100vh';
      this.renameModal.style.zIndex = '10002';
      this.renameModal.style.alignItems = 'center';
      this.renameModal.style.justifyContent = 'center';
      this.renameModal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';

      // Focus et sélection du texte
      setTimeout(() => {
        this.newProjectNameInput.focus();
        this.newProjectNameInput.select();
      }, 100);
    }

    closeRenameModal() {
      this.renameModal.style.display = 'none';
      this.newProjectNameInput.value = '';
      this.currentRenameData = null;
    }

    confirmRenameProject() {
      if (!this.currentRenameData) return;

      const newName = this.newProjectNameInput.value.trim();
      if (!newName) {
        showToast('⚠️ Veuillez entrer un nom');
        this.newProjectNameInput.focus();
        return;
      }

      const { oldName, folderName, isFolder } = this.currentRenameData;

      if (isFolder) {
        this.executeRenameFolder(oldName, newName);
      } else if (folderName) {
        this.executeRenameInFolder(oldName, folderName, newName);
      } else {
        this.executeRename(oldName, newName);
      }

      this.closeRenameModal();
    }


    toggleFolderCreationField() {
      if (this.folderCreationField.style.display === 'none') {
        this.showFolderCreationField();
      } else {
        this.hideFolderCreationField();
      }
    }

    showFolderCreationField() {
      this.folderCreationField.style.display = 'flex';
      this.toggleFolderCreation.textContent = '− Annuler';
      this.toggleFolderCreation.classList.add('active');

      // Focus sur le champ avec un léger délai pour l'animation
      setTimeout(() => {
        this.newFolderName.focus();
      }, 100);
    }

    hideFolderCreationField() {
      this.folderCreationField.style.display = 'none';
      this.toggleFolderCreation.textContent = '+ Créer un dossier';
      this.toggleFolderCreation.classList.remove('active');
      this.newFolderName.value = '';
    }

    createNewFolder() {
      const name = this.newFolderName.value.trim();
      if (!name) {
        showToast('⚠️ Veuillez entrer un nom de dossier');
        this.newFolderName.focus();
        return;
      }

      if (window.projectManager.createFolder(name)) {
        this.hideFolderCreationField();
        this.refreshUI();
      }
    }

    saveNewProject() {
      const name = this.newProjectName.value.trim();
      const folderName = this.projectFolder.value || null;

      if (!name) {
        showToast('⚠️ Veuillez entrer un nom de projet');
        this.newProjectName.focus();
        return;
      }

      // Vérifier si le projet existe déjà dans le bon emplacement
      const data = window.projectManager.getAllProjects();
      let existingProject = false;

      if (folderName) {
        existingProject = data.folders[folderName]?.projects[name];
      } else {
        existingProject = data.projects[name];
      }

      if (existingProject) {
        const location = folderName ? `dans "${folderName}"` : 'à la racine';
        const confirmOverwrite = confirm(`Le projet "${name}" existe déjà ${location}.\nVoulez-vous l'écraser ?`);
        if (!confirmOverwrite) {
          this.newProjectName.focus();
          return;
        }
      }

      if (window.projectManager.saveProject(name, folderName)) {
        this.newProjectName.value = '';
        this.refreshUI();
        this.closeModal();
      }
    }

    refreshUI() {
      this.renderProjectsList();
      this.renderAutoSaveInfo();
      this.updateProjectsDatalist();
      this.updateFoldersSelect();
    }

    updateProjectsDatalist() {
      const datalist = document.getElementById('existingProjects');
      if (!datalist) return;

      const data = window.projectManager.getAllProjects();
      const allProjectNames = [];

      // Ajouter les projets à la racine
      Object.keys(data.projects).forEach(name => {
        allProjectNames.push(name);
      });

      // Ajouter les projets dans les dossiers
      Object.values(data.folders).forEach(folder => {
        Object.keys(folder.projects || {}).forEach(name => {
          allProjectNames.push(name);
        });
      });

      datalist.innerHTML = allProjectNames.map(name =>
        `<option value="${name}"></option>`
      ).join('');
    }

    updateFoldersSelect() {
      if (!this.projectFolder) return;

      const data = window.projectManager.getAllProjects();
      const folderNames = Object.keys(data.folders);

      this.projectFolder.innerHTML = `
        <option value="">🏠 Racine (sans dossier)</option>
        ${folderNames.map(name =>
          `<option value="${name}">📁 ${name}</option>`
        ).join('')}
      `;
    }

    renderProjectsList() {
      const data = window.projectManager.getAllProjects();
      const hasProjects = Object.keys(data.projects).length > 0 || Object.keys(data.folders).length > 0;

      if (!hasProjects) {
        this.projectsList.innerHTML = `
          <div class="projects-empty">
            🗂️ Aucun projet sauvegardé<br>
            <small>Créez votre premier projet en entrant un nom ci-dessus</small>
          </div>
        `;
        return;
      }

      let html = '';

      // Afficher les dossiers
      const folderNames = Object.keys(data.folders).sort();
      folderNames.forEach(folderName => {
        const folder = data.folders[folderName];
        const projectCount = Object.keys(folder.projects || {}).length;

        html += `
          <div class="folder-item drop-zone"
               data-folder-name="${folderName}">
            <div class="folder-header">
              <span class="folder-icon">📁</span>
              <span class="folder-name">${folderName}</span>
              <span class="folder-count">(${projectCount} projet${projectCount > 1 ? 's' : ''})</span>
              <div class="folder-actions">
                <button class="tooltip-btn btn-rename-folder" data-tooltip="Renommer ce dossier">✏️</button>
                <button class="tooltip-btn btn-delete-folder" data-tooltip="Supprimer ce dossier">🗑️</button>
              </div>
            </div>
            <div class="folder-projects">
              ${this.renderFolderProjects(folder.projects || {}, folderName)}
            </div>
          </div>
        `;
      });

      // Afficher les projets à la racine
      const rootProjects = Object.keys(data.projects);
      if (rootProjects.length > 0) {
        html += `
          <div class="folder-item drop-zone"
               data-folder-name="">
            <div class="folder-header">
              <span class="folder-icon">🏠</span>
              <span class="folder-name">Projets sans dossier</span>
              <span class="folder-count">(${rootProjects.length} projet${rootProjects.length > 1 ? 's' : ''})</span>
            </div>
            <div class="folder-projects">
              ${this.renderFolderProjects(data.projects, null)}
            </div>
          </div>
        `;
      }

      this.projectsList.innerHTML = html;
    }

    renderFolderProjects(projects, folderName) {
      const projectNames = Object.keys(projects);

      if (projectNames.length === 0) {
        return '<div class="folder-empty">Aucun projet dans ce dossier</div>';
      }

      // Trier par date de modification
      projectNames.sort((a, b) => {
        const dateA = new Date(projects[a].lastModified || projects[a].created);
        const dateB = new Date(projects[b].lastModified || projects[b].created);
        return dateB - dateA;
      });

      return projectNames.map(name => {
        const project = projects[name];
        const lastModified = new Date(project.lastModified || project.created);
        const totalObjects = (project.fourreaux?.length || 0) + (project.cables?.length || 0);

        return `
          <div class="project-item"
               draggable="true"
               data-project-name="${name}"
               data-current-folder="${folderName || ''}">
            <div class="project-info">
              <div class="project-name" title="${name}">
                <span class="drag-handle">⋮⋮</span>
                ${name}
              </div>
              <div class="project-meta">
                <span>📅 ${this.formatDate(lastModified)}</span>
                <span>📦 ${totalObjects} objets</span>
                <span>📏 ${project.container?.shape === 'rect' ?
                  `${project.container.width}×${project.container.height}mm` :
                  `⌀${project.container?.diameter || '?'}mm`}</span>
              </div>
            </div>
            <div class="project-actions">
              <button class="tooltip-btn btn-load" data-tooltip="Charger ce projet">📂</button>
              <button class="tooltip-btn btn-save" data-tooltip="Écraser avec l'état actuel">💾</button>
              <button class="tooltip-btn btn-rename" data-tooltip="Renommer ce projet">✏️</button>
              <button class="tooltip-btn btn-export" data-tooltip="Exporter vers fichier">📤</button>
              <button class="tooltip-btn btn-delete" data-tooltip="Supprimer définitivement">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    }


    renderAutoSaveInfo() {
      if (!this.autoSaveStatus || !this.autoSaveText || !this.autoSaveDetails) return;

      const autoSave = window.projectManager.loadAutoSave();
      const stats = window.projectManager.getStorageStats();

      if (autoSave) {
        const lastSave = new Date(autoSave.timestamp);
        const totalObjects = (autoSave.fourreaux?.length || 0) + (autoSave.cables?.length || 0);
        const timeDiff = Date.now() - lastSave.getTime();
        const minutesAgo = Math.floor(timeDiff / 60000);

        // Statut principal
        this.autoSaveText.textContent = `Auto-sauvegarde disponible`;
        this.autoSaveStatus.querySelector('.icon').textContent = '💾';
        this.autoSaveStatus.style.color = '#22c55e';

        // Détails
        this.autoSaveDetails.innerHTML = `
          Dernière sauvegarde: ${minutesAgo < 1 ? 'à l\'instant' : `il y a ${minutesAgo}min`}<br>
          Objets: ${totalObjects} • Taille: ${this.formatBytes(JSON.stringify(autoSave).length)}<br>
          Projets: ${stats.projectCount} • Stockage: ${this.formatBytes(stats.totalSize)}
        `;

        // Afficher le bouton restaurer
        this.restoreAutoSave.style.display = 'block';

        // Warning si trop ancien
        if (timeDiff > 15 * 60 * 1000) {
          this.autoSaveStatus.style.color = '#f59e0b';
          this.autoSaveStatus.querySelector('.icon').textContent = '⚠️';
        }
      } else {
        this.autoSaveText.textContent = 'Aucune auto-sauvegarde';
        this.autoSaveStatus.querySelector('.icon').textContent = '💾';
        this.autoSaveStatus.style.color = '#94a3b8';

        this.autoSaveDetails.innerHTML = `
          Auto-sauvegarde toutes les 30 secondes<br>
          Projets: ${stats.projectCount} • Stockage: ${this.formatBytes(stats.totalSize)}
        `;

        this.restoreAutoSave.style.display = 'none';
      }
    }

    async loadProject(projectName) {
      const confirmed = await customConfirm(
        `Charger le projet "${projectName}" ?\n\nLe projet actuel sera remplacé.`,
        'Charger le projet'
      );
      if (confirmed) {
        if (window.projectManager.loadProject(projectName)) {
          this.closeModal();
          showToast(`📂 Projet "${projectName}" chargé avec succès`);
        }
      }
    }

    exportProject(projectName) {
      window.projectManager.exportProject(projectName);
    }

    async overwriteProject(projectName) {
      const confirmed = await customConfirm(
        `Écraser le projet "${projectName}" avec l'état actuel ?\n\nLes données du projet seront remplacées.`,
        'Écraser le projet'
      );
      if (confirmed) {
        if (window.projectManager.saveProject(projectName)) {
          this.refreshUI();
          showToast(`💾 Projet "${projectName}" écrasé avec succès`);
        }
      }
    }

    renameProject(oldName) {
      this.openRenameModal(oldName);
    }

    executeRename(oldName, newName) {
      if (newName === oldName) {
        return; // Pas de changement
      }

      if (window.projectManager.renameProject(oldName, newName)) {
        this.refreshUI();
        showToast(`✏️ Projet renommé : "${oldName}" → "${newName}"`);
      }
    }

    async deleteProject(projectName) {
      const confirmed = await customConfirm(
        `Supprimer définitivement le projet "${projectName}" ?\n\nCette action est irréversible.`,
        'Supprimer le projet'
      );
      if (confirmed) {
        if (window.projectManager.deleteProject(projectName)) {
          this.refreshUI();
          showToast(`🗑️ Projet "${projectName}" supprimé`);
        }
      }
    }

    async loadAutoSave() {
      const autoSave = window.projectManager.loadAutoSave();
      if (autoSave) {
        const confirmed = await customConfirm(
          'Restaurer la dernière auto-sauvegarde ?\n\nLe projet actuel sera remplacé.',
          'Restaurer auto-sauvegarde'
        );
        if (confirmed) {
          if (window.projectManager.restoreState(autoSave)) {
            showToast('🔄 Auto-sauvegarde restaurée');
            this.closeModal();
          }
        }
      } else {
        showToast('❌ Aucune auto-sauvegarde disponible');
      }
    }

    formatDate(date) {
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'À l\'instant';
      if (minutes < 60) return `Il y a ${minutes}min`;
      if (hours < 24) return `Il y a ${hours}h`;
      if (days < 7) return `Il y a ${days}j`;

      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Nouvelles méthodes pour gérer les projets dans les dossiers
    async loadProjectFromFolder(projectName, folderName) {
      const fullName = folderName ? `${folderName}/${projectName}` : projectName;
      const confirmed = await customConfirm(
        `Charger le projet "${fullName}" ?\n\nLe projet actuel sera remplacé.`,
        'Charger le projet'
      );
      if (confirmed) {
        const data = window.projectManager.getAllProjects();
        let project;

        if (folderName) {
          project = data.folders[folderName]?.projects[projectName];
        } else {
          project = data.projects[projectName];
        }

        if (project && window.projectManager.restoreState(project)) {
          this.closeModal();
          showToast(`📂 Projet "${fullName}" chargé avec succès`);
        }
      }
    }

    async overwriteProjectInFolder(projectName, folderName) {
      const fullName = folderName ? `${folderName}/${projectName}` : projectName;
      const confirmed = await customConfirm(
        `Écraser le projet "${fullName}" avec l'état actuel ?\n\nLes données du projet seront remplacées.`,
        'Écraser le projet'
      );
      if (confirmed) {
        if (window.projectManager.saveProject(projectName, folderName)) {
          this.refreshUI();
          showToast(`💾 Projet "${fullName}" écrasé avec succès`);
        }
      }
    }

    renameProjectInFolder(oldName, folderName) {
      this.openRenameModal(oldName, folderName);
    }

    executeRenameInFolder(oldName, folderName, newName) {
      if (newName === oldName) {
        return;
      }

      // Vérifier si le nouveau nom existe déjà
      const data = window.projectManager.getAllProjects();
      let exists = false;

      if (folderName) {
        exists = data.folders[folderName]?.projects[newName];
      } else {
        exists = data.projects[newName];
      }

      if (exists) {
        showToast(`⚠️ Un projet nommé "${newName}" existe déjà dans cet emplacement`);
        return;
      }

      // Effectuer le renommage
      try {
        if (folderName) {
          const folder = data.folders[folderName];
          const projectData = { ...folder.projects[oldName] };
          projectData.name = newName;
          projectData.lastModified = new Date().toISOString();

          folder.projects[newName] = projectData;
          delete folder.projects[oldName];
        } else {
          const projectData = { ...data.projects[oldName] };
          projectData.name = newName;
          projectData.lastModified = new Date().toISOString();

          data.projects[newName] = projectData;
          delete data.projects[oldName];
        }

        localStorage.setItem(window.projectManager.storageKey, JSON.stringify(data));
        this.refreshUI();
        showToast(`✏️ Projet renommé : "${oldName}" → "${newName}"`);
      } catch (error) {
        console.error('Erreur renommage projet:', error);
        showToast('Erreur lors du renommage');
      }
    }

    exportProjectFromFolder(projectName, folderName) {
      const data = window.projectManager.getAllProjects();
      let project;

      if (folderName) {
        project = data.folders[folderName]?.projects[projectName];
      } else {
        project = data.projects[projectName];
      }

      if (!project) {
        showToast('⚠️ Projet introuvable');
        return;
      }

      const fullName = folderName ? `${folderName}_${projectName}` : projectName;
      const filename = `${fullName.replace(/[^a-z0-9]/gi, '_')}.tontonkad`;

      const blob = new Blob([JSON.stringify(project, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`📤 Projet "${projectName}" exporté`);
    }

    async deleteProjectFromFolder(projectName, folderName) {
      const fullName = folderName ? `${folderName}/${projectName}` : projectName;
      const confirmed = await customConfirm(
        `Supprimer définitivement le projet "${fullName}" ?\n\nCette action est irréversible.`,
        'Supprimer le projet'
      );
      if (confirmed) {
        try {
          const data = window.projectManager.getAllProjects();

          if (folderName) {
            if (data.folders[folderName]?.projects[projectName]) {
              delete data.folders[folderName].projects[projectName];
            }
          } else {
            if (data.projects[projectName]) {
              delete data.projects[projectName];
            }
          }

          localStorage.setItem(window.projectManager.storageKey, JSON.stringify(data));
          this.refreshUI();
          showToast(`🗑️ Projet "${fullName}" supprimé`);
        } catch (error) {
          console.error('Erreur suppression projet:', error);
          showToast('Erreur lors de la suppression');
        }
      }
    }

    renameFolder(folderName) {
      this.openRenameModal(folderName, null, true);
    }

    executeRenameFolder(oldName, newName) {
      if (newName === oldName) {
        return;
      }

      // Vérifier si le nouveau nom existe déjà
      const data = window.projectManager.getAllProjects();
      if (data.folders[newName]) {
        showToast(`⚠️ Un dossier nommé "${newName}" existe déjà`);
        return;
      }

      try {
        // Copier le dossier avec le nouveau nom
        const folderData = { ...data.folders[oldName] };
        folderData.name = newName;
        folderData.lastModified = new Date().toISOString();

        data.folders[newName] = folderData;
        delete data.folders[oldName];

        localStorage.setItem(window.projectManager.storageKey, JSON.stringify(data));
        this.refreshUI();
        showToast(`✏️ Dossier renommé : "${oldName}" → "${newName}"`);
      } catch (error) {
        console.error('Erreur renommage dossier:', error);
        showToast('Erreur lors du renommage du dossier');
      }
    }

    deleteFolder(folderName) {
      if (window.projectManager.deleteFolder(folderName)) {
        this.refreshUI();
      }
    }

    // ===== LOGIQUE DRAG & DROP =====

    handleDragStart(event) {
      const projectItem = event.target.closest('.project-item');
      const projectName = projectItem.dataset.projectName;
      const currentFolder = projectItem.dataset.currentFolder;

      // Stocker les données du projet en cours de drag
      event.dataTransfer.setData('text/plain', JSON.stringify({
        projectName: projectName,
        currentFolder: currentFolder
      }));

      // Ajouter une classe visuelle au projet en cours de drag
      projectItem.classList.add('dragging');

      // Marquer toutes les zones de drop comme visibles
      document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.add('drop-available');
      });

      event.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(event) {
      const projectItem = event.target.closest('.project-item');
      projectItem.classList.remove('dragging');

      // Nettoyer toutes les classes visuelles
      document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drop-available', 'drop-hover');
      });
    }

    handleDragOver(event) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(event) {
      event.preventDefault();
      const dropZone = event.currentTarget;
      dropZone.classList.add('drop-hover');
    }

    handleDragLeave(event) {
      const dropZone = event.currentTarget;
      // Vérifier si on quitte vraiment la zone (pas un enfant)
      if (!dropZone.contains(event.relatedTarget)) {
        dropZone.classList.remove('drop-hover');
      }
    }

    handleDrop(event) {
      event.preventDefault();

      const dropZone = event.target.closest('.drop-zone');
      if (!dropZone) {
        console.warn('[DRAG] Pas de drop-zone trouvée');
        return;
      }

      const targetFolder = dropZone.dataset.folderName;
      console.debug('[DRAG] Drop détecté:', {
        dropZoneElement: dropZone,
        targetFolder: targetFolder || 'Racine',
        datasetFolderName: dropZone.dataset.folderName
      });

      // Récupérer les données du projet
      let dragData;
      try {
        dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch (error) {
        console.error('Erreur lecture données drag:', error);
        return;
      }

      const { projectName, currentFolder } = dragData;

      // Normaliser les valeurs vides (null, undefined, '') en null
      const normalizedSource = currentFolder || null;
      const normalizedTarget = targetFolder || null;

      // Vérifier si le projet change vraiment de dossier
      if (normalizedSource === normalizedTarget) {
        showToast('📁 Le projet est déjà dans ce dossier');
        return;
      }

      // Déplacer le projet
      this.moveProject(projectName, currentFolder, targetFolder);

      // Nettoyer les classes visuelles
      dropZone.classList.remove('drop-hover');
    }

    moveProject(projectName, sourceFolder, targetFolder) {
      try {
        const data = window.projectManager.getAllProjects();

        // Récupérer le projet source
        let project;
        if (sourceFolder) {
          project = data.folders[sourceFolder]?.projects[projectName];
          if (!project) {
            showToast('⚠️ Projet source introuvable');
            return;
          }
        } else {
          project = data.projects[projectName];
          if (!project) {
            showToast('⚠️ Projet source introuvable');
            return;
          }
        }

        // Vérifier si un AUTRE projet avec le même nom existe déjà dans la destination
        let existsInTarget = false;
        if (targetFolder) {
          existsInTarget = data.folders[targetFolder]?.projects[projectName];
        } else {
          existsInTarget = data.projects[projectName];
        }

        console.debug('[DEBUG] Déplacement projet:', {
          projectName,
          sourceFolder: sourceFolder || 'Racine',
          targetFolder: targetFolder || 'Racine',
          existsInTarget: !!existsInTarget
        });

        if (existsInTarget) {
          showToast(`⚠️ Un projet nommé "${projectName}" existe déjà dans le dossier de destination`);
          return;
        }

        // Mettre à jour les métadonnées du projet
        const updatedProject = {
          ...project,
          folder: targetFolder || null,
          lastModified: new Date().toISOString()
        };

        // Ajouter à la destination
        if (targetFolder) {
          if (!data.folders[targetFolder]) {
            showToast(`⚠️ Dossier de destination "${targetFolder}" introuvable`);
            return;
          }
          data.folders[targetFolder].projects[projectName] = updatedProject;
        } else {
          data.projects[projectName] = updatedProject;
        }

        // Supprimer de la source
        if (sourceFolder) {
          delete data.folders[sourceFolder].projects[projectName];
        } else {
          delete data.projects[projectName];
        }

        // Sauvegarder
        localStorage.setItem(window.projectManager.storageKey, JSON.stringify(data));

        // Rafraîchir l'interface
        this.refreshUI();

        // Message de succès
        const sourceName = sourceFolder || 'Racine';
        const targetName = targetFolder || 'Racine';
        showToast(`📁 Projet "${projectName}" déplacé : ${sourceName} → ${targetName}`);

      } catch (error) {
        console.error('Erreur déplacement projet:', error);
        showToast('Erreur lors du déplacement du projet');
      }
    }

    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  }

  /* ====== Event listeners pour Electron ====== */
  // Écouter l'événement d'export DXF depuis le menu Electron
  window.addEventListener('electron-export-dxf', () => {
    exportDXF();
  });

  init();

})();

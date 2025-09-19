(function() {
  "use strict";

  /* ====== Constantes & DOM ====== */
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

  // Éléments du DOM
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  
  // Variables pour la haute résolution - Optimisation adaptative
  let pixelRatio = window.devicePixelRatio || 1;
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
  const rectInputs = document.getElementById("rectInputs");
  const circInputs = document.getElementById("circInputs");
  const boxWInput = document.getElementById("boxW");
  const boxHInput = document.getElementById("boxH");
  const boxDInput = document.getElementById("boxD");
  const applyBtn = document.getElementById("apply");
  const applyCircBtn = document.getElementById("applyCirc");
  const targetPxPerMmInput = document.getElementById("targetPxPerMm");
  const zoomSlider = document.getElementById("zoomSlider");
  const zoomLabel = document.getElementById("zoomLabel");
  const scaleInfo = document.getElementById("scaleInfo");
  const tabFOURREAU = document.getElementById("tabFOURREAU");
  const tabCABLE = document.getElementById("tabCABLE");
  const paneFOURREAU = document.getElementById("paneFOURREAU");
  const paneCABLE = document.getElementById("paneCABLE");
  const fourreauSelect = document.getElementById("fourreauSelect");
  const cableSelect = document.getElementById("cableSelect");
  const listCable = document.getElementById("listCable");
  const listFourreau = document.getElementById("listFourreau");
  const countInvC = document.getElementById("countInvC"); //
  const countInvF = document.getElementById("countInvF");
  const typesInvC = document.getElementById("typesInvC"); //
  const typesInvF = document.getElementById("typesInvF");
  const searchCable = document.getElementById("searchCable"); //
  const searchFourreau = document.getElementById("searchFourreau");
  // Anciens toolPlace et toolSelect supprimés
  const toolDelete = document.getElementById("toolDelete"); //
  const statFourreau = document.getElementById("statFourreau");
  const statCable = document.getElementById("statCable"); //

  const statOccupation = document.getElementById("statOccupation");
  const selInfo = document.getElementById("selInfo");
  const toast = document.getElementById("toast");
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
      // Tentative de chargement des fichiers CSV externes
      const [tpcResponse, cableResponse, cheminsCableResponse] = await Promise.all([
        fetch('../data/fourreaux.csv'),
        fetch('../data/cables.csv'),
        fetch('../data/chemins_de_cable.csv')
      ]);

      if (!tpcResponse.ok || !cableResponse.ok || !cheminsCableResponse.ok) {
        let msg = '';
        if (!tpcResponse.ok) msg += `../data/fourreaux.csv: ${tpcResponse.statusText}. `;
        if (!cableResponse.ok) msg += `../data/cables.csv: ${cableResponse.statusText}.`;
        if (!cheminsCableResponse.ok) msg += `../data/chemins_de_cable.csv: ${cheminsCableResponse.statusText}.`;
        throw new Error(`Erreur réseau: ${msg}`);
      }

      const tpcText = await tpcResponse.text();
      const cableText = await cableResponse.text();
      const cheminsCableText = await cheminsCableResponse.text();

      FOURREAUX = parseCSV(tpcText);
      CABLES = parseCSV(cableText);
      CHEMINS_CABLE = parseCSV(cheminsCableText, ',');

      if (FOURREAUX.length === 0 || CABLES.length === 0 || CHEMINS_CABLE.length === 0) {
        throw new Error('Les données CSV sont vides ou n\'ont pas pu être analysées.');
      }
      
      // Données CSV chargées avec succès
      
    } catch (error) {
      // Impossible de charger les fichiers CSV externes - utilisation des données intégrées
      
      // Utiliser les données de fallback
      FOURREAUX = [...FOURREAUX_FALLBACK];
      CABLES = [...CABLES_FALLBACK];
      CHEMINS_CABLE = [...CHEMINS_CABLE_FALLBACK];
    }
  }

  /* ====== Sélecteurs & Listes ====== */
  function populateSelectors() {
    const cableFams = [...new Set(CABLES.map(c => c.fam))];
    const fourreauTypes = [...new Set(FOURREAUX.map(f => f.type))];

    fourreauSelect.innerHTML = '';
    fourreauTypes.forEach(type => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = type;
      
      FOURREAUX.filter(f => f.type === type).forEach(f => {
        const option = document.createElement('option');
        option.value = `${f.type}|${f.code}`;
        option.textContent = `${f.type} ${f.code} — Øint ≥ ${f.id} mm`;
        optgroup.appendChild(option);
      });
      
      fourreauSelect.appendChild(optgroup);
    });

    cableSelect.innerHTML = '';
    cableFams.forEach(fam => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = fam;
      
      CABLES.filter(c => c.fam === fam).forEach(c => {
        const option = document.createElement('option');
        option.value = `${c.fam}|${c.code}`;
        option.textContent = `${fam} – ${c.code} (Ø ${c.od} mm)`;
        optgroup.appendChild(option);
      });
      
      cableSelect.appendChild(optgroup);
    });

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
    const zr = (parseFloat(zoomSlider.value) || 100) / 100;
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
      return NaN
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

  function findFreeSpotInFourreau(x, y, r, fourreau, ignoreId) {
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
    for (let rad = step; rad < ri; rad += step) {
      const n = Math.ceil(2 * Math.PI * rad / step);
      for (let i = 0; i < n; i++) {
        const a = i / n * 2 * Math.PI, nx = x + rad * Math.cos(a), ny = y + rad * Math.sin(a);
        if (inside(nx, ny) && !hits(nx, ny)) return { x: nx, y: ny }
      }
    }
    return null;
  }

  /* ====== Ajout/Suppression d'objets ====== */
  function addFourreauAt(x, y, type, code) {
    const spec = FOURREAUX.find(f => f.type === type && f.code === code);
    if (!spec) return false;
    const ro = spec.od * MM_TO_PX / 2, spot = findFreeSpot(x, y, ro, null);
    if (!spot) return false;
    const obj = { id: nextId++, x: spot.x, y: spot.y, od: spec.od, idm: spec.id, color: colorForFourreau(type, code), customColor: null, label: '', children: [], vx: 0, vy: 0, dragging: false, frozen: false, _px: spot.x, _py: spot.y, type, code };
    fourreaux.push(obj);
    updateStats();
    updateInventory();
    redraw();
    return obj;
  }

  function addCableAt(x, y, fam, code, prefTPC) {
    const spec = CABLES.find(c => c.fam === fam && c.code === code);
    if (!spec) return false;
    const r = spec.od * MM_TO_PX / 2;
    let container = prefTPC && fitsInFourreau(spec, prefTPC) ? prefTPC : findFourreauUnder(x, y, spec.od);
    if (container && !fitsInFourreau(spec, container)) container = null;
    const spot = container ? findFreeSpotInFourreau(x, y, r, container) : findFreeSpot(x, y, r, null);
    if (!spot) return false;
    const obj = { id: nextId++, x: spot.x, y: spot.y, od: spec.od, parent: container ? container.id : null, color: colorForCable(fam, code), customColor: null, label: '', fam, code, vx: 0, vy: 0, dragging: false, frozen: false, _px: spot.x, _py: spot.y };
    cables.push(obj);
    if (container) container.children.push(obj.id);
    updateStats();
    updateInventory();
    redraw();
    return obj;
  }

  // Fonctions utilitaires pour arrangeConduitGrid
  function calculateGridDimensions(conduitCount, containerSize) {
    const aspectRatio = containerSize.width / containerSize.height;
    const approxCols = Math.ceil(Math.sqrt(conduitCount * aspectRatio));
    const approxRows = Math.ceil(conduitCount / approxCols);
    return { cols: approxCols, rows: approxRows };
  }

  function positionConduitsInGrid(conduits, gridConfig, containerSize, margin) {
    const { cols, rows, cellWidth, cellHeight } = gridConfig;
    const startX = margin + cellWidth / 2;
    const startY = margin + cellHeight / 2;
    
    conduits.forEach((conduit, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      conduit.x = startX + col * cellWidth;
      conduit.y = startY + row * cellHeight;
    });
  }

  function arrangeConduitGrid() {
    if (fourreaux.length === 0) {
      showToast('Aucun fourreau à disposer en grille');
      return;
    }

    // Empêcher la suppression des fourreaux durant l'arrangement
    arrangeInProgress = true;

    // Obtenir les dimensions de la boîte
    const shape = shapeSel.value;
    let boxWidth, boxHeight, boxDiameter;
    
    if (shape === 'rect') {
      boxWidth = parseFloat(boxWInput.value) * MM_TO_PX;
      boxHeight = parseFloat(boxHInput.value) * MM_TO_PX;
    } else if (shape === 'circ') {
      boxDiameter = parseFloat(boxDInput.value);
      boxWidth = boxHeight = boxDiameter * MM_TO_PX;
    } else {
      showToast('Grille non supportée pour les chemins de câbles');
      arrangeInProgress = false;
      return;
    }

    // Étape 1 : Trier les fourreaux par taille (gros en bas)
    const sortedFourreaux = [...fourreaux].sort((a, b) => b.od - a.od); // Plus gros d'abord
    
    // Étape 2 : Calculer les dimensions optimales de grille (privilégier la largeur)
    const availableWidth = boxWidth - (2 * GRID_MARGIN);
    const availableHeight = boxHeight - (2 * GRID_MARGIN);
    
    // Fonction pour calculer les dimensions qui rentrent strictement dans la boîte
    function calculateConstrainedGrid(numItems, maxWidth, maxHeight) {
      if (numItems === 1) return { cols: 1, rows: 1, fits: true };
      
      // Estimer l'espacement moyen nécessaire
      const avgDiameter = fourreaux.reduce((sum, f) => sum + f.od, 0) / fourreaux.length;
      const avgSpacing = (avgDiameter + EXTERNAL_GAP) * MM_TO_PX;
      
      // Calculer le nombre max strict de colonnes/lignes possibles
      const maxStrictCols = Math.floor(maxWidth / avgSpacing) || 1;
      const maxStrictRows = Math.floor(maxHeight / avgSpacing) || 1;
      const maxCapacity = maxStrictCols * maxStrictRows;
      
      // Si ça ne peut pas rentrer du tout
      if (maxCapacity < numItems) {
        return { cols: maxStrictCols, rows: maxStrictRows, fits: false, maxCapacity };
      }
      
      let bestCols = 1, bestRows = numItems;
      let bestRatio = 0;
      
      // Essayer toutes les combinaisons QUI RENTRENT dans les contraintes
      for (let cols = 1; cols <= Math.min(numItems, maxStrictCols); cols++) {
        const rows = Math.ceil(numItems / cols);
        
        // Vérifier que ça rentre strictement
        if (rows > maxStrictRows) continue;
        if (cols * avgSpacing > maxWidth || rows * avgSpacing > maxHeight) continue;
        
        // Privilégier la largeur
        const ratio = cols / rows;
        
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestCols = cols;
          bestRows = rows;
        }
      }
      
      return { cols: bestCols, rows: bestRows, fits: true };
    }
    
    // Étape 3 : Essayer de faire rentrer dans les dimensions actuelles
    const gridResult = calculateConstrainedGrid(fourreaux.length, availableWidth, availableHeight);
    
    if (!gridResult.fits) {
      // Calculer les dimensions minimales nécessaires
      const avgDiameter = fourreaux.reduce((sum, f) => sum + f.od, 0) / fourreaux.length;
      const avgSpacing = (avgDiameter + EXTERNAL_GAP) * MM_TO_PX;
      
      // Proposition optimale (privilégier la largeur)
      let optimalCols = Math.ceil(Math.sqrt(fourreaux.length * 1.5)); // Ratio 1.5 pour privilégier la largeur
      let optimalRows = Math.ceil(fourreaux.length / optimalCols);
      
      // Ajuster si nécessaire
      while (optimalCols * optimalRows < fourreaux.length) {
        if (optimalCols <= optimalRows) {
          optimalCols++;
        } else {
          optimalRows++;
        }
      }
      
      // Calculer les dimensions réelles nécessaires avec grille adaptative
      const tempGrid = [];
      for (let row = 0; row < optimalRows; row++) {
        tempGrid[row] = [];
      }
      
      // Simuler le placement des fourreaux triés
      let index = 0;
      for (let row = optimalRows - 1; row >= 0 && index < sortedFourreaux.length; row--) {
        for (let col = 0; col < optimalCols && index < sortedFourreaux.length; col++) {
          tempGrid[row][col] = sortedFourreaux[index];
          index++;
        }
      }
      
      // Calculer les largeurs de colonnes nécessaires
      const tempColWidths = [];
      for (let col = 0; col < optimalCols; col++) {
        let maxDiameter = 0;
        for (let row = 0; row < tempGrid.length; row++) {
          if (tempGrid[row] && tempGrid[row][col]) {
            maxDiameter = Math.max(maxDiameter, tempGrid[row][col].od);
          }
        }
        tempColWidths[col] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) : 0;
      }
      
      // Calculer les hauteurs de lignes nécessaires
      const tempRowHeights = [];
      for (let row = 0; row < tempGrid.length; row++) {
        let maxDiameter = 0;
        for (let col = 0; col < tempGrid[row].length; col++) {
          if (tempGrid[row][col]) {
            maxDiameter = Math.max(maxDiameter, tempGrid[row][col].od);
          }
        }
        tempRowHeights[row] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) : 0;
      }
      
      // Calculer les dimensions totales et arrondir à la dizaine supérieure
      const totalWidthMM = tempColWidths.reduce((sum, w) => sum + w, 0) + (2 * GRID_MARGIN / MM_TO_PX);
      const totalHeightMM = tempRowHeights.reduce((sum, h) => sum + h, 0) + (2 * GRID_MARGIN / MM_TO_PX);
      
      const suggestedWidth = Math.ceil(totalWidthMM / 10) * 10; // Arrondi à la dizaine supérieure
      const suggestedHeight = Math.ceil(totalHeightMM / 10) * 10; // Arrondi à la dizaine supérieure
      
      // Afficher la popup de proposition
      showResizePopup(shape, fourreaux.length, suggestedWidth, suggestedHeight, optimalCols, optimalRows);
      
      // Réactiver la possibilité de suppression
      arrangeInProgress = false;
      return;
    }
    
    const { cols: approxCols, rows: approxRows } = gridResult;

    // Étape 4 : Organiser les fourreaux dans la grille (gros en bas)
    const grid = [];
    for (let row = 0; row < approxRows; row++) {
      grid[row] = [];
    }
    
    // Créer des groupes de fourreaux par ligne pour placer les gros en bas
    const rowGroups = [];
    for (let i = 0; i < sortedFourreaux.length; i += approxCols) {
      rowGroups.push(sortedFourreaux.slice(i, i + approxCols));
    }
    
    // Placer les groupes en commençant par le bas (gros fourreaux en bas)
    let rowIndex = 0;
    for (let row = approxRows - 1; row >= 0 && rowIndex < rowGroups.length; row--) {
      const currentRowGroup = rowGroups[rowIndex];
      for (let col = 0; col < approxCols && col < currentRowGroup.length; col++) {
        grid[row][col] = currentRowGroup[col];
      }
      rowIndex++;
    }

    // Étape 5 : Calculer les dimensions adaptatives de chaque ligne et colonne
    const rowHeights = [];
    const colWidths = [];
    
    // Hauteur de chaque ligne = diamètre du plus gros fourreau de la ligne + gap
    for (let row = 0; row < grid.length; row++) {
      let maxDiameter = 0;
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col]) {
          maxDiameter = Math.max(maxDiameter, grid[row][col].od);
        }
      }
      rowHeights[row] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) * MM_TO_PX : 0;
    }
    
    // Largeur de chaque colonne = diamètre du plus gros fourreau de la colonne + gap
    for (let col = 0; col < approxCols; col++) {
      let maxDiameter = 0;
      for (let row = 0; row < grid.length; row++) {
        if (grid[row] && grid[row][col]) {
          maxDiameter = Math.max(maxDiameter, grid[row][col].od);
        }
      }
      colWidths[col] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) * MM_TO_PX : 0;
    }

    // Les fourreaux rentrent dans la boîte actuelle - pas de redimensionnement
    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

    // Étape 6 : Calculer les positions de départ (centrage)
    const center = getCanvasCenter();
    const startX = center.x - totalWidth / 2;
    const startY = center.y - totalHeight / 2;

    // Arrêter la physique temporairement
    fourreaux.forEach(f => {
      f.frozen = true;
      f.dragging = false;
      f.vx = 0;
      f.vy = 0;
    });

    // Étape 7 : Positionner les fourreaux selon la grille adaptative
    let currentY = startY;
    for (let row = 0; row < grid.length; row++) {
      let currentX = startX;
      const rowHeight = rowHeights[row];
      
      for (let col = 0; col < grid[row].length; col++) {
        const fourreau = grid[row][col];
        const colWidth = colWidths[col];
        
        if (fourreau) {
          // Centrer le fourreau dans sa cellule
          const cellCenterX = currentX + colWidth / 2;
          const cellCenterY = currentY + rowHeight / 2;
          
          // Vérifier si la position est dans les limites pour les boîtes circulaires
          if (shape === 'circ') {
            const centerX = center.x;
            const centerY = center.y;
            const distanceFromCenter = Math.sqrt((cellCenterX - centerX) ** 2 + (cellCenterY - centerY) ** 2);
            const maxRadius = (boxDiameter * MM_TO_PX) / 2 - GRID_MARGIN - (fourreau.od * MM_TO_PX) / 2;
            
            if (distanceFromCenter > maxRadius) {
              currentX += colWidth;
              continue;
            }
          }

          fourreau.x = cellCenterX;
          fourreau.y = cellCenterY;
          fourreau._px = cellCenterX;
          fourreau._py = cellCenterY;
        }
        
        currentX += colWidth;
      }
      currentY += rowHeight;
    }

    // Réactiver la possibilité de suppression
    arrangeInProgress = false;

    redraw();
    showToast(`${fourreaux.length} fourreaux disposés en grille adaptative ${approxCols}×${approxRows} avec espacement 3cm`);
    
  }

  // Fonction pour calculer les dimensions minimales nécessaires
  function calculateMinimumDimensions() {
    if (fourreaux.length === 0) return null;

    const EXTERNAL_GAP = 30; // 3 cm = 30 mm
    
    // Vérifier les verrous
    const lockWidth = document.getElementById('lockWidth')?.checked;
    const lockHeight = document.getElementById('lockHeight')?.checked;
    const currentWidth = SHAPE === 'rect' ? WORLD_W_MM : WORLD_D_MM;
    const currentHeight = SHAPE === 'rect' ? WORLD_H_MM : WORLD_D_MM;
    
    // Trier les fourreaux par taille (gros d'abord)
    const sortedFourreaux = [...fourreaux].sort((a, b) => b.od - a.od);
    
    // Calculer la grille optimale en tenant compte des contraintes
    let optimalCols, optimalRows;
    
    if (lockWidth && lockHeight) {
      // Les deux dimensions verrouillées = pas de redimensionnement possible
      return null;
    } else if (lockHeight) {
      // Hauteur verrouillée : calculer combien de lignes on peut avoir
      const avgDiameter = fourreaux.reduce((sum, f) => sum + f.od, 0) / fourreaux.length;
      const maxRows = Math.floor((currentHeight - 2 * GRID_MARGIN) / (avgDiameter + EXTERNAL_GAP));
      optimalRows = Math.min(maxRows, fourreaux.length);
      optimalCols = Math.ceil(fourreaux.length / optimalRows);
    } else if (lockWidth) {
      // Largeur verrouillée : calculer combien de colonnes on peut avoir
      const avgDiameter = fourreaux.reduce((sum, f) => sum + f.od, 0) / fourreaux.length;
      const maxCols = Math.floor((currentWidth - 2 * GRID_MARGIN) / (avgDiameter + EXTERNAL_GAP));
      optimalCols = Math.min(maxCols, fourreaux.length);
      optimalRows = Math.ceil(fourreaux.length / optimalCols);
    } else {
      // Aucune contrainte : grille optimale libre
      optimalCols = Math.ceil(Math.sqrt(fourreaux.length * 1.5));
      optimalRows = Math.ceil(fourreaux.length / optimalCols);
      
      while (optimalCols * optimalRows < fourreaux.length) {
        if (optimalCols <= optimalRows) {
          optimalCols++;
        } else {
          optimalRows++;
        }
      }
    }
    
    // Créer grille temporaire
    const tempGrid = [];
    for (let row = 0; row < optimalRows; row++) {
      tempGrid[row] = [];
    }
    
    // Placer les fourreaux
    let index = 0;
    for (let row = optimalRows - 1; row >= 0 && index < sortedFourreaux.length; row--) {
      for (let col = 0; col < optimalCols && index < sortedFourreaux.length; col++) {
        tempGrid[row][col] = sortedFourreaux[index];
        index++;
      }
    }
    
    // Calculer les dimensions de colonnes et lignes
    const colWidths = [];
    for (let col = 0; col < optimalCols; col++) {
      let maxDiameter = 0;
      for (let row = 0; row < tempGrid.length; row++) {
        if (tempGrid[row] && tempGrid[row][col]) {
          maxDiameter = Math.max(maxDiameter, tempGrid[row][col].od);
        }
      }
      colWidths[col] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) : 0;
    }
    
    const rowHeights = [];
    for (let row = 0; row < tempGrid.length; row++) {
      let maxDiameter = 0;
      for (let col = 0; col < tempGrid[row].length; col++) {
        if (tempGrid[row][col]) {
          maxDiameter = Math.max(maxDiameter, tempGrid[row][col].od);
        }
      }
      rowHeights[row] = maxDiameter > 0 ? (maxDiameter + EXTERNAL_GAP) : 0;
    }
    
    // Calculer dimensions totales en mm et arrondir à la dizaine supérieure
    const totalWidthMM = colWidths.reduce((sum, w) => sum + w, 0) + (2 * GRID_MARGIN / MM_TO_PX);
    const totalHeightMM = rowHeights.reduce((sum, h) => sum + h, 0) + (2 * GRID_MARGIN / MM_TO_PX);
    
    // Respecter les verrous dans les dimensions finales
    const finalWidth = lockWidth ? currentWidth : Math.ceil(totalWidthMM / 10) * 10;
    const finalHeight = lockHeight ? currentHeight : Math.ceil(totalHeightMM / 10) * 10;
    
    return {
      width: finalWidth,
      height: finalHeight
    };
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
    
    if (SHAPE === 'rect') {
      const lockWidth = document.getElementById('lockWidth')?.checked;
      const lockHeight = document.getElementById('lockHeight')?.checked;
      
      if (!lockWidth) {
        boxWInput.value = width;
        WORLD_W_MM = width;
      }
      if (!lockHeight) {
        boxHInput.value = height;
        WORLD_H_MM = height;
      }
    } else if (SHAPE === 'circ') {
      const diameter = Math.max(width, height);
      boxDInput.value = diameter;
      WORLD_D_MM = diameter;
    }
    
    setCanvasSize();
    updateStats();
    hideReduceButton();
    
    showToast(`Boîte réduite à ${width} × ${height} mm`);
  }

  // Fonctions de copier-coller
  function copySelected() {
    if (!selected && selectedMultiple.length === 0) {
      showToast('Sélectionnez un élément à copier');
      return;
    }

    // Pour l'instant, on copie seulement la sélection simple
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

  function drawFourreau(f) {
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
    
    // Afficher le libellé si présent et si showInfo est activé
    if (showInfo && f.label && f.label.trim()) {
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = getScaledLineWidth(2);
      ctx.font = `bold ${getScaledLineWidth(12)}px Arial`;
      ctx.textAlign = "center";
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
    
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
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
    ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
    ctx.fillRect(WORLD_W / 2 - bgWidthW/2, y_dim + 20 - bgHeightW/2, bgWidthW, bgHeightW);
    
    // Texte blanc
    ctx.fillStyle = "#ffffff";
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
    ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
    ctx.fillRect(-bgWidthH/2, -bgHeightH/2, bgWidthH, bgHeightH);
    
    // Texte blanc
    ctx.fillStyle = "#ffffff";
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
    for (const f of fourreaux) drawFourreau(f);
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

  function generateDXF() {
    let dxf = '';
    
    // En-tête DXF avec section HEADER pour les unités
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$INSUNITS\n70\n6\n'; // 6 = meters
    dxf += '0\nENDSEC\n';
    
    // Section TABLES pour définir les calques
    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n50\n'; // Max 50 calques
    
    // Calque pour la boîte avec épaisseur 3mm
    dxf += '0\nLAYER\n2\n_CEAI_BOITE\n70\n0\n62\n1\n6\nCONTINUOUS\n370\n300\n';
    
    // Créer des calques pour fourreaux avec gestion des couleurs personnalisées
    const fourreauTypes = [...new Set(fourreaux.map(f => `${f.type}_${f.code}`))];
    const fourreauColorMap = new Map();
    
    fourreauTypes.forEach((type, index) => {
      // Chercher si des fourreaux de ce type ont une couleur personnalisée
      const fourreauxOfType = fourreaux.filter(f => `${f.type}_${f.code}` === type);
      const customFourreau = fourreauxOfType.find(f => f.customColor);
      
      let dxfColor;
      if (customFourreau && customFourreau.customColor) {
        dxfColor = convertHexToDXFColor(customFourreau.customColor);
      } else {
        dxfColor = (index % 7) + 2; // Couleurs par défaut 2-8
      }
      
      fourreauColorMap.set(type, dxfColor);
      dxf += `0\nLAYER\n2\n_CEAI_FOURREAU_${type}\n70\n0\n62\n${dxfColor}\n6\nCONTINUOUS\n370\n-3\n`;
    });
    
    // Créer des calques par type de câble et phase
    const cableLayerTypes = new Set();
    const layerColorMap = new Map();
    
    cables.forEach((c, index) => {
      const layerName = generateCableLayerName(c);
      cableLayerTypes.add(layerName);
      
      // Définir la couleur du calque selon la phase
      if (!layerColorMap.has(layerName)) {
        let dxfColor = (index % 6) + 10; // Couleur par défaut
        
        if (c.customColor) {
          dxfColor = convertHexToDXFColor(c.customColor);
        } else {
          // Utiliser les couleurs standardisées du système centralisé
          const phase = layerName.split('_').pop();
          const phaseColor = COLOR_SYSTEM.getByPhase(phase);
          if (phaseColor) {
            dxfColor = phaseColor.dxf;
          }
        }
        
        layerColorMap.set(layerName, dxfColor);
      }
    });
    
    // Créer les calques uniques
    Array.from(cableLayerTypes).forEach(layerName => {
      const dxfColor = layerColorMap.get(layerName);
      dxf += `0\nLAYER\n2\n${layerName}\n70\n0\n62\n${dxfColor}\n6\nCONTINUOUS\n370\n-3\n`;
    });
    
    // Calque pour l'inventaire
    dxf += '0\nLAYER\n2\n_CEAI_INVENTAIRE\n70\n0\n62\n7\n6\nCONTINUOUS\n370\n-3\n';
    
    dxf += '0\nENDTAB\n0\nENDSEC\n';
    
    // Section BLOCKS pour fourreaux et câbles
    dxf += '0\nSECTION\n2\nBLOCKS\n';
    
    // Créer des blocs uniquement pour les fourreaux utilisés
    fourreauTypes.forEach(type => {
      const fourreau = fourreaux.find(f => `${f.type}_${f.code}` === type);
      const outerRadius = (fourreau.od * MM_TO_PX / 2 / MM_TO_PX / 1000).toFixed(6);
      const innerRadius = (fourreau.idm * MM_TO_PX / 2 / MM_TO_PX / 1000).toFixed(6);
      const blockName = `_CEAI_FOURREAU_${type}`;
      
      dxf += '0\nBLOCK\n8\n0\n';
      dxf += `2\n${blockName}\n70\n0\n`;
      dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
      dxf += `3\n${blockName}\n`;
      let dxfColor;
      if (fourreau && fourreau.customColor) {
        dxfColor = convertHexToDXFColor(fourreau.customColor);
      } else {
        dxfColor = fourreauColorMap.get(type);
      }
      
      // Cercle extérieur avec couleur
      dxf += `0\nCIRCLE\n8\n_CEAI_FOURREAU_${type}\n`;
      dxf += `62\n${dxfColor}\n`; // Couleur au niveau de l'élément
      dxf += `10\n0.0\n20\n0.0\n40\n${outerRadius}\n`;
      
      // Cercle intérieur avec couleur
      dxf += `0\nCIRCLE\n8\n_CEAI_FOURREAU_${type}\n`;
      dxf += `62\n${dxfColor}\n`; // Couleur au niveau de l'élément
      dxf += `10\n0.0\n20\n0.0\n40\n${innerRadius}\n`;
      
      // Ajouter le label du fourreau si disponible
      if (fourreau && (fourreau.label || fourreau.code)) {
        const labelText = fourreau.label || `${fourreau.type} ${fourreau.code}`;
        dxf += `0\nTEXT\n8\n_CEAI_FOURREAU_${type}\n`;
        dxf += `62\n${dxfColor}\n`; // Couleur du texte
        dxf += '7\nArial\n'; // Police Arial
        dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
        dxf += '40\n0.003\n'; // Hauteur du texte (3mm)
        dxf += `1\n${labelText}\n`;
        dxf += '50\n0.0\n'; // Angle de rotation
        dxf += '72\n1\n'; // Justification horizontale centrée
        dxf += '73\n2\n'; // Justification verticale centrée
      }
      
      dxf += '0\nENDBLK\n8\n0\n';
    });
    
    // Créer des blocs individuels pour chaque câble
    cables.forEach(cable => {
      const radius = (cable.od * MM_TO_PX / 2 / MM_TO_PX / 1000).toFixed(6);
      const blockName = `_CEAI_CABLE_${cable.id}`;
      const layerName = generateCableLayerName(cable);
      
      dxf += '0\nBLOCK\n8\n0\n';
      dxf += `2\n${blockName}\n70\n0\n`;
      dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
      dxf += `3\n${blockName}\n`;
      
      // Déterminer la couleur du câble
      let cableDxfColor;
      if (cable.customColor) {
        cableDxfColor = convertHexToDXFColor(cable.customColor);
      } else {
        cableDxfColor = layerColorMap.get(layerName);
      }
      
      // Cercle simple pour le câble avec couleur
      dxf += `0\nCIRCLE\n8\n${layerName}\n`;
      dxf += `62\n${cableDxfColor}\n`; // Couleur au niveau de l'élément
      dxf += `10\n0.0\n20\n0.0\n40\n${radius}\n`;
      
      // Ajouter le texte au centre (phase ou label)
      let textToShow = '';
      if (cable.label) {
        textToShow = cable.label;
      } else if (cable.customColor) {
        textToShow = getPhaseFromColor(cable.customColor) || `${cable.fam} ${cable.code}`;
      } else {
        textToShow = `${cable.fam} ${cable.code}`;
      }
      
      if (textToShow) {
        dxf += `0\nTEXT\n8\n${layerName}\n`;
        dxf += `62\n${cableDxfColor}\n`; // Couleur du texte
        dxf += '7\nArial\n'; // Police Arial
        dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
        dxf += '40\n0.004\n'; // Hauteur du texte augmentée (4mm au lieu de 2mm)
        dxf += `1\n${textToShow}\n`;
        dxf += '50\n0.0\n'; // Angle de rotation
        dxf += '72\n1\n'; // Justification horizontale centrée
        dxf += '73\n2\n'; // Justification verticale centrée
      }
      
      dxf += '0\nENDBLK\n8\n0\n';
    });
    
    dxf += '0\nENDSEC\n';
    
    // Section ENTITIES
    dxf += '0\nSECTION\n2\nENTITIES\n';
    
    // Dessiner le contour de la boîte - Version fiable avec lignes
    if (SHAPE === "rect" || SHAPE === "chemin_de_cable") {
      // Rectangle avec 4 lignes épaisses (plus fiable)
      const w = (WORLD_W_MM / 1000).toFixed(3);
      const h = (WORLD_H_MM / 1000).toFixed(3);
      
      // Ligne du bas
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n0.0\n20\n0.0\n11\n${w}\n21\n0.0\n`;
      
      // Ligne de droite
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n${w}\n20\n0.0\n11\n${w}\n21\n${h}\n`;
      
      // Ligne de gauche
      dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
      dxf += `10\n0.0\n20\n${h}\n11\n0.0\n21\n0.0\n`;
      
      // Ligne du haut (seulement pour rect, pas pour chemin_de_cable)
      if (SHAPE === "rect") {
        dxf += '0\nLINE\n8\n_CEAI_BOITE\n';
        dxf += `10\n${w}\n20\n${h}\n11\n0.0\n21\n${h}\n`;
      }
    } else {
      // Cercle simple
      const centerX = (WORLD_D_MM / 1000 / 2).toFixed(3);
      const centerY = (WORLD_D_MM / 1000 / 2).toFixed(3);
      const radius = (WORLD_D_MM / 1000 / 2).toFixed(3);
      dxf += '0\nCIRCLE\n8\n_CEAI_BOITE\n';
      dxf += `10\n${centerX}\n20\n${centerY}\n40\n${radius}\n`;
    }
    
    // Ajouter les cotations
    if (SHAPE === "rect" || SHAPE === "chemin_de_cable") {
      const w = (WORLD_W_MM / 1000).toFixed(3);
      const h = (WORLD_H_MM / 1000).toFixed(3);
      
      // Cotation horizontale (largeur) en bas
      dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
      dxf += '2\n*D\n'; // Nom du bloc dimension
      dxf += `10\n0.0\n20\n-0.1\n30\n0.0\n`; // Point de texte
      dxf += '70\n0\n'; // Type dimension (alignée)
      dxf += '140\n0.006\n'; // Hauteur de texte (6mm au lieu de 12mm par défaut)
      dxf += `13\n0.0\n23\n0.0\n33\n0.0\n`; // Point de définition 1
      dxf += `14\n${w}\n24\n0.0\n34\n0.0\n`; // Point de définition 2
      dxf += `15\n0.0\n25\n-0.1\n35\n0.0\n`; // Point sur ligne de dimension
      dxf += `16\n0.0\n26\n-0.1\n36\n0.0\n`; // Point sur ligne de dimension 2
      dxf += `1\n${(WORLD_W_MM).toFixed(0)} mm\n`; // Texte de cotation
      
      // Cotation verticale (hauteur) à droite
      dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
      dxf += '2\n*D\n'; // Nom du bloc dimension
      dxf += `10\n${(parseFloat(w) + 0.1).toFixed(3)}\n20\n0.0\n30\n0.0\n`; // Point de texte
      dxf += '70\n1\n'; // Type dimension (verticale)
      dxf += '140\n0.006\n'; // Hauteur de texte (6mm au lieu de 12mm par défaut)
      dxf += `13\n${w}\n23\n0.0\n33\n0.0\n`; // Point de définition 1
      dxf += `14\n${w}\n24\n${h}\n34\n0.0\n`; // Point de définition 2
      dxf += `15\n${(parseFloat(w) + 0.1).toFixed(3)}\n25\n0.0\n35\n0.0\n`; // Point sur ligne de dimension
      dxf += `16\n${(parseFloat(w) + 0.1).toFixed(3)}\n26\n${h}\n36\n0.0\n`; // Point sur ligne de dimension 2
      dxf += `1\n${(WORLD_H_MM).toFixed(0)} mm\n`; // Texte de cotation
    } else {
      // Cotation diamètre pour cercle
      const d = (WORLD_D_MM / 1000).toFixed(3);
      const centerX = (WORLD_D_MM / 1000 / 2).toFixed(3);
      const centerY = (WORLD_D_MM / 1000 / 2).toFixed(3);
      
      dxf += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
      dxf += '2\n*D\n'; // Nom du bloc dimension
      dxf += `10\n${centerX}\n20\n${centerY}\n30\n0.0\n`; // Point de texte
      dxf += '70\n3\n'; // Type dimension (diamètre)
      dxf += '140\n0.006\n'; // Hauteur de texte (6mm au lieu de 12mm par défaut)
      dxf += `15\n0.0\n25\n${centerY}\n35\n0.0\n`; // Point sur le cercle
      dxf += `16\n${d}\n26\n${centerY}\n36\n0.0\n`; // Point opposé sur le cercle
      dxf += `1\nØ${(WORLD_D_MM).toFixed(0)} mm\n`; // Texte de cotation
    }
    
    // Insérer les blocs de fourreaux
    fourreaux.forEach(f => {
      const x = (f.x / MM_TO_PX / 1000).toFixed(6);
      const y = ((SHAPE === "rect" || SHAPE === "chemin_de_cable" ? WORLD_H - f.y : f.y) / MM_TO_PX / 1000).toFixed(6);
      const blockName = `_CEAI_FOURREAU_${f.type}_${f.code}`;
      const layerName = `_CEAI_FOURREAU_${f.type}_${f.code}`;
      
      // Insertion du bloc avec hachures
      dxf += `0\nINSERT\n8\n${layerName}\n`;
      dxf += `2\n${blockName}\n`;
      dxf += `10\n${x}\n20\n${y}\n30\n0.0\n`;
      dxf += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';
    });
    
    // Insérer les blocs de câbles
    cables.forEach(c => {
      const x = (c.x / MM_TO_PX / 1000).toFixed(6);
      const y = ((SHAPE === "rect" || SHAPE === "chemin_de_cable" ? WORLD_H - c.y : c.y) / MM_TO_PX / 1000).toFixed(6);
      const blockName = `_CEAI_CABLE_${c.id}`;
      const layerName = generateCableLayerName(c);
      
      // Insertion du bloc avec hachures solides
      dxf += `0\nINSERT\n8\n${layerName}\n`;
      dxf += `2\n${blockName}\n`;
      dxf += `10\n${x}\n20\n${y}\n30\n0.0\n`;
      dxf += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';
    });
    
    // Générer le tableau d'inventaire - décalé à 100cm à gauche
    const inventaire = countGroups();
    const tableauX = -1.0; // -100cm à gauche de l'origine
    let yPos = (WORLD_H_MM / 1000) + 0.1; // Position 10cm sous la boîte
    
    // Titre du tableau avec police Arial
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.02\n1\nINVENTAIRE TONTONKAD\n`;
    dxf += '7\nARIAL\n'; // Style de texte Arial
    yPos -= 0.03;
    
    // Taux d'occupation global simple
    const occupation = calculateBoxOccupancy();
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nTAUX OCCUPATION: ${occupation.toFixed(1)}%\n`;
    dxf += '7\nARIAL\n';
    yPos -= 0.04;
    
    // En-têtes du tableau avec Arial
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nTYPE\n7\nARIAL\n`;
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nCODE\n7\nARIAL\n`;
    dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.015\n1\nQTE\n7\nARIAL\n`;
    yPos -= 0.025;
    
    // Ligne de séparation
    dxf += '0\nLINE\n8\n_CEAI_INVENTAIRE\n';
    dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n11\n${(tableauX + 0.25).toFixed(3)}\n21\n${yPos.toFixed(3)}\n`;
    yPos -= 0.02;
    
    // Fourreaux avec Arial
    for (const [key, count] of Object.entries(inventaire.fc)) {
      const [type, code] = key.split('|');
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${type}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${code}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${count}\n7\nARIAL\n`;
      yPos -= 0.02;
    }
    
    // Câbles avec Arial
    for (const [key, count] of Object.entries(inventaire.cc)) {
      const [fam, code] = key.split('|');
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${tableauX.toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${fam}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.1).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${code}\n7\nARIAL\n`;
      dxf += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
      dxf += `10\n${(tableauX + 0.2).toFixed(3)}\n20\n${yPos.toFixed(3)}\n40\n0.012\n1\n${count}\n7\nARIAL\n`;
      yPos -= 0.02;
    }
    
    // Fin du fichier DXF
    dxf += '0\nENDSEC\n0\nEOF\n';
    
    return dxf;
  }
  
  function exportDXF() {
    const dxfContent = generateDXF();
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const wM = (WORLD_W_MM / 1000).toFixed(1);
    const hM = (WORLD_H_MM / 1000).toFixed(1);
    a.download = `tontonkad_${wM}x${hM}m_${new Date().toISOString().slice(0,10)}.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Export DXF terminé !');
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
      const arr = cables.filter(c => c.fam === fam && c.code === code);
      if (!arr.length) return;
      let idx = arr.length - 1;
      if (cycle) {
        const prev = cycleIndex.get(key) || -1;
        idx = (prev + 1) % arr.length;
        cycleIndex.set(key, idx);
      }
      selected = { type: 'cable', id: arr[idx].id }; // CÂBLE
    } else if (kind === 'f') {
      const [type, code] = key.split('|');
      const arr = fourreaux.filter(f => f.type === type && f.code === code);
      if (!arr.length) return;
      let idx = arr.length - 1;
      if (cycle) {
        const prev = cycleIndex.get(key) || -1;
        idx = (prev + 1) % arr.length;
        cycleIndex.set(key, idx);
      }
      selected = { type: 'fourreau', id: arr[idx].id };
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
        freezeBtn.disabled = true; //
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
      freezeBtn.disabled = false; //
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
  function updateStats() {
    statFourreau.textContent = fourreaux.length;
    statCable.textContent = cables.length;
    statOccupation.textContent = `${calculateBoxOccupancy().toFixed(1)} %`;
    
    // Déclencher checkForPossibleReduction avec un léger délai pour éviter trop d'appels
    clearTimeout(checkReductionTimeout);
    checkReductionTimeout = setTimeout(checkForPossibleReduction, 100);
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

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  }

  // Variables globales pour la popup de redimensionnement
  let pendingResizeData = null;

  function showResizePopup(shape, numFourreaux, suggestedWidth, suggestedHeight, optimalCols, optimalRows) {
    const popup = document.getElementById('resizePopup');
    const message = document.getElementById('resizeMessage');
    
    if (shape === 'rect') {
      const currentWidth = Math.round(parseFloat(boxWInput.value));
      const currentHeight = Math.round(parseFloat(boxHInput.value));
      message.innerHTML = `
        <strong>❌ ${numFourreaux} fourreaux ne rentrent pas dans la boîte actuelle (${currentWidth}×${currentHeight}mm).</strong><br><br>
        💡 <strong>Proposition optimale :</strong><br>
        • Largeur : <strong>${suggestedWidth}mm</strong> (au lieu de ${currentWidth}mm)<br>
        • Hauteur : <strong>${suggestedHeight}mm</strong> (au lieu de ${currentHeight}mm)<br>
        • Grille : <strong>${optimalCols}×${optimalRows}</strong> (privilégiant la largeur)<br><br>
        Voulez-vous appliquer ces dimensions ?
      `;
      
      pendingResizeData = {
        shape: 'rect',
        width: suggestedWidth,
        height: suggestedHeight,
        cols: optimalCols,
        rows: optimalRows
      };
    } else {
      const currentDiam = Math.round(parseFloat(boxDInput.value));
      const suggestedDiam = Math.max(suggestedWidth, suggestedHeight);
      message.innerHTML = `
        <strong>❌ ${numFourreaux} fourreaux ne rentrent pas dans le conduit actuel (Ø${currentDiam}mm).</strong><br><br>
        💡 <strong>Proposition optimale :</strong><br>
        • Diamètre : <strong>Ø${suggestedDiam}mm</strong> (au lieu de Ø${currentDiam}mm)<br>
        • Grille : <strong>${optimalCols}×${optimalRows}</strong><br><br>
        Voulez-vous appliquer cette dimension ?
      `;
      
      pendingResizeData = {
        shape: 'circ',
        diameter: suggestedDiam,
        cols: optimalCols,
        rows: optimalRows
      };
    }
    
    popup.style.display = 'flex';
  }

  function applyResize() {
    if (!pendingResizeData) return;
    
    const data = pendingResizeData;
    
    if (data.shape === 'rect') {
      boxWInput.value = data.width;
      boxHInput.value = data.height;
    } else {
      boxDInput.value = data.diameter;
    }
    
    // Appliquer les dimensions comme le fait le bouton normal
    applyDimensions();
    
    // Fermer la popup
    document.getElementById('resizePopup').style.display = 'none';
    pendingResizeData = null;
    
    // Relancer la grille automatiquement
    setTimeout(() => {
      arrangeConduitGrid();
    }, 100);
  }

  function cancelResize() {
    document.getElementById('resizePopup').style.display = 'none';
    pendingResizeData = null;
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

  function applyDimensions() {
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
    pruneOutside();
    setCanvasSize();
    updateStats();
    updateInventory();
    updateSelectedInfo();
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
    const panel = document.querySelector('.panel');
    
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

  /* ====== Initialisation & Écouteurs d'événements ====== */
  async function init() {
    // 1. Charger les données en premier
    try {
      await loadData();
    } catch (error) {
      // Afficher un message d'erreur clair et bloquer l'application
      panel.innerHTML = `<div class="p-4 text-red-500 bg-red-100 border border-red-400 rounded"><b>Erreur critique :</b><br>Impossible de charger les fichiers de données (<code>../data/fourreaux.csv</code>, <code>../data/cables.csv</code>, ou <code>../data/chemins_de_cable.csv</code>).<br><br>Assurez-vous qu'ils sont présents dans le dossier <code>data/</code> et que leur format est correct.</div>`;
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
    populateSelectors();

    // 3. Attacher les écouteurs d'événements
    addEventListener("resize", fitCanvas);
    targetPxPerMmInput.addEventListener("input", fitCanvas);
    zoomSlider.addEventListener("input", () => { zoomLabel.textContent = zoomSlider.value; fitCanvas(); });
    searchCable.addEventListener('input', updateInventory); //
    searchFourreau.addEventListener('input', updateInventory);
    // Anciens boutons toolPlace et toolSelect supprimés
    toolDelete.addEventListener('click', () => { setMode('delete'); if (selected) deleteSelected(); });
    document.getElementById('toolEdit').addEventListener('click', openEditPopup);
    document.getElementById('toolInfo').addEventListener('click', toggleShowInfo);
    document.getElementById('gridArrange').addEventListener('click', arrangeConduitGrid);
    if (freezeBtn) freezeBtn.addEventListener('click', toggleFreezeSelected);
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); });
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
          // Clic sur le vide = désélectionner tout
          selected = null;
          selectedMultiple = [];
        }
        updateSelectedInfo();
        redraw();
        return;
      }
      if (e.button === 2) { // Clic droit : placement
        if (activeTab === 'FOURREAU') {
          const v = fourreauSelect.value;
          if (!v) { showToast('Choisis un fourreau.'); return; }
          const [type, code] = v.split('|');
          addFourreauAt(p.x, p.y, type, code) || showToast('Emplacement occupé ou hors boîte.');
        } else {
          const v = cableSelect.value;
          if (!v) { showToast('Choisis un CÂBLE.'); return; }
          const [fam, code] = v.split('|');
          const f = findFourreauUnder(p.x, p.y, null);
          addCableAt(p.x, p.y, fam, code, f) || showToast('Impossible de poser le CÂBLE ici.');
        }
        return;
      }
    });
    tabFOURREAU.addEventListener('click', () => setTab('FOURREAU'));
    tabCABLE.addEventListener('click', () => setTab('CÂBLE'));
    shapeSel.addEventListener('change', toggleInputGroups);
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

    document.getElementById('exportDXF').addEventListener('click', exportDXF);
    document.getElementById('clear').addEventListener('click', () => {
      fourreaux.length = 0;
      cables.length = 0;
      selected = null;
      updateStats();
      updateInventory();
      updateSelectedInfo();
      hideReduceButton(); // Cacher le bouton de réduction
      redraw();
    });

    // Event listener pour le bouton de réduction
    document.getElementById('reduceToMinimum').addEventListener('click', reduceToMinimum);
    
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
    function openEditPopup() {
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
      const labelInput = document.getElementById('editLabel');
      const colorInput = document.getElementById('editColor');
      const phaseSection = document.getElementById('cablePhaseSection');
      
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
      }
      
      popup.style.display = 'block';
      setTimeout(() => labelInput.focus(), 100);
    }
    
    function closeEditPopup() {
      // Fermer le dropdown des couleurs s'il est ouvert
      closeColorDropdown();
      document.getElementById('editPopup').style.display = 'none';
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
    document.getElementById('editPopup').addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-popup-overlay')) {
        closeEditPopup();
      }
    });

    // Événements pour la popup de redimensionnement
    document.getElementById('applyResize').addEventListener('click', applyResize);
    document.getElementById('cancelResize').addEventListener('click', cancelResize);
    document.getElementById('resizePopup').addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-popup-overlay')) {
        cancelResize();
      }
    });
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
      if (k === 'v' && e.ctrlKey) { e.preventDefault(); activatePasteMode(); return; }
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

          // Restaurer le conteneur
          SHAPE = projectData.container.shape || 'rect';
          WORLD_W_MM = projectData.container.width || 1000;
          WORLD_H_MM = projectData.container.height || 1000;
          WORLD_D_MM = projectData.container.diameter || 1000;

          // Mettre à jour l'interface
          shapeSel.value = SHAPE;
          boxWInput.value = WORLD_W_MM;
          boxHInput.value = WORLD_H_MM;
          boxDInput.value = WORLD_D_MM;

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
          render();

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
          console.log('🔄 Auto-sauvegarde effectuée');
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
      saveProject(projectName) {
        if (!projectName || projectName.trim() === '') {
          throw new Error('Nom de projet requis');
        }

        try {
          const projects = this.getAllProjects();
          const projectData = this.captureCurrentState();

          projects[projectName.trim()] = {
            ...projectData,
            name: projectName.trim(),
            created: projects[projectName.trim()]?.created || new Date().toISOString(),
            lastModified: new Date().toISOString()
          };

          localStorage.setItem(this.storageKey, JSON.stringify(projects));
          showToast(`💾 Projet "${projectName}" sauvegardé`);
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

      // Obtenir tous les projets
      getAllProjects() {
        try {
          const saved = localStorage.getItem(this.storageKey);
          return saved ? JSON.parse(saved) : {};
        } catch (error) {
          console.warn('Erreur lecture projets:', error);
          return {};
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
        }
        // Recalculer les possibilités de redimensionnement
        checkForPossibleReduction();
      });
    }
  }

  /* ====== Interface de Gestion des Projets ====== */
  class ProjectUI {
    constructor() {
      this.modal = document.getElementById('projectModal');
      this.projectsList = document.getElementById('projectsList');
      this.newProjectName = document.getElementById('newProjectName');
      this.autoSaveInfo = document.getElementById('autoSaveInfo');
      this.setupEventListeners();
      this.refreshUI();
    }

    setupEventListeners() {
      // Bouton d'ouverture de la modal
      document.getElementById('projectSave').addEventListener('click', () => {
        this.openModal();
      });

      // Fermeture de la modal
      document.getElementById('closeProjectModal').addEventListener('click', () => {
        this.closeModal();
      });

      // Fermeture par clic sur l'overlay
      this.modal.querySelector('.edit-popup-overlay').addEventListener('click', () => {
        this.closeModal();
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
    }

    openModal() {
      this.modal.style.display = 'block';
      this.refreshUI();
      // Focus sur le champ de nom
      setTimeout(() => {
        this.newProjectName.focus();
      }, 100);
    }

    closeModal() {
      this.modal.style.display = 'none';
      this.newProjectName.value = '';
    }

    saveNewProject() {
      const name = this.newProjectName.value.trim();
      if (!name) {
        showToast('⚠️ Veuillez entrer un nom de projet');
        this.newProjectName.focus();
        return;
      }

      if (window.projectManager.saveProject(name)) {
        this.newProjectName.value = '';
        this.refreshUI();
      }
    }

    refreshUI() {
      this.renderProjectsList();
      this.renderAutoSaveInfo();
    }

    renderProjectsList() {
      const projects = window.projectManager.getAllProjects();
      const projectNames = Object.keys(projects);

      if (projectNames.length === 0) {
        this.projectsList.innerHTML = `
          <div class="projects-empty">
            🗂️ Aucun projet sauvegardé<br>
            <small>Créez votre premier projet en entrant un nom ci-dessus</small>
          </div>
        `;
        return;
      }

      // Trier par date de modification
      projectNames.sort((a, b) => {
        const dateA = new Date(projects[a].lastModified || projects[a].created);
        const dateB = new Date(projects[b].lastModified || projects[b].created);
        return dateB - dateA;
      });

      this.projectsList.innerHTML = projectNames.map(name => {
        const project = projects[name];
        const lastModified = new Date(project.lastModified || project.created);
        const totalObjects = (project.fourreaux?.length || 0) + (project.cables?.length || 0);

        return `
          <div class="project-item">
            <div class="project-info">
              <div class="project-name" title="${name}">${name}</div>
              <div class="project-meta">
                <span>📅 ${this.formatDate(lastModified)}</span>
                <span>📦 ${totalObjects} objets</span>
                <span>📏 ${project.container?.shape === 'rect' ?
                  `${project.container.width}×${project.container.height}mm` :
                  `⌀${project.container?.diameter || '?'}mm`}</span>
              </div>
            </div>
            <div class="project-actions">
              <button class="btn-load" onclick="projectUI.loadProject('${name.replace(/'/g, "\\'")}')">
                📂 Charger
              </button>
              <button class="btn-export" onclick="projectUI.exportProject('${name.replace(/'/g, "\\'")}')">
                📤 Export
              </button>
              <button class="btn-delete" onclick="projectUI.deleteProject('${name.replace(/'/g, "\\'")}')">
                🗑️ Suppr
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    renderAutoSaveInfo() {
      const autoSave = window.projectManager.loadAutoSave();
      const stats = window.projectManager.getStorageStats();

      let autoSaveContent = '';
      if (autoSave) {
        const lastSave = new Date(autoSave.timestamp);
        const totalObjects = (autoSave.fourreaux?.length || 0) + (autoSave.cables?.length || 0);

        autoSaveContent = `
          <div class="auto-save-status">
            <div class="auto-save-indicator"></div>
            <span>Auto-sauvegarde active</span>
          </div>
          <div>Dernière sauvegarde: ${this.formatDate(lastSave)}</div>
          <div>Objets: ${totalObjects} • Taille: ${this.formatBytes(JSON.stringify(autoSave).length)}</div>
          <div style="margin-top: 8px;">
            <button class="btn-secondary" onclick="projectUI.loadAutoSave()" style="font-size: 12px; padding: 4px 8px;">
              🔄 Restaurer auto-save
            </button>
          </div>
        `;
      } else {
        autoSaveContent = `
          <div class="auto-save-status">
            <div class="auto-save-indicator inactive"></div>
            <span>Aucune auto-sauvegarde</span>
          </div>
          <div>L'auto-sauvegarde se déclenche après 30 secondes d'activité</div>
        `;
      }

      // Ajouter les stats globales
      autoSaveContent += `
        <div class="project-stats">
          <span>📊 ${stats.projectCount} projets</span>
          <span>💾 ${this.formatBytes(stats.totalSize)} utilisés</span>
        </div>
      `;

      this.autoSaveInfo.innerHTML = autoSaveContent;
    }

    loadProject(projectName) {
      if (confirm(`Charger le projet "${projectName}" ?\n\nLe projet actuel sera remplacé.`)) {
        if (window.projectManager.loadProject(projectName)) {
          this.closeModal();
        }
      }
    }

    exportProject(projectName) {
      window.projectManager.exportProject(projectName);
    }

    deleteProject(projectName) {
      if (confirm(`Supprimer définitivement le projet "${projectName}" ?\n\nCette action est irréversible.`)) {
        if (window.projectManager.deleteProject(projectName)) {
          this.refreshUI();
        }
      }
    }

    loadAutoSave() {
      const autoSave = window.projectManager.loadAutoSave();
      if (autoSave) {
        if (confirm('Restaurer la dernière auto-sauvegarde ?\n\nLe projet actuel sera remplacé.')) {
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

    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  }

  init();

})();

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
  const HIGH_DPI_MULTIPLIER = 4; // Force haute résolution pour rendu ultra-net

  // Éléments du DOM
  const canvas = document.getElementById("world");
  const ctx = canvas.getContext("2d");
  
  // Variables pour la haute résolution - Optimisation adaptative
  let pixelRatio = Math.max(window.devicePixelRatio || 1, HIGH_DPI_MULTIPLIER);
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
  let mode = "place";
  let activeTab = "FOURREAU";
  let showInfo = true;

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

    fourreauSelect.innerHTML = fourreauTypes.map(type => {
      const options = FOURREAUX.filter(f => f.type === type)
        .map(f => `<option value="${f.type}|${f.code}">${f.type} ${f.code} — Øint ≥ ${f.id} mm</option>`).join("");
      return `<optgroup label="${type}">${options}</optgroup>`;
    }).join("");

    cableSelect.innerHTML = cableFams.map(fam => {
      const options = CABLES.filter(c => c.fam === fam)
        .map(c => `<option value="${c.fam}|${c.code}">${fam} – ${c.code} (Ø ${c.od} mm)</option>`).join("");
      return `<optgroup label="${fam}">${options}</optgroup>`;
    }).join("");

    if (CHEMINS_CABLE && CHEMINS_CABLE.length > 0 && cheminCableSelect) {
      cheminCableSelect.innerHTML = CHEMINS_CABLE.map(cdc =>
        `<option value="${cdc.largeur}|${cdc.hauteur}">${cdc.nom} (${cdc.largeur}x${cdc.hauteur} mm)</option>`
      ).join("");
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
  
  // Couleurs des conducteurs unifilaires
  const PHASE_COLORS = {
    ph1: '#8B4513', // Marron
    ph2: '#808080', // Gris
    ph3: '#000000', // Noir
    n: '#0000FF',   // Bleu
    pe: '#00FF00'   // Vert fluo
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

  function arrangeConduitGrid() {
    console.log('arrangeConduitGrid appelée, fourreaux.length:', fourreaux.length);
    if (fourreaux.length === 0) {
      showToast('Aucun fourreau à disposer en grille');
      return;
    }

    const EXTERNAL_GAP = 35; // 3.5 cm = 35 mm d'écart extérieur souhaité
    const MARGIN = 20; // Marge depuis les bords en pixels

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
      return;
    }

    // Étape 1 : Créer une disposition optimale en rangeant par taille
    const sortedFourreaux = [...fourreaux].sort((a, b) => b.od - a.od); // Plus gros d'abord
    
    // Étape 2 : Calculer une grille initiale approximative (privilégier la largeur)
    const avgDiameter = fourreaux.reduce((sum, f) => sum + f.od, 0) / fourreaux.length;
    const approxSpacing = (avgDiameter + EXTERNAL_GAP) * MM_TO_PX;
    const availableWidth = boxWidth - (2 * MARGIN);
    const availableHeight = boxHeight - (2 * MARGIN);
    
    // Privilégier la largeur : essayer de maximiser le nombre de colonnes
    // Commencer avec plus de colonnes que nécessaire puis ajuster
    let approxCols = Math.min(fourreaux.length, Math.max(1, Math.floor(availableWidth / approxSpacing)));
    let approxRows = Math.ceil(fourreaux.length / approxCols);
    
    // Si trop de lignes, réduire progressivement les colonnes
    while (approxRows * approxSpacing > availableHeight && approxCols > 1) {
      approxCols--;
      approxRows = Math.ceil(fourreaux.length / approxCols);
    }
    
    console.log(`Grille approximative: ${approxCols} cols × ${approxRows} rows`);

    // Étape 3 : Organiser les fourreaux dans la grille
    const grid = [];
    for (let row = 0; row < approxRows; row++) {
      grid[row] = [];
      for (let col = 0; col < approxCols; col++) {
        const index = row * approxCols + col;
        if (index < fourreaux.length) {
          grid[row][col] = fourreaux[index];
        }
      }
    }

    // Étape 4 : Calculer les dimensions adaptatives de chaque ligne et colonne
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

    // Vérifier si la grille rentre dans la boîte
    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);
    
    if (totalWidth > availableWidth || totalHeight > availableHeight) {
      showToast(`Grille trop grande: ${Math.round(totalWidth/MM_TO_PX)}×${Math.round(totalHeight/MM_TO_PX)}mm pour boîte ${Math.round(availableWidth/MM_TO_PX)}×${Math.round(availableHeight/MM_TO_PX)}mm`);
      return;
    }

    // Étape 5 : Calculer les positions de départ (centrage)
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

    // Étape 6 : Positionner les fourreaux selon la grille adaptative
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
            const maxRadius = (boxDiameter * MM_TO_PX) / 2 - MARGIN - (fourreau.od * MM_TO_PX) / 2;
            
            if (distanceFromCenter > maxRadius) {
              console.log(`Fourreau ${fourreau.id} trop éloigné du centre, ignoré`);
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

    redraw();
    showToast(`${fourreaux.length} fourreaux disposés en grille adaptative ${approxCols}×${approxRows} avec espacement 3.5cm`);
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.type === 'fourreau') {
      const i = fourreaux.findIndex(o => o.id === selected.id);
      if (i >= 0) {
        for (const cid of fourreaux[i].children) {
          const j = cables.findIndex(k => k.id === cid);
          if (j >= 0) cables.splice(j, 1);
        }
        fourreaux.splice(i, 1);
      }
    } else {
      const i = cables.findIndex(o => o.id === selected.id);
      if (i >= 0) {
        const p = cables[i].parent;
        if (p) {
          const t = fourreaux.find(o => o.id === p);
          if (t) t.children = t.children.filter(id => id !== cables[i].id);
        }
        cables.splice(i, 1);
      }
    }
    selected = null;
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
    if (!selected) return;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = getScaledLineWidth(2);
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
    ctx.restore();
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
    
    // Créer des calques uniquement pour les types utilisés sur le canvas
    const fourreauTypes = [...new Set(fourreaux.map(f => `${f.type}_${f.code}`))];
    fourreauTypes.forEach((type, index) => {
      const color = (index % 7) + 2; // Couleurs 2-8
      dxf += `0\nLAYER\n2\n_CEAI_FOURREAU_${type}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n370\n-3\n`;
    });
    
    // Créer des calques uniquement pour les types de câbles utilisés sur le canvas
    const cableTypes = [...new Set(cables.map(c => `${c.fam}_${c.code}`.replace(/[\s\/]/g, '_')))];
    cableTypes.forEach((type, index) => {
      const color = (index % 6) + 10; // Couleurs 10-15
      dxf += `0\nLAYER\n2\n_CEAI_CABLE_${type}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n370\n-3\n`;
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
      
      // Cercle extérieur
      dxf += `0\nCIRCLE\n8\n_CEAI_FOURREAU_${type}\n`;
      dxf += `10\n0.0\n20\n0.0\n40\n${outerRadius}\n`;
      
      // Cercle intérieur
      dxf += `0\nCIRCLE\n8\n_CEAI_FOURREAU_${type}\n`;
      dxf += `10\n0.0\n20\n0.0\n40\n${innerRadius}\n`;
      
      dxf += '0\nENDBLK\n8\n0\n';
    });
    
    // Créer des blocs uniquement pour les câbles utilisés
    cableTypes.forEach(type => {
      const cable = cables.find(c => `${c.fam}_${c.code}`.replace(/[\s\/]/g, '_') === type);
      const radius = (cable.od * MM_TO_PX / 2 / MM_TO_PX / 1000).toFixed(6);
      const blockName = `_CEAI_CABLE_${type}`;
      
      dxf += '0\nBLOCK\n8\n0\n';
      dxf += `2\n${blockName}\n70\n0\n`;
      dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
      dxf += `3\n${blockName}\n`;
      
      // Cercle simple pour le câble
      dxf += `0\nCIRCLE\n8\n_CEAI_CABLE_${type}\n`;
      dxf += `10\n0.0\n20\n0.0\n40\n${radius}\n`;
      
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
      const blockName = `_CEAI_CABLE_${c.fam}_${c.code}`.replace(/[\s\/]/g, '_');
      const layerName = `_CEAI_CABLE_${c.fam}_${c.code}`.replace(/[\s\/]/g, '_');
      
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
    if (!selected) {
      selInfo.classList.add('muted');
      selInfo.innerHTML = '<em>Aucun objet sélectionné.</em>';
      if (freezeBtn) {
        freezeBtn.disabled = true; //
        freezeBtn.textContent = 'Figer (G)';
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
      freezeBtn.textContent = frozen ? 'Dégeler (G)' : 'Figer (G)';
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

  function updateStats() {
    statFourreau.textContent = fourreaux.length;
    statCable.textContent = cables.length;
    statOccupation.textContent = `${calculateBoxOccupancy().toFixed(1)} %`;
  }

  /* ====== Interaction Utilisateur ====== */
  function setMode(m) {
    mode = m;
    // toolPlace et toolSelect supprimés - plus de boutons mode
    toolDelete.classList.toggle('btn-active', m === 'delete');
  }

  function toggleFreezeSelected() {
    if (!selected) return;
    let o = null;
    if (selected.type === 'fourreau') o = fourreaux.find(x => x.id === selected.id);
    else o = cables.find(x => x.id === selected.id);
    if (!o) return;
    o.frozen = !o.frozen;
    o.vx = 0;
    o.vy = 0;
    updateSelectedInfo();
    redraw();
    showToast(o.frozen ? 'Objet figé' : 'Objet dégelé');
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
        // Déplacer les enfants avec le TPC
        for (const id of t.children) {
          const child = cables.find(k => k.id === id);
          if (child) {
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
      WORLD_W_MM = parseFloat(boxWInput.value);
      WORLD_H_MM = parseFloat(boxHInput.value);
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
      console.log(`Clic détecté: bouton=${e.button}, mode=${mode}, activeTab=${activeTab}`);
      if (e.button === 0) { // Clic gauche : sélection + glisser-déposer
        const pick = pickAt(p.x, p.y);
        if (pick) {
          selected = pick;
          const obj = pick.type === 'fourreau' ? fourreaux.find(o => o.id === pick.id) : cables.find(o => o.id === pick.id);
          if (obj) {
            obj.dragging = true; obj.vx = 0; obj.vy = 0;
            startDrag(obj, selected);
          }
        } else {
          // Clic sur le vide = désélectionner
          selected = null;
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
      redraw();
    });
    // Fonctions popup d'édition
    function openEditPopup() {
      if (!selected) {
        showToast('Sélectionnez un objet pour l\'éditer (clic gauche)');
        return;
      }
      
      const obj = selected.type === 'fourreau' 
        ? fourreaux.find(f => f.id === selected.id)
        : cables.find(c => c.id === selected.id);
        
      if (!obj) return;
      
      const popup = document.getElementById('editPopup');
      const labelInput = document.getElementById('editLabel');
      const colorInput = document.getElementById('editColor');
      const phaseSection = document.getElementById('cablePhaseSection');
      
      // Remplir les champs avec les valeurs actuelles
      labelInput.value = obj.label || '';
      
      // Déterminer la couleur à afficher selon la priorité
      let displayColor;
      if (selected.type === 'fourreau') {
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
      if (selected.type === 'cable') {
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
      document.getElementById('editPopup').style.display = 'none';
    }
    
    function saveEdit() {
      if (!selected) {
        closeEditPopup();
        return;
      }
      
      const obj = selected.type === 'fourreau' 
        ? fourreaux.find(f => f.id === selected.id)
        : cables.find(c => c.id === selected.id);
        
      if (!obj) {
        closeEditPopup();
        return;
      }
      
      const labelInput = document.getElementById('editLabel');
      const colorInput = document.getElementById('editColor');
      
      // Sauvegarder les modifications
      obj.label = labelInput.value;
      
      // Si c'est un câble, gérer le conducteur sélectionné
      if (selected.type === 'cable') {
        // Trouver quel bouton radio est sélectionné
        const selectedRadio = document.querySelector('input[name="cablePhase"]:checked');
        const selectedPhase = selectedRadio ? selectedRadio.dataset.phase : 'none';
        
        obj.selectedPhase = selectedPhase;
        
        // Vérifier si une couleur personnalisée a été définie
        const defaultColor = colorForCable(obj.fam, obj.code);
        const currentColor = colorInput.value;
        
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
      } else {
        // Pour les fourreaux, garder la logique actuelle
        obj.customColor = colorInput.value !== obj.color ? colorInput.value : null;
      }
      
      closeEditPopup();
      redraw();
      updateSelectedInfo();
      showToast('Objet modifié avec succès');
    }
    
    // Gestionnaires d'événements popup
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    document.getElementById('cancelEdit').addEventListener('click', closeEditPopup);
    document.getElementById('editPopup').addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-popup-overlay')) {
        closeEditPopup();
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
      if (k === 'g' && e.ctrlKey) { e.preventDefault(); arrangeConduitGrid(); return; }
      if (k === 'g') { toggleFreezeSelected(); return; }
      if (k === 'e') { openEditPopup(); return; }
      if (k === 'i') { toggleShowInfo(); return; }
    });

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
    requestAnimationFrame(tick);
  }

  init();

})();

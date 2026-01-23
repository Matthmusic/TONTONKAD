/**
 * Canvas Resize Handler - Redimensionnement de la zone de travail
 * Gère 4 poignées (une au centre de chaque côté) pour redimensionner WORLD_W_MM et WORLD_H_MM
 */

(function() {
  'use strict';

  const HANDLE_SIZE = 18; // Taille des poignées en pixels
  const HANDLE_HIT_SIZE = 30; // Zone de détection plus large que la poignée
  const MIN_SIZE = 100; // Taille minimale en mm
  const ROUND_STEP = 5;

  // État du drag
  let dragState = null; // { side: 'top'|'right'|'bottom'|'left', startMousePos, startDimensions }
  let minDimsCache = null;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE_MS = 16; // ~60fps max

  /**
   * Dessine les 4 poignées de resize (centres des côtés)
   */
  function drawResizeHandles(ctx, worldW, worldH) {
    if (!ctx || !worldW || !worldH) {
      return;
    }

    const half = HANDLE_SIZE / 2;
    const radius = 5;
    const handles = [
      { x: worldW / 2, y: 0,       side: 'top' },    // Haut
      { x: worldW,     y: worldH / 2, side: 'right' }, // Droite
      { x: worldW / 2, y: worldH,  side: 'bottom' }, // Bas
      { x: 0,          y: worldH / 2, side: 'left' }  // Gauche
    ];

    const drawRoundedRect = (x, y, w, h, r) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    ctx.save();
    handles.forEach(h => {
      const x = h.x - half;
      const y = h.y - half;

      const grad = ctx.createLinearGradient(x, y, x + HANDLE_SIZE, y + HANDLE_SIZE);
      grad.addColorStop(0, '#ffe1cc');
      grad.addColorStop(1, '#ff914d');

      ctx.shadowColor = 'rgba(255, 145, 77, 0.55)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = grad;
      drawRoundedRect(x, y, HANDLE_SIZE, HANDLE_SIZE, radius);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /**
   * Détecte si la souris est sur une poignée
   * @param {number} x - coordonnée X dans le canvas (en pixels, déjà avec CANVAS_MARGIN soustrait)
   * @param {number} y - coordonnée Y dans le canvas (déjà avec CANVAS_MARGIN soustrait)
   * @returns {string|null} - 'top', 'right', 'bottom', 'left' ou null
   */
  function detectHandle(x, y) {
    const worldW = window.WORLD_W || 0;
    const worldH = window.WORLD_H || 0;

    // Les coordonnées des poignées dans l'espace world (sans marge)
    const handles = [
      { x: worldW / 2, y: 0,       side: 'top' },
      { x: worldW,     y: worldH / 2, side: 'right' },
      { x: worldW / 2, y: worldH,  side: 'bottom' },
      { x: 0,          y: worldH / 2, side: 'left' }
    ];


    for (let h of handles) {
      const dx = Math.abs(x - h.x);
      const dy = Math.abs(y - h.y);
      if (dx <= HANDLE_HIT_SIZE/2 && dy <= HANDLE_HIT_SIZE/2) {
        return h.side;
      }
    }
    return null;
  }

  /**
   * Démarre le drag d'une poignée
   */
  function startResize(side, mouseX, mouseY) {
    dragState = {
      side: side,
      startMouseX: mouseX,
      startMouseY: mouseY,
      startW: window.WORLD_W_MM || 1000,
      startH: window.WORLD_H_MM || 1000
    };
    window.resizePreview = null;
    minDimsCache = typeof window.getResizeMinimumDimensions === 'function'
      ? window.getResizeMinimumDimensions()
      : null;
  }

  /**
   * Met à jour pendant le drag (en temps réel)
   */
  function updateResize(mouseX, mouseY) {
    if (!dragState) return;

    // Throttle pour éviter trop de redraws
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
      return;
    }
    lastUpdateTime = now;

    const mmToPx = window.MM_TO_PX || 1;
    const lockWidth = document.getElementById('lockWidth')?.checked;
    const lockHeight = document.getElementById('lockHeight')?.checked;

    let newW = dragState.startW;
    let newH = dragState.startH;

    // Calculer le delta en pixels, puis en mm
    const deltaX = mouseX - dragState.startMouseX;
    const deltaY = mouseY - dragState.startMouseY;
    const deltaMmX = deltaX / mmToPx;
    const deltaMmY = deltaY / mmToPx;

    // Appliquer selon le côté
    switch (dragState.side) {
      case 'right':
        if (!lockWidth) newW = Math.max(MIN_SIZE, dragState.startW + deltaMmX);
        break;
      case 'left':
        if (!lockWidth) newW = Math.max(MIN_SIZE, dragState.startW - deltaMmX);
        break;
      case 'bottom':
        if (!lockHeight) newH = Math.max(MIN_SIZE, dragState.startH + deltaMmY);
        break;
      case 'top':
        if (!lockHeight) newH = Math.max(MIN_SIZE, dragState.startH - deltaMmY);
        break;
    }


    let blocked = false;
    const minDims = minDimsCache;

    if (minDims) {
      if (!lockWidth && (dragState.side === 'left' || dragState.side === 'right') && newW < minDims.width) {
        newW = minDims.width;
        blocked = true;
      }
      if (!lockHeight && (dragState.side === 'top' || dragState.side === 'bottom') && newH < minDims.height) {
        newH = minDims.height;
        blocked = true;
      }
    }

    // Mettre à jour les inputs avec les valeurs arrondies
    const boxWInput = document.getElementById('boxW');
    const boxHInput = document.getElementById('boxH');
    let roundedW = Math.round(newW / ROUND_STEP) * ROUND_STEP;
    let roundedH = Math.round(newH / ROUND_STEP) * ROUND_STEP;

    if (minDims) {
      if (roundedW < minDims.width) roundedW = Math.ceil(minDims.width / ROUND_STEP) * ROUND_STEP;
      if (roundedH < minDims.height) roundedH = Math.ceil(minDims.height / ROUND_STEP) * ROUND_STEP;
    }

    if (boxWInput && !lockWidth) boxWInput.value = roundedW;
    if (boxHInput && !lockHeight) boxHInput.value = roundedH;

    const resizePreview = {
      widthMm: roundedW,
      heightMm: roundedH,
      side: dragState.side,
      blocked
    };

    window.resizePreview = resizePreview;
  }

  /**
   * Termine le drag
   */
  function endResize() {
    if (!dragState) return;

    const preview = window.resizePreview;
    window.resizePreview = null;

    let didApply = false;

    if (preview && typeof window.applyDimensions === 'function') {
      const currentW = window.WORLD_W_MM || 0;
      const currentH = window.WORLD_H_MM || 0;
      const targetW = preview.widthMm;
      const targetH = preview.heightMm;

      if (targetW !== currentW || targetH !== currentH) {
        const lockWidth = document.getElementById('lockWidth')?.checked;
        const lockHeight = document.getElementById('lockHeight')?.checked;
        const boxWInput = document.getElementById('boxW');
        const boxHInput = document.getElementById('boxH');
        if (boxWInput && !lockWidth) boxWInput.value = targetW;
        if (boxHInput && !lockHeight) boxHInput.value = targetH;

        window.applyDimensions({ fitContents: true });
        didApply = true;
      }
    }

    if (didApply) {
      // Sauvegarder dans l'historique
      if (typeof window.saveStateToHistory === 'function') {
        window.saveStateToHistory();
      }

      // Toast
      if (typeof window.showToast === 'function') {
        const w = window.WORLD_W_MM || 0;
        const h = window.WORLD_H_MM || 0;
        window.showToast(`Boite redimensionnee: ${Math.round(w)}x${Math.round(h)}mm`);
      }
    }

    dragState = null;
    minDimsCache = null;
  }

  /**
   * Gère le curseur au survol
   */
  function updateCursor(x, y) {
    if (dragState) return; // Pas de changement pendant le drag

    const side = detectHandle(x, y);
    const canvas = document.getElementById('world');

    if (!canvas) return;

    if (side === 'top' || side === 'bottom') {
      canvas.style.cursor = 'ns-resize';
    } else if (side === 'left' || side === 'right') {
      canvas.style.cursor = 'ew-resize';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // ===== API PUBLIQUE =====

  window.drawResizeHandles = drawResizeHandles;

  window.handleResizeMouseDown = function(x, y) {
    const side = detectHandle(x, y);
    if (side) {
      startResize(side, x, y);
      return true; // Indique qu'on a capturé l'événement
    }
    return false;
  };

  window.handleResizeMouseMove = function(x, y) {
    if (dragState) {
      updateResize(x, y);
    } else {
      updateCursor(x, y);
    }
  };

  window.handleResizeMouseUp = function() {
    endResize();
  };

  window.isResizing = function() {
    return dragState !== null;
  };

})();

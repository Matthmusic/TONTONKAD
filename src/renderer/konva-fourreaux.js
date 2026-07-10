/**
 * konva-fourreaux.js
 * Rendu Konva pour les fourreaux : remplace le drawFourreau() du canvas 2D.
 * Ajoute des guide lines de snap pendant le drag.
 * pointer-events: none → script.js gère toujours les événements souris.
 * Konva est chargé via konva.min.js (UMD) avant ce script → window.Konva disponible.
 */
(function () {
  'use strict';
  const Konva = window.Konva;

  let stage = null;
  let guidesLayer = null;
  let fourreauxLayer = null;

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    if (stage) return;

    const canvas = document.getElementById('world');
    if (!canvas) return;

    // Conteneur positionné exactement au-dessus du canvas existant
    const wrap = canvas.parentElement;
    wrap.style.position = 'relative';

    const div = document.createElement('div');
    div.id = 'konva-fourreaux-container';
    div.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;';
    wrap.appendChild(div);

    stage = new Konva.Stage({ container: div, width: 1, height: 1 });

    // Guides de snap (trait bleu, redessinés pendant le drag)
    guidesLayer = new Konva.Layer({ listening: false });
    // Fourreaux (redessinés après chaque changement)
    fourreauxLayer = new Konva.Layer({ listening: false });

    stage.add(guidesLayer);
    stage.add(fourreauxLayer);

    syncTransform();
    render();

    console.debug('[Konva] konva-fourreaux initialisé');
  }

  // ─── Sync transform ────────────────────────────────────────────────────────
  // Aligne le Stage Konva sur le canvas HTML : même taille CSS, même offset.
  // Canvas ctx.setTransform(epr, 0, 0, epr, (MARGIN+ox)*epr, (MARGIN+oy)*epr)
  // → point world (wx,wy) → CSS pos (MARGIN+ox+wx)*scale, (MARGIN+oy+wy)*scale
  // Konva : stage.position + stage.scale → même résultat avec scale=displayScale

  function syncTransform() {
    if (!stage) return;

    const canvas = document.getElementById('world');
    if (!canvas) return;

    const cssW = parseFloat(canvas.style.width) || canvas.offsetWidth;
    const cssH = parseFloat(canvas.style.height) || canvas.offsetHeight;
    const margin = window.CANVAS_MARGIN || 100;
    const scale  = window.displayScale   || 1;
    const offset = window.canvasOffsetPx || { x: 0, y: 0 };

    // Aligner le conteneur Konva exactement sur le canvas dans son parent
    const div = stage.container();
    div.style.left   = canvas.offsetLeft + 'px';
    div.style.top    = canvas.offsetTop  + 'px';
    div.style.width  = cssW + 'px';
    div.style.height = cssH + 'px';

    stage.width(cssW);
    stage.height(cssH);
    stage.scale({ x: scale, y: scale });
    stage.position({
      x: (margin + offset.x) * scale,
      y: (margin + offset.y) * scale,
    });
  }

  // ─── Render fourreaux ──────────────────────────────────────────────────────

  function render() {
    if (!stage) return;

    const fourreaux = window.fourreaux || [];
    const mmToPx    = window.MM_TO_PX   || 0.5;
    const scale     = window.displayScale || 1;
    const showInfo  = window.showInfo;

    fourreauxLayer.destroyChildren();

    fourreaux.forEach((f, idx) => {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) return;

      const ro  = f.od  * mmToPx / 2;
      const ri  = (f.idm || 0) * mmToPx / 2;
      const col = f.customColor || f.color || '#ff914d';
      const sw  = Math.max(0.25, 2 / scale);

      const group = new Konva.Group({ x: Math.round(f.x), y: Math.round(f.y) });

      // Anneau (tube creux) — reproduit le fill evenodd du canvas
      if (ri > 0 && ri < ro) {
        group.add(new Konva.Ring({
          innerRadius: ri,
          outerRadius: ro,
          fill:        hexAlpha(col, 0.15),
          stroke:      col,
          strokeWidth: sw,
        }));
      } else {
        // Fourreau plein (idm ≈ 0 ou absent)
        group.add(new Konva.Circle({
          radius:      ro,
          fill:        hexAlpha(col, 0.15),
          stroke:      col,
          strokeWidth: sw,
        }));
      }

      // Numéro au-dessus du cercle
      const fontSize = Math.max(8, 13 / scale);
      group.add(new Konva.Text({
        x:           -ro,
        y:           -ro - fontSize - 4 / scale,
        width:       ro * 2,
        align:       'center',
        text:        String(idx + 1),
        fontSize:    fontSize,
        fontStyle:   'bold',
        fill:        '#fff',
        stroke:      '#000',
        strokeWidth: Math.max(0.5, 2.5 / scale),
      }));

      // Label (si showInfo activé)
      if (showInfo && f.label && f.label.trim()) {
        group.add(new Konva.Text({
          x:           -ro,
          y:           ro + 4 / scale,
          width:       ro * 2,
          align:       'center',
          text:        f.label.trim(),
          fontSize:    Math.max(7, 12 / scale),
          fontStyle:   'bold',
          fill:        '#fff',
          stroke:      '#000',
          strokeWidth: Math.max(0.5, 2 / scale),
        }));
      }

      fourreauxLayer.add(group);
    });

    fourreauxLayer.batchDraw();
  }

  // ─── Guide lines de snap ───────────────────────────────────────────────────

  function showGuides(x, y, mode = 'normal') {
    if (!stage) return;

    guidesLayer.destroyChildren();

    const worldW = window.WORLD_W || 500;
    const worldH = window.WORLD_H || 500;
    const scale  = window.displayScale || 1;
    const sw     = Math.max(0.5, 1 / scale);
    const dash   = [Math.max(2, 4 / scale), Math.max(3, 5 / scale)];
    // Vert pour mode ORTHO, bleu pour mode normal
    const color  = mode === 'ortho' ? 'rgba(0,200,80,0.85)' : 'rgba(0,161,255,0.85)';
    const dotCol = mode === 'ortho' ? 'rgba(0,200,80,0.9)'  : 'rgba(0,161,255,0.9)';

    guidesLayer.add(new Konva.Line({
      points:      [x, 0, x, worldH],
      stroke:      color,
      strokeWidth: sw,
      dash:        dash,
    }));

    guidesLayer.add(new Konva.Line({
      points:      [0, y, worldW, y],
      stroke:      color,
      strokeWidth: sw,
      dash:        dash,
    }));

    guidesLayer.add(new Konva.Circle({
      x:           x,
      y:           y,
      radius:      Math.max(3, 5 / scale),
      fill:        dotCol,
    }));

    guidesLayer.batchDraw();
  }

  function hideGuides() {
    if (!guidesLayer) return;
    guidesLayer.destroyChildren();
    guidesLayer.batchDraw();
  }

  // Lignes de projection OSNAP (tirets dorés) + marqueur X à la source + point d'accroche final
  function showOsnapGuides(alignments, snappedX, snappedY) {
    if (!stage) return;
    guidesLayer.destroyChildren();

    if (!alignments || alignments.length === 0) {
      guidesLayer.batchDraw();
      return;
    }

    const worldW  = window.WORLD_W || 500;
    const worldH  = window.WORLD_H || 500;
    const scale   = window.displayScale || 1;
    const sw      = Math.max(0.5, 1.5 / scale);
    const dash    = [Math.max(4, 10 / scale), Math.max(3, 6 / scale)];
    const colLine = 'rgba(255, 200, 0, 0.75)';
    const colMark = 'rgba(255, 200, 0, 0.95)';

    for (const al of alignments) {
      // Ligne de projection traversant tout le monde
      guidesLayer.add(new Konva.Line({
        points:      al.axis === 'h'
          ? [0, al.snapY, worldW, al.snapY]
          : [al.snapX, 0, al.snapX, worldH],
        stroke:      colLine,
        strokeWidth: sw,
        dash:        dash,
      }));

      // Marqueur X au point source (centre ou quadrant du fourreau voisin)
      const ms = Math.max(5, 9 / scale);
      guidesLayer.add(new Konva.Line({ points: [al.snapX - ms, al.snapY - ms, al.snapX + ms, al.snapY + ms], stroke: colMark, strokeWidth: Math.max(1.5, 2.5 / scale) }));
      guidesLayer.add(new Konva.Line({ points: [al.snapX + ms, al.snapY - ms, al.snapX - ms, al.snapY + ms], stroke: colMark, strokeWidth: Math.max(1.5, 2.5 / scale) }));
    }

    // Point d'accroche final (intersection des lignes de projection)
    if (snappedX != null && snappedY != null) {
      guidesLayer.add(new Konva.Circle({
        x:      snappedX,
        y:      snappedY,
        radius: Math.max(4, 7 / scale),
        fill:   colMark,
      }));
    }

    guidesLayer.batchDraw();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function hexAlpha(hex, a) {
    if (!hex || !hex.startsWith('#')) return `rgba(255,145,77,${a})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ─── API publique ──────────────────────────────────────────────────────────

  window.konvaFourreaux = { init, syncTransform, render, showGuides, hideGuides, showOsnapGuides };

  // Auto-init après chargement de l'app (script.js s'initialise en premier)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150));
  } else {
    setTimeout(init, 150);
  }
})();

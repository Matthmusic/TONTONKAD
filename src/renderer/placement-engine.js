/**
 * Placement Engine - Système intelligent de placement des fourreaux
 * @module placement-engine
 */

/**
 * Configuration globale du placement
 */
const PLACEMENT_CONFIG = {
  entraxe: 30, // mm (15mm de chaque côté)
  litDePose: 40, // mm (4cm marges CCTP)
  maxConfigs: 5, // Nombre configs générées
  scoringWeights: {
    surface: 0.40,
    symmetry: 0.25,
    stability: 0.20,
    shape: 0.15
  },
  maxFourreaux: 50, // Limite performance
  performanceTarget: 100, // ms max pour calcul
};

/**
 * Calcule la taille de cellule pour un diamètre donné
 * @param {number} diameter - Diamètre en mm
 * @returns {number} Taille cellule en mm
 */
function calculateCellSize(diameter) {
  return diameter + 30; // 15mm entraxe de chaque côté
}

/**
 * Classe représentant une configuration de placement de fourreaux
 */
class PlacementConfiguration {
  /**
   * Crée une nouvelle configuration de placement
   * @param {number} boxWidth - Largeur de la boîte en mm
   * @param {number} boxHeight - Hauteur de la boîte en mm
   * @param {Object} constraints - Contraintes de placement {lockedAxis: 'width'|'height'|null}
   */
  constructor(boxWidth, boxHeight, constraints = {}) {
    this.width = boxWidth;
    this.height = boxHeight;
    this.constraints = constraints; // {lockedAxis: 'width'|'height'|null}
    this.grid = []; // Grille 2D
    this.placedFourreaux = [];
    this.score = null;
  }

  /**
   * Calcule la taille de cellule pour un fourreau donné
   * @param {number} diameter - Diamètre fourreau en mm
   * @returns {number} Taille cellule en mm (diameter + 30)
   */
  calculateCellSize(diameter) {
    return diameter + 30; // 15mm de chaque côté
  }

  /**
   * Vérifie si un fourreau peut être placé à une position donnée
   * @param {Object} fourreau - {diameter, x, y, id}
   * @param {number} x - Position X en mm
   * @param {number} y - Position Y en mm
   * @returns {boolean} true si placement possible, false sinon
   */
  canPlace(fourreau, x, y) {
    const cellSize = this.calculateCellSize(fourreau.diameter);

    // Vérifier limites de la boîte
    if (x < 0 || y < 0) {
      return false;
    }
    if (x + cellSize > this.width || y + cellSize > this.height) {
      return false;
    }

    // Vérifier collisions avec fourreaux existants
    for (const placed of this.placedFourreaux) {
      const placedCellSize = this.calculateCellSize(placed.diameter);

      // Calcul overlap rectangulaire
      const overlapX = !(x + cellSize <= placed.x || placed.x + placedCellSize <= x);
      const overlapY = !(y + cellSize <= placed.y || placed.y + placedCellSize <= y);

      if (overlapX && overlapY) {
        return false; // Collision détectée
      }
    }

    // Vérifier contraintes d'axe verrouillé
    if (this.constraints.lockedAxis === 'width') {
      // Width est fixe, vérifier qu'on ne dépasse pas
      if (x + cellSize > this.width) {
        return false;
      }
    } else if (this.constraints.lockedAxis === 'height') {
      // Height est fixe, vérifier qu'on ne dépasse pas
      if (y + cellSize > this.height) {
        return false;
      }
    }

    return true;
  }

  /**
   * Ajoute un fourreau à la configuration
   * @param {Object} fourreau - {diameter, x, y, id, type, ...}
   * @throws {Error} Si placement impossible
   */
  addFourreau(fourreau) {
    if (!this.canPlace(fourreau, fourreau.x, fourreau.y)) {
      throw new Error(`Cannot place fourreau ${fourreau.id} at position (${fourreau.x}, ${fourreau.y})`);
    }

    // Ajouter à la liste
    this.placedFourreaux.push({...fourreau});

    // Mettre à jour la grille (marquage occupé)
    // Note: La grille est conceptuelle ici, pas besoin de matrice physique
    // On utilise la liste placedFourreaux pour détecter collisions
  }

  /**
   * Obtient le score de cette configuration
   * @returns {number|null} Score entre 0-1, ou null si pas encore calculé
   */
  getScore() {
    return this.score;
  }

  /**
   * Clone cette configuration pour exploration de variantes
   * @returns {PlacementConfiguration} Copie profonde de la configuration
   */
  clone() {
    const cloned = new PlacementConfiguration(
      this.width,
      this.height,
      {...this.constraints}
    );

    cloned.placedFourreaux = this.placedFourreaux.map(f => ({...f}));
    cloned.score = this.score;

    return cloned;
  }
}

/**
 * Classe utilitaire pour trier et analyser les fourreaux
 */
class FourreauSorter {
  /**
   * Trie les fourreaux selon critères multiples pour optimisation
   * @param {Array} fourreaux - [{diameter, quantity, type, ...}]
   * @returns {Array} Fourreaux triés (copie, ne modifie pas original)
   */
  static intelligentSort(fourreaux) {
    // Copie pour ne pas modifier l'original
    const copy = [...fourreaux];

    return copy.sort((a, b) => {
      // Critère 1 : Diamètre décroissant (gros en premier/bas)
      if (b.diameter !== a.diameter) {
        return b.diameter - a.diameter;
      }

      // Critère 2 : Favoriser groupes pairs pour symétrie
      const aSymmetric = a.quantity % 2 === 0 ? 1 : 0;
      const bSymmetric = b.quantity % 2 === 0 ? 1 : 0;
      if (bSymmetric !== aSymmetric) {
        return bSymmetric - aSymmetric;
      }

      // Critère 3 : Quantité décroissante
      return b.quantity - a.quantity;
    });
  }

  /**
   * Identifie les paires symétriques potentielles
   * @param {Array} fourreaux - Liste de fourreaux
   * @returns {Array} Groupes de paires [{left: f1, right: f2}, ...]
   */
  static detectSymmetricPairs(fourreaux) {
    const pairs = [];
    const grouped = {};

    // Regrouper par diamètre
    for (const f of fourreaux) {
      const key = f.diameter;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(f);
    }

    // Identifier paires possibles (par 2)
    for (const diameter in grouped) {
      const group = grouped[diameter];
      const pairCount = Math.floor(group.length / 2);

      for (let i = 0; i < pairCount; i++) {
        pairs.push({
          left: group[i * 2],
          right: group[i * 2 + 1],
          diameter: parseInt(diameter)
        });
      }
    }

    return pairs;
  }
}

/**
 * Classe génératrice de configurations multiples
 * Implémente 5 stratégies de placement différentes
 */
class ConfigurationGenerator {
  /**
   * Génère N configurations candidates avec différentes stratégies
   * @param {Array} fourreaux - Liste fourreaux à placer [{diameter, quantity, type, ...}]
   * @param {Object} constraints - {lockedAxis: 'width'|'height'|null, lockedValue: number}
   * @returns {Array<PlacementConfiguration>} Jusqu'à 5 configurations valides
   */
  generateConfigurations(fourreaux, constraints = {}) {
    // Expand fourreaux avec quantités (1 fourreau → quantity instances)
    const expandedFourreaux = [];
    let idCounter = 1;

    for (const f of fourreaux) {
      const quantity = f.quantity || 1;
      for (let i = 0; i < quantity; i++) {
        expandedFourreaux.push({
          ...f,
          id: f.id || `f${idCounter++}`,
          originalIndex: expandedFourreaux.length
        });
      }
    }

    // Tri intelligent des fourreaux
    const sorted = FourreauSorter.intelligentSort(
      expandedFourreaux.map(f => ({...f, quantity: 1}))
    );

    // Génère 5 configs avec stratégies différentes
    const strategies = [
      () => this.bottomLeftStrategy(sorted, constraints),
      () => this.centeredSymmetricStrategy(sorted, constraints),
      () => this.minWidthStrategy(sorted, constraints),
      () => this.minHeightStrategy(sorted, constraints),
      () => this.squareShapeStrategy(sorted, constraints)
    ];

    const configs = [];
    for (const strategy of strategies) {
      try {
        const config = strategy();
        if (config !== null) {
          configs.push(config);
        }
      } catch (error) {
        // Stratégie échouée, continuer avec les autres
        console.warn('Strategy failed:', error.message);
      }
    }

    return configs;
  }

  /**
   * Stratégie 1 : Placement bas-gauche (bottom-left)
   * Place chaque fourreau à la position la plus basse, puis la plus à gauche
   * @param {Array} fourreaux - Fourreaux triés
   * @param {Object} constraints - Contraintes de placement
   * @returns {PlacementConfiguration|null} Configuration ou null si impossible
   */
  bottomLeftStrategy(fourreaux, constraints = {}) {
    // Initialiser avec dimensions généreuses
    const initialWidth = constraints.lockedAxis === 'width'
      ? constraints.lockedValue
      : 2000;
    const initialHeight = constraints.lockedAxis === 'height'
      ? constraints.lockedValue
      : 2000;

    const config = new PlacementConfiguration(initialWidth, initialHeight, constraints);
    const stepSize = 30; // mm - précision de recherche (entraxe)

    for (const f of fourreaux) {
      const cellSize = config.calculateCellSize(f.diameter);
      let bestPos = null;
      let minY = Infinity;
      let minX = Infinity;

      // Chercher position la plus basse, puis la plus à gauche
      for (let y = 0; y <= config.height - cellSize; y += stepSize) {
        for (let x = 0; x <= config.width - cellSize; x += stepSize) {
          if (config.canPlace(f, x, y)) {
            if (y < minY || (y === minY && x < minX)) {
              minY = y;
              minX = x;
              bestPos = {x, y};
            }
          }
        }
        // Si on a trouvé une position sur cette ligne, pas besoin de chercher plus haut
        if (bestPos && minY === y) break;
      }

      if (bestPos) {
        config.addFourreau({...f, x: bestPos.x, y: bestPos.y});
      } else {
        // Impossible de placer
        if (constraints.lockedAxis) {
          return null; // Contraintes trop strictes
        }
        // Agrandir la boîte
        config.height += cellSize;
        config.addFourreau({...f, x: 0, y: config.height - cellSize});
      }
    }

    // Réduire dimensions au minimum nécessaire
    this._shrinkToFit(config);
    return config;
  }

  /**
   * Stratégie 2 : Placement symétrique centré
   * Privilégie la symétrie autour de l'axe Y vertical
   * @param {Array} fourreaux - Fourreaux triés
   * @param {Object} constraints - Contraintes de placement
   * @returns {PlacementConfiguration|null} Configuration ou null si impossible
   */
  centeredSymmetricStrategy(fourreaux, constraints = {}) {
    // Ajouter originalIndex si absent (pour tests directs)
    const fourreauxWithIndex = fourreaux.map((f, i) => ({
      ...f,
      originalIndex: f.originalIndex !== undefined ? f.originalIndex : i
    }));

    // Identifier paires symétriques
    const pairs = FourreauSorter.detectSymmetricPairs(fourreauxWithIndex);
    const paired = new Set();
    pairs.forEach(p => {
      paired.add(p.left.originalIndex);
      paired.add(p.right.originalIndex);
    });

    // Fourreaux non appariés (impairs)
    const unpaired = fourreauxWithIndex.filter(f => !paired.has(f.originalIndex));

    // Calculer largeur exacte nécessaire pour placement symétrique
    const maxPairCellSize = pairs.length > 0
      ? Math.max(...pairs.map(p => p.left.diameter + 30))
      : 0;
    const maxUnpairedCellSize = unpaired.length > 0
      ? Math.max(...unpaired.map(f => f.diameter + 30))
      : 0;
    const gap = 30;
    const minWidthNeeded = Math.max(
      maxPairCellSize * 2 + gap + PLACEMENT_CONFIG.litDePose * 2,
      maxUnpairedCellSize + PLACEMENT_CONFIG.litDePose * 2
    );

    const initialWidth = constraints.lockedAxis === 'width'
      ? constraints.lockedValue
      : minWidthNeeded;
    const initialHeight = constraints.lockedAxis === 'height'
      ? constraints.lockedValue
      : 2000;

    const config = new PlacementConfiguration(initialWidth, initialHeight, constraints);
    const centerX = config.width / 2;

    let currentY = 0;

    // Placer les paires symétriquement
    for (const pair of pairs) {
      const cellSize = config.calculateCellSize(pair.left.diameter);

      // Positions symétriques autour du centre fixe
      const leftX = centerX - cellSize - gap / 2;
      const rightX = centerX + gap / 2;

      // Vérifier si les positions sont valides
      if (leftX < 0 || rightX + cellSize > config.width) {
        if (constraints.lockedAxis) {
          return null; // Impossible avec contraintes
        }
        // Agrandir largeur et recalculer tout
        const newWidth = (cellSize * 2) + gap + PLACEMENT_CONFIG.litDePose * 2;
        config.width = newWidth;
        const newCenterX = config.width / 2;

        // Replacer tous les fourreaux déjà placés avec nouveau centre
        const alreadyPlaced = config.placedFourreaux.slice();
        config.placedFourreaux = [];

        // Replanter avec nouveau centre (simplifié: abandonner cette config)
        return null;
      }

      if (!config.canPlace(pair.left, leftX, currentY) ||
          !config.canPlace(pair.right, rightX, currentY)) {
        return null;
      }

      config.addFourreau({...pair.left, x: leftX, y: currentY});
      config.addFourreau({...pair.right, x: rightX, y: currentY});
      currentY += cellSize;
    }

    // Placer fourreaux impairs au centre
    for (const f of unpaired) {
      const cellSize = config.calculateCellSize(f.diameter);
      const centeredX = centerX - cellSize / 2;

      if (centeredX < 0 || centeredX + cellSize > config.width) {
        if (constraints.lockedAxis) {
          return null;
        }
        return null; // Simplifier: abandonner
      }

      if (!config.canPlace(f, centeredX, currentY)) {
        if (!constraints.lockedAxis) {
          config.height = currentY + cellSize;
        } else {
          return null;
        }
      }

      config.addFourreau({...f, x: centeredX, y: currentY});
      currentY += cellSize;
    }

    // NE PAS shrinkToFit pour préserver symétrie - juste ajuster hauteur
    if (config.constraints.lockedAxis !== 'height') {
      const maxY = Math.max(...config.placedFourreaux.map(f =>
        f.y + config.calculateCellSize(f.diameter)
      ));
      config.height = maxY + PLACEMENT_CONFIG.litDePose;
    }

    return config;
  }

  /**
   * Stratégie 3 : Minimiser la largeur
   * Place en colonnes verticales pour minimiser la largeur
   * @param {Array} fourreaux - Fourreaux triés
   * @param {Object} constraints - Contraintes de placement
   * @returns {PlacementConfiguration|null} Configuration ou null si impossible
   */
  minWidthStrategy(fourreaux, constraints = {}) {
    // Calculer largeur minimale basée sur le plus gros fourreau
    const maxCellSize = Math.max(...fourreaux.map(f => f.diameter + 30));

    const initialWidth = constraints.lockedAxis === 'width'
      ? constraints.lockedValue
      : maxCellSize * 2; // 2 colonnes max
    const initialHeight = constraints.lockedAxis === 'height'
      ? constraints.lockedValue
      : 5000;

    const config = new PlacementConfiguration(initialWidth, initialHeight, constraints);

    let currentX = 0;
    let currentY = 0;
    let maxHeightInColumn = 0;
    let columnCount = 0;

    for (const f of fourreaux) {
      const cellSize = config.calculateCellSize(f.diameter);

      // Essayer placement dans colonne actuelle
      if (config.canPlace(f, currentX, currentY)) {
        config.addFourreau({...f, x: currentX, y: currentY});
        currentY += cellSize;
        maxHeightInColumn = Math.max(maxHeightInColumn, currentY);
      } else {
        // Nouvelle colonne
        currentX += cellSize;
        currentY = 0;
        columnCount++;

        if (config.canPlace(f, currentX, currentY)) {
          config.addFourreau({...f, x: currentX, y: currentY});
          currentY += cellSize;
          maxHeightInColumn = Math.max(maxHeightInColumn, currentY);
        } else if (!constraints.lockedAxis) {
          config.width = currentX + cellSize;
          config.addFourreau({...f, x: currentX, y: currentY});
          currentY += cellSize;
        } else {
          return null; // Impossible
        }
      }
    }

    this._shrinkToFit(config);
    return config;
  }

  /**
   * Stratégie 4 : Minimiser la hauteur
   * Place en rangées horizontales pour minimiser la hauteur
   * @param {Array} fourreaux - Fourreaux triés
   * @param {Object} constraints - Contraintes de placement
   * @returns {PlacementConfiguration|null} Configuration ou null si impossible
   */
  minHeightStrategy(fourreaux, constraints = {}) {
    const maxCellSize = Math.max(...fourreaux.map(f => f.diameter + 30));

    const initialWidth = constraints.lockedAxis === 'width'
      ? constraints.lockedValue
      : 5000;
    const initialHeight = constraints.lockedAxis === 'height'
      ? constraints.lockedValue
      : maxCellSize * 2; // 2 rangées max

    const config = new PlacementConfiguration(initialWidth, initialHeight, constraints);

    let currentX = 0;
    let currentY = 0;
    let maxWidthInRow = 0;

    for (const f of fourreaux) {
      const cellSize = config.calculateCellSize(f.diameter);

      // Essayer placement dans rangée actuelle
      if (config.canPlace(f, currentX, currentY)) {
        config.addFourreau({...f, x: currentX, y: currentY});
        currentX += cellSize;
        maxWidthInRow = Math.max(maxWidthInRow, currentX);
      } else {
        // Nouvelle rangée
        currentY += cellSize;
        currentX = 0;

        if (config.canPlace(f, currentX, currentY)) {
          config.addFourreau({...f, x: currentX, y: currentY});
          currentX += cellSize;
          maxWidthInRow = Math.max(maxWidthInRow, currentX);
        } else if (!constraints.lockedAxis) {
          config.height = currentY + cellSize;
          config.addFourreau({...f, x: currentX, y: currentY});
          currentX += cellSize;
        } else {
          return null; // Impossible
        }
      }
    }

    this._shrinkToFit(config);
    return config;
  }

  /**
   * Stratégie 5 : Forme carrée
   * Vise un ratio largeur:hauteur proche de 1:1
   * @param {Array} fourreaux - Fourreaux triés
   * @param {Object} constraints - Contraintes de placement
   * @returns {PlacementConfiguration|null} Configuration ou null si impossible
   */
  squareShapeStrategy(fourreaux, constraints = {}) {
    // Calculer dimensions approximatives pour forme carrée
    const totalCellArea = fourreaux.reduce((sum, f) =>
      sum + Math.pow(f.diameter + 30, 2), 0
    );
    const sideLength = Math.sqrt(totalCellArea) * 1.2; // Marge 20%

    const initialWidth = constraints.lockedAxis === 'width'
      ? constraints.lockedValue
      : sideLength;
    const initialHeight = constraints.lockedAxis === 'height'
      ? constraints.lockedValue
      : sideLength;

    const config = new PlacementConfiguration(initialWidth, initialHeight, constraints);

    // Calculer nombre optimal de fourreaux par rangée
    const averageCellSize = Math.sqrt(totalCellArea / fourreaux.length);
    const fourreauPerRow = Math.max(1, Math.floor(sideLength / averageCellSize));

    let currentX = 0;
    let currentY = 0;
    let fourreauInCurrentRow = 0;
    let maxRowHeight = 0;

    for (const f of fourreaux) {
      const cellSize = config.calculateCellSize(f.diameter);
      maxRowHeight = Math.max(maxRowHeight, cellSize);

      if (config.canPlace(f, currentX, currentY)) {
        config.addFourreau({...f, x: currentX, y: currentY});
        currentX += cellSize;
        fourreauInCurrentRow++;

        // Nouvelle rangée si limite atteinte
        if (fourreauInCurrentRow >= fourreauPerRow) {
          currentX = 0;
          currentY += maxRowHeight;
          fourreauInCurrentRow = 0;
          maxRowHeight = 0;
        }
      } else {
        // Essayer nouvelle rangée
        currentX = 0;
        currentY += maxRowHeight;
        fourreauInCurrentRow = 0;
        maxRowHeight = cellSize;

        if (config.canPlace(f, currentX, currentY)) {
          config.addFourreau({...f, x: currentX, y: currentY});
          currentX += cellSize;
          fourreauInCurrentRow++;
        } else if (!constraints.lockedAxis) {
          config.width = Math.max(config.width, currentX + cellSize);
          config.height = Math.max(config.height, currentY + cellSize);
          config.addFourreau({...f, x: currentX, y: currentY});
          currentX += cellSize;
        } else {
          return null; // Impossible
        }
      }
    }

    this._shrinkToFit(config);
    return config;
  }

  /**
   * Réduit les dimensions de la configuration au minimum nécessaire
   * @param {PlacementConfiguration} config - Configuration à ajuster
   * @private
   */
  _shrinkToFit(config) {
    if (config.placedFourreaux.length === 0) return;

    // Ne pas réduire les axes verrouillés
    if (config.constraints.lockedAxis !== 'width') {
      const maxX = Math.max(...config.placedFourreaux.map(f =>
        f.x + config.calculateCellSize(f.diameter)
      ));
      config.width = maxX + PLACEMENT_CONFIG.litDePose;
    }

    if (config.constraints.lockedAxis !== 'height') {
      const maxY = Math.max(...config.placedFourreaux.map(f =>
        f.y + config.calculateCellSize(f.diameter)
      ));
      config.height = maxY + PLACEMENT_CONFIG.litDePose;
    }
  }
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLACEMENT_CONFIG,
    calculateCellSize,
    PlacementConfiguration,
    FourreauSorter,
    ConfigurationGenerator
  };
}

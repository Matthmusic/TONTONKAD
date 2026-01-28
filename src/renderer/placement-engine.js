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

/**
 * Classe de scoring multi-objectif
 * Évalue configurations selon 4 critères pondérés
 */
class MultiObjectiveScorer {
  /**
   * Crée un scorer avec pondérations configurables
   * @param {Object} weights - Pondérations {surface, symmetry, stability, shape}
   */
  constructor(weights = {}) {
    this.weights = {
      surface: weights.surface !== undefined ? weights.surface : 0.40,
      symmetry: weights.symmetry !== undefined ? weights.symmetry : 0.25,
      stability: weights.stability !== undefined ? weights.stability : 0.20,
      shape: weights.shape !== undefined ? weights.shape : 0.15
    };
  }

  /**
   * Évalue une configuration et retourne score composite
   * @param {PlacementConfiguration} config - Configuration à évaluer
   * @returns {number} Score entre 0-1 (1 = meilleur)
   */
  evaluate(config) {
    const scores = {
      surface: this.scoreSurface(config),
      symmetry: this.scoreSymmetry(config),
      stability: this.scoreStability(config),
      shape: this.scoreSquareness(config)
    };

    // Score composite pondéré
    const totalScore = (
      scores.surface * this.weights.surface +
      scores.symmetry * this.weights.symmetry +
      scores.stability * this.weights.stability +
      scores.shape * this.weights.shape
    );

    // Stocker détails pour debug/analytics
    config.scoreDetails = scores;
    config.score = totalScore;

    return totalScore;
  }

  /**
   * Évalue compacité (minimise surface totale)
   * @param {PlacementConfiguration} config
   * @returns {number} Score 0-1 (1 = parfaitement compact)
   */
  scoreSurface(config) {
    if (config.placedFourreaux.length === 0) {
      return 1.0; // Config vide = parfait
    }

    // Surface minimale théorique = somme des aires de cellules
    const minTheoreticalArea = config.placedFourreaux.reduce((sum, f) => {
      const cellSize = config.calculateCellSize(f.diameter);
      return sum + Math.pow(cellSize, 2);
    }, 0);

    // Surface réelle utilisée
    const actualArea = config.width * config.height;

    // Score : ratio surface théorique / surface réelle
    // 1.0 = parfaitement compact, 0.5 = 50% gaspillage
    const efficiency = minTheoreticalArea / actualArea;

    // Normaliser et clamper entre 0-1
    return Math.min(1.0, Math.max(0.0, efficiency));
  }

  /**
   * Évalue symétrie sur axe Y vertical
   * @param {PlacementConfiguration} config
   * @returns {number} Score 0-1 (1 = symétrie parfaite)
   */
  scoreSymmetry(config) {
    if (config.placedFourreaux.length === 0) {
      return 1.0; // Config vide = symétrique
    }

    const centerX = config.width / 2;
    let symmetryMatches = 0;
    const totalFourreaux = config.placedFourreaux.length;
    const checked = new Set();

    for (const f of config.placedFourreaux) {
      if (checked.has(f.id)) continue;

      const cellSize = config.calculateCellSize(f.diameter);

      // Position symétrique attendue sur axe Y
      const expectedSymX = config.width - f.x - cellSize;

      // Chercher fourreau symétrique
      const symmetric = config.placedFourreaux.find(s =>
        !checked.has(s.id) &&
        s.id !== f.id &&
        s.diameter === f.diameter &&
        Math.abs(s.x - expectedSymX) < 20 && // Tolérance 20mm
        Math.abs(s.y - f.y) < 20
      );

      if (symmetric) {
        symmetryMatches += 2; // Compter les 2 fourreaux
        checked.add(f.id);
        checked.add(symmetric.id);
      } else {
        // Vérifier si fourreau centré (symétrique avec lui-même)
        const fCenterX = f.x + cellSize / 2;
        if (Math.abs(fCenterX - centerX) < 20) {
          symmetryMatches += 1;
          checked.add(f.id);
        }
      }
    }

    // Score = ratio fourreaux symétriques / total
    return symmetryMatches / totalFourreaux;
  }

  /**
   * Vérifie règle des 2 appuis minimum (stabilité physique)
   * @param {PlacementConfiguration} config
   * @returns {number} Score 0-1 (1 = tous stables)
   */
  scoreStability(config) {
    if (config.placedFourreaux.length === 0) {
      return 1.0; // Config vide = stable
    }

    let unstableCount = 0;

    for (const f of config.placedFourreaux) {
      const supports = this.countSupports(f, config);
      if (supports < 2) {
        unstableCount += 1;
      }
    }

    // Score = ratio fourreaux stables / total
    const stableCount = config.placedFourreaux.length - unstableCount;
    return stableCount / config.placedFourreaux.length;
  }

  /**
   * Compte le nombre de supports pour un fourreau
   * @param {Object} fourreau
   * @param {PlacementConfiguration} config
   * @returns {number} Nombre de supports (0-2+)
   * @private
   */
  countSupports(fourreau, config) {
    // Si au sol (y = 0 ou proche) : support parfait
    if (fourreau.y <= 5) return 2;

    // Compter fourreaux en dessous avec overlap horizontal
    let supportCount = 0;
    const cellSize = config.calculateCellSize(fourreau.diameter);

    for (const other of config.placedFourreaux) {
      if (other.id === fourreau.id) continue;

      // Fourreau doit être en dessous
      const otherCellSize = config.calculateCellSize(other.diameter);
      const otherTop = other.y + otherCellSize;

      // Vérifier si "other" est juste en dessous de "fourreau"
      if (Math.abs(otherTop - fourreau.y) <= 5) { // Tolérance 5mm
        // Vérifier overlap horizontal
        if (this.hasHorizontalOverlap(fourreau, other, config)) {
          supportCount++;
          if (supportCount >= 2) break; // Max 2 suffisent
        }
      }
    }

    return supportCount;
  }

  /**
   * Vérifie si deux fourreaux ont un overlap horizontal
   * @param {Object} f1
   * @param {Object} f2
   * @param {PlacementConfiguration} config
   * @returns {boolean} true si overlap existe
   * @private
   */
  hasHorizontalOverlap(f1, f2, config) {
    const f1CellSize = config.calculateCellSize(f1.diameter);
    const f2CellSize = config.calculateCellSize(f2.diameter);

    const f1Right = f1.x + f1CellSize;
    const f2Right = f2.x + f2CellSize;

    // Il y a overlap si les intervalles [f1.x, f1Right] et [f2.x, f2Right] se chevauchent
    return !(f1Right <= f2.x || f2Right <= f1.x);
  }

  /**
   * Favorise forme carrée (ratio width:height proche de 1)
   * @param {PlacementConfiguration} config
   * @returns {number} Score 0-1 (1 = carré parfait)
   */
  scoreSquareness(config) {
    if (config.width === 0 || config.height === 0) {
      return 0.0; // Config invalide
    }

    // Ratio du plus petit sur le plus grand
    const ratio = Math.min(config.width, config.height) /
                  Math.max(config.width, config.height);

    // ratio = 1.0 → carré parfait (score 1.0)
    // ratio = 0.5 → rectangle 2:1 (score 0.5)
    // ratio = 0.2 → très étalé (score 0.2)
    return ratio;
  }

  /**
   * Compare deux configurations et retourne la meilleure
   * @param {PlacementConfiguration} config1
   * @param {PlacementConfiguration} config2
   * @returns {PlacementConfiguration} Meilleure config
   */
  static compareBest(config1, config2) {
    const scorer = new MultiObjectiveScorer();
    const score1 = scorer.evaluate(config1);
    const score2 = scorer.evaluate(config2);

    return score1 >= score2 ? config1 : config2;
  }

  /**
   * Trie un tableau de configs par score décroissant
   * @param {Array<PlacementConfiguration>} configs
   * @returns {Array<PlacementConfiguration>} Configs triées (meilleure en premier)
   */
  static rankConfigurations(configs) {
    const scorer = new MultiObjectiveScorer();

    // Évaluer toutes les configs
    configs.forEach(cfg => scorer.evaluate(cfg));

    // Trier par score décroissant
    return configs.sort((a, b) => b.score - a.score);
  }
}

/**
 * Orchestrateur de placement - coordonne génération et scoring
 * Point d'entrée principal pour calculer le meilleur placement
 */
class PlacementOrchestrator {
  /**
   * Crée un orchestrateur avec generator et scorer
   */
  constructor() {
    this.generator = new ConfigurationGenerator();
    this.scorer = new MultiObjectiveScorer();
    this.mlModule = null; // Phase 2 uniquement
  }

  /**
   * Calcule le meilleur placement pour une liste de fourreaux
   * @param {Array} fourreaux - Liste fourreaux à placer [{diameter, quantity, type, ...}]
   * @param {Object} constraints - {lockedAxis: 'width'|'height'|null, boxWidth, boxHeight}
   * @param {Object} options - {autoResize: boolean}
   * @returns {PlacementConfiguration} Meilleure configuration
   */
  computeBestPlacement(fourreaux, constraints = {}, options = {}) {
    // Validation entrée
    if (!fourreaux || fourreaux.length === 0) {
      throw new Error('Aucun fourreau à placer');
    }

    // Adapter constraints pour le format attendu par le generator
    const generatorConstraints = {};
    if (constraints.lockedAxis) {
      generatorConstraints.lockedAxis = constraints.lockedAxis;
      if (constraints.lockedAxis === 'width' && constraints.boxWidth) {
        generatorConstraints.lockedValue = constraints.boxWidth;
      } else if (constraints.lockedAxis === 'height' && constraints.boxHeight) {
        generatorConstraints.lockedValue = constraints.boxHeight;
      }
    }

    // Génère N configurations candidates
    const configs = this.generator.generateConfigurations(
      fourreaux,
      generatorConstraints
    );

    if (configs.length === 0) {
      throw new Error('Impossible de générer des configurations valides');
    }

    // Score chaque config et trie par score décroissant
    const scored = configs.map(cfg => ({
      config: cfg,
      score: this.scorer.evaluate(cfg)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Retourne la meilleure
    const bestConfig = scored[0].config;

    // Si autoResize activé : ajuster dimensions au minimum
    if (options.autoResize) {
      this.optimizeDimensions(bestConfig);
    }

    // Log pour analytics (optionnel)
    console.log('[PlacementOrchestrator] Best config:', {
      score: bestConfig.score,
      scoreDetails: bestConfig.scoreDetails,
      dimensions: {width: bestConfig.width, height: bestConfig.height},
      strategy: this._identifyStrategy(bestConfig),
      alternativesCount: configs.length
    });

    return bestConfig;
  }

  /**
   * Optimise dimensions de la config (réduit au minimum)
   * @param {PlacementConfiguration} config
   */
  optimizeDimensions(config) {
    if (config.placedFourreaux.length === 0) return;

    // Calculer bounding box réelle des fourreaux placés
    let maxX = 0;
    let maxY = 0;

    for (const f of config.placedFourreaux) {
      const cellSize = config.calculateCellSize(f.diameter);
      maxX = Math.max(maxX, f.x + cellSize);
      maxY = Math.max(maxY, f.y + cellSize);
    }

    // Ajouter marges (lit de pose 40mm)
    const margin = PLACEMENT_CONFIG.litDePose;
    config.width = maxX + margin;
    config.height = maxY + margin;
  }

  /**
   * Identifie la stratégie utilisée par une config (heuristique)
   * @param {PlacementConfiguration} config
   * @returns {string} Nom de la stratégie probable
   * @private
   */
  _identifyStrategy(config) {
    if (config.placedFourreaux.length === 0) return 'empty';

    const ratio = config.width / config.height;
    const symmetryScore = config.scoreDetails?.symmetry || 0;

    // Heuristiques simples
    if (symmetryScore > 0.8) return 'centeredSymmetric';
    if (ratio < 0.6) return 'minWidth';
    if (ratio > 1.67) return 'minHeight';
    if (ratio >= 0.8 && ratio <= 1.25) return 'squareShape';
    return 'bottomLeft';
  }
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  // Export Node.js (pour Jest)
  module.exports = {
    PLACEMENT_CONFIG,
    calculateCellSize,
    PlacementConfiguration,
    FourreauSorter,
    ConfigurationGenerator,
    MultiObjectiveScorer,
    PlacementOrchestrator
  };
} else if (typeof window !== 'undefined') {
  // Export navigateur (pour script.js)
  window.PLACEMENT_CONFIG = PLACEMENT_CONFIG;
  window.calculateCellSize = calculateCellSize;
  window.PlacementConfiguration = PlacementConfiguration;
  window.FourreauSorter = FourreauSorter;
  window.ConfigurationGenerator = ConfigurationGenerator;
  window.MultiObjectiveScorer = MultiObjectiveScorer;
  window.PlacementOrchestrator = PlacementOrchestrator;
}

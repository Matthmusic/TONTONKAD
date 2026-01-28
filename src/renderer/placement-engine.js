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

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PLACEMENT_CONFIG,
    calculateCellSize,
    PlacementConfiguration,
    FourreauSorter
  };
}

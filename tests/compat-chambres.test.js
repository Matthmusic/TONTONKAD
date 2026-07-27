// tests/compat-chambres.test.js
const {
  getChamberModels,
  computeCompatibleChambers,
  buildUnitSchema,
  buildTileSchema,
} = require('../src/renderer/compat-chambres.js');

// Jeu de faces à la manière de data/chambres_de_tirage.csv (2 faces / modèle).
const CH = [
  { nom: 'L1T Long-pan', largeur: 520, hauteur: 540 },
  { nom: 'L1T Pignon', largeur: 380, hauteur: 540 },
  { nom: 'L3T Long-pan', largeur: 1380, hauteur: 540 },
  { nom: 'L3T Pignon', largeur: 520, hauteur: 540 },
  { nom: '1/2 L4T Long-pan', largeur: 880, hauteur: 540 },
  { nom: '1/2 L4T Pignon', largeur: 520, hauteur: 540 },
  { nom: 'K1C', largeur: 750, hauteur: 610 }, // face unique (pas de Long-pan/Pignon)
];

const byRef = (models, ref) => models.find((m) => m.ref === ref);

describe('getChamberModels — reconstruction {ref, L, l, H}', () => {
  test('regroupe les 2 faces : L = long-pan (max), l = pignon (min), H = hauteur', () => {
    const m = getChamberModels(CH);
    expect(m).toHaveLength(4);
    expect(byRef(m, 'L1T')).toEqual({ ref: 'L1T', L: 520, l: 380, H: 540 });
    expect(byRef(m, 'L3T')).toEqual({ ref: 'L3T', L: 1380, l: 520, H: 540 });
  });

  test('le suffixe Long-pan/Pignon est retiré du nom de base', () => {
    expect(byRef(getChamberModels(CH), '1/2 L4T')).toEqual({ ref: '1/2 L4T', L: 880, l: 520, H: 540 });
  });

  test('face unique : l retombe sur L', () => {
    expect(byRef(getChamberModels(CH), 'K1C')).toEqual({ ref: 'K1C', L: 750, l: 750, H: 610 });
  });

  test('entrée invalide / vide → []', () => {
    expect(getChamberModels([])).toEqual([]);
    expect(getChamberModels(undefined)).toEqual([]);
    expect(getChamberModels([{ nom: 'X', largeur: 'abc', hauteur: 10 }])).toEqual([]);
  });
});

describe('computeCompatibleChambers — préformées (unit)', () => {
  const models = getChamberModels(CH);

  test('ne garde que les chambres où l >= largeur ET H >= hauteur', () => {
    const { unit, tiling } = computeCompatibleChambers(models, 500, 500, 3);
    const refs = unit.map((u) => u.ref);
    // L1T (l=380) exclue ; L3T, 1/2 L4T, K1C compatibles
    expect(refs).toContain('L3T');
    expect(refs).toContain('1/2 L4T');
    expect(refs).toContain('K1C');
    expect(refs).not.toContain('L1T');
    expect(unit).toHaveLength(3);
    expect(tiling).toEqual([]);
  });

  test('tri par marge croissante : K1C (grosse marge) en dernier', () => {
    const { unit } = computeCompatibleChambers(models, 500, 500, 3);
    expect(unit[unit.length - 1].ref).toBe('K1C');
    // les 2 premières = plus petite marge (L3T / 1/2 L4T, ex æquo)
    expect(unit.slice(0, 2).map((u) => u.ref).sort()).toEqual(['1/2 L4T', 'L3T']);
  });

  test('marges calculées correctement', () => {
    const { unit } = computeCompatibleChambers(models, 500, 500, 3);
    const l3t = unit.find((u) => u.ref === 'L3T');
    expect(l3t).toMatchObject({ l: 520, H: 540, marginW: 20, marginH: 40 });
  });
});

describe('computeCompatibleChambers — repli tampons (tiling)', () => {
  const models = getChamberModels(CH);

  test('aucune préformée (boîte trop haute) → tampons couvrant la largeur', () => {
    const { unit, tiling } = computeCompatibleChambers(models, 1000, 2000, 3);
    expect(unit).toEqual([]);
    // tri par marge : l=520 (N=2, marge 40) devant l=380 (N=3, marge 140) devant l=750 (N=2, marge 500)
    expect(tiling.map((t) => t.l)).toEqual([520, 380, 750]);
    expect(tiling[0]).toMatchObject({ l: 520, N: 2, total: 1040, margin: 40 });
    expect(tiling[0].refs).toEqual(['1/2 L4T', 'L3T']); // réfs partageant l=520, triées
  });

  test('maxN limite le nombre de tampons', () => {
    const { tiling } = computeCompatibleChambers(models, 1000, 2000, 1);
    // toutes les combinaisons demandent N >= 2 → aucune ne passe avec maxN=1
    expect(tiling).toEqual([]);
  });

  test('modèles vides → { unit:[], tiling:[] }', () => {
    expect(computeCompatibleChambers([], 400, 500, 3)).toEqual({ unit: [], tiling: [] });
  });
});

describe('schémas SVG', () => {
  test('buildUnitSchema : SVG avec réf + cotes chambre et boîte', () => {
    const svg = buildUnitSchema(500, 500, { ref: 'L3T', l: 520, H: 540 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('L3T 520×540');
    expect(svg).toContain('boîte 500×500');
  });

  test('buildTileSchema : un <rect> par tampon + libellé boîte', () => {
    const svg = buildTileSchema(1000, { l: 750, N: 2, total: 1500 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('boîte 1000 mm');
    expect((svg.match(/<rect/g) || [])).toHaveLength(2);
  });

  test('sélection nulle → chaîne vide', () => {
    expect(buildUnitSchema(0, 0, null)).toBe('');
    expect(buildTileSchema(0, null)).toBe('');
  });
});

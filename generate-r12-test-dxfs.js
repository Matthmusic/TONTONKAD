/**
 * Generate isolated R12 DXF test files based on the TONTONKAD export format.
 * Each DXF focuses on one feature to spot what breaks AutoCAD.
 */

const fs = require('fs');
const path = require('path');

// Permet d'écrire dans un sous-dossier différent si le dossier courant est verrouillé (DXF_OUT_DIR=r12-fix)
const outSubdir = process.env.DXF_OUT_DIR || 'r12';
const outDir = path.join(__dirname, 'dxf-tests', outSubdir);
fs.mkdirSync(outDir, { recursive: true });

// R12: noms de calques/blocs limités à 31 caractères
function safeName(name, maxLen = 31) {
  return name.length <= maxLen ? name : name.slice(0, maxLen);
}

function headerR12() {
  let dxf = '';
  dxf += '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1009\n';
  dxf += '9\n$INSUNITS\n70\n6\n';
  dxf += '9\n$DIMTXSTY\n7\nSTANDARD\n';
  dxf += '9\n$DIMTXT\n40\n0.1\n';
  dxf += '0\nENDSEC\n';
  return dxf;
}

function tablesR12(layers) {
  let dxf = '';
  dxf += '0\nSECTION\n2\nTABLES\n';
  dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
  dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
  dxf += '0\nENDTAB\n';

  dxf += `0\nTABLE\n2\nLAYER\n70\n${layers.length}\n`;
  layers.forEach((layer) => {
    const color = layer.color ?? 7;
    dxf += '0\nLAYER\n70\n0\n';
    dxf += `2\n${layer.name}\n62\n${color}\n6\nCONTINUOUS\n`;
  });
  dxf += '0\nENDTAB\n';

  dxf += '0\nTABLE\n2\nSTYLE\n70\n1\n';
  dxf += '0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n0.0\n3\ntxt.shx\n4\n\n';
  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';
  return dxf;
}

function modelPaperBlocks() {
  let dxf = '';
  dxf += '0\nBLOCK\n8\n0\n2\n*Model_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Model_Space\n1\n\n0\nENDBLK\n5\n0\n8\n0\n';
  dxf += '0\nBLOCK\n8\n0\n2\n*Paper_Space\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n*Paper_Space\n1\n\n0\nENDBLK\n5\n0\n8\n0\n';
  return dxf;
}

function fourreauBlock(name, outerMm, innerMm) {
  const outerR = (outerMm / 2 / 1000).toFixed(6);
  const innerR = innerMm > 0 ? (innerMm / 2 / 1000).toFixed(6) : null;
  let dxf = '';
  dxf += '0\nBLOCK\n8\n0\n';
  dxf += `2\n${name}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n${name}\n1\n\n`;
  dxf += '0\nCIRCLE\n8\n0\n';
  dxf += `10\n0.0\n20\n0.0\n40\n${outerR}\n`;
  if (innerR) {
    dxf += '0\nCIRCLE\n8\n0\n';
    dxf += `10\n0.0\n20\n0.0\n40\n${innerR}\n`;
  }
  dxf += '0\nENDBLK\n5\n0\n8\n0\n';
  return dxf;
}

function cableBlock(name, diameterMm, text) {
  const r = (diameterMm / 2 / 1000).toFixed(6);
  let dxf = '';
  dxf += '0\nBLOCK\n8\n0\n';
  dxf += `2\n${name}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n${name}\n1\n\n`;
  dxf += '0\nCIRCLE\n8\n0\n';
  dxf += `10\n0.0\n20\n0.0\n40\n${r}\n`;
  if (text) {
    dxf += '0\nTEXT\n8\n0\n7\nSTANDARD\n';
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n40\n0.004\n';
    dxf += `1\n${text}\n50\n0.0\n72\n1\n73\n2\n`;
  }
  dxf += '0\nENDBLK\n5\n0\n8\n0\n';
  return dxf;
}

function blocksSection(customBlocks) {
  let dxf = '';
  dxf += '0\nSECTION\n2\nBLOCKS\n';
  dxf += modelPaperBlocks();
  dxf += customBlocks;
  dxf += '0\nENDSEC\n';
  return dxf;
}

function entitiesSection(content) {
  let dxf = '';
  dxf += '0\nSECTION\n2\nENTITIES\n';
  dxf += content;
  dxf += '0\nENDSEC\n';
  return dxf;
}

function writeDXF(name, layers, blocksContent, entitiesContent) {
  const content = [
    headerR12(),
    tablesR12(layers),
    blocksSection(blocksContent),
    entitiesSection(entitiesContent),
    '0\nEOF\n'
  ].join('');

  const filePath = path.join(outDir, name);
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
  console.log(`> ${name}`);
}

// Test 0: base structure only
writeDXF(
  'r12_00_structure_only.dxf',
  [{ name: '0', color: 7 }],
  '',
  ''
);

// Test 1: bounding box only
(() => {
  const w = 1.000;
  const h = 0.600;
  let entities = '';
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n0.0\n11\n${w}\n21\n0.0\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${w}\n20\n0.0\n11\n${w}\n21\n${h}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${w}\n20\n${h}\n11\n0.0\n21\n${h}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n${h}\n11\n0.0\n21\n0.0\n`;

  writeDXF(
    'r12_01_box_only.dxf',
    [
      { name: '0', color: 7 },
      { name: '_CEAI_BOITE', color: 1 }
    ],
    '',
    entities
  );
})();

// Test 2: fourreau block + insert (double circle)
(() => {
  const blockName = safeName('_CEAI_FOURREAU_TPC_50');
  let entities = '';
  entities += '0\nINSERT\n';
  entities += `8\n${blockName}\n62\n2\n2\n${blockName}\n`;
  entities += '10\n0.500\n20\n0.300\n30\n0.0\n';
  entities += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';

  writeDXF(
    'r12_02_fourreau_block.dxf',
    [
      { name: '0', color: 7 },
      { name: blockName, color: 2 }
    ],
    fourreauBlock(blockName, 50, 37),
    entities
  );
})();

// Test 3: cable block with embedded text + insert
(() => {
  const blockName = safeName('_CEAI_CABLE_U1000_R2V_1x16_STANDARD');
  let entities = '';
  entities += '0\nINSERT\n';
  entities += `8\n${blockName}\n62\n10\n2\n${blockName}\n`;
  entities += '10\n0.350\n20\n0.200\n30\n0.0\n';
  entities += '41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';

  writeDXF(
    'r12_03_cable_block_text.dxf',
    [
      { name: '0', color: 7 },
      { name: blockName, color: 10 }
    ],
    cableBlock(blockName, 10, '1x16'),
    entities
  );
})();

// Test 4: dimensions only on inventory layer
(() => {
  const w = 1.000;
  const h = 0.600;
  const dimBlock = '*D';
  let entities = '';

  // Outline to anchor the dimensions
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n0.0\n11\n${w}\n21\n0.0\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${w}\n20\n0.0\n11\n${w}\n21\n${h}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${w}\n20\n${h}\n11\n0.0\n21\n${h}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n${h}\n11\n0.0\n21\n0.0\n`;

  // Horizontal aligned dimension
  entities += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
  entities += `2\n${dimBlock}\n3\nSTANDARD\n`;
  entities += `10\n${(w / 2).toFixed(6)}\n20\n-0.10\n30\n0.0\n`;
  entities += '70\n0\n140\n0.1\n1\n<>\n';
  entities += `13\n0.0\n23\n0.0\n33\n0.0\n`;
  entities += `14\n${w}\n24\n0.0\n34\n0.0\n`;
  entities += `15\n0.0\n25\n-0.10\n35\n0.0\n`;
  entities += `16\n${w}\n26\n-0.10\n36\n0.0\n`;

  // Vertical dimension
  entities += '0\nDIMENSION\n8\n_CEAI_INVENTAIRE\n';
  entities += `2\n${dimBlock}\n3\nSTANDARD\n`;
  entities += `10\n${(w + 0.10).toFixed(6)}\n20\n${(h / 2).toFixed(6)}\n30\n0.0\n`;
  entities += '70\n1\n140\n0.1\n1\n<>\n';
  entities += `13\n${w}\n23\n0.0\n33\n0.0\n`;
  entities += `14\n${w}\n24\n${h}\n34\n0.0\n`;
  entities += `15\n${(w + 0.10).toFixed(6)}\n25\n0.0\n35\n0.0\n`;
  entities += `16\n${(w + 0.10).toFixed(6)}\n26\n${h}\n36\n0.0\n`;

  writeDXF(
    'r12_04_dimensions_only.dxf',
    [
      { name: '0', color: 7 },
      { name: '_CEAI_BOITE', color: 1 },
      { name: '_CEAI_INVENTAIRE', color: 7 }
    ],
    '',
    entities
  );
})();

// Test 5: inventory text block only (negative X like export)
(() => {
  let entities = '';
  const x = -1.000;
  let y = 0.700;

  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.02\n1\nINVENTAIRE\n7\nSTANDARD\n`;
  y -= 0.03;

  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.015\n1\nTYPE\n7\nSTANDARD\n`;
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${(x + 0.1).toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.015\n1\nCODE\n7\nSTANDARD\n`;
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${(x + 0.2).toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.015\n1\nQTE\n7\nSTANDARD\n`;
  y -= 0.02;

  entities += '0\nLINE\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n11\n${(x + 0.25).toFixed(3)}\n21\n${y.toFixed(3)}\n`;
  y -= 0.02;

  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.012\n1\nTPC\n7\nSTANDARD\n`;
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${(x + 0.1).toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.012\n1\n50\n7\nSTANDARD\n`;
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += `10\n${(x + 0.2).toFixed(3)}\n20\n${y.toFixed(3)}\n40\n0.012\n1\n3\n7\nSTANDARD\n`;

  writeDXF(
    'r12_05_inventory_text_only.dxf',
    [
      { name: '0', color: 7 },
      { name: '_CEAI_INVENTAIRE', color: 7 }
    ],
    '',
    entities
  );
})();

// Test 6: text with DXF escape symbols (%%c / %%d / %%p)
(() => {
  let entities = '';
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += '10\n0.100\n20\n0.100\n40\n0.02\n1\nDiam %%c50/25 mm\n7\nSTANDARD\n';
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += '10\n0.100\n20\n0.060\n40\n0.02\n1\nAngle 45%%d\n7\nSTANDARD\n';
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += '10\n0.100\n20\n0.020\n40\n0.02\n1\nTol %%p0.5\n7\nSTANDARD\n';

  writeDXF(
    'r12_06_special_text_symbols.dxf',
    [
      { name: '0', color: 7 },
      { name: '_CEAI_INVENTAIRE', color: 7 }
    ],
    '',
    entities
  );
})();

// Test 7: minimal stack (box + fourreau + cable + legend)
(() => {
  const boxW = 1.000;
  const boxH = 0.600;
  const fourreauName = safeName('_CEAI_FOURREAU_TPC_50');
  const cableName = safeName('_CEAI_CABLE_U1000_R2V_1x16_STANDARD');

  let blocks = '';
  blocks += fourreauBlock(fourreauName, 50, 37);
  blocks += cableBlock(cableName, 10, '1x16');

  let entities = '';
  // Box
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n0.0\n11\n${boxW}\n21\n0.0\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${boxW}\n20\n0.0\n11\n${boxW}\n21\n${boxH}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n${boxW}\n20\n${boxH}\n11\n0.0\n21\n${boxH}\n`;
  entities += '0\nLINE\n8\n_CEAI_BOITE\n';
  entities += `10\n0.0\n20\n${boxH}\n11\n0.0\n21\n0.0\n`;

  // Fourreau insert
  entities += '0\nINSERT\n';
  entities += `8\n${fourreauName}\n62\n2\n2\n${fourreauName}\n`;
  entities += '10\n0.250\n20\n0.300\n30\n0.0\n41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';

  // Cable insert
  entities += '0\nINSERT\n';
  entities += `8\n${cableName}\n62\n10\n2\n${cableName}\n`;
  entities += '10\n0.750\n20\n0.300\n30\n0.0\n41\n1.0\n42\n1.0\n43\n1.0\n50\n0.0\n';

  // Legend text (no symbols)
  entities += '0\nTEXT\n8\n_CEAI_INVENTAIRE\n';
  entities += '10\n0.050\n20\n0.550\n40\n0.02\n1\nMini stack: 1 fourreau + 1 cable\n7\nSTANDARD\n';

  writeDXF(
    'r12_07_full_minimal_stack.dxf',
    [
      { name: '0', color: 7 },
      { name: '_CEAI_BOITE', color: 1 },
      { name: fourreauName, color: 2 },
      { name: cableName, color: 10 },
      { name: '_CEAI_INVENTAIRE', color: 7 }
    ],
    blocks,
    entities
  );
})();

console.log(`DXF R12 tests generated in ${outDir}`);

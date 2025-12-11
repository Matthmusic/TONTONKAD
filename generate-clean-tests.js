/**
 * Générateur de tests DXF propres avec encodage correct
 * Utilise les codes DXF standards pour les symboles spéciaux
 */

const fs = require('fs');
const path = require('path');

// Fonction pour convertir les symboles en codes DXF
function toDXFText(text) {
    return text
        .replace(/Ø/g, '%%c')  // Symbole diamètre
        .replace(/°/g, '%%d')  // Symbole degré
        .replace(/±/g, '%%p'); // Symbole plus/moins
}

function getBaseStructure() {
    let dxf = '';
    dxf += '0\nSECTION\n2\nHEADER\n';
    dxf += '9\n$ACADVER\n1\nAC1009\n';
    dxf += '9\n$INSUNITS\n70\n6\n';
    dxf += '0\nENDSEC\n';

    dxf += '0\nSECTION\n2\nTABLES\n';
    dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n';
    dxf += '0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nTABLE\n2\nLAYER\n70\n1\n';
    dxf += '0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nTABLE\n2\nSTYLE\n70\n1\n';
    dxf += '0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n0.2\n3\ntxt\n4\n\n';
    dxf += '0\nENDTAB\n';
    dxf += '0\nENDSEC\n';

    return dxf;
}

// TEST COMPLET avec tous les éléments + encodage correct
function generateCleanComplete() {
    let dxf = getBaseStructure();

    // BLOCKS
    dxf += '0\nSECTION\n2\nBLOCKS\n';

    // Bloc FOURREAU_50_25 avec label
    dxf += '0\nBLOCK\n8\n0\n';
    dxf += '2\nFOURREAU_50_25\n70\n0\n';
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '3\nFOURREAU_50_25\n';
    dxf += '0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n25.0\n';
    dxf += '0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n12.5\n';
    // Label avec symbole Ø converti
    dxf += '0\nTEXT\n8\n0\n';
    dxf += '7\nARIAL\n'; // Style de texte Arial
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '40\n2.5\n';
    dxf += '1\n' + toDXFText('Ø50/25mm') + '\n';
    dxf += '72\n1\n73\n2\n'; // Centré
    dxf += '0\nENDBLK\n8\n0\n';

    // Bloc FOURREAU_30 avec label
    dxf += '0\nBLOCK\n8\n0\n';
    dxf += '2\nFOURREAU_30\n70\n0\n';
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '3\nFOURREAU_30\n';
    dxf += '0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n15.0\n';
    // Label
    dxf += '0\nTEXT\n8\n0\n';
    dxf += '7\nARIAL\n'; // Style de texte Arial
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '40\n2.5\n';
    dxf += '1\n' + toDXFText('Ø30mm') + '\n';
    dxf += '72\n1\n73\n2\n';
    dxf += '0\nENDBLK\n8\n0\n';

    // Bloc CABLE avec label
    dxf += '0\nBLOCK\n8\n0\n';
    dxf += '2\nCABLE_5\n70\n0\n';
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '3\nCABLE_5\n';
    dxf += '0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n40\n2.5\n';
    dxf += '0\nTEXT\n8\n0\n';
    dxf += '7\nARIAL\n'; // Style de texte Arial
    dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';
    dxf += '40\n1.5\n';
    dxf += '1\n' + toDXFText('Ø5') + '\n';
    dxf += '72\n1\n73\n2\n';
    dxf += '0\nENDBLK\n8\n0\n';

    dxf += '0\nENDSEC\n';

    // ENTITIES
    dxf += '0\nSECTION\n2\nENTITIES\n';

    // Rectangle de bordure
    const width = 200;
    const height = 150;
    dxf += '0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n11\n' + width + '\n21\n0.0\n31\n0.0\n';
    dxf += '0\nLINE\n8\n0\n10\n' + width + '\n20\n0.0\n30\n0.0\n11\n' + width + '\n21\n' + height + '\n31\n0.0\n';
    dxf += '0\nLINE\n8\n0\n10\n' + width + '\n20\n' + height + '\n30\n0.0\n11\n0.0\n21\n' + height + '\n31\n0.0\n';
    dxf += '0\nLINE\n8\n0\n10\n0.0\n20\n' + height + '\n30\n0.0\n11\n0.0\n21\n0.0\n31\n0.0\n';

    // Titre
    dxf += '0\nTEXT\n8\n0\n';
    dxf += '7\nARIAL\n'; // Style de texte Arial
    dxf += '10\n10.0\n20\n' + (height - 10) + '\n30\n0.0\n';
    dxf += '40\n4.0\n';
    dxf += '1\nTest TONTONKAD - Fourreaux et Cables\n';

    // INSERT de fourreaux
    dxf += '0\nINSERT\n8\n0\n2\nFOURREAU_50_25\n10\n50.0\n20\n75.0\n30\n0.0\n';
    dxf += '0\nINSERT\n8\n0\n2\nFOURREAU_30\n10\n100.0\n20\n75.0\n30\n0.0\n';
    dxf += '0\nINSERT\n8\n0\n2\nFOURREAU_50_25\n10\n150.0\n20\n75.0\n30\n0.0\n';

    // INSERT de câbles
    dxf += '0\nINSERT\n8\n0\n2\nCABLE_5\n10\n30.0\n20\n30.0\n30\n0.0\n';
    dxf += '0\nINSERT\n8\n0\n2\nCABLE_5\n10\n60.0\n20\n30.0\n30\n0.0\n';
    dxf += '0\nINSERT\n8\n0\n2\nCABLE_5\n10\n90.0\n20\n30.0\n30\n0.0\n';

    // Légende avec symboles
    dxf += '0\nTEXT\n8\n0\n';
    dxf += '7\nARIAL\n'; // Style de texte Arial
    dxf += '10\n10.0\n20\n10.0\n30\n0.0\n';
    dxf += '40\n2.5\n';
    dxf += '1\n' + toDXFText('Légende: 3 fourreaux (Ø50/25, Ø30) + 3 câbles (Ø5)') + '\n';

    dxf += '0\nENDSEC\n';
    dxf += '0\nEOF\n';

    return dxf;
}

// Générer le fichier
const dxfContent = generateCleanComplete();
const outputPath = path.join(__dirname, 'test-clean-complete.dxf');

// Écrire avec UTF-8 sans BOM
fs.writeFileSync(outputPath, dxfContent, { encoding: 'utf8' });

console.log('✅ test-clean-complete.dxf généré\n');
console.log('📦 Contenu:');
console.log('  • Rectangle de bordure');
console.log('  • Titre');
console.log('  • 3 blocs (FOURREAU_50_25, FOURREAU_30, CABLE_5)');
console.log('  • Chaque bloc contient cercle(s) + texte avec symbole Ø');
console.log('  • 3 INSERT de fourreaux');
console.log('  • 3 INSERT de câbles');
console.log('  • Légende avec symboles Ø');
console.log('');
console.log('🔤 Encodage:');
console.log('  • Symbole Ø converti en %%c (code DXF standard)');
console.log('  • UTF-8 sans BOM');
console.log('');
console.log('  Taille:', dxfContent.length, 'octets');
console.log('');
console.log('🧪 TESTEZ ce fichier:');
console.log('   • Les labels doivent afficher Ø correctement');
console.log('   • Si ça marche, on applique la même correction à ton code');
console.log('');

// Afficher un échantillon du contenu pour vérification
console.log('📄 Échantillon de texte généré:');
const lines = dxfContent.split('\n');
lines.forEach((line, i) => {
    if (line.includes('%%c')) {
        console.log(`   Ligne ${i + 1}: ${line}`);
    }
});

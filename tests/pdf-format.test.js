// tests/pdf-format.test.js
const { getObjectLabel, getFourreauName, getCableName, truncate } = require('../src/renderer/pdf-format.js');

describe('getObjectLabel — label > customLabel > fallback', () => {
  test('label explicite prioritaire (trimé)', () => {
    expect(getObjectLabel({ label: '  Départ TGBT  ', customLabel: 'X' }, 'F1')).toBe('Départ TGBT');
  });
  test('customLabel si pas de label', () => {
    expect(getObjectLabel({ customLabel: 'Retour' }, 'F1')).toBe('Retour');
  });
  test('fallback si ni label ni customLabel', () => {
    expect(getObjectLabel({}, 'F1')).toBe('F1');
    expect(getObjectLabel(null, 'F1')).toBe('F1');
  });
  test('label vide/espaces → passe au suivant', () => {
    expect(getObjectLabel({ label: '   ', customLabel: 'CL' }, 'F1')).toBe('CL');
    expect(getObjectLabel({ label: '   ' }, 'F1')).toBe('F1');
  });
});

describe('noms par défaut', () => {
  test('getFourreauName → F{numéro}', () => {
    expect(getFourreauName({}, 3)).toBe('F3');
    expect(getFourreauName({ label: 'Spécial' }, 3)).toBe('Spécial');
  });
  test('getCableName → L{index+1}', () => {
    expect(getCableName({}, 0)).toBe('L1');
    expect(getCableName({ customLabel: 'Terre' }, 4)).toBe('Terre');
  });
});

describe('truncate', () => {
  test('texte court inchangé', () => {
    expect(truncate('court', 10)).toBe('court');
  });
  test('texte long tronqué avec ... (points inclus dans la limite)', () => {
    expect(truncate('abcdefghij', 8)).toBe('abcde...');
    expect(truncate('abcdefghij', 8)).toHaveLength(8);
  });
  test('null/undefined → chaîne vide', () => {
    expect(truncate(null, 5)).toBe('');
    expect(truncate(undefined, 5)).toBe('');
  });
  test('valeur non-string convertie', () => {
    expect(truncate(12345, 10)).toBe('12345');
  });
});

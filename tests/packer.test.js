// tests/packer.test.js
const { GEO, cell } = require('../src/renderer/packer.js');

describe('packer — géométrie de base', () => {
  test('GEO défauts', () => {
    expect(GEO.gap).toBe(30);
    expect(GEO.margin).toBe(40);
  });
  test('cell = diamètre + entraxe', () => {
    expect(cell(125)).toBe(155);
    expect(cell(0)).toBe(30);
  });
});

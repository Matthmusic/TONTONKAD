// tests/inventory-agg.test.js
const { countGroups } = require('../src/renderer/inventory-agg.js');

describe('countGroups', () => {
  test('compte les fourreaux par type|code et les câbles par fam|code', () => {
    const { fc, cc } = countGroups(
      [{ type: 'TPC', code: '200' }, { type: 'TPC', code: '200' }, { type: 'TPC', code: '125' }],
      [{ fam: 'U1000', code: '3x2.5' }]
    );
    expect(fc).toEqual({ 'TPC|200': 2, 'TPC|125': 1 });
    expect(cc).toEqual({ 'U1000|3x2.5': 1 });
  });
  test('listes vides → objets vides', () => {
    expect(countGroups([], [])).toEqual({ fc: {}, cc: {} });
  });
});

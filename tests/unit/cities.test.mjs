import assert from 'node:assert/strict';
import test from 'node:test';
import { CITY_FARES } from '../../src/core/city-fares.ts';

const boundaries = [
  ['bj', 3, [6, 12, 22, 32, 52, 72, 92, 112, 132]],
  ['gsh', 2, [4, 8, 12, 18, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128]],
  ['nj', 2, [4, 9, 14, 21, 28, 37, 48, 61, 76, 91, 106, 121]],
  ['cdwh', 2, [4, 8, 12, 18, 24, 32, 40, 50, 70, 90, 110, 130]],
];

for (const [key, base, limits] of boundaries) {
  test(`${key}: each upper distance limit is inclusive`, () => {
    const { fn } = CITY_FARES.find(city => city.key === key);
    assert.equal(fn(1), base);
    for (const [index, limit] of limits.entries()) {
      assert.equal(fn(limit), base + index, `at ${limit} km`);
      assert.equal(fn(limit + 0.001), base + index + 1, `one metre beyond ${limit} km`);
    }
    assert.equal(fn(135), base + limits.length);
  });
}

test('the 16 km comparison keeps both Shanghai fares and the grouped cities in display order', () => {
  assert.deepEqual(CITY_FARES.map(city => [city.short, city.fn(16)]), [
    ['沪老方案', 4], ['沪新价', 6], ['北京', 5], ['穗深杭', 5], ['南京', 5], ['蓉汉', 5],
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { activeFares, fareCurrent, fareFinal, farePlan1, farePlan2 } from '../../src/core/fares.ts';
import { getHearing, setHearing } from '../../src/core/hearing.ts';

const boundaries = [
  [fareCurrent, [[6, 3], [16, 4], [26, 5], [116, 14], [126, 15]]],
  [fareFinal, [[4, 3], [8, 4], [12, 5], [16, 6], [23, 7], [30, 8], [40, 9], [50, 10], [65, 11], [110, 14], [125, 15], [140, 16]]],
  [farePlan1, [[4, 3], [8, 4], [12, 5], [16, 6], [23, 7], [30, 8], [37, 9], [47, 10], [57, 11], [67, 12], [82, 13], [127, 16]]],
  [farePlan2, [[6, 4], [12, 5], [20, 6], [28, 7], [38, 8], [48, 9], [60, 10], [72, 11], [86, 12], [128, 15]]],
];

for (const [fare, limits] of boundaries) {
  test(`${fare.name}: the upper kilometre limit is inclusive`, () => {
    assert.equal(fare(1), limits[0][1]);
    for (const [km, price] of limits) {
      assert.equal(fare(km), price, `at ${km} km`);
      assert.equal(fare(km + 0.001), price + 1, `one metre beyond ${km} km`);
    }
  });
}

test('the hearing toggle adds both proposals after the adopted schemes', context => {
  const original = getHearing();
  context.after(() => setHearing(original));
  setHearing(false);
  assert.deepEqual(activeFares().map(scheme => scheme.key), ['cur', 'final']);
  setHearing(true);
  assert.deepEqual(activeFares().map(scheme => [scheme.key, scheme.fn(50)]), [
    ['cur', 8], ['final', 10], ['p1', 11], ['p2', 10],
  ]);
  setHearing(false);
  assert.deepEqual(activeFares().map(scheme => scheme.key), ['cur', 'final']);
});

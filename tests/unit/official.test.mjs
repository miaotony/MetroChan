import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfficialData } from '../../src/data/official.ts';

const stations = { index: { West: 0, Central: 4, East: 9 } };
const route = {
  p: 5, lt: 'URBAN',
  r: [{ n: 'Standard', opts: [{ name: 'Direct', desc: 'West to East', min: 20, tr: 0 }] }],
};

function fixture(files) {
  const reads = [];
  const data = createOfficialData(async key => {
    reads.push(key);
    if (!Object.hasOwn(files, key)) throw new Error(`Missing ${key}`);
    return files[key];
  });
  return { ...data, reads };
}

test('parallel lookups share the index and lower-ID shard without reversing the stored route', async () => {
  const shortRoute = { ...route, p: 3 };
  const { officialPair, reads } = fixture({
    'stations.json': stations,
    'paths/0.json': { 4: shortRoute, 9: route },
  });
  assert.deepEqual(reads, []);
  const results = await Promise.all([
    officialPair('East', 'West'), officialPair('West', 'East'), officialPair('West', 'Central'),
  ]);
  assert.deepEqual(results, [
    { pair: route, reversed: true }, { pair: route, reversed: false }, { pair: shortRoute, reversed: false },
  ]);
  assert.deepEqual(await officialPair('Central', 'West'), { pair: shortRoute, reversed: true });
  assert.deepEqual(reads, ['stations.json', 'paths/0.json']);
});

test('unknown or identical stations do not request a shard', async () => {
  const { officialPair, reads } = fixture({ 'stations.json': stations });
  for (const [from, to] of [['Missing', 'West'], ['West', 'constructor'], ['East', 'East']]) {
    assert.deepEqual(await officialPair(from, to), { pair: null, reversed: false });
  }
  assert.deepEqual(reads, ['stations.json']);
});

test('an unavailable station index yields cached fallback results', async () => {
  const { officialPair, reads } = fixture({});
  assert.deepEqual(await officialPair('East', 'West'), { pair: null, reversed: false });
  assert.deepEqual(await officialPair('West', 'Central'), { pair: null, reversed: false });
  assert.deepEqual(reads, ['stations.json']);
});

test('a failed shard is cached independently; missing entries also return null', async () => {
  const { officialPair, reads } = fixture({ 'stations.json': stations, 'paths/0.json': { 9: route } });
  assert.deepEqual(await officialPair('East', 'Central'), { pair: null, reversed: true });
  assert.deepEqual(await officialPair('Central', 'East'), { pair: null, reversed: false });
  assert.deepEqual(await officialPair('West', 'Central'), { pair: null, reversed: false });
  assert.deepEqual(await officialPair('West', 'East'), { pair: route, reversed: false });
  assert.deepEqual(reads, ['stations.json', 'paths/4.json', 'paths/0.json']);
});

test('geometry is lazy and shares one read across concurrent and later calls', async () => {
  const geometry = { st: { West: [10, 20] }, base: ['M0,0L10,20'], seg: { 'West|East|1': 'M10,20L30,40' } };
  const { loadGeometry, reads } = fixture({ 'map_geo.json': geometry });
  assert.deepEqual(reads, []);
  assert.deepEqual(await Promise.all([loadGeometry(), loadGeometry()]), [geometry, geometry]);
  assert.deepEqual(await loadGeometry(), geometry);
  assert.deepEqual(reads, ['map_geo.json']);
});

test('missing geometry stays null without blocking official fare lookups', async () => {
  const { loadGeometry, officialPair, reads } = fixture({ 'stations.json': stations, 'paths/0.json': { 9: route } });
  assert.equal(await loadGeometry(), null);
  assert.equal(await loadGeometry(), null);
  assert.deepEqual(await officialPair('West', 'East'), { pair: route, reversed: false });
  assert.deepEqual(reads, ['map_geo.json', 'stations.json', 'paths/0.json']);
});

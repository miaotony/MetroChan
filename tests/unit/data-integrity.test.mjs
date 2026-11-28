import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { decodeRouteBlock } from '../../src/data/route-pack.ts';

const officialData = new URL('../../data/official/', import.meta.url);
const originCount = 417;
const blockSize = 16;

async function readStations() {
  return JSON.parse(await readFile(new URL('stations.json', officialData), 'utf8'));
}

async function readGeometry() {
  const compressed = await readFile(new URL('map.bin', officialData));
  return JSON.parse(gunzipSync(compressed).toString('utf8'));
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const fields = Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${fields.join(',')}}`;
}

function sha256(text) {
  return createHash('sha256').update(text).digest('base64url');
}

async function readBlock(first, stations) {
  const compressed = await readFile(new URL(`routes/${first}.bin`, officialData));
  return decodeRouteBlock(gunzipSync(compressed), stations);
}

test('the complete station dictionary and map geometry match the official JSON', async () => {
  const stations = await readStations();
  const geometry = await readGeometry();
  assert.equal(stations.order.length, 418);
  assert.equal(sha256(canonicalJson(stations)), 'K6Q1QA0d6kAY-_WZ3OcZ_D9k3-4kUFwD4tpPBuW1HIU', 'stations.json');
  assert.equal(sha256(canonicalJson(geometry)), 'MPicInUsvx8DWmT7qSdfItFcHHzkWJigtfQQt3UqWRw', 'map_geo.json');
});

test('a reverse trip has no second stored record; the slower first recommendation stays first', async () => {
  const stations = await readStations();
  const block = await readBlock(80, stations.order);
  assert.equal(block.pair(93, 84), null);
  assert.deepEqual(block.pair(84, 93), {
    p: 4, lt: 'URBAN', r: [{ n: '普通出行', opts: [
      { name: '推荐一', desc: '4号线海伦路至西藏南路。', min: 26, tr: 0 },
      { name: '推荐二', desc: '10号线海伦路至老西门， 换乘8号线至西藏南路。', min: 20, tr: 1 },
    ] }],
  });
});

test('all 87,153 decoded pairs reproduce the 417 legacy shards and the complete dataset fingerprint', async () => {
  const [stations, geometry, fixture] = await Promise.all([
    readStations(), readGeometry(),
    readFile(new URL('./legacy-route-shards.sha256', import.meta.url), 'utf8'),
  ]);
  const expectedHashes = fixture.trimEnd().split(/\r?\n/);
  assert.equal(expectedHashes.length, originCount, 'one SHA-256 per origin, in numeric ID order');
  const dataset = createHash('sha256').update('[').update(canonicalJson(stations))
    .update(',').update(canonicalJson(geometry));
  let pairCount = 0;

  for (let first = 0; first < originCount; first += blockSize) {
    const end = Math.min(first + blockSize, originCount);
    const block = await readBlock(first, stations.order);
    assert.equal(block.first, first, `${first}.bin first origin`);
    assert.equal(block.end, end, `${first}.bin exclusive end`);

    for (let from = first; from < end; from++) {
      const shard = {};
      assert.equal(block.pair(from, from), null, `unexpected self-pair ${from}`);
      for (let to = from + 1; to < stations.order.length; to++) {
        const pair = block.pair(from, to);
        assert.ok(pair, `missing ${from}→${to} in ${first}.bin`);
        shard[to] = pair;
        pairCount++;
      }
      const canonical = canonicalJson(shard);
      assert.equal(sha256(canonical), expectedHashes[from], `paths/${from}.json decoded from ${first}.bin`);
      dataset.update(',').update(canonical);
    }
  }

  assert.equal(pairCount, 87_153);
  assert.equal(dataset.update(']').digest('base64url'), 'bCVSoN3M_vzXm2CmSjwOkJMrV594GYVsXAaHd9EbDXM',
    'SHA-256 of canonical [stations, map_geo, paths/0, …, paths/416]');
});

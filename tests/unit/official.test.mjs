import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createOfficialData } from '../../src/data/official.ts';
import { readData } from '../../src/data/read-data.ts';

const order = Array.from({ length: 19 }, (_, id) => `站${id}`);
const geometry = { st: { 西站: [10, 20] }, base: ['M0,0L10,20'], seg: { '西站|东站|1': 'M10,20L30,40' } };
const jsonBytes = value => Buffer.from(JSON.stringify(value));
const dataUrl = bytes => `data:application/octet-stream;base64,${bytes.toString('base64')}`;

function block(first) {
  const end = Math.min(first + 16, order.length - 1);
  const profileIds = [], fares = [], minutes = [];
  for (let from = first; from < end; from++) {
    for (let to = from + 1; to < order.length; to++) {
      const adjacent = to === from + 1;
      profileIds.push(adjacent ? 1 : 0);
      fares.push(adjacent ? 3 + from : 0);
      if (adjacent) minutes.push(20 + from);
    }
  }
  return { version: 1, first, end, stationCount: order.length, templates: ['\u0001至\u0002'],
    profiles: [['URBAN', ['普通', ['直达', 0, 0]]]], profileIds, fares, minutes };
}

function adjacentResult(from, reversed = false) {
  return { pair: { p: 3 + from, lt: 'URBAN', r: [{ n: '普通', opts: [
    { name: '直达', desc: `${order[from]}至${order[from + 1]}`, min: 20 + from, tr: 0 },
  ] }] }, reversed };
}

function fixture(readRoute = first => jsonBytes(block(first)), readMap = () => jsonBytes(geometry)) {
  const reads = [];
  const data = createOfficialData(order,
    async first => { reads.push(first); return readRoute(first); },
    async () => { reads.push('map'); return readMap(); });
  return { ...data, reads };
}

test('concurrent origins share their 16-row block, even when the next block finishes first', async () => {
  const early = Promise.withResolvers(), late = Promise.withResolvers();
  const { officialPair, reads } = fixture(first => first === 0 ? late.promise : early.promise);
  assert.deepEqual(reads, []);
  const waiting = Promise.all([officialPair('站0', '站1'), officialPair('站16', '站15'), officialPair('站1', '站0')]);
  const last = officialPair('站18', '站17');
  assert.deepEqual(reads, [0, 16]);
  early.resolve(jsonBytes(block(16)));
  assert.deepEqual(await last, adjacentResult(17, true));
  late.resolve(jsonBytes(block(0)));
  assert.deepEqual(await waiting, [adjacentResult(0), adjacentResult(15, true), adjacentResult(0, true)]);
  assert.deepEqual(await officialPair('站16', '站17'), adjacentResult(16));
  assert.deepEqual(await officialPair('站14', '站15'), adjacentResult(14));
  assert.deepEqual(reads, [0, 16]);
});

test('unknown and identical stations skip I/O; a missing pair keeps its direction', async () => {
  const { officialPair, reads } = fixture();
  for (const [from, to] of [['未收录', '站0'], ['站0', 'constructor'], ['站18', '站18']]) {
    assert.deepEqual(await officialPair(from, to), { pair: null, reversed: false });
  }
  assert.deepEqual(reads, []);
  assert.deepEqual(await officialPair('站0', '站18'), { pair: null, reversed: false });
  assert.deepEqual(await officialPair('站18', '站0'), { pair: null, reversed: true });
  assert.deepEqual(reads, [0]);
});

test('unavailable, corrupt and misaddressed blocks fall back without retries or poisoning other blocks', async () => {
  for (const bad of [() => { throw new Error('Missing asset'); }, () => Buffer.from('{'), () => jsonBytes(block(16))]) {
    const { officialPair, reads } = fixture(first => first === 0 ? bad() : jsonBytes(block(first)));
    assert.deepEqual(await officialPair('站1', '站0'), { pair: null, reversed: true });
    assert.deepEqual(await officialPair('站15', '站16'), { pair: null, reversed: false });
    assert.deepEqual(await officialPair('站16', '站17'), adjacentResult(16));
    assert.deepEqual(reads, [0, 16]);
  }
});

test('a bad template only affects the pair that expands it', async () => {
  const packed = block(0);
  packed.profiles.push(['URBAN', ['普通', ['直达', 99, 0]]]);
  packed.profileIds[0] = 2;
  const { officialPair, reads } = fixture(() => jsonBytes(packed));
  assert.deepEqual(await officialPair('站1', '站2'), adjacentResult(1));
  assert.deepEqual(await officialPair('站1', '站0'), { pair: null, reversed: true });
  assert.deepEqual(await officialPair('站15', '站16'), adjacentResult(15));
  assert.deepEqual(reads, [0]);
});

test('inline routes and UTF-8 geometry decompress in memory, with one lazy map promise', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected fetch'));
  const { officialPair, loadGeometry, reads } = fixture(
    first => readData(dataUrl(gzipSync(jsonBytes(block(first))))),
    () => readData(dataUrl(gzipSync(jsonBytes(geometry)))),
  );
  assert.deepEqual(await officialPair('站0', '站1'), adjacentResult(0));
  assert.deepEqual(reads, [0]);
  const pending = loadGeometry();
  assert.strictEqual(loadGeometry(), pending);
  assert.deepEqual(await pending, geometry);
  assert.strictEqual(loadGeometry(), pending);
  assert.deepEqual(reads, [0, 'map']);
  assert.equal(fetch.mock.callCount(), 0);
});

test('gzip, UTF-8 and JSON map failures are cached independently of official routes', async () => {
  for (const bytes of [Buffer.from('not gzip'), gzipSync(Buffer.from([0x22, 0xff, 0x22])), gzipSync('{')]) {
    const { loadGeometry, officialPair, reads } = fixture(undefined, () => readData(dataUrl(bytes)));
    assert.equal(await loadGeometry(), null);
    assert.equal(await loadGeometry(), null);
    assert.deepEqual(await officialPair('站0', '站1'), adjacentResult(0));
    assert.deepEqual(reads, ['map', 0]);
  }
});

test('web assets use their supplied URL and surface HTTP errors', async context => {
  const url = 'https://example.test/nested/assets/map-Abc123.bin';
  const fetch = context.mock.method(globalThis, 'fetch', async address => {
    assert.equal(String(address), url);
    return new Response(gzipSync(jsonBytes(geometry)));
  });
  assert.deepEqual(Buffer.from(await readData(url)), jsonBytes(geometry));
  fetch.mock.mockImplementation(() => new Response(null, { status: 404 }));
  await assert.rejects(readData(url), /HTTP 404/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('file URLs and malformed inline assets never reach fetch', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected fetch'));
  for (const url of ['file:///tmp/map.bin', 'data:text/plain,not-base64', 'data:;base64,%%%']) {
    await assert.rejects(readData(url));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

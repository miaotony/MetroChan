import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { decodeRouteBlock, FROM, ROUTE_BLOCK_SIZE, TO } from '../src/data/route-pack.ts';

const json = async path => JSON.parse(await readFile(path, 'utf8'));

function dictionary() {
  const items = [];
  const ids = new Map();
  return { items, intern(value) {
    const key = JSON.stringify(value);
    if (!ids.has(key)) {
      ids.set(key, items.length);
      items.push(value);
    }
    return ids.get(key);
  } };
}

function encodeRows(stations, first, rows) {
  const templates = dictionary();
  const profiles = dictionary();
  const profileIds = [], fares = [], minutes = [], previous = [];
  for (const [offset, row] of rows.entries()) {
    const from = first + offset;
    for (let to = from + 1; to < stations.length; to++) {
      const route = row[to];
      if (!route) {
        profileIds.push(0);
        fares.push(0);
        continue;
      }
      const last = previous[to] ??= [];
      let option = 0;
      const groups = route.r.map(({ n, opts }) => [n, ...opts.map(({ name, desc, min, tr }) => {
        const pattern = desc.includes(FROM) || desc.includes(TO) ? [desc]
          : desc.replaceAll(stations[from], () => FROM).replaceAll(stations[to], () => TO);
        minutes.push(min - (last[option] ?? 0));
        last[option++] = min;
        return [name, templates.intern(pattern), tr];
      })]);
      profileIds.push(1 + profiles.intern([route.lt, ...groups]));
      fares.push(route.p);
    }
  }
  const packed = { version: 1, first, end: first + rows.length, stationCount: stations.length,
    templates: templates.items, profiles: profiles.items, profileIds, fares, minutes };
  return gzipSync(JSON.stringify(packed), { level: 9 });
}

function unpackRows(bytes, stations, expectedFirst) {
  const { first, end, pair } = decodeRouteBlock(gunzipSync(bytes), stations);
  assert.equal(first, expectedFirst, 'Unexpected route block');
  return Array.from({ length: end - first }, (_, offset) => {
    const from = first + offset;
    const row = {};
    for (let to = from + 1; to < stations.length; to++) {
      const record = pair(from, to);
      if (record) row[to] = record;
    }
    return row;
  });
}

const [mode, stationFile, source, output] = process.argv.slice(2);
if (!['pack', 'unpack'].includes(mode) || !stationFile || !source || !output) {
  throw new Error('Usage: node scripts/official-data.mjs <pack|unpack> <stations.json> <input-dir> <new-output-dir>');
}
const { order, index } = await json(stationFile);
assert.deepEqual(Object.fromEntries(order.map((name, id) => [name, id])), index, 'Station IDs must match the official order');
const rowIds = order.slice(0, -1).map((_, index) => index);
const starts = rowIds.filter(id => id % ROUTE_BLOCK_SIZE === 0);
const expected = mode === 'pack' ? rowIds.map(id => `${id}.json`) : starts.map(id => `${id}.bin`);
assert.deepEqual((await readdir(source)).sort(), expected.sort(), 'Missing or unexpected source files');
await mkdir(output);
for (const first of starts) {
  const ids = rowIds.slice(first, first + ROUTE_BLOCK_SIZE);
  if (mode === 'pack') {
    const rows = await Promise.all(ids.map(id => json(join(source, `${id}.json`))));
    const bytes = encodeRows(order, first, rows);
    assert.deepEqual(unpackRows(bytes, order, first), rows, `Lossy conversion at origin ${first}`);
    await writeFile(join(output, `${first}.bin`), bytes);
  } else {
    const bytes = await readFile(join(source, `${first}.bin`));
    const rows = unpackRows(bytes, order, first);
    for (const [offset, row] of rows.entries()) await writeFile(join(output, `${first + offset}.json`), JSON.stringify(row));
  }
}

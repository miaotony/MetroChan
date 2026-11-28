import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import stations from '../data/official/stations.json' with { type: 'json' };
import { ROUTE_BLOCK_SIZE } from '../src/data/route-pack.ts';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [{ name: entry.name, size: (await stat(path)).size }];
  }));
  return nested.flat();
}

function budget(label, bytes, kibibytes) {
  console.log(`${label}: ${bytes.toLocaleString('en-US')} bytes (limit ${kibibytes} KiB)`);
  assert.ok(bytes > 0 && bytes <= kibibytes * 1024, `${label} is empty or over budget`);
}

const target = process.argv[2] ?? 'all';
assert.ok(['web', 'offline', 'all'].includes(target), 'Expected web, offline or all');
const expected = Array.from({ length: Math.ceil((stations.order.length - 1) / ROUTE_BLOCK_SIZE) },
  (_, index) => `${index * ROUTE_BLOCK_SIZE}.bin`).sort();
assert.deepEqual((await readdir('data/official/routes')).sort(), expected, 'Missing or unexpected route block');
if (target !== 'offline') {
  const assets = await files('dist');
  assert.ok(assets.some(file => file.name === 'index.html'), 'Missing web entry');
  budget('Website', assets.reduce((sum, file) => sum + file.size, 0), 512);
  const blocks = assets.filter(file => /^\d+-[\w-]+\.bin$/.test(file.name));
  assert.deepEqual(blocks.map(file => `${file.name.split('-')[0]}.bin`).sort(), expected, 'Expected all route blocks');
  budget('All route blocks', blocks.reduce((sum, file) => sum + file.size, 0), 145);
  budget('Largest route block', Math.max(...blocks.map(file => file.size)), 12);
}
if (target !== 'web') budget('Offline HTML', (await stat('release/MetroChan-offline.html')).size, 480);

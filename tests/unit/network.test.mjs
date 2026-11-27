import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('network is the effective deployed graph, not the older wiki export', () => {
  const graph = JSON.parse(readFileSync(new URL('../../data/metro_data.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(graph.stations).length, 418);
  assert.equal(graph.edges.length, 497);
  assert.equal(Object.keys(graph.lines).length, 19);
  assert.equal(createHash('sha256').update(JSON.stringify(graph)).digest('hex'),
    '3fed479d0296bd32172250891381e7921c45363c895bafeff7320ce25e817a8c');
});

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { expect, test } from '@playwright/test';

test('every embedded official record and the map match the web deployment', async () => {
  const html = await readFile('release/MetroChan-offline.html', 'utf8');
  const document = parse(html);
  const embedded = new Map<string, string>();
  function visit(node: DefaultTreeAdapterTypes.Node) {
    if ('tagName' in node && node.tagName === 'script') {
      const id = node.attrs.find(attr => attr.name === 'id')?.value;
      if (id?.startsWith('metro-data:')) {
        const text = node.childNodes[0];
        assert.ok(text && 'value' in text);
        assert.ok(!embedded.has(id.slice(11)), `Duplicate data: ${id}`);
        embedded.set(id.slice(11), text.value);
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(document);
  const shards = (await readdir('dist/data/paths')).map(name => `paths/${name}`);
  const files = [...shards, 'map_geo.json', 'stations.json'];
  expect([...embedded.keys()].sort()).toEqual(files.sort());
  let pairs = 0;
  for (const key of files) {
    const reference = JSON.parse(await readFile(`dist/data/${key}`, 'utf8'));
    assert.deepEqual(JSON.parse(embedded.get(key)!), reference, key);
    if (key.startsWith('paths/')) pairs += Object.keys(reference).length;
  }
  expect(pairs).toBe(87153);
});

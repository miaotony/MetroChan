import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from '@playwright/test';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';

async function officialBinaries() {
  const directory = 'data/official/routes';
  const routes = (await readdir(directory)).filter(name => name.endsWith('.bin')).sort();
  const expected = Array.from({ length: 27 }, (_, index) => `${16 * index}.bin`);
  assert.deepEqual(routes, expected.sort(), 'source route blocks must cover origins 0 through 416');
  const sources = new Map<string, Buffer>();
  for (const name of routes) sources.set(name, await readFile(`${directory}/${name}`));
  sources.set('map.bin', await readFile('data/official/map.bin'));
  return sources;
}

test('the website references external hashed binaries identical to the official sources', async () => {
  const sources = await officialBinaries();
  const files = await readdir('dist', { recursive: true });
  assert.ok(!files.includes('data'), 'dist/data must not ship the legacy public data');
  const assets = await readdir('dist/assets');
  const scripts = files.filter(name => name.endsWith('.js'));
  assert.ok(scripts.length, 'no web JavaScript found');
  const code = (await Promise.all(scripts.map(name => readFile(`dist/${name}`, 'utf8')))).join('\n');
  assert.ok(!code.includes('data:application/octet-stream;base64,'), 'web JavaScript inlines binary data');

  const external: string[] = [];
  for (const name of assets.filter(name => name.endsWith('.bin'))) {
    const match = /^(\d+|map)-[\w-]+\.bin$/.exec(name);
    assert.ok(match, `expected a hashed asset name: ${name}`);
    const key = `${match[1]}.bin`;
    const source = sources.get(key);
    assert.ok(source, `unexpected web asset ${name}`);
    assert.ok(source.equals(await readFile(`dist/assets/${name}`)), `${name} differs from ${key}`);
    assert.ok(code.includes(name), `web JavaScript does not reference ${name}`);
    assert.ok(!code.includes(source.toString('base64')), `web JavaScript embeds the bytes of ${key}`);
    external.push(key);
  }
  assert.deepEqual(external.sort(), [...sources.keys()].sort(), 'one external binary per source');
});

function* scriptElements(node: DefaultTreeAdapterTypes.Node): Generator<DefaultTreeAdapterTypes.Element> {
  if ('tagName' in node && node.tagName === 'script') yield node;
  if ('childNodes' in node) for (const child of node.childNodes) yield* scriptElements(child);
}

test('offline JavaScript embeds exactly one byte-identical data URL per official binary', async () => {
  const sources = await officialBinaries();
  const byBase64 = new Map([...sources].map(([key, bytes]) => [bytes.toString('base64'), key]));
  const embedded: string[] = [];
  const document = parse(await readFile('release/MetroChan-offline.html', 'utf8'));
  for (const script of scriptElements(document)) {
    const attrs = new Map(script.attrs.map(attr => [attr.name, attr.value]));
    const type = (attrs.get('type') ?? '').toLowerCase();
    assert.ok(!attrs.get('id')?.startsWith('metro-data:'), 'legacy metro-data script in offline HTML');
    assert.notEqual(type, 'application/json', 'unexpected standalone JSON script in offline HTML');
    if (attrs.has('src') || !['', 'module', 'application/javascript', 'text/javascript'].includes(type)) continue;
    const code = script.childNodes.map(child => 'value' in child ? child.value : '').join('');
    for (const match of code.matchAll(/(["'`])data:application\/octet-stream;base64,([^"'`]*)\1/g)) {
      const key = byBase64.get(match[2]);
      assert.ok(key, 'offline binary does not match any official source byte-for-byte');
      embedded.push(key);
    }
  }
  assert.deepEqual(embedded.sort(), [...sources.keys()].sort(), 'one inline binary per source, without duplicates');
});

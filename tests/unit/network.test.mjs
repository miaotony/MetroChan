import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build, normalizePath } from 'vite';
import graph from '../../data/metro_data.json' with { type: 'json' };
import official from '../../data/official/stations.json' with { type: 'json' };
import { networkDefines, packNetwork } from '../../scripts/network-build.ts';
import { unpackNetwork } from '../../src/data/network-codec.ts';
import { METRO_DATA } from '../../src/data/network.ts';

const expected = JSON.stringify(graph);
const path = relative => fileURLToPath(new URL(relative, import.meta.url));

test('network is the effective deployed graph, not the older wiki export', () => {
  assert.strictEqual(METRO_DATA, graph, 'direct Node imports use the source object');
  assert.equal(Object.keys(graph.stations).length, 418);
  assert.equal(graph.edges.length, 497);
  assert.equal(Object.keys(graph.lines).length, 19);
  assert.equal(createHash('sha256').update(expected).digest('hex'),
    '3fed479d0296bd32172250891381e7921c45363c895bafeff7320ce25e817a8c');
});

test('the build define restores the exact graph without borrowing official station IDs', () => {
  const packed = JSON.parse(networkDefines().__PACKED_NETWORK__);
  const restored = unpackNetwork(packed);
  assert.equal(JSON.stringify(restored), expected);
  assert.ok(Buffer.byteLength(packed) < Buffer.byteLength(expected) / 2);
  assert.ok(official.order.some(name => !Object.hasOwn(restored.stations, name)));
  assert.ok(Object.keys(restored.stations).some(name => !Object.hasOwn(official.index, name)));
});

test('packing refuses to drop pinyin entries, fields or enumeration order', () => {
  const [first, ...rest] = Object.entries(graph.py);
  assert.throws(() => packNetwork({ ...graph, py: Object.fromEntries(rest) }), /expected py\[/);
  assert.throws(() => packNetwork({ ...graph, py: { ...graph.py, [first[0]]: [...first[1], 'alias'] } }), /expected py\[/);
  assert.throws(() => packNetwork({ ...graph, py: Object.fromEntries([...rest, first]) }), /py differ/);
  assert.throws(() => packNetwork({ ...graph, edges: [{ ...graph.edges[0], express: true }] }), /edges differ/);
  assert.throws(() => packNetwork({ ...graph, extra: [] }), /top-level keys differ/);
});

test('packing rejects unknown station and line references', () => {
  assert.throws(() => packNetwork({ ...graph, edges: [{ ...graph.edges[0], b: 'unknown' }] }), /unknown station "unknown"/);
  assert.throws(() => packNetwork({ ...graph, edges: [{ ...graph.edges[0], l: 'unknown' }] }), /unknown line "unknown"/);
});

test('the standalone production module synchronously restores the full source graph', async () => {
  const { output } = await build({
    root: path('../../'), logLevel: 'silent',
    build: { write: false, rollupOptions: { input: path('../../src/data/network.ts'), preserveEntrySignatures: 'strict' } },
  });
  assert.equal(output.length, 1);
  const [chunk] = output;
  assert.equal(chunk.type, 'chunk');
  assert.deepEqual(chunk.imports, []);
  assert.deepEqual(chunk.dynamicImports, []);
  const bundled = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  assert.equal(JSON.stringify(bundled.METRO_DATA), expected);
});

test('the full web build includes the network without shipping the source JSON module', async () => {
  const { output } = await build({ root: path('../../'), logLevel: 'silent', build: { write: false } });
  const chunks = output.filter(item => item.type === 'chunk');
  const network = normalizePath(path('../../src/data/network.ts'));
  const raw = normalizePath(path('../../data/metro_data.json'));
  assert.ok(chunks.some(chunk => chunk.modules[network]?.renderedLength > 0));
  for (const chunk of chunks) assert.equal(chunk.modules[raw]?.renderedLength ?? 0, 0, chunk.fileName);
});

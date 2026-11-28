import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { decodeRouteBlock } from '../../src/data/route-pack.ts';

test('pack and unpack preserve unusual names, literal placeholders, option order and holes', async context => {
  const temp = await mkdtemp(join(tmpdir(), 'metrochan-codec-'));
  context.after(() => rm(temp, { recursive: true, force: true }));
  const order = ['新站', '新站东', '$&', '南'];
  const stations = join(temp, 'stations.json');
  await writeFile(stations, JSON.stringify({ order, index: Object.fromEntries(order.map((name, id) => [name, id])) }));
  const input = join(temp, 'input'), packed = join(temp, 'blocks'), restored = join(temp, 'restored');
  await mkdir(input);
  const route = desc => ({ p: 12, lt: 'OTHER', r: [{ n: '新类型', opts: [
    { name: '较慢', desc, min: 315, tr: 2 }, { name: '较快', desc: '\u0001南\u0002', min: 210, tr: 3 },
  ] }] });
  const rows = [{ 1: route('新站至新站东，原路至新站。'), 2: route('$& 从新站到 $&') }, {}, { 3: route('未知格式') }];
  for (const [id, row] of rows.entries()) await writeFile(join(input, `${id}.json`), JSON.stringify(row));
  const convert = (mode, source, target) => execFileSync(process.execPath, ['scripts/official-data.mjs', mode, stations, source, target]);
  convert('pack', input, packed);
  convert('unpack', packed, restored);
  for (const [id, row] of rows.entries()) assert.deepEqual(JSON.parse(await readFile(join(restored, `${id}.json`))), row);

  const bytes = gunzipSync(await readFile(join(packed, '0.bin')));
  assert.throws(() => decodeRouteBlock(bytes, []), /header/);
  const invalid = JSON.parse(bytes);
  invalid.minutes.pop();
  assert.throws(() => decodeRouteBlock(Buffer.from(JSON.stringify(invalid)), order), /minutes/);
});

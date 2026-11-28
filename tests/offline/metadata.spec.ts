import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from '@playwright/test';
import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { PNG } from 'pngjs';

const homepage = 'https://metrochan.miaotony.xyz/';
const imageUrl = new URL('og.png', homepage).href;

function elements(parent: DefaultTreeAdapterTypes.ParentNode) {
  return parent.childNodes.filter(child => 'tagName' in child);
}

async function readMetadata(file: string) {
  const document = parse(await readFile(file, 'utf8'), { scriptingEnabled: false });
  const html = elements(document).find(node => node.tagName === 'html');
  const head = html && elements(html).find(node => node.tagName === 'head');
  assert.ok(head, `${file}: missing head`);
  const fields: Record<string, string> = {};
  function add(key: string, value: string) {
    assert.ok(value?.trim(), `${file}: empty ${key}`);
    assert.ok(!Object.hasOwn(fields, key), `${file}: duplicate ${key}`);
    fields[key] = value;
  }
  for (const node of elements(head)) {
    const { name, property, content, rel, href } = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
    if (node.tagName === 'title') add('title', node.childNodes.map(child => 'value' in child ? child.value : '').join(''));
    if (node.tagName === 'link' && ['canonical', 'image_src'].includes(rel)) add(rel, href);
    if (node.tagName === 'meta' && property?.startsWith('og:')) add(property, content);
    if (node.tagName === 'meta' && (name?.startsWith('twitter:') || name === 'description' || name === 'keywords')) add(name, content);
  }
  return fields;
}

test('static search and share cards agree on fares, effective date, features and preview', async () => {
  const fields = await readMetadata('index.html');
  for (const term of ['上海地铁', '票价', 'MetroChan', '魔都地铁酱']) assert.ok(fields.title.includes(term), term);
  for (const term of ['2005年老方案', '2026年12月1日生效的新票价', '按站查询', '换乘', '通勤', '八城', '听证方案均未采纳']) {
    assert.ok(fields.description.includes(term), `description: missing ${term}`);
  }
  for (const term of ['上海地铁票价', '查询', '换乘', '通勤', '八城']) assert.ok(fields.keywords.includes(term), `keywords: missing ${term}`);
  const alt = fields['og:image:alt'];
  for (const detail of [/起步价.*3元/, /6公里.*4公里/, /九折|9折/, /70元.*90元/]) assert.match(alt, detail);
  for (const [key, expected] of Object.entries({
    canonical: homepage, 'og:url': homepage, 'og:type': 'website', 'og:locale': 'zh_CN',
    'og:site_name': 'MetroChan · 魔都地铁酱', 'twitter:card': 'summary_large_image',
    'og:title': fields.title, 'twitter:title': fields.title,
    'og:description': fields.description, 'twitter:description': fields.description,
    'og:image': imageUrl, 'twitter:image': imageUrl, image_src: imageUrl,
    'og:image:type': 'image/png', 'twitter:image:alt': alt,
  })) assert.equal(fields[key], expected, key);
});

for (const file of ['dist/index.html', 'release/MetroChan-offline.html']) {
  test(`${file} ships the same crawler-visible metadata as the source head`, async () => {
    assert.deepEqual(await readMetadata(file), await readMetadata('index.html'));
  });
}

test('the published preview is the original PNG at the advertised size', async () => {
  const published = await readFile('dist/og.png');
  assert.ok(published.equals(await readFile('public/og.png')), 'dist/og.png differs from public/og.png');
  const { width, height } = PNG.sync.read(published);
  const fields = await readMetadata('dist/index.html');
  assert.equal(fields['og:image:width'], String(width));
  assert.equal(fields['og:image:height'], String(height));
});

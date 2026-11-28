import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from 'parse5';
import { build } from 'vite';
import { networkDefines } from './network-build.ts';

const root = new URL('../', import.meta.url);
const read = (name, encoding) => readFile(new URL(name, root), encoding);
const page = parse(await read('index.html', 'utf8'));
const elements = [];
function walk(node) {
  if (node.tagName) elements.push(node);
  for (const child of node.childNodes ?? []) walk(child);
}
walk(page);

function append(parent, tagName, attributes, text) {
  const node = { nodeName: tagName, tagName, namespaceURI: parent.namespaceURI, attrs: [], childNodes: [], parentNode: parent };
  node.attrs = Object.entries(attributes).map(([name, value]) => ({ name, value }));
  if (text !== undefined) node.childNodes.push({ nodeName: '#text', value: text, parentNode: node });
  parent.childNodes.push(node);
}

const scripts = elements.filter(node => node.tagName === 'script');
assert.equal(scripts.length, 1, 'Expected one application entry');
const entry = scripts[0];
const entryPath = entry.attrs.find(attr => attr.name === 'src')?.value;
assert.equal(entryPath, '/src/main.ts');
entry.parentNode.childNodes = entry.parentNode.childNodes.filter(node => node !== entry);

const bundles = await build({
  root: fileURLToPath(root),
  configFile: false,
  publicDir: false,
  define: networkDefines(),
  build: {
    write: false, target: 'es2022', modulePreload: false, cssCodeSplit: false,
    lib: { entry: fileURLToPath(new URL(`.${entryPath}`, root)), name: 'MetroChan', formats: ['iife'] },
  },
});
const output = (Array.isArray(bundles) ? bundles : [bundles]).flatMap(bundle => bundle.output);
const js = output.find(item => item.type === 'chunk' && item.isEntry);
const css = output.find(item => item.type === 'asset' && item.fileName.endsWith('.css'));
assert.ok(js && css && output.length === 2 && !js.imports.length && !js.dynamicImports.length, 'Offline build must contain only standalone JS and CSS');

const head = elements.find(node => node.tagName === 'head');
const body = elements.find(node => node.tagName === 'body');
append(head, 'meta', { name: 'metrochan-offline', content: 'true' });
append(head, 'style', {}, String(css.source));

const publicRoot = fileURLToPath(new URL('public', root));
const imageTypes = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const images = elements.filter(node => node.tagName === 'img');
const firstImage = new Map();
const copies = [];
for (const node of elements) {
  const rel = node.attrs.find(attr => attr.name === 'rel')?.value;
  const key = node.tagName === 'img' ? 'src' : node.tagName === 'link' && ['icon', 'apple-touch-icon'].includes(rel) ? 'href' : null;
  const attr = node.attrs.find(attr => attr.name === key);
  if (!attr) continue;
  const file = resolve(publicRoot, attr.value);
  assert.ok(file.startsWith(publicRoot + sep) && imageTypes[extname(file)], `Unsupported offline image: ${attr.value}`);
  if (node.tagName === 'img') {
    const index = images.indexOf(node);
    if (firstImage.has(file)) {
      node.attrs = node.attrs.filter(attribute => attribute !== attr);
      copies.push(`document.images[${index}].src=document.images[${firstImage.get(file)}].src;`);
      continue;
    }
    firstImage.set(file, index);
  }
  attr.value = `data:${imageTypes[extname(file)]};base64,${(await readFile(file)).toString('base64')}`;
}

append(body, 'script', {}, copies.join('') + js.code.replace(/<\/script/gi, '<\\/script'));
const target = new URL('../release/', import.meta.url);
await mkdir(target, { recursive: true });
const html = serialize(page);
await writeFile(new URL('MetroChan-offline.html', target), html);
console.log(`release/MetroChan-offline.html (${Buffer.byteLength(html).toLocaleString('en-US')} bytes)`);

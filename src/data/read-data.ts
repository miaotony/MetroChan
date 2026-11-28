async function compressedStream(url: string) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) throw new Error('Expected a base64 asset');
    const bytes = Uint8Array.from(atob(url.slice(comma + 1)), char => char.charCodeAt(0));
    return new Blob([bytes]).stream();
  }

  const asset = new URL(url, globalThis.document?.baseURI);
  if (asset.protocol !== 'https:' && asset.protocol !== 'http:') throw new Error('Expected an HTTP(S) asset');
  const response = await fetch(asset, { cache: 'force-cache' });
  if (!response.ok || !response.body) throw new Error(`Could not load ${asset}: HTTP ${response.status}`);
  return response.body;
}

export async function readData(url: string): Promise<Uint8Array> {
  const stream = await compressedStream(url);
  const bytes = await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new Uint8Array(bytes);
}

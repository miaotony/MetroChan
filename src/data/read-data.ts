export async function readData<T>(key: string): Promise<T> {
  if (document.querySelector('meta[name="metrochan-offline"]')) {
    const embedded = document.getElementById(`metro-data:${key}`);
    if (!embedded?.textContent) throw new Error(`Missing embedded data: ${key}`);
    return JSON.parse(embedded.textContent) as T;
  }
  const url = new URL(`data/${key}`, document.baseURI);
  if (key === 'map_geo.json') url.searchParams.set('v', '2');
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Could not load ${key}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

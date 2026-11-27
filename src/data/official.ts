import { readData } from './read-data.ts';

export interface MapGeometry {
  st: Record<string, [number, number]>;
  base: string[];
  seg: Record<string, string>;
}

export interface OfficialPair {
  p: number;
  lt: string;
  r: { n: string; opts: { name: string; desc: string; min: number; tr: number }[] }[];
}

type StationFile = { index: Record<string, number> };
type Shard = Record<number, OfficialPair>;

export function createOfficialData(loader = readData) {
  let stations: Promise<StationFile | null> | undefined;
  let geometry: Promise<MapGeometry | null> | undefined;
  const shards = new Map<number, Promise<Shard | null>>();

  async function load<T>(key: string): Promise<T | null> {
    try {
      return await loader<T>(key);
    } catch {
      return null;
    }
  }

  function loadGeometry(): Promise<MapGeometry | null> {
    return geometry ??= load<MapGeometry>('map_geo.json');
  }

  async function officialPair(from: string, to: string): Promise<{ pair: OfficialPair | null; reversed: boolean }> {
    stations ??= load<StationFile>('stations.json');
    const index = (await stations)?.index;
    const fromId = index?.[from];
    const toId = index?.[to];
    if (typeof fromId !== 'number' || typeof toId !== 'number' || fromId === toId) {
      return { pair: null, reversed: false };
    }

    const lower = Math.min(fromId, toId);
    const upper = Math.max(fromId, toId);
    let shard = shards.get(lower);
    if (!shard) {
      shard = load<Shard>(`paths/${lower}.json`);
      shards.set(lower, shard);
    }
    return { pair: (await shard)?.[upper] ?? null, reversed: fromId > toId };
  }

  return { officialPair, loadGeometry };
}

export const { officialPair, loadGeometry } = createOfficialData();

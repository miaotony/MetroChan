import { decodeRouteBlock, ROUTE_BLOCK_SIZE } from './route-pack.ts';

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

export function createOfficialData(
  order: readonly string[],
  readRoute: (first: number) => Promise<Uint8Array>,
  readMap: () => Promise<Uint8Array>,
) {
  const index = new Map(order.map((name, id) => [name, id]));
  const blocks = new Map<number, ReturnType<typeof loadBlock>>();
  let geometry: Promise<MapGeometry | null> | undefined;

  async function loadBlock(first: number) {
    const block = decodeRouteBlock(await readRoute(first), order);
    return block.first === first ? block : null;
  }

  async function readGeometry(): Promise<MapGeometry> {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(await readMap());
    return JSON.parse(json);
  }

  function loadGeometry(): Promise<MapGeometry | null> {
    return geometry ??= readGeometry().catch(() => null);
  }

  async function officialPair(from: string, to: string): Promise<{ pair: OfficialPair | null; reversed: boolean }> {
    const fromId = index.get(from);
    const toId = index.get(to);
    if (fromId === undefined || toId === undefined || fromId === toId) {
      return { pair: null, reversed: false };
    }

    const lower = Math.min(fromId, toId);
    const upper = Math.max(fromId, toId);
    const first = lower - lower % ROUTE_BLOCK_SIZE;
    const reversed = fromId > toId;
    let pending = blocks.get(first);
    if (!pending) {
      pending = loadBlock(first);
      blocks.set(first, pending);
    }
    try {
      return { pair: (await pending)?.pair(lower, upper) ?? null, reversed };
    } catch {
      return { pair: null, reversed };
    }
  }

  return { officialPair, loadGeometry };
}

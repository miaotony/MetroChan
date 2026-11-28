import { LINE_COLORS } from '../data/lines.ts';
import { METRO_DATA } from '../data/network.ts';

export interface Segment {
  line: string;
  from: string;
  to: string;
  walk?: boolean;
}

export const graph: Record<string, Record<string, { l: string; d: number }>> = {};
for (const edge of METRO_DATA.edges) {
  (graph[edge.a] ??= {})[edge.b] = { d: edge.d, l: edge.l };
  (graph[edge.b] ??= {})[edge.a] = { d: edge.d, l: edge.l };
}

export function dijkstra(src: string): { dist: Record<string, number>; prev: Record<string, string | undefined> } {
  const dist: Record<string, number> = { [src]: 0 };
  const prev: Record<string, string | undefined> = {};
  const queue: [distance: number, station: string][] = [[0, src]];
  while (queue.length) {
    queue.sort(([left], [right]) => left - right);
    const [distance, station] = queue.shift()!;
    if (distance > dist[station]) continue;
    const neighbors = graph[station] ?? {};
    for (const neighbor in neighbors) {
      const next = distance + neighbors[neighbor].d;
      if (next < (dist[neighbor] ?? Infinity)) {
        dist[neighbor] = next;
        prev[neighbor] = station;
        queue.push([next, neighbor]);
      }
    }
  }
  return { dist, prev };
}

export function parseOfficialPath(desc?: string | null): Segment[] {
  const segments: Segment[] = [];
  let previousTo = '';
  for (const raw of String(desc || '').replace(/[。\s]+$/, '').split(/[，,]/)) {
    const text = raw.trim();
    const walk = /^出站换乘/.test(text);
    const match = text.replace(/^(出站)?换乘/, '').match(/^(.+?线)(.*?)至(.+)$/);
    if (!match) continue;
    const from = (match[2] || previousTo).trim();
    const to = match[3].trim();
    if (!to) continue;
    segments.push({ line: match[1].trim(), from, to, walk });
    previousTo = to;
  }
  return segments;
}

const lineAdjCache = new Map<string, Record<string, string[]>>();

function lineAdj(line: string): Record<string, string[]> {
  const cached = lineAdjCache.get(line);
  if (cached) return cached;

  const neighbors: Record<string, string[]> = {};
  function add(from: string, to: string): void {
    if (!from || !to || from === to) return;
    (neighbors[from] ??= []).push(to);
    (neighbors[to] ??= []).push(from);
  }
  for (const edge of METRO_DATA.edges) {
    if (edge.l === line) add(edge.a, edge.b);
  }
  const sequence = METRO_DATA.lines[line] ?? [];
  for (let index = 0; index < sequence.length - 1; index++) {
    const from = sequence[index], to = sequence[index + 1];
    if (graph[from]?.[to]) add(from, to);
  }
  if (line === '4号线' && sequence.length > 2) add(sequence[0], sequence[sequence.length - 1]);
  lineAdjCache.set(line, neighbors);
  return neighbors;
}

export function lineSlice(line: string, from: string, to: string): string[] {
  if (!from || !to) return [];
  if (from === to) return [from];

  const neighbors = lineAdj(line);
  if (neighbors[from] && neighbors[to]) {
    const prev: Record<string, string> = {};
    const seen = new Set([from]);
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const station = queue[head];
      if (station === to) {
        const path = [to];
        for (let current = to; current !== from; current = prev[current]) path.push(prev[current]);
        return path.reverse();
      }
      for (const neighbor of neighbors[station]) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        prev[neighbor] = station;
        queue.push(neighbor);
      }
    }
  }

  const sequence = METRO_DATA.lines[line];
  if (!sequence) return [];
  const start = sequence.indexOf(from), end = sequence.indexOf(to);
  if (start < 0 || end < 0) return [];
  return start <= end ? sequence.slice(start, end + 1) : sequence.slice(end, start + 1).reverse();
}

export function lineColor(line: string): string {
  return LINE_COLORS[line] || (METRO_DATA.lines[line] ? '#8a8a8a' : '#b0b0b0');
}

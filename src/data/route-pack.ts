import type { OfficialPair } from './official.ts';

export const ROUTE_BLOCK_SIZE = 16;
export const FROM = '\u0001';
export const TO = '\u0002';

type Option = [name: string, template: number, transfers: number];
type Group = [name: string, ...options: Option[]];
type Profile = [lineType: string, ...groups: Group[]];

interface PackedRoutes {
  version: number;
  first: number;
  end: number;
  stationCount: number;
  templates: (string | [string])[];
  profiles: Profile[];
  profileIds: number[];
  fares: number[];
  minutes: number[];
}

export function decodeRouteBlock(bytes: Uint8Array, stations: readonly string[]) {
  const pack: PackedRoutes = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const { version, first, end, stationCount, templates, profiles, profileIds, fares, minutes } = pack;
  if (version !== 1 || stationCount !== stations.length || !Number.isInteger(first) || first < 0 ||
      first % ROUTE_BLOCK_SIZE !== 0 || end !== Math.min(first + ROUTE_BLOCK_SIZE, stationCount - 1) || first >= end) {
    throw new Error('Invalid official route block header');
  }
  const optionCounts = profiles.map(([, ...groups]) => groups.reduce((count, group) => count + group.length - 1, 0));
  const rowStarts: number[] = [];
  const minuteStarts = new Uint32Array(profileIds.length);
  const previous: number[][] = [];
  let cell = 0;
  let minute = 0;
  for (let from = first; from < end; from++) {
    rowStarts.push(cell);
    for (let to = from + 1; to < stationCount; to++, cell++) {
      const id = profileIds[cell];
      if (id === 0) continue;
      if (!Number.isInteger(id) || id < 1 || id > profiles.length) throw new Error('Invalid route profile');
      minuteStarts[cell] = minute;
      const last = previous[to] ??= [];
      for (let option = 0; option < optionCounts[id - 1]; option++, minute++) {
        if (!Number.isSafeInteger(minutes[minute])) throw new Error('Invalid route minutes');
        last[option] = minutes[minute] += last[option] ?? 0;
      }
    }
  }
  if (cell !== profileIds.length || cell !== fares.length || minute !== minutes.length) throw new Error('Invalid route columns');

  function pair(from: number, to: number): OfficialPair | null {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < first || from >= end || to <= from || to >= stationCount) return null;
    const cell = rowStarts[from - first] + to - from - 1;
    const id = profileIds[cell];
    if (!id) return null;
    let minute = minuteStarts[cell];
    const [lt, ...groups] = profiles[id - 1];
    return { p: fares[cell], lt, r: groups.map(([n, ...options]) => ({
      n, opts: options.map(([name, template, tr]) => {
        const pattern = templates[template];
        const desc = typeof pattern === 'string'
          ? pattern.replace(/[\u0001\u0002]/g, token => stations[token === FROM ? from : to]) : pattern[0];
        return { name, desc, min: minutes[minute++], tr };
      }),
    })) };
  }
  return { first, end, pair };
}

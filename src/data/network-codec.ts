export interface Network {
  stations: Record<string, string[]>;
  edges: { a: string; b: string; d: number; l: string }[];
  lines: Record<string, string[]>;
  py: Record<string, string[]>;
}

export interface PackedNetwork {
  stations: [name: string, pinyin: string, initials: string, ...lineIds: number[]][];
  edges: [from: number, to: number, distance: number, line: number][];
  lines: [name: string, ...stationIds: number[]][];
}

export function unpackNetwork(json: string): Network {
  const { stations, edges, lines }: PackedNetwork = JSON.parse(json);
  const stationName = (id: number) => stations[id][0];
  const lineName = (id: number) => lines[id][0];
  return {
    stations: Object.fromEntries(stations.map(([name, , , ...ids]) => [name, ids.map(lineName)])),
    edges: edges.map(([from, to, distance, line]) => ({
      a: stationName(from), b: stationName(to), d: distance, l: lineName(line),
    })),
    lines: Object.fromEntries(lines.map(([name, ...ids]) => [name, ids.map(stationName)])),
    py: Object.fromEntries(stations.map(([name, pinyin, initials]) => [name, [pinyin, initials]])),
  };
}

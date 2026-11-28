import { readFileSync } from 'node:fs';
import { unpackNetwork, type Network, type PackedNetwork } from '../src/data/network-codec.ts';

function indexNames(names: string[], kind: string) {
  const ids = new Map(names.map((name, id) => [name, id]));
  return (name: string) => {
    const id = ids.get(name);
    if (id === undefined) throw new Error(`Cannot pack metro_data.json: unknown ${kind} ${JSON.stringify(name)}`);
    return id;
  };
}

export function packNetwork(network: Network): string {
  const stations = Object.keys(network.stations), lines = Object.keys(network.lines);
  const stationId = indexNames(stations, 'station'), lineId = indexNames(lines, 'line');
  const packed: PackedNetwork = {
    stations: stations.map(name => {
      const pair = network.py?.[name];
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(value => typeof value === 'string')) {
        throw new Error(`Cannot pack metro_data.json: expected py[${JSON.stringify(name)}] to be [pinyin, initials]`);
      }
      return [name, pair[0], pair[1], ...network.stations[name].map(lineId)];
    }),
    edges: network.edges.map(({ a, b, d, l }) => [stationId(a), stationId(b), d, lineId(l)]),
    lines: lines.map(name => [name, ...network.lines[name].map(stationId)]),
  };

  const json = JSON.stringify(packed);
  const restored = unpackNetwork(json);
  if (JSON.stringify(restored) !== JSON.stringify(network)) {
    const keys = Object.keys(restored) as (keyof Network)[];
    const field = keys.find(key => JSON.stringify(restored[key]) !== JSON.stringify(network[key]));
    throw new Error(`Cannot losslessly pack metro_data.json: ${field ?? 'top-level keys'} differ in contents or order`);
  }
  return json;
}

export function networkDefines() {
  const source = readFileSync(new URL('../data/metro_data.json', import.meta.url), 'utf8');
  return { __PACKED_NETWORK__: JSON.stringify(packNetwork(JSON.parse(source))) };
}

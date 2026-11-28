import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import stations from "../../data/official/stations.json" with { type: "json" };
import {
  dijkstra,
  lineSlice,
  parseOfficialPath,
} from "../../src/core/route.ts";
import { createOfficialData } from "../../src/data/official.ts";

const from = "莘庄";
const to = "陆家嘴";
const official = new URL("../../data/official/", import.meta.url);
const inflate = async (file: string) =>
  gunzipSync(await readFile(new URL(file, official)));
const { officialPair, loadGeometry } = createOfficialData(
  stations.order,
  (first) => inflate(`routes/${first}.bin`),
  () => inflate("map.bin"),
);

const [{ pair, reversed }, map] = await Promise.all([
  officialPair(from, to),
  loadGeometry(),
]);
const option = pair?.r[0]?.opts[0];
if (!pair || !option?.desc || !map) {
  throw new Error(`Missing official route or map for ${from} → ${to}`);
}
const segments = parseOfficialPath(option.desc);
const directed = reversed
  ? segments
      .reverse()
      .map((leg) => ({ line: leg.line, from: leg.to, to: leg.from }))
  : segments;
const legs = directed.map(({ line, from, to }) => ({
  line,
  from,
  to,
  stations: lineSlice(line, from, to),
}));
const km = dijkstra(from).dist[to] / 1000;
if (
  !Number.isFinite(km) ||
  legs[0]?.from !== from ||
  legs.at(-1)?.to !== to ||
  legs.some(
    (leg) =>
      leg.stations.length < 2 || leg.stations.some((name) => !map.st[name]),
  )
) {
  throw new Error(`Incomplete film itinerary for ${from} → ${to}`);
}

const trip = {
  from,
  to,
  fare: pair.p,
  minutes: option.min,
  transfers: option.tr,
  km,
  legs,
};
const dir = new URL("../generated/", import.meta.url);
const temp = new URL(`film-${process.pid}.tmp`, dir);
await mkdir(dir, { recursive: true });
await writeFile(temp, JSON.stringify({ trip, map }) + "\n");
await rename(temp, new URL("film.json", dir));

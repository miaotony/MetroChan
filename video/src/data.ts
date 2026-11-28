import META from "../../data/meta.json";
import metroJson from "../../data/metro_data.json";
import {
  fareCurrent as fareOld,
  fareFinal as fareNew,
} from "../../src/core/fares";
import type { Network } from "../../src/data/network-codec";
import type { MapGeometry } from "../../src/data/official";
import film from "../generated/film.json";
import { LINE_COLORS } from "./theme";

export type Pt = [number, number];

const { trip } = film;
const GEO = film.map as unknown as MapGeometry;
const METRO: Network = metroJson;

export const MAP_CENTER = "人民广场";

/* ---------- fare rules ---------- */

export { fareOld, fareNew };

export const PASSES = [
  { rides: 35, price: 190 },
  { rides: 45, price: 210 },
  { rides: 60, price: 270 },
  { rides: 90, price: 390 },
] as const;

export const DISCOUNT_THRESHOLD = 90;

/** Pay-per-ride month: 10% off the part above 90 yuan. */
export const singlesCost = (fare: number, rides: number) => {
  const total = fare * rides;
  return total > DISCOUNT_THRESHOLD
    ? DISCOUNT_THRESHOLD + (total - DISCOUNT_THRESHOLD) * 0.9
    : total;
};

export type Plan = {
  key: string;
  title: string;
  detail: string;
  cost: number;
  combo: boolean;
  pass: number;
  passPrice: number;
  over: number;
};

export const monthlyPlans = (fare: number, rides: number): Plan[] => {
  const plans: Plan[] = [
    {
      key: "single",
      title: "全部单程",
      detail: `${fare} 元/次 · 满 ${DISCOUNT_THRESHOLD} 元后 9 折`,
      cost: singlesCost(fare, rides),
      combo: false,
      pass: 0,
      passPrice: 0,
      over: rides,
    },
  ];
  for (const pass of PASSES) {
    const over = Math.max(0, rides - pass.rides);
    plans.push({
      key: `pass${pass.rides}`,
      title: `计次票 ${pass.rides} 次`,
      detail:
        over > 0
          ? `${pass.price} 元 + ${over} 次单程`
          : `${pass.price} 元 / 30 天`,
      cost: pass.price + over * fare,
      combo: over > 0,
      pass: pass.rides,
      passPrice: pass.price,
      over,
    });
  }
  return plans;
};

export const bestPlanIndex = (plans: Plan[]) =>
  plans.reduce((best, plan, i) => (plan.cost < plans[best].cost ? i : best), 0);

/* ---------- station search (same ranking as the site) ---------- */

export type SearchHit = { name: string; pinyin: string; lines: string[] };

export const searchStations = (raw: string, limit = 5): SearchHit[] => {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const hits: { name: string; score: number; pinyin: string }[] = [];
  for (const name of Object.keys(METRO.stations)) {
    const [full, initials] = METRO.py[name] ?? ["", ""];
    let score = -1;
    if (name.includes(q)) score = name.indexOf(q) === 0 ? 0 : 1;
    else if (initials.indexOf(q) === 0) score = 2;
    else if (full.indexOf(q) === 0) score = 3;
    else if (initials.indexOf(q) > 0) score = 4;
    else if (full.indexOf(q) > 0) score = 5;
    if (score >= 0) hits.push({ name, score, pinyin: full });
  }
  hits.sort(
    (a, b) =>
      a.score - b.score ||
      a.name.length - b.name.length ||
      (a.name < b.name ? -1 : 1),
  );
  return hits.slice(0, limit).map((hit) => ({
    name: hit.name,
    pinyin: hit.pinyin,
    lines: METRO.stations[hit.name] ?? [],
  }));
};

export const stationLines = (name: string) => METRO.stations[name] ?? [];

/* ---------- geometry helpers ---------- */

const parsePath = (d: string): Pt[] =>
  d
    .slice(1)
    .split("L")
    .map((pair) => pair.split(",").map(Number) as Pt);

export const polyLength = (pts: Pt[]) => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return total;
};

export const polyToPath = (pts: Pt[]) =>
  pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join("");

/** Point and heading at a 0–1 position along a polyline. */
export const pointAt = (pts: Pt[], t: number) => {
  const total = polyLength(pts);
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dy);
    if (remaining <= len || i === pts.length - 1) {
      const k = len ? Math.min(1, remaining / len) : 0;
      return {
        x: pts[i - 1][0] + dx * k,
        y: pts[i - 1][1] + dy * k,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    }
    remaining -= len;
  }
  return { x: pts[0][0], y: pts[0][1], angle: 0 };
};

export const stationPoint = (name: string): Pt => GEO.st[name];

/** The whole network as one neutral path (used as the map base). */
export const BASE_PATH = GEO.base.join("");

/* ---------- coloured network, ordered outward from the centre ---------- */

export type NetSegment = {
  line: string;
  color: string;
  d: string;
  length: number;
  /** Distance from the map centre at which this segment starts to draw. */
  start: number;
};

export type NetStation = {
  name: string;
  x: number;
  y: number;
  /** Distance from the map centre, in the same unit as NetSegment.start. */
  dist: number;
  interchange: boolean;
};

const buildNetwork = (): {
  segments: NetSegment[];
  stations: NetStation[];
  reach: number;
} => {
  const raw = Object.entries(GEO.seg).map(([key, d]) => {
    const [a, b, line] = key.split("|");
    const pts = parsePath(d);
    return { a, b, line, pts, length: polyLength(pts) };
  });
  const neighbours: Record<string, { to: string; w: number }[]> = {};
  for (const seg of raw) {
    (neighbours[seg.a] ??= []).push({ to: seg.b, w: seg.length });
    (neighbours[seg.b] ??= []).push({ to: seg.a, w: seg.length });
  }
  const dist: Record<string, number> = { [MAP_CENTER]: 0 };
  const queue: [number, string][] = [[0, MAP_CENTER]];
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, node] = queue.shift() as [number, string];
    if (d > (dist[node] ?? Infinity)) continue;
    for (const next of neighbours[node] ?? []) {
      const nd = d + next.w;
      if (nd < (dist[next.to] ?? Infinity)) {
        dist[next.to] = nd;
        queue.push([nd, next.to]);
      }
    }
  }
  let reach = 0;
  const segments = raw.map((seg) => {
    const da = dist[seg.a] ?? 0;
    const db = dist[seg.b] ?? 0;
    const pts = da <= db ? seg.pts : [...seg.pts].reverse();
    const start = Math.min(da, db);
    reach = Math.max(reach, start + seg.length);
    return {
      line: seg.line,
      color: LINE_COLORS[seg.line] ?? "#888888",
      d: polyToPath(pts),
      length: seg.length,
      start,
    };
  });
  const stations = Object.entries(GEO.st).map(([name, [x, y]]) => ({
    name,
    x,
    y,
    dist: dist[name] ?? reach,
    interchange: (METRO.stations[name] ?? []).length > 1,
  }));
  return { segments, stations, reach };
};

export const NETWORK = buildNetwork();

/* ---------- the hero trip, straight from the official fare table ---------- */

const legGeometry = (line: string, stations: string[]) => {
  const pts: Pt[] = [];
  /** Length along the leg at which each station sits. */
  const marks = [0];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    const forward = GEO.seg[`${a}|${b}|${line}`];
    const backward = GEO.seg[`${b}|${a}|${line}`];
    let piece: Pt[];
    if (forward) piece = parsePath(forward);
    else if (backward) piece = parsePath(backward).reverse();
    else piece = [GEO.st[a], GEO.st[b]];
    pts.push(...(pts.length ? piece.slice(1) : piece));
    marks.push(polyLength(pts));
  }
  return { pts, marks };
};

const buildTrip = () => {
  const rawLegs = trip.legs.map((leg) => ({
    ...leg,
    ...legGeometry(leg.line, leg.stations),
  }));
  const total = rawLegs.reduce((sum, leg) => sum + polyLength(leg.pts), 0);
  let offset = 0;
  const legs = rawLegs.map((leg) => {
    const length = polyLength(leg.pts);
    const t0 = offset / total;
    offset += length;
    return {
      line: leg.line,
      from: leg.from,
      to: leg.to,
      color: LINE_COLORS[leg.line] ?? "#888888",
      stations: leg.stations,
      stops: leg.stations.length - 1,
      pts: leg.pts,
      d: polyToPath(leg.pts),
      length,
      /** Share of the whole trip covered by this leg, as 0–1 positions. */
      t0,
      t1: offset / total,
      /** 0–1 position of every station of this leg along the whole trip. */
      stationT: leg.marks.map((mark) => t0 + mark / total),
    };
  });
  return { ...trip, oldFare: fareOld(trip.km), legs };
};

export const TRIP = buildTrip();

export const FACTS = {
  stations: META.stations,
  pairs: META.pairs_filled,
  lines: Object.keys(METRO.lines).length,
  capturedAt: META.generated_at.slice(0, 10),
  effective: META.policy_effective,
};

/** Head of the route line at a 0–1 position along the whole trip. */
export const tripPoint = (t: number) => {
  const clamped = Math.max(0, Math.min(1, t));
  const leg =
    TRIP.legs.find((candidate) => clamped <= candidate.t1) ??
    TRIP.legs[TRIP.legs.length - 1];
  const local = (clamped - leg.t0) / Math.max(1e-6, leg.t1 - leg.t0);
  return { ...pointAt(leg.pts, local), color: leg.color, line: leg.line };
};

/** Fare shown by the meter while the route is still being drawn. */
export const meterFare = (t: number) =>
  t >= 1 ? TRIP.fare : fareNew(Math.max(0.1, t * TRIP.km));

/** 0–1 positions at which the meter steps up to the next fare tier. */
export const METER_STEPS = META.tiers
  .map(([limit]) => limit / TRIP.km)
  .filter((t) => t < 1);

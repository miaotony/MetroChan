import { getHearing } from './hearing.ts';

export type FareKey = 'cur' | 'final' | 'p1' | 'p2';

export interface FareScheme {
  readonly key: FareKey;
  readonly name: string;
  readonly fn: (km: number) => number;
  readonly color: string;
  readonly hearing?: true;
}

const FINAL_LIMITS = [4, 8, 12, 16, 23, 30, 40, 50] as const;
const PLAN1_LIMITS = [4, 8, 12, 16, 23, 30, 37, 47, 57, 67] as const;
const PLAN2_LIMITS = [6, 12, 20, 28, 38, 48, 60, 72] as const;

function tieredFare(km: number, baseFare: number, limits: readonly [number, ...number[]], extraKm: number): number {
  for (const [index, limit] of limits.entries()) {
    if (km <= limit) return baseFare + index;
  }
  const last = limits.length - 1;
  return baseFare + last + Math.ceil((km - limits[last]) / extraKm);
}

export function fareCurrent(km: number): number {
  return km <= 6 ? 3 : 3 + Math.ceil((km - 6) / 10);
}

export function fareFinal(km: number): number {
  return tieredFare(km, 3, FINAL_LIMITS, 15);
}

export function farePlan1(km: number): number {
  return tieredFare(km, 3, PLAN1_LIMITS, 15);
}

export function farePlan2(km: number): number {
  return tieredFare(km, 4, PLAN2_LIMITS, 14);
}

export const FARES: readonly FareScheme[] = [
  { key: 'cur', name: '老方案（2005 版）', fn: fareCurrent, color: '#8a8a8a' },
  { key: 'final', name: '新方案（2026-12）', fn: fareFinal, color: '#c8102e' },
  { key: 'p1', name: '听证方案一（未采纳）', fn: farePlan1, color: '#1668a3', hearing: true },
  { key: 'p2', name: '听证方案二（未采纳）', fn: farePlan2, color: '#2f8f6b', hearing: true },
];

export function activeFares(): readonly FareScheme[] {
  return getHearing() ? FARES : FARES.filter(scheme => !scheme.hearing);
}

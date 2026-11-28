import { fareFinal, type FareKey, type FareScheme } from './fares.ts';

export interface RidePass {
  readonly rides: number;
  readonly price: number;
}

export type CostRow =
  | { readonly kind: 'single'; readonly scheme: FareScheme; readonly unitFare: number; readonly cost: number }
  | { readonly kind: 'pass'; readonly pass: RidePass; readonly extraRides: number; readonly cost: number };

export interface CostComparison {
  readonly rows: readonly CostRow[];
  readonly best: CostRow;
}

const DISCOUNT_THRESHOLDS: Record<FareKey, number> = { cur: 70, final: 90, p1: 100, p2: 100 };
const PASSES: readonly RidePass[] = [
  { rides: 35, price: 190 }, { rides: 45, price: 210 }, { rides: 60, price: 270 }, { rides: 90, price: 390 },
];

export function calculateCosts(km: number, rides: number, useDisc: boolean, schemes: readonly FareScheme[]): CostComparison {
  const rows: CostRow[] = schemes.map(scheme => {
    const unitFare = scheme.fn(km);
    const subtotal = unitFare * rides;
    const threshold = DISCOUNT_THRESHOLDS[scheme.key];
    const cost = useDisc && subtotal > threshold ? threshold + (subtotal - threshold) * 0.9 : subtotal;
    return { kind: 'single', scheme, unitFare, cost };
  });

  const extraFare = fareFinal(km);
  for (const pass of PASSES) {
    const extraRides = rides > pass.rides ? rides - pass.rides : 0;
    const cost = extraRides > 0 ? pass.price + extraRides * extraFare : pass.price;
    rows.push({ kind: 'pass', pass, extraRides, cost });
  }

  const eligible = rows.filter(row => row.kind !== 'single' || row.scheme.key !== 'cur');
  const best = eligible.reduce((cheapest, row) => row.cost < cheapest.cost ? row : cheapest);
  return { rows, best };
}

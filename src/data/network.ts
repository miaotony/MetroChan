import deployed from '../../data/metro_data.json' with { type: 'json' };

export interface Network {
  stations: Record<string, string[]>;
  edges: { a: string; b: string; d: number; l: string }[];
  lines: Record<string, string[]>;
  py: Record<string, string[]>;
}

export const METRO_DATA: Network = deployed;

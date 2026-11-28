import deployed from '../../data/metro_data.json' with { type: 'json' };
import { unpackNetwork, type Network } from './network-codec.ts';

export type { Network } from './network-codec.ts';

declare const __PACKED_NETWORK__: string;

export const METRO_DATA: Network = typeof __PACKED_NETWORK__ === 'string'
  ? unpackNetwork(__PACKED_NETWORK__) : deployed;

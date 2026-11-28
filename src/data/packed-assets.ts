import mapUrl from '../../data/official/map.bin?url';
import { order } from '../../data/official/stations.json';
import { createOfficialData } from './official.ts';
import { readData } from './read-data.ts';

const routes = import.meta.glob<string>('../../data/official/routes/*.bin', { eager: true, import: 'default', query: '?url' });

export const { officialPair, loadGeometry } = createOfficialData(
  order,
  first => readData(routes[`../../data/official/routes/${first}.bin`]),
  () => readData(mapUrl),
);

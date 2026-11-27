import assert from 'node:assert/strict';
import test from 'node:test';
import { getHearing, onHearingChange, setHearing } from '../../src/core/hearing.ts';

test('both panels observe a hearing change once; an unsubscribed panel stops updating', () => {
  const distance = [];
  const stations = [];
  const detachDistance = onHearingChange(() => distance.push(getHearing()));
  const detachStations = onHearingChange(() => stations.push(getHearing()));
  try {
    setHearing(true);
    setHearing(true);
    detachDistance();
    setHearing(false);
    assert.deepEqual(distance, [true]);
    assert.deepEqual(stations, [true, false]);
  } finally {
    detachDistance();
    detachStations();
    setHearing(false);
  }
});

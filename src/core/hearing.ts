let enabled = false;
const listeners = new Set<() => void>();

export function getHearing() {
  return enabled;
}

export function setHearing(value: boolean) {
  if (value === enabled) return;
  enabled = value;
  listeners.forEach(notify => notify());
}

export function onHearingChange(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

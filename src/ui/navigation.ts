import { byId } from './dom';

type Tab = 's2s' | 'dist' | 'cities' | 'change';

function isTab(value: string | undefined): value is Tab {
  return value === 's2s' || value === 'dist' || value === 'cities' || value === 'change';
}

export function currentTab(): Tab {
  const tab = document.body.dataset.tab;
  return isTab(tab) ? tab : 's2s';
}

export function distanceInput(tab: Tab): HTMLInputElement {
  return byId<HTMLInputElement>(tab === 'cities' ? 'cityKmNum' : 'kmNum');
}

export function showTab(tab: Tab): void {
  document.body.dataset.tab = tab;
  for (const button of document.querySelectorAll<HTMLElement>('.tab')) {
    button.classList.toggle('active', button.dataset.tab === tab);
  }
  for (const panel of document.querySelectorAll('.panel')) {
    panel.classList.toggle('active', panel.id === `panel-${tab}`);
  }
}

export function restoreOnLoad(restore: (query: URLSearchParams) => void): void {
  const run = () => restore(new URLSearchParams(location.search));
  if (document.readyState === 'complete') queueMicrotask(run);
  else window.addEventListener('load', run, { once: true });
}

export function initNavigation(): void {
  for (const button of document.querySelectorAll<HTMLElement>('.tab')) {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      if (!isTab(tab)) return;
      showTab(tab);
      const hash = tab === 's2s' ? '' : `#${tab}`;
      try {
        history.replaceState(null, '', hash || location.pathname + location.search);
      } catch {
        location.hash = hash;
      }
    });
  }

  function restoreTab(): void {
    const hash = location.hash.slice(1);
    showTab(isTab(hash) ? hash : 's2s');
  }
  restoreTab();
  window.addEventListener('hashchange', restoreTab);

  restoreOnLoad(query => {
    const km = Number.parseFloat(query.get('km') ?? '');
    if (Number.isNaN(km) || km < 1) return;
    const input = distanceInput(currentTab());
    input.value = String(Math.round(Math.min(km, 135)));
    input.dispatchEvent(new Event('input'));
  });
}

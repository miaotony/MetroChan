import { byId } from './dom';

function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function savePreference(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}

function initTheme(): void {
  const button = byId('themeBtn');
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const preference = readPreference('mc_theme');
  let theme: 'light' | 'dark' | null = preference === 'light' || preference === 'dark' ? preference : null;

  function isDark(): boolean {
    return theme ? theme === 'dark' : !!system?.matches;
  }
  function apply(): void {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    button.textContent = isDark() ? '☀️' : '🌙';
  }
  apply();
  button.addEventListener('click', () => {
    theme = isDark() ? 'light' : 'dark';
    savePreference('mc_theme', theme);
    apply();
  });
  const onSystemChange = () => { if (!theme) apply(); };
  if (system?.addEventListener) system.addEventListener('change', onSystemChange);
  else system?.addListener?.(onSystemChange);
}

function initToTop(): void {
  const button = byId('toTop');
  const update = () => button.classList.toggle('on', window.scrollY > 360);
  window.addEventListener('scroll', update, { passive: true });
  button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  update();
}

function initTip(): void {
  const box = byId('tipFloat');
  if (readPreference('mc_tip_hidden') !== '1' && window.matchMedia?.('(min-width: 901px)').matches) {
    box.classList.add('on');
  }
  byId('tipFab').addEventListener('click', () => box.classList.toggle('on'));
  byId('tipClose').addEventListener('click', event => {
    event.stopPropagation();
    box.classList.remove('on');
    savePreference('mc_tip_hidden', '1');
  });
}

export function initChrome(): void {
  initTheme();
  initToTop();
  initTip();
  document.addEventListener('click', event => {
    if (event.target instanceof Element) event.target.closest('.spoiler')?.classList.toggle('revealed');
  });
}

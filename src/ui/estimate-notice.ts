import { byId } from './dom';

const dismissalKey = 'metrochan_s2s_notice_v1';
let wired = false;

export function maybeShowS2sModal(): void {
  try {
    if (localStorage.getItem(dismissalKey)) return;
  } catch {}

  const mask = byId('s2sModal');
  mask.classList.add('open');
  if (wired) return;
  wired = true;

  const dontShow = byId<HTMLInputElement>('s2sModalDontShow');
  function close(): void {
    mask.classList.remove('open');
    if (dontShow.checked) {
      try { localStorage.setItem(dismissalKey, '1'); } catch {}
    }
  }
  byId('s2sModalOk').addEventListener('click', close);
  mask.addEventListener('click', event => { if (event.target === mask) close(); });
}

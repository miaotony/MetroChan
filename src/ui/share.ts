import { byId } from './dom';
import { currentTab, distanceInput, restoreOnLoad, showTab } from './navigation';
import { createQrDialog } from './share-qr';

interface Stations {
  get(): { from: string; to: string };
  set(from: string, to: string): void;
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export function initShare(stations: Stations): void {
  const button = byId('shareBtn');
  const label = byId('shareBtnText');
  const includeTrip = byId<HTMLInputElement>('shareWithParams');
  const rides = byId<HTMLInputElement>('ridesS2s');

  function buildUrl(): string {
    const portable = document.querySelector('meta[name="metrochan-offline"]') !== null || !['https:', 'http:'].includes(location.protocol);
    const base = portable
      ? document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? 'https://metrochan.miaotony.xyz/'
      : location.origin + location.pathname;
    const url = new URL(base);
    const tab = currentTab();
    url.search = '';
    url.hash = tab;
    if (tab === 's2s') {
      if (includeTrip.checked) {
        const { from, to } = stations.get();
        if (from) url.searchParams.set('from', from);
        if (to) url.searchParams.set('to', to);
        if (rides.value) url.searchParams.set('rides', rides.value);
      }
    } else {
      const km = distanceInput(tab).value;
      if (km) url.searchParams.set('km', km);
    }
    return url.href;
  }

  async function copyLink(): Promise<boolean> {
    const copied = await copyText(buildUrl());
    label.textContent = copied ? '✅ 已复制链接' : '复制失败，请手动复制';
    button.classList.toggle('done', copied);
    window.setTimeout(() => {
      label.textContent = '🔗 复制当前视图链接';
      button.classList.remove('done');
    }, 2000);
    return copied;
  }
  button.addEventListener('click', copyLink);

  let openQr: (() => void) | undefined;
  function showQr(): void {
    openQr ??= createQrDialog(buildUrl, copyLink, includeTrip);
    openQr();
  }
  byId('qrBtn').addEventListener('click', showQr);
  byId('mQrBtn').addEventListener('click', showQr);

  restoreOnLoad(query => {
    const from = query.get('from');
    const to = query.get('to');
    if (!from || !to) return;
    const count = query.get('rides');
    if (count) {
      rides.value = String(Math.max(1, Math.min(120, Number.parseInt(count, 10) || 44)));
      byId<HTMLInputElement>('ridesS2sRange').value = rides.value;
    }
    stations.set(from, to);
    showTab('s2s');
  });
}

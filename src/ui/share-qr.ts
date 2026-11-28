import { qrImageUrl } from '../core/qr';
import { byId } from './dom';

function createQrImage(url: string): HTMLImageElement {
  const image = document.createElement('img');
  image.alt = '当前视图的分享二维码';
  image.src = qrImageUrl(url);
  return image;
}

export function createQrDialog(buildUrl: () => string, copyLink: () => Promise<boolean>, includeTrip: HTMLInputElement): () => void {
  const box = document.createElement('div');
  box.className = 'qrbox';
  box.hidden = true;
  box.innerHTML = `<div class="qr-card" role="dialog" aria-label="二维码分享">
    <h3>扫码或点按打开在线版</h3>
    <div class="qr-sub"></div>
    <label class="qr-opt"><input type="checkbox" id="qrWithParams" checked> 带上起点、终点和每月乘坐次数</label>
    <a class="qr-open" target="_blank" rel="noopener noreferrer" aria-label="打开当前视图的在线链接（新窗口）"><span class="qr-img"></span><span class="qr-url"></span></a>
    <div class="qr-acts"><button type="button" class="qr-copy">复制链接</button><button type="button" class="qr-close">关闭</button></div>
  </div>`;
  document.body.appendChild(box);
  const option = byId<HTMLInputElement>('qrWithParams');
  const subtitle = box.querySelector('.qr-sub')!;
  const holder = box.querySelector('.qr-img')!;
  const link = box.querySelector<HTMLAnchorElement>('.qr-open')!;
  const address = box.querySelector('.qr-url')!;
  const copyButton = box.querySelector('.qr-copy')!;

  function render(): void {
    const url = buildUrl();
    link.href = url;
    address.textContent = url;
    try {
      holder.replaceChildren(createQrImage(url));
    } catch {
      holder.textContent = '二维码生成失败，请点按或复制链接';
    }
  }
  option.addEventListener('change', () => {
    includeTrip.checked = option.checked;
    render();
  });
  copyButton.addEventListener('click', async () => {
    copyButton.textContent = await copyLink() ? '已复制 ✓' : '复制失败';
    window.setTimeout(() => { copyButton.textContent = '复制链接'; }, 1400);
  });

  const close = () => { box.hidden = true; };
  box.querySelector('.qr-close')!.addEventListener('click', close);
  box.addEventListener('click', event => { if (event.target === box) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !box.hidden) close(); });
  return () => {
    option.checked = includeTrip.checked;
    const tab = document.querySelector('.tab.active');
    subtitle.textContent = `当前视图：${tab?.textContent?.trim() ?? '默认视图'}`;
    render();
    box.hidden = false;
  };
}

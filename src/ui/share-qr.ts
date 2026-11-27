import qrcode from 'qrcode-generator';
import { byId } from './dom';

function drawQr(url: string): HTMLCanvasElement {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const size = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(232 / size));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * cell;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#1f1c18';
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (qr.isDark(row, column)) context.fillRect(column * cell, row * cell, cell, cell);
    }
  }
  return canvas;
}

export function createQrDialog(buildUrl: () => string, copyLink: () => Promise<boolean>, includeTrip: HTMLInputElement): () => void {
  const box = document.createElement('div');
  box.className = 'qrbox';
  box.hidden = true;
  box.innerHTML = `<div class="qr-card" role="dialog" aria-label="二维码分享">
    <h3>扫码打开本页</h3>
    <div class="qr-sub"></div>
    <label class="qr-opt"><input type="checkbox" id="qrWithParams" checked> 带上起点、终点和每月乘坐次数</label>
    <div class="qr-img"></div>
    <div class="qr-url"></div>
    <div class="qr-acts"><button type="button" class="qr-copy">复制链接</button><button type="button" class="qr-close">关闭</button></div>
  </div>`;
  document.body.appendChild(box);
  const option = byId<HTMLInputElement>('qrWithParams');
  const subtitle = box.querySelector('.qr-sub')!;
  const holder = box.querySelector('.qr-img')!;
  const link = box.querySelector('.qr-url')!;
  const copyButton = box.querySelector('.qr-copy')!;

  function render(): void {
    const url = buildUrl();
    try {
      holder.replaceChildren(drawQr(url));
      link.textContent = url;
    } catch {
      const image = document.createElement('img');
      image.alt = '二维码生成失败';
      holder.replaceChildren(image);
      link.textContent = '二维码生成失败，请直接复制链接';
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

import { activeFares, fareCurrent } from '../core/fares';
import { onHearingChange } from '../core/hearing';
import { renderCostTable } from '../ui/cost-table';
import { byId } from '../ui/dom';

export function initDistance(): void {
  const range = byId<HTMLInputElement>('kmRange');
  const kmInput = byId<HTMLInputElement>('kmNum');
  const cards = byId('cards');
  const svg = byId<SVGSVGElement>('chart');
  const ridesInput = byId<HTMLInputElement>('rides');
  const ridesRange = byId<HTMLInputElement>('ridesRange');
  const discount = byId<HTMLInputElement>('discount');
  const costTable = byId('costTable');

  function getKm(): number {
    const km = Number.parseFloat(kmInput.value);
    return Number.isNaN(km) || km < 1 ? 1 : Math.min(km, 200);
  }

  function renderCards(): void {
    const km = getKm();
    const current = fareCurrent(km);
    cards.innerHTML = activeFares().map(fare => {
      const price = fare.fn(km);
      const difference = price - current;
      const delta = fare.key === 'cur' ? '基准' : difference === 0 ? '与老方案相同'
        : `比老方案 ${difference > 0 ? '+' : ''}${difference} 元`;
      const deltaClass = fare.key === 'cur' || difference === 0 ? 'eq' : 'up';
      const note = fare.key === 'cur' ? '0-6km 起步 3 元，每 10km +1'
        : fare.key === 'p1' ? '起步 3 元不变，缩短起乘/中短距间距'
        : fare.key === 'p2' ? '起步 4 元，均摊涨幅' : '起步 3 元/4km，16km 内每 4km +1';
      return `<div class="card ${fare.key}"><div class="name">${fare.name}</div>`
        + `<div class="price">${price}<span class="u">元</span></div>`
        + `<div class="delta ${deltaClass}">${delta}</div><div class="note">${note}</div></div>`;
    }).join('');
  }

  let width = 920;
  let height = 380;
  let left = 42;
  const right = 16;
  const top = 30;
  const bottom = 38;
  const maxKm = 135;
  const maxFare = 16;

  function measureChart(): void {
    width = Math.max(300, Math.round(svg.clientWidth || 900));
    height = width < 560 ? 300 : 380;
    left = width < 560 ? 34 : 42;
  }

  function renderChart(): void {
    if (svg.clientWidth && Math.abs(svg.clientWidth - width) > 2) measureChart();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const scaleKm = (km: number) => left + km / maxKm * (width - left - right);
    const scaleFare = (price: number) => height - bottom - price / maxFare * (height - top - bottom);
    const km = getKm();
    const fares = activeFares();
    const description = `横轴为乘距 0 至 135 公里，纵轴为票价 0 至 16 元。${fares.length} 条阶梯曲线分别为：`
      + fares.map(fare => `${fare.name} 在 ${km} 公里时 ${fare.fn(km)} 元`).join('；') + '。';
    let markup = `<title>上海地铁三方案全乘距票价阶梯图</title><desc>${description}</desc>`;
    for (const price of [0, 2, 4, 6, 8, 10, 12, 14, 16]) {
      markup += `<line class="grid" x1="${scaleKm(0)}" y1="${scaleFare(price)}" x2="${scaleKm(maxKm)}" y2="${scaleFare(price)}"/>`;
      markup += `<text class="axis" x="${left - 8}" y="${scaleFare(price) + 4}" text-anchor="end">${price}</text>`;
    }
    for (const tick of [0, 20, 40, 60, 80, 100, 120]) {
      markup += `<line class="grid" x1="${scaleKm(tick)}" y1="${scaleFare(0)}" x2="${scaleKm(tick)}" y2="${scaleFare(maxFare)}"/>`;
      markup += `<text class="axis" x="${scaleKm(tick)}" y="${height - bottom + 18}" text-anchor="middle">${tick}</text>`;
    }
    markup += `<text class="axis" x="${scaleKm(maxKm)}" y="${height - bottom + 18}" text-anchor="end">公里</text>`;
    markup += `<text class="axis" x="${left - 8}" y="14" text-anchor="end">元</text>`;
    for (const fare of fares) {
      let previous = fare.fn(1);
      let path = `M ${scaleKm(1)} ${scaleFare(previous)}`;
      for (let distance = 2; distance <= maxKm; distance++) {
        const price = fare.fn(distance);
        path += ` L ${scaleKm(distance)} ${scaleFare(previous)} L ${scaleKm(distance)} ${scaleFare(price)}`;
        previous = price;
      }
      markup += `<path d="${path}" fill="none" stroke="${fare.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    }
    markup += `<line class="crosshair" x1="${scaleKm(km)}" y1="${scaleFare(0)}" x2="${scaleKm(km)}" y2="${scaleFare(maxFare)}"/>`;
    markup += `<text class="axis" x="${scaleKm(km)}" y="${top - 8}" text-anchor="middle" font-weight="700">${km} km</text>`;
    for (const fare of fares) {
      markup += `<circle class="dot" cx="${scaleKm(km)}" cy="${scaleFare(fare.fn(km))}" r="4.5" fill="${fare.color}"/>`;
    }
    svg.innerHTML = markup;
  }

  function renderCost(): void {
    const rides = Math.max(1, Number.parseInt(ridesInput.value, 10) || 0);
    renderCostTable(costTable, getKm(), rides, discount.checked);
  }

  function clearRidePreset(): void {
    document.querySelectorAll('.ride-chips[data-target="km"] button.on').forEach(button => button.classList.remove('on'));
  }

  document.querySelectorAll<HTMLButtonElement>('.ride-chips[data-target="km"] button').forEach(button => {
    button.addEventListener('click', () => {
      const rides = button.dataset.rides ?? '';
      ridesInput.value = rides;
      ridesRange.value = rides;
      button.parentElement?.querySelectorAll('button').forEach(chip => chip.classList.toggle('on', chip === button));
      renderCost();
    });
  });

  function syncRange(): void {
    const value = String(Math.round(getKm()));
    range.value = value;
    kmInput.value = value;
    renderCards();
    renderChart();
    renderCost();
  }

  range.addEventListener('input', () => {
    kmInput.value = range.value;
    syncRange();
  });
  kmInput.addEventListener('input', () => {
    const km = Number.parseFloat(kmInput.value);
    if (km > maxKm) range.max = String(Math.ceil(km));
    syncRange();
  });
  document.querySelectorAll<HTMLButtonElement>('.presets button').forEach(button => {
    button.addEventListener('click', () => {
      kmInput.value = button.dataset.km ?? '';
      syncRange();
    });
  });
  ridesRange.addEventListener('input', () => {
    clearRidePreset();
    ridesInput.value = ridesRange.value;
    renderCost();
  });
  ridesInput.addEventListener('input', () => {
    clearRidePreset();
    renderCost();
    ridesRange.value = ridesInput.value;
  });
  discount.addEventListener('change', renderCost);
  onHearingChange(() => {
    renderCards();
    renderChart();
    renderCost();
  });

  function remeasure(): void {
    if (svg.clientWidth) {
      measureChart();
      renderChart();
    }
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(remeasure, 140);
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.tab')) window.setTimeout(remeasure, 60);
  });

  function selectChartDistance(clientX: number): void {
    const rect = svg.getBoundingClientRect();
    const pixel = (clientX - rect.left) / rect.width * width;
    const km = Math.round((pixel - left) / (width - left - right) * maxKm);
    kmInput.value = String(Math.max(1, Math.min(maxKm, km)));
    syncRange();
  }

  let dragging = false;
  svg.style.cursor = 'crosshair';
  svg.addEventListener('mousedown', event => {
    event.preventDefault();
    dragging = true;
    selectChartDistance(event.clientX);
  });
  window.addEventListener('mousemove', event => {
    if (dragging) selectChartDistance(event.clientX);
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  function selectTouchDistance(event: TouchEvent): void {
    const touch = event.touches[0];
    if (touch) selectChartDistance(touch.clientX);
    event.preventDefault();
  }
  svg.addEventListener('touchstart', event => {
    dragging = true;
    selectTouchDistance(event);
  }, { passive: false });
  svg.addEventListener('touchmove', event => {
    if (dragging) selectTouchDistance(event);
  }, { passive: false });
  window.addEventListener('touchend', () => { dragging = false; });

  measureChart();
  syncRange();
}

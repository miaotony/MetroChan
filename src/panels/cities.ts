import { CITY_CARDS, CITY_FARES } from '../core/city-fares';
import { byId } from '../ui/dom';

const MAX_KM = 135;
const MAX_PRICE = 20;
const RIGHT = 16;
const TOP = 30;
const BOTTOM = 36;

function renderTables(): void {
  const headers = CITY_FARES.map(city => `<th title="${city.name}"><span class="th-full">${city.name}</span><span class="th-short">${city.short}</span></th>`).join('');
  const table = (label: string, rows: string) => `<table class="cost"><thead><tr><th>${label}</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;

  let maxPrice = 0;
  const brackets = CITY_FARES.map(city => {
    const byPrice = new Map<number, { lo: number; hi: number }>();
    for (let km = 1; km <= MAX_KM; km++) {
      const price = city.fn(km);
      const bracket = byPrice.get(price);
      if (bracket) bracket.hi = km;
      else byPrice.set(price, { lo: km - 1, hi: km });
      maxPrice = Math.max(maxPrice, price);
    }
    return byPrice;
  });

  let rows = '';
  for (let price = 2; price <= maxPrice; price++) {
    const cells = brackets.map(byPrice => byPrice.get(price));
    const maxHi = Math.max(...cells.map(cell => cell && cell.hi < MAX_KM ? cell.hi : -1));
    rows += `<tr><td>${price} 元</td>` + cells.map(cell => {
      if (!cell) return '<td>—</td>';
      if (cell.hi >= MAX_KM) return `<td>&gt;${cell.lo} km</td>`;
      const distance = cell.lo === 0 ? `≤${cell.hi}` : `${cell.lo}–${cell.hi}`;
      return `<td${cell.hi === maxHi ? ' class="cheap"' : ''}>${distance} km</td>`;
    }).join('') + '</tr>';
  }
  byId('cityTable').innerHTML = table('票价', rows);

  const distanceRows = [5, 10, 16, 25, 40, 60, 80, 124].map(km => {
    const prices = CITY_FARES.map(city => city.fn(km));
    const min = Math.min(...prices);
    return `<tr><td>${km} km</td>` + prices.map(price => `<td${price === min ? ' class="cheap"' : ''}>${price}</td>`).join('') + '</tr>';
  }).join('');
  byId('cityDistTable').innerHTML = table('乘距', distanceRows);
}

function renderCards(): void {
  byId('cityCards').innerHTML = CITY_CARDS.map(card => '<div class="city-card">'
    + `<h3><span class="cdot" style="background:${card.color}"></span>${card.name}</h3>`
    + `<p class="rule">${card.rule}</p>`
    + `<p class="meta">${card.meta} 来源：<a href="${card.src}" target="_blank" rel="noopener">${card.srcName}</a></p>`
    + '</div>').join('');
}

export function initCities(): void {
  const svg = document.querySelector<SVGSVGElement>('#cityChart');
  if (!svg) return;
  const range = byId<HTMLInputElement>('cityKmRange');
  const num = byId<HTMLInputElement>('cityKmNum');
  const pricesBox = byId('cityPrices');
  const legend = byId('cityLegend');
  const hidden = new Set<string>();
  const shownFares = () => CITY_FARES.filter(city => !hidden.has(city.key));

  function getKm(): number {
    const value = Number.parseFloat(num.value);
    return Number.isNaN(value) || value < 1 ? 1 : Math.min(value, MAX_KM);
  }

  function renderLegend(): void {
    legend.innerHTML = CITY_FARES.map(city => {
      const off = hidden.has(city.key);
      return `<span data-key="${city.key}" class="${off ? 'off' : ''}" title="点击显示/隐藏该曲线"`
        + ` role="button" tabindex="0" aria-pressed="${!off}"`
        + ` aria-label="${city.name}${off ? '，当前已隐藏，按回车显示' : '，当前已显示，按回车隐藏'}">`
        + `<i class="sw" style="background:${city.color}"></i>${city.name}</span>`;
    }).join('');
  }

  const measureChart = () => {
    const width = Math.max(300, Math.round(svg.clientWidth || 900));
    const height = width < 560 ? 330 : 420;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    return { width, height, left: width < 560 ? 34 : 42 };
  };
  let metrics = measureChart();

  const renderChart = () => {
    if (svg.clientWidth && Math.abs(svg.clientWidth - metrics.width) > 2) metrics = measureChart();
    const { width, height, left } = metrics;
    const scaleX = (distance: number) => left + distance / MAX_KM * (width - left - RIGHT);
    const scaleY = (price: number) => height - BOTTOM - price / MAX_PRICE * (height - TOP - BOTTOM);
    const km = getKm();
    const shown = shownFares();
    const description = `横轴为乘距 0 至 135 公里，纵轴为票价 0 至 20 元。当前显示 ${shown.length} 条曲线，`
      + shown.map(city => `${city.name} 在 ${km} 公里时 ${city.fn(km)} 元`).join('；') + '。';
    let out = `<title>各城市地铁票价阶梯对比图</title><desc>${description}</desc>`;

    for (let price = 0; price <= MAX_PRICE; price += 2) {
      out += `<line class="grid" x1="${scaleX(0)}" y1="${scaleY(price)}" x2="${scaleX(MAX_KM)}" y2="${scaleY(price)}"/>`;
      out += `<text class="axis" x="${left - 8}" y="${scaleY(price) + 4}" text-anchor="end">${price}</text>`;
    }
    for (const distance of [0, 20, 40, 60, 80, 100, 120]) {
      out += `<line class="grid" x1="${scaleX(distance)}" y1="${scaleY(0)}" x2="${scaleX(distance)}" y2="${scaleY(MAX_PRICE)}"/>`;
      out += `<text class="axis" x="${scaleX(distance)}" y="${height - BOTTOM + 18}" text-anchor="middle">${distance}</text>`;
    }
    out += `<text class="axis" x="${scaleX(MAX_KM)}" y="${height - BOTTOM + 18}" text-anchor="end">公里</text>`;
    out += `<text class="axis" x="${left - 8}" y="14" text-anchor="end">元</text>`;

    for (const city of shown) {
      let previous = city.fn(1);
      let path = `M ${scaleX(1)} ${scaleY(previous)}`;
      for (let distance = 2; distance <= MAX_KM; distance++) {
        const price = city.fn(distance);
        path += ` L ${scaleX(distance)} ${scaleY(previous)} L ${scaleX(distance)} ${scaleY(price)}`;
        previous = price;
      }
      out += `<path d="${path}" fill="none" stroke="${city.color}" stroke-width="2.2" stroke-linejoin="round" opacity="0.9"/>`;
    }
    out += `<line class="crosshair" x1="${scaleX(km)}" y1="${scaleY(0)}" x2="${scaleX(km)}" y2="${scaleY(MAX_PRICE)}"/>`;
    out += `<text class="axis" x="${scaleX(km)}" y="${TOP - 8}" text-anchor="middle" font-weight="700">${km} km</text>`;
    for (const city of shown) {
      out += `<circle class="dot" cx="${scaleX(km)}" cy="${scaleY(city.fn(km))}" r="4.5" fill="${city.color}"/>`;
    }
    svg.innerHTML = out;
  };

  function renderPrices(): void {
    const km = getKm();
    const prices = shownFares().map(city => ({ city, price: city.fn(km) }));
    const min = Math.min(...prices.map(({ price }) => price));
    pricesBox.innerHTML = prices.map(({ city, price }) => `<div class="cp-chip${price === min ? ' low' : ''}">`
      + `<span class="cdot" style="background:${city.color}"></span>`
      + `<span class="cp-name">${city.name}</span><span class="cp-fare">${price} 元</span></div>`).join('');
  }

  function sync(): void {
    const value = String(Math.round(getKm()));
    range.value = value;
    num.value = value;
    renderChart();
    renderPrices();
  }

  const legendItem = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLSpanElement>('span[data-key]') : null;
  legend.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const item = legendItem(event.target);
    if (!item) return;
    event.preventDefault();
    item.click();
  });
  legend.addEventListener('click', event => {
    const key = legendItem(event.target)?.dataset.key;
    if (!key) return;
    if (hidden.has(key)) hidden.delete(key);
    else if (shownFares().length > 1) hidden.add(key);
    else return;
    renderLegend();
    renderChart();
    renderPrices();
  });

  const remeasure = () => {
    metrics = measureChart();
    renderChart();
  };
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(remeasure, 140);
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.tab')) {
      window.setTimeout(() => { if (svg.clientWidth) remeasure(); }, 60);
    }
  });
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
      if (svg.clientWidth && Math.abs(svg.clientWidth - metrics.width) > 2) remeasure();
    });
    observer.observe(svg);
  }

  range.addEventListener('input', () => { num.value = range.value; sync(); });
  num.addEventListener('input', sync);
  document.querySelectorAll<HTMLButtonElement>('#cityPresets button').forEach(button => {
    button.addEventListener('click', () => { num.value = button.dataset.km ?? ''; sync(); });
  });

  const selectAt = (clientX: number) => {
    const rect = svg.getBoundingClientRect();
    const { width, left } = metrics;
    const pixel = (clientX - rect.left) / rect.width * width;
    const km = Math.round((pixel - left) / (width - left - RIGHT) * MAX_KM);
    num.value = String(Math.max(1, Math.min(MAX_KM, km)));
    sync();
  };
  let dragging = false;
  svg.addEventListener('mousedown', event => {
    event.preventDefault();
    dragging = true;
    selectAt(event.clientX);
  });
  window.addEventListener('mousemove', event => { if (dragging) selectAt(event.clientX); });
  window.addEventListener('mouseup', () => { dragging = false; });
  svg.addEventListener('touchstart', event => {
    dragging = true;
    selectAt(event.touches[0].clientX);
    event.preventDefault();
  }, { passive: false });
  svg.addEventListener('touchmove', event => {
    if (!dragging) return;
    selectAt(event.touches[0].clientX);
    event.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', () => { dragging = false; });

  renderLegend();
  sync();
  renderTables();
  renderCards();
}

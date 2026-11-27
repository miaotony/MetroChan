import { onHearingChange } from '../../core/hearing';
import { graph, dijkstra, parseOfficialPath } from '../../core/route';
import { officialPair, loadGeometry } from '../../data/official';
import { renderCostTable } from '../../ui/cost-table';
import { byId } from '../../ui/dom';
import { maybeShowS2sModal } from '../../ui/estimate-notice';
import { createEndpoint } from './picker';
import { renderJourney, wireJourney } from './journey';
import { renderMapBox, wireMap, fitMapLabels } from './map';
import { estimateResult, priceCards } from './result';

export function initStations() {
  const from = createEndpoint('from', '1号线', '人民广场');
  const to = createEndpoint('to', '1号线', '徐家汇');
  const rides = byId<HTMLInputElement>('ridesS2s');
  const slider = byId<HTMLInputElement>('ridesS2sRange');
  const discount = byId<HTMLInputElement>('discountS2s');
  const costTable = byId('costTableS2s');
  const result = byId('routeResult');
  let lastKm: number | null = null;
  let requestId = 0;

  function renderCost() {
    if (lastKm === null) costTable.replaceChildren();
    else renderCostTable(costTable, lastKm, Math.max(1, Number.parseInt(rides.value, 10) || 1), discount.checked);
  }

  async function renderRoute() {
    const token = ++requestId;
    const start = from.get(), end = to.get();
    const route = graph[start] && graph[end] && start !== end ? dijkstra(start) : null;
    if (!route || !(end in route.dist)) {
      result.innerHTML = `<div class="no-route">${start === end ? '起点和终点相同。' : '无法计算该站对间的路径。'}</div>`;
      lastKm = null;
      renderCost();
      return;
    }
    const km = route.dist[end] / 1000;
    lastKm = km;
    const [lookup, geometry] = await Promise.all([officialPair(start, end), loadGeometry()]);
    if (token !== requestId) return;

    const pair = lookup.pair;
    const options = pair?.r[0]?.opts.filter(option => option.desc) ?? [];
    if (!pair || options.length === 0) {
      const path: string[] = [];
      for (let stop: string | undefined = end; stop; stop = route.prev[stop]) path.push(stop);
      result.innerHTML = estimateResult(path.reverse(), km);
      wireJourney(result);
      renderCost();
      if (!pair?.r.length) maybeShowS2sModal();
      return;
    }
    const { p: fare, lt: lineType } = pair;
    function paint(index: number) {
      const option = options[index];
      const parsed = parseOfficialPath(option.desc);
      const segments = lookup.reversed ? parsed.reverse().map(segment => ({ line: segment.line, from: segment.to, to: segment.from })) : parsed;
      const plans = options.length < 2 ? '' : '<div class="plan-switch">' + options.map((choice, position) =>
        `<button class="plan-btn${position === index ? ' active' : ''}" data-plan="${position}">${choice.name}${choice.tr ? `（${choice.tr} 次换乘）` : ''}</button>`).join('') + '</div>';
      result.innerHTML = `<div class="fare-head"><div class="fare-big">${Number.isInteger(fare) ? fare : fare.toFixed(2)}<span class="u">元</span></div>`
        + `<div class="fare-meta"><div class="fm-1">官方实测票价${lineType && lineType !== 'URBAN' ? ' · ' + lineType : ''}</div>`
        + `<div class="fm-2">${option.min ? `约 ${option.min} 分钟 · ` : ''}${option.tr ? `换乘 ${option.tr} 次` : '无需换乘'}`
        + ` · 计价里程约 ${km.toFixed(1)} 公里（本页按站间距推算）</div></div></div>`
        + plans + renderJourney(segments) + '<div class="map-row">' + (geometry ? renderMapBox(geometry, segments, start, end) : '')
        + priceCards(km, fare) + '</div><div class="fare-foot"><span>里程按公开站间距推算最短路径 · 老方案（2005 版）票价按旧规则与站间距推算，可能与实际扣费有差异，仅供参考</span></div>';
      fitMapLabels(result);
      wireJourney(result);
      if (geometry) wireMap(result, geometry);
      result.querySelectorAll<HTMLButtonElement>('.plan-btn').forEach(button => {
        button.addEventListener('click', () => paint(Number(button.dataset.plan)));
      });
      renderCost();
    }
    paint(0);
  }

  const chips = document.querySelectorAll<HTMLButtonElement>('.ride-chips[data-target="s2s"] button');
  function setRides(value: string, selected?: HTMLButtonElement) {
    rides.value = value;
    slider.value = value;
    chips.forEach(chip => chip.classList.toggle('on', chip === selected));
    renderCost();
  }
  chips.forEach(chip => chip.addEventListener('click', () => setRides(chip.dataset.rides!, chip)));
  slider.addEventListener('input', () => setRides(slider.value));
  rides.addEventListener('input', () => setRides(rides.value));
  discount.addEventListener('change', renderCost);

  function set(start: string, end: string) {
    if (start) from.set(start);
    if (end) to.set(end);
  }
  from.onchange = to.onchange = renderRoute;
  byId('swapBtn').addEventListener('click', () => set(to.get(), from.get()));
  document.querySelectorAll<HTMLButtonElement>('#s2sPresets button').forEach(button => {
    button.addEventListener('click', () => {
      const [start, end] = button.dataset.pair!.split(',');
      set(start, end);
    });
  });
  onHearingChange(renderRoute);
  window.addEventListener('resize', () => fitMapLabels());
  void renderRoute();
  return { get: () => ({ from: from.get(), to: to.get() }), set };
}

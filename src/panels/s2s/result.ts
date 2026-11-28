import { activeFares, fareCurrent } from '../../core/fares';
import { graph, type Segment } from '../../core/route';
import { renderJourney } from './journey';

export function priceCards(km: number, officialFare?: number): string {
  const oldFare = fareCurrent(km);
  const cards = activeFares().map(scheme => {
    const measured = officialFare !== undefined && scheme.key === 'final';
    const fare = measured ? officialFare : scheme.fn(km);
    const diff = Math.round((fare - oldFare) * 10) / 10;
    const trend = scheme.key === 'cur' || diff === 0 ? 'eq' : diff > 0 ? 'up' : 'down';
    const delta = scheme.key === 'cur' ? '基准（2005 版推算）' : diff === 0 ? '与老方案相同'
      : `比老方案 ${diff > 0 ? '+' : ''}${diff} 元`;
    const name = officialFare === undefined ? scheme.name
      : scheme.name.replace(/^(.+?)（(.+)）$/, '<span class="nm-main">$1</span><span class="nm-sub">$2</span>');
    return `<div class="card ${scheme.key}"><div class="name">${name}</div><div class="price">${fare}<span class="u">元</span></div>`
      + `<div class="delta ${trend}">${measured ? '官方实测 · ' : ''}${delta}</div></div>`;
  }).join('');
  return (officialFare === undefined ? '<div class="cards" style="margin-top:18px">' : '<div class="cards mini">') + cards + '</div>';
}

export function estimateResult(path: string[], km: number): string {
  const segments: Segment[] = [];
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1], to = path[index];
    const line = graph[from][to].l;
    const last = segments.at(-1);
    if (last?.line === line) last.to = to;
    else segments.push({ line, from, to });
  }
  return '<div class="fare-head"><div class="fare-big est">—</div><div class="fare-meta"><div class="fm-1">官方库未收录这一站对</div>'
    + '<div class="fm-2">以下为按站间距推算的里程与规则票价，仅供参考</div></div></div>'
    + renderJourney(segments) + priceCards(km)
    + `<div class="fare-foot"><span class="src">估算：${km.toFixed(2)} 公里 · ${path.length} 站</span></div>`;
}

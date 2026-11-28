import { lineColor, lineSlice, type Segment } from '../../core/route';
import type { MapGeometry } from '../../data/official';
import { openMapViewer } from './map-viewer';

type Point = MapGeometry['st'][string];
type StopKind = 'end' | 'inter' | 'flag';

function stationText(name: string): string {
  return name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function formatPoint(point: Point): string {
  return `${point[0].toFixed(1)},${point[1].toFixed(1)}`;
}

function smoothPath(points: Point[]): string {
  if (!points.length) return '';
  if (points.length < 3) return 'M' + points.map(formatPoint).join('L');
  let path = 'M' + formatPoint(points[0]);
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1], corner = points[index], next = points[index + 1];
    const inX = corner[0] - previous[0], inY = corner[1] - previous[1];
    const outX = next[0] - corner[0], outY = next[1] - corner[1];
    const inLength = Math.hypot(inX, inY), outLength = Math.hypot(outX, outY);
    if (!inLength || !outLength) {
      path += 'L' + formatPoint(corner);
      continue;
    }
    const radius = Math.min(9, inLength / 2, outLength / 2);
    path += 'L' + formatPoint([corner[0] - inX / inLength * radius, corner[1] - inY / inLength * radius]);
    path += 'Q' + formatPoint(corner) + ' ' + formatPoint([corner[0] + outX / outLength * radius, corner[1] + outY / outLength * radius]);
  }
  return path + 'L' + formatPoint(points[points.length - 1]);
}

function officialPath(geometry: MapGeometry['seg'], line: string, stations: string[]): string {
  let path = '';
  for (let index = 1; index < stations.length; index++) {
    const from = stations[index - 1], to = stations[index];
    const forward = geometry[`${from}|${to}|${line}`];
    const edge = forward || geometry[`${to}|${from}|${line}`];
    if (!edge) return '';
    const points = edge.slice(1).split('L');
    if (!forward) points.reverse();
    path += (path ? 'L' : 'M') + points.join('L');
  }
  return path;
}

function routeViewBox(points: Point[]): string {
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  let width = Math.max(maxX - minX, 140), height = Math.max(maxY - minY, 140);
  const padding = Math.max(width, height) * 0.16;
  width += padding * 2;
  height += padding * 2;
  const ratio = window.innerWidth < 900 ? 1.7 : 2.35;
  if (width / height < ratio) width = height * ratio;
  else height = width / ratio;
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  return [centerX - width / 2, centerY - height / 2, width, height].map(value => value.toFixed(1)).join(' ');
}

function stopCircle(name: string, point: Point, kind: StopKind | 'mid', scale: number): string {
  const radius = (kind === 'flag' ? 6.5 : kind === 'mid' ? 3.4 : 4.5) * scale;
  const stroke = (kind === 'mid' ? 1.4 : 1.6) * scale;
  return `<circle class="mstop ${kind}" cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="${radius.toFixed(2)}" stroke-width="${stroke.toFixed(2)}"><title>${stationText(name)}</title></circle>`;
}

export function renderMapBox(geo: MapGeometry, segs: Segment[], from: string, to: string): string {
  const legs = segs.map(segment => {
    const stations = lineSlice(segment.line, segment.from, segment.to);
    const points = stations.map(name => geo.st[name]).filter(point => point !== undefined);
    return { line: segment.line, stations, points };
  });
  const routePoints = legs.flatMap(leg => leg.points.length > 1 ? leg.points : []);
  if (!routePoints.length) return '';
  const viewBox = routeViewBox(routePoints);
  const [left, , width] = viewBox.split(' ').map(Number);
  const scale = Math.max(width / 820, 0.18);

  const base = geo.base.map(path => `<path class="lbase" d="${path}"/>`).join('');
  let route = '';
  for (const { line, stations, points } of legs) {
    let path = officialPath(geo.seg, line, stations);
    if (!path) {
      if (points.length < 2) continue;
      path = smoothPath(points);
    }
    route += `<path class="mhalo" d="${path}" fill="none" stroke-width="${(9 * scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    route += `<path d="${path}" fill="none" stroke="${lineColor(line)}" stroke-width="${(5 * scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const marks: Record<string, StopKind> = {};
  segs.forEach((segment, index) => {
    if (index === 0) marks[segment.from] = 'end';
    marks[segment.to] = index === segs.length - 1 ? 'end' : 'inter';
  });
  marks[from] = 'flag';
  marks[to] = 'flag';
  let stops = '', labels = '';
  for (const [name, kind] of Object.entries(marks)) {
    const point = geo.st[name];
    if (!point) continue;
    stops += stopCircle(name, point, kind, scale);
    const flip = point[0] + 10 * scale + name.length * 7.2 * scale > left + width;
    const labelX = flip ? point[0] - 8 * scale : point[0] + 8 * scale;
    labels += `<text class="mlab-sm${kind === 'inter' ? '' : ' flag'}" x="${labelX.toFixed(1)}" y="${(point[1] + 3.4 * scale).toFixed(1)}" text-anchor="${flip ? 'end' : 'start'}">${stationText(name)}</text>`;
  }

  let mids = '';
  for (const name of new Set(legs.flatMap(leg => leg.stations))) {
    const point = geo.st[name];
    if (point) mids += stopCircle(name, point, 'mid', scale);
  }
  return '<div class="metromap">'
    + '<div class="map-cap"><span>线路图</span><span class="map-hint">高亮为官方推荐路径 · 悬停或点击站点看站名</span><button type="button" class="map-zoom" aria-label="放大线路图">⤢ 放大</button></div>'
    + `<svg viewBox="${viewBox}" data-full="0 0 1000 1400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="上海地铁线路图，高亮 ${stationText(from)} 至 ${stationText(to)} 的官方路径">`
    + base + route + stops + `<g class="mids" style="display:none">${mids}</g><g class="mlabels-sm">${labels}</g></svg></div>`;
}

function dismissOutsideTips(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  let insideOpenTipMap = false;
  for (const tip of document.querySelectorAll('.metromap > .map-tip.on')) {
    if (tip.parentElement?.contains(target)) insideOpenTipMap = true;
    else tip.classList.remove('on');
  }
  if (!insideOpenTipMap) document.removeEventListener('click', dismissOutsideTips);
}

export function wireMap(box: HTMLElement, geo: MapGeometry): void {
  const wrap = box.querySelector<HTMLElement>('.metromap');
  const svg = wrap?.querySelector('svg');
  if (!wrap || !svg || wrap.querySelector('.map-tip')) return;
  wrap.querySelector('.map-zoom')?.addEventListener('click', event => {
    event.stopPropagation();
    openMapViewer(svg, geo.st);
  });

  const tip = document.createElement('div');
  tip.className = 'map-tip';
  wrap.appendChild(tip);
  let current: SVGCircleElement | null = null;
  svg.addEventListener('click', event => {
    const circle = event.target instanceof Element ? event.target.closest<SVGCircleElement>('circle.mstop') : null;
    if (!circle || (circle === current && tip.classList.contains('on'))) {
      tip.classList.remove('on');
      current = null;
      return;
    }
    current = circle;
    const rect = circle.getBoundingClientRect(), parent = wrap.getBoundingClientRect();
    tip.textContent = circle.querySelector('title')?.textContent ?? '';
    tip.style.left = `${rect.left - parent.left + rect.width / 2}px`;
    tip.style.top = `${rect.top - parent.top}px`;
    tip.classList.add('on');
    document.addEventListener('click', dismissOutsideTips);
  });
}

export function fitMapLabels(root: ParentNode = document): void {
  for (const svg of root.querySelectorAll<SVGSVGElement>('.metromap svg')) {
    const viewBox = svg.getAttribute('viewBox');
    if (!viewBox) continue;
    const width = Number(viewBox.split(' ')[2]);
    const fontSize = 11 * width / (svg.clientWidth || 700);
    for (const label of svg.querySelectorAll('.mlab-sm')) {
      label.setAttribute('font-size', fontSize.toFixed(2));
      label.setAttribute('stroke-width', (fontSize * 0.32).toFixed(2));
    }
  }
}

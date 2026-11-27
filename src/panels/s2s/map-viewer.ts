import { METRO_DATA } from '../../data/network';
import type { MapGeometry } from '../../data/official';

type Point = [number, number];
type Box = [number, number, number, number];
type Label = { name: string; point: Point; transfer: boolean; element: SVGTextElement };

const svgNamespace = 'http://www.w3.org/2000/svg';

function parseBox(value: string): Box {
  const [left, top, width, height] = value.split(' ').map(Number);
  return [left, top, width, height];
}

function stationNames(svg: SVGSVGElement, selector: string): Set<string> {
  const names = new Set<string>();
  for (const stop of svg.querySelectorAll(selector)) {
    const title = stop.querySelector('title');
    if (title) names.add(title.textContent ?? '');
  }
  return names;
}

function dotSize(dot: SVGCircleElement): Point {
  const classes = dot.classList;
  if (classes.contains('flag')) return [7, 2.8];
  if (classes.contains('end')) return [5.6, 2.4];
  if (classes.contains('all')) return classes.contains('tr') ? [3.4, 1.7] : [1.6, 1];
  return classes.contains('inter') ? [4.4, 2] : [3.2, 1.1];
}

function createStationLayers(svg: SVGSVGElement, coordinates: MapGeometry['st']) {
  const flags = stationNames(svg, '.mstop.flag');
  const routeMarkers = stationNames(svg, '.mstop.flag, .mstop.inter, .mstop.end');
  const route = stationNames(svg, '.mids circle, .mstop.flag, .mstop.inter, .mstop.end');
  const networkLayer = document.createElementNS(svgNamespace, 'g');
  networkLayer.setAttribute('class', 'netdots');
  networkLayer.style.display = 'none';
  const labelLayer = document.createElementNS(svgNamespace, 'g');
  labelLayer.setAttribute('class', 'mlabels');
  const labels: Label[] = [];

  for (const [name, point] of Object.entries(coordinates)) {
    const transfer = (METRO_DATA.stations[name]?.length ?? 0) > 1;
    const circle = document.createElementNS(svgNamespace, 'circle');
    circle.setAttribute('class', 'mstop all' + (transfer ? ' tr' : ''));
    circle.setAttribute('cx', point[0].toFixed(1));
    circle.setAttribute('cy', point[1].toFixed(1));
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = name;
    circle.appendChild(title);
    networkLayer.appendChild(circle);

    const element = document.createElementNS(svgNamespace, 'text');
    element.setAttribute('class', 'mlab' + (transfer ? ' tr' : ''));
    element.setAttribute('text-anchor', 'start');
    element.setAttribute('dominant-baseline', 'middle');
    element.textContent = name;
    element.style.display = 'none';
    labelLayer.appendChild(element);
    labels.push({ name, point, transfer, element });
  }

  const firstStopLayer = Array.from(svg.children).find(layer => layer.matches('.mstop') || layer.querySelector('.mstop'));
  svg.insertBefore(networkLayer, firstStopLayer ?? null);
  svg.appendChild(labelLayer);
  const dots = svg.querySelectorAll<SVGCircleElement>('circle.mstop');

  function layout(view: Box, width: number, height: number, showMid: boolean, showNet: boolean): void {
    const unitsPerPixel = view[2] / width;
    for (const dot of dots) {
      const [radius, strokeWidth] = dotSize(dot);
      dot.setAttribute('r', (radius * unitsPerPixel).toFixed(2));
      dot.setAttribute('stroke-width', (strokeWidth * unitsPerPixel).toFixed(2));
    }

    const fontSize = width < 620 ? 10 : 11;
    const scaleX = width / view[2];
    const scaleY = height / view[3];
    const padding = 3;
    const placed: Box[] = [];
    function priority(label: Label): number {
      if (flags.has(label.name)) return 0;
      if (showMid && route.has(label.name)) return 1;
      return label.transfer ? 2 : 3;
    }
    for (const { name, point, element } of [...labels].sort((first, second) => priority(first) - priority(second))) {
      const screenX = (point[0] - view[0]) * scaleX;
      const screenY = (point[1] - view[1]) * scaleY;
      if ((!showNet && !routeMarkers.has(name) && !(showMid && route.has(name)))
        || screenX < -40 || screenX > width + 40 || screenY < -20 || screenY > height + 20) {
        element.style.display = 'none';
        continue;
      }

      const boxWidth = name.length * fontSize * 1.06 + 3 + padding * 2;
      const boxHeight = fontSize * 1.18 + 3 + padding * 2;
      const candidates: Point[] = [
        [screenX + 7, screenY - boxHeight / 2],
        [screenX - 7 - boxWidth, screenY - boxHeight / 2],
        [screenX - boxWidth / 2, screenY - 9 - boxHeight],
        [screenX - boxWidth / 2, screenY + 9],
        [screenX + 6, screenY - 7 - boxHeight],
        [screenX + 6, screenY + 6],
        [screenX - 6 - boxWidth, screenY - 7 - boxHeight],
        [screenX - 6 - boxWidth, screenY + 6],
        [screenX + 15, screenY - boxHeight / 2],
        [screenX - 15 - boxWidth, screenY - boxHeight / 2],
        [screenX - boxWidth / 2, screenY - 18 - boxHeight],
        [screenX - boxWidth / 2, screenY + 18],
      ];
      const position = candidates.find(([left, top]) => {
        if (left < 2 || left + boxWidth > width - 2 || top < 2 || top + boxHeight > height - 2) return false;
        return !placed.some(([otherLeft, otherTop, otherWidth, otherHeight]) =>
          left < otherLeft + otherWidth && otherLeft < left + boxWidth
          && top < otherTop + otherHeight && otherTop < top + boxHeight);
      });
      if (!position) {
        element.style.display = 'none';
        continue;
      }
      const [left, top] = position;
      placed.push([left, top, boxWidth, boxHeight]);
      element.setAttribute('x', (view[0] + (left + padding) / scaleX).toFixed(2));
      element.setAttribute('y', (view[1] + (top + boxHeight / 2) / scaleY).toFixed(2));
      element.setAttribute('font-size', (fontSize * unitsPerPixel).toFixed(2));
      element.style.display = '';
    }
  }
  return { networkLayer, layout };
}

export function openMapViewer(srcSvg: SVGSVGElement, coordinates: MapGeometry['st']): void {
  const full = srcSvg.cloneNode(true) as SVGSVGElement;
  full.querySelector('.mlabels-sm')?.remove();
  const fullBounds = srcSvg.getAttribute('data-full') || '0 0 1000 1400';
  const fullBox = parseBox(fullBounds);
  const routeBox = parseBox(srcSvg.getAttribute('viewBox') ?? fullBounds);
  full.removeAttribute('preserveAspectRatio');
  full.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const overlay = document.createElement('div');
  overlay.className = 'mapv';
  overlay.innerHTML = '<div class="mapv-bar"><span>线路图 · 双指或滚轮缩放，拖动平移</span>'
    + '<button type="button" class="mapv-btn" data-z="in" aria-label="放大">＋</button>'
    + '<button type="button" class="mapv-btn" data-z="out" aria-label="缩小">－</button>'
    + '<button type="button" class="mapv-btn" data-z="fit" aria-label="全图">全图</button>'
    + '<button type="button" class="mapv-btn mapv-mid" aria-pressed="false" aria-label="显示沿途站点">沿途站点</button>'
    + '<button type="button" class="mapv-btn mapv-net" aria-pressed="false" aria-label="显示全网站点">全网站点</button>'
    + '<button type="button" class="mapv-close" aria-label="关闭">×</button></div>'
    + '<div class="mapv-stage"></div>';
  const stage = overlay.querySelector<HTMLDivElement>('.mapv-stage')!;
  const midButton = overlay.querySelector<HTMLButtonElement>('.mapv-mid')!;
  const netButton = overlay.querySelector<HTMLButtonElement>('.mapv-net')!;
  stage.appendChild(full);
  document.body.appendChild(overlay);
  document.body.classList.add('map-zoom-open');

  const { networkLayer, layout } = createStationLayers(full, coordinates);
  let layoutTimer: number | undefined;
  function scheduleLayout(): void {
    window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(() => {
      layoutTimer = undefined;
      layout(view, stage.clientWidth || 1, stage.clientHeight || 1,
        midButton.classList.contains('on'), netButton.classList.contains('on'));
    }, 60);
  }
  function apply(): void {
    full.setAttribute('viewBox', view.map(value => value.toFixed(2)).join(' '));
    scheduleLayout();
  }
  function fitAspect([left, top, width, height]: Box): Box {
    const ratio = stage.clientWidth / Math.max(1, stage.clientHeight);
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    if (width / height < ratio) width = height * ratio;
    else height = width / ratio;
    return [centerX - width / 2, centerY - height / 2, width, height];
  }
  let view = fitAspect(routeBox);
  const minWidth = 60;
  const maxWidth = Math.max(view[2], fullBox[2]) * 1.6;
  apply();

  function zoomAt(factor: number, pixelX: number, pixelY: number): void {
    const [left, top, width, height] = view;
    const scale = Math.min(maxWidth, Math.max(minWidth, width * factor)) / width;
    const anchorX = left + width * pixelX / stage.clientWidth;
    const anchorY = top + height * pixelY / stage.clientHeight;
    view = [anchorX - (anchorX - left) * scale, anchorY - (anchorY - top) * scale, width * scale, height * scale];
    apply();
  }
  function panPixels(deltaX: number, deltaY: number): void {
    view[0] -= deltaX * view[2] / stage.clientWidth;
    view[1] -= deltaY * view[3] / stage.clientHeight;
    apply();
  }
  function relativePoint(event: MouseEvent): Point {
    const rect = stage.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  const controller = new AbortController();
  const { signal } = controller;
  stage.addEventListener('wheel', event => {
    event.preventDefault();
    zoomAt(Math.exp(event.deltaY * 0.0015), ...relativePoint(event));
  }, { passive: false, signal });

  const pointers = new Map<number, Point>();
  let lastPoint: Point | undefined;
  let lastDistance = 0;
  let lastMidpoint: Point | undefined;
  let moved = 0;
  function pinch(): { distance: number; midpoint: Point } {
    const [first, second] = pointers.values();
    return {
      distance: Math.hypot(first[0] - second[0], first[1] - second[1]),
      midpoint: [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2],
    };
  }
  stage.addEventListener('pointerdown', event => {
    stage.setPointerCapture(event.pointerId);
    const point = relativePoint(event);
    pointers.set(event.pointerId, point);
    moved = 0;
    if (pointers.size === 1) lastPoint = point;
    if (pointers.size === 2) {
      const { distance, midpoint } = pinch();
      lastDistance = distance;
      lastMidpoint = midpoint;
    }
  }, { signal });
  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const point = relativePoint(event);
    pointers.set(event.pointerId, point);
    if (pointers.size === 1 && lastPoint) {
      const deltaX = point[0] - lastPoint[0];
      const deltaY = point[1] - lastPoint[1];
      panPixels(deltaX, deltaY);
      moved += Math.abs(deltaX) + Math.abs(deltaY);
      lastPoint = point;
    } else if (pointers.size === 2) {
      const { distance, midpoint } = pinch();
      if (lastDistance > 0) zoomAt(lastDistance / distance, ...midpoint);
      if (lastMidpoint) panPixels(midpoint[0] - lastMidpoint[0], midpoint[1] - lastMidpoint[1]);
      lastDistance = distance;
      lastMidpoint = midpoint;
      moved = 99;
    }
  }, { signal });
  function release(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    lastPoint = pointers.size === 1 ? pointers.values().next().value : undefined;
    lastDistance = 0;
    lastMidpoint = undefined;
  }
  stage.addEventListener('pointerup', release, { signal });
  stage.addEventListener('pointercancel', release, { signal });
  stage.addEventListener('dblclick', event => zoomAt(0.5, ...relativePoint(event)), { signal });

  const tip = document.createElement('div');
  tip.className = 'map-tip';
  stage.appendChild(tip);
  full.addEventListener('click', event => {
    const stop = moved > 6 ? null : document.elementFromPoint(event.clientX, event.clientY)?.closest('circle.mstop');
    if (!stop) {
      tip.classList.remove('on');
      return;
    }
    const [left, top] = relativePoint(event);
    tip.textContent = stop.querySelector('title')?.textContent ?? '';
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.classList.add('on');
  }, { signal });

  midButton.addEventListener('click', () => {
    const mids = full.querySelector<SVGGElement>('.mids');
    if (!mids) return;
    const on = mids.style.display === 'none';
    mids.style.display = on ? '' : 'none';
    midButton.classList.toggle('on', on);
    midButton.setAttribute('aria-pressed', String(on));
    scheduleLayout();
  }, { signal });
  netButton.addEventListener('click', () => {
    const on = netButton.classList.toggle('on');
    netButton.setAttribute('aria-pressed', String(on));
    networkLayer.style.display = on ? '' : 'none';
    scheduleLayout();
  }, { signal });
  for (const button of overlay.querySelectorAll<HTMLButtonElement>('.mapv-btn[data-z]')) {
    button.addEventListener('click', () => {
      const centerX = stage.clientWidth / 2;
      const centerY = stage.clientHeight / 2;
      if (button.dataset.z === 'in') zoomAt(0.7, centerX, centerY);
      else if (button.dataset.z === 'out') zoomAt(1 / 0.7, centerX, centerY);
      else {
        view = fitAspect(fullBox);
        apply();
      }
    }, { signal });
  }

  function close(): void {
    controller.abort();
    window.clearTimeout(layoutTimer);
    for (const id of pointers.keys()) {
      if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
    }
    pointers.clear();
    overlay.remove();
    document.body.classList.remove('map-zoom-open');
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); }, { signal });
  overlay.querySelector('.mapv-close')!.addEventListener('click', close, { signal });
  window.addEventListener('resize', () => { view = fitAspect(view); apply(); }, { signal });
}

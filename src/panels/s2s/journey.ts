import { lineColor, lineSlice, type Segment } from '../../core/route';

function text(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderJourney(segs: Segment[]): string {
  let html = '<div class="jny">';
  segs.forEach((segment, index) => {
    const color = lineColor(segment.line);
    const stations = lineSlice(segment.line, segment.from, segment.to);
    const badge = index === 0 ? '<span class="jny-tagline">起点</span>'
      : `<span class="jny-badge${segment.walk ? ' walk' : ''}">${segment.walk ? '出站换乘' : '换乘'}</span>`;
    html += `<div class="jny-stop"><span class="jny-dot" style="--c:${color}"></span>`
      + `<span class="jny-name">${text(segment.from)}</span>${badge}</div>`
      + `<div class="jny-leg" data-leg="${index}" tabindex="0" role="button" aria-expanded="false">`
      + `<span class="jny-line" style="--c:${color}"></span>`
      + `<span class="jny-info"><span class="jny-chip" style="--c:${color}">${text(segment.line)}</span>`
      + (stations.length > 1 ? `<span class="jny-hops">${stations.length - 1} 站</span>` : '')
      + '<span class="jny-more">途经站</span></span>'
      + `<span class="jny-stations">${stations.length ? text(stations.join(' · ')) : '（站序未知）'}</span></div>`;
  });
  const last = segs.at(-1);
  if (last) {
    html += `<div class="jny-stop"><span class="jny-dot end" style="--c:${lineColor(last.line)}"></span>`
      + `<span class="jny-name">${text(last.to)}</span><span class="jny-tagline">终点</span></div>`;
  }
  return html + '</div>';
}

export function wireJourney(box: HTMLElement): void {
  for (const leg of box.querySelectorAll<HTMLElement>('.jny-leg')) {
    const toggle = () => leg.setAttribute('aria-expanded', String(leg.classList.toggle('open')));
    leg.addEventListener('click', toggle);
    leg.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
    });
  }
}

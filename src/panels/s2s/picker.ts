import { LINE_COLORS, LINE_ORDER } from '../../data/lines';
import { METRO_DATA } from '../../data/network';
import { byId } from '../../ui/dom';

const LINE_LIST = LINE_ORDER.filter(line => METRO_DATA.lines[line]?.length);
const stationNames = Object.keys(METRO_DATA.stations);

interface PickerItem {
  value: string;
  sub?: string;
}

interface PickerOptions {
  label: string;
  placeholder: string;
  items(query: string): PickerItem[];
  glyph(value: string): string;
  onPick(value: string): void;
}

function mkPicker(root: HTMLElement, options: PickerOptions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pick-btn';
  button.setAttribute('aria-label', options.label);
  const panel = document.createElement('div');
  panel.className = 'pick-panel';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'pick-search';
  input.placeholder = options.placeholder;
  input.autocomplete = 'off';
  const list = document.createElement('div');
  list.className = 'pick-list';
  panel.append(input, list);
  root.append(button, panel);

  let value = '';
  function renderButton(): void {
    const selected = options.items('').find(item => item.value === value);
    button.innerHTML = (selected
      ? `${options.glyph(value)}<span class="pick-text">${value}</span>`
      : `<span class="pick-ph">${options.label}</span>`) + '<i class="pick-caret"></i>';
  }
  function close(): void {
    panel.classList.remove('open');
  }
  function renderList(): void {
    const items = options.items(input.value.trim());
    list.innerHTML = items.length ? items.map((item, index) =>
      `<div class="pick-item${item.value === value ? ' on' : ''}" data-i="${index}">`
      + `${options.glyph(item.value)}<span class="pick-name">${item.value}</span>`
      + (item.sub ? `<span class="pick-sub">${item.sub}</span>` : '') + '</div>'
    ).join('') : '<div class="pick-empty">没有匹配</div>';
    list.querySelectorAll('.pick-item').forEach((row, index) => {
      row.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        value = items[index].value;
        renderButton();
        close();
        options.onPick(value);
      });
    });
  }
  function open(): void {
    for (const other of document.querySelectorAll('.pick-panel.open')) other.classList.remove('open');
    panel.classList.add('open');
    input.value = '';
    renderList();
    panel.style.left = '0px';
    const rect = button.getBoundingClientRect();
    panel.style.setProperty('--pick-top', `${Math.round(rect.bottom + 6)}px`);
    const viewport = window.innerWidth || document.documentElement.clientWidth;
    if (viewport >= 601) {
      const width = panel.offsetWidth || 268;
      panel.style.left = `${Math.min(0, viewport - 10 - rect.left - width)}px`;
    }
    input.focus();
  }
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (panel.classList.contains('open')) close();
    else open();
  });
  input.addEventListener('input', renderList);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') list.querySelector<HTMLElement>('.pick-item')?.click();
    if (event.key === 'Escape') { close(); button.focus(); }
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Node) || !root.contains(event.target)) close();
  });
  return {
    set(next: string) { value = next; renderButton(); },
    refresh: renderButton,
    rebuild() { if (panel.classList.contains('open')) renderList(); },
  };
}

interface Suggestion {
  name: string;
  pinyin: string;
  score: number;
}

function findSuggestions(query: string): Suggestion[] {
  const matches: Suggestion[] = [];
  for (const name of stationNames) {
    const [pinyin = '', initials = ''] = METRO_DATA.py[name] ?? [];
    let score: number;
    if (name.startsWith(query)) score = 0;
    else if (name.includes(query)) score = 1;
    else if (initials.startsWith(query)) score = 2;
    else if (pinyin.startsWith(query)) score = 3;
    else if (initials.includes(query)) score = 4;
    else if (pinyin.includes(query)) score = 5;
    else continue;
    matches.push({ name, pinyin, score });
  }
  return matches.sort((left, right) => left.score - right.score || left.name.length - right.name.length
    || (left.name < right.name ? -1 : 1)).slice(0, 12);
}

function lineDot(line: string, className: 'ln-dot' | 'pick-dot1'): string {
  return `<span class="${className}" style="background:${LINE_COLORS[line] || '#888'}" title="${line}"></span>`;
}

export interface Endpoint {
  get(): string;
  set(value: string): void;
  onchange?: () => void;
}

export function createEndpoint(prefix: 'from' | 'to', defLine: string, defStation: string): Endpoint {
  const search = byId<HTMLInputElement>(`${prefix}Search`);
  const suggest = byId(`${prefix}Suggest`);
  let line = defLine;
  const initialStations = METRO_DATA.lines[line] ?? [];
  let station = initialStations.includes(defStation) ? defStation : initialStations[0] ?? '';
  const endpoint: Endpoint = { get: () => station, set: selectStation };

  const linePicker = mkPicker(byId(`${prefix}LinePick`), {
    label: '线路', placeholder: '搜索线路',
    items: query => LINE_LIST.filter(name => name.includes(query)).map(value => ({ value })),
    glyph: name => `<span class="pick-chip" style="background:${LINE_COLORS[name] || '#888'}"></span>`,
    onPick(name) {
      line = name;
      const stations = METRO_DATA.lines[line];
      if (!stations.includes(station)) station = stations[0];
      stationPicker.set(station);
      stationPicker.rebuild();
      endpoint.onchange?.();
    },
  });
  const stationPicker = mkPicker(byId(`${prefix}SelPick`), {
    label: '站点', placeholder: '搜索站名 / 拼音',
    items(query) {
      const term = query.toLowerCase();
      const pool = term ? stationNames : METRO_DATA.lines[line] ?? [];
      const matches: PickerItem[] = [];
      for (const name of pool) {
        const [pinyin = '', initials = ''] = METRO_DATA.py[name] ?? [];
        if (term && !name.includes(term) && !pinyin.includes(term) && !initials.includes(term)) continue;
        matches.push({ value: name, sub: pinyin });
        if (term && matches.length === 40) break;
      }
      return matches;
    },
    glyph(name) {
      const lines = [...(METRO_DATA.stations[name] ?? [])];
      const current = lines.indexOf(line);
      if (current > 0) { lines.splice(current, 1); lines.unshift(line); }
      if (!lines.length) lines.push(line);
      return `<span class="pick-dots">${lines.slice(0, 4).map(name => lineDot(name, 'pick-dot1')).join('')}</span>`;
    },
    onPick(name) {
      station = name;
      const lines = METRO_DATA.stations[name];
      if (lines.length && !lines.includes(line)) { line = lines[0]; linePicker.set(line); }
      stationPicker.refresh();
      endpoint.onchange?.();
    },
  });

  function selectStation(name: string): void {
    if (!Object.hasOwn(METRO_DATA.stations, name)) return;
    const lines = METRO_DATA.stations[name];
    if (!lines.includes(line)) line = lines[0];
    station = name;
    linePicker.set(line);
    stationPicker.set(station);
    search.value = '';
    suggest.classList.remove('open');
    endpoint.onchange?.();
  }

  let suggestions: Suggestion[] = [];
  let highlighted = -1;
  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase();
    suggestions = term ? findSuggestions(term) : [];
    highlighted = -1;
    suggest.classList.toggle('open', !!term);
    if (!term) { suggest.replaceChildren(); return; }
    suggest.innerHTML = suggestions.length ? suggestions.map(({ name, pinyin }, index) => {
      const dots = METRO_DATA.stations[name].map(line => lineDot(line, 'ln-dot')).join('');
      return `<div class="sg-item" data-i="${index}">${dots}<span>${name}</span><span class="py">${pinyin}</span></div>`;
    }).join('') : '<div class="sg-empty">没有匹配的车站</div>';
    suggest.querySelectorAll('.sg-item').forEach((row, index) => {
      row.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectStation(suggestions[index].name);
      });
    });
  });
  search.addEventListener('blur', () => window.setTimeout(() => suggest.classList.remove('open'), 150));
  search.addEventListener('keydown', event => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') highlighted = Math.min(suggestions.length - 1, highlighted + 1);
    else if (event.key === 'ArrowUp') highlighted = Math.max(0, highlighted - 1);
    else if (event.key === 'Enter') {
      if (highlighted >= 0) selectStation(suggestions[highlighted].name);
      return;
    } else return;
    event.preventDefault();
    suggest.querySelectorAll('.sg-item').forEach((row, index) => row.classList.toggle('on', index === highlighted));
  });
  linePicker.set(line);
  stationPicker.set(station);
  return endpoint;
}

#!/usr/bin/env python3
"""构建精确线网图 v2：支持支线（里程重置/双里程标注）+ 线路站序 + 拼音索引。

数据源: 中文维基百科各线路词条"车站列表"（官方设计/环评资料，米级）

支线处理规则:
- 表格内里程下降 => 新段(segment)开始
- 新段首站里程>0（如5号线金平路12575）: 与主线同一里程基准，接到"里程最接近且小于它"的既有站（东川路11116）
- 新段首站里程=0（如10号线虹桥火车站、11号线嘉定北）: 独立基准；由后续"双里程站"连接——
  里程格形如 '''7750<br/>(18327)''' 的站，括号值是支线基准里程，接到上一段末站（上海赛车场15240 -> 嘉定新城, d=3087）
"""
import json, re, math, heapq
from collections import defaultdict

LINES = ['1号线','2号线','3号线','4号线','5号线','6号线','7号线','8号线','9号线',
         '10号线','11号线','12号线','13号线','14号线','15号线','16号线','17号线',
         '18号线','浦江线']

def clean(name):
    return name.strip().replace('　','').replace(' ','')

def parse_line(ln):
    """返回 [(name, cum, paren_cum_or_None)], total_len"""
    wt = json.load(open(f'/opt/data/workspace/wiki/{ln}.json', encoding='utf-8'))['parse']['wikitext']
    ll = re.search(r'linelength\s*=\s*\{\{convert\|([\d.]+)\|km', wt)
    total_len = float(ll.group(1)) * 1000 if ll else None
    inst = False; stations = []; pending = None
    for line in wt.split('\n'):
        if '车站列表' in line: inst = True; continue
        if not inst: continue
        if re.match(r'^==[^=]', line): break
        m = re.search(r'\{\{stl\|上海地铁\|([^}|]+)\}\}', line)
        if m: pending = clean(m.group(1)); continue
        if pending:
            mm = re.search(r"'''([\d.]+)", line)  # 首个加粗数字（容忍 <br/> 后缀）
            if mm:
                cum = float(mm.group(1))
                pp = re.search(r"\((\d+(?:\.\d+)?)\)", line)  # 括号双里程（支线基准）
                paren = float(pp.group(1)) if pp else None
                if not stations or stations[-1][0] != pending:
                    stations.append((pending, cum, paren))
                pending = None
    return stations, total_len

edges = {}   # (a,b) -> (d, line)
def add_edge(a, b, d, ln):
    if a == b or d <= 0: return
    key = tuple(sorted((a, b)))
    if key not in edges or d < edges[key][0]:
        edges[key] = (round(d), ln)

all_lines = {}
name_lines = defaultdict(set)
line_order = {}   # 线路 -> 站名顺序（表格顺序）

for ln in LINES:
    st, total = parse_line(ln)
    if not st or len(st) < 2:
        print(f'{ln}: 解析失败!'); continue
    all_lines[ln] = (st, total)
    order = []
    for name, cum, paren in st:
        if name not in order: order.append(name)
        name_lines[name].add(ln)
    line_order[ln] = order

    # 分段（里程下降 => 新段）
    segments = []; cur = [st[0]]
    for i in range(1, len(st)):
        if st[i][1] < cur[-1][1]:
            segments.append(cur); cur = [st[i]]
        else:
            cur.append(st[i])
    segments.append(cur)

    # 段内相邻边
    for seg in segments:
        for i in range(len(seg)-1):
            add_edge(seg[i][0], seg[i+1][0], seg[i+1][1]-seg[i][1], ln)

    # 段间连接
    for k in range(1, len(segments)):
        first = segments[k][0]
        if first[1] > 0:
            # 同基准支线：接最接近且小于首站里程的既有站
            cands = [(n, c) for seg in segments[:k] for (n, c, p) in seg if c < first[1]]
            if cands:
                bn, bc = max(cands, key=lambda x: x[1])
                add_edge(bn, first[0], first[1]-bc, ln)
                print(f'  {ln} 支线接点(同基准): {bn}({bc:.0f}) -> {first[0]}({first[1]:.0f}) = {first[1]-bc:.0f}m')
    # 双里程站：括号值 = 支线基准，接上一段末站
    for k, seg in enumerate(segments):
        for (n, c, p) in seg:
            if p is None: continue
            # 找其他段中末站里程 < p 且最接近的
            cands = []
            for j, s2 in enumerate(segments):
                if j == k: continue
                last = s2[-1]
                if last[1] < p: cands.append(last)
            if cands:
                bn, bc, _ = max(cands, key=lambda x: x[1])
                add_edge(bn, n, p-bc, ln)
                print(f'  {ln} 支线接点(双里程): {bn}({bc:.0f}) -> {n}(支线基准{p:.0f}) = {p-bc:.0f}m')

    # 环线闭合（4号线）
    if ln == '4号线' and total:
        first, last = st[0], st[-1]
        closure = round(total - last[1])
        if 0 < closure < 3000:
            add_edge(last[0], first[0], closure, ln)
            print(f'  4号线环线闭合: {last[0]} -> {first[0]} = {closure}m')

stations_out = {name: sorted(lines, key=LINES.index) for name, lines in name_lines.items()}
edges_out = [{'a': a, 'b': b, 'd': d, 'l': l} for (a, b), (d, l) in edges.items()]
print(f'\n物理站: {len(stations_out)}, 边: {len(edges_out)}')

# ===== 拼音索引 =====
import sys
sys.path.insert(0, '/opt/data/workspace/.venv-py/lib/python3.13/site-packages')
from pypinyin import lazy_pinyin, Style
py_index = {}
for name in stations_out:
    # 去掉分隔符号取纯汉字部分做拼音
    base = re.sub(r'[·．.\d]+', '', name)
    full = ''.join(lazy_pinyin(name))
    init = ''.join(lazy_pinyin(name, style=Style.FIRST_LETTER))
    py_index[name] = [full, init]
print('拼音样例:', {k: py_index[k] for k in ['人民广场','莘庄','徐家汇','蟠祥路·国家会计学院'] if k in py_index})

# ===== 连通性 & Dijkstra 验证 =====
graph = defaultdict(dict)
for e in edges_out:
    graph[e['a']][e['b']] = e['d']; graph[e['b']][e['a']] = e['d']

from collections import deque
start = next(iter(stations_out))
seen = {start}; q = deque([start])
while q:
    u = q.popleft()
    for v in graph[u]:
        if v not in seen: seen.add(v); q.append(v)
iso = [s for s in stations_out if s not in seen]
print(f'连通性: {len(seen)}/{len(stations_out)} 可达, 孤立: {iso}')

def dijkstra(src):
    dist = {src: 0.0}; prev = {src: None}; pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, 1e18): continue
        for v, w in graph.get(u, {}).items():
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    return dist, prev

def fare_cur(km): return 3 if km <= 6 else 3 + math.ceil((km-6)/10)

print('\n=== 验证（含支线场景）===')
tests = [('人民广场','徐家汇'),('上海南站','虹桥火车站'),('莘庄','富锦路'),
         ('人民广场','迪士尼'),('虹桥火车站','浦东1号2号航站楼'),
         ('莘庄','闵行开发区'),('莘庄','奉贤新城'),          # 5号线支线
         ('航中路','虹桥火车站'),('航中路','龙柏新村'),      # 10号线支线
         ('花桥','嘉定北'),('花桥','迪士尼'),('嘉定新城','马陆')]  # 11号线支线
for a, b in tests:
    if a not in graph or b not in graph:
        print(f'{a} -> {b}: ✗ 站不存在'); continue
    dist, prev = dijkstra(a)
    if b not in dist:
        print(f'{a} -> {b}: ✗ 不可达'); continue
    km = dist[b]/1000
    print(f'{a} -> {b}: {km:.2f}km  现状票价{fare_cur(km)}元')

data = {'stations': stations_out, 'edges': edges_out, 'lines': line_order, 'py': py_index}
json.dump(data, open('/opt/data/workspace/metro_data.json', 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
import os
print(f"\nmetro_data.json: {os.path.getsize('/opt/data/workspace/metro_data.json')} bytes")

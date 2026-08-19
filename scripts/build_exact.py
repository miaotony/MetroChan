#!/usr/bin/env python3
"""用维基官方站间距构建精确线网图，输出网页内嵌 JSON。

数据源: 中文维基百科各线路词条"车站列表"（站间距来自官方设计/环评资料，米级）
图: 站名合并（换乘站同名跨线），边 = 相邻站里程(米) + 所属线路
"""
import json, re, math, heapq
from collections import defaultdict

LINES = ['1号线','2号线','3号线','4号线','5号线','6号线','7号线','8号线','9号线',
         '10号线','11号线','12号线','13号线','14号线','15号线','16号线','17号线',
         '18号线','浦江线']

def clean(name):
    return name.strip().replace('　','').replace(' ','')

def parse_line(ln):
    wt = json.load(open(f'/opt/data/workspace/wiki/{ln}.json', encoding='utf-8'))['parse']['wikitext']
    # 线路全长（米）用于环线闭合
    ll = re.search(r'linelength\s*=\s*\{\{convert\|([\d.]+)\|km', wt)
    total_len = float(ll.group(1)) * 1000 if ll else None
    inst = False; stations = []; pending = None
    for line in wt.split('\n'):
        if '车站列表' in line: inst = True; continue
        if not inst: continue
        if re.match(r'^==[^=]', line): break
        m = re.search(r'\{\{stl\|上海地铁\|([^}|]+)\}\}', line)
        if m: pending = clean(m.group(1)); continue
        if pending and re.search(r"'''\d+(?:\.\d+)?'''", line):
            cum = float(re.search(r"'''(\d+(?:\.\d+)?)'''", line).group(1))
            if not stations or stations[-1][0] != pending:
                stations.append((pending, cum))
            pending = None
    return stations, total_len

# 解析
all_lines = {}
name_lines = defaultdict(set)
for ln in LINES:
    st, total = parse_line(ln)
    if not st or len(st) < 2:
        print(f'{ln}: 解析失败'); continue
    all_lines[ln] = (st, total)
    for name, cum in st:
        name_lines[name].add(ln)

# 构建边（同线相邻站），保留线路
edges = {}  # (a,b) -> (d米, line)
for ln, (st, total) in all_lines.items():
    for i in range(len(st)-1):
        a, ca = st[i]; b, cb = st[i+1]
        d = round(abs(cb - ca))
        key = tuple(sorted((a, b)))
        if key not in edges or d < edges[key][0]:
            edges[key] = (d, ln)
    # 环线闭合（4号线）
    if ln == '4号线' and total:
        first, last = st[0], st[-1]
        closure = round(total - last[1])
        if 0 < closure < 3000:
            key = tuple(sorted((last[0], first[0])))
            edges[key] = (closure, ln)
            print(f'4号线闭合 {last[0]}->{first[0]} = {closure}m')

# 输出数据
stations_out = {name: sorted(lines) for name, lines in name_lines.items()}
edges_out = [{'a': a, 'b': b, 'd': d, 'l': l} for (a, b), (d, l) in edges.items()]
data = {'stations': stations_out, 'edges': edges_out}

print(f'物理站: {len(stations_out)}, 边: {len(edges_out)}')

# 验证 Dijkstra（里程权重）
graph = defaultdict(dict)
for e in edges_out:
    graph[e['a']][e['b']] = e['d']; graph[e['b']][e['a']] = e['d']

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

def path(prev, dst):
    p = []
    while dst is not None: p.append(dst); dst = prev[dst]
    return p[::-1]

def fare_cur(km): return 3 if km <= 6 else 3 + math.ceil((km - 6) / 10)
def fare_p1(km):
    steps = [4,4,4,7,7,7,10,10,10]; price = 3; k = 4
    for s in steps:
        if km <= k: return price
        k += s; price += 1
    if km <= 67: return price
    return price + math.ceil((km - 67) / 15)
def fare_p2(km):
    steps = [6,8,8,10,10,12,12]; price = 4; k = 6
    for s in steps:
        if km <= k: return price
        k += s; price += 1
    if km <= 72: return price
    return price + math.ceil((km - 72) / 14)

print('\n=== 站到站验证（精确里程）===')
tests = [('人民广场','徐家汇'),('人民广场','南京东路'),('上海南站','虹桥火车站'),
         ('莘庄','富锦路'),('徐家汇','陆家嘴'),('人民广场','迪士尼'),
         ('虹桥火车站','浦东1号2号航站楼'),('上海南站','上海火车站'),
         ('人民广场','世纪大道'),('东方体育中心','虹桥火车站')]
for a, b in tests:
    if a not in graph or b not in graph:
        print(f'{a} -> {b}: 站不存在'); continue
    dist, prev = dijkstra(a)
    if b not in dist:
        print(f'{a} -> {b}: 不可达'); continue
    km = dist[b] / 1000
    p = path(prev, b)
    print(f'{a} -> {b}: {km:.2f}km ({len(p)}站)  票价: 现{fare_cur(km)} 一{fare_p1(km)} 二{fare_p2(km)}')

json.dump(data, open('/opt/data/workspace/metro_data.json', 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print(f'\n已保存 metro_data.json: {len(data["stations"])}站 {len(data["edges"])}边')

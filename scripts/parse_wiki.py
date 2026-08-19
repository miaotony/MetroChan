#!/usr/bin/env python3
"""解析维基百科各线路词条的车站列表（状态机，站名与里程分行）。"""
import json, re, os

LINES = ['1号线','2号线','3号线','4号线','5号线','6号线','7号线','8号线','9号线',
         '10号线','11号线','12号线','13号线','14号线','15号线','16号线','17号线',
         '18号线','浦江线']

def clean_station(name):
    name = name.strip().replace('　','').replace(' ', '')
    if name.endswith('站') and len(name) > 2:
        name = name[:-1]
    return name

def parse_line(ln):
    path = f'/opt/data/workspace/wiki/{ln}.json'
    if not os.path.exists(path):
        return None
    wt = json.load(open(path, encoding='utf-8'))['parse']['wikitext']
    lines = wt.split('\n')
    in_station = False
    stations = []
    pending_name = None
    for line in lines:
        if '车站列表' in line:
            in_station = True
            continue
        if not in_station:
            continue
        if re.match(r'^==[^=]', line):
            break
        # 站名行
        m = re.search(r'\{\{stl\|上海地铁\|([^}|]+)\}\}', line)
        if m:
            pending_name = clean_station(m.group(1))
            continue
        # 里程行（加粗数字）
        if pending_name and re.search(r"'''\d+(?:\.\d+)?'''", line):
            mm = re.search(r"'''(\d+(?:\.\d+)?)'''", line)
            cum = float(mm.group(1))
            if not stations or stations[-1][0] != pending_name:
                stations.append((pending_name, cum))
            pending_name = None
            continue
    return stations

all_lines = {}
for ln in LINES:
    st = parse_line(ln)
    if st and len(st) >= 2:
        all_lines[ln] = st
        # 站间距 = 相邻站累计里程差
        gaps = [round(st[i+1][1]-st[i][1]) for i in range(len(st)-1)]
        print(f'{ln}: {len(st)}站 总长{st[-1][1]/1000:.2f}km 首={st[0][0]} 末={st[-1][0]}')
    else:
        print(f'{ln}: 解析失败 ({len(st) if st else 0}站)')

json.dump(all_lines, open('/opt/data/workspace/wiki_stations.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n总线路数:', len(all_lines))

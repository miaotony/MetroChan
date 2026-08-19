#!/usr/bin/env python3
"""template.html + data/metro_data.json -> index.html"""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tpl = open(os.path.join(root, 'template.html'), encoding='utf-8').read()
data = json.load(open(os.path.join(root, 'data/metro_data.json'), encoding='utf-8'))
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
out = tpl.replace('__METRO_DATA__', js)
assert '__METRO_DATA__' not in out
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(out)
print(f'index.html: {len(out)} chars')

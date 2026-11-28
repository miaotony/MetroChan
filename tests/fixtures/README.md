# Route baseline

`routes.ts` freezes results from the original MetroChan revision `518a2400ac6cacab8e97b809f4c7bc0a8bd44779`. Official fares, minutes, transfers and recommendations come from the 2026-11-24 `data/stations.json` index and `data/paths` shards. Distances, old fares, selectable names and ordered hops use the `METRO_DATA` embedded in that revision’s `index.html`, not the nonidentical `data/metro_data.json`. The tests do not read the application or its data files to construct expected results.

- **Direct:** 龙华 → 东方体育中心 costs ¥3 officially, even though its unrounded 4.043 km would cost ¥4 under the new distance rule.
- **Transfer and long:** both recommendations are ordered as shown, not sorted by travel time. The pricing distance stays the same when the displayed itinerary changes.
- **Branch:** 马陆 → 上海赛车场 is the reverse of its stored direction. Line 11 goes through 嘉定新城, not along the 嘉定北 arm.
- **Missing:** 浦东3号航站楼 is selectable on Line 2 but absent from the official index. From 川沙 the UI estimates 17.48 km and six stations, without blocking requests or removing data.

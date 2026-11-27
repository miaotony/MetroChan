import assert from 'node:assert/strict';
import test from 'node:test';
import { dijkstra, graph, lineColor, lineSlice, parseOfficialPath } from '../../src/core/route.ts';

test('shortest paths use track metres, not the fewest stops, in either direction', () => {
  const trips = [
    [4109, ['人民广场', '大世界', '老西门', '一大会址·新天地', '马当路', '打浦桥']],
    [4043, ['龙华', '云锦路', '龙耀路', '东方体育中心']],
  ];
  for (const [metres, path] of trips) {
    for (const stops of [path, path.toReversed()]) {
      const { dist, prev } = dijkstra(stops[0]);
      assert.equal(dist[stops[0]], 0);
      assert.equal(prev[stops[0]], undefined);
      assert.equal(dist[stops.at(-1)], metres);
      assert.deepEqual(stops.slice(1).map(stop => prev[stop]), stops.slice(0, -1));
    }
  }
  assert.equal(dijkstra('滴水湖').dist['西岑'], 123516);
});

test('equal-distance arrivals keep the original predecessor rather than replacing it', () => {
  const { dist, prev } = dijkstra('同济大学');
  assert.equal(dist['三林'] + graph['三林']['三林东'].d, 21476);
  assert.equal(dist['浦三路'] + graph['浦三路']['三林东'].d, 21476);
  assert.equal(dist['三林东'], 21476);
  assert.equal(prev['三林东'], '浦三路');
});

test('Line 11 crosses between branches at 嘉定新城, not between adjacent entries in a station list', () => {
  const stops = ['嘉定西', '白银路', '嘉定新城', '上海赛车场'];
  assert.deepEqual(lineSlice('11号线', '嘉定西', '上海赛车场'), stops);
  assert.deepEqual(lineSlice('11号线', '上海赛车场', '嘉定西'), stops.toReversed());
  assert.deepEqual(lineSlice('11号线', '马陆', '上海赛车场'), ['马陆', '嘉定新城', '上海赛车场']);
});

test('Line 4 takes the short arc across the ring closure and includes track shared with Line 3', () => {
  const arc = ['上海体育场', '上海体育馆', '宜山路', '虹桥路'];
  assert.deepEqual(lineSlice('4号线', arc[0], arc.at(-1)), arc);
  assert.deepEqual(lineSlice('4号线', arc.at(-1), arc[0]), arc.toReversed());
  assert.deepEqual(graph['中潭路']['上海火车站'], { d: 1727, l: '3号线' });
  assert.deepEqual(graph['上海火车站']['中潭路'], { d: 1727, l: '3号线' });
  assert.deepEqual(lineSlice('4号线', '中潭路', '上海火车站'), ['中潭路', '上海火车站']);
});

test('equally short arcs on Line 4 retain their original traversal order', () => {
  const arc = lineSlice('4号线', '宜山路', '杨树浦路');
  assert.equal(arc.length, 14);
  assert.equal(arc[1], '虹桥路');
  assert.equal(arc.at(-2), '大连路');
});

test('official walk interchanges carry forward the preceding stop and flag only the walking leg', () => {
  assert.deepEqual(parseOfficialPath('1号线人民广场至上海火车站， 出站换乘3号线至中潭路。'), [
    { line: '1号线', from: '人民广场', to: '上海火车站', walk: false },
    { line: '3号线', from: '上海火车站', to: '中潭路', walk: true },
  ]);
  assert.deepEqual(parseOfficialPath('8号线人民广场至东方体育中心, 换乘11号线至迪士尼。 '), [
    { line: '8号线', from: '人民广场', to: '东方体育中心', walk: false },
    { line: '11号线', from: '东方体育中心', to: '迪士尼', walk: false },
  ]);
  assert.deepEqual(parseOfficialPath('没有推荐路径。'), []);
});

test('single-station legs, unknown lines and non-network transfers retain their display fallbacks', () => {
  assert.deepEqual(lineSlice('2号线', '人民广场', '人民广场'), ['人民广场']);
  assert.deepEqual(lineSlice('2号线', '人民广场', '迪士尼'), []);
  assert.deepEqual(lineSlice('市域机场线', '上海南站', '康桥东'), []);
  assert.equal(lineColor('11号线'), '#871C2B');
  assert.equal(lineColor('市域机场线'), '#b0b0b0');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCosts } from '../../src/core/cost.ts';
import { FARES } from '../../src/core/fares.ts';
import { getHearing, setHearing } from '../../src/core/hearing.ts';
import { renderCostTable } from '../../src/ui/cost-table.ts';

const adopted = FARES.filter(scheme => !scheme.hearing);

test('only the spend above each monthly threshold gets 10% off', () => {
  for (const [key, km, ridesAtLimit, threshold] of [
    ['cur', 25, 14, 70], ['final', 10, 18, 90], ['p1', 10, 20, 100], ['p2', 10, 20, 100],
  ]) {
    const cost = (rides, useDisc) => calculateCosts(km, rides, useDisc, FARES).rows
      .find(row => row.kind === 'single' && row.scheme.key === key).cost;
    assert.equal(cost(ridesAtLimit - 1, true), threshold - 5, key);
    assert.equal(cost(ridesAtLimit, true), threshold, key);
    assert.equal(cost(ridesAtLimit + 1, true), threshold + 4.5, key);
    assert.equal(cost(ridesAtLimit + 1, false), threshold + 5, key);
  }
});

test('ranking excludes the cheaper old fare and retains the first eligible row on ties', () => {
  const { rows, best } = calculateCosts(16, 1, false, FARES);
  assert.deepEqual(rows.filter(row => row.kind === 'single').map(row => row.cost), [4, 6, 6, 6]);
  assert.equal(best.scheme.key, 'final');
  assert.equal(calculateCosts(25.841, 1, false, adopted).best.scheme.key, 'final');
  assert.equal(calculateCosts(25.841, 1, false, FARES).best.scheme.key, 'p2');

  const tiedPasses = calculateCosts(50, 37, true, adopted);
  const passes = tiedPasses.rows.filter(row => row.kind === 'pass');
  assert.deepEqual(passes.slice(0, 2).map(row => row.cost), [210, 210]);
  assert.equal(tiedPasses.best.pass.rides, 35);
});

test('all four passes include their last ride and charge the full new fare for each extra ride', () => {
  for (const [capacity, price] of [[35, 190], [45, 210], [60, 270], [90, 390]]) {
    for (const useDisc of [false, true]) {
      const passFor = rides => calculateCosts(25.841, rides, useDisc, FARES).rows
        .find(row => row.kind === 'pass' && row.pass.rides === capacity);
      const included = passFor(capacity);
      assert.deepEqual([included.extraRides, included.cost], [0, price]);
      const combo = passFor(capacity + 2);
      assert.deepEqual([combo.extraRides, combo.cost], [2, price + 16]);
    }
  }
});

test('the 52-ride cost table preserves the original labels, badges, rounding and row order', context => {
  const original = getHearing();
  context.after(() => setHearing(original));
  setHearing(false);
  const container = { innerHTML: '' };
  renderCostTable(container, 25.841, 52, true);
  assert.equal(container.innerHTML, [
    '<table class="cost"><thead><tr><th>方案</th><th>单价</th><th>月成本</th><th>均次</th><th>对比最低</th></tr></thead><tbody>',
    '<tr><td>老方案（2005 版）（单程）<span class="badge est">推算</span></td><td>5 元/次</td><td class="cst">¥ 241.0</td><td>¥ 4.6</td><td>不参与评比</td></tr>',
    '<tr><td>新方案（2026-12）（单程）</td><td>8 元/次</td><td class="cst">¥ 383.4</td><td>¥ 7.4</td><td>+¥ 117.4</td></tr>',
    '<tr><td>计次票 35 次<span class="badge combo">组合</span></td><td>190 元 + 17 次单程</td><td class="cst">¥ 326.0</td><td>¥ 6.3</td><td>+¥ 60.0</td></tr>',
    '<tr class="best"><td>计次票 45 次<span class="badge">最低</span><span class="badge combo">组合</span></td><td>210 元 + 7 次单程</td><td class="cst">¥ 266.0</td><td>¥ 5.1</td><td>最低</td></tr>',
    '<tr><td>计次票 60 次</td><td>270 元/30天</td><td class="cst">¥ 270.0</td><td>¥ 5.2</td><td>+¥ 4.0</td></tr>',
    '<tr><td>计次票 90 次</td><td>390 元/30天</td><td class="cst">¥ 390.0</td><td>¥ 7.5</td><td>+¥ 124.0</td></tr>',
    '</tbody></table>',
  ].join(''));
});

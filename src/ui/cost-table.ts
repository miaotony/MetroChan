import { calculateCosts } from '../core/cost.ts';
import { activeFares } from '../core/fares.ts';

export function renderCostTable(container: Element, km: number, rides: number, useDisc: boolean): void {
  const { rows, best } = calculateCosts(km, rides, useDisc, activeFares());
  const body = rows.map(row => {
    const isBest = row === best;
    const estimated = row.kind === 'single' && row.scheme.key === 'cur';
    const combo = row.kind === 'pass' && row.extraRides > 0;
    const label = row.kind === 'single' ? `${row.scheme.name}（单程）` : `计次票 ${row.pass.rides} 次`;
    const detail = row.kind === 'single' ? `${row.unitFare} 元/次`
      : combo ? `${row.pass.price} 元 + ${row.extraRides} 次单程` : `${row.pass.price} 元/30天`;
    const delta = row.cost - best.cost;
    const difference = estimated ? '不参与评比' : isBest ? '最低'
      : delta >= 0 ? `+¥ ${delta.toFixed(1)}` : `−¥ ${Math.abs(delta).toFixed(1)}`;
    return `<tr${isBest ? ' class="best"' : ''}><td>${label}`
      + (estimated ? '<span class="badge est">推算</span>' : '')
      + (isBest ? '<span class="badge">最低</span>' : '')
      + (combo ? '<span class="badge combo">组合</span>' : '')
      + `</td><td>${detail}</td><td class="cst">¥ ${row.cost.toFixed(1)}</td>`
      + `<td>¥ ${(row.cost / rides).toFixed(1)}</td><td>${difference}</td></tr>`;
  }).join('');
  container.innerHTML = '<table class="cost"><thead><tr>'
    + '<th>方案</th><th>单价</th><th>月成本</th><th>均次</th><th>对比最低</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

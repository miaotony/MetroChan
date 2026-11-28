import { fareCurrent, fareFinal } from '../core/fares';

function maxKm(fare: (km: number) => number, price: number): number {
  let best = 0;
  for (let km = 1; km <= 220; km++) {
    if (fare(km) <= price) best = km;
  }
  return best;
}

export function initChange(): void {
  const comparison = document.querySelector('#cmpTable tbody');
  if (comparison) {
    let rows = '';
    for (let price = 3; price <= 15; price++) {
      const current = maxKm(fareCurrent, price);
      const final = maxKm(fareFinal, price);
      const difference = final - current;
      const deltaClass = difference === 0 ? 'dzero' : difference < 0 ? 'dneg' : '';
      const delta = difference === 0 ? '不变' : `${difference > 0 ? '+' : ''}${difference} 公里`;
      rows += `<tr><td>${price} 元</td><td>≤ ${current} 公里</td><td>≤ ${final} 公里</td>`
        + `<td class="${deltaClass}">${delta}</td></tr>`;
    }
    comparison.innerHTML = rows;
  }

  const grid = document.querySelector('#ticketGrid');
  if (grid) {
    const tickets = [{ rides: 35, price: 190 }, { rides: 45, price: 210 }, { rides: 60, price: 270 }, { rides: 90, price: 390 }];
    let markup = tickets.map(({ rides, price }) => {
      return `<div class="ticket"><div class="tk-name">计次票 ${rides} 次</div>`
        + `<div class="tk-price">${price}<small>元</small></div>`
        + `<div class="tk-per">折合 <b>${(price / rides).toFixed(2)}</b> 元/次</div></div>`;
    }).join('');
    markup += '<div class="ticket"><div class="tk-name">一日票</div><div class="tk-price">24<small>元</small></div><div class="tk-per">首次进站起 24 小时不限次</div></div>';
    markup += '<div class="ticket"><div class="tk-name">三日票</div><div class="tk-price">60<small>元</small></div><div class="tk-per">72 小时内不限次</div></div>';
    markup += '<div class="ticket"><div class="tk-name">联程日票（随申行）</div><div class="tk-price">26<small>元</small></div><div class="tk-per">24 小时地铁 + 公交 + 轮渡</div></div>';
    markup += '<div class="ticket"><div class="tk-name">联程三日票（随申行）</div><div class="tk-price">62<small>元</small></div><div class="tk-per">72 小时地铁 + 公交 + 轮渡</div></div>';
    markup += '<div class="ticket"><div class="tk-name">联程七日票（随申行）</div><div class="tk-price">112<small>元</small></div><div class="tk-per">168 小时地铁 + 公交 + 轮渡</div></div>';
    grid.innerHTML = markup;
  }
}

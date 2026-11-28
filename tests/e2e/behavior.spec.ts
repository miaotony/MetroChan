import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { routeCases, type RouteCase, type RoutePlan } from '../fixtures/routes';

async function selectStation(page: Page, side: 'from' | 'to', station: string) {
  await page.locator(`#${side}Search`).fill(station);
  await page.locator(`#${side}Suggest`).getByText(station, { exact: true }).click();
}

async function selectDisneyPreset(page: Page) {
  await page.getByRole('button', { name: '人民广场 → 迪士尼', exact: true }).click();
  await expect(page.locator('#routeResult .jny-name')).toHaveText(['人民广场', '东方体育中心', '迪士尼']);
}

async function expectPlan(result: Locator, route: RouteCase, plan: RoutePlan) {
  await expect(result.locator('.jny-name')).toHaveText([route.from, ...plan.via, route.to]);
  await expect(result.locator('.jny-chip')).toHaveText(plan.lines);
  await expect(result.locator('.jny-hops')).toHaveText(plan.hops.map(hops => `${hops} 站`));
  await expect(result.locator('.fm-2')).toContainText(plan.summary);

  if (plan.firstLegStations) {
    const leg = result.getByRole('button', { name: /途经站/ }).first();
    const stations = leg.locator('.jny-stations');
    await expect(stations).toBeHidden();
    await leg.press('Enter');
    await expect(stations).toBeVisible();
    await expect(stations).toHaveText(plan.firstLegStations.join(' · '));
  }
}

for (const [kind, route] of Object.entries(routeCases)) {
  test(`${kind}: ${route.from} → ${route.to}`, async ({ page }) => {
    await page.goto('./');
    await selectStation(page, 'from', route.from);
    await selectStation(page, 'to', route.to);
    const result = page.locator('#routeResult');

    if (route.estimate) {
      const warning = page.getByRole('dialog', { name: '这一站对不在官方票价库中' });
      await expect(warning).toBeVisible();
      await warning.getByRole('button', { name: '我知道了' }).click();
      await expect(warning).toBeHidden();
      await expect(result.locator('.fare-foot')).toContainText(route.estimate);
    }

    for (const [index, plan] of route.plans.entries()) {
      if (index > 0) await result.getByRole('button', { name: plan.button!, exact: true }).click();
      await expectPlan(result, route, plan);
      await expect(result.locator('.fm-1')).toHaveText(route.estimate ? '官方库未收录这一站对' : '官方实测票价');
      await expect(result.locator('.fare-big')).toHaveText(route.estimate ? '—' : `${route.newFare}元`);
      await expect(result.locator('.cur .price')).toHaveText(`${route.oldFare}元`);
      await expect(result.locator('.final .price')).toHaveText(`${route.newFare}元`);
    }
    await expect(result.locator('.plan-btn')).toHaveText(route.plans.flatMap(plan => plan.button ? [plan.button] : []));
  });
}

test('sharing includes optional station and ride parameters and restores the trip', async ({ page }) => {
  await page.goto('./');
  const directory = new URL(page.url());
  await selectDisneyPreset(page);
  await page.getByRole('button', { name: '52 次 · 26 天往返' }).click();
  const openQR = page.getByRole('button', { name: /^(二维码|显示二维码)$/ });
  await openQR.click();
  const dialog = page.getByRole('dialog', { name: '二维码分享' });
  const shareText = dialog.locator('.qr-url');
  await expect(dialog.getByRole('img', { name: '当前视图的分享二维码' })).toBeVisible();
  const shared = new URL(await shareText.innerText());
  expect(shared.origin).toBe(directory.origin);
  expect(shared.pathname).toBe(directory.pathname);
  expect(shared.hash).toBe('#s2s');
  expect(Object.fromEntries(shared.searchParams)).toEqual({ from: '人民广场', to: '迪士尼', rides: '52' });

  const mobileOption = dialog.getByRole('checkbox');
  if (await mobileOption.isVisible()) {
    await mobileOption.uncheck();
  } else {
    await dialog.getByRole('button', { name: '关闭' }).click();
    await page.locator('#shareWithParams').uncheck();
    await openQR.click();
  }
  await expect(shareText).toHaveText(new URL('#s2s', directory).href);
  await dialog.getByRole('button', { name: '关闭' }).click();
  await page.goto(`./${shared.search}${shared.hash}`);
  await expect(page.locator('#fromSelPick button')).toHaveText('人民广场');
  await expect(page.locator('#toSelPick button')).toHaveText('迪士尼');
  await expect(page.locator('#ridesS2s')).toHaveValue('52');
  await expect(page.locator('#ridesS2sRange')).toHaveValue('52');
  await expectPlan(page.locator('#routeResult'), routeCases.transfer, routeCases.transfer.plans[0]);
  const best = page.locator('#costTableS2s').getByRole('row', { name: /计次票 45 次/ });
  await expect(best.getByRole('cell', { name: '210 元 + 7 次单程' })).toBeVisible();
  await expect(best.getByRole('cell', { name: '¥ 266.0', exact: true })).toBeVisible();
  await expect(best.getByRole('cell', { name: '最低', exact: true })).toBeVisible();
});

test('hearing fares are opt-in and stay in sync across station and distance tabs', async ({ page }) => {
  await page.goto('./');
  await selectDisneyPreset(page);
  const stationPrices = page.locator('#routeResult .card .price');
  const stationToggle = page.locator('#showHearingS2s');
  await expect(stationToggle).not.toBeChecked();
  await expect(stationPrices).toHaveText(['5元', '8元']);
  await stationToggle.check();
  await expect(stationPrices).toHaveText(['5元', '8元', '8元', '7元']);

  await page.getByRole('button', { name: '按乘距', exact: true }).click();
  await expect(page).toHaveURL(/#dist$/);
  const distance = page.locator('#panel-dist');
  const distanceToggle = distance.getByRole('checkbox', { name: /显示听证/ });
  await expect(distanceToggle).toBeChecked();
  await distance.getByRole('button', { name: '长 50km', exact: true }).click();
  await expect(distance.locator('.card .price')).toHaveText(['8元', '10元', '11元', '10元']);
  await distanceToggle.uncheck();
  await expect(distance.locator('.card .price')).toHaveText(['8元', '10元']);
  await page.getByRole('button', { name: '站到站', exact: true }).click();
  await expect(stationToggle).not.toBeChecked();
  await expect(stationPrices).toHaveText(['5元', '8元']);
});

test('city deep links restore distance; tab navigation updates the visible view and hash', async ({ page }) => {
  await page.goto('./?km=30#cities');
  const cities = page.locator('#panel-cities');
  await expect(cities).toBeVisible();
  await expect(cities.getByRole('spinbutton')).toHaveValue('30');
  const beijing = cities.locator('#cityPrices .cp-chip').filter({ hasText: '北京' });
  await expect(beijing.locator('.cp-fare')).toHaveText('6 元');
  const legend = cities.getByRole('button', { name: /^北京，/ });
  await legend.press('Enter');
  await expect(beijing).toBeHidden();
  await legend.press('Enter');
  await expect(beijing).toBeVisible();

  await page.getByRole('button', { name: '改版详情', exact: true }).click();
  await expect(page).toHaveURL(/#change$/);
  await expect(cities).toBeHidden();
  await expect(page.getByRole('heading', { name: /新票价：一页看完/ })).toBeVisible();
  await page.getByRole('button', { name: '站到站', exact: true }).click();
  await expect(page).toHaveURL(url => url.hash === '');
  await expect(page.locator('#panel-s2s')).toBeVisible();
});

test('route map identifies the interchange and reveals intermediate stops on demand', async ({ page }) => {
  await page.goto('./');
  await selectDisneyPreset(page);
  const result = page.locator('#routeResult');
  const map = result.getByRole('img', { name: /高亮 人民广场 至 迪士尼/ });
  await expect(map.locator('text')).toHaveText(['人民广场', '东方体育中心', '迪士尼']);
  await map.locator('circle.inter').filter({ hasText: '东方体育中心' }).click();
  await expect(result.locator('.map-tip.on')).toHaveText('东方体育中心');
  await result.getByRole('button', { name: '放大线路图' }).click();

  const viewer = page.locator('.mapv');
  const midToggle = viewer.getByRole('button', { name: '显示沿途站点' });
  const intermediate = viewer.locator('.mids circle').filter({ hasText: '大世界' });
  await expect(midToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(intermediate).toBeHidden();
  await midToggle.click();
  await expect(intermediate).toBeVisible();
  await midToggle.click();
  await expect(intermediate).toBeHidden();
  await viewer.getByRole('button', { name: '关闭' }).click();
  await expect(viewer).toBeHidden();
  await expect(map).toBeVisible();
});

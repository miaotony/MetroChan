import { expect, test } from './fixtures';

test('a late official route cannot replace a newly selected same-station result', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#routeResult .fare-big')).toBeVisible();
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const shard = '**/data/paths/376.json';
  await page.route(shard, async route => { await hold; await route.continue(); });
  const requested = page.waitForRequest(shard);
  await page.locator('#s2sPresets [data-pair="滴水湖,西岑"]').click();
  await requested;
  try {
    await page.locator('#fromSearch').fill('西岑');
    await page.locator('#fromSuggest').getByText('西岑', { exact: true }).click();
    await expect(page.locator('#routeResult')).toHaveText('起点和终点相同。');
  } finally {
    release();
  }
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#routeResult')).toHaveText('起点和终点相同。');
  await expect(page.locator('#costTableS2s')).toBeEmpty();
});

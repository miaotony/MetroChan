import { expect, test } from './fixtures';

test('a distance QR link reopens the same panel and distance on this deployment', async ({ page }) => {
  await page.goto('./?km=65');
  await expect(page.locator('#panel-dist')).toBeVisible();
  await expect(page.locator('#kmNum')).toHaveValue('65');
  await page.locator('#qrBtn').click();
  const link = new URL(await page.locator('.qr-url').innerText());
  expect(link.pathname).toBe(new URL(page.url()).pathname);
  await page.goto(link.href);
  await expect(page.locator('#panel-dist')).toBeVisible();
  await expect(page.locator('#kmNum')).toHaveValue('65');
});

test('changing only the hash restores the change panel and theme survives reload', async ({ page }) => {
  await page.goto('./#cities');
  await page.locator('#themeBtn').click();
  const theme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(theme);
  await page.evaluate(() => { location.hash = 'change'; });
  await expect(page.locator('#panel-change')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
});

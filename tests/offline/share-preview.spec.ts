import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const release = new URL('../../release/MetroChan-offline.html', import.meta.url);
const attachment = 'https://attachment.invalid/download/MetroChan-offline.html';
const canonical = 'https://metrochan.miaotony.xyz/';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

for (const preview of ['file', 'blob', 'attachment'] as const) {
  test(`the mobile QR opens the canonical trip from ${preview} preview`, async ({ context, page }) => {
    const html = await readFile(release, 'utf8');
    const requests: string[] = [];
    await context.route(/^https?:/, route => {
      const url = route.request().url();
      requests.push(url);
      if (url === attachment || new URL(url).origin === new URL(canonical).origin) {
        return route.fulfill({ contentType: 'text/html', body: url === attachment ? html : '<title>Shared trip</title>' });
      }
      return route.abort();
    });
    const documentUrl = preview === 'file' ? release.href : preview === 'attachment' ? attachment
      : await page.evaluate(source => URL.createObjectURL(new Blob([source], { type: 'text/html' })), html);
    await page.goto(documentUrl);
    await page.locator('#mQrBtn').tap();
    const dialog = page.getByRole('dialog', { name: '二维码分享' });
    await expect(dialog).toBeVisible();
    const link = dialog.getByRole('link');
    const trip = new URL(canonical);
    trip.search = new URLSearchParams({ from: await page.locator('#fromSelPick button').innerText(),
      to: await page.locator('#toSelPick button').innerText(), rides: await page.locator('#ridesS2s').inputValue() }).toString();
    trip.hash = 's2s';
    await expect(link).toHaveAttribute('href', trip.href);
    await dialog.getByRole('checkbox').uncheck();
    await expect(link).toHaveAttribute('href', `${canonical}#s2s`);
    await dialog.getByRole('checkbox').check();
    expect(requests).toEqual(preview === 'attachment' ? [attachment] : []);
    const opened = page.waitForEvent('popup');
    await link.getByRole('img').tap();
    const online = await opened;
    await expect(online).toHaveURL(trip.href);
    await online.close();
    await expect(page).toHaveURL(documentUrl);
  });
}

test.describe('file preview without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the offline file has a clickable, embedded QR for the online homepage', async ({ page, context }) => {
    await page.goto(release.href);
    const image = page.getByRole('img', { name: '在线版首页二维码' });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', /^data:image\/gif;base64,/);
    await context.route(canonical, route => route.fulfill({ contentType: 'text/html', body: '<title>MetroChan</title>' }));
    const opened = page.waitForEvent('popup');
    await image.tap();
    await expect(await opened).toHaveURL(canonical);
  });
});

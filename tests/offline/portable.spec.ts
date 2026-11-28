import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test as base, type Page } from '@playwright/test';
import qrcode from 'qrcode-generator';
import { routeCases, type RouteCase } from '../fixtures/routes';

const release = new URL('../../release/MetroChan-offline.html', import.meta.url);

const test = base.extend<{ portable: Page }>({
  portable: async ({ context, page }, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'MetroChan offline '));
    const copy = join(directory, 'MetroChan-offline.html');
    const documentUrl = pathToFileURL(copy).href;
    const attempts = new Set<string>();
    const errors: string[] = [];
    function forbidden(type: string, url: string): boolean {
      if (/^(data|blob|about):/.test(url) || (type === 'document' && url === documentUrl)) return false;
      attempts.add(`${type}: ${url}`);
      return true;
    }
    try {
      await copyFile(release, copy);
      context.on('weberror', error => errors.push(error.error().message));
      context.on('request', request => forbidden(request.resourceType(), request.url()));
      await context.route('**/*', route => forbidden(route.request().resourceType(), route.request().url())
        ? route.abort('blockedbyclient') : route.continue());
      await context.routeWebSocket(/.*/, socket => {
        forbidden('websocket', socket.url());
        socket.close();
      });
      await context.exposeFunction('__auditPortableFetch', (url: string) => { forbidden('fetch', url); });
      await context.addInitScript(() => {
        const nativeFetch = window.fetch.bind(window);
        const audit = (window as typeof window & { __auditPortableFetch: (url: string) => Promise<void> }).__auditPortableFetch;
        window.fetch = async (input, init) => {
          const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
          if (url.protocol !== 'data:' && url.protocol !== 'blob:') await audit(url.href);
          return nativeFetch(input, init);
        };
      });
      await page.goto(documentUrl);
      await expect(page).toHaveURL(documentUrl);
      expect(await page.evaluate(() => navigator.onLine)).toBe(false);
      await use(page);
    } finally {
      await page.close();
      await rm(directory, { recursive: true, force: true });
      expect([...attempts], 'The single HTML must not request external or sibling resources').toEqual([]);
      expect(errors, 'Uncaught errors in the portable page').toEqual([]);
    }
  },
});

async function selectPair(page: Page, pair: RouteCase) {
  for (const side of ['from', 'to'] as const) {
    const search = page.locator(`#${side}Search`);
    await search.fill(pair[side]);
    await page.locator(`#${side}Suggest`).getByText(pair[side], { exact: true }).click();
    await expect(page.locator(`#${side}SelPick button`)).toHaveText(pair[side]);
  }
}

test('both offline reward images decode to the original 432×432 pixels', async ({ portable: page }) => {
  const images = page.getByRole('img', { name: '微信打赏二维码', exact: true });
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    const digest = await image.evaluate(async (element: HTMLImageElement) => {
      await element.decode();
      const canvas = document.createElement('canvas');
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(element, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', rgba));
      return [canvas.width, canvas.height, Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')];
    });
    expect(digest).toEqual([432, 432, '84db26c9cc0f4748d27405127652dd3cb729c9cfabd422ad227d8f30d8e846af']);
  }
});

test('unseen direct, transfer and long routes show official prices, recommendations and maps', async ({ portable: page }) => {
  const result = page.locator('#routeResult');
  for (const pair of [routeCases.direct, routeCases.transfer, routeCases.long]) {
    await test.step(`${pair.from} → ${pair.to}`, async () => {
      await selectPair(page, pair);
      for (const [index, plan] of pair.plans.entries()) {
        if (index > 0) await result.getByRole('button', { name: plan.button!, exact: true }).click();
        const stops = [pair.from, ...plan.via, pair.to];
        await expect(result.locator('.jny-name')).toHaveText(stops);
        await expect(result.locator('.jny-chip')).toHaveText(plan.lines);
        await expect(result.locator('.jny-hops')).toHaveText(plan.hops.map(hops => `${hops} 站`));
        await expect(result.locator('.fm-2')).toContainText(plan.summary);
        await expect(result.locator('.fm-1')).toHaveText('官方实测票价');
        await expect(result.locator('.fare-big')).toHaveText(`${pair.newFare}元`);
        await expect(result.locator('.cur .price')).toHaveText(`${pair.oldFare}元`);
        await expect(result.locator('.final .price')).toHaveText(`${pair.newFare}元`);
        const map = result.getByRole('img', { name: `上海地铁线路图，高亮 ${pair.from} 至 ${pair.to} 的官方路径` });
        await expect(map).toBeVisible();
        await expect(map.locator('.mlab-sm')).toHaveText(stops);
        await expect(map.locator('path.lbase').first()).toHaveAttribute('d', /\S/);
        await expect(map.locator('path.mhalo')).toHaveCount(plan.lines.length);
      }
    });
  }
});

test('the QR code and copied trip link share the canonical website, never the local path', async ({ portable: page }) => {
  const pair = routeCases.branch;
  await selectPair(page, pair);
  await expect(page.locator('#routeResult .jny-name')).toHaveText([pair.from, pair.to]);
  await page.getByRole('button', { name: '52 次 · 26 天往返' }).click();
  await page.getByRole('button', { name: '二维码', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '二维码分享' });
  const shared = new URL(await dialog.locator('.qr-url').innerText());
  expect(shared.origin + shared.pathname).toBe('https://metrochan.miaotony.xyz/');
  expect(shared.hash).toBe('#s2s');
  expect(Object.fromEntries(shared.searchParams)).toEqual({ from: pair.from, to: pair.to, rides: '52' });
  const encoder = qrcode(0, 'M');
  encoder.addData(shared.href);
  encoder.make();
  const modules = encoder.getModuleCount();
  const image = dialog.getByRole('img', { name: '当前视图的分享二维码' });
  const actual = await image.evaluate(async (element: HTMLImageElement, count) => {
    await element.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = count + 8;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return Array.from({ length: canvas.width * canvas.height }, (_, index) => rgba[4 * index] === 0 ? '1' : '0').join('');
  }, modules);
  const expected = Array.from({ length: modules + 8 }, (_, row) => Array.from({ length: modules + 8 }, (_, col) =>
    row >= 4 && col >= 4 && row < modules + 4 && col < modules + 4 && encoder.isDark(row - 4, col - 4) ? '1' : '0').join('')).join('');
  expect(actual).toBe(expected);
  await dialog.getByRole('button', { name: '关闭' }).click();

  const clipboard = await page.evaluateHandle(() => {
    const capture = { text: '', async writeText(value: string) { this.text = value; } };
    Object.defineProperty(navigator, 'clipboard', { value: capture, configurable: true });
    return capture;
  });
  await page.locator('#shareBtn').click();
  await expect.poll(() => clipboard.evaluate(capture => capture.text)).toBe(shared.href);
});

test('tabs work offline and a genuinely unindexed pair still shows its estimate', async ({ portable: page }) => {
  await page.getByRole('button', { name: '按乘距', exact: true }).click();
  const distance = page.locator('#panel-dist');
  await distance.getByRole('button', { name: '长 50km', exact: true }).click();
  await expect(distance.locator('.card .price')).toHaveText(['8元', '10元']);
  await page.getByRole('button', { name: '城市对比', exact: true }).click();
  await expect(page.locator('#cityChart')).toBeVisible();
  await page.getByRole('button', { name: '改版详情', exact: true }).click();
  await expect(page.getByRole('heading', { name: /新票价：一页看完/ })).toBeVisible();
  await page.getByRole('button', { name: '站到站', exact: true }).click();

  const pair = routeCases.missing;
  await selectPair(page, pair);
  const warning = page.getByRole('dialog', { name: '这一站对不在官方票价库中' });
  await warning.getByRole('button', { name: '我知道了' }).click();
  const result = page.locator('#routeResult');
  await expect(result.locator('.fm-1')).toHaveText('官方库未收录这一站对');
  await expect(result.locator('.fare-big')).toHaveText('—');
  await expect(result.locator('.jny-name')).toHaveText([pair.from, pair.to]);
  await expect(result.locator('.fare-foot')).toContainText(pair.estimate!);
  await expect(result.locator('.cur .price')).toHaveText(`${pair.oldFare}元`);
  await expect(result.locator('.final .price')).toHaveText(`${pair.newFare}元`);
});

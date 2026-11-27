import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test, type Browser, type TestInfo } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const readySelectors = {
  s2s: ['.metromap svg', '#costTableS2s tbody tr'],
  dist: ['#chart path', '#costTable tbody tr'],
  cities: ['#cityChart path', '#cityCards > *'],
  change: ['#ticketGrid > *', '#cmpTable tbody tr'],
};
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};
type Tab = keyof typeof readySelectors;
type Layout = keyof typeof viewports;
type Theme = 'light' | 'dark';

function tabURL(base: string | undefined, setting: string, tab: Tab) {
  if (!base) throw new Error(`Set ${setting} to the absolute app URL.`);
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${setting} must be an HTTP(S) URL.`);
  url.hash = tab === 's2s' ? '' : tab;
  return url.href;
}

async function capture(browser: Browser, url: string, tab: Tab, layout: Layout, theme: Theme) {
  const page = await browser.newPage({
    viewport: viewports[layout], screen: viewports[layout], deviceScaleFactor: 1,
    isMobile: layout === 'mobile' && browser.browserType().name() !== 'firefox',
    hasTouch: layout === 'mobile', colorScheme: theme, reducedMotion: 'reduce',
    locale: 'zh-CN', timezoneId: 'Asia/Shanghai', storageState: { cookies: [], origins: [] },
  });
  try {
    await page.addInitScript((scheme) => {
      localStorage.setItem('mc_theme', scheme);
      localStorage.setItem('mc_tip_hidden', '1');
    }, theme);
    const response = await page.goto(url);
    expect(response?.ok(), `${url} returned HTTP ${response?.status()}`).toBe(true);
    for (const selector of readySelectors[tab]) {
      await expect(page.locator(selector).first()).toBeVisible();
    }
    await page.evaluate(async () => {
      await Promise.all([document.fonts.ready, ...Array.from(document.images, (image) => {
        image.loading = 'eager';
        return image.decode();
      })]);
      window.scrollTo(0, 0);
    });

    const options = { fullPage: true, scale: 'css', animations: 'disabled', caret: 'hide' } as const;
    let previous = await page.screenshot(options);
    await expect.poll(async () => {
      const current = await page.screenshot(options);
      const stable = current.equals(previous);
      previous = current;
      return stable;
    }, { message: `Waiting for two identical full-page renders of ${url}`, timeout: 10_000 }).toBe(true);
    return previous;
  } finally {
    await page.close();
  }
}

async function compare(original: Buffer, candidate: Buffer, info: TestInfo) {
  if (original.equals(candidate)) return;
  const expected = PNG.sync.read(original);
  const actual = PNG.sync.read(candidate);
  const attach = async (name: string, body: Buffer) => {
    await writeFile(info.outputPath(name), body);
    await info.attach(name, { body, contentType: 'image/png' });
  };
  let differentPixels: number | undefined;
  if (expected.width === actual.width && expected.height === actual.height) {
    const { width, height } = expected;
    const diff = new PNG({ width, height });
    differentPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, { threshold: 0.1 });
    if (differentPixels === 0) return;
    await attach('diff.png', PNG.sync.write(diff));
  }
  await Promise.all([attach('original.png', original), attach('candidate.png', candidate)]);
  expect([actual.width, actual.height], 'Full-page dimensions (width, height)').toEqual([expected.width, expected.height]);
  expect(differentPixels, 'Differing pixels after antialias filtering (see diff.png)').toBe(0);
}

for (const layout of ['desktop', 'mobile'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const tab of Object.keys(readySelectors) as Tab[]) {
      test(`${layout} ${theme} ${tab}`, async ({ browser, browserName, baseURL }, info) => {
        const saveReference = process.env.CAPTURE_BASELINE === '1';
        if (saveReference && process.platform !== 'darwin') throw new Error('Capture reference PNGs on macOS only.');
        const baselineURL = tabURL(process.env.BASELINE_URL, 'BASELINE_URL', tab);
        const original = await test.step('Render archived original', () => capture(browser, baselineURL, tab, layout, theme));
        if (saveReference) {
          const directory = resolve(dirname(info.file), '../baselines', browserName);
          await mkdir(directory, { recursive: true });
          await writeFile(resolve(directory, `${layout}-${theme}-${tab}.png`), original);
          return;
        }

        const candidateURL = tabURL(baseURL, 'Playwright use.baseURL', tab);
        expect(candidateURL, 'Configure distinct original and candidate app URLs').not.toBe(baselineURL);
        const candidate = await test.step('Render candidate', () => capture(browser, candidateURL, tab, layout, theme));
        await compare(original, candidate, info);
      });
    }
  }
}

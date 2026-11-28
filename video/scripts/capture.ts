/**
 * Captures the real site (light + dark, desktop + phone) for the
 * "随身用" scene. Start the site's Vite preview first:
 *
 *   (cd .. && npm run build:web && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort)
 *   bun run capture
 */
import { mkdir, writeFile } from "node:fs/promises";
import { openBrowser } from "@remotion/renderer";

const ORIGIN = "http://127.0.0.1:4173/";
const TRIP = { from: "莘庄", to: "陆家嘴", rides: 44 };
const OUT = process.argv[2] ?? "public/shots";

await mkdir(OUT, { recursive: true });

const browser = await openBrowser("chrome", {
  chromeMode: "headless-shell",
  chromiumOptions: { gl: "angle" },
});
const page = await browser.newPage({
  context: () => null,
  logLevel: "error",
  indent: false,
  pageIndex: 0,
  onBrowserLog: null,
  onLog: () => undefined,
});
const client = page._client();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const url = `${ORIGIN}?from=${encodeURIComponent(TRIP.from)}&to=${encodeURIComponent(
  TRIP.to,
)}&rides=${TRIP.rides}#s2s`;

const shoot = async (file: string, width: number, height: number) => {
  const result = (await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  })) as unknown as { value: { data: string } };
  await writeFile(`${OUT}/${file}`, Buffer.from(result.value.data, "base64"));
  console.log(`${file}: ${width}×${height} css px`);
};

/* Floating helpers are fixed to the viewport, so they would be baked into
   the middle of a tall capture. The film scrolls the page itself. */
const tidy = () =>
  page.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>(".tip-float, .tip-fab, .to-top, .mfab")
      .forEach((node) => (node.style.display = "none"));
  });

const setTheme = (theme: "light" | "dark") =>
  page.evaluate((value) => {
    document.documentElement.setAttribute("data-theme", value);
    const button = document.getElementById("themeBtn");
    if (button) button.textContent = value === "dark" ? "☀️" : "🌙";
    window.dispatchEvent(new Event("resize"));
  }, theme);

const hasTripMap = () =>
  page.evaluate(({ from, to }) => {
    const ends = Array.from(
      document.querySelectorAll("#routeResult .mstop.flag title"),
      (node) => node.textContent,
    );
    return ends.includes(from) && ends.includes(to);
  }, TRIP);

const capture = async (
  name: string,
  viewport: { width: number; height: number; deviceScaleFactor: number },
  clipHeight: number,
) => {
  await page.setViewport(viewport);
  await page.goto({ url, timeout: 30000 });
  const deadline = Date.now() + 15000;
  while (!(await hasTripMap())) {
    if (Date.now() > deadline) {
      throw new Error(
        `No official trip map at ${url}; serve the Vite build, not the source tree.`,
      );
    }
    await wait(100);
  }
  for (const theme of ["light", "dark"] as const) {
    await setTheme(theme);
    await tidy();
    await wait(500);
    await shoot(`${name}-${theme}.png`, viewport.width, clipHeight);
  }
};

try {
  await capture(
    "desk",
    { width: 1440, height: 900, deviceScaleFactor: 1.5 },
    1240,
  );
  await capture(
    "phone",
    { width: 390, height: 844, deviceScaleFactor: 2 },
    2140,
  );
} finally {
  await browser.close({ silent: true });
}

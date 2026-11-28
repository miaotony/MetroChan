/**
 * Renders half-size review stills of chosen frames with a single bundle.
 *
 *   bun run scripts/stills.ts 60 480 1200
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import "./prepare-data";

const frames = process.argv.slice(2).map(Number).filter(Number.isFinite);
if (!frames.length) {
  console.error("usage: bun run scripts/stills.ts <frame> [frame…]");
  process.exit(1);
}

const outDir = path.resolve("out/stills");
await mkdir(outDir, { recursive: true });

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});
const composition = await selectComposition({
  serveUrl,
  id: "MetroChanIntro",
  logLevel: "error",
});

for (const frame of frames) {
  const output = path.join(outDir, `f-${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    frame,
    output,
    scale: 0.5,
    logLevel: "error",
  });
  console.log(output);
}

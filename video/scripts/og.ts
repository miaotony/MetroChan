/**
 * Renders the share card (the film's closing frame, reworked for 1200×630)
 * to ../og.png.
 *
 *   bun run scripts/og.ts
 */
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const EXPORT_WIDTH = 1200;
const output = path.resolve(process.argv[2] ?? "../og.png");

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});
const composition = await selectComposition({
  serveUrl,
  id: "OgCard",
  logLevel: "error",
});

await renderStill({
  composition,
  serveUrl,
  output,
  scale: EXPORT_WIDTH / composition.width,
  logLevel: "error",
});
console.log(output);

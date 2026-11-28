/**
 * Renders the native-resolution share card to video/out/og.png.
 *
 *   bun run scripts/og.ts
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import "./prepare-data";

const dir = new URL("../out/", import.meta.url);
const output = fileURLToPath(new URL("og.png", dir));
await mkdir(dir, { recursive: true });

const serveUrl = await bundle({
  entryPoint: fileURLToPath(new URL("../src/index.ts", import.meta.url)),
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
  logLevel: "error",
});
console.log(output);

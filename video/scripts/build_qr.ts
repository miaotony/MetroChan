/**
 * Builds src/qr.json with the site's installed qrcode-generator package.
 *
 *   bun run scripts/build_qr.ts
 */
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const SITE_URL = "https://metrochan.miaotony.xyz/";

type QrCode = {
  addData: (text: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

const requireSite = createRequire(
  new URL("../../package.json", import.meta.url),
);
const qr: QrCode = requireSite("qrcode-generator")(0, "M");
qr.addData(SITE_URL);
qr.make();

const size = qr.getModuleCount();
const rows: string[] = [];
for (let row = 0; row < size; row++) {
  let bits = "";
  for (let col = 0; col < size; col++) bits += qr.isDark(row, col) ? "1" : "0";
  rows.push(bits);
}

await writeFile(
  new URL("../src/qr.json", import.meta.url),
  `${JSON.stringify({ url: SITE_URL, size, rows }, null, 2)}\n`,
);
console.log(`qr.json: ${size}×${size} modules for ${SITE_URL}`);

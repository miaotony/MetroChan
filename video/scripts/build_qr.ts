/**
 * Builds src/qr.json with the same QR library the site ships
 * (assets/qrcode.min.js), so the code in the film is the real, scannable one.
 *
 *   bun run scripts/build_qr.ts
 */
import { readFile, writeFile } from "node:fs/promises";

const SITE_URL = "https://metrochan.miaotony.xyz/";

type QrCode = {
  addData: (text: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

const source = await readFile(
  new URL("../../assets/qrcode.min.js", import.meta.url),
  "utf8",
);
const factory = new Function(`${source}\nreturn qrcode;`)() as (
  typeNumber: number,
  level: string,
) => QrCode;

const qr = factory(0, "M");
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

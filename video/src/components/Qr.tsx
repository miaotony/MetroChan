import React from "react";
import qr from "../qr.json";

/** Horizontal runs of dark modules, so the code renders as crisp bars. */
const QR_RUNS = qr.rows.flatMap((row, y) => {
  const runs: { x: number; y: number; w: number }[] = [];
  let start = -1;
  for (let x = 0; x <= row.length; x++) {
    const on = row[x] === "1";
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push({ x: start, y, w: x - start });
      start = -1;
    }
  }
  return runs;
});

/** The dark modules of the site's QR code, in module units. */
export const QrModules: React.FC<{ fill: string }> = ({ fill }) => (
  <>
    {QR_RUNS.map((run) => (
      <rect
        key={`${run.x}-${run.y}`}
        x={run.x}
        y={run.y}
        width={run.w}
        height={1}
        fill={fill}
      />
    ))}
  </>
);

import { Easing, interpolate } from "remotion";

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const softInOut = Easing.bezier(0.45, 0, 0.2, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

/** 0 → 1 between `start` and `start + duration`. */
export const tween = (
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = easeOut,
) =>
  interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], {
    ...CLAMP,
    easing,
  });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Splits one 0 → 1 mix into "the old thing leaves" and then "the new thing
 * arrives", so two texts never sit on top of each other half-transparent.
 */
export const handOver = (mix: number) => ({
  leave: Math.min(1, mix * 2),
  arrive: Math.max(0, mix * 2 - 1),
});

/** A short symmetric pulse that peaks at `center`. */
export const pulse = (frame: number, center: number, attack = 3, decay = 14) =>
  frame < center
    ? tween(frame, center - attack, attack, Easing.out(Easing.quad))
    : 1 - tween(frame, center, decay, Easing.out(Easing.cubic));

export const yuan = (value: number, digits = 1) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

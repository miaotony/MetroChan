/**
 * Values the two dragged sliders hold at a given local frame. The scenes
 * draw from these and the soundtrack generator reads them too, so every
 * number change on screen has a sound exactly under it.
 */
import { interpolate } from "remotion";
import { CLAMP, softInOut } from "./lib/anim";
import { DISTANCE, KM, MONTHLY, RIDES } from "./timeline";

/** Monthly rides slider, before rounding (drives the knob position). */
export const ridesValueAt = (frame: number) =>
  interpolate(
    frame,
    [
      MONTHLY.drag1Start,
      MONTHLY.drag1End,
      MONTHLY.drag2Start,
      MONTHLY.drag2End,
    ],
    [RIDES.start, RIDES.commute, RIDES.commute, RIDES.combo],
    { ...CLAMP, easing: softInOut },
  );

export const ridesAt = (frame: number) => Math.round(ridesValueAt(frame));

/** Trip length slider of the distance scene, in steps of 0.1 km. */
export const kmAt = (frame: number) =>
  Math.round(
    interpolate(
      frame,
      [DISTANCE.dragStart, DISTANCE.dragEnd],
      [KM.start, KM.end],
      { ...CLAMP, easing: softInOut },
    ) * 10,
  ) / 10;

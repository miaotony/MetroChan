/**
 * Single source of truth for timing.
 * The film and the soundtrack generator (scripts/make_music.ts) both read
 * this file, so every cut and reveal lands on the same beat grid.
 *
 * 100 BPM at 30 fps: one beat is exactly 18 frames, one bar is 72 frames.
 */
export const FPS = 30;
export const BPM = 100;
export const BEAT = 18;
export const BAR = BEAT * 4;
export const TOTAL_BARS = 32;
export const DURATION = TOTAL_BARS * BAR;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Frames a scene keeps rendering after its nominal end, for the hand-over. */
export const OVERLAP = 12;

/** Frame of a bar (0-indexed) plus an optional beat offset (may be fractional). */
export const at = (barIndex: number, beat = 0) =>
  Math.round(barIndex * BAR + beat * BEAT);

const scene = (fromBar: number, bars: number) => ({
  from: at(fromBar),
  duration: bars * BAR,
  fromBar,
  bars,
});

export const SCENES = {
  hook: scene(0, 4),
  title: scene(4, 2),
  s2s: scene(6, 7),
  monthly: scene(13, 8),
  distance: scene(21, 3),
  anywhere: scene(24, 3),
  cta: scene(27, 5),
} as const;

/** Local frames inside the hook. */
export const HOOK = {
  date: at(0, 1),
  headline1: at(0, 2),
  headline2: at(0, 3),
  route: at(2, 0),
  oldFare: at(2, 1),
  newFare: at(2, 3),
  question: at(3, 1),
} as const;

export const TITLE = {
  logo: at(0, 0),
  name: at(0, 1),
  tagline: at(1, 0),
} as const;

/** Local frames inside the station-to-station scene. */
export const S2S = {
  focusFrom: at(0, 1.5),
  typeFrom: at(0, 2),
  pickFrom: at(1, 0),
  typeTo: at(1, 1),
  pickTo: at(1, 3),
  drawStart: at(2, 0),
  arrive: at(4, 0),
  compare: at(4, 1),
  chips: at(4, 2),
  facts: at(5, 0),
  factsCount: at(5, 1),
} as const;

/** Letters typed into the two search boxes, one per half beat. */
export const TYPED = { from: "xz", to: "ljz" } as const;

/** Local frames inside the monthly scene (commute cost, then combo price). */
export const MONTHLY = {
  grab: at(1, 3),
  drag1Start: at(2, 0),
  drag1End: at(3, 0),
  callout: at(3, 1),
  drag2Start: at(4, 0),
  drag2End: at(4, 2),
  combo: at(5, 0),
  tokensPass: at(5, 1),
  tokensSingle: at(6, 0),
  equation: at(6, 2),
  saving: at(7, 0),
} as const;

export const RIDES = { start: 22, commute: 44, combo: 52 } as const;

export const DISTANCE = {
  curves: at(0, 1),
  grab: at(0, 3),
  dragStart: at(1, 0),
  dragEnd: at(2, 1),
  verdict: at(2, 1),
} as const;

export const KM = { start: 3, end: 26 } as const;

export const ANYWHERE = {
  phone: at(0, 1),
  press: at(1, 0),
  share: at(1, 2),
  copied: at(1, 3),
  open: at(2, 0),
} as const;

export const CTA = {
  hit: at(0, 0),
  line: at(0, 2),
  line2: at(0, 3),
  url: at(1, 0),
  qr: at(1, 2),
  chips: at(2, 0),
  final: at(3, 0),
} as const;

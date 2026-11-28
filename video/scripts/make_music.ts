/**
 * Synthesises the soundtrack and writes public/metrochan-beat.mp3.
 *
 * Nothing is sampled: drums, bass, keys and every interface sound are
 * generated sample by sample. Bars and cues come from src/timeline.ts, and
 * the sounds under the fare meter and the two sliders are placed by asking
 * the film's own functions (src/motion.ts, src/data.ts) on which frame a
 * number changes, so picture and sound cannot drift apart.
 *
 *   bun run scripts/make_music.ts
 */
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  bestPlanIndex,
  fareNew,
  fareOld,
  meterFare,
  monthlyPlans,
  TRIP,
} from "../src/data";
import { easeInOut, easeOut, tween } from "../src/lib/anim";
import { kmAt, ridesAt } from "../src/motion";
import {
  ANYWHERE,
  BEAT,
  BPM,
  CTA,
  DISTANCE,
  DURATION,
  FPS,
  HOOK,
  KM,
  MONTHLY,
  RIDES,
  S2S,
  SCENES,
  TITLE,
  TOTAL_BARS,
  TYPED,
} from "../src/timeline";

const SR = 44100;
const LENGTH = Math.round((DURATION / FPS) * SR);
const BEAT_S = 60 / BPM;
const STEP_S = BEAT_S / 4;
const BAR_S = BEAT_S * 4;
const TAU = Math.PI * 2;
const TARGET_LUFS = -14;
/* true-peak ceiling; leaves room for the MP3 and AAC encoders' overshoot */
const CEILING = 10 ** (-2 / 20);

if (Math.abs(BEAT / FPS - BEAT_S) > 1e-9) {
  throw new Error("timeline.ts: BEAT frames and BPM no longer agree");
}

type Bus = { l: Float32Array; r: Float32Array };
type Shape = { gain: number; pan?: number; wet?: number };
type Voice = (t: number) => number;

const bus = (): Bus => ({
  l: new Float32Array(LENGTH),
  r: new Float32Array(LENGTH),
});
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-9));
const grid = (bar: number, step = 0) => bar * BAR_S + step * STEP_S;
/** Fades a voice in and out so that no note starts or stops with a click. */
const edge = (t: number, total: number, attack: number, release: number) =>
  clamp01(Math.min(t / attack, (total - t) / release));

let seed = 20261201;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => random() * 2 - 1;

/** State-variable filter that stays stable while its cutoff moves. */
class Svf {
  private s1 = 0;
  private s2 = 0;
  private g = 0;
  private cutoff = -1;
  low = 0;
  band = 0;
  high = 0;

  run(input: number, cutoff: number, q: number) {
    if (cutoff !== this.cutoff) {
      this.cutoff = cutoff;
      this.g = Math.tan((Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
    }
    const k = 1 / q;
    const a1 = 1 / (1 + this.g * (this.g + k));
    const v3 = input - this.s2;
    const v1 = a1 * this.s1 + this.g * a1 * v3;
    const v2 = this.s2 + this.g * v1;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    this.low = v2;
    this.band = v1;
    this.high = input - k * v1 - v2;
    return this;
  }
}

const music = {
  kick: bus(),
  drums: bus(),
  bass: bus(),
  keys: bus(),
  arp: bus(),
  lead: bus(),
  send: bus(),
};
const fx = { dry: bus(), send: bus() };
const kickTimes: number[] = [];

/** The mixing desk: one fader per stem. Reverb sends follow their stem. */
const FADERS = new Map<Bus, number>([
  [music.kick, 0.7],
  [music.drums, 2.7],
  [music.bass, 0.75],
  [music.keys, 1.6],
  [music.arp, 2.4],
  [music.lead, 1.5],
]);
const REVERB_RETURN = { music: 0.3, fx: 0.6 };

const play = (
  target: Bus,
  send: Bus,
  start: number,
  seconds: number,
  shape: Shape,
  voice: Voice,
) => {
  const first = Math.round(Math.max(0, start) * SR);
  const count = Math.round(seconds * SR);
  const angle = (((shape.pan ?? 0) + 1) * Math.PI) / 4;
  const level = shape.gain * (FADERS.get(target) ?? 1);
  const left = Math.cos(angle) * level;
  const right = Math.sin(angle) * level;
  const wet = shape.wet ?? 0;
  for (let i = 0; i < count && first + i < LENGTH; i++) {
    const sample = voice(i / SR);
    target.l[first + i] += sample * left;
    target.r[first + i] += sample * right;
    send.l[first + i] += sample * left * wet;
    send.r[first + i] += sample * right * wet;
  }
};

/* ---------- drums ---------- */

const kick = (time: number, gain: number, soft = false) => {
  const [base, top, sweep, decay] = soft ? [44, 60, 22, 8] : [48, 118, 36, 10];
  play(music.kick, music.send, time, 0.4, { gain }, (t) => {
    const phase = TAU * (base * t + (top / sweep) * (1 - Math.exp(-t * sweep)));
    const click = soft ? 0 : noise() * Math.exp(-t * 300) * 0.16;
    return (
      Math.tanh((Math.sin(phase) * Math.exp(-t * decay) + click) * 1.6) *
      edge(t, 0.4, 0.001, 0.06)
    );
  });
  if (!soft) kickTimes.push(time);
};

const clap = (time: number, gain: number) => {
  const filter = new Svf();
  play(music.drums, music.send, time, 0.26, { gain, wet: 0.3 }, (t) => {
    let envelope = t >= 0.023 ? 0.75 * Math.exp(-(t - 0.023) * 24) : 0;
    for (const offset of [0, 0.011, 0.023]) {
      if (t >= offset) {
        envelope = Math.max(envelope, Math.exp(-(t - offset) * 190));
      }
    }
    filter.run(noise(), 1700, 0.9);
    return (
      (filter.band * 1.5 + filter.high * 0.25) *
      envelope *
      edge(t, 0.26, 0.0006, 0.04)
    );
  });
};

const snare = (time: number, gain: number) => {
  const filter = new Svf();
  play(music.drums, music.send, time, 0.2, { gain, wet: 0.2 }, (t) => {
    const body =
      Math.sin(TAU * (176 * t + 1.5 * (1 - Math.exp(-t * 40)))) *
      Math.exp(-t * 24);
    const rattle = filter.run(noise(), 1900, 0.7).high * Math.exp(-t * 26);
    return (body * 0.7 + rattle * 0.6) * edge(t, 0.2, 0.0008, 0.03);
  });
};

const hat = (time: number, gain: number, open = false, pan = 0.2) => {
  const filter = new Svf();
  const total = open ? 0.32 : 0.06;
  const decay = open ? 13 : 80;
  play(
    music.drums,
    music.send,
    time,
    total,
    { gain, pan, wet: 0.08 },
    (t) =>
      filter.run(noise(), 7600, 0.7).high *
      Math.exp(-t * decay) *
      edge(t, total, 0.0008, 0.02),
  );
};

const shaker = (time: number, gain: number, pan: number) => {
  const filter = new Svf();
  play(
    music.drums,
    music.send,
    time,
    0.08,
    { gain, pan, wet: 0.1 },
    (t) =>
      filter.run(noise(), 5200, 1.1).band *
      Math.min(1, t / 0.012) *
      Math.exp(-t * 55) *
      edge(t, 0.08, 0.001, 0.02),
  );
};

const crash = (time: number, gain: number) => {
  for (const pan of [-0.7, 0.7]) {
    const filter = new Svf();
    play(
      music.drums,
      music.send,
      time,
      2.2,
      { gain, pan, wet: 0.35 },
      (t) =>
        filter.run(noise(), 5200, 0.6).high *
        (0.25 * Math.exp(-t * 14) + Math.exp(-t * 2.6)) *
        edge(t, 2.2, 0.002, 0.3),
    );
  }
};

/* ---------- pitched instruments ---------- */

const bass = (
  time: number,
  midi: number,
  seconds: number,
  gain: number,
  attack = 0.006,
) => {
  const f = hz(midi);
  const total = seconds + 0.05;
  play(music.bass, music.send, time, total, { gain }, (t) => {
    const p = TAU * f * t;
    const tone =
      Math.sin(p) +
      0.45 * Math.sin(2 * p) * (0.4 + 0.6 * Math.exp(-t * 5)) +
      0.18 * Math.sin(3 * p) * Math.exp(-t * 7);
    return (
      Math.tanh(tone * 1.2) *
      (0.7 + 0.3 * Math.exp(-t * 8)) *
      edge(t, total, attack, 0.05)
    );
  });
};

/** Two-operator electric piano, one slightly detuned voice per side. */
const epiano = (time: number, midi: number, seconds: number, gain: number) => {
  const total = seconds + 0.18;
  for (const side of [-1, 1]) {
    const f = hz(midi + side * 0.025);
    const depth = 1.25 * Math.min(1, 330 / f + 0.35);
    const tine = f * 14 < 15000 ? 0.05 : 0;
    play(
      music.keys,
      music.send,
      time,
      total,
      { gain, pan: side * 0.4, wet: 0.22 },
      (t) => {
        const p = TAU * f * t;
        const body = Math.sin(
          p + (0.12 + depth * Math.exp(-t * 5)) * Math.sin(p),
        );
        const bell = tine * Math.sin(14 * p) * Math.exp(-t * 40);
        const tremolo = 1 + 0.12 * side * Math.sin(TAU * 4.6 * (time + t));
        return (
          (body + bell) *
          Math.exp(-t * 1.5) *
          tremolo *
          edge(t, total, 0.004, 0.16)
        );
      },
    );
  }
};

const pad = (
  time: number,
  notes: number[],
  seconds: number,
  gain: number,
  attack = 0.9,
  release = 1.2,
) => {
  const total = seconds + release;
  for (const midi of notes) {
    for (const side of [-1, 0, 1]) {
      const f = hz(midi + side * 0.07);
      play(
        music.keys,
        music.send,
        time,
        total,
        { gain, pan: side * 0.75, wet: 0.5 },
        (t) => {
          const p = TAU * f * t;
          const shimmer = 0.55 + 0.45 * Math.sin(TAU * 0.21 * t + side + midi);
          return (
            (Math.sin(p) +
              shimmer *
                (0.42 * Math.sin(2 * p) +
                  0.2 * Math.sin(3 * p) +
                  0.1 * Math.sin(4 * p))) *
            edge(t, total, attack, release)
          );
        },
      );
    }
  }
};

type MalletShape = Shape & { decay?: number; bright?: number };

/** A soft mallet: bright for an instant, then a pure tone. */
const mallet = (
  target: Bus,
  send: Bus,
  time: number,
  midi: number,
  shape: MalletShape,
) => {
  const f = hz(midi);
  const decay = shape.decay ?? 6.5;
  const total = Math.min(2.6, 5.5 / decay + 0.05);
  const index = 1.7 * (shape.bright ?? 1) * Math.min(1, 900 / f);
  play(target, send, time, total, shape, (t) => {
    const p = TAU * f * t;
    return (
      Math.sin(p + index * Math.exp(-t * 26) * Math.sin(4 * p)) *
      Math.exp(-t * decay) *
      edge(t, total, 0.002, 0.04)
    );
  });
};

/* ---------- interface sounds ---------- */

const tick = (time: number, gain: number, pitch = 2200, pan = 0) =>
  play(
    fx.dry,
    fx.send,
    time,
    0.05,
    { gain, pan, wet: 0.15 },
    (t) =>
      (Math.sin(TAU * pitch * t) * Math.exp(-t * 110) +
        noise() * Math.exp(-t * 700) * 0.3) *
      edge(t, 0.05, 0.0005, 0.01),
  );

const click = (time: number, gain: number, pan = 0) => {
  const filter = new Svf();
  play(fx.dry, fx.send, time, 0.07, { gain, pan, wet: 0.1 }, (t) => {
    const snap = filter.run(noise(), 2600, 0.8).band * Math.exp(-t * 240);
    const knock = Math.sin(TAU * 210 * t) * Math.exp(-t * 85);
    return (snap * 1.4 + knock * 0.9) * edge(t, 0.07, 0.0006, 0.012);
  });
};

const pop = (time: number, midi: number, gain: number, pan = 0) => {
  const f = hz(midi);
  play(fx.dry, fx.send, time, 0.22, { gain, pan, wet: 0.3 }, (t) => {
    const phase = TAU * f * (t - (0.45 / 55) * (1 - Math.exp(-t * 55)));
    return Math.sin(phase) * Math.exp(-t * 20) * edge(t, 0.22, 0.002, 0.03);
  });
};

const thud = (time: number, gain: number) => {
  const filter = new Svf();
  play(fx.dry, fx.send, time, 0.5, { gain, wet: 0.3 }, (t) => {
    const body =
      Math.sin(TAU * (62 * t + (70 / 30) * (1 - Math.exp(-t * 30)))) *
      Math.exp(-t * 9);
    const skin = filter.run(noise(), 520, 0.7).low * Math.exp(-t * 60) * 0.5;
    return (body + skin) * edge(t, 0.5, 0.001, 0.08);
  });
};

const impact = (time: number, gain: number) => {
  const filter = new Svf();
  play(fx.dry, fx.send, time, 1.8, { gain, wet: 0.35 }, (t) => {
    const sub =
      Math.sin(TAU * (40 * t + (46 / 7) * (1 - Math.exp(-t * 7)))) *
      Math.exp(-t * 2.6);
    const air =
      filter.run(noise(), 900 * Math.exp(-t * 3) + 160, 0.7).low *
      Math.exp(-t * 6) *
      0.7;
    return Math.tanh((sub + air) * 1.3) * edge(t, 1.8, 0.002, 0.4);
  });
};

/**
 * Filtered noise that swells to `center` and moves across the stereo field.
 * With `peak` close to 1 it becomes a riser that cuts off on the downbeat.
 */
const whoosh = (
  center: number,
  seconds: number,
  gain: number,
  sweep: [number, number],
  pan: [number, number] = [0, 0],
  peak = 0.5,
) => {
  const filter = new Svf();
  const first = Math.round(Math.max(0, center - seconds * peak) * SR);
  const count = Math.round(seconds * SR);
  for (let i = 0; i < count && first + i < LENGTH; i++) {
    const u = i / count;
    const envelope =
      u < peak
        ? (u / peak) ** 2
        : Math.cos(((u - peak) / (1 - peak)) * Math.PI * 0.5) ** 2;
    const cutoff = sweep[0] * (sweep[1] / sweep[0]) ** u;
    const sample = filter.run(noise(), cutoff, 1.3).band * envelope * gain;
    const angle = ((mix(pan[0], pan[1], u) + 1) * Math.PI) / 4;
    const left = sample * Math.cos(angle);
    const right = sample * Math.sin(angle);
    fx.dry.l[first + i] += left;
    fx.dry.r[first + i] += right;
    fx.send.l[first + i] += left * 0.3;
    fx.send.r[first + i] += right * 0.3;
  }
};

/** A rolled chord of mallets with a quiet octave on top. */
const chime = (time: number, notes: number[], gain: number, roll = 0.035) =>
  notes.forEach((midi, i) => {
    const pan = notes.length > 1 ? mix(-0.5, 0.5, i / (notes.length - 1)) : 0;
    const start = time + i * roll;
    mallet(fx.dry, fx.send, start, midi, { gain, pan, wet: 0.6, decay: 2.6 });
    mallet(fx.dry, fx.send, start, midi + 12, {
      gain: gain * 0.35,
      pan: -pan,
      wet: 0.6,
      decay: 5,
    });
  });

const ding = (time: number, midi: number, gain: number, pan = 0) => {
  mallet(fx.dry, fx.send, time, midi, { gain, pan, wet: 0.45, decay: 7 });
  tick(time, gain * 0.3, 2600, pan);
};

/** The lights going out: a tone falling under the theme switch. */
const powerDown = (time: number, gain: number) =>
  play(
    fx.dry,
    fx.send,
    time,
    0.6,
    { gain, wet: 0.3 },
    (t) =>
      Math.sin(TAU * (110 * t + (700 / 9) * (1 - Math.exp(-t * 9)))) *
      Math.exp(-t * 5) *
      edge(t, 0.6, 0.003, 0.1),
  );

/** The QR code being read: a rising, pulsing tone. */
const scan = (time: number, seconds: number, gain: number, pan: number) =>
  play(fx.dry, fx.send, time, seconds, { gain, pan, wet: 0.25 }, (t) => {
    const ratio = 2.2 ** (t / seconds);
    const phase = (TAU * 1200 * seconds * (ratio - 1)) / Math.log(2.2);
    const pulse = 0.55 + 0.45 * Math.sin(TAU * 30 * t);
    return Math.sin(phase) * pulse * edge(t, seconds, 0.01, 0.03);
  });

/* ---------- harmony ---------- */

const CHORDS = {
  Dm9: { bass: 38, notes: [53, 57, 60, 64] },
  Dm7: { bass: 38, notes: [57, 60, 62, 65] },
  Bb: { bass: 34, notes: [58, 62, 65, 69] },
  C: { bass: 36, notes: [55, 60, 64, 67] },
  CE: { bass: 40, notes: [55, 60, 64, 67] },
  Csus: { bass: 36, notes: [58, 60, 65, 67] },
  Am7: { bass: 33, notes: [57, 60, 64, 67] },
  F: { bass: 41, notes: [53, 57, 60, 67] },
} as const;

type ChordName = keyof typeof CHORDS;

/** One entry per bar; two names split the bar in half. */
const HARMONY: ChordName[][] = [
  ...[["Dm9"], ["Dm9"], ["Bb"], ["Csus"]],
  ...[["F"], ["Bb", "C"]],
  ...[["Bb"], ["C"], ["Am7"], ["Dm7"], ["Bb"], ["C"], ["Dm7", "CE"]],
  ...[["F"], ["CE"], ["Dm7"], ["Bb"], ["C"], ["Dm7"], ["Bb", "C"], ["F"]],
  ...[["Dm7"], ["Bb"], ["C"]],
  ...[["Bb"], ["Dm9"], ["Csus"]],
  ...[["F"], ["Bb"], ["C"], ["F"], ["F"]],
] as ChordName[][];

type Groove =
  | "pulse"
  | "half"
  | "light"
  | "full"
  | "break"
  | "dark"
  | "build"
  | "final"
  | "rest";

const repeat = (groove: Groove, bars: number): Groove[] =>
  Array.from({ length: bars }, () => groove);

/** Follows the scenes: hook, title, 站到站, 月度通勤, 按乘距, 随身用, close. */
const GROOVES: Groove[] = [
  ...repeat("pulse", SCENES.hook.bars),
  ...repeat("half", SCENES.title.bars),
  ...repeat("light", 4),
  ...repeat("full", SCENES.s2s.bars - 4),
  ...repeat("full", SCENES.monthly.bars),
  ...repeat("break", SCENES.distance.bars),
  ...["light", "dark", "build"],
  ...repeat("full", 3),
  ...["final", "rest"],
] as Groove[];

if (HARMONY.length !== TOTAL_BARS || GROOVES.length !== TOTAL_BARS) {
  throw new Error("the score no longer has one entry per bar");
}

const FILLS = [3, 5, 9, 12, 17, 23];
const CRASHES: Record<number, number> = {
  4: 0.1,
  10: 0.085,
  18: 0.075,
  27: 0.11,
  30: 0.09,
};

const chordAt = (bar: number, step: number) => {
  const names = HARMONY[bar];
  return CHORDS[names[step >= 8 && names.length > 1 ? 1 : 0]];
};

/* ---------- drums, bass, keys ---------- */

for (let bar = 0; bar < TOTAL_BARS; bar++) {
  const groove = GROOVES[bar];
  const fill = FILLS.includes(bar);
  if (CRASHES[bar]) crash(grid(bar), CRASHES[bar]);

  for (let step = 0; step < 16; step++) {
    const time = grid(bar, step);
    const onBeat = step % 4 === 0;
    const offBeat = step % 4 === 2;
    const rolling = fill && step >= 12;
    const backbeat = (step === 4 || step === 12) && !rolling;
    if (rolling) snare(time, mix(0.1, 0.26, (step - 12) / 3));

    if (groove === "pulse") {
      if (onBeat) kick(time, mix(0.5, 0.78, bar / 3), true);
      if (bar >= 2 && step % 2 === 0) {
        const rise = (bar - 2 + step / 16) / 2;
        hat(time, mix(0.025, 0.07, rise), false, offBeat ? 0.4 : -0.4);
      }
    } else if (groove === "half") {
      if (step === 0 || step === 8) kick(time, 0.85);
      if (backbeat) clap(time, 0.24);
      if (step % 2 === 0) {
        shaker(time, offBeat ? 0.06 : 0.035, offBeat ? 0.5 : -0.5);
      }
    } else if (groove === "light") {
      if (onBeat) kick(time, 0.85);
      if (backbeat) clap(time, 0.27);
      if (offBeat) hat(time, 0.1);
    } else if (groove === "full") {
      if (onBeat) kick(time, 0.92);
      if (backbeat) {
        clap(time, 0.3);
        snare(time, 0.1);
      }
      if (step === 14 && bar % 2 === 1 && !rolling) hat(time, 0.075, true);
      else if (step % 2 === 0) hat(time, offBeat ? 0.11 : 0.045);
      else shaker(time, 0.03, step % 4 === 1 ? -0.5 : 0.5);
    } else if (groove === "break") {
      if (step === 0 || step === 6 || step === 10) kick(time, 0.85);
      if (backbeat) clap(time, 0.24);
      if (step % 2 === 0) hat(time, offBeat ? 0.08 : 0.04);
    } else if (groove === "dark") {
      if (step === 0 || step === 8) kick(time, 0.8, true);
    } else if (groove === "build") {
      const swell = (at: number) => mix(0.05, 0.28, (at / 15) ** 1.6);
      if (onBeat) kick(time, 0.85);
      if (step >= 8 || step % 2 === 0) snare(time, swell(step));
      if (step >= 12) snare(time + STEP_S / 2, swell(step + 0.5));
    } else if (groove === "final") {
      if (step === 0) kick(time, 0.95);
    }
  }

  /* bass: [step, length in steps, interval above the root] */
  const line: [number, number, number][] =
    groove === "half"
      ? [
          [0, 7, 0],
          [8, 7, 0],
        ]
      : groove === "light" || groove === "full"
        ? [
            [0, 3, 0],
            [3, 3, 0],
            [6, 2, 12],
            [8, 3, 0],
            [11, 3, 0],
            [14, 2, 7],
          ]
        : groove === "break"
          ? [
              [0, 5, 0],
              [6, 3, 0],
              [10, 5, 0],
            ]
          : groove === "build"
            ? [0, 2, 4, 6, 8, 10, 12, 14].map(
                (step) => [step, 1.6, 0] as [number, number, number],
              )
            : [];
  for (const [step, length, interval] of line) {
    const level = groove === "build" ? mix(0.24, 0.4, step / 14) : 0.4;
    bass(
      grid(bar, step),
      chordAt(bar, step).bass + interval,
      length * STEP_S,
      level,
    );
  }
  if (groove === "pulse")
    bass(grid(bar), chordAt(bar, 0).bass, BAR_S, 0.24, 0.3);
  if (groove === "dark")
    bass(grid(bar), chordAt(bar, 0).bass, BAR_S, 0.36, 0.05);
  if (groove === "final") {
    bass(grid(bar), chordAt(bar, 0).bass, BAR_S * 1.8, 0.4);
  }

  /* keys: [step, length in steps, level] */
  const comp: [number, number, number][] =
    groove === "half"
      ? [
          [0, 7, 1],
          [8, 7, 0.9],
        ]
      : groove === "light" || groove === "full"
        ? [
            [0, 5, 1],
            [6, 3, 0.7],
            [10, 5, 0.85],
          ]
        : groove === "final"
          ? [[0, 28, 0.9]]
          : groove === "break" || groove === "dark" || groove === "build"
            ? [[0, 15, 0.9]]
            : [];
  for (const [step, length, level] of comp) {
    for (const midi of chordAt(bar, step).notes) {
      epiano(grid(bar, step), midi, length * STEP_S, 0.075 * level);
    }
  }
}

/* the night chord under the hook, and the last chord left ringing */
pad(grid(0), [...CHORDS.Dm9.notes], BAR_S * 2, 0.028);
pad(grid(2), [...CHORDS.Bb.notes], BAR_S, 0.028, 0.5);
pad(grid(3), [...CHORDS.Csus.notes], BAR_S - 0.2, 0.028, 0.5, 0.3);
pad(grid(25), [...CHORDS.Dm9.notes], BAR_S, 0.02, 0.3, 0.6);
pad(grid(30), [...CHORDS.F.notes, 72], BAR_S * 1.4, 0.022, 0.08, 1.4);

/* ---------- arpeggio and lead ---------- */

const EIGHTHS = [0, 2, 1, 3, 2, 3, 1, 2];
const SIXTEENTHS = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];

const arpeggio = (
  bar: number,
  fast: boolean,
  level: (progress: number) => number,
) => {
  const pattern = fast ? SIXTEENTHS : EIGHTHS;
  pattern.forEach((index, i) => {
    const step = fast ? i : i * 2;
    const accent = fast && i % 2 === 1 ? 0.7 : 1;
    mallet(
      music.arp,
      music.send,
      grid(bar, step),
      chordAt(bar, step).notes[index] + 12,
      {
        gain: level(step / 16) * accent,
        pan: i % 2 ? 0.55 : -0.55,
        wet: 0.3,
        decay: 9,
      },
    );
  });
};

for (let bar = 8; bar <= 29; bar++) {
  if (bar <= 9)
    arpeggio(bar, false, (p) => mix(0.025, 0.07, (bar - 8 + p) / 2));
  else if (bar <= 12) arpeggio(bar, false, () => 0.07);
  else if (bar <= 20) arpeggio(bar, true, () => 0.046);
  else if (bar <= 24) arpeggio(bar, false, () => 0.06);
  else if (bar === 26) arpeggio(bar, true, (p) => mix(0.015, 0.07, p));
  else if (bar >= 27) arpeggio(bar, true, () => 0.055);
}

/** The tune: bar → [step, midi note]. */
const MOTIF: [number, number][] = [
  [0, 69],
  [2, 72],
  [4, 74],
  [7, 72],
  [10, 69],
  [12, 67],
];
const LEAD: Record<number, [number, number][]> = {
  1: [
    [0, 74],
    [6, 81],
    [12, 77],
  ],
  4: MOTIF,
  5: [
    [0, 74],
    [2, 72],
    [4, 70],
    [8, 72],
    [10, 76],
    [12, 79],
  ],
  10: [
    [0, 77],
    [2, 74],
    [4, 77],
    [7, 79],
    [10, 77],
    [12, 74],
  ],
  11: [
    [0, 76],
    [2, 72],
    [4, 76],
    [7, 79],
    [10, 76],
    [12, 72],
  ],
  12: [
    [0, 74],
    [2, 77],
    [4, 81],
    [8, 79],
    [10, 76],
    [12, 72],
  ],
  13: MOTIF,
  14: [
    [0, 67],
    [2, 72],
    [4, 76],
    [7, 74],
    [10, 72],
    [12, 67],
  ],
  17: [
    [8, 72],
    [10, 76],
    [12, 79],
  ],
  18: [[0, 81]],
  20: [
    [0, 81],
    [2, 77],
    [4, 79],
    [7, 77],
    [10, 72],
    [12, 74],
  ],
  21: [
    [0, 74],
    [2, 77],
    [4, 74],
    [7, 72],
    [10, 69],
    [12, 72],
  ],
  24: [
    [0, 74],
    [2, 77],
    [4, 74],
    [7, 72],
    [10, 70],
    [12, 74],
  ],
  27: MOTIF,
  28: [
    [0, 74],
    [2, 72],
    [4, 70],
    [7, 74],
    [10, 77],
    [12, 74],
  ],
  29: [
    [0, 72],
    [2, 76],
    [4, 79],
    [7, 76],
    [10, 79],
    [12, 84],
  ],
};

const sing = (time: number, midi: number, gain: number, decay = 5) =>
  mallet(music.lead, music.send, time, midi, { gain, wet: 0.35, decay });

for (const [bar, notes] of Object.entries(LEAD)) {
  const index = Number(bar);
  const quiet = index < SCENES.title.fromBar;
  const doubled = index >= SCENES.cta.fromBar;
  for (const [step, midi] of notes) {
    sing(grid(index, step), midi, quiet ? 0.11 : 0.2, quiet ? 3.5 : 5);
    if (doubled) sing(grid(index, step), midi + 12, 0.085);
  }
}

/* ---------- sounds tied to what happens on screen ---------- */

type Scene = keyof typeof SCENES;
const cue = (scene: Scene, local: number) => (SCENES[scene].from + local) / FPS;

/** Frames in (from, to] on which `value` differs from the frame before. */
const changes = (
  from: number,
  to: number,
  value: (frame: number) => number,
) => {
  const found: { frame: number; value: number }[] = [];
  for (let frame = from + 1; frame <= to; frame++) {
    const now = value(frame);
    if (now !== value(frame - 1)) found.push({ frame, value: now });
  }
  return found;
};

const report: Record<string, number[]> = {};

/* hook: the news lands word by word, then one ordinary commute */
impact(0, 0.5);
thud(cue("hook", HOOK.date), 0.22);
tick(cue("hook", HOOK.date), 0.05, 1800);
thud(cue("hook", HOOK.headline1), 0.4);
thud(cue("hook", HOOK.headline2), 0.55);
clap(cue("hook", HOOK.headline2), 0.2);
whoosh(cue("hook", HOOK.route), 0.6, 0.2, [300, 2600], [0.6, -0.2], 0.85);
impact(cue("hook", HOOK.route), 0.55);
whoosh(cue("hook", HOOK.route) + 0.7, 1.4, 0.07, [500, 3500], [-0.5, 0.5]);
pop(cue("hook", HOOK.route), 62, 0.1, -0.3);
pop(cue("hook", HOOK.route + BEAT * 2.2), 69, 0.1, 0.3);
ding(cue("hook", HOOK.oldFare), 62, 0.13);
whoosh(cue("hook", HOOK.newFare - 2), 0.16, 0.12, [2500, 6000], [-0.2, 0.2]);
ding(cue("hook", HOOK.newFare), 74, 0.2);
ding(cue("hook", HOOK.newFare), 81, 0.14);
thud(cue("hook", HOOK.newFare), 0.45);
clap(cue("hook", HOOK.newFare), 0.26);
[67, 72, 77].forEach((midi, i) =>
  sing(cue("hook", HOOK.question + (i * BEAT) / 2), midi, 0.16, 4),
);
whoosh(grid(SCENES.title.fromBar), 1.8, 0.2, [400, 8000], [0, 0], 0.97);

/* title */
impact(cue("title", TITLE.logo), 0.5);
[77, 79, 81, 84, 86, 89].forEach((midi, i) =>
  mallet(fx.dry, fx.send, cue("title", TITLE.name + i * 2.4), midi, {
    gain: 0.05,
    pan: mix(-0.6, 0.6, i / 5),
    wet: 0.5,
    decay: 9,
  }),
);
pop(cue("title", TITLE.name + BEAT), 77, 0.12);
tick(cue("title", TITLE.name + BEAT * 2), 0.035, 3200);
thud(cue("title", TITLE.tagline), 0.25);
tick(cue("title", TITLE.tagline + BEAT * 2), 0.035, 3200);
whoosh(
  cue("title", SCENES.title.duration - 4),
  0.5,
  0.14,
  [700, 5000],
  [0, -0.8],
);

/* 站到站: typing, picking, the meter climbing as the route is drawn */
click(cue("s2s", S2S.focusFrom), 0.14, -0.4);
TYPED.from.split("").forEach((_, i) => {
  click(cue("s2s", S2S.typeFrom + (i * BEAT) / 2), 0.17, -0.4);
});
click(cue("s2s", S2S.pickFrom), 0.14, -0.4);
ding(cue("s2s", S2S.pickFrom), 72, 0.14, -0.3);
click(cue("s2s", S2S.typeTo - 6), 0.12, -0.4);
TYPED.to.split("").forEach((_, i) => {
  click(cue("s2s", S2S.typeTo + (i * BEAT) / 2), 0.17, -0.4);
});
click(cue("s2s", S2S.pickTo), 0.14, -0.4);
ding(cue("s2s", S2S.pickTo), 77, 0.14, -0.3);
whoosh(cue("s2s", S2S.pickTo + 14), 0.35, 0.08, [600, 3000], [-0.4, 0.4]);

const drawFrames = S2S.arrive - S2S.drawStart;
const METER_NOTES = [72, 74, 77, 79, 81, 84];
report["meter steps"] = changes(S2S.drawStart, S2S.arrive, (frame) =>
  meterFare(clamp01((frame - S2S.drawStart) / drawFrames)),
).map((step, i) => {
  ding(cue("s2s", step.frame), METER_NOTES[i % METER_NOTES.length], 0.17, 0.3);
  return step.frame;
});
pop(cue("s2s", S2S.drawStart + TRIP.legs[0].t1 * drawFrames), 69, 0.09, 0.3);
whoosh(cue("s2s", S2S.arrive), 1, 0.12, [500, 7000], [0, 0], 0.97);
impact(cue("s2s", S2S.arrive), 0.28);
chime(cue("s2s", S2S.arrive), [74, 77, 81, 86], 0.15);
pop(cue("s2s", S2S.compare), 70, 0.1, -0.3);
[0, 1, 2].forEach((i) =>
  tick(cue("s2s", S2S.chips + i * 4), 0.05, 2400 + i * 300, -0.3),
);
whoosh(cue("s2s", S2S.facts) + 0.25, 0.7, 0.12, [3000, 500], [0.4, -0.4], 0.4);
const countStart = S2S.factsCount - 8;
changes(countStart, countStart + 40, (frame) =>
  Math.floor(tween(frame, countStart, 40, easeOut) * 18),
).forEach((step) =>
  tick(cue("s2s", step.frame), 0.04, 1600 * 2 ** (step.value / 18), -0.3),
);
[72, 76, 79].forEach((midi, i) =>
  pop(cue("s2s", S2S.factsCount + BEAT + i * 5), midi, 0.08, -0.3),
);

/* scene hand-overs slide to the left */
for (const scene of ["monthly", "distance", "anywhere"] as const) {
  whoosh(cue(scene, 0), 0.55, 0.13, [500, 4000], [0.7, -0.7]);
}

/* 月度通勤: every ride added by the slider ticks, a new cheapest plan rings */
const rideTick = (step: { frame: number; value: number }) =>
  tick(
    cue("monthly", step.frame),
    0.045,
    1500 * 2 ** ((step.value - RIDES.start) / 30),
    mix(0.1, 0.6, (step.value - RIDES.start) / (RIDES.combo - RIDES.start)),
  );
const cheapest = (frame: number) =>
  bestPlanIndex(monthlyPlans(TRIP.fare, ridesAt(frame)));

click(cue("monthly", MONTHLY.grab), 0.14, 0.3);
changes(MONTHLY.drag1Start, MONTHLY.drag1End, ridesAt).forEach(rideTick);
report["cheapest plan changes"] = changes(
  MONTHLY.drag1Start,
  MONTHLY.drag2End,
  cheapest,
).map((step, i) => {
  ding(cue("monthly", step.frame), [74, 77, 81][i % 3], 0.18, 0.3);
  pop(cue("monthly", step.frame), 62, 0.08, 0.3);
  return step.frame;
});
click(cue("monthly", MONTHLY.drag1End + 6), 0.08, 0.4);
chime(cue("monthly", MONTHLY.callout), [74, 77, 81], 0.14);
click(cue("monthly", MONTHLY.drag2Start - 6), 0.12, 0.4);
changes(MONTHLY.drag2Start, MONTHLY.drag2End, ridesAt).forEach(rideTick);
click(cue("monthly", MONTHLY.drag2End + 6), 0.08, 0.5);

/* 组合价: the pass fills its squares in a rush, the single rides one by one */
const comboPlans = monthlyPlans(TRIP.fare, RIDES.combo);
const combo = comboPlans[bestPlanIndex(comboPlans)];
whoosh(cue("monthly", MONTHLY.combo), 0.5, 0.13, [500, 4500], [0.6, -0.6], 0.6);
impact(cue("monthly", MONTHLY.combo), 0.28);
whoosh(
  cue("monthly", MONTHLY.combo + 7),
  0.45,
  0.06,
  [3000, 7000],
  [-0.5, 0.5],
);
for (let i = 0; i < combo.pass; i += 3) {
  tick(
    cue("monthly", MONTHLY.tokensPass + i),
    0.04,
    1100 * 2 ** (i / combo.pass),
    ((i % 13) / 12 - 0.5) * 0.9 + 0.3,
  );
}
for (let i = 0; i < combo.over; i++) {
  const time = cue("monthly", MONTHLY.tokensSingle + i * 4);
  mallet(fx.dry, fx.send, time, 65, { gain: 0.13, pan: 0.3, decay: 16 });
  click(time, 0.07, 0.3);
}
[72, 76, 79].forEach((midi, i) => {
  const time = cue("monthly", MONTHLY.equation + (i * BEAT) / 2);
  sing(time, midi, 0.2);
  pop(time, midi - 12, 0.08, mix(0, 0.6, i / 2));
});
chime(cue("monthly", MONTHLY.saving), [77, 81, 84, 89], 0.14);
tick(cue("monthly", MONTHLY.saving + 6), 0.05, 2600, 0.3);

/* 按乘距: the ladder draws itself, then each fare step under the drag rings */
const revealStart = DISTANCE.curves - 6;
const fareSteps: number[] = [];
for (let km = 1; km < 30; km++) {
  if (fareNew(km + 0.001) !== fareNew(km)) fareSteps.push(km);
}
fareSteps.forEach((km, i) => {
  let frame = revealStart;
  while (tween(frame, revealStart, 30, easeInOut) < km / 30) frame++;
  mallet(fx.dry, fx.send, cue("distance", frame), [62, 65, 67, 69, 72][i % 5], {
    gain: 0.09,
    pan: mix(-0.2, 0.7, km / 30),
    wet: 0.4,
    decay: 10,
  });
});
whoosh(cue("distance", DISTANCE.curves + 9), 1, 0.07, [600, 3500], [0, 0.7]);
pop(cue("distance", DISTANCE.curves + 18), 74, 0.08, 0.2);
click(cue("distance", DISTANCE.grab), 0.14, 0.2);
changes(DISTANCE.dragStart, DISTANCE.dragEnd, (frame) =>
  Math.floor(kmAt(frame)),
).forEach((step) =>
  tick(
    cue("distance", step.frame),
    0.035,
    1300 * 2 ** (step.value / KM.end),
    mix(0.1, 0.7, step.value / 30),
  ),
);
report["new fare steps"] = changes(
  DISTANCE.dragStart,
  DISTANCE.dragEnd,
  (frame) => fareNew(kmAt(frame)),
).map((step, i) => {
  ding(cue("distance", step.frame), [74, 77, 79, 81, 84][i % 5], 0.19, 0.4);
  return step.frame;
});
report["old fare steps"] = changes(
  DISTANCE.dragStart,
  DISTANCE.dragEnd,
  (frame) => fareOld(kmAt(frame)),
).map((step, i) => {
  mallet(fx.dry, fx.send, cue("distance", step.frame), [57, 60][i % 2], {
    gain: 0.14,
    pan: -0.2,
    wet: 0.4,
    decay: 9,
  });
  return step.frame;
});
click(cue("distance", DISTANCE.dragEnd + 6), 0.08, 0.6);
chime(cue("distance", DISTANCE.verdict), [76, 79, 84], 0.14);
[72, 76, 79].forEach((midi, i) =>
  pop(cue("distance", DISTANCE.verdict + (i * BEAT) / 2), midi, 0.08, -0.4),
);

/* 随身用: the phone arrives, one tap turns the lights off */
whoosh(
  cue("anywhere", ANYWHERE.phone - 2),
  0.4,
  0.08,
  [500, 2500],
  [0.5, 0.5],
  0.6,
);
pop(cue("anywhere", ANYWHERE.phone), 67, 0.1, 0.5);
click(cue("anywhere", ANYWHERE.press), 0.2, 0.6);
powerDown(cue("anywhere", ANYWHERE.press), 0.22);
whoosh(
  cue("anywhere", ANYWHERE.press) + 0.15,
  0.7,
  0.14,
  [5000, 300],
  [0.6, -0.6],
  0.3,
);
whoosh(
  cue("anywhere", ANYWHERE.press + 29),
  0.5,
  0.05,
  [1500, 4000],
  [0.6, 0.6],
);
pop(cue("anywhere", ANYWHERE.share), 69, 0.1, 0);
[0, 1, 2].forEach((i) =>
  tick(cue("anywhere", ANYWHERE.share + 4 + i * 5), 0.05, 2000 + i * 250, 0),
);
ding(cue("anywhere", ANYWHERE.copied), 76, 0.15, 0.1);
ding(cue("anywhere", ANYWHERE.copied + 3), 81, 0.15, 0.1);
pop(cue("anywhere", ANYWHERE.open), 72, 0.09, -0.4);
whoosh(
  cue("anywhere", ANYWHERE.open + 20),
  0.5,
  0.05,
  [1500, 4000],
  [0.6, 0.6],
);
whoosh(grid(SCENES.cta.fromBar), 2.3, 0.26, [300, 9000], [0, 0], 0.975);

/* close */
impact(cue("cta", CTA.hit), 0.55);
whoosh(cue("cta", CTA.hit) + 0.25, 0.9, 0.1, [4000, 600], [0, 0], 0.25);
tick(cue("cta", CTA.hit + BEAT + 6), 0.035, 3200);
whoosh(cue("cta", CTA.line + 1), 0.55, 0.1, [800, 4500], [0, -0.7]);
thud(cue("cta", CTA.line), 0.35);
pop(cue("cta", CTA.line), 65, 0.08, -0.4);
thud(cue("cta", CTA.line2), 0.5);
thud(cue("cta", CTA.url), 0.2);
pop(cue("cta", CTA.url), 77, 0.14, -0.4);
thud(cue("cta", CTA.qr), 0.3);
pop(cue("cta", CTA.qr), 72, 0.1, 0.5);
scan(cue("cta", CTA.qr + 4), 22 / FPS, 0.045, 0.5);
tick(cue("cta", CTA.qr + 26), 0.07, 2800, 0.5);
[72, 76, 79].forEach((midi, i) =>
  pop(cue("cta", CTA.chips + (i * BEAT) / 2), midi, 0.09, mix(-0.6, 0, i / 2)),
);
impact(cue("cta", CTA.final), 0.3);
chime(cue("cta", CTA.final), [65, 69, 72, 77, 81, 84], 0.13, 0.03);
tick(cue("cta", CTA.final + BEAT), 0.035, 3200);
tick(cue("cta", CTA.final + BEAT * 5), 0.03, 3200);

/* ---------- effects and mixdown ---------- */

const addInto = (target: Bus, source: Bus, gain = 1) => {
  for (let n = 0; n < LENGTH; n++) {
    target.l[n] += source.l[n] * gain;
    target.r[n] += source.r[n] * gain;
  }
};

/** Everything but the drums dips under each kick, which makes the groove breathe. */
const duck = (target: Bus, depth: number) => {
  const curve = new Float32Array(LENGTH);
  for (const time of kickTimes) {
    const first = Math.round(time * SR);
    for (let i = 0; i < 0.4 * SR && first + i < LENGTH; i++) {
      const t = i / SR;
      const dip = Math.min(1, t / 0.006) * Math.exp(-t / 0.11);
      if (dip > curve[first + i]) curve[first + i] = dip;
    }
  }
  for (let n = 0; n < LENGTH; n++) {
    const gain = 1 - depth * curve[n];
    target.l[n] *= gain;
    target.r[n] *= gain;
  }
};

/** Echoes that bounce left, right, left on dotted eighths. */
const pingPong = (source: Bus, seconds: number, feedback: number) => {
  const out = bus();
  const delay = Math.round(seconds * SR);
  let dampL = 0;
  let dampR = 0;
  for (let n = delay; n < LENGTH; n++) {
    const input = (source.l[n - delay] + source.r[n - delay]) * 0.5;
    dampL += (input + feedback * out.r[n - delay] - dampL) * 0.38;
    dampR += (feedback * out.l[n - delay] - dampR) * 0.38;
    out.l[n] = dampL;
    out.r[n] = dampR;
  }
  return out;
};

/** Freeverb: eight damped combs into four all-passes per side. */
const reverb = (send: Bus, level: number) => {
  const out = bus();
  const room = 0.84;
  const damp = 0.28;
  const preDelay = Math.round(0.018 * SR);
  [out.l, out.r].forEach((channel, side) => {
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(
      (size) => ({
        buffer: new Float32Array(size + side * 23),
        at: 0,
        store: 0,
      }),
    );
    const passes = [556, 441, 341, 225].map((size) => ({
      buffer: new Float32Array(size + side * 23),
      at: 0,
    }));
    const lowCut = new Svf();
    for (let n = preDelay; n < LENGTH; n++) {
      const input = (send.l[n - preDelay] + send.r[n - preDelay]) * 0.03;
      let sum = 0;
      for (const comb of combs) {
        const echo = comb.buffer[comb.at];
        comb.store = echo * (1 - damp) + comb.store * damp;
        comb.buffer[comb.at] = input + comb.store * room;
        comb.at = (comb.at + 1) % comb.buffer.length;
        sum += echo;
      }
      for (const pass of passes) {
        const echo = pass.buffer[pass.at];
        pass.buffer[pass.at] = sum + echo * 0.5;
        pass.at = (pass.at + 1) % pass.buffer.length;
        sum = echo - sum;
      }
      channel[n] = lowCut.run(sum, 240, 0.7).high * 3 * level;
    }
  });
  return out;
};

/** Low-pass that closes when the theme goes dark and opens again by `to`. */
const darken = (target: Bus, from: number, hold: number, to: number) => {
  const first = Math.round((from - 0.02) * SR);
  const last = Math.round((to + 0.02) * SR);
  const filters = [new Svf(), new Svf()];
  for (let n = first; n < last && n < LENGTH; n++) {
    const t = n / SR;
    const closed =
      clamp01((t - from) / 0.28) *
      (1 - clamp01((t - hold) / (to - hold)) ** 1.5);
    const cutoff = 18000 * (650 / 18000) ** closed;
    const blend = clamp01(
      Math.min((n - first) / (0.02 * SR), (last - n) / (0.02 * SR)),
    );
    target.l[n] = mix(
      target.l[n],
      filters[0].run(target.l[n], cutoff, 0.8).low,
      blend,
    );
    target.r[n] = mix(
      target.r[n],
      filters[1].run(target.r[n], cutoff, 0.8).low,
      blend,
    );
  }
};

duck(music.bass, 0.5);
duck(music.keys, 0.38);
duck(music.arp, 0.25);

const song = bus();
for (const part of [music.kick, music.drums, music.bass, music.keys]) {
  addInto(song, part);
}
addInto(song, music.arp);
addInto(song, music.lead);
const echoes = bus();
addInto(echoes, music.arp, 0.8);
addInto(echoes, music.lead);
addInto(song, pingPong(echoes, STEP_S * 3, 0.36), 0.32);
const musicRoom = reverb(music.send, REVERB_RETURN.music);
addInto(song, musicRoom);
const darkBar = SCENES.anywhere.fromBar + 1;
darken(song, grid(darkBar), grid(darkBar + 1), grid(SCENES.cta.fromBar));
addInto(song, fx.dry);
addInto(song, reverb(fx.send, REVERB_RETURN.fx));

/*
 * Remove rumble and the top few kilohertz nobody hears (noise that close to
 * Nyquist only costs headroom), then let the last chord fade with the picture.
 */
{
  const fade = 1.4 * SR;
  for (const channel of [song.l, song.r]) {
    const lowCut = new Svf();
    const highCut = new Svf();
    for (let n = 0; n < LENGTH; n++) {
      const tail = Math.sin(clamp01((LENGTH - n) / fade) * Math.PI * 0.5) ** 2;
      const kept = lowCut.run(channel[n], 28, 0.707).high;
      channel[n] = highCut.run(kept, 17000, 0.707).low * tail;
    }
  }
}

/* ---------- mastering ---------- */

const rms = (source: Bus, from = 0, to = LENGTH) => {
  let sum = 0;
  for (let n = from; n < to; n++) sum += source.l[n] ** 2 + source.r[n] ** 2;
  return Math.sqrt(sum / (2 * Math.max(1, to - from)));
};

/** Integrated loudness after ITU-R BS.1770 (K-weighting, two gates). */
const loudness = (source: Bus) => {
  const biquad = (b: number[], a: number[], input: Float64Array) => {
    const out = new Float64Array(input.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let n = 0; n < input.length; n++) {
      const x = input[n];
      const y =
        (b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[n] = y;
    }
    return out;
  };
  const weigh = (channel: Float32Array) => {
    /* both stages re-derived for this sample rate, as libebur128 does */
    const shelfK = Math.tan((Math.PI * 1681.974450955533) / SR);
    const shelfQ = 0.7071752369554196;
    const shelfHigh = 10 ** (3.999843853973347 / 20);
    const shelfBand = shelfHigh ** 0.4996667741545416;
    const shelved = biquad(
      [
        shelfHigh + (shelfBand * shelfK) / shelfQ + shelfK * shelfK,
        2 * (shelfK * shelfK - shelfHigh),
        shelfHigh - (shelfBand * shelfK) / shelfQ + shelfK * shelfK,
      ],
      [
        1 + shelfK / shelfQ + shelfK * shelfK,
        2 * (shelfK * shelfK - 1),
        1 - shelfK / shelfQ + shelfK * shelfK,
      ],
      Float64Array.from(channel),
    );
    const passK = Math.tan((Math.PI * 38.13547087602444) / SR);
    const passQ = 0.5003270373238773;
    const passNorm = 1 + passK / passQ + passK * passK;
    return biquad(
      [1, -2, 1],
      [
        1,
        (2 * (passK * passK - 1)) / passNorm,
        (1 - passK / passQ + passK * passK) / passNorm,
      ],
      shelved,
    );
  };
  const left = weigh(source.l);
  const right = weigh(source.r);
  const sums = new Float64Array(LENGTH + 1);
  for (let n = 0; n < LENGTH; n++) {
    sums[n + 1] = sums[n] + left[n] ** 2 + right[n] ** 2;
  }
  const block = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const powers: number[] = [];
  for (let start = 0; start + block <= LENGTH; start += hop) {
    powers.push((sums[start + block] - sums[start]) / block);
  }
  const lufs = (power: number) => -0.691 + 10 * Math.log10(power);
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const audible = powers.filter((power) => lufs(power) > -70);
  const gate = lufs(mean(audible)) - 10;
  return lufs(mean(audible.filter((power) => lufs(power) > gate)));
};

/**
 * Largest absolute value near each sample once the signal is oversampled
 * four times, i.e. the peak a converter or a lossy encoder will really see.
 */
const truePeaks = (source: Bus) => {
  const half = 8;
  const kernels = [0.25, 0.5, 0.75].map((offset) =>
    Float64Array.from({ length: half * 2 }, (_, tap) => {
      const x = tap - half + 1 - offset;
      const hann = 0.5 + 0.5 * Math.cos((Math.PI * x) / half);
      return (Math.sin(Math.PI * x) / (Math.PI * x)) * hann;
    }),
  );
  const peaks = new Float32Array(LENGTH);
  for (const channel of [source.l, source.r]) {
    for (let n = 0; n < LENGTH; n++) {
      let top = Math.abs(channel[n]);
      if (n >= half - 1 && n + half < LENGTH) {
        for (const kernel of kernels) {
          let sum = 0;
          for (let tap = 0; tap < half * 2; tap++) {
            sum += channel[n - half + 1 + tap] * kernel[tap];
          }
          top = Math.max(top, Math.abs(sum));
        }
      }
      if (top > peaks[n]) peaks[n] = top;
    }
  }
  return peaks;
};

const highest = (values: Float32Array) => {
  let top = 0;
  for (let n = 0; n < values.length; n++) top = Math.max(top, values[n]);
  return top;
};

/**
 * Look-ahead true-peak limiter.
 *
 * The gain is the mean, over the look-ahead window, of the lowest gain any
 * sample in reach needs. That mean never exceeds what the current sample
 * needs and it cannot jump, so the limiter neither overshoots nor clicks.
 */
const master = (source: Bus, peaks: Float32Array, gain: number) => {
  const out = bus();
  const look = Math.round(0.005 * SR);
  const needed = new Float32Array(LENGTH);
  for (let n = 0; n < LENGTH; n++) {
    const top = Math.max(peaks[n], n > 0 ? peaks[n - 1] : 0) * gain;
    needed[n] = top > CEILING ? CEILING / top : 1;
  }
  /* lowest gain needed anywhere in the next `look` samples */
  const ahead = new Float32Array(LENGTH);
  const queue = new Int32Array(LENGTH);
  let head = 0;
  let tail = 0;
  for (let n = LENGTH - 1; n >= 0; n--) {
    while (tail > head && needed[queue[tail - 1]] >= needed[n]) tail--;
    queue[tail++] = n;
    while (queue[head] > n + look) head++;
    ahead[n] = needed[queue[head]];
  }
  let window = 0;
  let smooth = 1;
  let deepest = 1;
  let busy = 0;
  let reduction = 0;
  const perBar = new Array<number>(TOTAL_BARS).fill(1);
  const release = 1 - Math.exp(-1 / (0.12 * SR));
  for (let n = 0; n < LENGTH; n++) {
    window += ahead[n] - (n >= look ? ahead[n - look] : 1);
    const wanted = window / look + 1;
    smooth = wanted < smooth ? wanted : smooth + (wanted - smooth) * release;
    deepest = Math.min(deepest, smooth);
    reduction += db(smooth);
    const bar = Math.min(TOTAL_BARS - 1, Math.floor(n / SR / BAR_S));
    if (smooth < perBar[bar]) perBar[bar] = smooth;
    if (smooth < 0.891) busy++;
    out.l[n] = source.l[n] * gain * smooth;
    out.r[n] = source.r[n] * gain * smooth;
  }
  return {
    out,
    deepest,
    busy: busy / LENGTH,
    average: reduction / LENGTH,
    perBar,
  };
};

const songPeaks = truePeaks(song);
let gain = 10 ** ((TARGET_LUFS - loudness(song)) / 20);
let mastered = master(song, songPeaks, gain);
for (let pass = 0; pass < 8; pass++) {
  const error = TARGET_LUFS - loudness(mastered.out);
  if (Math.abs(error) < 0.03) break;
  gain *= 10 ** (error / 20);
  mastered = master(song, songPeaks, gain);
}
const final = mastered.out;

/* ---------- report ---------- */

const bandLevel = (low: number, high: number) => {
  const lowCut = new Svf();
  const highCut = new Svf();
  let sum = 0;
  for (let n = 0; n < LENGTH; n++) {
    const mono = (final.l[n] + final.r[n]) * 0.5;
    const kept = highCut.run(
      lowCut.run(mono, low, 0.707).high,
      high,
      0.707,
    ).low;
    sum += kept * kept;
  }
  return db(Math.sqrt(sum / LENGTH));
};

console.log(
  `length         ${(LENGTH / SR).toFixed(3)} s, ${TOTAL_BARS} bars at ${BPM} BPM`,
);
console.log(
  `loudness       ${loudness(final).toFixed(2)} LUFS (target ${TARGET_LUFS})`,
);
console.log(
  `true peak      ${db(highest(truePeaks(final))).toFixed(2)} dBTP (ceiling ${db(CEILING).toFixed(1)})`,
);
console.log(
  `limiter        make-up ${db(gain).toFixed(1)} dB · deepest ${db(mastered.deepest).toFixed(1)} dB · average ${mastered.average.toFixed(2)} dB · below -1 dB for ${(mastered.busy * 100).toFixed(1)}% of the time`,
);
console.log(
  `reverb return  ${(db(rms(musicRoom)) - db(rms(song))).toFixed(1)} dB under the mix`,
);
const stems = { ...music, send: musicRoom, fx: fx.dry };
console.log(
  `stems vs mix   ${Object.entries(stems)
    .map(
      ([name, stem]) => `${name} ${(db(rms(stem)) - db(rms(song))).toFixed(1)}`,
    )
    .join(" · ")}`,
);
console.log(
  `spectrum       <120 Hz ${bandLevel(20, 120).toFixed(1)} · 120–2k ${bandLevel(120, 2000).toFixed(1)} · >2k ${bandLevel(2000, 18000).toFixed(1)} dB`,
);
const perBar = Array.from({ length: TOTAL_BARS }, (_, bar) =>
  db(
    rms(final, Math.round(grid(bar) * SR), Math.round(grid(bar + 1) * SR)),
  ).toFixed(0),
);
console.log(`level per bar  ${perBar.join(" ")}`);
console.log(
  `limit per bar  ${mastered.perBar.map((value) => db(value).toFixed(0)).join(" ")}`,
);
for (const [name, frames] of Object.entries(report)) {
  console.log(`${name.padEnd(14)} local frames ${frames.join(", ")}`);
}

/* ---------- files ---------- */

const wavPath = path.resolve("public/metrochan-beat.wav");
const mp3Path = path.resolve("public/metrochan-beat.mp3");

const wav = Buffer.alloc(44 + LENGTH * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + LENGTH * 4, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(LENGTH * 4, 40);
const quantise = (value: number) =>
  Math.max(
    -32768,
    Math.min(32767, Math.round(value * 32767 + random() - random())),
  );
for (let n = 0; n < LENGTH; n++) {
  wav.writeInt16LE(quantise(final.l[n]), 44 + n * 4);
  wav.writeInt16LE(quantise(final.r[n]), 46 + n * 4);
}
writeFileSync(wavPath, wav);

/* Remotion ships an ffmpeg with libmp3lame; use it so nothing else is needed. */
const packages = path.resolve("node_modules/@remotion");
const compositor = readdirSync(packages).find((name) =>
  name.startsWith("compositor-"),
);
if (!compositor) throw new Error("no @remotion/compositor-* package found");
const binaries = path.join(packages, compositor);
const encode = spawnSync(
  path.join(binaries, "ffmpeg"),
  [
    "-y",
    "-v",
    "error",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "192k",
    mp3Path,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DYLD_LIBRARY_PATH: binaries,
      LD_LIBRARY_PATH: binaries,
    },
  },
);
if (encode.status !== 0) throw new Error("ffmpeg could not encode the MP3");
console.log(`wrote          ${path.relative(process.cwd(), mp3Path)}`);

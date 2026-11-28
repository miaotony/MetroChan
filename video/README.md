# MetroChan intro film

A 76.8-second Remotion film: 1920×1080, 30 fps, 32 bars at 100 BPM.
One beat is exactly 18 frames, so every cut and reveal sits on the same grid
the soundtrack is generated from.

## Story

Seven scenes, weighted towards what people come back for:

| Starts | Bars | Scene              | What happens                                                                                                     |
| ------ | ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 0:00   | 4    | Hook               | The fare change lands, then one everyday commute: 莘庄 → 陆家嘴 goes from 5 to 7 yuan. "你的那一趟呢？"          |
| 0:09.6 | 2    | Title              | Logo, name and the promise: 每一趟、每个月，都帮你算清楚                                                         |
| 0:14.4 | 7    | 站到站             | `xz` and `ljz` are typed, the route draws on the map while the meter climbs tier by tier, then the network facts |
| 0:31.2 | 8    | 月度通勤 + 组合价  | The cursor drags the rides slider 22 → 44 → 52, the cheapest plan changes live, then pass + single rides add up  |
| 0:50.4 | 3    | 按乘距             | The cursor drags the trip length 3 → 26 km along the old and the new fare ladder                                 |
| 0:57.6 | 3    | 随身用             | Phone layout, one tap wipes the whole frame to the dark theme, share link, open source                           |
| 1:04.8 | 5    | Close              | Call to action, address and a scannable QR code                                                                  |

## Where the numbers come from

Nothing on screen is typed in by hand.

- `src/data.ts` reads the site's own `../data/*.json` and mirrors the fare
  rules of `index.html`: fares, distances, routes, the map, station search and
  the monthly plans are all computed from there.
- `src/timeline.ts` is the single source of timing and `src/motion.ts` holds
  the values of the two dragged sliders. The scenes and
  `scripts/make_music.ts` both import them, so each number that changes on
  screen has a sound on exactly that frame.
- `src/qr.json` is built with the QR library the site ships and points to the
  live site.
- `public/shots/` holds screenshots of the real page in both themes.

## Commands

```bash
bun install
bun run dev                          # Remotion Studio
bun run lint                         # eslint + tsc
bun run scripts/stills.ts 470 1152   # half-size stills of those frames in out/stills/
bun x remotion render MetroChanIntro out/MetroChanIntro.mp4 \
  --crf=17 --audio-bitrate=256k
```

The finished film, `out/MetroChanIntro.mp4`, is checked in because the root
README links to it. Everything else in `out/` is ignored by Git.

Regenerating the assets:

```bash
bun run scripts/make_music.ts        # after changing timeline.ts or motion.ts
bun run scripts/build_qr.ts          # after changing the site address
bun run scripts/og.ts                # share card ../og.png, the closing frame at 1200×630
python3 -m http.server 4173 --directory .. &
bun run scripts/capture.ts           # after the page's look changes
```

## Soundtrack

`scripts/make_music.ts` synthesises the whole track sample by sample, with no
samples or external audio: drums, bass, electric piano, a mallet arpeggio and
lead, plus the interface sounds. It masters to −14 LUFS with a true-peak
limiter at −2 dBTP, prints a report (loudness, peak, stem balance, level and
gain reduction per bar, frames of the picture-locked sounds) and writes
`public/metrochan-beat.mp3`. The intermediate WAV is ignored by Git.

## Files

- `src/Film.tsx` — scene order and the audio track
- `src/OgCard.tsx` — the closing frame reworked as the site's share card
- `src/timeline.ts`, `src/motion.ts` — timing shared by picture and sound
- `src/data.ts`, `src/theme.ts` — data, fare rules, colours and fonts
- `src/scenes/` — `Hook`, `Title`, `StationToStation`, `Monthly`, `Distance`,
  `Anywhere`, `Cta`
- `src/components/` — logo, cursor, network map, top bar, shared pieces
- `scripts/` — `make_music.ts`, `stills.ts`, `capture.ts`, `build_qr.ts`,
  `og.ts`

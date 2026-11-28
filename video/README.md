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

- `scripts/prepare-data.ts` uses the V2 station dictionary and the site's own
  official decoder to read **one** block from `../data/official/routes/` and
  look up 莘庄 → 陆家嘴. It uses the first official option and the site's route
  helpers for the stops and distance. `../data/official/map.bin` supplies the
  whole map: the film draws the network as well as the highlighted trip.
  Only that trip and map are written to `generated/film.json` (Git-ignored).
- `src/data.ts` combines this with `../data/metro_data.json` for station search
  and line memberships, `../data/meta.json` for the snapshot facts,
  and the site's distance-fare functions for the animated fare meter.
- `src/timeline.ts` is the single source of timing and `src/motion.ts` holds
  the values of the two dragged sliders. The scenes and
  `scripts/make_music.ts` both import them, so each number that changes on
  screen has a sound on exactly that frame.
- `src/qr.json` uses the site's `qrcode-generator` package and points to the live site.
- `public/shots/` holds screenshots of the real page in both themes.

## Commands

Run these from `video/`. The site build does not install or run Remotion.

```bash
bun install --frozen-lockfile
bun run dev               # Remotion Studio
bun run typecheck         # TypeScript only
bun run lint              # ESLint + typecheck
bun run build             # bundle in out/bundle/
bun run stills 470 1152   # half-size frames in out/stills/
bun run render            # replace out/MetroChanIntro.mp4
```

The commands that consume film data prepare it automatically, including the
music and OG scripts. Before a raw `bun x remotion …` command, or after editing
the official data while Studio is open, run `bun run prepare:data`.

The finished film, `out/MetroChanIntro.mp4`, is checked in because the root
README links to it. Everything else in `out/` is ignored by Git.

Regenerating the assets:

```bash
bun run music             # after changing timeline.ts or motion.ts
bun run qr                # after changing the site address; requires npm ci at repo root
bun run og                # native 1920×1008 share card in out/og.png
```

The OG script never writes a site asset. Manually resize/compress the master
to the published 1200×630 `../public/og.png` when ready.

To refresh the site screenshots, run `npm ci`, `npm run build:web`, then
`npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` at the repo
root. Alternatively, serve the **built `dist/`**, not the source tree, at
`http://127.0.0.1:4173/`. In a second terminal in `video/`, run
`bun run capture out/review-shots` to preview, or `bun run capture` to replace
`public/shots/`. Capture waits for the official trip map before taking shots.

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
- `scripts/` — data preparation, music, stills, capture, QR and OG exports

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CHROME_LOGO } from "../components/Chrome";
import { blinkAt, LogoIcon } from "../components/Logo";
import { BaseNetwork, MapCamera } from "../components/NetworkMap";
import { Paper } from "../components/Paper";
import { backOut, easeInOut, easeOut, lerp, tween } from "../lib/anim";
import { C, F } from "../theme";
import { BEAT, HEIGHT, SCENES, TITLE, WIDTH } from "../timeline";

const LOGO = { size: 272, x: 960, y: 322 };
const NAME = "MetroChan";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.title.duration;

  const reveal = tween(frame, 0, 16, easeOut);
  const pop = tween(frame, TITLE.logo, 16, backOut);
  const fly = tween(frame, duration - 12, 18, easeInOut);
  const exit = tween(frame, duration - 12, 10, easeOut);

  const size = lerp(LOGO.size, CHROME_LOGO.size, fly);
  const logoX = lerp(LOGO.x, CHROME_LOGO.x + CHROME_LOGO.size / 2, fly);
  const logoY = lerp(LOGO.y, CHROME_LOGO.y + CHROME_LOGO.size / 2, fly);
  const blink = Math.max(
    blinkAt(frame, TITLE.name + BEAT * 2),
    blinkAt(frame, TITLE.tagline + BEAT * 2),
  );
  const tagline = tween(frame, TITLE.tagline, 18, easeOut);
  const drift = tween(frame, 0, duration + 12, (t) => t);

  return (
    <AbsoluteFill
      style={{
        clipPath: `circle(${reveal * 1300}px at ${LOGO.x}px ${LOGO.y}px)`,
      }}
    >
      <Paper>
        <AbsoluteFill style={{ opacity: 0.5 * (1 - exit) }}>
          <MapCamera
            width={WIDTH}
            height={HEIGHT}
            cx={520}
            cy={600}
            zoom={lerp(1.18, 1.3, drift)}
          >
            <BaseNetwork stroke={C.hair} strokeWidth={3.4} />
          </MapCamera>
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(760px 520px at 50% 48%, rgba(245, 240, 230, 1) 30%, rgba(245, 240, 230, 0) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: logoX - size / 2,
            top: logoY - size / 2,
            scale: lerp(0.2, 1, pop),
            opacity: Math.min(1, pop * 2),
          }}
        >
          <LogoIcon size={size} blink={blink} id="title" shadow={fly < 0.5} />
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 498,
            textAlign: "center",
            opacity: 1 - exit,
            translate: `0px ${-exit * 24}px`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 34,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: F.latin,
                fontWeight: 700,
                fontSize: 150,
                letterSpacing: "-0.03em",
                color: C.ink,
                lineHeight: 1.1,
              }}
            >
              {NAME.split("").map((letter, i) => {
                const p = tween(frame, TITLE.name + i * 1.6, 14, easeOut);
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      opacity: Math.min(1, p * 2),
                      translate: `0px ${lerp(46, 0, p)}px`,
                    }}
                  >
                    {letter}
                  </span>
                );
              })}
            </span>
            <span
              style={{
                fontFamily: F.zh,
                fontWeight: 600,
                fontSize: 88,
                color: C.red,
                opacity: tween(frame, TITLE.name + BEAT, 16, easeOut),
                translate: `${lerp(-30, 0, tween(frame, TITLE.name + BEAT, 16, easeOut))}px 0px`,
              }}
            >
              魔都地铁酱
            </span>
          </div>

          <div
            style={{
              marginTop: 40,
              fontFamily: F.zh,
              fontWeight: 500,
              fontSize: 60,
              letterSpacing: "0.02em",
              color: C.inkSoft,
              opacity: tagline,
              translate: `0px ${lerp(30, 0, tagline)}px`,
            }}
          >
            每一趟、每个月，都帮你算清楚
          </div>
        </div>
      </Paper>
    </AbsoluteFill>
  );
};

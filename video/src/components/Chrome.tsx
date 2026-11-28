import React from "react";
import { easeInOut, easeOut, lerp, tween } from "../lib/anim";
import { F } from "../theme";
import { MONTHLY, SCENES } from "../timeline";
import { tone } from "./Bits";
import { LogoIcon } from "./Logo";

const STOPS = [
  { label: "站到站", from: SCENES.s2s.from },
  { label: "月度通勤", from: SCENES.monthly.from },
  { label: "组合价", from: SCENES.monthly.from + MONTHLY.combo },
  { label: "按乘距", from: SCENES.distance.from },
  { label: "随身用", from: SCENES.anywhere.from },
];

export const CHROME_LOGO = { x: 96, y: 44, size: 60 };

const STRIP_X = 1180;
const STRIP_W = 644;
const STRIP_Y = 62;

/**
 * Top bar shown through the four feature scenes: brand on the left and, on
 * the right, the film's own "line map" with one stop per feature.
 */
export const Chrome: React.FC<{ frame: number; dark: number }> = ({
  frame,
  dark,
}) => {
  const palette = tone(dark);
  const appear = tween(frame, SCENES.s2s.from - 2, 16, easeOut);
  const leave = tween(frame, SCENES.cta.from - 4, 10, easeOut);
  const opacity = appear * (1 - leave);
  if (opacity <= 0) return null;

  let position = 0;
  STOPS.forEach((stop, i) => {
    if (i > 0) position += tween(frame, stop.from - 4, 20, easeInOut);
  });
  const step = STRIP_W / (STOPS.length - 1);

  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div
        style={{
          position: "absolute",
          left: CHROME_LOGO.x,
          top: CHROME_LOGO.y,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <LogoIcon size={CHROME_LOGO.size} id="chrome" shadow={false} />
        <div
          style={{
            fontFamily: F.latin,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: "-0.01em",
            color: palette.ink,
            opacity: tween(frame, SCENES.s2s.from + 4, 14, easeOut),
          }}
        >
          MetroChan
          <span
            style={{
              fontFamily: F.zh,
              fontWeight: 500,
              fontSize: 26,
              marginLeft: 14,
              color: palette.muted,
            }}
          >
            魔都地铁酱
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: STRIP_X,
          top: STRIP_Y,
          width: STRIP_W,
          opacity: tween(frame, SCENES.s2s.from + 6, 16, easeOut),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: STRIP_W,
            height: 6,
            borderRadius: 3,
            background: palette.hair,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: position * step,
            height: 6,
            borderRadius: 3,
            background: palette.red,
          }}
        />
        {STOPS.map((stop, i) => {
          const reached = Math.max(0, Math.min(1, position - i + 1));
          const active = Math.max(0, 1 - Math.abs(position - i));
          const size = lerp(16, 26, active);
          return (
            <React.Fragment key={stop.label}>
              <div
                style={{
                  position: "absolute",
                  left: i * step - size / 2,
                  top: 3 - size / 2,
                  width: size,
                  height: size,
                  boxSizing: "border-box",
                  borderRadius: size,
                  background: reached > 0.5 ? palette.red : palette.bg,
                  border: `4px solid ${reached > 0.5 ? palette.red : palette.hair}`,
                  boxShadow:
                    active > 0.5 ? `0 0 0 6px ${palette.red}33` : undefined,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: i * step - 80,
                  top: 26,
                  width: 160,
                  textAlign:
                    i === 0
                      ? "left"
                      : i === STOPS.length - 1
                        ? "right"
                        : "center",
                  translate:
                    i === 0
                      ? "68px 0px"
                      : i === STOPS.length - 1
                        ? "-68px 0px"
                        : undefined,
                  fontFamily: F.zh,
                  fontSize: 24,
                  fontWeight: active > 0.5 ? 600 : 400,
                  color: active > 0.5 ? palette.ink : palette.muted,
                  whiteSpace: "nowrap",
                }}
              >
                {stop.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

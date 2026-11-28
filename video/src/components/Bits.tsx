import React from "react";
import { interpolateColors } from "remotion";
import { handOver, lerp } from "../lib/anim";
import { C, DARK_TEXT_LINES, F, LINE_COLORS } from "../theme";

/** Blend between the light and the dark palette (0 = light, 1 = dark). */
export const tone = (dark: number) => {
  const mix = (light: string, night: string) =>
    interpolateColors(dark, [0, 1], [light, night]);
  return {
    bg: mix(C.paper, C.night),
    card: mix(C.card, C.nightCard),
    ink: mix(C.ink, C.nightInk),
    muted: mix(C.muted, C.nightMuted),
    hair: mix(C.hair, C.nightHair),
    red: mix(C.red, "#FF6B6B"),
  };
};

/** Fade-and-rise entrance driven by a 0–1 progress value. */
export const Rise: React.FC<{
  progress: number;
  distance?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ progress, distance = 36, style, children }) => (
  <div
    style={{
      opacity: Math.min(1, progress * 1.6),
      translate: `0px ${lerp(distance, 0, progress)}px`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  progress?: number;
  radius?: number;
  background?: string;
  border?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({
  x,
  y,
  w,
  h,
  progress = 1,
  radius = 32,
  background = C.card,
  border = C.hair,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      boxSizing: "border-box",
      borderRadius: radius,
      background,
      border: `2px solid ${border}`,
      boxShadow:
        "0 40px 70px -42px rgba(70, 48, 16, 0.38), 0 2px 0 rgba(255, 255, 255, 0.7) inset",
      opacity: Math.min(1, progress * 1.6),
      translate: `0px ${lerp(48, 0, progress)}px`,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const LineDots: React.FC<{ lines: string[]; size?: number }> = ({
  lines,
  size = 16,
}) => (
  <span style={{ display: "inline-flex", gap: size * 0.3, flexShrink: 0 }}>
    {lines.map((line) => (
      <span
        key={line}
        style={{
          width: size,
          height: size,
          borderRadius: size,
          background: LINE_COLORS[line] ?? "#888888",
        }}
      />
    ))}
  </span>
);

export const LineBadge: React.FC<{ line: string; size?: number }> = ({
  line,
  size = 26,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: size * 1.55,
      padding: `0 ${size * 0.55}px`,
      borderRadius: size * 0.36,
      background: LINE_COLORS[line] ?? "#888888",
      color: DARK_TEXT_LINES.includes(line) ? C.ink : "#FFFFFF",
      fontFamily: F.zh,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1,
      whiteSpace: "nowrap",
      flexShrink: 0,
    }}
  >
    {line}
  </span>
);

export const Chip: React.FC<{
  children: React.ReactNode;
  progress?: number;
  color?: string;
  background?: string;
  border?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  progress = 1,
  color = C.ink,
  background = "#FFFFFF",
  border = C.hair,
  size = 28,
  style,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.36,
      height: size * 2.05,
      padding: `0 ${size * 0.86}px`,
      borderRadius: size * 1.1,
      background,
      border: `2px solid ${border}`,
      color,
      fontFamily: F.zh,
      fontSize: size,
      fontWeight: 500,
      lineHeight: 1,
      whiteSpace: "nowrap",
      opacity: Math.min(1, progress * 1.5),
      scale: lerp(0.8, 1, progress),
      ...style,
    }}
  >
    {children}
  </span>
);

/** Numbers set in DIN so digits keep a fixed width while they change. */
export const Num: React.FC<{
  children: React.ReactNode;
  size: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size, color, style }) => (
  <span
    style={{
      fontFamily: F.num,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1,
      color,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.01em",
      ...style,
    }}
  >
    {children}
  </span>
);

/** Chapter number, name and the one-line promise of a scene. */
export const SceneHeader: React.FC<{
  index: string;
  label: string;
  title: React.ReactNode;
  progress: number;
  titleProgress: number;
  dark?: number;
}> = ({ index, label, title, progress, titleProgress, dark = 0 }) => {
  const palette = tone(dark);
  return (
    <div style={{ position: "absolute", left: 96, top: 138, right: 96 }}>
      <Rise progress={progress} distance={20}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontFamily: F.zh,
            fontSize: 30,
            fontWeight: 600,
            color: palette.red,
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              fontFamily: F.num,
              fontSize: 30,
              color: "#FFFFFF",
              background: palette.red,
              borderRadius: 10,
              padding: "5px 12px 3px",
              letterSpacing: "0.02em",
            }}
          >
            {index}
          </span>
          {label}
        </div>
      </Rise>
      <Rise progress={titleProgress} distance={30}>
        <div
          style={{
            marginTop: 14,
            fontFamily: F.zh,
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            color: palette.ink,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
      </Rise>
    </div>
  );
};

/** Replaces one headline with another: the old line lifts away, the new one rises in. */
export const TitleSwap: React.FC<{ from: string; to: string; mix: number }> = ({
  from,
  to,
  mix,
}) => {
  const { leave, arrive } = handOver(mix);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{
          display: "inline-block",
          opacity: 1 - leave,
          translate: `0px ${-leave * 26}px`,
        }}
      >
        {from}
      </span>
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          opacity: arrive,
          translate: `0px ${(1 - arrive) * 26}px`,
        }}
      >
        {to}
      </span>
    </span>
  );
};

/** Hand-over between neighbouring scenes: slide in from the right, out to the left. */
export const SceneShift: React.FC<{
  enter: number;
  exit: number;
  children: React.ReactNode;
}> = ({ enter, exit, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity: Math.min(1, enter * 1.4) * (1 - exit),
      translate: `${lerp(90, 0, enter) - exit * 90}px 0px`,
    }}
  >
    {children}
  </div>
);

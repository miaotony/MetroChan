import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { SceneHeader, SceneShift, tone } from "../components/Bits";
import { Chrome } from "../components/Chrome";
import { TRIP } from "../data";
import { backOut, easeInOut, easeOut, lerp, tween } from "../lib/anim";
import { C, F } from "../theme";
import { ANYWHERE, RIDES, SCENES } from "../timeline";

type Mode = 0 | 1;

const COL_X = 96;
const COL_W = 684;
const ROW = { y: 318, h: 152, gap: 20 };
const BROWSER = { x: 846, y: 168, w: 790, h: 628, bar: 50 };
/** The desktop capture is 1440 css px wide; the film shows its content column. */
const DESK = { width: 1440, cropX: 140, cropW: 1160 };
const PHONE = { x: 1494, y: 250, w: 330, h: 754, bezel: 11, status: 38 };
const PHONE_PAGE = { width: 390, height: 2140 };
/** Centre of the theme button in the phone capture, in css px. */
const THEME_BUTTON = { x: 353, y: 55.5 };
const SHARE = { x: 846, y: 820, w: 620, h: 184 };
/** Page background of the site in its light and dark theme. */
const SITE_BG = ["#FAF9F6", "#14161A"] as const;
const SHOTS = {
  desk: ["shots/desk-light.png", "shots/desk-dark.png"],
  phone: ["shots/phone-light.png", "shots/phone-dark.png"],
} as const;

const SCREEN_W = PHONE.w - PHONE.bezel * 2;
const SCREEN_H = PHONE.h - PHONE.bezel * 2;
const PHONE_SCALE = SCREEN_W / PHONE_PAGE.width;
const DESK_SCALE = BROWSER.w / DESK.cropW;
const BUTTON = {
  x: PHONE.x + PHONE.bezel + THEME_BUTTON.x * PHONE_SCALE,
  y: PHONE.y + PHONE.bezel + PHONE.status + THEME_BUTTON.y * PHONE_SCALE,
};
const SWIPE = { x: PHONE.x + PHONE.w / 2 + 34, y: PHONE.y + 600, travel: 220 };
/** Page offsets (css px) the phone rests at: top, the route, the monthly table. */
const STOPS = [
  0,
  520,
  PHONE_PAGE.height - (SCREEN_H - PHONE.status) / PHONE_SCALE,
];
const SCROLL = [
  { start: ANYWHERE.press + 16, length: 26 },
  { start: ANYWHERE.open + 6, length: 28 },
];

const FEATURES = [
  {
    icon: "phone",
    title: "手机适配",
    sub: "挤在车厢里，单手也能查",
    at: ANYWHERE.phone,
  },
  {
    icon: "moon",
    title: "亮色 / 暗色",
    sub: "一键切换，也能跟随系统",
    at: ANYWHERE.press,
  },
  {
    icon: "link",
    title: "分享链接 + 二维码",
    sub: "起终点和次数都带上，打开即还原",
    at: ANYWHERE.share,
  },
  {
    icon: "code",
    title: "开源 · 不用登录",
    sub: "单文件静态页，打开就能用",
    at: ANYWHERE.open,
  },
] as const;

const PARAMS = [
  ["?from", TRIP.from],
  ["&to", TRIP.to],
  ["&rides", String(RIDES.commute)],
] as const;

const ICONS: Record<(typeof FEATURES)[number]["icon"], React.ReactNode> = {
  phone: (
    <>
      <rect x={5} y={2} width={14} height={20} rx={2.6} />
      <path d="M10.5 18.2h3" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  code: (
    <>
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </>
  ),
};

const Icon: React.FC<{
  kind: keyof typeof ICONS;
  size: number;
  color: string;
}> = ({ kind, size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.1}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}
  >
    {ICONS[kind]}
  </svg>
);

const scrollAt = (frame: number) =>
  SCROLL.reduce(
    (offset, step, i) =>
      offset +
      tween(frame, step.start, step.length, easeInOut) *
        (STOPS[i + 1] - STOPS[i]),
    STOPS[0],
  );

const Browser: React.FC<{ frame: number; dark: Mode }> = ({ frame, dark }) => {
  const palette = tone(dark);
  const rise = tween(frame, 6, 20, easeOut);
  const drift = tween(frame, 0, SCENES.anywhere.duration, (t) => t) * 46;
  return (
    <div
      style={{
        position: "absolute",
        left: BROWSER.x,
        top: BROWSER.y,
        width: BROWSER.w,
        height: BROWSER.h,
        boxSizing: "border-box",
        borderRadius: 26,
        overflow: "hidden",
        background: SITE_BG[dark],
        border: `2px solid ${palette.hair}`,
        boxShadow: dark
          ? "0 44px 80px -40px rgba(0, 0, 0, 0.9)"
          : "0 44px 80px -44px rgba(70, 48, 16, 0.5)",
        opacity: Math.min(1, rise * 1.6),
        translate: `0px ${lerp(48, 0, rise)}px`,
      }}
    >
      <div
        style={{
          position: "relative",
          height: BROWSER.bar,
          background: dark ? "#1D2127" : "#EFE8DB",
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 20px",
        }}
      >
        {["#EC6A5E", "#F4BF4F", "#61C554"].map((color) => (
          <span
            key={color}
            style={{
              width: 13,
              height: 13,
              borderRadius: 7,
              background: color,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: (BROWSER.w - 360) / 2,
            top: 9,
            width: 360,
            height: 32,
            borderRadius: 16,
            background: dark ? "#0F1216" : "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.latin,
            fontSize: 18,
            fontWeight: 500,
            color: palette.muted,
          }}
        >
          metrochan.miaotony.xyz
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: BROWSER.h - BROWSER.bar,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile(SHOTS.desk[dark])}
          style={{
            position: "absolute",
            left: -DESK.cropX * DESK_SCALE,
            top: -drift * DESK_SCALE,
            width: DESK.width * DESK_SCALE,
          }}
        />
      </div>
    </div>
  );
};

const Phone: React.FC<{ frame: number; dark: Mode }> = ({ frame, dark }) => {
  const rise = tween(frame, ANYWHERE.phone - 6, 20, backOut);
  const ink = dark ? "#EFEBE3" : "#17171A";
  return (
    <div
      style={{
        position: "absolute",
        left: PHONE.x,
        top: PHONE.y,
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: 54,
        background: dark ? "#08090B" : "#17171A",
        boxShadow: dark
          ? "0 0 0 2px #3A4049, 0 50px 80px -30px rgba(0, 0, 0, 0.9)"
          : "0 0 0 2px #3A3936, 0 50px 80px -30px rgba(40, 24, 8, 0.6)",
        opacity: Math.min(1, rise * 1.6),
        translate: `0px ${lerp(90, 0, rise)}px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: PHONE.bezel,
          top: PHONE.bezel,
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: 43,
          overflow: "hidden",
          background: SITE_BG[dark],
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: PHONE.status,
            width: SCREEN_W,
            height: SCREEN_H - PHONE.status,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(SHOTS.phone[dark])}
            style={{
              position: "absolute",
              left: 0,
              top: -scrollAt(frame) * PHONE_SCALE,
              width: SCREEN_W,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: SCREEN_W,
            height: PHONE.status,
            background: SITE_BG[dark],
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 30,
              top: 11,
              fontFamily: F.latin,
              fontSize: 17,
              fontWeight: 700,
              color: ink,
              lineHeight: 1,
            }}
          >
            9:41
          </span>
          <span
            style={{
              position: "absolute",
              left: (SCREEN_W - 84) / 2,
              top: 8,
              width: 84,
              height: 23,
              borderRadius: 12,
              background: "#000000",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 28,
              top: 12,
              width: 26,
              height: 13,
              boxSizing: "border-box",
              borderRadius: 4,
              border: `2px solid ${ink}`,
              opacity: 0.85,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 1.5,
                top: 1.5,
                width: 15,
                height: 6,
                borderRadius: 1.5,
                background: ink,
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
};

const ShareCard: React.FC<{ frame: number; dark: Mode }> = ({
  frame,
  dark,
}) => {
  const palette = tone(dark);
  const rise = tween(frame, ANYWHERE.share - 4, 18, easeOut);
  const copied = tween(frame, ANYWHERE.copied, 12, backOut);
  const green = dark ? "#5BD49C" : C.green;
  return (
    <div
      style={{
        position: "absolute",
        left: SHARE.x,
        top: SHARE.y,
        width: SHARE.w,
        height: SHARE.h,
        boxSizing: "border-box",
        borderRadius: 30,
        padding: "22px 30px",
        background: palette.card,
        border: `2px solid ${palette.hair}`,
        opacity: Math.min(1, rise * 1.6),
        translate: `0px ${lerp(40, 0, rise)}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 42,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            fontFamily: F.zh,
            fontSize: 28,
            fontWeight: 600,
            color: palette.ink,
          }}
        >
          <Icon kind="link" size={30} color={palette.red} />
          复制分享链接
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 16px",
            borderRadius: 14,
            background: `${green}26`,
            color: green,
            fontFamily: F.zh,
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1,
            opacity: Math.min(1, copied * 1.5),
            scale: lerp(0.6, 1, copied),
          }}
        >
          <svg width={22} height={22} viewBox="0 0 20 20">
            <path
              d="M4 10.5 L8.4 14.6 L16 5.8"
              fill="none"
              stroke={green}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          已复制
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: F.latin,
          fontSize: 27,
          fontWeight: 500,
          color: palette.muted,
          lineHeight: 1.2,
        }}
      >
        metrochan.miaotony.xyz/
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        {PARAMS.map(([key, value], i) => {
          const pop = tween(frame, ANYWHERE.share + 4 + i * 5, 12, backOut);
          return (
            <span
              key={key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 46,
                padding: "0 16px",
                borderRadius: 14,
                background: dark ? "rgba(255, 255, 255, 0.06)" : C.paper,
                border: `2px solid ${palette.hair}`,
                fontFamily: F.latin,
                fontSize: 25,
                fontWeight: 500,
                color: palette.muted,
                whiteSpace: "nowrap",
                opacity: Math.min(1, pop * 1.5),
                scale: lerp(0.7, 1, pop),
              }}
            >
              {key}=
              <span
                style={{
                  fontFamily: F.zh,
                  fontWeight: 600,
                  color: palette.ink,
                  marginLeft: 2,
                }}
              >
                {value}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

const Features: React.FC<{ frame: number; dark: Mode }> = ({ frame, dark }) => {
  const palette = tone(dark);
  const tile = dark ? "rgba(255, 107, 107, 0.14)" : C.redSoft;
  return (
    <>
      {FEATURES.map((feature, i) => {
        const rise = tween(frame, feature.at, 16, easeOut);
        const heat = rise * (1 - tween(frame, feature.at + 22, 16, easeOut));
        return (
          <div
            key={feature.icon}
            style={{
              position: "absolute",
              left: COL_X,
              top: ROW.y + i * (ROW.h + ROW.gap),
              width: COL_W,
              height: ROW.h,
              boxSizing: "border-box",
              borderRadius: 30,
              padding: "0 34px",
              display: "flex",
              alignItems: "center",
              gap: 28,
              background: palette.card,
              border: `2px solid ${interpolateColors(
                heat,
                [0, 1],
                [palette.hair, palette.red],
              )}`,
              boxShadow: dark
                ? undefined
                : "0 30px 50px -40px rgba(70, 48, 16, 0.4)",
              opacity: Math.min(1, rise * 1.6),
              translate: `${lerp(-40, 0, rise)}px 0px`,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: tile,
                scale: 1 + heat * 0.08,
              }}
            >
              <Icon kind={feature.icon} size={46} color={palette.red} />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>
              <div
                style={{
                  fontFamily: F.zh,
                  fontSize: 38,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  color: palette.ink,
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: F.zh,
                  fontSize: 26,
                  lineHeight: 1.3,
                  color: palette.muted,
                }}
              >
                {feature.sub}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};

const Content: React.FC<{ frame: number; dark: Mode }> = ({ frame, dark }) => (
  <>
    <SceneHeader
      index="05"
      label="随身用"
      title="揣进口袋，随时查"
      progress={tween(frame, 2, 16, easeOut)}
      titleProgress={tween(frame, 8, 18, easeOut)}
      dark={dark}
    />
    <Features frame={frame} dark={dark} />
    <Browser frame={frame} dark={dark} />
    <ShareCard frame={frame} dark={dark} />
    <Phone frame={frame} dark={dark} />
  </>
);

const Night: React.FC = () => (
  <AbsoluteFill style={{ background: C.night }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1100px 760px at 86% 12%, rgba(229, 50, 43, 0.16), rgba(12, 14, 17, 0) 70%), radial-gradient(1000px 700px at 0% 100%, rgba(130, 170, 255, 0.07), rgba(12, 14, 17, 0) 70%)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(rgba(239, 235, 227, 0.1) 1.6px, rgba(239, 235, 227, 0) 1.7px)",
        backgroundSize: "36px 36px",
        backgroundPosition: "18px 18px",
      }}
    />
  </AbsoluteFill>
);

/** A fingertip on the phone: taps the theme button, then flicks the page. */
const Touch: React.FC<{ frame: number }> = ({ frame }) => {
  const reach = tween(frame, ANYWHERE.press - 24, 20, easeInOut);
  const toSwipe = tween(frame, ANYWHERE.press + 6, 10, easeInOut);
  const [first, second] = SCROLL.map((step) =>
    tween(frame, step.start, step.length, easeInOut),
  );
  const back = tween(frame, SCROLL[1].start - 14, 12, easeInOut);
  const x = lerp(lerp(PHONE.x + 150, BUTTON.x, reach), SWIPE.x, toSwipe);
  const y =
    lerp(lerp(PHONE.y + 470, BUTTON.y, reach), SWIPE.y, toSwipe) -
    SWIPE.travel * (first - back + second);
  const tapping = frame >= ANYWHERE.press - 2 && frame <= ANYWHERE.press + 5;
  const swiping = (first > 0 && first < 1) || (second > 0 && second < 1);
  const down = tapping || swiping;
  const opacity =
    tween(frame, ANYWHERE.press - 26, 8, easeOut) *
    (1 - tween(frame, SCROLL[1].start + SCROLL[1].length + 2, 10, easeOut));
  const ripple = tween(frame, ANYWHERE.press, 16, easeOut);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        opacity,
      }}
    >
      {ripple > 0 && ripple < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -50,
            top: -50,
            width: 100,
            height: 100,
            borderRadius: 50,
            border: "4px solid #FFFFFF",
            scale: 0.3 + ripple * 0.9,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: -29,
          top: -29,
          width: 58,
          height: 58,
          boxSizing: "border-box",
          borderRadius: 29,
          background: "rgba(128, 128, 132, 0.5)",
          border: "4px solid rgba(255, 255, 255, 0.95)",
          boxShadow: "0 8px 18px rgba(0, 0, 0, 0.3)",
          scale: down ? 0.8 : 1,
          opacity: down ? 1 : 0.6,
        }}
      />
    </div>
  );
};

export const Anywhere: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 0, 18, easeOut);
  const wipe = tween(frame, ANYWHERE.press, 26, easeOut);

  return (
    <AbsoluteFill>
      {wipe < 1 ? (
        <SceneShift enter={enter} exit={0}>
          <Content frame={frame} dark={0} />
        </SceneShift>
      ) : null}
      {wipe > 0 ? (
        <AbsoluteFill
          style={{
            clipPath: `circle(${wipe * 2060}px at ${BUTTON.x}px ${BUTTON.y}px)`,
          }}
        >
          <Night />
          <Chrome frame={frame + SCENES.anywhere.from} dark={1} />
          <Content frame={frame} dark={1} />
        </AbsoluteFill>
      ) : null}
      <Touch frame={frame} />
    </AbsoluteFill>
  );
};

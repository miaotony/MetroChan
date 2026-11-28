import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { blinkAt, LogoIcon, TrainFace } from "../components/Logo";
import { BaseNetwork, MapCamera } from "../components/NetworkMap";
import { QrModules } from "../components/Qr";
import { FACTS } from "../data";
import { backOut, easeInOut, easeOut, lerp, pulse, tween } from "../lib/anim";
import qr from "../qr.json";
import { C, F } from "../theme";
import { BEAT, CTA, HEIGHT, SCENES, WIDTH } from "../timeline";

const LEFT = 128;
const FACE = { size: 400, x: 960, y: 500 };
const LOCKUP = { x: LEFT - 8, y: 92, size: 124 };
const QR_SIZE = qr.size * 14;
const QR_CARD = { x: 1300, y: 262, w: 492, h: 590 };
const HOST = new URL(qr.url).host;

export const CHIPS = [
  "开源在 GitHub",
  "不用登录，打开就用",
  `${FACTS.stations} 站 · ${FACTS.pairs.toLocaleString("en-US")} 个站对`,
];

const Line: React.FC<{ progress: number; children: React.ReactNode }> = ({
  progress,
  children,
}) => (
  <div style={{ overflow: "hidden", paddingBottom: 16, marginBottom: -16 }}>
    <div
      style={{
        translate: `0px ${lerp(110, 0, progress)}%`,
        opacity: Math.min(1, progress * 2),
      }}
    >
      {children}
    </div>
  </div>
);

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = tween(frame, CTA.hit, 12, easeOut);
  const drift = tween(frame, 0, SCENES.cta.duration, (t) => t);

  const draw = tween(frame, CTA.hit + 2, 22, easeInOut);
  const fly = tween(frame, CTA.line - 10, 22, easeInOut);
  const faceSize = lerp(FACE.size, LOCKUP.size, fly);
  const faceX = lerp(FACE.x, LOCKUP.x + LOCKUP.size / 2, fly);
  const faceY = lerp(FACE.y, LOCKUP.y + LOCKUP.size / 2, fly);
  const blink = Math.max(
    blinkAt(frame, CTA.hit + BEAT + 6),
    blinkAt(frame, CTA.final + BEAT),
    blinkAt(frame, CTA.final + BEAT * 5),
  );
  const shock = tween(frame, CTA.hit, 26, easeOut);

  const name = tween(frame, CTA.line + 4, 16, easeOut);
  const sub = tween(frame, CTA.url - 6, 16, easeOut);
  const url = tween(frame, CTA.url, 16, backOut);
  const card = tween(frame, CTA.qr, 16, backOut);
  const scan = tween(frame, CTA.qr + 4, 22, easeInOut);
  const footer = tween(frame, CTA.final - 6, 20, easeOut);
  const finalPulse = pulse(frame, CTA.final, 3, 22);

  return (
    <AbsoluteFill
      style={{
        clipPath: `circle(${reveal * 1320}px at ${WIDTH / 2}px ${HEIGHT / 2}px)`,
        background:
          "linear-gradient(135deg, #F44338 0%, #E5322B 46%, #C9161F 100%)",
      }}
    >
      <AbsoluteFill style={{ opacity: 0.14 }}>
        <MapCamera
          width={WIDTH}
          height={HEIGHT}
          cx={500}
          cy={640}
          zoom={lerp(1.5, 1.74, drift)}
        >
          <BaseNetwork stroke="#FFFFFF" strokeWidth={3} />
        </MapCamera>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(1000px 760px at 24% 44%, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 70%), radial-gradient(900px 700px at 100% 100%, rgba(120, 0, 10, 0.34), rgba(120, 0, 10, 0) 70%)",
        }}
      />

      {shock > 0 && shock < 1 ? (
        <div
          style={{
            position: "absolute",
            left: FACE.x - 300,
            top: FACE.y - 300,
            width: 600,
            height: 600,
            boxSizing: "border-box",
            borderRadius: 300,
            border: "6px solid rgba(255, 255, 255, 0.7)",
            scale: 0.5 + shock * 1.5,
            opacity: (1 - shock) * 0.8,
          }}
        />
      ) : null}

      {/* the face lands big, then settles into the lock-up */}
      <div
        style={{
          position: "absolute",
          left: faceX - faceSize / 2,
          top: faceY - faceSize / 2,
        }}
      >
        <TrainFace size={faceSize} blink={blink} draw={draw} />
      </div>
      <div
        style={{
          position: "absolute",
          left: LOCKUP.x + LOCKUP.size + 14,
          top: LOCKUP.y,
          height: LOCKUP.size,
          display: "flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          opacity: name,
          translate: `${lerp(-24, 0, name)}px 0px`,
        }}
      >
        <span
          style={{
            fontFamily: F.latin,
            fontWeight: 700,
            fontSize: 60,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
          }}
        >
          MetroChan
        </span>
        <span
          style={{
            fontFamily: F.zh,
            fontWeight: 500,
            fontSize: 42,
            marginLeft: 22,
            color: C.cream,
            opacity: 0.86,
          }}
        >
          魔都地铁酱
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 262,
          fontFamily: F.zh,
          fontWeight: 600,
          fontSize: 148,
          lineHeight: 1.18,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          whiteSpace: "nowrap",
        }}
      >
        <Line progress={tween(frame, CTA.line, 18, easeOut)}>你的那一趟，</Line>
        <Line progress={tween(frame, CTA.line2, 18, easeOut)}>
          <span
            style={{
              display: "inline-block",
              background: C.cream,
              color: C.red,
              borderRadius: 28,
              padding: "0 34px 4px",
              marginLeft: -6,
            }}
          >
            现在就查
          </span>
        </Line>
      </div>

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 640,
          fontFamily: F.zh,
          fontWeight: 500,
          fontSize: 40,
          color: C.cream,
          whiteSpace: "nowrap",
          opacity: sub * 0.92,
          translate: `0px ${lerp(24, 0, sub)}px`,
        }}
      >
        票价、路线、每月最省的买法，一页算清
      </div>

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 734,
          height: 118,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          gap: 24,
          padding: "0 22px",
          borderRadius: 59,
          background: C.card,
          boxShadow: `0 30px 50px -24px rgba(110, 0, 8, 0.7), 0 0 0 ${
            finalPulse * 14
          }px rgba(255, 255, 255, ${0.22 * finalPulse})`,
          opacity: Math.min(1, url * 1.6),
          scale: lerp(0.86, 1, url),
          transformOrigin: "left center",
        }}
      >
        <LogoIcon size={76} id="cta" shadow={false} blink={blink} />
        <span
          style={{
            fontFamily: F.latin,
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: "-0.015em",
            color: C.ink,
            whiteSpace: "nowrap",
          }}
        >
          {HOST}
        </span>
        <span
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            background: C.red,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={40} height={40} viewBox="0 0 40 40">
            <path
              d="M8 20 H31 M21 9 L32 20 L21 31"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 890,
          display: "flex",
          gap: 14,
        }}
      >
        {CHIPS.map((text, i) => {
          const pop = tween(frame, CTA.chips + i * (BEAT / 2), 14, backOut);
          return (
            <span
              key={text}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 58,
                padding: "0 26px",
                borderRadius: 29,
                background: "rgba(255, 255, 255, 0.16)",
                border: "2px solid rgba(255, 255, 255, 0.36)",
                fontFamily: F.zh,
                fontSize: 27,
                fontWeight: 500,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                opacity: Math.min(1, pop * 1.5),
                scale: lerp(0.8, 1, pop),
              }}
            >
              {text}
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: LEFT,
          top: 986,
          fontFamily: F.zh,
          fontSize: 24,
          color: C.cream,
          opacity: footer * 0.72,
          whiteSpace: "nowrap",
        }}
      >
        个人整理的非官方工具 · 票价以官方为准 · 数据取自 {FACTS.capturedAt}{" "}
        官方票价查询
      </div>

      {/* scan to open */}
      <div
        style={{
          position: "absolute",
          left: QR_CARD.x,
          top: QR_CARD.y,
          width: QR_CARD.w,
          height: QR_CARD.h,
          boxSizing: "border-box",
          borderRadius: 44,
          background: "#FFFFFF",
          boxShadow: "0 50px 80px -36px rgba(100, 0, 8, 0.8)",
          opacity: Math.min(1, card * 1.6),
          scale: lerp(0.82, 1, card),
          rotate: `${lerp(5, 0, card)}deg`,
        }}
      >
        <svg
          width={QR_SIZE}
          height={QR_SIZE}
          viewBox={`0 0 ${qr.size} ${qr.size}`}
          shapeRendering="crispEdges"
          style={{
            position: "absolute",
            left: (QR_CARD.w - QR_SIZE) / 2,
            top: (QR_CARD.w - QR_SIZE) / 2,
          }}
        >
          <defs>
            <clipPath id="cta-scan">
              <rect x={0} y={0} width={qr.size} height={qr.size * scan} />
            </clipPath>
          </defs>
          <g clipPath="url(#cta-scan)">
            <QrModules fill={C.ink} />
          </g>
        </svg>
        {scan > 0 && scan < 1 ? (
          <div
            style={{
              position: "absolute",
              left: (QR_CARD.w - QR_SIZE) / 2 - 10,
              top: (QR_CARD.w - QR_SIZE) / 2 + QR_SIZE * scan - 3,
              width: QR_SIZE + 20,
              height: 6,
              borderRadius: 3,
              background: C.red,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: QR_CARD.w - 22,
            textAlign: "center",
            fontFamily: F.zh,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 38, fontWeight: 600, color: C.ink }}>
            扫码直达
          </div>
          <div style={{ marginTop: 4, fontSize: 25, color: C.muted }}>
            手机上一样好用
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

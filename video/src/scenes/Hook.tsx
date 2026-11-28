import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { Num } from "../components/Bits";
import { ColorNetwork, MapCamera, StationDots } from "../components/NetworkMap";
import { NETWORK, stationPoint, TRIP } from "../data";
import {
  backOut,
  easeInOut,
  easeOut,
  lerp,
  pulse,
  softInOut,
  tween,
} from "../lib/anim";
import { C, F } from "../theme";
import { BEAT, HEIGHT, HOOK, SCENES, WIDTH } from "../timeline";

const START = { cx: 417, cy: 561, zoom: 2.4 };
const END = { cx: 184, cy: 699, zoom: 1.5 };

const Line: React.FC<{
  progress: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ progress, children, style }) => (
  <div style={{ overflow: "hidden", paddingBottom: 14, marginBottom: -14 }}>
    <div
      style={{
        translate: `0px ${lerp(110, 0, progress)}%`,
        opacity: Math.min(1, progress * 2),
        ...style,
      }}
    >
      {children}
    </div>
  </div>
);

const StationTag: React.FC<{
  name: string;
  progress: number;
  align: "left" | "right";
}> = ({ name, progress, align }) => {
  const [x, y] = stationPoint(name);
  const side = align === "left" ? -1 : 1;
  return (
    <g opacity={progress}>
      <circle
        cx={x}
        cy={y}
        r={lerp(0, 9, progress)}
        fill={C.night}
        stroke="#FFFFFF"
        strokeWidth={4}
      />
      <text
        x={x + side * 20}
        y={y + 9}
        textAnchor={align === "left" ? "end" : "start"}
        fontFamily={F.zh}
        fontSize={26}
        fontWeight={600}
        fill="#FFFFFF"
        stroke={C.night}
        strokeWidth={7}
        paintOrder="stroke"
      >
        {name}
      </text>
    </g>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.hook.duration;

  const travel = tween(frame, 0, duration + 10, Easing.out(Easing.quad));
  const cx = lerp(START.cx, END.cx, travel);
  const cy = lerp(START.cy, END.cy, travel);
  const zoom = lerp(START.zoom, END.zoom, travel);

  const grow = tween(frame, 4, HOOK.route - 10, softInOut);
  const radius = grow * (NETWORK.reach + 40);

  const focus = tween(frame, HOOK.route - 6, 20, easeInOut);
  const routeDraw = tween(frame, HOOK.route, BEAT * 2.4, easeInOut);
  const beatGlow = pulse(frame % BEAT, 0, 1, 12);

  const introOut = tween(frame, HOOK.route - 12, 10, Easing.in(Easing.cubic));
  const tripIn = tween(frame, HOOK.route, 16, easeOut);
  const oldIn = tween(frame, HOOK.oldFare, 14, easeOut);
  const newIn = tween(frame, HOOK.newFare, 12, backOut);
  const struck = tween(frame, HOOK.newFare - 2, 10, easeOut);
  const questionIn = tween(frame, HOOK.question, 18, easeOut);

  const routeLayer = (width: number, opacity: number) => (
    <g
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    >
      {TRIP.legs.map((leg) => {
        const local = Math.max(
          0,
          Math.min(1, (routeDraw - leg.t0) / (leg.t1 - leg.t0)),
        );
        if (local <= 0) return null;
        return (
          <path
            key={leg.line}
            d={leg.d}
            stroke={leg.color}
            strokeWidth={width}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - local}
          />
        );
      })}
    </g>
  );

  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(900px 700px at 68% 46%, rgba(229, 50, 43, 0.16), rgba(12, 14, 17, 0) 70%)",
        }}
      />

      <AbsoluteFill
        style={{ filter: "blur(14px)", opacity: 0.5 + beatGlow * 0.22 }}
      >
        <MapCamera width={WIDTH} height={HEIGHT} cx={cx} cy={cy} zoom={zoom}>
          <ColorNetwork
            radius={radius}
            strokeWidth={9}
            opacity={lerp(1, 0.2, focus)}
          />
          {routeLayer(16, 1)}
        </MapCamera>
      </AbsoluteFill>

      <MapCamera width={WIDTH} height={HEIGHT} cx={cx} cy={cy} zoom={zoom}>
        <ColorNetwork
          radius={radius}
          strokeWidth={4.2}
          opacity={lerp(1, 0.22, focus)}
        />
        <StationDots
          radius={radius}
          r={3.4}
          fill={C.night}
          stroke="#F2EDE4"
          opacity={lerp(0.9, 0.16, focus)}
        />
        {routeLayer(8, 1)}
      </MapCamera>

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(12,14,17,0.96) 0%, rgba(12,14,17,0.9) 30%, rgba(12,14,17,0.35) 52%, rgba(12,14,17,0) 68%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(1500px 900px at 60% 50%, rgba(12,14,17,0) 55%, rgba(12,14,17,0.82) 100%)",
        }}
      />

      <MapCamera width={WIDTH} height={HEIGHT} cx={cx} cy={cy} zoom={zoom}>
        <StationTag
          name={TRIP.from}
          progress={tween(frame, HOOK.route, 10, easeOut)}
          align="left"
        />
        <StationTag
          name={TRIP.to}
          progress={tween(frame, HOOK.route + BEAT * 2.2, 10, easeOut)}
          align="right"
        />
      </MapCamera>

      {/* Act one: the news. */}
      <div
        style={{
          position: "absolute",
          left: 128,
          top: 300,
          opacity: 1 - introOut,
          translate: `0px ${-introOut * 40}px`,
        }}
      >
        <Line progress={tween(frame, HOOK.date, 16, easeOut)}>
          <Num size={62} color={C.red} style={{ letterSpacing: "0.1em" }}>
            2026 . 12 . 01
          </Num>
        </Line>
        <div
          style={{
            marginTop: 28,
            fontFamily: F.zh,
            fontWeight: 600,
            fontSize: 148,
            lineHeight: 1.16,
            letterSpacing: "-0.02em",
            color: C.nightInk,
          }}
        >
          <Line progress={tween(frame, HOOK.headline1, 18, easeOut)}>
            上海地铁
          </Line>
          <Line progress={tween(frame, HOOK.headline2, 18, easeOut)}>
            票价变了
          </Line>
        </div>
      </div>

      {/* Act two: what it means for one ordinary commute. */}
      <div style={{ position: "absolute", left: 128, top: 190 }}>
        <div
          style={{
            opacity: tripIn,
            translate: `0px ${lerp(30, 0, tripIn)}px`,
            fontFamily: F.zh,
            fontSize: 40,
            color: C.nightMuted,
          }}
        >
          比如每天这一趟
        </div>
        <div
          style={{
            marginTop: 14,
            opacity: tripIn,
            translate: `0px ${lerp(30, 0, tripIn)}px`,
            display: "flex",
            alignItems: "center",
            gap: 26,
            fontFamily: F.zh,
            fontWeight: 600,
            fontSize: 92,
            color: C.nightInk,
            whiteSpace: "nowrap",
          }}
        >
          {TRIP.from}
          <span style={{ color: C.red, fontWeight: 400 }}>→</span>
          {TRIP.to}
        </div>

        <div
          style={{
            marginTop: 64,
            display: "flex",
            alignItems: "flex-end",
            gap: 56,
            height: 270,
          }}
        >
          <div
            style={{
              opacity: oldIn * lerp(1, 0.62, struck),
              translate: `0px ${lerp(30, 0, oldIn)}px`,
              paddingBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: F.zh,
                fontSize: 32,
                color: C.nightMuted,
                marginBottom: 8,
              }}
            >
              老票价
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <Num size={150} color={C.nightInk}>
                {TRIP.oldFare}
              </Num>
              <span
                style={{
                  fontFamily: F.zh,
                  fontSize: 46,
                  fontWeight: 500,
                  color: C.nightInk,
                  marginLeft: 10,
                }}
              >
                元
              </span>
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: "52%",
                  height: 8,
                  borderRadius: 4,
                  background: C.red,
                  width: `calc(${struck * 100}% + ${struck * 20}px)`,
                  rotate: "-8deg",
                  transformOrigin: "left center",
                }}
              />
            </div>
          </div>

          <div
            style={{
              opacity: Math.min(1, newIn * 1.5),
              scale: lerp(0.5, 1, newIn),
              transformOrigin: "left bottom",
            }}
          >
            <div
              style={{
                fontFamily: F.zh,
                fontSize: 32,
                color: C.red,
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              新票价
            </div>
            <Num size={220} color={C.red}>
              {TRIP.fare}
            </Num>
            <span
              style={{
                fontFamily: F.zh,
                fontSize: 64,
                fontWeight: 600,
                color: C.red,
                marginLeft: 12,
              }}
            >
              元
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            opacity: questionIn,
            translate: `0px ${lerp(40, 0, questionIn)}px`,
            fontFamily: F.zh,
            fontWeight: 600,
            fontSize: 112,
            letterSpacing: "-0.02em",
            color: C.nightInk,
            whiteSpace: "nowrap",
          }}
        >
          你的那一趟呢？
        </div>
      </div>
    </AbsoluteFill>
  );
};

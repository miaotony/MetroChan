import React from "react";
import { useCurrentFrame } from "remotion";
import { Card, Chip, Num, SceneHeader, SceneShift } from "../components/Bits";
import { Cursor } from "../components/Cursor";
import { fareNew, fareOld } from "../data";
import { backOut, easeInOut, easeOut, lerp, pulse, tween } from "../lib/anim";
import { kmAt } from "../motion";
import { C, F } from "../theme";
import { DISTANCE, SCENES } from "../timeline";

const COL_X = 96;
const COL_W = 684;
const PANEL = { x: 846, y: 168, w: 978, h: 836 };
const PLOT = { x: 104, y: 150, w: 818, h: 500 };
const TRACK_Y = PLOT.y + PLOT.h + 70;
const KM_MAX = 30;
const FARE_LOW = 2.4;
const FARE_HIGH = 8.7;
const EPS = 0.001;
/** 2025 citywide average trip length, as quoted on the site's 按乘距 page. */
const AVERAGE_KM = 16.45;
const OLD_STROKE = "#A39C8F";

const px = (km: number) => PLOT.x + (km / KM_MAX) * PLOT.w;
const py = (fare: number) =>
  PLOT.y + PLOT.h - ((fare - FARE_LOW) / (FARE_HIGH - FARE_LOW)) * PLOT.h;

const stepPath = (fare: (km: number) => number) => {
  let d = `M${px(0)},${py(fare(EPS))}`;
  for (let km = 1; km < KM_MAX; km++) {
    if (fare(km + EPS) !== fare(km)) {
      d += `H${px(km)}V${py(fare(km + EPS))}`;
    }
  }
  return `${d}H${px(KM_MAX)}`;
};

const OLD_PATH = stepPath(fareOld);
const NEW_PATH = stepPath(fareNew);

/** Stretches of whole kilometres over which both fares stay put. */
const BANDS = (() => {
  const bands: { from: number; to: number; old: number; next: number }[] = [];
  for (let km = 0; km < KM_MAX; km++) {
    const old = fareOld(km + 0.5);
    const next = fareNew(km + 0.5);
    const last = bands[bands.length - 1];
    if (last && last.old === old && last.next === next) last.to = km + 1;
    else bands.push({ from: km, to: km + 1, old, next });
  }
  return bands;
})();

/** How far the starting fare carries, in km. */
const startReach = (fare: (km: number) => number) => {
  for (let km = 1; km < KM_MAX; km++) {
    if (fare(km + EPS) !== fare(EPS)) return km;
  }
  return KM_MAX;
};

const START_FARE = fareNew(EPS);
const FARE_TICKS = Array.from({ length: 6 }, (_, i) => START_FARE + i);
const KM_TICKS = [0, 5, 10, 15, 20, 25, 30];

const Pill: React.FC<{
  x: number;
  y: number;
  text: string;
  fill: string;
  color: string;
  opacity: number;
}> = ({ x, y, text, fill, color, opacity }) => (
  <g transform={`translate(${x}, ${y})`} opacity={opacity}>
    <rect x={-62} y={-23} width={124} height={46} rx={23} fill={fill} />
    <text
      y={9}
      textAnchor="middle"
      fontFamily={F.zh}
      fontSize={26}
      fontWeight={600}
      fill={color}
    >
      {text}
    </text>
  </g>
);

const FareBlock: React.FC<{
  label: string;
  fare: number;
  size: number;
  color: string;
  labelColor: string;
  pop: number;
  align: "left" | "right";
}> = ({ label, fare, size, color, labelColor, pop, align }) => (
  <div style={{ textAlign: align }}>
    <div
      style={{
        fontFamily: F.zh,
        fontSize: 26,
        fontWeight: 600,
        color: labelColor,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 6,
        display: "inline-flex",
        alignItems: "baseline",
        color,
        scale: 1 + pop * 0.06,
        transformOrigin: align === "left" ? "left bottom" : "right bottom",
      }}
    >
      <Num size={size}>{fare}</Num>
      <span
        style={{
          fontFamily: F.zh,
          fontSize: size * 0.3,
          fontWeight: 600,
          marginLeft: 10,
        }}
      >
        元
      </span>
    </div>
  </div>
);

export const Distance: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.distance.duration;
  const enter = tween(frame, 0, 18, easeOut);
  /* gone by the bar line, so the next chapter never overlaps this one */
  const exit = tween(frame, duration - 7, 10, easeInOut);

  const km = kmAt(frame);
  const oldFare = fareOld(km);
  const newFare = fareNew(km);
  const delta = newFare - oldFare;

  /* dots glide to the next step instead of jumping */
  const glide = (fare: (value: number) => number) => {
    let sum = 0;
    for (let back = 0; back < 4; back++) sum += py(fare(kmAt(frame - back)));
    return sum / 4;
  };
  const oldY = glide(fareOld);
  const newY = glide(fareNew);
  const changed = (fare: (value: number) => number) =>
    [1, 2, 3, 4, 5].some((back) => fare(kmAt(frame - back)) !== fare(km))
      ? 1
      : 0;

  const reveal = tween(frame, DISTANCE.curves - 6, 30, easeInOut);
  const marker = tween(frame, DISTANCE.curves + 18, 14, easeOut);
  const markerX = px(km);
  const pastAverage = km >= AVERAGE_KM ? 1 : 0;
  const verdictPulse = pulse(frame, DISTANCE.verdict, 3, 16);

  /* ---- cursor ---- */
  const knobScreenX = PANEL.x + markerX;
  const knobScreenY = PANEL.y + TRACK_Y;
  const approach = tween(frame, DISTANCE.grab - 22, 22, easeInOut);
  const leave = tween(frame, DISTANCE.dragEnd + 10, 20, easeInOut);
  const cursorX = lerp(PANEL.x + 540, knobScreenX + 4, approach) + leave * 110;
  const cursorY = lerp(PANEL.y + 470, knobScreenY + 6, approach) + leave * 84;
  const holding = frame >= DISTANCE.grab && frame <= DISTANCE.dragEnd + 6;
  const cursorOpacity =
    tween(frame, DISTANCE.grab - 24, 10, easeOut) *
    (1 - tween(frame, DISTANCE.dragEnd + 20, 12, easeOut));

  const chip = (index: number) =>
    tween(frame, DISTANCE.verdict + index * 9, 12, backOut);

  return (
    <SceneShift enter={enter} exit={exit}>
      <SceneHeader
        index="04"
        label="按乘距"
        title="拖动里程，新旧对比"
        progress={tween(frame, 2, 16, easeOut)}
        titleProgress={tween(frame, 8, 18, easeOut)}
      />

      {/* ---------- left: the live answer ---------- */}
      <Card
        x={COL_X}
        y={318}
        w={COL_W}
        h={536}
        progress={tween(frame, 12, 20, easeOut)}
        style={{
          boxShadow: `0 40px 70px -42px rgba(70, 48, 16, 0.38), 0 0 0 ${
            verdictPulse * 10
          }px rgba(229, 50, 43, ${0.16 * verdictPulse})`,
        }}
      >
        <div style={{ padding: "34px 40px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              fontFamily: F.zh,
              fontSize: 30,
              color: C.muted,
              whiteSpace: "nowrap",
            }}
          >
            这一趟坐
            <Num size={96} color={C.ink}>
              {km.toFixed(1)}
            </Num>
            <span style={{ fontSize: 38, fontWeight: 500, color: C.inkSoft }}>
              公里
            </span>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <FareBlock
              label="老方案 · 2005 版"
              fare={oldFare}
              size={124}
              color={C.inkSoft}
              labelColor={C.muted}
              pop={changed(fareOld)}
              align="left"
            />
            <svg
              width={74}
              height={40}
              viewBox="0 0 74 40"
              style={{ marginBottom: 44 }}
            >
              <path
                d="M4 20 H66 M50 6 L66 20 L50 34"
                fill="none"
                stroke={C.faint}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <FareBlock
              label="新方案 · 2026-12 起"
              fare={newFare}
              size={176}
              color={C.red}
              labelColor={C.red}
              pop={changed(fareNew)}
              align="right"
            />
          </div>

          <div
            style={{
              marginTop: 26,
              paddingTop: 24,
              borderTop: `2px solid ${C.hair}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: F.zh,
              fontSize: 32,
              color: C.inkSoft,
              whiteSpace: "nowrap",
            }}
          >
            <span>同样这段路，比老方案</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                padding: "8px 22px 6px",
                borderRadius: 18,
                background: delta > 0 ? C.ink : C.paperDeep,
                color: delta > 0 ? C.cream : C.inkSoft,
                scale: 1 + verdictPulse * 0.08,
              }}
            >
              {delta > 0 ? (
                <>
                  <Num size={48}>+{delta}</Num>
                  <span style={{ fontSize: 30, marginLeft: 8 }}>元</span>
                </>
              ) : (
                <span style={{ fontSize: 34, fontWeight: 600 }}>一分没涨</span>
              )}
            </span>
          </div>
        </div>
      </Card>

      <div
        style={{
          position: "absolute",
          left: COL_X,
          top: 878,
          width: COL_W,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Chip size={25} progress={chip(0)}>
          起步价 {START_FARE} 元不变
        </Chip>
        <Chip size={25} progress={chip(1)}>
          起步里程 {startReach(fareOld)} → {startReach(fareNew)} 公里
        </Chip>
        <Chip
          size={25}
          progress={chip(2)}
          background={C.redSoft}
          border="transparent"
          color={C.redDeep}
        >
          全市平均乘距 {AVERAGE_KM} 公里：{fareOld(AVERAGE_KM)} →{" "}
          {fareNew(AVERAGE_KM)} 元
        </Chip>
      </div>

      {/* ---------- right: the fare ladder ---------- */}
      <Card
        x={PANEL.x}
        y={PANEL.y}
        w={PANEL.w}
        h={PANEL.h}
        radius={40}
        progress={tween(frame, 6, 20, easeOut)}
        style={{ overflow: "visible" }}
      >
        <div
          style={{
            position: "absolute",
            left: 44,
            right: 44,
            top: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: F.zh,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 600, color: C.ink }}>
            票价阶梯
            <span
              style={{
                fontSize: 26,
                fontWeight: 400,
                color: C.muted,
                marginLeft: 16,
              }}
            >
              每一公里，新旧各多少
            </span>
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              fontSize: 26,
              color: C.inkSoft,
            }}
          >
            <span
              style={{
                width: 40,
                height: 8,
                borderRadius: 4,
                background: C.red,
              }}
            />
            新方案
            <span
              style={{
                width: 40,
                height: 6,
                borderRadius: 3,
                background: OLD_STROKE,
                marginLeft: 18,
              }}
            />
            老方案
          </span>
        </div>

        <svg
          width={PANEL.w}
          height={PANEL.h}
          style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        >
          <defs>
            <clipPath id="distance-reveal">
              <rect
                x={PLOT.x - 10}
                y={PLOT.y - 40}
                width={(PLOT.w + 20) * reveal}
                height={PLOT.h + 80}
              />
            </clipPath>
            <clipPath id="distance-travelled">
              <rect
                x={PLOT.x}
                y={PLOT.y - 40}
                width={Math.max(0, markerX - PLOT.x)}
                height={PLOT.h + 80}
              />
            </clipPath>
          </defs>

          {FARE_TICKS.map((fare) => (
            <g key={fare}>
              <line
                x1={PLOT.x}
                x2={PLOT.x + PLOT.w}
                y1={py(fare)}
                y2={py(fare)}
                stroke={C.hair}
                strokeWidth={2}
              />
              <text
                x={PLOT.x - 18}
                y={py(fare) + 9}
                textAnchor="end"
                fontFamily={F.num}
                fontSize={26}
                fontWeight={700}
                fill={C.faint}
              >
                {fare} 元
              </text>
            </g>
          ))}

          {/* what the new scheme adds, up to where the knob is */}
          <g clipPath="url(#distance-travelled)" opacity={marker}>
            {BANDS.filter((band) => band.next > band.old).map((band) => (
              <rect
                key={band.from}
                x={px(band.from)}
                y={py(band.next)}
                width={px(band.to) - px(band.from)}
                height={py(band.old) - py(band.next)}
                fill={C.red}
                opacity={0.14}
              />
            ))}
          </g>

          <g opacity={reveal}>
            <line
              x1={px(AVERAGE_KM)}
              x2={px(AVERAGE_KM)}
              y1={py(fareNew(AVERAGE_KM))}
              y2={PLOT.y + PLOT.h + 14}
              stroke={pastAverage ? C.red : C.faint}
              strokeWidth={3}
              strokeDasharray="2 9"
              strokeLinecap="round"
            />
            <text
              x={px(AVERAGE_KM) + 14}
              y={PLOT.y + PLOT.h - 4}
              fontFamily={F.zh}
              fontSize={24}
              fontWeight={pastAverage ? 600 : 400}
              fill={pastAverage ? C.red : C.muted}
            >
              平均乘距 {AVERAGE_KM} 公里
            </text>
          </g>

          <g
            clipPath="url(#distance-reveal)"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={OLD_PATH} stroke={OLD_STROKE} strokeWidth={6} />
            <path d={NEW_PATH} stroke={C.red} strokeWidth={9} />
          </g>

          {/* the marker under the cursor */}
          <g opacity={marker}>
            <line
              x1={markerX}
              x2={markerX}
              y1={newY}
              y2={TRACK_Y}
              stroke={C.ink}
              strokeWidth={3}
              strokeDasharray="3 9"
              strokeLinecap="round"
              opacity={0.4}
            />
            <line
              x1={markerX}
              x2={markerX}
              y1={newY}
              y2={oldY}
              stroke={C.red}
              strokeWidth={9}
              strokeLinecap="round"
            />
            <circle
              cx={markerX}
              cy={oldY}
              r={13}
              fill={C.card}
              stroke={C.inkSoft}
              strokeWidth={6}
            />
            <circle
              cx={markerX}
              cy={newY}
              r={15}
              fill={C.card}
              stroke={C.red}
              strokeWidth={7}
            />
          </g>
          <Pill
            x={markerX}
            y={oldY + 52}
            text={`老 ${oldFare} 元`}
            fill={C.inkSoft}
            color={C.cream}
            opacity={marker}
          />
          <Pill
            x={markerX}
            y={newY - 54}
            text={`新 ${newFare} 元`}
            fill={C.red}
            color="#FFFFFF"
            opacity={marker}
          />

          {KM_TICKS.map((tick) => (
            <text
              key={tick}
              x={px(tick)}
              y={TRACK_Y + 64}
              textAnchor="middle"
              fontFamily={F.num}
              fontSize={24}
              fontWeight={700}
              fill={C.faint}
            >
              {tick}
              {tick === KM_MAX ? " 公里" : ""}
            </text>
          ))}
        </svg>

        {/* the track the knob rides on */}
        <div
          style={{
            position: "absolute",
            left: PLOT.x,
            top: TRACK_Y - 7,
            width: PLOT.w,
            height: 14,
            borderRadius: 7,
            background: C.paperDeep,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: PLOT.x,
            top: TRACK_Y - 7,
            width: markerX - PLOT.x,
            height: 14,
            borderRadius: 7,
            background: C.red,
            opacity: marker,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: markerX - 25,
            top: TRACK_Y - 25,
            width: 50,
            height: 50,
            boxSizing: "border-box",
            borderRadius: 25,
            background: "#FFFFFF",
            border: `6px solid ${C.red}`,
            boxShadow: holding
              ? "0 0 0 12px rgba(229, 50, 43, 0.18), 0 8px 16px rgba(120, 20, 20, 0.28)"
              : "0 6px 14px rgba(120, 20, 20, 0.22)",
            scale: (holding ? 1.12 : 1) * lerp(0.4, 1, marker),
            opacity: marker,
          }}
        />
      </Card>

      <Cursor
        x={cursorX}
        y={cursorY}
        press={holding ? 1 : 0}
        opacity={cursorOpacity}
      />
    </SceneShift>
  );
};

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  Card,
  Chip,
  LineBadge,
  LineDots,
  Num,
  SceneHeader,
  SceneShift,
  TitleSwap,
} from "../components/Bits";
import { Cursor } from "../components/Cursor";
import {
  BaseNetwork,
  ColorNetwork,
  MapCamera,
  StationDots,
} from "../components/NetworkMap";
import {
  FACTS,
  meterFare,
  NETWORK,
  searchStations,
  stationLines,
  stationPoint,
  TRIP,
  tripPoint,
} from "../data";
import {
  backOut,
  CLAMP,
  easeInOut,
  easeOut,
  handOver,
  lerp,
  pulse,
  softInOut,
  tween,
} from "../lib/anim";
import { C, F } from "../theme";
import { BEAT, S2S, SCENES, TYPED } from "../timeline";

const COL_X = 96;
const COL_W = 684;
const PANEL_Y = 318;
const FIELD_H = 88;
const FIELD_GAP = 144;
const ROW_H = 64;
const MAP = { x: 846, y: 168, w: 978, h: 836 };
const TIERS = [
  { fare: 3, upTo: 4 },
  { fare: 4, upTo: 8 },
  { fare: 5, upTo: 12 },
  { fare: 6, upTo: 16 },
  { fare: 7, upTo: 23 },
];

const SEARCH_WAYS = [
  { kind: "汉字", text: TRIP.from },
  { kind: "全拼", text: searchStations(TRIP.from, 1)[0]?.pinyin ?? "" },
  { kind: "首字母", text: TYPED.from },
];

const typedAt = (frame: number, start: number, text: string) => {
  const count = Math.floor((frame - start) / (BEAT / 2)) + 1;
  return text.slice(0, Math.max(0, Math.min(text.length, count)));
};

const SearchField: React.FC<{
  top: number;
  label: string;
  query: string;
  picked: string | null;
  active: boolean;
  caret: boolean;
  pop: number;
}> = ({ top, label, query, picked, active, caret, pop }) => (
  <div style={{ position: "absolute", left: 0, top, width: COL_W }}>
    <div
      style={{
        fontFamily: F.zh,
        fontSize: 26,
        fontWeight: 500,
        color: C.muted,
        height: 36,
      }}
    >
      {label}
    </div>
    <div
      style={{
        height: FIELD_H,
        boxSizing: "border-box",
        borderRadius: 22,
        background: "#FFFFFF",
        border: `3px solid ${active ? C.red : C.hair}`,
        boxShadow: active ? "0 0 0 8px rgba(229, 50, 43, 0.12)" : undefined,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 28px",
        scale: 1 + pop * 0.03,
      }}
    >
      {picked ? (
        <>
          <LineDots lines={stationLines(picked)} size={20} />
          <span
            style={{
              fontFamily: F.zh,
              fontSize: 44,
              fontWeight: 600,
              color: C.ink,
            }}
          >
            {picked}
          </span>
        </>
      ) : (
        <>
          <svg width={34} height={34} viewBox="0 0 34 34">
            <circle
              cx={14}
              cy={14}
              r={10}
              fill="none"
              stroke={C.faint}
              strokeWidth={4}
            />
            <path
              d="M22 22 L31 31"
              stroke={C.faint}
              strokeWidth={4}
              strokeLinecap="round"
            />
          </svg>
          {query ? (
            <span
              style={{
                fontFamily: F.latin,
                fontSize: 46,
                fontWeight: 600,
                color: C.ink,
                letterSpacing: "0.04em",
              }}
            >
              {query}
            </span>
          ) : (
            <span style={{ fontFamily: F.zh, fontSize: 34, color: C.faint }}>
              汉字 / 拼音 / 首字母
            </span>
          )}
          {active ? (
            <span
              style={{
                width: 4,
                height: 46,
                borderRadius: 2,
                background: C.red,
                marginLeft: query ? -10 : -6,
                opacity: caret ? 1 : 0,
              }}
            />
          ) : null}
        </>
      )}
    </div>
  </div>
);

const Dropdown: React.FC<{
  top: number;
  query: string;
  progress: number;
  press: number;
}> = ({ top, query, progress, press }) => {
  const hits = searchStations(query, 5);
  if (!hits.length || progress <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top,
        width: COL_W,
        boxSizing: "border-box",
        borderRadius: 22,
        background: "#FFFFFF",
        border: `2px solid ${C.hair}`,
        boxShadow: "0 36px 60px -30px rgba(70, 48, 16, 0.45)",
        padding: 8,
        opacity: Math.min(1, progress * 2),
        translate: `0px ${lerp(-14, 0, progress)}px`,
        zIndex: 5,
      }}
    >
      {hits.map((hit, i) => (
        <div
          key={hit.name}
          style={{
            height: ROW_H,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 20px",
            background:
              i === 0
                ? `rgba(229, 50, 43, ${0.1 + press * 0.12})`
                : "transparent",
          }}
        >
          <LineDots lines={hit.lines} size={16} />
          <span
            style={{
              fontFamily: F.zh,
              fontSize: 34,
              fontWeight: i === 0 ? 600 : 400,
              color: C.ink,
            }}
          >
            {hit.name}
          </span>
          <span
            style={{
              fontFamily: F.latin,
              fontSize: 24,
              color: C.faint,
              letterSpacing: "0.02em",
            }}
          >
            {hit.pinyin}
          </span>
        </div>
      ))}
    </div>
  );
};

const MapLabel: React.FC<{
  name: string;
  zoom: number;
  progress: number;
  dx: number;
  dy: number;
  anchor: "start" | "end" | "middle";
  note?: string;
}> = ({ name, zoom, progress, dx, dy, anchor, note }) => {
  if (progress <= 0) return null;
  const [x, y] = stationPoint(name);
  const size = 30 / zoom;
  return (
    <g opacity={Math.min(1, progress * 1.5)}>
      <text
        x={x + dx / zoom}
        y={y + dy / zoom}
        textAnchor={anchor}
        fontFamily={F.zh}
        fontSize={size}
        fontWeight={600}
        fill={C.ink}
        stroke={C.card}
        strokeWidth={size * 0.3}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {name}
        {note ? (
          <tspan fill={C.muted} fontWeight={500} fontSize={size * 0.76}>
            {` ${note}`}
          </tspan>
        ) : null}
      </text>
    </g>
  );
};

export const StationToStation: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.s2s.duration;
  const enter = tween(frame, 0, 18, easeOut);
  /* gone by the bar line, so the next chapter never overlaps this one */
  const exit = tween(frame, duration - 7, 10, easeInOut);

  /* ---- search ---- */
  const fromQuery = typedAt(frame, S2S.typeFrom, TYPED.from);
  const toQuery = typedAt(frame, S2S.typeTo, TYPED.to);
  const fromPicked = frame >= S2S.pickFrom;
  const toPicked = frame >= S2S.pickTo;
  const fromActive = frame >= S2S.focusFrom && !fromPicked;
  const toActive = frame >= S2S.typeTo - 6 && !toPicked;
  const caret = Math.floor(frame / 8) % 2 === 0;

  const collapse = tween(frame, S2S.pickTo + 8, 14, easeInOut);
  const resultIn = tween(frame, S2S.pickTo + 12, 18, easeOut);
  const factsMix = tween(frame, S2S.facts - 8, 16, easeInOut);
  const factsSwap = handOver(factsMix);

  /* ---- route + meter ---- */
  const routeT = tween(
    frame,
    S2S.drawStart,
    S2S.arrive - S2S.drawStart,
    (t) => t,
  );
  const fare = frame < S2S.drawStart ? TIERS[0].fare : meterFare(routeT);
  const km = routeT * TRIP.km;
  const arrived = tween(frame, S2S.arrive, 12, backOut);
  const arrivePulse = pulse(frame, S2S.arrive, 2, 16);
  const head = tripPoint(routeT);

  /* ---- map camera ---- */
  const keys = [0, S2S.pickTo, S2S.drawStart + BEAT, S2S.facts, S2S.facts + 34];
  const camera = (values: number[]) =>
    interpolate(frame, keys, values, { ...CLAMP, easing: softInOut });
  const zoom = camera([0.73, 0.77, 1.56, 1.62, 0.71]);
  const cx = camera([500, 500, 436, 436, 505]);
  const cy = camera([650, 650, 712, 712, 672]);
  const colorMix = tween(frame, S2S.facts, 30, easeOut);

  const hits =
    fromActive && fromQuery
      ? searchStations(fromQuery, 5)
      : toActive && toQuery
        ? searchStations(toQuery, 5)
        : [];

  /* ---- cursor ---- */
  const fieldY = (index: number) =>
    PANEL_Y + index * FIELD_GAP + 36 + FIELD_H / 2;
  const rowY = (index: number) =>
    PANEL_Y + index * FIELD_GAP + 36 + FIELD_H + 16 + ROW_H / 2;
  const cursorKeys = [
    0,
    S2S.focusFrom,
    S2S.pickFrom - 14,
    S2S.pickFrom,
    S2S.typeTo - 6,
    S2S.pickTo - 12,
    S2S.pickTo,
    S2S.pickTo + 20,
  ];
  const cursorX = interpolate(
    frame,
    cursorKeys,
    [
      COL_X + 520,
      COL_X + 430,
      COL_X + 430,
      COL_X + 330,
      COL_X + 430,
      COL_X + 430,
      COL_X + 330,
      COL_X + 420,
    ],
    { ...CLAMP, easing: easeInOut },
  );
  const cursorY = interpolate(
    frame,
    cursorKeys,
    [
      820,
      fieldY(0) + 8,
      fieldY(0) + 8,
      rowY(0) + 4,
      fieldY(1) + 8,
      fieldY(1) + 8,
      rowY(1) + 4,
      rowY(1) + 110,
    ],
    { ...CLAMP, easing: easeInOut },
  );
  const clicks = [S2S.focusFrom, S2S.pickFrom, S2S.typeTo - 6, S2S.pickTo];
  const press = Math.max(...clicks.map((click) => pulse(frame, click, 3, 6)));
  const rippleFrom = clicks.filter((click) => frame >= click).pop();
  const cursorOpacity =
    tween(frame, 6, 10, easeOut) * (1 - tween(frame, S2S.pickTo + 8, 12));

  const stepPulse = Math.max(
    ...TIERS.slice(1).map((tier, i) => {
      const stepFrame =
        S2S.drawStart +
        (TIERS[i].upTo / TRIP.km) * (S2S.arrive - S2S.drawStart);
      return tier.fare <= TRIP.fare ? pulse(frame, stepFrame, 2, 10) : 0;
    }),
    arrivePulse,
  );

  return (
    <SceneShift enter={enter} exit={exit}>
      <SceneHeader
        index="01"
        label="站到站"
        progress={tween(frame, 2, 16, easeOut)}
        titleProgress={tween(frame, 8, 18, easeOut)}
        title={
          <TitleSwap
            from="输入两站，秒出票价"
            to="每一对站，都查得到"
            mix={factsMix}
          />
        }
      />

      {/* ---------- left column ---------- */}
      <div
        style={{
          position: "absolute",
          left: COL_X,
          top: 0,
          width: COL_W,
          opacity: tween(frame, 14, 16, easeOut),
        }}
      >
        <div style={{ opacity: 1 - collapse }}>
          <SearchField
            top={PANEL_Y}
            label="起点站"
            query={fromQuery}
            picked={fromPicked ? TRIP.from : null}
            active={fromActive}
            caret={caret}
            pop={pulse(frame, S2S.pickFrom, 2, 10)}
          />
          <SearchField
            top={PANEL_Y + FIELD_GAP}
            label="终点站"
            query={toQuery}
            picked={toPicked ? TRIP.to : null}
            active={toActive}
            caret={caret}
            pop={pulse(frame, S2S.pickTo, 2, 10)}
          />
          <Dropdown
            top={PANEL_Y + 36 + FIELD_H + 16}
            query={fromActive ? fromQuery : ""}
            progress={tween(frame, S2S.typeFrom, 8, easeOut)}
            press={pulse(frame, S2S.pickFrom, 4, 4)}
          />
          <Dropdown
            top={PANEL_Y + FIELD_GAP + 36 + FIELD_H + 16}
            query={toActive ? toQuery : ""}
            progress={tween(frame, S2S.typeTo, 8, easeOut)}
            press={pulse(frame, S2S.pickTo, 4, 4)}
          />
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            top: 836,
            width: COL_W,
            opacity:
              tween(frame, S2S.typeFrom - 6, 14, easeOut) * (1 - collapse),
          }}
        >
          <div
            style={{
              fontFamily: F.zh,
              fontSize: 26,
              color: C.muted,
              marginBottom: 16,
            }}
          >
            同一个站，三种打法都认
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {SEARCH_WAYS.map((way, i) => (
              <Chip
                key={way.kind}
                size={26}
                progress={tween(frame, S2S.typeFrom + i * 5, 12, backOut)}
                background={i === 2 ? C.redSoft : "#FFFFFF"}
                border={i === 2 ? "transparent" : C.hair}
              >
                <span style={{ color: C.muted }}>{way.kind}</span>
                <span style={{ fontWeight: 600 }}>{way.text}</span>
              </Chip>
            ))}
          </div>
        </div>

        {/* trip bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: PANEL_Y,
            width: COL_W,
            height: 96,
            boxSizing: "border-box",
            borderRadius: 26,
            background: C.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            opacity: collapse,
            scale: lerp(0.94, 1, collapse),
            fontFamily: F.zh,
            fontSize: 44,
            fontWeight: 600,
            color: C.cream,
          }}
        >
          <LineDots lines={stationLines(TRIP.from)} size={18} />
          {TRIP.from}
          <span style={{ color: C.red, fontWeight: 400, margin: "0 6px" }}>
            →
          </span>
          <LineDots lines={stationLines(TRIP.to)} size={18} />
          {TRIP.to}
        </div>
      </div>

      {/* fare card */}
      <Card x={COL_X} y={PANEL_Y + 120} w={COL_W} h={566} progress={resultIn}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "34px 40px",
            opacity: 1 - factsSwap.leave,
            translate: `0px ${-factsSwap.leave * 24}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 58,
            }}
          >
            <span
              style={{
                fontFamily: F.zh,
                fontSize: 30,
                fontWeight: 500,
                color: C.muted,
              }}
            >
              {frame >= S2S.arrive ? "官方实测票价" : "按里程计价中…"}
            </span>
            <Chip
              progress={tween(frame, S2S.compare, 12, backOut)}
              size={26}
              background={C.redSoft}
              border="transparent"
              color={C.redDeep}
            >
              老方案 {TRIP.oldFare} 元
              <span style={{ fontFamily: F.num, fontWeight: 700 }}>
                +{TRIP.fare - TRIP.oldFare}
              </span>
            </Chip>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: 236,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                scale: 1 + stepPulse * 0.07 + (arrived - 1) * 0.04,
                transformOrigin: "left bottom",
              }}
            >
              <Num size={250} color={C.red}>
                {fare}
              </Num>
              <span
                style={{
                  fontFamily: F.zh,
                  fontSize: 60,
                  fontWeight: 600,
                  color: C.red,
                  marginLeft: 10,
                }}
              >
                元
              </span>
            </div>

            {/* the fare ladder the meter climbs */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                paddingBottom: 30,
              }}
            >
              {TIERS.map((tier, i) => {
                const reached = fare >= tier.fare;
                const current = fare === tier.fare;
                return (
                  <div key={tier.fare} style={{ width: 62 }}>
                    <div
                      style={{
                        height: 46 + i * 26,
                        borderRadius: 10,
                        background: current
                          ? C.red
                          : reached
                            ? "#F3B4AC"
                            : C.paperDeep,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingTop: 7,
                        boxSizing: "border-box",
                        fontFamily: F.num,
                        fontWeight: 700,
                        fontSize: 26,
                        color: reached ? "#FFFFFF" : C.faint,
                      }}
                    >
                      {tier.fare}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        textAlign: "center",
                        fontFamily: F.num,
                        fontSize: 22,
                        color: C.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ≤{tier.upTo}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "space-between",
              fontFamily: F.zh,
              fontSize: 26,
              color: C.muted,
            }}
          >
            <span>
              {frame >= S2S.arrive ? "计价里程" : "已计"}
              <Num size={30} color={C.ink} style={{ margin: "0 8px" }}>
                {km.toFixed(1)}
              </Num>
              公里
            </span>
            <span>新票价阶梯 · 公里</span>
          </div>

          <div
            style={{
              marginTop: 26,
              paddingTop: 26,
              borderTop: `2px solid ${C.hair}`,
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: F.zh,
              fontSize: 28,
              color: C.inkSoft,
              whiteSpace: "nowrap",
            }}
          >
            {TRIP.legs.map((leg, i) => {
              const shown = tween(
                frame,
                S2S.drawStart + leg.t0 * (S2S.arrive - S2S.drawStart),
                10,
                easeOut,
              );
              return (
                <React.Fragment key={leg.line}>
                  {i > 0 ? (
                    <span style={{ opacity: shown, color: C.muted }}>
                      {leg.from} 换乘
                    </span>
                  ) : null}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      opacity: shown,
                    }}
                  >
                    <LineBadge line={leg.line} size={24} />
                    {leg.stops} 站
                  </span>
                </React.Fragment>
              );
            })}
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 12 }}>
            {[
              `约 ${TRIP.minutes} 分钟`,
              `换乘 ${TRIP.transfers} 次`,
              `途经 ${TRIP.legs.reduce((sum, leg) => sum + leg.stops, 0)} 站`,
            ].map((text, i) => (
              <Chip
                key={text}
                size={26}
                progress={tween(frame, S2S.chips + i * 4, 12, backOut)}
                background={C.paper}
              >
                {text}
              </Chip>
            ))}
          </div>
        </div>

        {/* network facts */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "44px 40px",
            opacity: factsSwap.arrive,
            translate: `0px ${(1 - factsSwap.arrive) * 24}px`,
          }}
        >
          <div style={{ fontFamily: F.zh, fontSize: 30, color: C.muted }}>
            数据取自官方票价查询系统
          </div>
          <div style={{ marginTop: 26 }}>
            <Num size={176} color={C.ink}>
              {Math.round(
                FACTS.pairs * tween(frame, S2S.factsCount - 8, 40, easeOut),
              ).toLocaleString("en-US")}
            </Num>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: F.zh,
              fontSize: 46,
              fontWeight: 600,
              color: C.ink,
            }}
          >
            个站对，全是
            <span style={{ color: C.red }}>官方实测票价</span>
          </div>
          <div style={{ marginTop: 44, display: "flex", gap: 12 }}>
            {[
              `${FACTS.stations} 座车站`,
              `${FACTS.lines} 条线路`,
              `${FACTS.capturedAt} 采集`,
            ].map((text, i) => (
              <Chip
                key={text}
                size={26}
                progress={tween(
                  frame,
                  S2S.factsCount + BEAT + i * 5,
                  12,
                  backOut,
                )}
                background={C.paper}
              >
                {text}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------- map ---------- */}
      <Card
        x={MAP.x}
        y={MAP.y}
        w={MAP.w}
        h={MAP.h}
        progress={tween(frame, 6, 20, easeOut)}
        radius={40}
      >
        <MapCamera width={MAP.w} height={MAP.h} cx={cx} cy={cy} zoom={zoom}>
          <BaseNetwork
            stroke="#E6DED0"
            strokeWidth={4.4 / zoom}
            opacity={1 - colorMix * 0.6}
          />
          {colorMix > 0 ? (
            <>
              <ColorNetwork
                radius={colorMix * (NETWORK.reach + 40)}
                strokeWidth={4.6 / zoom}
              />
              <StationDots
                radius={colorMix * (NETWORK.reach + 40)}
                r={3.6 / zoom}
                fill="#FFFFFF"
                stroke={C.ink}
              />
            </>
          ) : null}

          {/* search hits lighting up on the map */}
          {hits.map((hit, i) => {
            const [x, y] = stationPoint(hit.name);
            const wave = ((frame + i * 5) % 24) / 24;
            return (
              <g key={hit.name}>
                <circle
                  cx={x}
                  cy={y}
                  r={(10 + wave * 22) / zoom}
                  fill="none"
                  stroke={C.red}
                  strokeWidth={3 / zoom}
                  opacity={(1 - wave) * (i === 0 ? 0.9 : 0.5)}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={(i === 0 ? 9 : 6) / zoom}
                  fill={i === 0 ? C.red : "#F3B4AC"}
                />
              </g>
            );
          })}

          {/* route */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {TRIP.legs.map((leg) => {
              const local = Math.max(
                0,
                Math.min(1, (routeT - leg.t0) / (leg.t1 - leg.t0)),
              );
              if (local <= 0) return null;
              return (
                <React.Fragment key={leg.line}>
                  <path
                    d={leg.d}
                    stroke="#FFFFFF"
                    strokeWidth={20 / zoom}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - local}
                  />
                  <path
                    d={leg.d}
                    stroke={leg.color}
                    strokeWidth={12 / zoom}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - local}
                  />
                </React.Fragment>
              );
            })}
          </g>
          {TRIP.legs.map((leg) =>
            leg.stations.map((name, i) => {
              if (i === 0 || i === leg.stations.length - 1) return null;
              const passed = tween(
                frame,
                S2S.drawStart + leg.stationT[i] * (S2S.arrive - S2S.drawStart),
                8,
                backOut,
              );
              if (passed <= 0) return null;
              const [x, y] = stationPoint(name);
              return (
                <circle
                  key={`${leg.line}-${name}`}
                  cx={x}
                  cy={y}
                  r={(4.2 * passed) / zoom}
                  fill="#FFFFFF"
                />
              );
            }),
          )}

          {/* endpoints and the transfer */}
          {[
            { name: TRIP.from, at: S2S.pickFrom },
            {
              name: TRIP.legs[0].to,
              at:
                S2S.drawStart + TRIP.legs[0].t1 * (S2S.arrive - S2S.drawStart),
            },
            { name: TRIP.to, at: S2S.pickTo },
          ].map((stop) => {
            const shown = tween(frame, stop.at, 12, backOut);
            if (shown <= 0) return null;
            const [x, y] = stationPoint(stop.name);
            return (
              <circle
                key={stop.name}
                cx={x}
                cy={y}
                r={(11 * shown) / zoom}
                fill="#FFFFFF"
                stroke={C.ink}
                strokeWidth={5 / zoom}
              />
            );
          })}

          {/* arrival ripple and the moving head */}
          {frame >= S2S.arrive && frame < S2S.arrive + 24 ? (
            <circle
              cx={stationPoint(TRIP.to)[0]}
              cy={stationPoint(TRIP.to)[1]}
              r={(12 + tween(frame, S2S.arrive, 24, easeOut) * 60) / zoom}
              fill="none"
              stroke={C.red}
              strokeWidth={5 / zoom}
              opacity={1 - tween(frame, S2S.arrive, 24, easeOut)}
            />
          ) : null}
          {routeT > 0 && routeT < 1 ? (
            <g>
              <circle
                cx={head.x}
                cy={head.y}
                r={24 / zoom}
                fill={head.color}
                opacity={0.22}
              />
              <circle
                cx={head.x}
                cy={head.y}
                r={10 / zoom}
                fill="#FFFFFF"
                stroke={head.color}
                strokeWidth={6 / zoom}
              />
            </g>
          ) : null}

          <MapLabel
            name={TRIP.from}
            zoom={zoom}
            progress={tween(frame, S2S.pickFrom + 2, 10, easeOut)}
            dx={-24}
            dy={10}
            anchor="end"
          />
          <MapLabel
            name={TRIP.legs[0].to}
            zoom={zoom}
            progress={
              tween(
                frame,
                S2S.drawStart + TRIP.legs[0].t1 * (S2S.arrive - S2S.drawStart),
                10,
                easeOut,
              ) *
              (1 - colorMix)
            }
            dx={-22}
            dy={-22}
            anchor="end"
            note="换乘"
          />
          <MapLabel
            name={TRIP.to}
            zoom={zoom}
            progress={tween(frame, S2S.pickTo + 2, 10, easeOut)}
            dx={24}
            dy={10}
            anchor="start"
          />
        </MapCamera>

        <div
          style={{
            position: "absolute",
            left: 28,
            top: 24,
            fontFamily: F.zh,
            fontSize: 24,
            color: C.muted,
            background: "rgba(255, 253, 249, 0.86)",
            borderRadius: 12,
            padding: "6px 14px",
          }}
        >
          {factsMix > 0.5
            ? `上海地铁全网 · ${FACTS.lines} 条线路`
            : "线路图 · 高亮为官方推荐路径"}
        </div>
      </Card>

      <Cursor
        x={cursorX}
        y={cursorY}
        press={press}
        opacity={cursorOpacity}
        ripple={
          rippleFrom === undefined ? undefined : (frame - rippleFrom) / 14
        }
      />
    </SceneShift>
  );
};

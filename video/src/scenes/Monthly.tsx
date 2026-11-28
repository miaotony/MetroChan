import React from "react";
import { useCurrentFrame } from "remotion";
import {
  Card,
  Chip,
  LineDots,
  Num,
  SceneHeader,
  SceneShift,
  TitleSwap,
} from "../components/Bits";
import { Cursor } from "../components/Cursor";
import {
  bestPlanIndex,
  monthlyPlans,
  PASSES,
  singlesCost,
  stationLines,
  TRIP,
} from "../data";
import {
  backOut,
  easeInOut,
  easeOut,
  handOver,
  lerp,
  pulse,
  tween,
  yuan,
} from "../lib/anim";
import { ridesAt, ridesValueAt } from "../motion";
import { C, F } from "../theme";
import { BEAT, MONTHLY, RIDES, SCENES } from "../timeline";

const COL_X = 96;
const COL_W = 684;
const PANEL = { x: 846, y: 168, w: 978, h: 836 };
const PAD = 44;
const INNER = PANEL.w - PAD * 2;
const TRACK = { y: 238, min: 10, max: 70 };
const MAX_COST = 420;
const PRESETS = [
  { rides: 22, label: "单程通勤" },
  { rides: 44, label: "22 天往返" },
  { rides: 52, label: "26 天往返" },
  { rides: 60, label: "30 天往返" },
];
const GRID_COLS = 13;
const TOKEN = 50;
const TOKEN_GAP = 16;

const knobX = (frame: number) =>
  ((ridesValueAt(frame) - TRACK.min) / (TRACK.max - TRACK.min)) * INNER;

const Badge: React.FC<{
  children: React.ReactNode;
  background: string;
  color: string;
}> = ({ children, background, color }) => (
  <span
    style={{
      fontFamily: F.zh,
      fontSize: 22,
      fontWeight: 600,
      padding: "4px 12px",
      borderRadius: 10,
      background,
      color,
      marginLeft: 14,
    }}
  >
    {children}
  </span>
);

const EquationBlock: React.FC<{
  progress: number;
  width: number;
  label: string;
  formula: string;
  amount: string;
  background: string;
  color: string;
  sub: string;
}> = ({ progress, width, label, formula, amount, background, color, sub }) => (
  <div
    style={{
      width,
      height: 168,
      boxSizing: "border-box",
      borderRadius: 24,
      background,
      padding: "20px 24px",
      opacity: Math.min(1, progress * 1.6),
      scale: lerp(0.82, 1, progress),
    }}
  >
    <div
      style={{
        fontFamily: F.zh,
        fontSize: 28,
        fontWeight: 600,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: F.zh,
        fontSize: 22,
        color: sub,
        marginTop: 2,
        whiteSpace: "nowrap",
      }}
    >
      {formula}
    </div>
    <div style={{ marginTop: 10, color, whiteSpace: "nowrap" }}>
      <Num size={34} style={{ marginRight: 4 }}>
        ¥
      </Num>
      <Num size={64}>{amount}</Num>
    </div>
  </div>
);

const Operator: React.FC<{ progress: number; children: string }> = ({
  progress,
  children,
}) => (
  <div
    style={{
      width: 46,
      textAlign: "center",
      fontFamily: F.num,
      fontSize: 56,
      fontWeight: 700,
      color: C.faint,
      opacity: progress,
    }}
  >
    {children}
  </div>
);

export const Monthly: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.monthly.duration;
  const enter = tween(frame, 0, 18, easeOut);
  /* gone by the bar line, so the next chapter never overlaps this one */
  const exit = tween(frame, duration - 7, 10, easeInOut);

  const rides = ridesAt(frame);
  const plans = monthlyPlans(TRIP.fare, rides);
  const best = bestPlanIndex(plans);
  const bestPlan = plans[best];
  const single = singlesCost(TRIP.fare, rides);
  const saved = single - bestPlan.cost;

  /* how strongly each row is "the lowest", smoothed over a few frames */
  const weights = plans.map(() => 0);
  for (let back = 0; back < 6; back++) {
    weights[bestPlanIndex(monthlyPlans(TRIP.fare, ridesAt(frame - back)))] +=
      1 / 6;
  }
  const bestChanged = [1, 2, 3, 4, 5, 6, 7, 8].some(
    (back) =>
      bestPlanIndex(monthlyPlans(TRIP.fare, ridesAt(frame - back))) !== best,
  );

  const comboMix = tween(frame, MONTHLY.combo - 8, 16, easeInOut);
  const comboSwap = handOver(comboMix);
  const preset = PRESETS.find((item) => item.rides === rides);

  /* ---- cursor ---- */
  const knob = knobX(frame);
  const knobScreenX = PANEL.x + PAD + knob;
  const knobScreenY = PANEL.y + TRACK.y;
  const approach = tween(frame, MONTHLY.grab - 22, 22, easeInOut);
  const leave = tween(frame, MONTHLY.drag2End + 10, 20, easeInOut);
  const cursorX = lerp(PANEL.x + 620, knobScreenX + 4, approach) + leave * 120;
  const cursorY = lerp(PANEL.y + 560, knobScreenY + 6, approach) + leave * 150;
  const holding =
    (frame >= MONTHLY.grab && frame <= MONTHLY.drag1End + 6) ||
    (frame >= MONTHLY.drag2Start - 6 && frame <= MONTHLY.drag2End + 6);
  const press = holding ? 1 : 0;
  const cursorOpacity =
    tween(frame, MONTHLY.grab - 24, 10, easeOut) *
    (1 - tween(frame, MONTHLY.drag2End + 18, 12, easeOut));

  const calloutPulse = Math.max(
    pulse(frame, MONTHLY.callout, 3, 16),
    pulse(frame, MONTHLY.saving, 3, 16),
  );

  /* ---- combo breakdown ---- */
  const comboPlan = monthlyPlans(TRIP.fare, RIDES.combo);
  const comboBest = comboPlan[bestPlanIndex(comboPlan)];
  const nextPass = PASSES.find((pass) => pass.rides >= RIDES.combo);
  const gridW = GRID_COLS * TOKEN + (GRID_COLS - 1) * TOKEN_GAP;
  const eqIn = (offset: number) =>
    tween(frame, MONTHLY.equation + offset, 14, backOut);

  return (
    <SceneShift enter={enter} exit={exit}>
      <SceneHeader
        index={comboMix > 0.5 ? "03" : "02"}
        label={comboMix > 0.5 ? "组合价" : "月度通勤"}
        progress={tween(frame, 2, 16, easeOut)}
        titleProgress={tween(frame, 8, 18, easeOut)}
        title={
          <TitleSwap
            from="一个月，怎么坐最省"
            to="不凑整？帮你拼着买"
            mix={comboMix}
          />
        }
      />

      {/* ---------- left: the answer ---------- */}
      <div
        style={{
          position: "absolute",
          left: COL_X,
          top: 318,
          width: COL_W,
          height: 96,
          boxSizing: "border-box",
          borderRadius: 26,
          background: C.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          fontFamily: F.zh,
          fontSize: 40,
          fontWeight: 600,
          color: C.cream,
          opacity: tween(frame, 10, 16, easeOut),
        }}
      >
        <LineDots lines={stationLines(TRIP.from)} size={16} />
        {TRIP.from}
        <span style={{ color: C.red, fontWeight: 400 }}>→</span>
        <LineDots lines={stationLines(TRIP.to)} size={16} />
        {TRIP.to}
        <span
          style={{
            marginLeft: 10,
            paddingLeft: 24,
            borderLeft: "2px solid rgba(247, 239, 230, 0.25)",
            fontWeight: 500,
            fontSize: 34,
            color: "#CFC8BC",
          }}
        >
          单程 {TRIP.fare} 元
        </span>
      </div>

      <Card
        x={COL_X}
        y={438}
        w={COL_W}
        h={566}
        progress={tween(frame, 14, 20, easeOut)}
        style={{
          boxShadow: `0 40px 70px -42px rgba(70, 48, 16, 0.38), 0 0 0 ${
            calloutPulse * 10
          }px rgba(229, 50, 43, ${0.16 * calloutPulse})`,
        }}
      >
        <div style={{ padding: "40px 40px" }}>
          <div style={{ fontFamily: F.zh, fontSize: 30, color: C.muted }}>
            每月 {rides} 次，这样买最省
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: F.zh,
              fontSize: 50,
              fontWeight: 600,
              color: C.ink,
              whiteSpace: "nowrap",
              scale: bestChanged ? 1.02 : 1,
              transformOrigin: "left center",
            }}
          >
            {bestPlan.title}
            {bestPlan.combo ? (
              <span style={{ color: C.red }}> + {bestPlan.over} 次单程</span>
            ) : null}
          </div>
          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "baseline",
              color: C.red,
            }}
          >
            <Num size={84} style={{ marginRight: 10 }}>
              ¥
            </Num>
            <Num size={196}>{yuan(bestPlan.cost)}</Num>
          </div>
          <div
            style={{
              marginTop: 30,
              paddingTop: 28,
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
            {saved > 0.05 ? (
              <>
                <span>比全部刷单程，每月省</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    padding: "8px 20px 6px",
                    borderRadius: 18,
                    background: C.ink,
                    color: C.cream,
                    scale: 1 + calloutPulse * 0.08,
                  }}
                >
                  <Num size={30} style={{ marginRight: 4 }}>
                    ¥
                  </Num>
                  <Num size={48}>{yuan(saved)}</Num>
                </span>
              </>
            ) : (
              <span>次数还少，直接刷单程最划算</span>
            )}
          </div>
        </div>
      </Card>

      {/* ---------- right: the calculator ---------- */}
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
            left: PAD,
            top: 34,
            width: INNER,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontFamily: F.zh, fontSize: 28, color: C.muted }}>
              每月乘坐次数
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                marginTop: 2,
              }}
            >
              <Num size={124} color={C.ink}>
                {rides}
              </Num>
              <span
                style={{
                  fontFamily: F.zh,
                  fontSize: 40,
                  fontWeight: 500,
                  color: C.inkSoft,
                }}
              >
                次
              </span>
              {preset ? (
                <Chip
                  size={26}
                  background={C.redSoft}
                  border="transparent"
                  color={C.redDeep}
                  style={{ marginLeft: 12, translate: "0px -18px" }}
                >
                  = {preset.label}
                </Chip>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: F.zh,
              fontSize: 26,
              color: C.inkSoft,
              paddingBottom: 26,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: C.red,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={20} height={20} viewBox="0 0 20 20">
                <path
                  d="M4 10.5 L8.4 14.6 L16 5.8"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            已计入满 90 元后 9 折
          </div>
        </div>

        {/* slider + plan rows */}
        <div style={{ opacity: 1 - comboSwap.leave }}>
          <div
            style={{
              position: "absolute",
              left: PAD,
              top: TRACK.y - 7,
              width: INNER,
              height: 14,
              borderRadius: 7,
              background: C.paperDeep,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: PAD,
              top: TRACK.y - 7,
              width: knob,
              height: 14,
              borderRadius: 7,
              background: C.red,
            }}
          />
          {PRESETS.map((item) => {
            const x =
              ((item.rides - TRACK.min) / (TRACK.max - TRACK.min)) * INNER;
            const on = rides === item.rides;
            return (
              <React.Fragment key={item.rides}>
                <div
                  style={{
                    position: "absolute",
                    left: PAD + x - 2,
                    top: TRACK.y + 16,
                    width: 4,
                    height: 12,
                    borderRadius: 2,
                    background: on ? C.red : C.faint,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: PAD + x - 80,
                    top: TRACK.y + 32,
                    width: 160,
                    textAlign: "center",
                    fontFamily: F.zh,
                    fontSize: 22,
                    fontWeight: on ? 600 : 400,
                    color: on ? C.red : C.muted,
                  }}
                >
                  {item.label}
                </div>
              </React.Fragment>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: PAD + knob - 25,
              top: TRACK.y - 25,
              width: 50,
              height: 50,
              boxSizing: "border-box",
              borderRadius: 25,
              background: "#FFFFFF",
              border: `6px solid ${C.red}`,
              boxShadow: holding
                ? "0 0 0 12px rgba(229, 50, 43, 0.18), 0 8px 16px rgba(120, 20, 20, 0.28)"
                : "0 6px 14px rgba(120, 20, 20, 0.22)",
              scale: holding ? 1.12 : 1,
            }}
          />

          {plans.map((plan, i) => {
            const weight = weights[i];
            const top = 318 + i * 100;
            const fill = Math.min(1, plan.cost / MAX_COST);
            return (
              <div
                key={plan.key}
                style={{
                  position: "absolute",
                  left: PAD,
                  top,
                  width: INNER,
                  height: 88,
                  boxSizing: "border-box",
                  borderRadius: 22,
                  overflow: "hidden",
                  background: weight > 0.5 ? C.red : "#FFFFFF",
                  border: `2px solid ${weight > 0.5 ? C.red : C.hair}`,
                  scale: 1 + weight * 0.022,
                  boxShadow:
                    weight > 0.5
                      ? "0 22px 34px -18px rgba(200, 24, 36, 0.6)"
                      : undefined,
                  zIndex: weight > 0.5 ? 2 : 1,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${fill * 100}%`,
                    background:
                      weight > 0.5 ? "rgba(255, 255, 255, 0.16)" : "#F4EEE2",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 28,
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    fontFamily: F.zh,
                    fontSize: 34,
                    fontWeight: 600,
                    color: weight > 0.5 ? "#FFFFFF" : C.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.title}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 26,
                      marginLeft: 18,
                      color: weight > 0.5 ? "rgba(255,255,255,0.86)" : C.muted,
                    }}
                  >
                    {plan.detail}
                  </span>
                  {plan.combo ? (
                    <Badge
                      background={
                        weight > 0.5 ? "rgba(255,255,255,0.24)" : "#E9EDF0"
                      }
                      color={weight > 0.5 ? "#FFFFFF" : "#56606B"}
                    >
                      组合
                    </Badge>
                  ) : null}
                  {weight > 0.5 ? (
                    <Badge background="#FFFFFF" color={C.redDeep}>
                      最低
                    </Badge>
                  ) : null}
                </div>
                <div
                  style={{
                    position: "absolute",
                    right: 28,
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    color: weight > 0.5 ? "#FFFFFF" : C.ink,
                  }}
                >
                  <Num size={28} style={{ marginRight: 6, opacity: 0.8 }}>
                    ¥
                  </Num>
                  <Num size={50}>{yuan(plan.cost)}</Num>
                </div>
              </div>
            );
          })}
        </div>

        {/* combo breakdown */}
        {comboSwap.arrive > 0 ? (
          <div style={{ opacity: comboSwap.arrive }}>
            <div
              style={{
                position: "absolute",
                left: PAD,
                top: 214,
                width: INNER,
                display: "flex",
                justifyContent: "space-between",
                fontFamily: F.zh,
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  color: C.red,
                  opacity: tween(frame, MONTHLY.tokensPass, 12, easeOut),
                }}
              >
                ■ 前 {comboBest.pass} 次：一张计次票
              </span>
              <span
                style={{
                  color: C.ink,
                  opacity: tween(frame, MONTHLY.tokensSingle, 12, easeOut),
                }}
              >
                后 {comboBest.over} 次：刷单程 ■
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                left: PAD + (INNER - gridW) / 2,
                top: 270,
                width: gridW,
                display: "flex",
                flexWrap: "wrap",
                gap: TOKEN_GAP,
              }}
            >
              {Array.from({ length: RIDES.combo }, (_, i) => {
                const isPass = i < comboBest.pass;
                const start = isPass
                  ? MONTHLY.tokensPass + i * 1
                  : MONTHLY.tokensSingle + (i - comboBest.pass) * 4;
                const filled = tween(frame, start, 8, backOut);
                const appear = tween(frame, MONTHLY.combo + i * 0.25, 8);
                return (
                  <div
                    key={i}
                    style={{
                      width: TOKEN,
                      height: TOKEN,
                      boxSizing: "border-box",
                      borderRadius: 15,
                      border: `3px solid ${C.hair}`,
                      background: "#FFFFFF",
                      opacity: appear,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: 15,
                        background: isPass ? C.red : C.ink,
                        opacity: Math.min(1, filled * 1.5),
                        scale: lerp(0.4, 1, filled),
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div
              style={{
                position: "absolute",
                left: PAD,
                top: 552,
                width: INNER,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <EquationBlock
                progress={eqIn(0)}
                width={278}
                label={`计次票 ${comboBest.pass} 次`}
                formula="30 天内有效"
                amount={String(comboBest.passPrice)}
                background={C.redSoft}
                color={C.redDeep}
                sub="#B4574C"
              />
              <Operator progress={eqIn(BEAT / 2)}>+</Operator>
              <EquationBlock
                progress={eqIn(BEAT / 2)}
                width={278}
                label={`单程 ${comboBest.over} 次`}
                formula={`${comboBest.over} 次 × ${TRIP.fare} 元`}
                amount={String(comboBest.over * TRIP.fare)}
                background={C.paperDeep}
                color={C.ink}
                sub={C.muted}
              />
              <Operator progress={eqIn(BEAT)}>=</Operator>
              <EquationBlock
                progress={eqIn(BEAT)}
                width={242}
                label="合计"
                formula="本月最低"
                amount={String(comboBest.cost)}
                background={C.red}
                color="#FFFFFF"
                sub="rgba(255,255,255,0.8)"
              />
            </div>

            <div
              style={{
                position: "absolute",
                left: PAD,
                top: 752,
                width: INNER,
                display: "flex",
                gap: 14,
              }}
            >
              {[
                nextPass
                  ? {
                      text: `只买 ${nextPass.rides} 次票`,
                      cost: nextPass.price,
                    }
                  : null,
                {
                  text: "全部刷单程",
                  cost: singlesCost(TRIP.fare, RIDES.combo),
                },
              ].map((item, i) =>
                item ? (
                  <Chip
                    key={item.text}
                    size={26}
                    progress={tween(frame, MONTHLY.saving + i * 6, 12, backOut)}
                    background={C.paper}
                  >
                    {item.text} ¥{yuan(item.cost)}
                    <span style={{ color: C.red, fontWeight: 600 }}>
                      多花 ¥{yuan(item.cost - comboBest.cost)}
                    </span>
                  </Chip>
                ) : null,
              )}
            </div>
          </div>
        ) : null}
      </Card>

      <Cursor x={cursorX} y={cursorY} press={press} opacity={cursorOpacity} />
    </SceneShift>
  );
};

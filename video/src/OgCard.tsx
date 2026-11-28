import React from "react";
import { AbsoluteFill } from "remotion";
import { LineBadge, Num } from "./components/Bits";
import { LogoIcon, TrainFace } from "./components/Logo";
import { BaseNetwork, MapCamera } from "./components/NetworkMap";
import { QrModules } from "./components/Qr";
import { bestPlanIndex, FACTS, monthlyPlans, TRIP } from "./data";
import qr from "./qr.json";
import { CHIPS } from "./scenes/Cta";
import { C, F } from "./theme";
import { RIDES } from "./timeline";

/** Drawn on the film's grid; `scripts/og.ts` exports it at 1200×630. */
export const OG = { width: 1920, height: 1008 } as const;

const LEFT = 128;
const RIGHT = OG.width - LEFT;
const LOCKUP = { x: LEFT - 8, y: 56, size: 104 };
const BADGE_H = 60;
const HOST = new URL(qr.url).host;
const [YEAR, MONTH, DAY] = FACTS.effective.split("-");

/** The ticket: three worked answers for one trip, and a stub to scan. */
const ROW_H = 152;
const STUB_H = 282;
const NOTCH = 20;
const TICKET = { w: 692, y: 206, pad: 34, rows: ROW_H * 3 };
const QR_SIZE = 220;
/** Viewfinder corners around the code, clear of its quiet zone. */
const FINDER = { gap: 14, arm: 36, radius: 16 };
const FINDER_SIZE = QR_SIZE + FINDER.gap * 2;

const yuan = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** The cheapest way to pay for a month of the hero trip. */
const cheapest = (rides: number) => {
  const plans = monthlyPlans(TRIP.fare, rides);
  const best = plans[bestPlanIndex(plans)];
  return { rides, best, saved: plans[0].cost - best.cost };
};

const COMMUTE = cheapest(RIDES.commute);
const COMBO = cheapest(RIDES.combo);

const Delta: React.FC<{
  children: React.ReactNode;
  color: string;
  background: string;
}> = ({ children, color, background }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: 42,
      padding: "0 16px",
      borderRadius: 12,
      background,
      color,
      fontSize: 24,
      fontWeight: 600,
    }}
  >
    {children}
  </span>
);

/** One line of the ticket: what was asked on the left, the answer on the right. */
const Row: React.FC<{
  tag: string;
  about: string;
  figure: React.ReactNode;
  note: React.ReactNode;
  delta: React.ReactNode;
  first?: boolean;
}> = ({ tag, about, figure, note, delta, first = false }) => (
  <div
    style={{
      height: ROW_H,
      boxSizing: "border-box",
      margin: `0 ${TICKET.pad}px`,
      borderTop: first ? "none" : `2px solid ${C.hair}`,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 10,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", height: 68 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 46,
          padding: "0 18px",
          borderRadius: 23,
          background: C.red,
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        {tag}
      </span>
      <span
        style={{
          marginLeft: 16,
          fontSize: 31,
          fontWeight: 600,
          color: C.ink,
        }}
      >
        {about}
      </span>
      <span
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        {figure}
        <span style={{ fontSize: 32, fontWeight: 600, color: C.ink }}>元</span>
      </span>
    </div>
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
          gap: 10,
          fontSize: 25,
          color: C.muted,
        }}
      >
        {note}
      </span>
      {delta}
    </div>
  </div>
);

const Ticket: React.FC = () => {
  const tear = TICKET.rows;
  const hole = (side: string) =>
    `radial-gradient(circle ${NOTCH}px at ${side} ${tear}px, transparent ${NOTCH - 0.5}px, #000 ${NOTCH}px)`;
  return (
    <div
      style={{
        position: "absolute",
        left: RIGHT - TICKET.w,
        top: TICKET.y,
        width: TICKET.w,
        filter: "drop-shadow(0 46px 40px rgba(100, 0, 8, 0.42))",
      }}
    >
      <div
        style={{
          borderRadius: 40,
          background: C.card,
          fontFamily: F.zh,
          whiteSpace: "nowrap",
          maskImage: `${hole("0px")}, ${hole("100%")}`,
          maskComposite: "intersect",
        }}
      >
        <Row
          first
          tag="站到站"
          about={`${TRIP.from} → ${TRIP.to}`}
          figure={
            <>
              <Num size={68} color={C.faint}>
                {TRIP.oldFare}
              </Num>
              <svg
                width={40}
                height={36}
                viewBox="0 0 44 40"
                style={{ alignSelf: "center" }}
              >
                <path
                  d="M4 20 H36 M25 8 L37 20 L25 32"
                  fill="none"
                  stroke={C.faint}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Num size={68} color={C.ink}>
                {TRIP.fare}
              </Num>
            </>
          }
          note={
            <>
              {TRIP.km.toFixed(1)} 公里
              {TRIP.legs.map((leg) => (
                <LineBadge key={leg.line} line={leg.line} size={20} />
              ))}
            </>
          }
          delta={
            <Delta color={C.red} background={C.redSoft}>
              新票价 +{TRIP.fare - TRIP.oldFare} 元
            </Delta>
          }
        />
        {[
          { tag: "月度通勤", plan: COMMUTE },
          { tag: "组合价", plan: COMBO },
        ].map(({ tag, plan }) => (
          <Row
            key={tag}
            tag={tag}
            about={`每月 ${plan.rides} 次`}
            figure={
              <>
                <span style={{ fontSize: 25, color: C.muted }}>最省</span>
                <Num size={68} color={C.ink}>
                  {yuan(plan.best.cost)}
                </Num>
              </>
            }
            note={
              plan.best.combo
                ? `${plan.best.title} + ${plan.best.over} 次单程`
                : plan.best.title
            }
            delta={
              <Delta color={C.green} background="#E2F3EA">
                比单程省 {yuan(plan.saved)} 元
              </Delta>
            }
          />
        ))}

        <div
          style={{
            height: 0,
            margin: `0 ${NOTCH + 14}px`,
            borderTop: `4px dashed ${C.faint}`,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            height: STUB_H,
            boxSizing: "border-box",
            padding: `0 ${TICKET.pad}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontSize: 50, fontWeight: 600, color: C.ink }}>
                扫码直达
              </span>
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  background: C.red,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width={28} height={28} viewBox="0 0 40 40">
                  <path
                    d="M8 20 H31 M21 9 L32 20 L21 31"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={5.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: 28, color: C.muted }}>
              手机上一样好用
            </div>
          </div>
          <div
            style={{
              position: "relative",
              width: FINDER_SIZE,
              height: FINDER_SIZE,
              flexShrink: 0,
            }}
          >
            <svg
              width={QR_SIZE}
              height={QR_SIZE}
              viewBox={`0 0 ${qr.size} ${qr.size}`}
              shapeRendering="crispEdges"
              style={{
                position: "absolute",
                left: FINDER.gap,
                top: FINDER.gap,
              }}
            >
              <QrModules fill={C.ink} />
            </svg>
            <svg
              width={FINDER_SIZE}
              height={FINDER_SIZE}
              viewBox={`0 0 ${FINDER_SIZE} ${FINDER_SIZE}`}
              style={{ position: "absolute", left: 0, top: 0 }}
            >
              {[0, 90, 180, 270].map((turn) => (
                <path
                  key={turn}
                  d={`M3 ${FINDER.arm} V${FINDER.radius} A${FINDER.radius - 3} ${
                    FINDER.radius - 3
                  } 0 0 1 ${FINDER.radius} 3 H${FINDER.arm}`}
                  transform={`rotate(${turn} ${FINDER_SIZE / 2} ${FINDER_SIZE / 2})`}
                  fill="none"
                  stroke={C.red}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

/** The film's closing frame, reworked as the share card and README cover. */
export const OgCard: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(135deg, #F44338 0%, #E5322B 46%, #C9161F 100%)",
    }}
  >
    <AbsoluteFill style={{ opacity: 0.14 }}>
      <MapCamera
        width={OG.width}
        height={OG.height}
        cx={500}
        cy={640}
        zoom={1.74}
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

    <div style={{ position: "absolute", left: LOCKUP.x, top: LOCKUP.y }}>
      <TrainFace size={LOCKUP.size} />
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
        color: "#FFFFFF",
      }}
    >
      <span
        style={{
          fontFamily: F.latin,
          fontWeight: 700,
          fontSize: 56,
          letterSpacing: "-0.02em",
        }}
      >
        MetroChan
      </span>
      <span
        style={{
          fontFamily: F.zh,
          fontWeight: 600,
          fontSize: 44,
          marginLeft: 22,
        }}
      >
        魔都地铁酱
      </span>
    </div>

    <div
      style={{
        position: "absolute",
        right: LEFT,
        top: LOCKUP.y + (LOCKUP.size - BADGE_H) / 2,
        height: BADGE_H,
        display: "flex",
        borderRadius: BADGE_H / 2,
        overflow: "hidden",
        fontFamily: F.zh,
        fontWeight: 600,
        fontSize: 30,
        whiteSpace: "nowrap",
        boxShadow: "0 20px 36px -22px rgba(100, 0, 8, 0.8)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 20px 0 26px",
          background: C.cream,
          color: C.red,
        }}
      >
        上海地铁新票价
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0 26px 0 20px",
          background: "rgba(110, 0, 8, 0.42)",
          color: C.cream,
        }}
      >
        {YEAR}.{MONTH}.{DAY} 起
      </span>
    </div>

    <div
      style={{
        position: "absolute",
        left: LEFT,
        top: 190,
        fontFamily: F.zh,
        fontWeight: 600,
        fontSize: 146,
        lineHeight: 1.18,
        letterSpacing: "-0.02em",
        color: "#FFFFFF",
        whiteSpace: "nowrap",
      }}
    >
      <div>你的那一趟，</div>
      <div>
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
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        left: LEFT,
        top: 566,
        fontFamily: F.zh,
        fontWeight: 500,
        fontSize: 40,
        color: C.cream,
        whiteSpace: "nowrap",
      }}
    >
      票价、路线、每月最省的买法，一页算清
    </div>

    <div
      style={{
        position: "absolute",
        left: LEFT,
        top: 650,
        height: 110,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 22,
        padding: "0 18px",
        borderRadius: 55,
        background: C.card,
        boxShadow: "0 30px 50px -24px rgba(110, 0, 8, 0.7)",
      }}
    >
      <LogoIcon size={74} id="og" shadow={false} />
      <span
        style={{
          fontFamily: F.latin,
          fontWeight: 700,
          fontSize: 54,
          letterSpacing: "-0.015em",
          color: C.ink,
          whiteSpace: "nowrap",
        }}
      >
        {HOST}
      </span>
      <span
        style={{
          width: 74,
          height: 74,
          borderRadius: 37,
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
        top: 796,
        display: "flex",
        gap: 14,
      }}
    >
      {CHIPS.map((text) => (
        <span
          key={text}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 58,
            padding: "0 24px",
            borderRadius: 29,
            background: "rgba(255, 255, 255, 0.16)",
            border: "2px solid rgba(255, 255, 255, 0.36)",
            fontFamily: F.zh,
            fontSize: 27,
            fontWeight: 500,
            color: "#FFFFFF",
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </span>
      ))}
    </div>

    <div
      style={{
        position: "absolute",
        left: LEFT,
        top: 904,
        fontFamily: F.zh,
        fontSize: 24,
        color: C.cream,
        opacity: 0.74,
        whiteSpace: "nowrap",
      }}
    >
      个人整理的非官方工具 · 票价以官方为准 · 数据取自 {FACTS.capturedAt}{" "}
      官方票价查询
    </div>

    <Ticket />
  </AbsoluteFill>
);

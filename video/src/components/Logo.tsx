import React from "react";
import { C } from "../theme";

const FACE_OUTLINE =
  "M169 425 193 382H161C141 382 127 368 127 348V207C127 151 159 113 215 113H297C353 113 385 151 385 207V348C385 368 371 382 351 382H319L343 425";

type FaceProps = {
  color: string;
  /** 0 = eyes open, 1 = eyes closed. */
  blink?: number;
  /** 0–1, how much of the outline is drawn. */
  draw?: number;
};

const Face: React.FC<FaceProps> = ({ color, blink = 0, draw = 1 }) => {
  const eye = 19 * (1 - blink * 0.86);
  return (
    <>
      <path
        d={FACE_OUTLINE}
        fill="none"
        stroke={color}
        strokeWidth={32}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
        opacity={draw > 0.001 ? 1 : 0}
      />
      <path
        d="M221 289Q256 312 291 289"
        fill="none"
        stroke={color}
        strokeWidth={26}
        strokeLinecap="round"
        opacity={draw}
      />
      <ellipse cx={211} cy={242} rx={19} ry={eye} fill={color} opacity={draw} />
      <ellipse cx={301} cy={242} rx={19} ry={eye} fill={color} opacity={draw} />
    </>
  );
};

/** The app icon: the train face on its rounded red tile. */
export const LogoIcon: React.FC<{
  size: number;
  blink?: number;
  id?: string;
  shadow?: boolean;
}> = ({ size, blink = 0, id = "logo", shadow = true }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    style={{
      display: "block",
      overflow: "visible",
      filter: shadow
        ? `drop-shadow(0 ${size * 0.08}px ${size * 0.12}px rgba(200, 24, 36, 0.28))`
        : undefined,
    }}
  >
    <defs>
      <linearGradient id={`${id}-red`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F44338" />
        <stop offset=".55" stopColor="#EE322B" />
        <stop offset="1" stopColor="#D81924" />
      </linearGradient>
      <radialGradient id={`${id}-gloss`} cx=".24" cy=".12" r=".82">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".22" />
        <stop offset=".55" stopColor="#FFFFFF" stopOpacity=".04" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="512" height="512" rx="118" fill={`url(#${id}-red)`} />
    <rect width="512" height="512" rx="118" fill={`url(#${id}-gloss)`} />
    <path
      d="M183 170Q256 141 329 170"
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={0.24}
      strokeWidth={9}
      strokeLinecap="round"
    />
    <Face color={C.cream} blink={blink} />
  </svg>
);

/** Just the face, for drawing straight onto a coloured background. */
export const TrainFace: React.FC<{
  size: number;
  color?: string;
  blink?: number;
  draw?: number;
}> = ({ size, color = C.cream, blink = 0, draw = 1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="96 82 320 374"
    style={{ display: "block", overflow: "visible" }}
  >
    <Face color={color} blink={blink} draw={draw} />
  </svg>
);

/** Blink amount (0–1) for a blink centred on `center`. */
export const blinkAt = (frame: number, center: number) => {
  const distance = Math.abs(frame - center);
  return distance >= 4 ? 0 : 1 - distance / 4;
};

import React from "react";

/** A pointer whose hot spot sits exactly on (x, y). */
export const Cursor: React.FC<{
  x: number;
  y: number;
  /** 0–1: how far the button is pressed. */
  press?: number;
  opacity?: number;
  /** 0–1 progress of a click ripple, or undefined for none. */
  ripple?: number;
  rippleColor?: string;
}> = ({ x, y, press = 0, opacity = 1, ripple, rippleColor = "#E5322B" }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 0,
      height: 0,
      opacity,
      zIndex: 50,
    }}
  >
    {ripple !== undefined && ripple > 0 && ripple < 1 ? (
      <div
        style={{
          position: "absolute",
          left: -44,
          top: -44,
          width: 88,
          height: 88,
          borderRadius: 44,
          border: `4px solid ${rippleColor}`,
          scale: 0.3 + ripple * 0.9,
          opacity: (1 - ripple) * 0.8,
        }}
      />
    ) : null}
    <svg
      width={52}
      height={60}
      viewBox="0 0 26 30"
      style={{
        position: "absolute",
        left: -6,
        top: -4,
        overflow: "visible",
        scale: 1 - press * 0.14,
        transformOrigin: "6px 4px",
        filter: "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.28))",
      }}
    >
      <path
        d="M3 2 L3 23.5 L8.6 18.4 L12.4 27.2 L16.2 25.6 L12.5 17 L20 17 Z"
        fill="#17171A"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

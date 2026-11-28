import React from "react";
import { BASE_PATH, NETWORK } from "../data";

export const MAP_W = 1000;
export const MAP_H = 1400;

/**
 * The real Shanghai network, drawn from data/official/map.bin.
 * `radius` grows the coloured lines outward from People's Square.
 */
export const ColorNetwork: React.FC<{
  radius: number;
  strokeWidth: number;
  opacity?: number;
  mono?: string;
}> = ({ radius, strokeWidth, opacity = 1, mono }) => (
  <g
    fill="none"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={opacity}
  >
    {NETWORK.segments.map((segment, i) => {
      const progress = (radius - segment.start) / segment.length;
      if (progress <= 0) return null;
      const shown = Math.min(1, progress);
      return (
        <path
          key={i}
          d={segment.d}
          stroke={mono ?? segment.color}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - shown}
        />
      );
    })}
  </g>
);

export const StationDots: React.FC<{
  radius: number;
  r: number;
  fill: string;
  stroke: string;
  opacity?: number;
}> = ({ radius, r, fill, stroke, opacity = 1 }) => (
  <g opacity={opacity}>
    {NETWORK.stations.map((station) => {
      if (!station.interchange || station.dist > radius) return null;
      const pop = Math.min(1, (radius - station.dist) / 40);
      return (
        <circle
          key={station.name}
          cx={station.x}
          cy={station.y}
          r={r * pop}
          fill={fill}
          stroke={stroke}
          strokeWidth={r * 0.5}
        />
      );
    })}
  </g>
);

/** The neutral base map used behind a highlighted route. */
export const BaseNetwork: React.FC<{
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}> = ({ stroke, strokeWidth, opacity = 1 }) => (
  <path
    d={BASE_PATH}
    fill="none"
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={opacity}
  />
);

/**
 * A camera over the 1000×1400 map: `cx, cy` is the map point shown at the
 * centre of the viewport and `zoom` is screen pixels per map unit.
 */
export const MapCamera: React.FC<{
  width: number;
  height: number;
  cx: number;
  cy: number;
  zoom: number;
  children: React.ReactNode;
}> = ({ width, height, cx, cy, zoom, children }) => {
  const viewW = width / zoom;
  const viewH = height / zoom;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`}
      style={{ display: "block", position: "absolute", left: 0, top: 0 }}
    >
      {children}
    </svg>
  );
};

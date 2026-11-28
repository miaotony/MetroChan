import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";

/** The warm paper every daylight scene sits on. */
export const Paper: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(1200px 800px at 82% 8%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 70%), radial-gradient(1100px 760px at 4% 100%, rgba(229, 50, 43, 0.07), rgba(229, 50, 43, 0) 70%)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage:
          "radial-gradient(rgba(23, 23, 26, 0.09) 1.6px, rgba(23, 23, 26, 0) 1.7px)",
        backgroundSize: "36px 36px",
        backgroundPosition: "18px 18px",
        opacity: 0.55,
      }}
    />
    {children}
  </AbsoluteFill>
);

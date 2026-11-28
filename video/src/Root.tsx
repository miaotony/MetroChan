import React from "react";
import { Composition, Still } from "remotion";
import { Film } from "./Film";
import { OG, OgCard } from "./OgCard";
import { DURATION, FPS, HEIGHT, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MetroChanIntro"
      component={Film}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Still id="OgCard" component={OgCard} width={OG.width} height={OG.height} />
  </>
);

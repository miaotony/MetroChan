import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Chrome } from "./components/Chrome";
import { Paper } from "./components/Paper";
import { Anywhere } from "./scenes/Anywhere";
import { Cta } from "./scenes/Cta";
import { Distance } from "./scenes/Distance";
import { Hook } from "./scenes/Hook";
import { Monthly } from "./scenes/Monthly";
import { StationToStation } from "./scenes/StationToStation";
import { Title } from "./scenes/Title";
import { OVERLAP, SCENES } from "./timeline";

export const Film: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Paper />
      <Sequence
        from={SCENES.hook.from}
        durationInFrames={SCENES.hook.duration + OVERLAP}
      >
        <Hook />
      </Sequence>
      <Sequence
        from={SCENES.s2s.from}
        durationInFrames={SCENES.s2s.duration + OVERLAP}
      >
        <StationToStation />
      </Sequence>
      <Sequence
        from={SCENES.monthly.from}
        durationInFrames={SCENES.monthly.duration + OVERLAP}
      >
        <Monthly />
      </Sequence>
      <Sequence
        from={SCENES.distance.from}
        durationInFrames={SCENES.distance.duration + OVERLAP}
      >
        <Distance />
      </Sequence>
      <Sequence
        from={SCENES.title.from}
        durationInFrames={SCENES.title.duration + OVERLAP}
      >
        <Title />
      </Sequence>
      <Chrome frame={frame} dark={0} />
      {/* 随身用 flips to the dark theme, so it carries its own top bar. */}
      <Sequence
        from={SCENES.anywhere.from}
        durationInFrames={SCENES.anywhere.duration + OVERLAP}
      >
        <Anywhere />
      </Sequence>
      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
        <Cta />
      </Sequence>
      <Audio src={staticFile("metrochan-beat.mp3")} />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, useVideoConfig } from "remotion";

import { ClosingScene } from "./scenes/ClosingScene";
import { HeroScene } from "./scenes/HeroScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { RoutineScene } from "./scenes/RoutineScene";
import { SolutionScene } from "./scenes/SolutionScene";

export const PdevlogPromo = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "oklch(0.16 0.006 285)" }}>
      <HeroScene
        name="Hero"
        from={0}
        durationInFrames={130}
        premountFor={fps}
      />
      <ProblemScene
        name="Problem"
        from={130}
        durationInFrames={130}
        premountFor={fps}
      />
      <SolutionScene
        name="Solution"
        from={260}
        durationInFrames={150}
        premountFor={fps}
      />
      <RoutineScene
        name="Routine"
        from={410}
        durationInFrames={110}
        premountFor={fps}
      />
      <ClosingScene
        name="Closing"
        from={520}
        durationInFrames={80}
        premountFor={fps}
      />
    </AbsoluteFill>
  );
};

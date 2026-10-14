import { Composition, Folder } from "remotion";

import { PdevlogIntro } from "./PdevlogIntro";
import { PdevlogPromo } from "./PdevlogPromo";
import { ClosingScene } from "./scenes/ClosingScene";
import { HeroScene } from "./scenes/HeroScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { RoutineScene } from "./scenes/RoutineScene";
import { SolutionScene } from "./scenes/SolutionScene";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="PdevlogIntro"
        component={PdevlogIntro}
        durationInFrames={60}
        fps={30}
        width={1920}
        height={1080}
      />
      <Folder name="Scenes">
        <Composition
          id="HeroScene"
          component={HeroScene}
          durationInFrames={130}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ProblemScene"
          component={ProblemScene}
          durationInFrames={130}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="SolutionScene"
          component={SolutionScene}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="RoutineScene"
          component={RoutineScene}
          durationInFrames={110}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ClosingScene"
          component={ClosingScene}
          durationInFrames={80}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <Composition
        id="PdevlogPromo"
        component={PdevlogPromo}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

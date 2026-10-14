import "@fontsource-variable/geist";

import type { FC } from "react";
import {
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";

const HeroSceneInner: FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      <Interactive.Div
        name="Scene background"
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "oklch(0.16 0.006 285)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
          justifyContent: "center",
          padding: 120,
          textAlign: "center",
        }}>
        <Img
          name="App icon"
          src={staticFile("pdevlog-icon.png")}
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            opacity: interpolate(frame, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [0, 16], [0.8, 1], {
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
        <Interactive.Div
          name="Eyebrow pill"
          style={{
            marginTop: 36,
            border: "1px solid oklch(1 0 0 / 15%)",
            borderRadius: 999,
            color: "oklch(0.71 0.01 285)",
            fontSize: 28,
            opacity: interpolate(frame, [6, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            padding: "14px 32px",
            translate: interpolate(frame, [6, 24], ["0px 30px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          For Solo Developers &amp; Engineers Outside the Unicorn Startup Bubble
        </Interactive.Div>
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: 32,
            color: "oklch(0.95 0.005 285)",
            fontSize: 116,
            fontWeight: 600,
            letterSpacing: "-4px",
            lineHeight: 1.05,
            maxWidth: 1700,
            opacity: interpolate(frame, [12, 32], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [12, 32], ["0px 40px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Stop Repeating 1 Year of Experience{" "}
          <span style={{ color: "oklch(0.78 0.13 135)" }}>5 Times Over.</span>
        </Interactive.Div>
        <Interactive.Div
          name="Subheadline"
          style={{
            marginTop: 28,
            color: "oklch(0.71 0.01 285)",
            fontSize: 44,
            lineHeight: 1.4,
            maxWidth: 1220,
            opacity: interpolate(frame, [20, 40], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [20, 40], ["0px 40px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          pdevlog is your personal Autonomous Tech Lead and Career Vault — turn
          daily work into real proof of impact.
        </Interactive.Div>
        <Interactive.Div
          name="Trust points"
          style={{
            marginTop: 40,
            display: "flex",
            gap: 44,
            color: "oklch(0.71 0.01 285)",
            fontSize: 28,
            opacity: interpolate(frame, [28, 48], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [28, 48], ["0px 30px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          <span>
            <span style={{ color: "oklch(0.78 0.13 135)" }}>✓</span> Your data
            stays private to you
          </span>
          <span>
            <span style={{ color: "oklch(0.78 0.13 135)" }}>✓</span> No monthly
            fees
          </span>
          <span>
            <span style={{ color: "oklch(0.78 0.13 135)" }}>✓</span> Export
            Markdown anytime
          </span>
        </Interactive.Div>
      </div>
    </>
  );
};

const heroSceneSchema = {} as const satisfies InteractivitySchema;

export const HeroScene = Interactive.withSchema({
  Component: HeroSceneInner,
  componentName: "HeroScene",
  schema: heroSceneSchema,
  wrapInSequence: true,
  layout: "absolute-fill",
});

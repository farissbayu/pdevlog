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

const ClosingSceneInner: FC = () => {
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
          padding: 140,
          textAlign: "center",
        }}>
        <Img
          name="App icon"
          src={staticFile("pdevlog-icon.png")}
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            opacity: interpolate(frame, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [0, 12], [0.8, 1], {
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: 48,
            color: "oklch(0.95 0.005 285)",
            fontSize: 116,
            fontWeight: 600,
            letterSpacing: "-4px",
            lineHeight: 1.05,
            maxWidth: 1520,
            opacity: interpolate(frame, [6, 22], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [6, 22], ["0px 40px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Control of Your Career Is Too Valuable to Leave to Office Luck.
        </Interactive.Div>
        <Interactive.Div
          name="Subheadline"
          style={{
            marginTop: 36,
            color: "oklch(0.71 0.01 285)",
            fontSize: 44,
            lineHeight: 1.4,
            maxWidth: 1080,
            opacity: interpolate(frame, [14, 30], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [14, 30], ["0px 32px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Start building an irrefutable professional track record today.
        </Interactive.Div>
        <Interactive.Div
          name="CTA"
          style={{
            marginTop: 56,
            backgroundColor: "oklch(0.78 0.13 135)",
            borderRadius: 999,
            color: "oklch(0.22 0.04 140)",
            fontSize: 38,
            fontWeight: 600,
            opacity: interpolate(frame, [22, 38], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            padding: "26px 52px",
            scale: interpolate(frame, [22, 38], [0.9, 1], {
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Start Your Personal Dev Log Now — Free
        </Interactive.Div>
        <Interactive.Div
          name="Footer line"
          style={{
            marginTop: 40,
            color: "oklch(0.71 0.01 285)",
            fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
            fontSize: 28,
            opacity: interpolate(frame, [34, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          pdevlog · Built for developers who keep track
        </Interactive.Div>
      </div>
    </>
  );
};

const closingSceneSchema = {} as const satisfies InteractivitySchema;

export const ClosingScene = Interactive.withSchema({
  Component: ClosingSceneInner,
  componentName: "ClosingScene",
  schema: closingSceneSchema,
  wrapInSequence: true,
  layout: "absolute-fill",
});

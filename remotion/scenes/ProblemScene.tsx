import "@fontsource-variable/geist";

import type { FC } from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";

const ProblemSceneInner: FC = () => {
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
          display: "flex",
          flexDirection: "column",
          fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
          justifyContent: "center",
          padding: 140,
        }}>
        <Interactive.Div
          name="Eyebrow"
          style={{
            alignSelf: "center",
            color: "oklch(0.78 0.13 135)",
            fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
            fontSize: 28,
            letterSpacing: 4,
            opacity: interpolate(frame, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            textTransform: "uppercase",
            translate: interpolate(frame, [0, 16], ["0px 24px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          A reality rarely talked about
        </Interactive.Div>
        <Interactive.Div
          name="Title"
          style={{
            alignSelf: "center",
            marginTop: 28,
            color: "oklch(0.95 0.005 285)",
            fontSize: 80,
            fontWeight: 600,
            letterSpacing: "-2px",
            lineHeight: 1.12,
            maxWidth: 1400,
            opacity: interpolate(frame, [8, 26], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            textAlign: "center",
            translate: interpolate(frame, [8, 26], ["0px 32px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Stuck in an Office Where &ldquo;As Long As It Runs&rdquo; Is the
          Standard?
        </Interactive.Div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            marginTop: 72,
          }}>
          <Interactive.Div
            name="Problem 1"
            style={{
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 20,
              padding: "36px 40px",
              opacity: interpolate(frame, [24, 40], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [24, 40],
                ["0px 40px", "0px 0px"],
                {
                  easing: Easing.out(Easing.cubic),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              ),
            }}>
            <div
              style={{
                color: "oklch(0.71 0.01 285)",
                fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
                fontSize: 28,
              }}>
              01
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 40,
                fontWeight: 500,
                lineHeight: 1.25,
              }}>
              Your Work Just Cycles Through the Same CRUD Forms
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Problem 2"
            style={{
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 20,
              padding: "36px 40px",
              opacity: interpolate(frame, [32, 48], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [32, 48],
                ["0px 40px", "0px 0px"],
                {
                  easing: Easing.out(Easing.cubic),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              ),
            }}>
            <div
              style={{
                color: "oklch(0.71 0.01 285)",
                fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
                fontSize: 28,
              }}>
              02
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 40,
                fontWeight: 500,
                lineHeight: 1.25,
              }}>
              When It&rsquo;s Time to Update Your CV, You Forget What You Built
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Problem 3"
            style={{
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 20,
              padding: "36px 40px",
              opacity: interpolate(frame, [40, 56], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [40, 56],
                ["0px 40px", "0px 0px"],
                {
                  easing: Easing.out(Easing.cubic),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              ),
            }}>
            <div
              style={{
                color: "oklch(0.71 0.01 285)",
                fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
                fontSize: 28,
              }}>
              03
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 40,
                fontWeight: 500,
                lineHeight: 1.25,
              }}>
              You Want to Learn New Tech, But Lose Hours to Videos
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Problem 4"
            style={{
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 20,
              padding: "36px 40px",
              opacity: interpolate(frame, [48, 64], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [48, 64],
                ["0px 40px", "0px 0px"],
                {
                  easing: Easing.out(Easing.cubic),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              ),
            }}>
            <div
              style={{
                color: "oklch(0.71 0.01 285)",
                fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
                fontSize: 28,
              }}>
              04
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 40,
                fontWeight: 500,
                lineHeight: 1.25,
              }}>
              No Tech Lead Is Correcting Your Career Direction
            </div>
          </Interactive.Div>
        </div>
      </div>
    </>
  );
};

const problemSceneSchema = {} as const satisfies InteractivitySchema;

export const ProblemScene = Interactive.withSchema({
  Component: ProblemSceneInner,
  componentName: "ProblemScene",
  schema: problemSceneSchema,
  wrapInSequence: true,
  layout: "absolute-fill",
});

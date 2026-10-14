import "@fontsource-variable/geist";

import type { FC } from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";

const RoutineSceneInner: FC = () => {
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
          Low-friction habit
        </Interactive.Div>
        <Interactive.Div
          name="Title"
          style={{
            alignSelf: "center",
            marginTop: 24,
            color: "oklch(0.95 0.005 285)",
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: "-2px",
            lineHeight: 1.12,
            maxWidth: 1560,
            opacity: interpolate(frame, [6, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            textAlign: "center",
            translate: interpolate(frame, [6, 24], ["0px 32px", "0px 0px"], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}>
          Not a Burdensome Diary. A 5-Minute System That Flows With Your Code.
        </Interactive.Div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "56px 80px",
            marginTop: 88,
          }}>
          <Interactive.Div
            name="Routine — While Coding"
            style={{
              borderTop: "1px solid oklch(1 0 0 / 15%)",
              paddingTop: 28,
              opacity: interpolate(frame, [20, 36], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [20, 36],
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
                fontSize: 26,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}>
              While Coding · 10 seconds
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 42,
                fontWeight: 500,
              }}>
              Capture ideas without breaking flow
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Routine — End of Workday"
            style={{
              borderTop: "1px solid oklch(1 0 0 / 15%)",
              paddingTop: 28,
              opacity: interpolate(frame, [28, 44], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [28, 44],
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
                fontSize: 26,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}>
              End of Workday · 3-5 minutes
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 42,
                fontWeight: 500,
              }}>
              Draft one brag log
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Routine — Weekend"
            style={{
              borderTop: "1px solid oklch(1 0 0 / 15%)",
              paddingTop: 28,
              opacity: interpolate(frame, [36, 52], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [36, 52],
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
                fontSize: 26,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}>
              Weekend · 20 minutes
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 42,
                fontWeight: 500,
              }}>
              Clear the inbox &amp; shred one skill
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Routine — End of Month"
            style={{
              borderTop: "1px solid oklch(1 0 0 / 15%)",
              paddingTop: 28,
              opacity: interpolate(frame, [44, 60], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [44, 60],
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
                fontSize: 26,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}>
              End of Month · 30 minutes
            </div>
            <div
              style={{
                marginTop: 12,
                color: "oklch(0.95 0.005 285)",
                fontSize: 42,
                fontWeight: 500,
              }}>
              Re-analyze &amp; set targets
            </div>
          </Interactive.Div>
        </div>
      </div>
    </>
  );
};

const routineSceneSchema = {} as const satisfies InteractivitySchema;

export const RoutineScene = Interactive.withSchema({
  Component: RoutineSceneInner,
  componentName: "RoutineScene",
  schema: routineSceneSchema,
  wrapInSequence: true,
  layout: "absolute-fill",
});

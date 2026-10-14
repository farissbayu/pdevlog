import "@fontsource-variable/geist";

import type { FC } from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  type InteractivitySchema,
} from "remotion";

const SolutionSceneInner: FC = () => {
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
          Transformative solutions
        </Interactive.Div>
        <Interactive.Div
          name="Title"
          style={{
            alignSelf: "center",
            marginTop: 24,
            color: "oklch(0.95 0.005 285)",
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: "-2px",
            lineHeight: 1.12,
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
          How pdevlog Solves Each Problem Above
        </Interactive.Div>
        <div
          style={{
            display: "flex",
            gap: 36,
            justifyContent: "center",
            marginTop: 72,
          }}>
          <Interactive.Div
            name="Card — Brag Logs + AI STAR"
            style={{
              width: 500,
              height: 620,
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 24,
              padding: 44,
              opacity: interpolate(frame, [24, 42], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [24, 42], [0.92, 1], {
                easing: Easing.spring({ damping: 200 }),
                output: "perceptual-scale",
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}>
            <span
              style={{
                border: "1px solid rgba(52, 211, 153, 0.35)",
                borderRadius: 999,
                color: "#34d399",
                fontSize: 26,
                padding: "10px 22px",
              }}>
              Brag Logs + AI STAR
            </span>
            <div
              style={{
                marginTop: 32,
                color: "oklch(0.95 0.005 285)",
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1.2,
              }}>
              From a rough technical rant to a high-value impact portfolio.
            </div>
            <div
              style={{
                marginTop: 36,
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.3)",
                borderRadius: 14,
                color: "#34d399",
                fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
                fontSize: 28,
                lineHeight: 1.5,
                padding: "20px 24px",
              }}>
              Result: p95 latency −94% (800ms → 45ms)
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Card — Skill Shredder"
            style={{
              width: 500,
              height: 620,
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 24,
              padding: 44,
              opacity: interpolate(frame, [38, 56], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [38, 56], [0.92, 1], {
                easing: Easing.spring({ damping: 200 }),
                output: "perceptual-scale",
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}>
            <span
              style={{
                border: "1px solid rgba(129, 140, 248, 0.35)",
                borderRadius: 999,
                color: "#818cf8",
                fontSize: 26,
                padding: "10px 22px",
              }}>
              Skill Shredder
            </span>
            <div
              style={{
                marginTop: 32,
                color: "oklch(0.95 0.005 285)",
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1.2,
              }}>
              Break through new-tech fear in 60 minutes.
            </div>
            <div
              style={{
                marginTop: 36,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                color: "oklch(0.71 0.01 285)",
                fontSize: 28,
              }}>
              <span
                style={{
                  border: "1px solid oklch(1 0 0 / 15%)",
                  borderRadius: 999,
                  padding: "12px 26px",
                }}>
                Spike 0 · 15 min
              </span>
              <span
                style={{
                  border: "1px solid oklch(1 0 0 / 15%)",
                  borderRadius: 999,
                  padding: "12px 26px",
                }}>
                Ignore List
              </span>
              <span
                style={{
                  border: "1px solid oklch(1 0 0 / 15%)",
                  borderRadius: 999,
                  padding: "12px 26px",
                }}>
                TIL note
              </span>
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Card — AI Staff Engineer Mirror"
            style={{
              width: 500,
              height: 620,
              backgroundColor: "oklch(0.21 0.006 285)",
              border: "1px solid oklch(1 0 0 / 12%)",
              borderRadius: 24,
              padding: 44,
              opacity: interpolate(frame, [52, 70], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame, [52, 70], [0.92, 1], {
                easing: Easing.spring({ damping: 200 }),
                output: "perceptual-scale",
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}>
            <span
              style={{
                border: "1px solid rgba(167, 139, 250, 0.35)",
                borderRadius: 999,
                color: "#a78bfa",
                fontSize: 26,
                padding: "10px 22px",
              }}>
              AI Staff Engineer Mirror
            </span>
            <div
              style={{
                marginTop: 32,
                color: "oklch(0.95 0.005 285)",
                fontSize: 44,
                fontWeight: 600,
                lineHeight: 1.2,
              }}>
              An objective mirror without RPG points.
            </div>
            <div
              style={{
                marginTop: 36,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                color: "oklch(0.71 0.01 285)",
                fontSize: 30,
              }}>
              <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: "#a78bfa",
                    borderRadius: 999,
                  }}
                />
                Core Superpowers
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: "#a78bfa",
                    borderRadius: 999,
                  }}
                />
                Growth Gaps
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: "#a78bfa",
                    borderRadius: 999,
                  }}
                />
                Next Steps
              </span>
            </div>
          </Interactive.Div>
        </div>
      </div>
    </>
  );
};

const solutionSceneSchema = {} as const satisfies InteractivitySchema;

export const SolutionScene = Interactive.withSchema({
  Component: SolutionSceneInner,
  componentName: "SolutionScene",
  schema: solutionSceneSchema,
  wrapInSequence: true,
  layout: "absolute-fill",
});

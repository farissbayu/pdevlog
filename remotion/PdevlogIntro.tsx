import "@fontsource-variable/geist";

import { AbsoluteFill } from "remotion";

export const PdevlogIntro = () => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#18181b",
        color: "#fafafa",
        fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
        gap: 24,
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 160, fontWeight: 600, letterSpacing: -6 }}>
        pdevlog
      </div>
      <div style={{ color: "#a1a1aa", fontSize: 44 }}>
        A private dev log for software engineers.
      </div>
    </AbsoluteFill>
  );
};

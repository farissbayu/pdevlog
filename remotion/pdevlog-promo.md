# pdevlog — Landing Promo (Remotion)

Script/storyboard for the `PdevlogPromo` composition. All copy is taken from the
landing page (`src/client/features/landing/landing-page.tsx`), tightened for
video pacing.

- Format: 1920×1080, 30fps, 600 frames (20s)
- Theme: app dark theme (`oklch(0.16 0.006 285)` background, lime `oklch(0.78 0.13 135)` primary)
- Typography: Geist Variable (`@fontsource-variable/geist`), mono labels in Geist Mono
- Each scene is its own file under `remotion/scenes/` and is registered as a
  connected composition, so it can be opened in its own timeline.

## Scene map

| # | Scene    | Composition id | Frames | Time      | Landing section    |
| - | -------- | -------------- | ------ | --------- | ------------------ |
| 1 | Hero     | `HeroScene`     | 130    | 0:00–0:04 | Hero + trust points |
| 2 | Problem  | `ProblemScene`  | 130    | 0:04–0:09 | `#problem`          |
| 3 | Solution | `SolutionScene` | 150    | 0:09–0:14 | `#solution`         |
| 4 | Routine  | `RoutineScene`  | 110    | 0:14–0:17 | `#routine`          |
| 5 | Closing  | `ClosingScene`  | 80     | 0:17–0:20 | Final CTA           |

Parent timeline: `remotion/PdevlogPromo.tsx` — scenes placed with `from` /
`durationInFrames` directly on each instance (no extra `<Sequence>`).

## Scene 1 — Hero (150f)

- Icon: `staticFile("pdevlog-icon.png")`
- Eyebrow pill: “For Solo Developers & Engineers Outside the Unicorn Startup Bubble”
- Headline: “Stop Repeating 1 Year of Experience **5 Times Over.**” (last phrase in primary lime)
- Sub: “pdevlog is your personal Autonomous Tech Lead and Career Vault — turn daily work
  into real proof of impact.”
- Trust row: “Your data stays private to you · No monthly fees · Export Markdown anytime”
- Motion: staggered rise + fade (icon → eyebrow → headline → sub → trust), frames 0–48.

## Scene 2 — Problem (180f)

- Eyebrow: “A reality rarely talked about”
- Title: “Stuck in an Office Where “As Long As It Runs” Is the Standard?”
- 2×2 cards (numbered 01–04), titles only:
  1. Your Work Just Cycles Through the Same CRUD Forms
  2. When It’s Time to Update Your CV, You Forget What You Built
  3. You Want to Learn New Tech, But Lose Hours to Videos
  4. No Tech Lead Is Correcting Your Career Direction
- Motion: cards rise in, staggered 8f apart starting at frame 24.

## Scene 3 — Solution (240f)

- Eyebrow: “Transformative solutions”
- Title: “How pdevlog Solves Each Problem Above”
- Three cards:
  1. **Brag Logs + AI STAR** (emerald) — “From a rough technical rant to a high-value
     impact portfolio.” + proof line “Result: p95 latency −94% (800ms → 45ms)”
  2. **Skill Shredder** (indigo) — “Break through new-tech fear in 60 minutes.”
     + pills “Spike 0 · 15 min”, “Ignore List”, “TIL note”
  3. **AI Staff Engineer Mirror** (violet) — “An objective mirror without RPG points.”
     + rows “Core Superpowers”, “Growth Gaps”, “Next Steps”
- Motion: cards scale + fade in at frames 24 / 38 / 52.

## Scene 4 — Routine (180f)

- Eyebrow: “Low-friction habit”
- Title: “Not a Burdensome Diary. A 5-Minute System That Flows With Your Code.”
- 2×2 items (meta + title):
  - While Coding · 10 seconds — Capture ideas without breaking flow
  - End of Workday · 3-5 minutes — Draft one brag log
  - Weekend · 20 minutes — Clear the inbox & shred one skill
  - End of Month · 30 minutes — Re-analyze & set targets
- Motion: staggered rise + fade, 8f apart starting at frame 20.

## Scene 5 — Closing (150f)

- Icon + headline: “Control of Your Career Is Too Valuable to Leave to Office Luck.”
- Sub: “Start building an irrefutable professional track record today.”
- CTA pill: “Start Your Personal Dev Log Now — Free”
- Footer line: “Built for developers who keep track”
- Motion: rise + fade, CTA scales in last.

## Studio

Open each scene from the connected compositions (`Scenes` folder in the sidebar),
or the full video via `PdevlogPromo`. Timing, transforms, opacity and every
`Interactive.*` element are editable; edits save back to the JSX.

## Render

```bash
bunx remotion render remotion/index.ts PdevlogPromo out/pdevlog-promo.mp4
```

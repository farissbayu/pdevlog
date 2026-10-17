# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo software engineers, typically mid-level, working at small companies without
a mentor, tech lead, or Staff engineer. Their situation: they ship features on
repetitive CRUD work, receive no objective career feedback, and cannot recall
their own impact when an interviewer asks for it. Their job with pdevlog:
capture work as it happens so they can later prove impact and direct their own
growth. The author also uses pdevlog personally as a private log; other
engineers can sign up.

## Product Purpose

A private developer log. It captures brag-worthy wins in STAR format (Situation,
Task, Action, Result), Markdown notes, projects, and a frictionless capture
inbox, then organizes all of it with workspaces and tags. It exists to replace
memory and scattered git commits with a durable, exportable record of impact.
Success means the user can recall and prove what they built, and can see and
close their own technical gaps without a manager telling them.

## Positioning

Evidence-linked growth from the user's own real logs. AI STAR capture, skill
audits, and growth reviews are all grounded in entries the user actually
recorded, so an output can always be traced back to first-hand evidence. A
generic note app or brag doc cannot truthfully claim this; a social profile has
the wrong privacy model.

## Operating Context

- Logging wins close to when they happen; a global `Cmd/Ctrl+K` capture inbox
  (sparks) is for dumping links, ideas, and screenshots with no friction.
- CV and interview preparation: draft STAR entries, export brag logs as
  Markdown, export notes as PDF.
- Self-review rituals: skill audits, project changelogs, and growth checks run
  against the accumulated log.
- Data is per-user and private by default; users expect to own and export it.
- Runs on Cloudflare Workers with D1 and R2; no server to operate.

## Capabilities and Constraints

Confirmed capabilities: Google sign-in, workspaces (work/learning/general),
brag logs in STAR format with AI-assisted breakdown, Markdown notes with live
preview and TOC, source links, sparks capture inbox, screenshot attachments,
tags, dashboard, a developer profile (CV parse, skill insights, persona
extract), projects with items and changelogs, export, account deletion, an
admin console, and light/dark theme.

Constraints: single Worker serving a React SPA and a Hono API; D1 for
relational data and R2 for attachments; every query scoped by session `userId`
(foreign access returns 404); open signup via Google OAuth; long AI work runs
asynchronously and is polled by the client.

## Brand Commitments

- Name: pdevlog.
- Voice: direct, engineer-to-engineer, no marketing fluff. Landing copy names
  real engineering fears plainly.
- Commitments stated to users: data stays private to the user, no monthly fees,
  export Markdown anytime.
- Free / self-hostable positioning; licensing is private ("all rights
  reserved").

## Evidence on Hand

- `README.md` — feature and API reference (behind the code; it omits profile,
  projects, skills, and skill-shredder routes).
- `src/client/features/landing/landing-page.tsx` — problem framing, comparison,
  and trust points, written in the product voice.
- `tasks/backlog.md` and `AGENTS.md` — roadmap and architecture intent.

Absences future work must not fabricate: no testimonials, logos, press,
customers, benchmarks, pricing tiers, or usage numbers exist in the repo.

## Product Principles

1. Capture must be frictionless; structure comes later.
2. Every growth or skill claim traces back to the user's own recorded evidence.
3. The user's data is private and portable — never a lock-in.
4. Replace memory and scattered commits with a durable, searchable record.
5. The engineer is their own tech lead: the product supplies objectivity in
   place of the absent mentor.

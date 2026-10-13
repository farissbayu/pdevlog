---
title: Brag Logs & AI STAR Breakdown
description: Turn messy daily wins and shipped fixes into structured Situation-Task-Action-Result impact stories for interviews and reviews.
category: AI & Career Growth
order: 7
---

## Why Keep a Brag Log?

Engineers routinely forget 80% of the hard problems they solved six months ago. When promotion packets, salary negotiations, or behavioral interviews arrive, "I worked on the checkout service" loses to a concrete story backed by technical depth and measurable outcomes.

**[Brag Logs](/brag-logs)** lets you dump a rough, two-sentence brain dump right after shipping and uses AI to structure it into an interview-ready **STAR** record.

---

## Recording a Win

You can create a Brag Log in two ways:
1. **Directly in [Brag Logs](/brag-logs)**: Click **New Brag Log**, select an optional Workspace and Tags, and write a title + raw description of what you did.
2. **When shipping a Project Item**: In [Workspaces](/workspaces), marking a project item as **Shipped** offers a shortcut to log a Brag Log for that deliverable.

### What to Write in Your Raw Entry
Don't worry about polished prose. Just jot down the facts:
- What was broken, slow, or missing?
- What was the gnarly root cause or constraint?
- What specific change did you make (e.g., added a composite index, batched D1 queries, introduced idempotency keys)?
- What changed afterward (e.g., p95 latency dropped from 800ms to 90ms, zero duplicate charges)?

---

## Generating the AI STAR Breakdown

Open any Brag Log detail page and click **Generate STAR Breakdown** (or **Regenerate** after updating your notes):

| Component | What It Captures |
| :--- | :--- |
| **Situation** | The system context, scale, or business problem before you stepped in. |
| **Task** | Your specific responsibility, technical constraint, or goal. |
| **Action** | The concrete engineering decisions, trade-offs, and implementation steps you executed. |
| **Result** | The measurable technical and business impact (latency, reliability, developer velocity, revenue). |

> **Tip:** You can edit the generated STAR fields anytime if you want to add exact metrics or refine the wording before an interview.


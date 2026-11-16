---
title: Export & Own Your Data
description: Download your brag logs as Markdown, print notes to PDF, and delete your account — your log stays portable.
category: Core Features
order: 9
---

## Overview

Nothing in Personal Dev Log is locked in. Export your brag logs as plain Markdown, download notes as `.md`, print them to PDF, or delete everything and walk away.

---

## Export Brag Logs as Markdown

1. Open [Settings](/settings).
2. Under **Export data**, optionally pick a **From** and **To** date.
3. Pick a format:
   - **Download STAR (.md)** → `brag-logs.md`. Each entry keeps its full STAR structure (Situation, Task, Action, Result) plus date, workspace, and tags.
   - **Download CV bullets (.md)** → `brag-log-bullets.md`. One line per achievement, ready to paste into a CV or performance review:

     ```
     - **Fixed order endpoint latency** — Reduced p95 from 800ms to 45ms. (2026-03-12 · Database, Backend)
     ```

Leave both dates empty to export your entire history. Bullets are written deterministically from your own fields — no AI rewriting, no invented metrics.

---

## Download or Print Notes

Open any note and use the header actions:

- **Download Markdown** saves `<note-title>.md` with the title as an `#` heading followed by your content, exactly as written.
- **Download PDF** opens the print view; use your browser's print dialog to save a PDF. Formatting, sources, and metadata are preserved.

---

## Delete Your Account

[Settings](/settings) → **Danger zone** → **Delete account** permanently removes your account and every workspace, tag, brag log, note, spark, project, and attachment you own. This cannot be undone, so export first if you want a copy.

---

## Read the Source

The app runs on Cloudflare Workers with D1 and R2. You can read the full source on [GitHub](https://github.com/farissbayu/pdevlog).

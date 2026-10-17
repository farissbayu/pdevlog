---
title: Export & Own Your Data
description: Download your brag logs as Markdown, print notes to PDF, and delete your account — your log stays portable.
category: Core Features
order: 9
---

## Overview

Nothing in Personal Dev Log is locked in. Export your brag logs as plain Markdown, print notes to PDF, or delete everything and walk away.

---

## Export Brag Logs as Markdown

1. Open [Settings](/settings).
2. Under **Export data**, optionally pick a **From** and **To** date.
3. Click **Export to Markdown (.md)**.

The app downloads a `brag-logs.md` file. Each entry keeps its full STAR structure (Situation, Task, Action, Result) plus its date, workspace, and tags. Leave both dates empty to export your entire history.

---

## Print or Save Notes as PDF

Open any note, click **Print**, and use your browser's print dialog to save it as a PDF. The Markdown formatting, sources, and metadata are preserved in the printed output.

---

## Delete Your Account

[Settings](/settings) → **Danger zone** → **Delete account** permanently removes your account and every workspace, tag, brag log, note, spark, project, and attachment you own. This cannot be undone, so export first if you want a copy.

---

## Read the Source

The app runs on Cloudflare Workers with D1 and R2. You can read the full source on [GitHub](https://github.com/farissbayu/pdevlog).

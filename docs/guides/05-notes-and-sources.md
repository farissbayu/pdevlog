---
title: Notes, Sources & Tags
description: Write GitHub-flavored Markdown technical notes, attach reference URLs and files, organize with tags, and export clean PDFs.
category: Core Features
order: 5
---

## Writing Technical Notes

[Notes](/notes) is your private engineering wiki—built for Today I Learned (TIL) entries, architecture decision records (ADRs), debugging postmortems, and study summaries.

### Markdown Capabilities
The note editor supports full **GitHub-Flavored Markdown (GFM)**:
- Syntax-highlighted code blocks for dozens of languages
- Tables, task lists (`- [x]`), blockquotes, and horizontal rules
- Automatic heading slugs that generate a live **On this page** table of contents
- Word count and estimated reading time calculated automatically

### Linking to Workspaces & Projects
Every note can optionally belong to:
- A **Workspace** (e.g., all notes for your current job)
- A specific **Project** inside that workspace (accessible directly from the project's **Notes** tab)
- Or stay global as a general learning note

---

## Attaching Sources

Great technical notes link back to the primary material you consulted. On any note detail page, you can attach **Sources**:

- **URLs / Articles / Docs**: Save links to official documentation, RFCs, blog posts, or GitHub issues.
- **Files & References**: Keep supporting material right alongside your summary so links never rot out of context.

---

## Organizing with Tags

Tags work across both **Notes** and **Brag Logs**:
1. Manage your colour-coded tag taxonomy in [Tags](/tags) (e.g., `distributed-systems`, `sql`, `observability`, `security`).
2. Attach multiple tags when creating or editing a note.
3. Filter your [Notes](/notes) list by tag, workspace, project, or full-text search.

---

## Exporting & Printing to PDF

Need to share a technical design doc or keep an offline copy?
- Open any note and click **Export PDF / Print** (`/notes/:id/print`).
- Personal Dev Log opens a dedicated print-optimized stylesheet with clean typography, code formatting, and metadata ready for your browser's **Save as PDF**.


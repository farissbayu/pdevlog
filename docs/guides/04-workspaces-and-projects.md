---
title: Workspaces, Projects & Changelogs
description: Organize your work, side projects, and learning labs, track deliverables by type, and generate Markdown changelogs automatically.
category: Core Features
order: 4
---

## Hierarchy Overview

Personal Dev Log organizes your engineering work in two tiers:

```
Workspace (e.g., "Acme Corp", "Indie SaaS", "Systems Lab")
 ├── Workspace Brag Logs & Notes
 └── Projects (e.g., "Checkout API v2", "Billing Worker")
      ├── Project Items (feat, fix, perf, refactor, spike, docs, chore)
      ├── Project Notes (architecture docs, runbooks, TILs)
      └── Auto-generated CHANGELOG.md
```

---

## Workspaces

A **Workspace** represents a high-level context in your engineering life. When creating a workspace in [Workspaces](/workspaces), you assign it a type badge:

- **Work** — Your day job or client contracts
- **Personal** — Side projects, indie products, or open-source repos
- **Learning** — Courses, toy projects, and technical experiments
- **Other** — Everything else

Opening a Workspace shows:
- All **Projects** inside that workspace
- **Brag Logs** scoped to that workspace
- **Notes** attached to that workspace

---

## Projects & Project Items

Inside any Workspace, create a **Project** (optionally linking its Git repository URL and live deployment URL). Each Project has two main tabs: **Items** and **Notes**.

### Project Item Kinds
Every item in a project is tagged with a semantic commit-style kind:
- `feat` — New user-facing or API capability
- `fix` — Bug, regression, or incident resolution
- `perf` — Latency, memory, query, or bundle optimization
- `refactor` — Internal restructuring without changing external behavior
- `spike` — Time-boxed technical experiment or prototype
- `docs` — Documentation, ADRs, or runbooks
- `chore` — Tooling, CI/CD, or dependency updates

### Item Status Workflow
Items move through three lightweight states:
1. **Backlog** — Queued up (often promoted directly from a [Spark](/guides/sparks))
2. **In Progress** — Currently being built
3. **Shipped** — Completed and stamped with a `shippedAt` timestamp

> **Tip:** When you mark an item as **Shipped**, you can immediately log a **Brag Log** pre-filled with that item's context so your biggest deliverables automatically become part of your career portfolio.

---

## Generating `CHANGELOG.md`

Because project items track both their semantic kind (`feat`, `fix`, `perf`, etc.) and their `shippedAt` date, any project can generate a clean, Keep-a-Changelog style Markdown file in one click:

1. Open your project in [Workspaces](/workspaces).
2. Click **Copy Changelog** (or export `CHANGELOG.md`).
3. Paste the generated Markdown straight into your repository's `CHANGELOG.md` or GitHub Release notes.


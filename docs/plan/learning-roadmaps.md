# Learning Roadmaps — Feature Design | NOT IMPLEMENTED

> A visual, graph-based feature for planning and tracking learning paths or build
> journeys. Users create directed graphs of topics, skills, or milestones — then
> track progress as they work through them.

---

## 1. Problem & Motivation

pdevlog already captures **what you did** (brag logs, notes, project items) and
**where you stand** (skill insights, daily learning suggestions). What's missing
is the forward-looking view: **what should I learn next, and in what order?**

Users need a way to:

- Lay out a learning path for a new technology, domain, or career goal
- Visualize dependencies between topics ("learn X before Y")
- Track progress through a multi-step learning or build journey
- Connect roadmap nodes to the work they actually produce (notes, brag logs)
- Get AI help generating a sensible roadmap from a vague goal

---

## 2. Core Concepts

### 2.1 Roadmap

A **roadmap** is a user-owned, directed acyclic graph (DAG) of nodes and edges.

| Field         | Type                                    | Notes                            |
| ------------- | --------------------------------------- | -------------------------------- |
| `id`          | `text` (nanoid)                         | PK                               |
| `userId`      | `text`                                  | FK → users, per-user isolation   |
| `workspaceId` | `text \| null`                          | FK → workspaces (optional scope) |
| `title`       | `text`                                  | e.g. "Rust Systems Programming"  |
| `description` | `text \| null`                          | Free-form goal description       |
| `type`        | `"learning" \| "building" \| "career"`  | Categorization                   |
| `status`      | `"active" \| "completed" \| "archived"` | Lifecycle                        |
| `progress`    | `integer` (0–100)                       | Computed: % of nodes completed   |
| `createdAt`   | `text` (ISO 8601)                       |                                  |
| `updatedAt`   | `text` (ISO 8601)                       |                                  |

### 2.2 Roadmap Node

A **node** is a single step, topic, or milestone in the roadmap.

| Field            | Type                                                             | Notes                                   |
| ---------------- | ---------------------------------------------------------------- | --------------------------------------- |
| `id`             | `text` (nanoid)                                                  | PK                                      |
| `userId`         | `text`                                                           | FK → users                              |
| `roadmapId`      | `text`                                                           | FK → roadmaps (cascade delete)          |
| `title`          | `text`                                                           | e.g. "Ownership & Borrowing"            |
| `description`    | `text \| null`                                                   | What to learn / build at this step      |
| `kind`           | `"topic" \| "skill" \| "milestone" \| "project" \| "checkpoint"` | Visual/semantic classification          |
| `status`         | `"not_started" \| "in_progress" \| "completed" \| "skipped"`     | Progress state                          |
| `position`       | `text` (JSON `{x, y}`)                                           | Canvas position for rendering           |
| `estimatedHours` | `real \| null`                                                   | Optional time estimate                  |
| `completedAt`    | `text \| null`                                                   | ISO 8601 when marked completed          |
| `noteId`         | `text \| null`                                                   | FK → notes (set null) — linked note     |
| `bragLogId`      | `text \| null`                                                   | FK → bragLogs (set null) — linked brag  |
| `resources`      | `text` (JSON array)                                              | `[{url, label, kind}]` — learning links |
| `createdAt`      | `text` (ISO 8601)                                                |                                         |
| `updatedAt`      | `text` (ISO 8601)                                                |                                         |

### 2.3 Roadmap Edge

An **edge** represents a dependency: "complete node A before starting node B."

| Field       | Type              | Notes                                     |
| ----------- | ----------------- | ----------------------------------------- |
| `id`        | `text` (nanoid)   | PK                                        |
| `userId`    | `text`            | FK → users                                |
| `roadmapId` | `text`            | FK → roadmaps (cascade delete)            |
| `sourceId`  | `text`            | FK → roadmapNodes (cascade delete)        |
| `targetId`  | `text`            | FK → roadmapNodes (cascade delete)        |
| `label`     | `text \| null`    | Optional edge label ("prerequisite", etc) |
| `createdAt` | `text` (ISO 8601) |                                           |

**Constraint:** unique(`roadmapId`, `sourceId`, `targetId`) — no duplicate edges.

---

## 3. User Stories & Flows

### 3.1 Manual Roadmap Creation

```
User clicks "New Roadmap"
  → enters title, description, type, optional workspace
  → lands on canvas editor (empty graph)
  → double-click canvas to add nodes
  → drag from node handle to another node to create edges
  → click node to edit title, description, kind, resources
  → progress bar updates as nodes are completed
```

### 3.2 AI-Generated Roadmap

```
User clicks "Generate with AI"
  → enters a goal: "I want to learn Rust for systems programming"
  → optionally selects a roadmap type (learning / building / career)
  → system returns 202, begins AI generation in queue
  → AI generates ~8–15 nodes with edges based on logical dependency order
  → user lands on canvas with pre-laid-out graph
  → user can edit, add, remove, reorder nodes
```

**AI prompt context includes:**

- User's skill insights (archetype, strengths, growth areas)
- Recent notes and brag logs (last 30 days)
- The goal description

This lets the AI tailor the roadmap to the user's current level.

### 3.3 Roadmap from Skill Insights

```
User views their Skill Insights on the Profile page
  → sees a growth area: "Observability & Monitoring"
  → clicks "Create Roadmap" on that growth area
  → AI generates a roadmap seeded with that specific gap
  → roadmap is pre-linked to the "learning" workspace if one exists
```

### 3.4 Working Through a Roadmap

```
User opens a roadmap
  → sees the graph with color-coded node statuses
  → nodes with all prerequisites completed are highlighted as "available"
  → user clicks a node → marks it "in_progress"
  → user creates a note from the node (pre-fills title, links back)
  → user completes the note, marks node "completed"
  → progress bar and graph update
  → when all nodes completed, roadmap status → "completed" 🎉
```

### 3.5 Linking Existing Work

```
User is on a roadmap node
  → clicks "Link Note" → searches existing notes → attaches one
  → clicks "Link Brag Log" → searches existing brag logs → attaches one
  → the node now shows linked evidence of completion
```

---

## 4. API Design

All routes under `/api/roadmaps`, guarded by `authMiddleware`.

### Roadmap CRUD

| Method   | Path   | Description                                                            | Response |
| -------- | ------ | ---------------------------------------------------------------------- | -------- |
| `GET`    | `/`    | List roadmaps (paginated, filterable by workspace_id, type, status, q) | 200      |
| `POST`   | `/`    | Create roadmap                                                         | 201      |
| `GET`    | `/:id` | Get roadmap with all nodes & edges                                     | 200      |
| `PUT`    | `/:id` | Update roadmap metadata                                                | 200      |
| `DELETE` | `/:id` | Delete roadmap (cascades)                                              | 204      |

### Node CRUD

| Method   | Path                 | Description                                  | Response |
| -------- | -------------------- | -------------------------------------------- | -------- |
| `POST`   | `/:id/nodes`         | Add node to roadmap                          | 201      |
| `PUT`    | `/:id/nodes/:nodeId` | Update node (title, status, position, links) | 200      |
| `DELETE` | `/:id/nodes/:nodeId` | Delete node (cascade edges)                  | 204      |
| `PUT`    | `/:id/nodes/batch`   | Batch update positions (after drag)          | 200      |

### Edge CRUD

| Method   | Path                 | Description                   | Response |
| -------- | -------------------- | ----------------------------- | -------- |
| `POST`   | `/:id/edges`         | Add edge (validates no cycle) | 201      |
| `DELETE` | `/:id/edges/:edgeId` | Delete edge                   | 204      |

### AI Generation

| Method | Path                   | Description               | Response |
| ------ | ---------------------- | ------------------------- | -------- |
| `POST` | `/:id/generate`        | AI-generate nodes & edges | 202      |
| `GET`  | `/:id/generate/status` | Poll generation status    | 200      |

### Actions

| Method | Path                             | Description                       | Response |
| ------ | -------------------------------- | --------------------------------- | -------- |
| `POST` | `/:id/nodes/:nodeId/create-note` | Create a note linked to this node | 201      |
| `POST` | `/:id/nodes/:nodeId/create-brag` | Create a brag log linked to node  | 201      |

---

## 5. AI Generation Design

### 5.1 Request Shape

```ts
{
  goal: string;              // "Learn Rust for systems programming"
  type: "learning" | "building" | "career";
  seedFromInsights?: boolean; // include skill insights context
  growthAreaId?: string;      // specific growth area to focus on
}
```

### 5.2 AI Output Schema (Zod)

```ts
const roadmapGenerationSchema = z.object({
  suggestedTitle: z.string(),
  nodes: z.array(
    z.object({
      tempId: z.string(), // temporary ID for edge references
      title: z.string(),
      description: z.string(),
      kind: z.enum(["topic", "skill", "milestone", "project", "checkpoint"]),
      estimatedHours: z.number().optional(),
      resources: z
        .array(
          z.object({
            url: z.string().url(),
            label: z.string(),
            kind: z.enum([
              "video",
              "course",
              "book",
              "article",
              "link",
              "other",
            ]),
          }),
        )
        .optional(),
    }),
  ),
  edges: z.array(
    z.object({
      sourceTempId: z.string(),
      targetTempId: z.string(),
      label: z.string().optional(),
    }),
  ),
});
```

### 5.3 AI Prompt Strategy

**System prompt:**

> You are a senior developer and technical mentor. Given a learning/building goal
> and the user's current skill profile, generate a practical roadmap as a directed
> acyclic graph. Each node is a concrete, actionable step. Edges represent
> prerequisites. Include 8–15 nodes. Mark key milestones with kind "milestone" or
> "checkpoint". Suggest real, high-quality resources (docs, tutorials, books).

**User prompt includes:**

- The goal description
- Skill insights (if available): archetype, strengths, growth areas
- Recent activity summary (last 5 notes titles + last 5 brag log titles)
- Any specific growth area focus

### 5.4 Layout Algorithm

After AI returns nodes and edges, the server computes initial positions using a
**topological sort + layered layout**:

1. Topological sort the DAG
2. Assign layers (longest-path layering)
3. Within each layer, space nodes evenly
4. Store positions in each node's `position` field

The client can then adjust positions via drag-and-drop.

---

## 6. Client UI Design

### 6.1 Pages & Routes

| Route           | Page                                   |
| --------------- | -------------------------------------- |
| `/roadmaps`     | Roadmaps list                          |
| `/roadmaps/new` | Create roadmap (form or AI generation) |
| `/roadmaps/:id` | Roadmap canvas + detail view           |

### 6.2 Roadmap List Page

- Card grid layout (similar to workspaces)
- Each card shows: title, type badge, progress bar, node count, status
- Filter by: type, status, workspace
- Search by title
- "New Roadmap" button (prominent) + "Generate with AI" option

### 6.3 Roadmap Canvas Page (core experience)

```
┌─────────────────────────────────────────────────────┐
│  ← Back    Rust Systems Programming    ▓▓▓▓░░ 60%  │
│            learning · 12 nodes · active             │
├──────────────────────────────────┬──────────────────┤
│                                  │  Node Detail     │
│     ┌───────┐                    │                  │
│     │ Basics│───→┌──────────┐    │  Title: Ownership│
│     └───────┘    │Ownership │    │  Kind: topic     │
│         │        │& Borrow  │    │  Status: ●active │
│         ▼        └──────────┘    │                  │
│     ┌───────┐        │          │  Description:    │
│     │Structs│        ▼          │  Learn Rust's... │
│     └───────┘    ┌──────────┐   │                  │
│         │        │ Lifetimes│    │  Resources:      │
│         ▼        └──────────┘   │  📖 The Book Ch4 │
│     ┌────────┐       │          │  🎬 Video intro  │
│     │  ...   │       ▼          │                  │
│     └────────┘   ┌──────────┐   │  Linked:         │
│                  │Milestone:│    │  📝 Note: ...    │
│                  │ CLI App  │    │                  │
│                  └──────────┘   │  [Create Note]   │
│                                  │  [Link Brag Log] │
│  [+ Add Node]  [⟳ AI Suggest]   │                  │
├──────────────────────────────────┴──────────────────┤
│  Legend: ○ not started  ● in progress  ✓ done  ⊘ skip│
└─────────────────────────────────────────────────────┘
```

**Key interactions:**

- **Pan & zoom** the canvas (mouse drag + scroll wheel)
- **Click node** → opens detail sidebar
- **Double-click canvas** → add new node at position
- **Drag from node edge** → create connection to another node
- **Drag node** → reposition (batch-updates positions)
- **Right-click node** → context menu (edit, delete, change status, link)
- **Status toggle** — click status indicator on node to cycle through states

### 6.4 Graph Rendering Library

Recommended: **React Flow** (`@xyflow/react`)

Reasons:

- Purpose-built for node-based graph UIs in React
- Built-in: pan, zoom, drag, edge creation, minimap, controls
- Lightweight (~45KB gzipped)
- Handles DAG layouts well
- Good mobile touch support
- Active maintenance, MIT license

Alternative considered: D3.js (too low-level for this use case).

### 6.5 Node Visual Design

Nodes are color-coded by status and shaped by kind:

| Kind       | Shape        | Icon |
| ---------- | ------------ | ---- |
| topic      | Rounded rect | 📚   |
| skill      | Rounded rect | 🛠️   |
| milestone  | Diamond/hex  | 🏁   |
| project    | Rounded rect | 🚀   |
| checkpoint | Circle       | ✓    |

| Status      | Color | Border |
| ----------- | ----- | ------ |
| not_started | Gray  | Dashed |
| in_progress | Blue  | Solid  |
| completed   | Green | Solid  |
| skipped     | Dim   | Dotted |

Edges: solid arrows for prerequisites. Animated pulse on the "available next" edges
(where all source nodes are completed).

---

## 7. Integration Points

### 7.1 Profile → Roadmap

- Skill insights growth areas get a "Create Roadmap" action button
- Recommended next steps can seed roadmap generation
- Roadmap progress feeds back into skill narrative (future)

### 7.2 Dashboard → Roadmap

- Dashboard shows active roadmaps with progress bars
- "Continue your roadmap" widget showing next available nodes
- Daily learning suggestion can reference roadmap nodes

### 7.3 Notes ↔ Roadmap

- Creating a note from a roadmap node pre-fills:
  - Title: node title
  - Links the note back to the node
  - Tags: auto-suggests relevant tags
- Completing a note can prompt to mark the node as completed

### 7.4 Brag Logs ↔ Roadmap

- Completing a milestone node can prompt brag log creation
- Brag logs can be linked to roadmap nodes as evidence

### 7.5 Projects ↔ Roadmap

- A "building" type roadmap could be generated from a project's backlog
- Project items → roadmap nodes mapping (future)

### 7.6 Sparks → Roadmap

- A spark can be promoted to a roadmap node (new promotion type)

---

## 8. Implementation Phases

### Phase 1 — Foundation (MVP)

**Goal:** Basic roadmap CRUD with manual graph editing.

1. DB schema: `roadmaps`, `roadmapNodes`, `roadmapEdges` tables
2. Shared Zod schemas: `src/shared/schemas/roadmap.ts`
3. Worker: `src/worker/features/roadmaps/route.ts` + `service.ts`
   - Roadmap CRUD
   - Node CRUD (including batch position update)
   - Edge CRUD (with cycle detection)
4. Mount in `src/worker/index.ts`
5. Client: `src/client/features/roadmaps/`
   - `api.ts` — React Query hooks
   - `roadmaps-page.tsx` — List view
   - `roadmap-detail-page.tsx` — Canvas with React Flow
   - `components/` — Node components, sidebar, toolbar
6. Register routes in `src/client/app/router.tsx`

**Deliverable:** Users can create, edit, and track roadmaps manually.

### Phase 2 — AI Generation

**Goal:** Generate roadmaps from a goal description.

1. Add `generateRoadmap()` to `ai-client.ts`
2. Add generation status field to roadmaps table (`generateStatus`)
3. Queue-based generation (like skill insights)
4. Layout algorithm for initial node positioning
5. "Generate with AI" flow on creation page
6. Client polling for generation completion

**Deliverable:** Users can describe a goal and get a structured roadmap.

### Phase 3 — Deep Integration

**Goal:** Connect roadmaps to the rest of pdevlog.

1. "Create Note from Node" action
2. "Link Brag Log" action
3. Profile page: "Create Roadmap" from growth areas
4. Dashboard: active roadmap widget
5. Spark promotion to roadmap node
6. Roadmap progress in dashboard stats

**Deliverable:** Roadmaps are woven into the daily workflow.

### Phase 4 — Polish & Advanced

**Goal:** Delightful UX and advanced features.

1. Roadmap templates (common learning paths)
2. Export roadmap as image / markdown
3. Duplicate / fork a roadmap
4. Time tracking per node (optional)
5. "Suggest next node" AI action (what to add to an existing roadmap)
6. Roadmap sharing (public read-only link — future, out of scope for now)

---

## 9. Data Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Profile    │     │  Dashboard   │     │    Sparks    │
│ (Skill       │     │ (Active      │     │ (Promote to  │
│  Insights)   │     │  Roadmaps)   │     │  Node)       │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │ seed                │ widget             │ promote
       ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                      ROADMAPS                           │
│                                                         │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐    │
│  │ Roadmap │───▶│ Nodes (DAG) │───▶│    Edges      │    │
│  └─────────┘    └──────┬──────┘    └──────────────┘    │
│                        │                                │
│                 ┌──────┴──────┐                         │
│                 ▼             ▼                         │
│           ┌──────────┐ ┌──────────┐                    │
│           │  Notes   │ │Brag Logs │                    │
│           │ (linked) │ │ (linked) │                    │
│           └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Cycle Detection

Since roadmaps are DAGs, we must prevent cycles when adding edges. Algorithm:

```
addEdge(source, target):
  1. Build adjacency list from existing edges + proposed edge
  2. Run DFS from target node
  3. If DFS reaches source → CYCLE DETECTED → reject with 422
  4. Otherwise → insert edge
```

This runs server-side on every `POST /:id/edges` request. The node set is small
(typically < 50 nodes), so DFS is O(V + E) and instant.

---

## 11. Open Questions

1. **Should roadmaps be nested inside workspaces or top-level?**
   - Current design: top-level with optional workspace association.
   - Pro: roadmaps can span multiple workspaces (e.g., a career roadmap).
   - Con: breaks the workspace-as-container pattern for work/learning/general.

2. **Should we support collaborative roadmaps in the future?**
   - pdevlog is currently single-user. Parking this for now.

3. **Mobile experience?**
   - React Flow supports touch gestures, but a full graph editor on mobile is
     awkward. Consider a simplified "list view" of nodes (sorted topologically)
     as a mobile fallback.

4. **How many nodes is too many?**
   - Suggest a soft limit of ~50 nodes per roadmap. AI generation caps at 15.
   - For larger journeys, suggest splitting into multiple linked roadmaps.

5. **Should completed roadmaps generate a brag log automatically?**
   - Nice-to-have for Phase 3. "I completed a 12-step Rust learning roadmap"
     as a STAR-format achievement.

---

## 12. Technical Notes

- **React Flow** is the only significant new dependency. It's MIT-licensed and
  tree-shakeable. Bundle impact: ~45KB gzipped.
- **No new bindings** needed in `wrangler.jsonc` — roadmaps use the existing D1
  database and AI queue.
- **Migration**: 3 new tables (`roadmaps`, `roadmapNodes`, `roadmapEdges`).
  Standard drizzle-kit flow.
- **tsconfig compliance**: all new code must satisfy `noUnusedLocals`,
  `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.

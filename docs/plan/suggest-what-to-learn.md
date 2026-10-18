# Implementation Plan: Daily Learning Suggestion in Dashboard

**Status:** Proposed  
**Feature Surface:** Dashboard widget on `/dashboard` + `/api/dashboard/learning-suggestion`  
**Runtime:** Cloudflare Workers + D1 + OpenRouter AI  
**Frontend:** React 19 + React Query + Tailwind CSS v4 + Lucide Icons  

---

## 1. Executive Summary & Core Rules

### 1.1 Context & Problem
`pdevlog` serves as an autonomous engineering journal and career vault. When engineers log in to their dashboard, they need targeted, actionable guidance on what to learn or build next that **directly connects to what they have actually been working on over the past week**.

Rather than giving generic curriculum advice or static suggestions, the system will look at the developer's **last 7 days of actual output** (projects/backlog items, brag logs, and notes), sort them chronologically, and synthesize a single, high-leverage technical topic to explore next.

### 1.2 Core Rules & Constraints
1. **Grounded in 7-Day Activity:**
   - Evaluates the user's uploaded data from the **last 7 days** (`Date.now() - 7 * 86_400_000`):
     - **Projects & Project Items:** Features, fixes, refactors, spikes worked on or shipped.
     - **Brag Logs:** STAR logs created (actions taken, problems solved, outcomes).
     - **Notes:** Technical markdown notes and TILs written.
   - All items sorted by timestamp descending.
   - *Cold-start fallback:* If the user has fewer than 2 items in the last 7 days, gracefully look back to their most recent 5 items overall, or guide them with a starter topic based on their primary stack.
2. **Strict Daily Cadence (1 Suggestion Per Day):**
   - Each user has **exactly 1 suggestion per calendar day** (`YYYY-MM-DD` in the user's local timezone via `tz_offset`).
   - Stored in a dedicated database table with a unique constraint on `(user_id, date)`.
3. **Regeneration Limit (Max 3 Times Per Day):**
   - Each day, the user can regenerate up to **3 times** (total of 4 suggestions viewed at most).
   - Database tracks `regenerate_count` (0 to 3).
   - Once `regenerate_count >= 3`, regeneration is disabled until the next day resets the quota.
   - UI clearly shows remaining regenerations: e.g. `"2 of 3 regenerations left today"`.
4. **Immediate In-App Actionability:**
   - **⚡ Save as Spark:** 1-click save to Sparks inbox; updates suggestion status to `saved_as_spark`.
   - **📝 Start Note (TIL):** 1-click opens `/notes/new` with prefilled title and a scaffolded markdown template tailored to the suggestion.

---

## 2. Database Schema & Migration (`src/worker/db/schema.ts`)

### 2.1 Table Definition: `daily_learning_suggestions`

A new table ensures strict daily constraints, persists the suggestion so dashboard loads are instantaneous, and enforces the 3-regeneration cap.

```ts
export const learningSuggestionStatuses = [
  "active",
  "saved_as_spark",
  "converted_to_note",
  "dismissed",
] as const;
export type LearningSuggestionStatus = (typeof learningSuggestionStatuses)[number];

export const dailyLearningSuggestions = sqliteTable(
  "daily_learning_suggestions",
  {
    id: text("id").primaryKey(), // nanoid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // Local day key 'YYYY-MM-DD'
    title: text("title").notNull(),
    category: text("category").notNull(), // e.g. 'architecture', 'reliability', 'perf', 'internals'
    reason: text("reason").notNull(), // Why recommended based on 7-day work
    practicalNextStep: text("practical_next_step").notNull(), // Concrete 1-2h spike or experiment
    suggestedOutline: text("suggested_outline"), // Starter note template in markdown
    suggestedTags: text("suggested_tags"), // JSON string array of tags e.g. '["redis","caching"]'
    sourceContextSummary: text("source_context_summary"), // Summary of the 7-day items that inspired this
    regenerateCount: integer("regenerate_count").notNull().default(0), // 0 to 3
    status: text("status", { enum: learningSuggestionStatuses })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    // Enforces strictly 1 record per user per local day
    uniqueIndex("daily_learning_suggestions_user_date_idx").on(
      table.userId,
      table.date,
    ),
    index("daily_learning_suggestions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type DailyLearningSuggestionRow = typeof dailyLearningSuggestions.$inferSelect;
export type NewDailyLearningSuggestionRow = typeof dailyLearningSuggestions.$inferInsert;
```

### 2.2 Migration Steps
Following `AGENTS.md` guidelines:
1. Add `dailyLearningSuggestions` to `src/worker/db/schema.ts`.
2. Generate migration:
   ```bash
   bun run db:generate
   ```
   *Generates `drizzle/00XX_add_daily_learning_suggestions.sql`.*
3. Apply locally:
   ```bash
   bun run db:migrate:local
   ```
4. Verify tests apply migrations cleanly via `tests/setup/apply-migrations.ts`.

---

## 3. Shared Schemas (`src/shared/schemas/learning-suggestions.ts`)

Types flow from Worker to Client via `src/shared/schemas`:

```ts
import { z } from "zod";
import { learningSuggestionStatuses } from "@/worker/db/schema";

export const dailyLearningSuggestionSchema = z.object({
  id: z.string(),
  date: z.string(), // YYYY-MM-DD
  title: z.string().min(1),
  category: z.string().min(1),
  reason: z.string().min(1),
  practicalNextStep: z.string().min(1),
  suggestedOutline: z.string().nullable(),
  suggestedTags: z.array(z.string()),
  sourceContextSummary: z.string().nullable(),
  regenerateCount: z.number().int().min(0).max(3),
  regenerationsLeft: z.number().int().min(0).max(3),
  status: z.enum(learningSuggestionStatuses),
  createdAt: z.string(),
});
export type DailyLearningSuggestion = z.infer<typeof dailyLearningSuggestionSchema>;

export const dailySuggestionQuerySchema = z.object({
  tz_offset: z.coerce.number().default(0),
});
export type DailySuggestionQuery = z.infer<typeof dailySuggestionQuerySchema>;

export const dailySuggestionResponseSchema = z.object({
  suggestion: dailyLearningSuggestionSchema.nullable(),
  hasRecentActivity: z.boolean(),
  todayKey: z.string(),
  regenerationsLeft: z.number().int().min(0).max(3),
});
export type DailySuggestionResponse = z.infer<typeof dailySuggestionResponseSchema>;

export const regenerateSuggestionRequestSchema = z.object({
  tz_offset: z.coerce.number().default(0),
});
export type RegenerateSuggestionRequest = z.infer<typeof regenerateSuggestionRequestSchema>;
```

---

## 4. Backend Implementation

### 4.1 Seven-Day Context Aggregation (`src/worker/features/dashboard/learning-service.ts`)

```ts
const SEVEN_DAYS_MS = 7 * 86_400_000;

export async function loadRecentSevenDaysContext(db: Database, userId: string): Promise<string> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS);

  const [recentLogs, recentNotes, recentProjectItems] = await Promise.all([
    // 1. Brag logs from the last 7 days
    db
      .select({
        title: bragLogs.title,
        action: bragLogs.action,
        result: bragLogs.result,
        createdAt: bragLogs.createdAt,
      })
      .from(bragLogs)
      .where(and(eq(bragLogs.userId, userId), gte(bragLogs.createdAt, since)))
      .orderBy(desc(bragLogs.createdAt)),

    // 2. Notes created or updated in the last 7 days
    db
      .select({
        title: notes.title,
        content: notes.content,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(and(eq(notes.userId, userId), gte(notes.updatedAt, since)))
      .orderBy(desc(notes.updatedAt)),

    // 3. Project items updated or shipped in the last 7 days
    db
      .select({
        itemTitle: projectItems.title,
        kind: projectItems.kind,
        status: projectItems.status,
        projectName: projects.name,
        updatedAt: projectItems.updatedAt,
      })
      .from(projectItems)
      .innerJoin(projects, eq(projectItems.projectId, projects.id))
      .where(and(eq(projectItems.userId, userId), gte(projectItems.updatedAt, since)))
      .orderBy(desc(projectItems.updatedAt)),
  ]);

  // Combine and sort chronologically by date descending
  const events = [
    ...recentLogs.map((l) => ({
      date: l.createdAt,
      type: "Brag Log",
      text: `[Brag Log] "${l.title}": Action: ${l.action} -> Result: ${l.result}`,
    })),
    ...recentNotes.map((n) => ({
      date: n.updatedAt,
      type: "Note",
      text: `[Note] "${n.title}": ${n.content.slice(0, 300)}`,
    })),
    ...recentProjectItems.map((p) => ({
      date: p.updatedAt,
      type: "Project Item",
      text: `[Project Item in "${p.projectName}"] (${p.kind}, ${p.status}): ${p.itemTitle}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (events.length === 0) {
    return "";
  }

  return events.slice(0, 15).map((e) => `- ${e.text}`).join("\n");
}
```

### 4.2 AI Prompting in `src/worker/lib/ai-client.ts`

```ts
const DAILY_LEARNING_SYSTEM_PROMPT = [
  "You are an Elite Staff Engineer and Technical Mentor guiding a software engineer.",
  "You are given a chronological feed of the engineer's actual work over the LAST 7 DAYS",
  "(their project backlog items, brag logs, and notes).",
  "Your job is to recommend ONE hyper-relevant, concrete technical topic for them to learn today.",
  "Rules:",
  "1. The topic MUST directly build upon, harden, or optimize what they built/documented in the last 7 days.",
  "2. Do NOT recommend generic beginner roadmaps. Propose a specific architectural pattern,",
  "   performance nuance, edge-case hardening, or internal mechanism relevant to their recent work.",
  "3. Clearly explain: 'Because you built [X] in [Project Y], the next natural concept to master is [Z]'.",
  "4. Provide a concrete practical next step (a 1-2h spike, benchmark, or prototype).",
].join(" ");

export const dailyLearningAiOutputSchema = z.object({
  title: z.string().describe("Punchy, specific topic (e.g. 'Connection Pooling & Prepared Statement Caching in D1')"),
  category: z.string().describe("e.g. 'Architecture', 'Reliability', 'Performance', 'Deep Internals'"),
  reason: z.string().describe("Explicit connection to their recent 7-day project, brag log, or note"),
  practicalNextStep: z.string().describe("A concrete 1-2h spike or mini-experiment to build today"),
  suggestedOutline: z.string().describe("Markdown outline with 3-4 guiding questions for a Note"),
  suggestedTags: z.array(z.string()).describe("2 to 4 relevant tags"),
  sourceContextSummary: z.string().describe("Short badge text summarizing source (e.g. 'Inspired by your work on Auth Service & SQLite Notes')"),
});
```

### 4.3 API Route Endpoints (`src/worker/features/dashboard/route.ts`)

Mounting endpoints under `/api/dashboard/learning-suggestion`:

1. **`GET /api/dashboard/learning-suggestion`** (Query: `tz_offset`)
   - Computes `todayKey = localDayKey(Date.now(), tzOffset)`.
   - Queries `dailyLearningSuggestions` for `userId` and `date = todayKey`.
   - Returns `{ suggestion, hasRecentActivity, todayKey, regenerationsLeft }`.
   - Fast, cached, zero AI latency on page visits.
2. **`POST /api/dashboard/learning-suggestion/generate`** (Body: `{ tz_offset }`)
   - If a suggestion already exists for today, returns existing (idempotent).
   - Otherwise, gathers 7-day activity context, calls AI, inserts row with `regenerateCount = 0`, records `ai_usage`.
3. **`POST /api/dashboard/learning-suggestion/regenerate`** (Body: `{ tz_offset }`)
   - Looks up today's record.
   - If `regenerateCount >= 3`: returns `400 Bad Request` (`"Daily regeneration limit reached (3/3). Resets tomorrow."`).
   - Gathers 7-day context, calls AI requesting an alternative direction, updates the existing row, increments `regenerateCount + 1`.
4. **`POST /api/dashboard/learning-suggestion/:id/action`**
   - Updates status: `"saved_as_spark"` or `"converted_to_note"`.

---

## 5. Frontend Dashboard Integration (`src/client/features/dashboard/`)

### 5.1 Component: `DailyLearningCard` (`daily-learning-card.tsx`)

Rendered in the right-hand column of `DashboardPage` below or alongside the *Competency Snapshot*:

```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Today's Learning Suggestion                              │
│ Based on your work from the last 7 days                     │
├─────────────────────────────────────────────────────────────┤
│ 🏷️ ARCHITECTURE  ·  Inspired by your work on Projects & Notes│
│                                                             │
│ Optimistic Concurrency Control with ETag Versioning         │
│                                                             │
│ "Because you recently shipped the Project Items queue and   │
│ wrote notes on state updates, mastering OCC will prevent    │
│ silent write collisions under high concurrency."            │
│                                                             │
│ 🎯 Practical Next Step:                                     │
│ Build a minimal prototype checking version headers before   │
│ database writes and asserting a 412 Precondition Failed.    │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [⚡ Save as Spark]   [📝 Start Note]                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ 🔄 Regenerate (2 left today)           Resets at midnight   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Key Interactions
1. **Regenerate Button & Limit Indicator:**
   - Displays `Regenerate (${regenerationsLeft} left today)`.
   - If `regenerationsLeft === 0`: Button is disabled with tooltip *"Daily limit reached (3/3 regenerations used). Resets tomorrow."*
2. **1-Click "Save as Spark":**
   - Calls `createSpark({ content: `[Learning Spike] ${suggestion.title}: ${suggestion.practicalNextStep}` })`.
   - Updates suggestion status to `"saved_as_spark"`.
   - Displays toast: *"Saved to your Sparks inbox!"*.
3. **1-Click "Start Note":**
   - Navigates to `/notes/new?title=${encodeURIComponent(suggestion.title)}&tags=${encodeURIComponent(suggestion.suggestedTags.join(','))}`.
   - Note editor prefills the title, tags, and suggested inquiry template.
4. **Empty 7-Day State (No recent uploads):**
   - Friendly banner:
     *"No dev activity logged in the last 7 days. Log a brag, note, or project item to generate hyper-relevant suggestions, or click below for a foundational topic."*
     Button: `[✨ Suggest a Starter Topic]`

---

## 6. Testing & Quality Strategy

### 6.1 Isolation Tests (`tests/isolation/daily-learning.test.ts`)
1. **Per-user isolation:**
   - `User A` cannot view or regenerate `User B`'s suggestion (returns 404).
2. **Daily Unique Constraint:**
   - Ensures only 1 suggestion exists per `(user_id, date)`.
3. **Regeneration Limit Enforcement:**
   - Test initial generation has `regenerateCount = 0`.
   - Perform 3 regenerations (`regenerateCount = 1, 2, 3`).
   - 4th regeneration returns `400 Bad Request` with error message.
4. **7-Day Filtering Verification:**
   - Mock notes and brag logs: items older than 7 days are excluded from the AI context payload.
   - Items from the last 7 days are included and sorted by date.
5. **AI Call Stubbing:**
   - Test runs inside Workers pool with `vi.stubGlobal("fetch", ...)`.
   - Verifies `ai_usage` row is inserted with token counts.

### 6.2 Verification Commands
```bash
bun run typecheck
bun run lint
bunx vitest run tests/isolation/daily-learning.test.ts
```

---

## 7. Implementation Checklist

- [ ] **Step 1: Schema & Migration**
  - Add `dailyLearningSuggestions` table to `src/worker/db/schema.ts` with unique `(userId, date)`.
  - Run `bun run db:generate` and `bun run db:migrate:local`.
- [ ] **Step 2: Shared Types**
  - Create `src/shared/schemas/learning-suggestions.ts`.
- [ ] **Step 3: AI Engine**
  - Add `DAILY_LEARNING_SYSTEM_PROMPT` and `generateDailyLearningSuggestion` in `src/worker/lib/ai-client.ts`.
- [ ] **Step 4: Worker Service & Routes**
  - Implement 7-day query aggregator in `src/worker/features/dashboard/learning-service.ts`.
  - Add endpoints to `src/worker/features/dashboard/route.ts`.
- [ ] **Step 5: Frontend Component & Queries**
  - Add query/mutation hooks in `src/client/features/dashboard/api.ts`.
  - Build `daily-learning-card.tsx` with remaining regeneration counters.
  - Mount on `dashboard-page.tsx`.
- [ ] **Step 6: Isolation Tests**
  - Write and pass `tests/isolation/daily-learning.test.ts`.

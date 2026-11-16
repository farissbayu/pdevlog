# Implementation Plan — Phase 1: Focus, Evidence, Output

**Status:** Proposed
**Scope:** Kurangi permukaan produk (cut), lalu tambahkan 4 hal kecil yang memperkuat value proposition.
**Runtime:** Cloudflare Workers + D1 + R2, React 19 SPA + Hono API dalam satu Worker (lihat `AGENTS.md`).
**Migration:** **tidak ada satupun step yang butuh migration baru.** Semua perubahan schema di level JSON column + Zod, bukan kolom baru.

---

## 1. Konteks & keputusan

Audit produk menyimpulkan *promising problem, unfocused solution*. Setelah menelusuri kode, masalahnya bukan kekurangan fitur:

- Capture → STAR sudah ada: `POST /api/brag-logs/star-breakdown` (`src/worker/features/brag-logs/route.ts:589`) dan tombol "Generate with AI" di `src/client/features/brag-logs/brag-log-form.tsx:122`.
- AI competency sudah dua tahap dan sudah di-grounding ke CV + brag log + notes (`REALITY_EXTRACTION_SYSTEM_PROMPT`, `BLIND_SPOT_AUDIT_SYSTEM_PROMPT` di `src/worker/lib/ai-client.ts`).
- Markdown export sudah ada (`src/worker/features/export/route.ts`).

Jadi pekerjaan Phase 1 adalah **memangkas yang tidak perlu, dan menutup 3 lubang konkret**:

| # | Aksi | Alasan | Ukuran diff |
|---|------|--------|-------------|
| 0 | Cut Daily Learning suggestion | Produk kedua di dalam dashboard, ~950 baris + 1 panggilan AI/user/hari, tidak masuk problem space manapun | −950 baris |
| 1 | Cut framing streak | Audit P4: jangan bikin user merasa bersalah saat kena production incident | −120 baris |
| 2 | Demote Sparks/changelog dari landing hero path | Phase 3, bukan janji utama | −60 baris |
| 3 | Export `format=bullets` | Activation moment: output yang bisa langsung ditempel ke CV/review | +90 baris |
| 4 | `evidenceLogs` di skill strengths | Membuat klaim "evidence-linked" jadi benar dan bisa diklik | +70 baris |
| 5 | Dashboard outcome stats + first-capture | Dashboard sekarang menghitung input, bukan hasil | +80 baris |
| 6 | Download note `.md` | Landing menjanjikan "Notes as .md", yang ada cuma print | +20 baris |

Urutan pengerjaan **0 → 1 → 2 → 3 → 4 → 5 → 6**. Step 0–2 adalah penghapusan: kerjakan dulu supaya kalau ada yang salah, `git revert`-nya bersih dan tidak menyentuh fitur baru.

### Non-goals (sengaja tidak dikerjakan)

- GitHub OAuth integration — OAuth + rate limit + backfill + risiko surveillance. Versi lazy-nya sudah ada: paste URL PR ke source brag log (`src/client/features/sources/url-extractor.ts`).
- Vectorize/RAG, public portfolio, activity heatmap baru, zip backup, push notification.
- Rename file/route lama (`check-in` tetap bernama `check-in`) — rename hanya menambah churn, bukan value.

### Aturan kerja

1. Satu step = satu commit (lowercase Conventional Commits).
2. Tiap step: `bun run typecheck && bun run lint` lalu file test terkait, baru full `bun run test`.
3. Jangan menyentuh `src/client/app/router.tsx` kecuali step 3 (tidak ada route baru).
4. Tidak menambah dependency.

---

## 2. Step 0 — Cut Daily Learning Suggestion

**Tujuan:** dashboard kembali jadi satu hal (progres dokumentasi), bukan dua produk.

### 2.1 File yang dihapus

| File | Baris | Isi |
|------|-------|-----|
| `src/client/features/dashboard/daily-learning-card.tsx` | 316 | kartu AI suggestion |
| `src/worker/features/dashboard/learning-service.ts` | 211 | `loadLearningContext`, `hasRecentActivity` |
| `src/shared/schemas/learning-suggestion.ts` | 91 | schema request/response |
| `tests/isolation/daily-learning.test.ts` | ~320 | 6 test |

### 2.2 `src/worker/features/dashboard/route.ts`

Hapus:

- Import: `dailySuggestionQuerySchema`, `MAX_DAILY_REGENERATIONS`, `parseSuggestionSources`, `suggestionActionSchema`, `suggestionTzBodySchema`, `DailyLearningSuggestion`, `DailySuggestionQuery`, `DailySuggestionResponse`, `SuggestionActionInput`, `SuggestionSource`, `SuggestionTzBody` (dari `@/shared/schemas/learning-suggestion`), `dailyLearningSuggestions`, `DailyLearningSuggestionRow` (dari `@/worker/db/schema`), `DailyLearningSuggestionError`, `generateDailyLearningSuggestion` (dari `@/worker/lib/ai-client`), `hasRecentActivity`, `loadLearningContext` (dari `./learning-service`).
- Type `JsonInput<T>` — hanya dipakai handler learning.
- Handler + helper: `toSuggestionResponse`, `findTodaySuggestion`, `parsePreviousTitles`, `loadAvoidTitles`, `pickCitedSources`, `recordAiUsage`, `getLearningSuggestion`, `generateLearningSuggestion`, `regenerateLearningSuggestion`, `updateLearningSuggestionAction` (blok ± baris 216–560).
- 4 mount terakhir di `dashboardRoute()` (`/learning-suggestion`, `/learning-suggestion/generate`, `/learning-suggestion/regenerate`, `/learning-suggestion/:id/action`).

Sisa `dashboardRoute`:

```ts
export const dashboardRoute = new Hono<AppEnv>()
  .get("/", getDashboard)
  .get("/recent", getRecentActivity)
  .get("/check-ins", zValidator("query", checkInsQuerySchema), getCheckIns);
```

### 2.3 `src/worker/lib/ai-client.ts`

Hapus `DAILY_LEARNING_SYSTEM_PROMPT`, `dailyLearningSuggestionSchema`, `DailyLearningSuggestionError`, `DailyLearningAiSuggestion`, `DailyLearningSuggestionResult`, `generateDailyLearningSuggestion`. Tidak ada test unit yang menyentuh fungsi ini (dicek: `tests/unit/ai-client.test.ts` hanya STAR + refine).

### 2.4 `src/client/features/dashboard/api.ts` & `dashboard-page.tsx`

- `api.ts`: hapus `LEARNING_SUGGESTION_KEY`, `fetchLearningSuggestion`, `generateLearningSuggestion`, `regenerateLearningSuggestion`, `updateLearningSuggestionStatus`, `learningSuggestionQueryOptions`, `useLearningSuggestionQuery`, `useGenerateLearningSuggestionMutation`, `useRegenerateLearningSuggestionMutation`, `useUpdateLearningSuggestionStatusMutation` (± 100 baris).
- `dashboard-page.tsx`: hapus `import { DailyLearningCard }` dan `<DailyLearningCard />`.

### 2.5 `src/worker/db/schema.ts`

Tabel **dipertahankan** (data tidak hilang, nol migration). Tambahkan penanda:

```ts
// ponytail: feature dihapus di Phase 1, tabel sengaja tidak di-drop.
// Drop lewat migration terpisah kalau sudah yakin tidak akan dihidupkan lagi.
export const learningSuggestionStatuses = [...]
```

### 2.6 `docs/plan/suggest-what-to-learn.md`

Tambahkan di bawah judul: `**Status:** Deferred — kode dihapus di Phase 1 (lihat phase-1-focus.md). Tabel D1 dipertahankan.`

### 2.7 Verifikasi

```bash
bun run typecheck && bun run lint
grep -rn "learning-suggestion\|DailyLearning\|dailyLearningSuggestions" src tests   # hanya schema.ts
bun run test
```

---

## 3. Step 1 — Buang framing streak, pertahankan heatmap

Streak bukan datanya yang salah, framing-nya yang salah. Heatmap (calendar activity) tetap; angka streak + copy rasa bersalah dihapus.

### 3.1 `src/worker/features/dashboard/service.ts`

- Hapus `computeStreaks`, `StreakSummary`, `epochDay`.
- Pertahankan `localDayKey`, `tzModifier`, `loadActiveDays`.

### 3.2 `src/shared/schemas/check-in.ts`

```ts
export const checkInsResponseSchema = z.object({
  days: z.array(checkInDaySchema),
  todayActive: z.boolean(),
});
```

`currentStreak` / `longestStreak` dihapus. Nama file & nama route **tidak** diubah.

### 3.3 `src/worker/features/dashboard/route.ts` (`getCheckIns`)

```ts
const days = await loadActiveDays(db, userId, tzOffset);
const todayActive = days.some((day) => day.date === localDayKey(Date.now(), tzOffset));

return c.json({ days, todayActive } satisfies CheckInsResponse);
```

### 3.4 `src/client/features/dashboard/check-in-card.tsx`

- Hapus dua `SummaryRow` streak ("Current streak", "Best streak"), import `Flame`/`Trophy`, dan destructuring `currentStreak`/`longestStreak`.
- Judul kartu: `Daily Check-In` → `Activity`; deskripsi tetap.
- Copy empty state: `No activity yet — write a spark to start your streak.` → `No activity yet — write a spark to start.`

### 3.5 `src/client/features/dashboard/dashboard-page.tsx`

- Hapus `currentStreak`.
- Subtitle:
  - `todayTotal > 0` → `${countLabel(todayTotal, "entry")} today · ${countLabel(weekTotal, "thing")} this week.`
  - selain itu → `${countLabel(weekTotal, "thing")} logged this week.` / `Nothing logged yet — your first entry starts the record.`
- Strip hero (baris ± 327–356): angka streak diganti `${countLabel(weekTotal, "thing")} documented this week`; badge archetype **tetap**. Hapus import `Flame` kalau jadi tidak terpakai.

### 3.6 Test

- Hapus `tests/unit/check-in-streaks.test.ts`.
- `tests/isolation/check-ins.test.ts`: hapus 2 test streak ("computes current and longest streaks across a gap", "keeps the streak alive through yesterday..."), update `CheckInsBody` type, dan pastikan test timezone masih menguji `days` + `todayActive`.

### 3.7 Verifikasi

```bash
bunx vitest run tests/isolation/check-ins.test.ts
grep -rn "currentStreak\|longestStreak" src tests   # harus kosong
```

---

## 4. Step 2 — Demote Sparks/changelog dari landing hero path

Bukan menghapus fitur, hanya berhenti menjualnya di janji utama.

### 4.1 `src/client/features/landing/landing-page.tsx`

- `comparison`: hapus baris `"Exploring New Tech"` dan `"Ideas & Inspiration"`.
- Section `#solution`: hapus blok Sparks/changelog yang memetakan `sparksPoints`, dan hapus `const sparksPoints` kalau jadi tidak terpakai.
- `faqs`: tambah satu baris yang menyebut Sparks apa adanya — *"Where do quick ideas go? Press Cmd+K ... they become a brag log or project item when you're ready."*
- `routine`: baris "While Coding · 10 seconds" tetap (capture tanpa friction masih janji inti), baris "Weekend · 20 minutes / Clear the inbox" boleh tetap.

### 4.2 Yang **tidak** dikerjakan (keputusan sadar)

`Tags` di sidebar **tidak** dihapus. `/tags` adalah halaman manajemen tag (create/rename/delete, 380 baris) — menghapusnya dari nav akan mengubahnya jadi halaman yatim. Revisit kalau sidebar punya overflow menu.

### 4.3 Verifikasi

Manual: `bun run dev` → buka `/`, cek alur hero → problem → comparison → solution tidak menyebut changelog di 2 layar pertama.

---

## 5. Step 3 — Export brag log sebagai CV bullets

Output yang bisa langsung dipakai = alasan user kembali minggu depan. Deterministik, tanpa AI, tanpa biaya.

### 5.1 `src/shared/schemas/settings.ts`

```ts
export const exportFormatSchema = z.enum(["star", "bullets"]);

export const exportLogsQuerySchema = z.object({
  from: optionalDateSchema,
  to: optionalDateSchema,
  format: exportFormatSchema.optional(),
});
```

`format` sengaja `.optional()` (bukan `.default("star")`) supaya tipe input & output `zValidator` tetap sama dan client Hono (`hc<AppType>`) tidak memaksa mengirim field ini.

### 5.2 File baru: `src/worker/features/export/format.ts`

Fungsi murni, tanpa dependency Hono — supaya bisa diuji langsung.

```ts
export type ExportFormat = "star" | "bullets";

export function collapseWhitespace(text: string): string;

/** Potong di akhir kalimat terdekat sebelum `max`; fallback ke batas kata + "…". */
export function trimToSentence(text: string, max: number): string;

/** "- **Title** — <result ringkas> (2026-03-12 · Database, Backend)" */
export function bulletLine(
  log: { title: string; result: string; occurredAt: string },
  tagNames: string[],
): string;
```

Aturan `bulletLine`:
- `result` di-collapse whitespace, dipotong `trimToSentence(..., 200)`.
- `tagNames` di-join `", "` dan di-append hanya kalau tidak kosong, dalam kurung setelah tanggal: `(2026-03-12 · Database, Backend)`.
- Tidak ada AI, tidak ada ringkasan karangan. Kalau `result` kosong, jatuh ke `action` (fallback 1 baris).

### 5.3 `src/worker/features/export/route.ts`

Refactor supaya query & pemuatan baris dipakai dua format:

```ts
async function loadExportRows(c, userId, from, to)  // isi lama baris 28-58
function renderStarExport(rows): string            // isi lama baris 60-111
function renderBulletsExport(rows): string         // baru
```

`renderBulletsExport`:

```
# Brag Log Bullets

> Exported from Personal Dev Log on 2026-11-16
> 12 entries · 2026-01-01 → 2026-11-16

- **Fixed order endpoint latency** — Reduced p95 from 800ms to 45ms by adding a composite index and batching the query. (2026-03-12 · Database, Backend)
- **...**
```

Handler:

```ts
const format = c.req.valid("query").format ?? "star";
const filename = format === "bullets" ? "brag-log-bullets.md" : "brag-logs.md";
return c.body(render(format), 200, {
  "Content-Type": "text/markdown; charset=utf-8",
  "Content-Disposition": `attachment; filename="${filename}"`,
});
```

`format=star` wajib menghasilkan output **byte-identik** dengan sekarang (regression guard).

### 5.4 `src/client/features/settings/api.ts`

`exportBragLogs(query)` menerima `format` dan memakai filename dari format. Hapus string `"brag-logs.md"` yang di-hardcode.

### 5.5 `src/client/features/settings/settings-page.tsx`

Di kartu "Export data", dua tombol dalam satu baris (share `from`/`to`):
- `Download STAR (.md)` → `format: "star"`
- `Download CV bullets (.md)` → `format: "bullets"`
- Deskripsi: *"STAR = full story per entry. Bullets = one impact line per entry, siap tempel ke CV atau performance review."*

### 5.6 Test

**Baru:** `tests/unit/export-format.test.ts` — `trimToSentence` (kalimat utuh, potong di batas kata, teks pendek), `bulletLine` (dengan tag, tanpa tag, result kosong → action).

**Baru:** `tests/isolation/export.test.ts` (copy pola `createUser`/`request` dari `tests/isolation/workspaces.test.ts`):
1. 401 tanpa cookie.
2. `format=bullets` dengan 2 log → body mengandung `# Brag Log Bullets`, 2 baris `- **`, nama tag di meta.
3. `format=star` → body masih `# Brag Logs` + `### Situation` (regression).
4. `Content-Disposition` berisi `brag-log-bullets.md`.
5. Filter `from`/`to` berlaku sama untuk kedua format.
6. Isolasi: user B tidak melihat bullet user A.

### 5.7 Verifikasi

```bash
bunx vitest run tests/unit/export-format.test.ts tests/isolation/export.test.ts
bun run typecheck
```

---

## 6. Step 4 — `evidenceLogs` di skill strengths

Klaim di `PRODUCT.md`: *every growth claim traces back to the user's own recorded evidence*. Sekarang `evidenceSummary` cuma teks bebas yang tidak bisa diverifikasi. Step ini membuatnya jadi tautan yang bisa diklik.

### 6.1 `src/shared/schemas/profile.ts`

```ts
export const skillEvidenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const skillStrengthItemSchema = z.object({
  area: z.string().min(1),
  description: z.string().min(1),
  evidenceSummary: z.string(),
  evidenceLogs: z.array(skillEvidenceSchema).default([]),
});
```

`.default([])` = insights lama yang sudah tersimpan (tanpa field ini) tetap lolos `safeParse` di `parseSkillInsights` (`src/worker/features/profile/service.ts:30`). Tidak perlu migration.

### 6.2 `src/worker/lib/ai-client.ts`

- Schema AI (bukan schema publik):

```ts
const realityExtractionSchema = z.object({
  ...
  strengths: z.array(
    skillStrengthItemSchema
      .omit({ evidenceLogs: true })
      .extend({ evidenceLogIds: z.array(z.string()).max(10) }),
  ),
  ...
});
```

- `REALITY_EXTRACTION_SYSTEM_PROMPT`: tambah satu aturan —
  *"- strengths[].evidenceLogIds: copy verbatim the ids from the `Brag Log [id=...]` lines that directly support the claim. Only ids present in the input; empty array when nothing supports it. Never invent an id."*
- Signature:

```ts
export async function analyzeDeveloperCompetencies(
  env: AppEnv["Bindings"],
  cvMarkdown: string,
  devlogContext?: string,
  evidenceTitlesById?: Map<string, string>,
): Promise<SkillInsightsResult>
```

- Setelah `reality` parse, map strengths → `SkillInsights`:

```ts
const strengths = reality.data.strengths.map((s) => ({
  area: s.area,
  description: s.description,
  evidenceSummary: s.evidenceSummary,
  evidenceLogs: s.evidenceLogIds
    .map((id) => ({ id, title: evidenceTitlesById?.get(id) ?? "" }))
    .filter((e) => e.title !== ""),
}));
```

Filter terhadap map = anti-halusinasi: id karangan AI dibuang, judul tidak pernah dari AI.

### 6.3 `src/worker/features/profile/service.ts` (`analyzeAndSaveSkillInsights`)

- Select tambah `id: bragLogs.id` (limit 5 tetap — `ponytail: hanya 5 log terbaru jadi evidence source; naikkan limit kalau user mengeluh evidence kurang`).
- Format context:

```ts
devlogEntries.push(
  `- Brag Log [id=${log.id}] "${log.title}": [Action] ${log.action} -> [Result] ${log.result}`,
);
```

- Bangun map & teruskan:

```ts
const evidenceTitlesById = new Map(recentBragLogs.map((log) => [log.id, log.title]));
const { insights, usage } = await analyzeDeveloperCompetencies(
  env, profile.cvMarkdown, devlogContext, evidenceTitlesById,
);
```

### 6.4 `src/client/features/profile/components/skill-insights-view.tsx`

Di bawah blok `Evidence:` (baris ± 168):

```tsx
{s.evidenceLogs.length > 0 ? (
  <ul className="mt-2 flex flex-wrap gap-1.5">
    {s.evidenceLogs.map((entry) => (
      <li key={entry.id}>
        <Link
          to={`/brag-logs/${entry.id}`}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <FileText className="size-3" />
          {entry.title}
        </Link>
      </li>
    ))}
  </ul>
) : null}
```

Tambah import `Link` dari `react-router`. Jumlah entri (`s.evidenceLogs.length`) sekaligus jadi sinyal "confidence" tanpa field baru.

### 6.5 Test

Perluas `tests/isolation/profile.test.ts` (sudah punya `runQueuedAiJob` + `vi.stubGlobal`):
1. Mock AI mengembalikan 1 strength dengan `evidenceLogIds: [knownId, "invented-id"]` → `GET /api/profile` → `strengths[0].evidenceLogs === [{ id: knownId, title: "..." }]` (id karangan dibuang).
2. Legacy JSON: insert `user_profiles.skill_insights` lama (tanpa `evidenceLogs`) langsung via D1 → `GET /api/profile` tetap 200 dan `evidenceLogs: []`.
3. Isolasi: log milik user lain tidak pernah menjadi evidence user A.

### 6.6 Verifikasi

```bash
bunx vitest run tests/isolation/profile.test.ts tests/unit/ai-client.test.ts
```

---

## 7. Step 5 — Dashboard outcome stats + first capture

### 7.1 `src/shared/schemas/dashboard.ts`

```ts
export const dashboardStatsSchema = z.object({
  achievements: z.number(),
  achievementsThisMonth: z.number(),
  skillsEvidenced: z.number(),
  projectsDocumented: z.number(),
  sparksInbox: z.number(),
});
```

Field lama (`workspaces`, `bragLogs`, `notes`, `sparks`) dihapus — `dashboardResponseSchema` tetap punya `recentWorkspaces`.

### 7.2 `src/worker/features/dashboard/route.ts` (`getDashboard`)

```ts
const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
// ponytail: batas bulan pakai UTC, bukan tz user. Ganti ke tz_offset kalau user komplain.
```

Lima query paralel:

| Field | Query |
|-------|-------|
| `achievements` | `count()` dari `bragLogs` where `userId` |
| `achievementsThisMonth` | `count()` where `userId` AND `gte(bragLogs.occurredAt, monthStart)` |
| `skillsEvidenced` | `countDistinct(bragTags.tagId)` — `bragTags` innerJoin `bragLogs` on `bragLogId`, where `bragLogs.userId` |
| `projectsDocumented` | `count()` dari `projects` where `userId` |
| `sparksInbox` | `count()` dari `sparks` where `userId` AND `status = 'open'` |

`recentWorkspaces` tidak berubah.

### 7.3 `src/client/features/dashboard/dashboard-page.tsx`

- `StatCard` type tambah `hint?: string`; render sebagai `<p className="text-xs text-muted-foreground">` di bawah label.
- Kartu baru (ganti 4 kartu lama):

| Label | value | hint | to |
|-------|-------|------|----|
| Achievements | `achievements` | `+N this month` | `/brag-logs` |
| Skills evidenced | `skillsEvidenced` | `from your own logs` | `/profile` |
| Projects documented | `projectsDocumented` | — | `/workspaces` |
| Sparks inbox | `sparksInbox` | `open` | `/sparks` |

- Render `<FirstAchievementCard />` tepat setelah grid kartu, hanya kalau `stats.achievements === 0`.

### 7.4 File baru: `src/client/features/dashboard/first-achievement-card.tsx`

Reuse hook yang sudah ada — tidak ada endpoint baru.

```tsx
export function FirstAchievementCard() {
  const [content, setContent] = useState("");
  const generate = useGenerateStarBreakdownMutation();  // @/client/features/brag-logs/api
  const create = useCreateBragLogMutation();            // sudah invalidate ["dashboard"]

  const submit = () => {
    generate.mutate(
      { content: content.trim() },
      {
        onSuccess: (breakdown) =>
          create.mutate(
            { ...breakdown, occurred_at: new Date().toISOString().slice(0, 10) },
            { onSuccess: () => toast.success("First achievement saved") },
          ),
        onError: (error) => toast.error(error.message),
      },
    );
  };
  // <Card>: h2 "What did you ship today?", textarea (4 baris),
  // hint "Rough note is fine — AI writes the STAR.",
  // Button disabled kalau content.length < 20 atau generate.isPending || create.isPending.
}
```

Catatan:
- `content` minimum 20 karakter mengikuti `starBreakdownInputSchema` (validasi sebenarnya tetap di worker).
- Rate limit `star-breakdown` 10/menit per IP — tidak perlu penanganan khusus.
- Setelah create sukses, `stats.achievements` berubah jadi ≥1 dan kartu hilang sendiri (tidak butuh state dismiss).

### 7.5 Test

**Baru:** `tests/isolation/dashboard.test.ts`:
1. User baru → semua 0.
2. Insert 2 brag log (satu `occurred_at` bulan ini, satu bulan lalu) + 2 tag di log pertama + 1 project → `achievements: 2`, `achievementsThisMonth: 1`, `skillsEvidenced: 2`, `projectsDocumented: 1`.
3. User B tidak melihat angka user A (isolasi).

### 7.6 Verifikasi

```bash
bunx vitest run tests/isolation/dashboard.test.ts
bun run typecheck   # pastikan client & worker sepakat soal shape stats
```

---

## 8. Step 6 — Download note sebagai `.md`

Landing (`landing-page.tsx`, `sovereignty`) menjanjikan *"Download all your Brag Logs and Notes as pure .md files"*. Brag log: ada. Notes: cuma print. Tutup gap-nya, jangan turunkan klaim.

### 8.1 `src/client/features/notes/note-detail-page.tsx`

Tombol ikon `Download .md` di header aksi, tepat sebelum tombol "Download PDF" yang sudah ada (`note-detail-page.tsx:202`):

```ts
const downloadMarkdown = () => {
  const body = `# ${note.title}\n\n${note.content}\n`;
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(note.title)}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
```

`slug` dari `github-slugger` (sudah dependency, dipakai `rehype-slug`). Client-only, tidak ada endpoint, tidak ada test (trivial).

### 8.2 Verifikasi

Manual: buka note → download → isi file = `# Title` + markdown apa adanya (title ditambahkan sebagai H1 supaya file bisa dibaca berdiri sendiri).

---

## 9. Urutan commit

```
chore: remove daily learning suggestion feature
refactor: drop streak tracking from dashboard
chore: move sparks and changelog out of the landing hero path
feat: export brag logs as cv bullets
feat: link skill strengths to supporting brag logs
feat: outcome-focused dashboard stats and first-achievement capture
feat: download notes as markdown
```

CI (`.github/workflows/deploy.yml`) jalan `typecheck -> test -> db:migrate:remote -> deploy`; karena tidak ada migration baru, `db:migrate:remote` hanya menjalankan migration yang sudah ada (no-op).

---

## 10. Checklist akhir

- [ ] `grep -rn "learning-suggestion\|DailyLearning" src` → hanya `schema.ts`
- [ ] `grep -rn "streak" src` → hanya komentar migrasi/DB kalau ada
- [ ] `bun run typecheck && bun run lint && bun run test` hijau
- [ ] `POST /api/brag-logs/star-breakdown` masih jalan (test `tests/isolation/brag-log-ai.test.ts`)
- [ ] `GET /api/export/brag-logs?format=star` byte-identik dengan sebelumnya
- [ ] Dashboard user baru menampilkan kartu first-capture, dan menghilang setelah 1 achievement
- [ ] `/profile` menampilkan chip evidence yang mengarah ke brag log yang benar
- [ ] Tidak ada migration baru di `drizzle/`

---

## 11. Keputusan (sudah diambil, 2026-11-16)

1. **Tabel `daily_learning_suggestions`: di-drop.** Migration `drizzle/0026_hot_wrecker.sql` (`DROP TABLE daily_learning_suggestions;`), schema.ts dibersihkan, bukan dibiarkan yatim.
2. **`docs/plan/suggest-what-to-learn.md`: dihapus.** Rencananya sudah tidak relevan.
3. **Bullet CV: deterministik**, tanpa panggilan AI. Format `- **Title** — <result ringkas> (tanggal · tag)`.
4. **Heatmap activity: tetap.** Yang dihapus hanya angka streak, baris "Current/Best streak", dan copy rasa bersalah.
5. **Eksekusi:** Step 0–6 dikerjakan dalam satu pass, bukan PR terpisah.

### Status implementasi

- [x] Step 0 — Daily Learning + tabel + route + prompt + test dihapus
- [x] Step 1 — streak dihapus, heatmap dipertahankan, `/api/dashboard/check-ins` tetap
- [x] Step 2 — Sparks/changelog keluar dari jalur hero landing (FAQ + Cmd+K tetap)
- [x] Step 3 — `GET /api/export/brag-logs?format=bullets` + dua tombol di Settings
- [x] Step 4 — `evidenceLogs` per strength + prompt id + sanitasi anti-halusinasi
- [x] Step 5 — Dashboard outcome stats + kartu first-achievement
- [x] Step 6 — Download note `.md`
### Catatan eksekusi

- Diff bersih: **+800 / −2604 baris**, 25 test file / 177 test hijau, `tsc -b` dan `vite build` lulus.
- Migration `0026_hot_wrecker.sql` sudah dijalankan di D1 lokal. Remote jalan otomatis lewat CI saat push (`.github/workflows/deploy.yml`).
- 3 test yang sudah merah di working tree sebelum pass ini (sisa refactor yang belum di-commit) ikut diperbaiki: `tests/auth.test.ts` + `tests/isolation/ssr.test.ts` (ekspektasi `/api/health` 401 → 200, sesuai `AGENTS.md` dan middleware saat ini) dan helper `request()` di `tests/isolation/workspace-delete-cascade.test.ts` (jangan set `Content-Type: application/json` untuk body `FormData`).
- Perubahan **tidak di-commit**: working tree masih berisi refactor lain yang belum selesai; commit per-step di atas bisa dijalankan setelah refactor itu dirapikan.


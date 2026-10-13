# Technical Plan: Notes & Note Detail Responsive UI Fix

> **Status:** Draft / Planned  
> **Target Location:** [`docs/plan/notes-responsive-ui.md`](file:///home/farissbayu/projects/pdevlog/docs/plan/notes-responsive-ui.md)  
> **Target Version:** `pdevlog` v0.4+  
> **Audience:** Frontend & UX Engineer  
> **Core Objective:** Eliminate horizontal viewport overflow (`> 100vw`) and fix mobile layout/wrapping issues across the **Notes List Page (`/notes`)**, **Note Detail Page (`/notes/:id`)**, and shared **Notes / Filter / Markdown** components.

---

## 1. Problem Statement & Visual Diagnosis (From Screenshots)

On mobile viewports (`320px–639px`), both `/notes` and `/notes/:id` suffer from horizontal overflow that pushes content beyond the right edge of the viewport (`100vw`), causing the top `MobileHeader` border and main container to appear cut off on the right while fixed elements (`AppMobileBottomNav`) span the wider overflowed layout viewport.

| Page / View                              | Observed Symptom in Screenshot                                                                                                                                                                                     | Root Cause in Code                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Notes List (`/notes`)**             | Note cards (_"Background task handling using tanstack query"_) extend ~50–70px past the right edge of `FilterBar` and `MobileHeader`. The note title does not truncate with `…`.                                   | In [`note-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-list.tsx#L83-L95), `<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">` has no explicit `grid-cols-1` below `sm`, and the grid item `<li>` lacks `min-w-0`. Because `<Link className="block truncate ...">` uses `white-space: nowrap`, its intrinsic `min-content` width bubbles up to `<li>` (`min-width: auto` in CSS Grid), expanding the card to fit the entire unwrapped title string. |
| **2. Notes Filter Bar (`/notes`)**       | The date range row wraps unevenly: `📅 Date range [From date] to` on line 1, and `[To date]` orphaned on line 2. Long workspace names in the dropdown button can also stretch the row.                             | In [`filter-bar.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/filter-bar.tsx#L40-L148), both `DatePicker` buttons have fixed `w-40` inline with the label, which exceeds a single mobile line (`~327px` inner width) and forces awkward flex wrapping.                                                                                                                                                                                                                    |
| **3. Note Detail Header (`/notes/:id`)** | The page scrolls ~130–150px horizontally to the right. The title is squashed on the left (`...und`) while `[✂ Shred into Practice] [📄] [✏️] [🗑]` overflow past the right edge of `MobileHeader` and `<article>`. | In [`note-detail-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-detail-page.tsx#L136-L210), the header row uses `flex items-start justify-between gap-4` **without** `flex-col sm:flex-row` or `flex-wrap`. The 4-button action bar (`shrink-0`, `~300px` wide) is forced onto the same horizontal row as the `text-2xl` title (`min-content ~167px`), totaling `~483px` minimum width on a `375px` screen.                                                  |
| **4. Note Detail Body (`/notes/:id`)**   | Inside `<article>`, headings (`# Backogrund task handling using Tanstack Query`) only fit 1–2 words per line and risk horizontal overflow on long inline tokens/tables/code blocks.                                | Double `p-6` horizontal padding (`AppLayout` `p-6` + `<article>` `p-6` = `96px` lost width on mobile), missing explicit `grid-cols-1` below `lg` on the content/TOC grid, and `1.6rem` (`25.6px`) mobile `h1` size inside `.markdown-body`.                                                                                                                                                                                                                                                      |

---

## 2. Architectural & Layout Principles

To prevent CSS Grid and Flexbox children from blowing out mobile viewports across all Notes views:

1. **Explicit Single-Column Grid Track (`grid-cols-1`):**
   Every responsive CSS Grid (`sm:grid-cols-2`, `lg:grid-cols-[...]`) must include `grid-cols-1` (`grid-template-columns: repeat(1, minmax(0, 1fr))`) as its mobile base class so the mobile column track is bounded to `minmax(0, 1fr)` rather than `auto`.
2. **`min-w-0` on Grid & Flex Items:**
   Any grid item (`<li>`, `<div>`, `<article>`) or flex item containing `truncate`, `break-words`, or scrollable `<pre>` blocks must have `min-w-0` directly on the grid/flex item itself (not only on an inner child `<div>`).
3. **Mobile-First Stacking for Page Headers:**
   Detail page headers with multi-button toolbars must stack vertically on mobile (`flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`) so the title can use 100% of the width and action buttons sit cleanly on their own row below the metadata.
4. **Responsive Container Padding:**
   Use `p-4 sm:p-6` on mobile cards/containers so narrow screens (`320px–390px`) retain maximum readable line length without cramping typography.

---

## 3. File-by-File Implementation Plan

### 3.1 Fix Note Card Grid Overflow — [`src/client/features/notes/note-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-list.tsx)

#### Problems:

- `<ul>` in `NoteList` (line 83) and `NoteListSkeleton` (line 46) uses `grid gap-3 sm:grid-cols-2 xl:grid-cols-3` without `grid-cols-1`.
- `<li>` (line 85) lacks `min-w-0`, allowing `<Link className="block truncate ...">` to force the card wider than the screen.
- `{note.workspace ? <span>{note.workspace.name}</span> : null}` (line 104) lacks `truncate` protection if a workspace name is long.

#### Planned Changes:

```tsx
// NoteListSkeleton (line 46)
<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
  {[0, 1, 2].map((index) => (
    <li key={index} className="min-w-0 space-y-3 rounded-lg border bg-card p-4 sm:p-5">
      ...
```

```tsx
// NoteList (lines 81–123)
export function NoteList({ notes }: NoteListProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="min-w-0 rounded-lg border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:p-5"
        >
          <div className="min-w-0 space-y-2">
            <Link
              to={`/notes/${note.id}`}
              className="block truncate font-medium hover:underline"
            >
              {note.title}
            </Link>
            <p className="line-clamp-2 wrap-break-word text-sm text-muted-foreground">
              {noteExcerpt(note.content) || "Empty note"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Updated {formatNoteDate(note.updatedAt)}</span>
              {note.workspace ? (
                <WorkspaceTypeBadge type={note.workspace.type} />
              ) : null}
              {note.workspace ? (
                <span className="truncate">{note.workspace.name}</span>
              ) : null}
              {noteSourceCount(note) > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Link2 className="size-3" />
                  {noteSourceCount(note)}
                </span>
              ) : null}
            </div>
            ...
```

_(Note: Because `WorkspaceDetailPage` also renders `<NoteList />` under its Notes tab, fixing `note-list.tsx` automatically fixes note card responsiveness inside workspaces as well.)_

---

### 3.2 Make Filter Bar Mobile-Responsive — [`src/client/components/filter-bar.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/filter-bar.tsx)

#### Problems:

- Search input (`min-w-[200px] flex-1`) and filter dropdowns don't align cleanly on small viewports; long selected workspace names aren't truncated inside the trigger button.
- The Date Range row (`Date range` + `w-40` From + `to` + `w-40` To) overflows a single mobile line and wraps only the `To date` picker onto a second line.

#### Planned Changes:

1. **Search & Dropdown Controls Row (lines 40–128):**
   - Make `SearchInput` full width on mobile and flexible on `sm+`: `className="w-full sm:min-w-[200px] sm:w-auto sm:flex-1"`.
   - Give the Workspace and Tags `DropdownMenuTrigger` buttons `className="min-w-0 flex-1 justify-between sm:flex-initial"` and wrap their label text in `<span className="truncate">...</span>` with `<ChevronDown className="size-4 shrink-0 text-muted-foreground" />`.
2. **Date Range Controls Row (lines 130–148):**
   - Stack the `Date range` label above the date inputs on mobile (`flex-col items-stretch gap-2 sm:flex-row sm: flex-wrap sm:items-center`), and wrap `[From date] to [To date]` in a flex row where each `DatePicker` has `className="h-8 min-w-0 flex-1 sm:w-40 sm:flex-initial"`:
   ```tsx
   <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
     <span className="inline-flex items-center gap-1 text-muted-foreground">
       <CalendarDays className="size-4 shrink-0" />
       Date range
     </span>
     <div className="flex items-center gap-2">
       <DatePicker
         value={filters.from}
         onChange={api.setFrom}
         placeholder="From date"
         className="h-8 min-w-0 flex-1 sm:w-40 sm:flex-initial"
       />
       <span className="shrink-0 text-muted-foreground">to</span>
       <DatePicker
         value={filters.to}
         onChange={api.setTo}
         placeholder="To date"
         className="h-8 min-w-0 flex-1 sm:w-40 sm:flex-initial"
       />
     </div>
   </div>
   ```

---

### 3.3 Fix Note Detail Header, Action Bar & Layout Grid — [`src/client/features/notes/note-detail-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-detail-page.tsx)

#### Problems:

1. **Header Row (line 136):** `<div className="flex items-start justify-between gap-4">` does not stack on mobile, forcing the title and the 4 action buttons (`Shred into Practice`, `Download PDF`, `Edit`, `Delete`) onto a single overflowing line.
2. **Title Element (line 138):** `<h1 className="flex items-center gap-2 text-2xl font-semibold">` lacks `shrink-0` on `<NotebookPen>` and `break-words` / `min-w-0` on the title text. When a title wraps to multiple lines, `items-center` vertically centers the icon across all lines and squashes the SVG width.
3. **Action Buttons Row (line 175):** `<div className="flex shrink-0 items-center gap-2">` does not adapt to mobile width.
4. **Content + TOC Grid (line 249):** `<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">` lacks explicit `grid-cols-1` below `lg` (`< 1024px`).
5. **Article Card Padding (line 262):** `<article className="rounded-lg border bg-card p-6">` uses `24px` padding on all sides even on mobile, leaving too little horizontal width for Markdown headings and code blocks.

#### Planned Changes:

1. **Breadcrumb Link (lines 122–134):**
   Add `max-w-full` and `<span className="truncate">` around the workspace/notes back-link label so a long workspace name cannot overflow.
2. **Responsive Header & Action Toolbar (lines 136–210):**

   ```tsx
   <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
     <div className="min-w-0 flex-1 space-y-2">
       <h1 className="flex items-start gap-2 text-xl font-semibold sm:text-2xl">
         <NotebookPen className="mt-1 size-5 shrink-0 text-primary sm:size-6" />
         <span className="min-w-0 wrap-break-word">{data.title}</span>
       </h1>
       <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
         <span>Updated {formatNoteDate(data.updatedAt)}</span>
         {stats ? (
           <>
             <span className="inline-flex items-center gap-1">
               <Clock className="size-3.5 shrink-0" />
               {stats.readingMinutes} min read
             </span>
             <span className="inline-flex items-center gap-1">
               <FileText className="size-3.5 shrink-0" />
               {stats.words.toLocaleString()}{" "}
               {stats.words === 1 ? "word" : "words"}
             </span>
           </>
         ) : null}
         {data.workspace ? (
           <WorkspaceTypeBadge type={data.workspace.type} />
         ) : null}
         {data.workspace ? (
           <span className="truncate">{data.workspace.name}</span>
         ) : null}
       </div>
       ...
     </div>

     <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
       <Button
         variant="outline"
         size="sm"
         className="flex-1 sm:flex-initial"
         asChild>
         <Link to={`/skill-shredder?note=${data.id}`}>
           <Scissors className="size-4 shrink-0" />
           <span className="truncate">Shred into Practice</span>
         </Link>
       </Button>
       <Button variant="outline" size="icon" className="shrink-0" asChild>
         <Link
           to={`/notes/${data.id}/print`}
           aria-label="Download PDF"
           title="Download PDF">
           <FileDown className="size-4" />
         </Link>
       </Button>
       <Button variant="outline" size="icon" className="shrink-0" asChild>
         <Link
           to={`/notes/${data.id}/edit`}
           aria-label="Edit note"
           title="Edit note">
           <Pencil className="size-4" />
         </Link>
       </Button>
       <Button
         variant="destructive"
         size="icon"
         className="shrink-0"
         aria-label="Delete note"
         title="Delete note"
         onClick={() => setDeleteOpen(true)}>
         <Trash2 className="size-4" />
       </Button>
     </div>
   </div>
   ```

3. **Linked Skill Shred Banner (lines 212–239):**
   Add `flex-wrap` to the inner status line (`<span className="flex flex-wrap items-center gap-2 text-sm font-medium">`) so the status badge wraps gracefully on narrow viewports.
4. **Content Grid & Article Container (lines 249–272):**

   ```tsx
   <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
     <div className="min-w-0 space-y-6">
       {headings.length > 0 ? (
         <details className="rounded-lg border bg-card px-4 py-3 lg:hidden">
           <summary className="cursor-pointer text-sm font-medium">
             On this page
           </summary>
           <div className="pt-3">
             <NoteToc headings={headings} />
           </div>
         </details>
       ) : null}

       <article className="min-w-0 overflow-hidden rounded-lg border bg-card p-4 sm:p-6">
         <MarkdownRenderer content={data.content} />
       </article>
     </div>
   ```

---

### 3.4 Harden Supporting Components (`NoteToc`, `SourceList`, `MarkdownRenderer`, `AppLayout`)

#### A. Table of Contents Wrapping — [`src/client/features/notes/note-toc.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-toc.tsx#L106-L117)

- Add `break-words` to the TOC `<a>` link so long heading titles wrap properly inside both the mobile `<details>` disclosure and desktop sidebar.

#### B. Source List Flex Truncation — [`src/client/features/sources/source-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sources/source-list.tsx#L44-L57)

- Change `<span className="truncate">{label}</span>` to `<span className="min-w-0 truncate">{label}</span>` so flex truncation works properly alongside `source.locator`, and cap `source.locator` with `max-w-[40%] truncate` so long locators cannot push the link past `100%` width.

#### C. Markdown Mobile Typography & Overflow Rules — [`src/client/index.css`](file:///home/farissbayu/projects/pdevlog/src/client/index.css#L239-L395)

- Ensure `.markdown-body` has `min-width: 0; max-width: 100%;`.
- Scale `.markdown-body h1` (`1.35rem` on mobile, `1.6rem` on `sm+`) and `.markdown-body h2` (`1.2rem` on mobile, `1.35rem` on `sm+`) so headings don't wrap every 1–2 words on `375px` screens.
- Add `overflow-wrap: anywhere` / `word-break: break-word` on `.markdown-body :not(pre) > code` and `.markdown-body a` so long inline code identifiers or raw URLs wrap instead of overflowing `<article>`.
- Ensure `.markdown-body pre` has `max-width: 100%` so horizontal scrolling is strictly contained inside the code block.

#### D. App Shell Mobile Padding & Overflow Guard — [`src/client/app/layout.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/app/layout.tsx#L578-L598)

- Change the inner `<main>` wrapper in `AppLayout` (line 595) and `AdminLayout` (line 635) from `p-6 pb-24 md:pb-6` to `px-4 py-6 pb-24 sm:px-6 md:pb-6` (and match the sticky bar negative margin in [`note-editor.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx#L425) to `-mx-4 px-4 sm:-mx-6 sm:px-6`).
- Add `overflow-x-clip` on the outer layout wrapper (`<div className="min-h-svh overflow-x-clip bg-background">`) so accidental sub-pixel overflows never break `sticky` positioning or create a horizontal page scrollbar.

---

## 4. Implementation Sequence

1. **Step 1 — Fix `NoteList` & `FilterBar` (`/notes`):**
   - Update [`src/client/features/notes/note-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-list.tsx) (`grid-cols-1`, `min-w-0` on `<li>`, responsive `p-4 sm:p-5`).
   - Update [`src/client/components/filter-bar.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/filter-bar.tsx) (responsive search input, truncated dropdown labels, single-line mobile date range inputs).
2. **Step 2 — Fix `NoteDetailPage` & Subcomponents (`/notes/:id`):**
   - Update [`src/client/features/notes/note-detail-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-detail-page.tsx) (stacked mobile header, `min-w-0` title with `shrink-0` icon, full-width/flex action bar on mobile, `grid-cols-1`, `p-4 sm:p-6` on `<article>`).
   - Update [`src/client/features/notes/note-toc.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-toc.tsx) and [`src/client/features/sources/source-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sources/source-list.tsx).
3. **Step 3 — Update Markdown Styles & Layout Shell:**
   - Update `.markdown-body` rules in [`src/client/index.css`](file:///home/farissbayu/projects/pdevlog/src/client/index.css).
   - Update mobile padding (`px-4 sm:px-6`) in [`src/client/app/layout.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/app/layout.tsx) and [`src/client/features/notes/note-editor.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx).
4. **Step 4 — Verification:**
   - Run `bun run typecheck` and `bun run lint`.
   - Verify at `320px`, `375px`, `390px`, `768px`, and `1280px` viewports that `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

---

## 5. Verification Checklist

- [ ] **Notes Page (`/notes`) at `375px` width:**
  - `MobileHeader`, `FilterBar`, `NoteList` cards, and `AppMobileBottomNav` all align within `100vw` with zero horizontal scroll.
  - Long note titles truncate cleanly with `…` inside the card boundaries.
  - `From date` and `To date` pickers sit side-by-side on a single row without orphan wrapping.
- [ ] **Note Detail Page (`/notes/:id`) at `375px` width:**
  - Note title wraps across multiple lines without shrinking the `NotebookPen` icon or colliding with action buttons.
  - Action buttons (`Shred into Practice`, `Download PDF`, `Edit`, `Delete`) sit neatly below the title/metadata row on mobile and fit within the screen width.
  - Markdown headings, code blocks (`<pre>`), tables, and long inline URLs/code stay strictly inside `<article>` without widening the page.
- [ ] **Checks Pass:**
  - `bun run typecheck` passes with 0 errors.
  - `bun run lint` passes with 0 warnings/errors.

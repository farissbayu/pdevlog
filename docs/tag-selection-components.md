# Tag Selection Components & Inline Tag Creation Plan

This document catalogs every component in the codebase that provides tag selection functionality, analyzes current workflow limitations, and details a complete architectural and implementation plan for adding new tags directly from the tag selection interface (creatable tag selection).

---

## Overview & Classification

Tag selection in the application falls into four primary patterns:

| Category | Component | File Path | Interaction Pattern |
| :--- | :--- | :--- | :--- |
| **Selection Primitive** | `MultiSelect` | [`src/client/components/ui/multi-select.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/ui/multi-select.tsx) | Combobox popover with search filter, checkable list items, and removable chip badges. |
| **Filter Selection** | `FilterBar` | [`src/client/components/filter-bar.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/filter-bar.tsx) | Dropdown checkbox menu for multi-tag filtering, plus interactive clicked-to-remove active tag pills. |
| **Form Selection** | `NoteEditor` | [`src/client/features/notes/note-editor.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx) | Integrates `MultiSelect` to select/unselect tags associated with notes. |
| **Form Selection** | `BragLogForm` | [`src/client/features/brag-logs/brag-log-form.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/brag-log-form.tsx) | Integrates `MultiSelect` for manual tag assignment and merges AI-recommended tags on STAR generation. |
| **Form Selection** | `SparkDialog` | [`src/client/features/sparks/spark-dialog.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/spark-dialog.tsx) | Integrates `MultiSelect` for selecting optional tags when capturing quick sparks. |
| **Freeform & Recommendation** | `ProfilePage` | [`src/client/features/profile/profile-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/profile/profile-page.tsx) | Freeform text tag input combined with clickable suggestion pills (`+ {rec}`) and removable tag badges. |
| **Filter View Containers** | `NotesPage`, `BragLogsPage`, `SparksPage` | `src/client/features/{notes,brag-logs,sparks}/` | Host views that query tags via `useTagsQuery()` and supply them to `FilterBar` with URL filter sync. |

---

## 1. Core Selection UI Primitives

### `MultiSelect`
- **File:** [`src/client/components/ui/multi-select.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/ui/multi-select.tsx)
- **Exports:** `MultiSelect`, `type MultiSelectOption`

#### Description
The primary reusable multi-selection primitive built on top of Radix UI (`Popover`) and `cmdk` (`Command`). It acts as a combobox specifically optimized for picking multiple tags or labels.

#### Features
- **Combobox Trigger:** Displays selected options as inline chip badges with individual remove buttons (`X` icon). Shows `+N` badge if selected items exceed `MAX_VISIBLE_CHIPS` (3).
- **Searchable Dropdown:** Provides a search input (`CommandInput`) inside the popover to quickly filter options.
- **Checkable Items:** Renders options using `CommandItem` with checkmark indicators reflecting selection state.
- **Keyboard Navigation:** Accessible trigger (`Enter` / `Space` opens popover) and arrow-key navigation within the list.

#### Current Code Snippet
```tsx
<MultiSelect
  id="note-tags"
  aria-label="Tags"
  options={tags.map((tag) => ({
    value: tag.id,
    label: tag.name,
  }))}
  value={tagIds}
  onChange={setTagIds}
  placeholder="Select tags"
  searchPlaceholder="Search tags..."
  emptyMessage="No tag found."
/>
```

---

## 2. Filter & Query Selection Components

### `FilterBar`
- **File:** [`src/client/components/filter-bar.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/filter-bar.tsx)
- **Exports:** `FilterBar`

#### Description
A shared filter bar mounted on list pages to search and filter records by workspace, project, date range, and tags.

#### Tag Selection Mechanism
1. **Dropdown Menu (`DropdownMenu`):**
   - Trigger button displays `All tags` or `Tags (N)` with the count of active tag filters.
   - Menu lists all available user tags as `DropdownMenuCheckboxItem` components.
   - Selecting an item invokes `api.toggleTag(tag.id)` without closing the dropdown (`event.preventDefault()`).
2. **Active Filter Pills:**
   - When `filters.tagIds.length > 0`, renders a horizontal wrap of tag pill buttons with checkmark icons.
   - Clicking any pill toggles/removes the tag from active filters via `api.toggleTag(tagId)`.

#### Used In
- **Notes List:** [`src/client/features/notes/notes-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/notes-page.tsx)
- **Brag Logs List:** [`src/client/features/brag-logs/brag-logs-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/brag-logs-page.tsx)
- **Sparks List:** [`src/client/features/sparks/sparks-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/sparks-page.tsx)

---

## 3. Entity Form & Dialog Components

### `NoteEditor`
- **File:** [`src/client/features/notes/note-editor.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx)
- **Exports:** `NoteEditor`
- **Tag Selection Mechanism:**
  - Fetches all user tags with `useTagsQuery()`.
  - Tracks local state `tagIds: string[]`, seeded from `note?.tags` or prefilled from an imported spark `spark?.tags`.
  - Renders `MultiSelect` within the metadata sidebar/section (lines 564–585).
  - Persists selected tag IDs via `tag_ids: tagIds` in create and update mutations (`useCreateNoteMutation`, `useUpdateNoteMutation`).

---

### `BragLogForm`
- **File:** [`src/client/features/brag-logs/brag-log-form.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/brag-log-form.tsx)
- **Exports:** `BragLogForm`
- **Tag Selection Mechanism:**
  - Fetches tags using `useTagsQuery()`.
  - State managed via `tagIds: string[]`, initialized from existing `bragLog?.tags`, source `spark?.tags`, or `prefill?.tagIds`.
  - Renders `MultiSelect` under the "Tags" section (lines 366–387).
  - Automatically merges AI-recommended tags on STAR refinement (`handleGenerateBreakdown`).
  - Persists selected tags in `createBragLog` / `updateBragLog` via `tag_ids: tagIds`.

---

### `SparkDialog`
- **File:** [`src/client/features/sparks/spark-dialog.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/spark-dialog.tsx)
- **Exports:** `SparkDialog`
- **Tag Selection Mechanism:**
  - Fetches tags with `useTagsQuery()`.
  - Tracks local state `tagIds: string[]`, initialized from `spark?.tags`.
  - Renders `MultiSelect` labeled "Tags (optional)" (lines 366–384).
  - Saves tag IDs in `tag_ids: tagIds` via `useCreateSparkMutation` or `useUpdateSparkMutation`.

---

## 4. Freeform Stack & Recommendation Components

### `ProfilePage`
- **File:** [`src/client/features/profile/profile-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/profile/profile-page.tsx)
- **Exports:** `ProfilePage`
- **Tag Selection Mechanism:**
  - Manages technology stack strings (`primaryStack: string[]`).
  - **Suggested Tag Selection (Pills):** Renders clickable recommendations from `RECOMMENDED_STACK` (`+ {rec}`).
  - **Text Input Tag Addition:** Input field with "Add" button and `Enter` key handler to add custom tags.
  - **Selected Tag Removal:** Active tags render as badges with an `X` button calling `handleRemoveTag(tag)`.

---

## 5. Supporting State & Display Components

- **State Hook:** [`src/client/lib/use-filter-params.ts`](file:///home/farissbayu/projects/pdevlog/src/client/lib/use-filter-params.ts)  
  Manages `filters.tagIds` and exposes `toggleTag(tagId: string)` synchronized with browser URL search parameters (`?tag=...`).
- **Tag CRUD Page:** [`src/client/features/tags/tags-page.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/tags/tags-page.tsx)  
  Provides standalone management (create, search, rename, delete) for tags on `/tags`.
- **Read-Only Tag Badges:**
  - `TagChip` ([`src/client/features/brag-logs/tag-chip.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/tag-chip.tsx)): Non-interactive tag badge used in brag log lists, detail pages, and dashboard items.
  - `NoteTagChip` ([`src/client/features/notes/note-list.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-list.tsx)): Non-interactive tag badge used in note cards.

---

## 6. Plan: Adding New Tags Directly from Tag Selection

### 6.1 Problem Statement & Current Bottlenecks

Currently, tag creation and tag selection are decoupled in ways that introduce friction:

1. **The Empty State Dead-End:**  
   In [`NoteEditor`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx), [`BragLogForm`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/brag-log-form.tsx), and [`SparkDialog`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/spark-dialog.tsx), when `tags.length === 0`, the form renders a static text paragraph:  
   `"No tags yet. Create tags to label this note."`  
   The `MultiSelect` component is completely hidden, forcing the user to abandon their current draft, navigate to `/tags`, create a tag, and restart their work.
2. **Search Query Dead-End:**  
   When typing into `MultiSelect`'s search input, if the query does not match an existing tag name, `CommandEmpty` only renders `"No tag found."` There is no action to convert the typed keyword into a new tag.
3. **Repeated Boilerplate:**  
   Every form independently calls `useTagsQuery()`, maps options, checks for emptiness, and manages identical `MultiSelect` props.

---

### 6.2 Proposed Architecture

We will implement a two-tiered architecture:

```
┌────────────────────────────────────────────────────────┐
│  Form Consumers (NoteEditor, BragLogForm, SparkDialog)  │
└──────────────────────────┬─────────────────────────────┘
                           │ uses
┌──────────────────────────▼─────────────────────────────┐
│  TagSelect (src/client/features/tags/tag-select.tsx)   │
│  - Calls useTagsQuery()                                │
│  - Calls useCreateTagMutation()                        │
│  - Validates tag name (1-50 chars, duplicate check)    │
│  - Auto-selects created tag ID & invalidates cache     │
└──────────────────────────┬─────────────────────────────┘
                           │ renders
┌──────────────────────────▼─────────────────────────────┐
│  MultiSelect (src/client/components/ui/multi-select.tsx)│
│  - Generic "creatable" support via onCreateOption()    │
│  - Controlled search input state                       │
│  - Renders "+ Create '<query>'" item in CommandList     │
│  - In-flight creation spinner (Loader2)                │
└────────────────────────────────────────────────────────┘
```

#### Layer 1: Generic Creatable Support in `MultiSelect`
Extend [`MultiSelect`](file:///home/farissbayu/projects/pdevlog/src/client/components/ui/multi-select.tsx) to be domain-agnostic and optionally "creatable":
- New prop: `onCreateOption?: (name: string) => Promise<string | MultiSelectOption | void> | void`
- New prop: `createPlaceholder?: (query: string) => string` (defaults to `Create "${query}"`)
- Controlled search state `search: string` on `CommandInput`
- When `search.trim()` does not exactly match any existing option:
  - Surfaces a dedicated create option: `<Plus /> Create "{search.trim()}"`
  - Accessible via keyboard: hitting `Enter` when selected or pressing Enter in input triggers creation
  - Displays a loading indicator (`Loader2`) while the asynchronous creation promise resolves.

#### Layer 2: Domain-Specific `TagSelect` Component
Create [`src/client/features/tags/tag-select.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/tags/tag-select.tsx):
- Encapsulates:
  - `useTagsQuery()`
  - `useCreateTagMutation()`
- Validates the new tag name against [`tagNameSchema`](file:///home/farissbayu/projects/pdevlog/src/shared/schemas/tag.ts) (max 50 characters, trimmed).
- Calls backend `POST /api/tags` via `createTagMutation.mutateAsync({ name })`.
- Handles duplicates gracefully: if the backend returns `409 Conflict`, it looks up the existing tag by name and auto-selects it instead of breaking.
- Adds the new tag ID to `value`, clears search, and notifies the user with `toast.success("Tag created")`.
- Eliminates duplicate boilerplate from `NoteEditor`, `BragLogForm`, and `SparkDialog`.

---

### 6.3 UX & Interaction Specifications

#### A. When No Tags Exist (`tags.length === 0`)
1. The combobox trigger is **still rendered** (not replaced with static text).
2. Placeholder displays `"Select or create tags..."`.
3. Opening the popover displays the search input and an empty state banner:
   ```
   [ Search tags or type to create...     ]
   -----------------------------------------
   No tags yet. Type a name to create one.
   ```
4. Typing "Cloudflare" immediately updates the list:
   ```
   [ Cloudflare                           ]
   -----------------------------------------
   + Create "Cloudflare"
   ```
5. Pressing `Enter` or clicking "+ Create 'Cloudflare'":
   - Creation spinner activates.
   - Tag is created via API.
   - Tag badge appears in combobox trigger: `[ Cloudflare × ]`.
   - Popover remains open with search reset, ready for another tag or closing.

#### B. When Searching Existing Tags
1. User types "Rea":
   ```
   [ Rea                                  ]
   -----------------------------------------
   [✓] React
   [ ] Reactive Streams
   + Create "Rea"
   ```
2. User types "React" (exact match exists):
   - Only `[✓] React` is displayed. The "+ Create" item is hidden because an exact case-insensitive match already exists.

#### C. Validation & Error Handling
- **Name Too Long (> 50 chars):**  
  The create item is disabled or displays an error note: `"Tag name must be 50 characters or less"`.
- **Empty / Whitespace Only:**  
  The create item is not shown for empty strings.
- **Server Conflict (409):**  
  If another session or isolate already created a tag with the same name, catch the 409, fetch tags, and select the existing one seamlessly.

---

### 6.4 Detailed Code Design

#### 1. Changes to `MultiSelect` (`src/client/components/ui/multi-select.tsx`)

```tsx
type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Optional handler to create a new option on the fly */
  onCreateOption?: (name: string) => Promise<string | MultiSelectOption | void> | void;
  /** Custom label generator for the create action */
  createPlaceholder?: (query: string) => string;
};
```

**Implementation within `MultiSelect`:**
```tsx
const [search, setSearch] = React.useState("");
const [isCreating, setIsCreating] = React.useState(false);

const trimmedSearch = search.trim();
const hasExactMatch = options.some(
  (opt) => opt.label.toLowerCase() === trimmedSearch.toLowerCase(),
);
const canCreate = Boolean(onCreateOption) && trimmedSearch.length > 0 && !hasExactMatch;

const handleCreate = async () => {
  if (!onCreateOption || !trimmedSearch || isCreating) return;
  try {
    setIsCreating(true);
    const result = await onCreateOption(trimmedSearch);
    setSearch("");
    // If a value/id or option is returned, auto-select it:
    if (typeof result === "string") {
      onChange([...value, result]);
    } else if (result && typeof result === "object" && "value" in result) {
      onChange([...value, result.value]);
    }
  } finally {
    setIsCreating(false);
  }
};
```

**JSX in `CommandList`:**
```tsx
<CommandList>
  {canCreate ? (
    <CommandGroup heading="Create new">
      <CommandItem
        value={`__create_${trimmedSearch}`}
        onSelect={handleCreate}
        disabled={isCreating}
        className="text-primary font-medium cursor-pointer"
      >
        {isCreating ? (
          <Loader2 className="size-4 animate-spin mr-2" />
        ) : (
          <Plus className="size-4 mr-2" />
        )}
        {createPlaceholder ? createPlaceholder(trimmedSearch) : `Create "${trimmedSearch}"`}
      </CommandItem>
    </CommandGroup>
  ) : null}

  <CommandEmpty>
    {canCreate ? null : emptyMessage}
  </CommandEmpty>

  <CommandGroup>
    {options.map((option) => (/* standard CommandItem */))}
  </CommandGroup>
</CommandList>
```

---

#### 2. New Domain Component `TagSelect` (`src/client/features/tags/tag-select.tsx`)

```tsx
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MultiSelect, type MultiSelectOption } from "@/client/components/ui/multi-select";
import { useCreateTagMutation, useTagsQuery } from "@/client/features/tags/api";

type TagSelectProps = {
  id?: string;
  value: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function TagSelect({
  id = "tags",
  value,
  onChange,
  placeholder = "Select or create tags...",
  searchPlaceholder = "Search tags or type to create...",
  disabled,
  "aria-label": ariaLabel = "Tags",
}: TagSelectProps) {
  const { data: tags = [], isLoading } = useTagsQuery();
  const createTagMutation = useCreateTagMutation();

  const options: MultiSelectOption[] = tags.map((tag) => ({
    value: tag.id,
    label: tag.name,
  }));

  const handleCreateTag = async (name: string): Promise<string | void> => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (trimmed.length > 50) {
      toast.error("Tag name must be 50 characters or less");
      return;
    }

    try {
      const created = await createTagMutation.mutateAsync({ name: trimmed });
      toast.success(`Tag "${created.name}" created`);
      return created.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create tag";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading tags...
      </div>
    );
  }

  return (
    <MultiSelect
      id={id}
      aria-label={ariaLabel}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No tags found."
      disabled={disabled}
      onCreateOption={handleCreateTag}
      createPlaceholder={(query) => `Create "${query}"`}
    />
  );
}
```

---

#### 3. Refactoring Consumer Forms

##### A. Note Editor (`src/client/features/notes/note-editor.tsx`)
**Before:**
```tsx
<div className="space-y-2">
  <Label htmlFor="note-tags">Tags</Label>
  {tags && tags.length > 0 ? (
    <MultiSelect
      id="note-tags"
      options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
      value={tagIds}
      onChange={setTagIds}
      ...
    />
  ) : (
    <p className="text-xs text-muted-foreground">
      No tags yet. Create tags to label this note.
    </p>
  )}
</div>
```
**After:**
```tsx
<div className="space-y-2">
  <Label htmlFor="note-tags">Tags</Label>
  <TagSelect
    id="note-tags"
    value={tagIds}
    onChange={setTagIds}
  />
</div>
```

##### B. Brag Log Form (`src/client/features/brag-logs/brag-log-form.tsx`)
**Before:**
```tsx
<div className="space-y-2">
  <Label htmlFor="brag-tags">Tags</Label>
  {tags && tags.length > 0 ? (
    <MultiSelect id="brag-tags" ... />
  ) : (
    <p className="text-xs text-muted-foreground">
      No tags yet. Create tags to label this log.
    </p>
  )}
</div>
```
**After:**
```tsx
<div className="space-y-2">
  <Label htmlFor="brag-tags">Tags</Label>
  <TagSelect
    id="brag-tags"
    value={tagIds}
    onChange={setTagIds}
  />
</div>
```

##### C. Spark Dialog (`src/client/features/sparks/spark-dialog.tsx`)
**Before:**
```tsx
<div className="space-y-2">
  <Label htmlFor="spark-tags">Tags (optional)</Label>
  {tags && tags.length > 0 ? (
    <MultiSelect id="spark-tags" ... />
  ) : (
    <p className="text-xs text-muted-foreground">
      No tags yet. You can add tags later.
    </p>
  )}
</div>
```
**After:**
```tsx
<div className="space-y-2">
  <Label htmlFor="spark-tags">Tags (optional)</Label>
  <TagSelect
    id="spark-tags"
    value={tagIds}
    onChange={setTagIds}
  />
</div>
```

---

### 6.5 Implementation Roadmap & Checklist

| Phase | Task | Files Involved | Verification |
| :--- | :--- | :--- | :--- |
| **Phase 1: Primitive Extension** | Add `onCreateOption`, controlled search, and `+ Create` item to `MultiSelect`. | [`src/client/components/ui/multi-select.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/components/ui/multi-select.tsx) | Verify keyboard Enter triggers creation; verify search reset on selection. |
| **Phase 2: Domain Component** | Build `TagSelect` encapsulating `useTagsQuery`, `useCreateTagMutation`, validation, and toast feedback. | [`src/client/features/tags/tag-select.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/tags/tag-select.tsx) | Verify creation invalidates query cache and auto-selects new ID. |
| **Phase 3: Form Integration** | Replace manual `MultiSelect` + empty check in `NoteEditor`, `BragLogForm`, and `SparkDialog` with `TagSelect`. | [`src/client/features/notes/note-editor.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/notes/note-editor.tsx)<br>[`src/client/features/brag-logs/brag-log-form.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/brag-logs/brag-log-form.tsx)<br>[`src/client/features/sparks/spark-dialog.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/spark-dialog.tsx) | Verify creating first tag works on zero-tag accounts without navigating away. |
| **Phase 4: Regression & Testing** | Run test suite and linter. | Codebase | `bun run typecheck`, `bun run lint`, `bun run test`. |

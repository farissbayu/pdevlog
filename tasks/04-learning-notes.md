# Slice 4 — Learning Notes

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Membangun modul Learning Notes sebagai buku catatan teknis terstruktur dengan editor Markdown (mode edit/preview), rendering menggunakan `react-markdown` + `remark-gfm` + syntax highlighting untuk code block, relasi workspace, dan asosiasi multi-tag (`note_tags`).
- **Selesai jika**:
  - User dapat membuat, melihat daftar, membaca detail rendered Markdown, mengubah, dan menghapus catatan belajar miliknya.
  - Editor catatan memiliki toggle yang mulus antara mode edit (textarea Markdown) dan preview (Markdown ter-render).
  - Tampilan Markdown me-render dengan tepat: headers, lists, tabel GFM, links, blockquotes, dan code block dengan syntax highlighting berwarna.
  - Tag dan workspace dapat dipasang ke catatan dan divalidasi kepemilikannya.
  - Test isolasi membuktikan keamanan data antar user.

## 2. Dependensi
- **Slice 1 (Workspaces)**: Untuk mengelompokkan catatan ke workspace.
- **Slice 2 (Tags)**: Untuk pelabelan teknologi pada catatan.

## 3. Checklist Task
- [ ] **Database & Migrasi**
  - [ ] Tambahkan tabel `learning_notes` di Drizzle schema:
    - `id` (text nanoid, PK)
    - `user_id` (text, FK ke `users.id` ON DELETE CASCADE, NOT NULL)
    - `workspace_id` (text, FK ke `workspaces.id` ON DELETE SET NULL, NULLABLE)
    - `title` (text, NOT NULL)
    - `content` (text, Markdown string, NOT NULL)
    - `created_at` (integer timestamp / text ISO, NOT NULL)
    - `updated_at` (integer timestamp / text ISO, NOT NULL)
  - [ ] Tambahkan index komposit: `(user_id, workspace_id)`.
  - [ ] Tambahkan tabel junction `note_tags`:
    - `learning_note_id` (text, FK ke `learning_notes.id` ON DELETE CASCADE, NOT NULL)
    - `tag_id` (text, FK ke `tags.id` ON DELETE CASCADE, NOT NULL)
    - Composite Primary Key: `(learning_note_id, tag_id)`
  - [ ] Generate migrasi (`bunx drizzle-kit generate`).
  - [ ] Terapkan migrasi ke D1 lokal (`bunx wrangler d1 migrations apply <db> --local`).
- [ ] **Skema Zod (Shared)**
  - [ ] Buat file `src/shared/schemas/learning-note.ts`:
    - `createLearningNoteSchema`: title, content (Markdown text), workspace_id (opsional), tag_ids (array string, opsional).
    - `updateLearningNoteSchema`: partial / serupa create.
    - `learningNoteResponseSchema`: data note beserta array tags dan info workspace.
- [ ] **Route Hono (Worker)**
  - [ ] Buat `src/worker/features/learning-notes/route.ts`:
    - `GET /api/learning-notes` (list catatan milik user, include tags & workspace).
    - `POST /api/learning-notes` (validasi kepemilikan workspace & tags, insert ke `learning_notes` dan `note_tags`).
    - `GET /api/learning-notes/:id` (detail catatan, return 404 jika bukan milik user).
    - `PUT /api/learning-notes/:id` (update judul/konten/workspace, sync `note_tags`, return 404 jika bukan milik user).
    - `DELETE /api/learning-notes/:id` (hapus catatan, cascade hapus `note_tags`, return 404 jika tidak ditemukan).
  - [ ] Mount route di `src/worker/index.ts`.
- [ ] **API Client & Hooks (Frontend)**
  - [ ] Definisikan query dan mutation hooks di `src/client/features/learning-notes/api.ts`:
    - `useLearningNotesQuery`
    - `useLearningNoteDetailQuery(id)`
    - `useCreateLearningNoteMutation`
    - `useUpdateLearningNoteMutation`
    - `useDeleteLearningNoteMutation`
- [ ] **Komponen & UI (Frontend)**
  - [ ] Install library Markdown: `react-markdown`, `remark-gfm`, dan syntax highlighter yang ringan (misal `rehype-highlight` atau sejenisnya).
  - [ ] Buat komponen renderer Markdown `src/client/components/markdown-renderer.tsx` dengan styling tipografi rapi untuk light & dark mode.
  - [ ] Buat form editor `src/client/features/learning-notes/note-editor.tsx` dengan tab / toggle Edit vs Preview.
  - [ ] Buat halaman list `src/client/features/learning-notes/learning-notes-page.tsx`.
  - [ ] Buat halaman detail catatan dengan tampilan render Markdown lengkap.
  - [ ] Sediakan 3 state: Loading skeleton, Empty state, dan Error state.
  - [ ] Tambahkan link menu "Learning Notes" di sidebar navigasi.
- [ ] **Test Isolasi & Keamanan Relasi**
  - [ ] Buat test `tests/isolation/learning-notes.test.ts`:
    - User A membuat note, User B mencoba membaca/mengubah/menghapus -> return 404.
    - User B mencoba menempelkan tag atau workspace milik User A pada note miliknya -> gagal (404).
- [ ] **Verifikasi Akhir**
  - [ ] Buat catatan dengan code block (misal TypeScript, Bash), list, tabel GFM.
  - [ ] Verifikasi syntax highlighting tampil dengan styling yang serasi baik di light maupun dark mode.
  - [ ] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `learning_notes` (CREATE table, CRUD)
  - `note_tags` (CREATE table, INSERT, DELETE)
  - `workspaces` (SELECT validasi)
  - `tags` (SELECT validasi)
- **Endpoint**:
  - `GET /api/learning-notes`
  - `POST /api/learning-notes`
  - `GET /api/learning-notes/:id`
  - `PUT /api/learning-notes/:id`
  - `DELETE /api/learning-notes/:id`

## 5. Risiko & Hal yang Perlu Dicek
- Bundle size: Library syntax highlighting jangan mengimpor seluruh bahasa bila terlalu besar; gunakan highlight core atau yang modular agar bundle tetap ringan.
- Styling dark mode: Pastikan warna kode syntax highlighting tetap kontras dan nyaman dibaca pada palet zinc dark mode shadcn.
- Validasi kepemilikan `workspace_id` dan `tag_ids` wajib identik dengan proteksi pada Brag Logs.

## 6. Di Luar Scope Slice Ini
- Upload file/gambar ke dalam markdown (sesuai aturan proyek: tidak ada upload file/gambar).
- Fitur collaborative editor / live cursor.
- Search & filter catatan (di Slice 5).

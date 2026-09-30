# Slice 3 — Brag Logs

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Membangun fitur pencatatan pencapaian kerja dan resolusi bug (Brag Logs) menggunakan kerangka STAR (Situation, Task, Action, Result) beserta tanggal kejadian (`occurred_at`), relasi ke workspace, dan asosiasi multi-tag (`brag_tags`).
- **Selesai jika**:
  - User dapat membuat, melihat daftar, membaca detail, mengubah, dan menghapus Brag Log miliknya.
  - Form pembuatan/edit mendukung input Title, Situation, Task, Action, Result, Occurred At (tanggal), pilihan Workspace (opsional/dropdown), serta multi-select Tag milik user.
  - Tag yang dipilih tersimpan di tabel junction `brag_tags` dan tampil di detail log.
  - Validasi kepemilikan ketat: user tidak bisa menggunakan `workspace_id` atau `tag_ids` milik user lain saat menyimpan log.
  - Test isolasi membuktikan keamanan data antar user dan pencegahan ID hijacking lintas user.

## 2. Dependensi
- **Slice 1 (Workspaces)**: Menyediakan data workspace untuk dropdown pilihan log.
- **Slice 2 (Tags)**: Menyediakan data tag untuk multi-select tag pada log.

## 3. Checklist Task
- [ ] **Database & Migrasi**
  - [ ] Tambahkan tabel `brag_logs` di Drizzle schema:
    - `id` (text nanoid, PK)
    - `user_id` (text, FK ke `users.id` ON DELETE CASCADE, NOT NULL)
    - `workspace_id` (text, FK ke `workspaces.id` ON DELETE SET NULL, NULLABLE)
    - `title` (text, NOT NULL)
    - `situation` (text, NOT NULL)
    - `task` (text, NOT NULL)
    - `action` (text, NOT NULL)
    - `result` (text, NOT NULL)
    - `occurred_at` (text format YYYY-MM-DD, NOT NULL)
    - `created_at` (integer timestamp / text ISO, NOT NULL)
    - `updated_at` (integer timestamp / text ISO, NOT NULL)
  - [ ] Tambahkan index komposit: `(user_id, workspace_id)` dan `(user_id, occurred_at)`.
  - [ ] Tambahkan tabel junction `brag_tags`:
    - `brag_log_id` (text, FK ke `brag_logs.id` ON DELETE CASCADE, NOT NULL)
    - `tag_id` (text, FK ke `tags.id` ON DELETE CASCADE, NOT NULL)
    - Composite Primary Key: `(brag_log_id, tag_id)`
  - [ ] Generate migrasi (`bunx drizzle-kit generate`).
  - [ ] Terapkan migrasi ke D1 lokal (`bunx wrangler d1 migrations apply <db> --local`).
- [ ] **Skema Zod (Shared)**
  - [ ] Buat file `src/shared/schemas/brag-log.ts`:
    - `createBragLogSchema`: title, situation, task, action, result, occurred_at (format date YYYY-MM-DD), workspace_id (opsional), tag_ids (array of string, opsional).
    - `updateBragLogSchema`: partial / serupa create.
    - `bragLogResponseSchema`: data log beserta array tags dan info workspace.
- [ ] **Route Hono (Worker)**
  - [ ] Buat `src/worker/features/brag-logs/route.ts`:
    - `GET /api/brag-logs` (list log milik user, diurutkan `occurred_at DESC`, include tags & workspace).
    - `POST /api/brag-logs`:
      - Validasi jika `workspace_id` diisi, pastikan milik user yang sama (return 404 jika bukan).
      - Validasi jika `tag_ids` diisi, pastikan semua tag milik user yang sama (return 404 jika ada yang bukan).
      - Insert ke `brag_logs` dan insert baris relasi ke `brag_tags`.
    - `GET /api/brag-logs/:id` (detail brag log + tags, return 404 jika bukan milik user).
    - `PUT /api/brag-logs/:id`:
      - Cek kepemilikan log (return 404 jika tidak ada).
      - Validasi `workspace_id` dan `tag_ids`.
      - Update log, sync junction `brag_tags` (hapus relasi lama, pasang relasi baru).
    - `DELETE /api/brag-logs/:id` (hapus log milik user, cascade hapus `brag_tags`, return 404 jika tidak ada).
  - [ ] Mount route di `src/worker/index.ts`.
- [ ] **API Client & Hooks (Frontend)**
  - [ ] Definisikan hooks TanStack Query di `src/client/features/brag-logs/api.ts`:
    - `useBragLogsQuery`
    - `useBragLogDetailQuery(id)`
    - `useCreateBragLogMutation`
    - `useUpdateBragLogMutation`
    - `useDeleteBragLogMutation`
- [ ] **Komponen & UI (Frontend)**
  - [ ] Buat halaman list `src/client/features/brag-logs/brag-logs-page.tsx`.
  - [ ] Buat halaman/dialog form STAR `src/client/features/brag-logs/brag-log-form.tsx` (title, S, T, A, R, date picker, dropdown workspace, multi-select tag).
  - [ ] Buat halaman/tampilan detail brag log dengan kartu STAR terstruktur rapi dan badge tag.
  - [ ] Sediakan 3 state: Loading skeleton, Empty state, dan Error state.
  - [ ] Hubungkan menu "Brag Logs" di sidebar navigasi.
- [ ] **Test Isolasi & Keamanan Relasi**
  - [ ] Buat test `tests/isolation/brag-logs.test.ts`:
    - User A membuat log, User B mencoba membaca/mengubah/menghapus -> return 404.
    - User B mencoba membuat log baru dengan menempelkan `tag_id` milik User A -> gagal (404).
    - User B mencoba membuat log baru dengan menempelkan `workspace_id` milik User A -> gagal (404).
- [ ] **Verifikasi Akhir**
  - [ ] Coba input STAR log lengkap via browser, cek hasil di database dan UI.
  - [ ] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `brag_logs` (CREATE table, CRUD)
  - `brag_tags` (CREATE table, INSERT, DELETE)
  - `workspaces` (SELECT untuk validasi kepemilikan)
  - `tags` (SELECT untuk validasi kepemilikan)
- **Endpoint**:
  - `GET /api/brag-logs`
  - `POST /api/brag-logs`
  - `GET /api/brag-logs/:id`
  - `PUT /api/brag-logs/:id`
  - `DELETE /api/brag-logs/:id`

## 5. Risiko & Hal yang Perlu Dicek
- Validasi kepemilikan `workspace_id` dan `tag_ids`: wajib query ke DB untuk memverifikasi bahwa seluruh entitas tersebut memiliki `user_id` yang cocok dengan sesi saat ini.
- Transaksi / D1 batching: Operasi insert log dan insert tags sebaiknya berjalan atomik atau terstruktur rapi agar tidak meninggalkan log tanpa tag jika terjadi kegagalan.
- Tanggal kejadian `occurred_at` cukup disimpan dalam format string ISO tanggal `YYYY-MM-DD` untuk menghindari masalah timezone.

## 6. Di Luar Scope Slice Ini
- Pencarian teks (LIKE) dan filter kompleks berdasarkan workspace/tag/tanggal (di Slice 5).
- Ekspor log ke Markdown (di Slice 6).

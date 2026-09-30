# Slice 1 — Workspaces

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Membangun modul Workspaces sebagai fondasi pengelompokan utama (proyek kerja atau kelas belajar), lengkap dengan operasi CRUD, integrasi ke sidebar, onboarding user baru, dan pengujian isolasi data antar user.
- **Selesai jika**:
  - User dapat membuat, melihat daftar, mengedit nama/deskripsi/tipe, dan menghapus workspace miliknya.
  - Daftar workspace milik user otomatis muncul di sidebar secara reaktif.
  - User baru yang belum memiliki workspace melihat tampilan onboarding (empty state ramah dengan tombol aksi buat workspace pertama).
  - Test otomatis membuktikan bahwa user A tidak bisa membaca, mengubah, atau menghapus workspace milik user B (mengembalikan 404).

## 2. Dependensi
- **Slice 0 (Fondasi + Auth)**: Memerlukan tabel `users`, sesi autentikasi terverifikasi, auth context Hono (`c.get("userId")`), layout dasar dengan sidebar, dan setup Vitest workers pool.

## 3. Checklist Task
- [x] **Database & Migrasi**
  - [x] Tambahkan tabel `workspaces` di Drizzle schema:
    - `id` (text nanoid, PK)
    - `user_id` (text, FK ke `users.id` ON DELETE CASCADE, NOT NULL)
    - `name` (text, NOT NULL)
    - `description` (text, NULLABLE)
    - `type` (text: `'work'` | `'learning'`, NOT NULL)
    - `created_at` (integer timestamp / text ISO, NOT NULL)
    - `updated_at` (integer timestamp / text ISO, NOT NULL)
  - [x] Tambahkan index komposit `(user_id)` pada tabel `workspaces`.
  - [x] Generate migrasi (`bunx drizzle-kit generate`).
  - [x] Terapkan migrasi ke D1 lokal (`bunx wrangler d1 migrations apply <db> --local`).
- [x] **Skema Zod (Shared)**
  - [x] Buat file `src/shared/schemas/workspace.ts`:
    - Skema validasi pembuatan workspace (`createWorkspaceSchema`: name, description opsional, type enum).
    - Skema update workspace (`updateWorkspaceSchema`).
    - Skema respons workspace (`workspaceResponseSchema`).
- [x] **Route Hono (Worker)**
  - [x] Buat `src/worker/features/workspaces/route.ts`:
    - `GET /api/workspaces` (list workspace milik user terotentikasi, diurutkan `created_at DESC`).
    - `POST /api/workspaces` (buat workspace baru dengan `user_id` dari context).
    - `GET /api/workspaces/:id` (ambil 1 workspace, filter eksplisit `id` DAN `user_id`, return 404 jika bukan milik user).
    - `PUT /api/workspaces/:id` (update workspace, filter eksplisit `id` DAN `user_id`, return 404 jika tidak ditemukan).
    - `DELETE /api/workspaces/:id` (hapus workspace, filter eksplisit `id` DAN `user_id`, return 404 jika tidak ditemukan).
  - [x] Mount route workspaces ke Hono app di `src/worker/index.ts`.
- [x] **API Client & Hooks (Frontend)**
  - [x] Definisikan query hooks dan mutation hooks TanStack Query di `src/client/features/workspaces/api.ts`:
    - `useWorkspacesQuery` (key: `['workspaces']`)
    - `useWorkspaceDetailQuery(id)`
    - `useCreateWorkspaceMutation` (invalidation key `['workspaces']`)
    - `useUpdateWorkspaceMutation`
    - `useDeleteWorkspaceMutation`
- [x] **Komponen & UI (Frontend)**
  - [x] Buat halaman manajemen workspace `src/client/features/workspaces/workspaces-page.tsx`.
  - [x] Buat dialog / modal create & edit workspace dengan form terikat skema Zod.
  - [x] Terapkan layout 3 state di halaman list: Loading skeleton, Empty state (onboarding CTA), dan Error state.
  - [x] Integrasikan daftar workspace ke sidebar di `src/client/app/layout.tsx` (tampilkan flat list dengan badge tipe `work` atau `learning`).
- [x] **Test Isolasi Data**
  - [x] Buat file test `tests/isolation/workspaces.test.ts` (menggunakan Vitest + `@cloudflare/vitest-pool-workers`):
    - User A membuat workspace A.
    - User B mencoba membaca workspace A -> harus return 404.
    - User B mencoba mengupdate workspace A -> harus return 404.
    - User B mencoba menghapus workspace A -> harus return 404.
- [x] **Verifikasi Akhir**
  - [x] Cek manual via browser sesuai skenario.
  - [x] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `workspaces` (CREATE table, SELECT, INSERT, UPDATE, DELETE)
- **Endpoint**:
  - `GET /api/workspaces`
  - `POST /api/workspaces`
  - `GET /api/workspaces/:id`
  - `PUT /api/workspaces/:id`
  - `DELETE /api/workspaces/:id`

## 5. Risiko & Hal yang Perlu Dicek
- Pastikan filter `where(and(eq(workspaces.id, id), eq(workspaces.userId, userId)))` selalu ditulis eksplisit tanpa terlewat pada setiap operasi mutasi dan query detail.
- Pastikan error kepemilikan mengembalikan status `404 Not Found` (bukan `403 Forbidden`) agar keberadaan resource tidak bocor ke user lain.
- Pastikan TanStack Query cache ter-invalidate dengan benar sehingga perubahan di halaman workspace langsung terdistribusi ke sidebar tanpa reload halaman.

## 6. Di Luar Scope Slice Ini
- Pemindahan isi log/note antar workspace (belum ada tabel log/note).
- Pencarian dan filter workspace via URL search params (di Slice 5).
- Perhitungan statistik jumlah catatan per workspace (di Slice 6).

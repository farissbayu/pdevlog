# Slice 2 — Tags

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Membangun modul Tags untuk pelabelan teknologi yang reusable (misal: "Next.js", "PM2", "GitLab"), dengan constraint nama unik per user, halaman manajemen tag, dan pengujian isolasi data.
- **Selesai jika**:
  - User dapat membuat, melihat daftar, mengubah nama, dan menghapus tag miliknya.
  - Nama tag bersifat unik per user (mencoba membuat tag bernama sama menghasilkan validasi error 409 atau error message yang jelas).
  - Dua user berbeda dapat memiliki tag dengan nama yang sama tanpa saling bentrok.
  - Test isolasi membuktikan user A tidak bisa memodifikasi atau menghapus tag milik user B.

## 2. Dependensi
- **Slice 0 (Fondasi + Auth)**: Memerlukan user terautentikasi dan context `userId`.

## 3. Checklist Task
- [ ] **Database & Migrasi**
  - [ ] Tambahkan tabel `tags` di Drizzle schema:
    - `id` (text nanoid, PK)
    - `user_id` (text, FK ke `users.id` ON DELETE CASCADE, NOT NULL)
    - `name` (text, NOT NULL)
    - `created_at` (integer timestamp / text ISO, NOT NULL)
  - [ ] Tambahkan unique index komposit `(user_id, name)` pada tabel `tags`.
  - [ ] Generate migrasi (`bunx drizzle-kit generate`).
  - [ ] Terapkan migrasi ke D1 lokal (`bunx wrangler d1 migrations apply <db> --local`).
- [ ] **Skema Zod (Shared)**
  - [ ] Buat file `src/shared/schemas/tag.ts`:
    - Skema pembuatan tag (`createTagSchema`: nama tag 1-50 karakter, trim whitespace).
    - Skema update tag (`updateTagSchema`).
    - Skema respons tag (`tagResponseSchema`).
- [ ] **Route Hono (Worker)**
  - [ ] Buat `src/worker/features/tags/route.ts`:
    - `GET /api/tags` (list tag milik user terotentikasi, diurutkan nama asc).
    - `POST /api/tags` (cek duplikat nama per user, kembalikan 409 jika sudah ada, insert jika belum).
    - `PUT /api/tags/:id` (rename tag, pastikan milik user dan nama baru tidak duplikat dengan tag lain milik user, return 404 jika bukan milik user).
    - `DELETE /api/tags/:id` (hapus tag milik user, return 404 jika tidak ditemukan).
  - [ ] Mount route tags ke Hono app di `src/worker/index.ts`.
- [ ] **API Client & Hooks (Frontend)**
  - [ ] Definisikan query dan mutation hooks di `src/client/features/tags/api.ts`:
    - `useTagsQuery` (key: `['tags']`)
    - `useCreateTagMutation`
    - `useUpdateTagMutation`
    - `useDeleteTagMutation`
- [ ] **Komponen & UI (Frontend)**
  - [ ] Buat halaman manajemen tags `src/client/features/tags/tags-page.tsx`.
  - [ ] Sediakan form input cepat untuk membuat tag baru serta edit/delete inline atau dialog.
  - [ ] Sediakan 3 state tampilan: Loading skeleton, Empty state, dan Error state (termasuk menampilkan error konflik nama tag duplikat).
  - [ ] Tambahkan link menu "Tags" ke sidebar navigasi.
- [ ] **Test Isolasi & Constraint Data**
  - [ ] Buat file test `tests/isolation/tags.test.ts`:
    - Uji unique constraint: User A membuat tag "Docker" dua kali -> request kedua gagal (409 Conflict).
    - Uji non-interferensi: User A dan User B sama-sama membuat tag "Docker" -> keduanya berhasil.
    - Uji isolasi: User B mencoba update atau delete tag milik User A -> return 404.
- [ ] **Verifikasi Akhir**
  - [ ] Cek form di UI dan penanganan error nama duplikat.
  - [ ] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `tags` (CREATE table, SELECT, INSERT, UPDATE, DELETE)
- **Endpoint**:
  - `GET /api/tags`
  - `POST /api/tags`
  - `PUT /api/tags/:id`
  - `DELETE /api/tags/:id`

## 5. Risiko & Hal yang Perlu Dicek
- Constraint nama unik: Di SQLite, periksa apakah perbandingan teks peka huruf besar/kecil (case sensitive) atau tidak. Sebaiknya normalisasi nama tag (misal trim whitespace) sebelum dicek dan disimpan.
- Respons error duplikat harus ramah bagi user dan ditangkap form UI dengan pesan inline, bukan pesan error generic server.

## 6. Di Luar Scope Slice Ini
- Menempelkan tag ke catatan/log (di Slice 3 & 4).
- Junction tables `brag_tags` dan `note_tags` (dibuat di Slice 3 & 4).
- Filter catatan berdasarkan tag (di Slice 5).

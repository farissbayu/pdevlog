# Slice 5 — Cari & Filter

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Mengimplementasikan kemampuan pencarian berbasis query teks sederhana (LIKE) pada judul dan isi, serta filtering komprehensif berdasarkan workspace, tag, dan rentang tanggal untuk Brag Logs dan Learning Notes, dengan state filter tersinkronisasi dua arah ke URL Search Params.
- **Selesai jika**:
  - User dapat mencari Brag Logs berdasarkan kata kunci pada title, situation, task, action, atau result.
  - User dapat mencari Learning Notes berdasarkan kata kunci pada title atau content Markdown.
  - User dapat memfilter data berdasarkan satu workspace, satu atau beberapa tag, dan rentang tanggal (`date_from` s.d. `date_to`).
  - Parameter pencarian dan filter tercermin secara presisi di URL query string (misal `?q=docker&workspaceId=...&tag=...`), sehingga tautan dapat di-bookmark atau di-refresh tanpa kehilangan filter.
  - Terdapat empty state khusus ketika filter aktif namun tidak ada data yang cocok ("Tidak ada data yang sesuai filter").

## 2. Dependensi
- **Slice 3 (Brag Logs)**: Endpoint dan UI daftar Brag Logs yang akan dihubungkan dengan filter.
- **Slice 4 (Learning Notes)**: Endpoint dan UI daftar Learning Notes yang akan dihubungkan dengan filter.

## 3. Checklist Task
- [ ] **Skema Zod (Shared)**
  - [ ] Tambahkan skema query filter di `src/shared/schemas/filters.ts`:
    - `logFilterSchema`: `q` (string opsional), `workspace_id` (string opsional), `tag_id` (string opsional atau array), `from` (string date opsional), `to` (string date opsional).
    - `noteFilterSchema`: `q` (string opsional), `workspace_id` (string opsional), `tag_id` (string opsional atau array), `from` (string date opsional), `to` (string date opsional).
- [ ] **Route Hono (Worker)**
  - [ ] Perbarui `GET /api/brag-logs`:
    - Validasi query string dengan `@hono/zod-validator`.
    - Susun kondisi WHERE Drizzle secara dinamis:
      - Selalu menyertakan `eq(brag_logs.userId, userId)`.
      - LIKE insensitive pada `title`, `situation`, `task`, `action`, `result` jika parameter `q` ada.
      - Filter `workspace_id` jika parameter ada.
      - Filter `occurred_at >= from` dan `occurred_at <= to` jika rentang tanggal diberikan.
      - Join/subquery ke `brag_tags` jika parameter filter tag diberikan.
  - [ ] Perbarui `GET /api/learning-notes`:
    - Susun kondisi WHERE dinamis serupa: `userId`, LIKE insensitive pada `title` dan `content`, filter `workspace_id`, filter `created_at`, dan tag filter.
- [ ] **Komponen & UI (Frontend)**
  - [ ] Buat hook sinkronisasi URL search params `src/client/lib/use-filter-params.ts`:
    - Membaca dan memperbarui query params menggunakan React Router `useSearchParams`.
    - Debounce input ketik pencarian (300ms) agar tidak memicu re-render atau query berlebihan.
  - [ ] Buat komponen filter bar `src/client/components/filter-bar.tsx`:
    - Input teks pencarian.
    - Dropdown filter Workspace.
    - Selector filter Tag.
    - Date range picker atau input tanggal sederhana.
    - Tombol "Reset Filter" jika ada filter aktif.
  - [ ] Pasang `FilterBar` pada halaman list Brag Logs dan halaman list Learning Notes.
  - [ ] Tampilkan pesan empty state kontekstual ketika pencarian nihil.
- [ ] **Verifikasi & Test**
  - [ ] Uji pencarian LIKE dengan berbagai variasi huruf besar/kecil.
  - [ ] Uji filter kombinasi (misal tag "Go" + workspace "Kerja" + keyword "API").
  - [ ] Uji isolasi data tetap aman (tidak ada catatan milik user lain yang bocor lewat pencarian).
  - [ ] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `brag_logs`, `brag_tags`, `learning_notes`, `note_tags`, `workspaces`, `tags` (SELECT queries dengan dynamic clauses)
- **Endpoint**:
  - `GET /api/brag-logs` (penambahan query params)
  - `GET /api/learning-notes` (penambahan query params)

## 5. Risiko & Hal yang Perlu Dicek
- Karakter sensitivitas SQLite: Klausa `like('%keyword%', title)` di SQLite secara default case-insensitive untuk karakter ASCII, namun aman jika dipadukan dengan `lower()` atau helper Drizzle `ilike` / `like`.
- Format rentang tanggal: Pastikan konsistensi pembandingan string tanggal format `YYYY-MM-DD` atau parsing timestamp agar tidak ada selisih offset tanggal.
- Hindari N+1 query saat memfilter relasi tag: gunakan subquery atau `inArray` yang efisien.

## 6. Di Luar Scope Slice Ini
- Mesin full-text search (FTS5) yang rumit (cukup query LIKE sesuai prinsip anti-overengineering).
- Fitur simpan preset filter / bookmark filter khusus di database.

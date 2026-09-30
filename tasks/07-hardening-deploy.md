# Slice 7 — Hardening & Deploy

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Memperkuat keamanan sistem dengan rate limiting pada rute autentikasi sensitif, mengaudit dan memverifikasi ketat isolasi data antar user di seluruh rute, menyiapkan skrip deployment Cloudflare Workers (Workers Static Assets SPA + API Hono), serta menyusun panduan operasional produksi.
- **Selesai jika**:
  - Endpoint auth (`/api/auth/google`, `/api/auth/google/callback`) terproteksi rate limiting dasar untuk menangkal brute-force atau spam abuse.
  - Seluruh rangkaian pengujian isolasi data (test suite Vitest dengan workers pool) berjalan 100% lulus.
  - Perintah `bun run build` menghasilkan bundle Worker dan Static Assets yang siap disajikan tanpa error bundling.
  - Database D1 remote berhasil dimigrasi melalui `bunx wrangler d1 migrations apply <db> --remote`.
  - Aplikasi siap tayang di Cloudflare Workers dengan konfigurasi secrets dan OAuth Google yang valid.

## 2. Dependensi
- **Slice 0 sampai Slice 6**: Seluruh fitur fungsional telah selesai diimplementasikan.

## 3. Checklist Task
- [ ] **Rate Limiting & Proteksi Auth**
  - [ ] Implementasi rate limiter ringan pada route auth (misal batasan 10 request per menit per client IP).
  - [ ] Kembalikan respons HTTP `429 Too Many Requests` ketika ambang batas terlampaui.
- [ ] **Audit Isolasi Data Menyeluruh**
  - [ ] Lakukan peninjauan menyeluruh terhadap seluruh kode query database di `src/worker/features/*`:
    - Pastikan TIDAK ADA query mutasi atau fetch yang tidak memiliki filter eksplisit `eq(table.userId, userId)`.
    - Pastikan semua relasi yang dipasang (tag_ids, workspace_id) diverifikasi kepemilikannya sebelum disimpan.
    - Pastikan semua penolakan akses data milik user lain mengembalikan status `404 Not Found` (bukan 403).
  - [ ] Jalankan seluruh skenario test isolasi: `bun run test`.
- [ ] **Konfigurasi Produksi & Build**
  - [ ] Periksa file `wrangler.jsonc`:
    - Binding database D1 untuk environment production.
    - Konfigurasi Workers Static Assets: directori `assets` mengarah ke hasil build client (`dist/client` atau `dist`), dengan pengaturan SPA fallback (`not_found_handling = "single-page-application"`).
  - [ ] Periksa pengaturan cookie sesi:
    - Di environment produksi (`NODE_ENV === 'production'`), aktifkan opsi `secure: true`, `sameSite: 'lax'`, dan `httpOnly: true`.
  - [ ] Jalankan pengujian tipe ketat: `bun run typecheck`.
  - [ ] Jalankan script build: `bun run build`.
- [ ] **Panduan & Dokumentasi Deployment**
  - [ ] Buat berkas panduan deployment `docs/DEPLOYMENT.md` atau cantumkan di README:
    - Langkah pembuatan Google Cloud OAuth Client ID (Authorized JavaScript origins & Authorized redirect URIs untuk domain produksi).
    - Perintah membuat database D1 Cloudflare (`bunx wrangler d1 create pdevlog-db`).
    - Perintah mendaftarkan secrets ke Worker (`bunx wrangler secret put GOOGLE_CLIENT_ID`, dll).
    - Perintah migrasi database produksi (`bun run db:migrate:remote`).
    - Perintah deployment Worker (`bun run deploy`).
- [ ] **Verifikasi Akhir**
  - [ ] Uji coba deployment dry-run atau simulasi environment lokal mendekati produksi.
  - [ ] Seluruh skrip `package.json` terverifikasi berfungsi dengan baik menggunakan runtime Bun.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - Tidak ada perubahan skema tabel baru (pemeriksaan integrasi 7 tabel: `users`, `workspaces`, `tags`, `brag_logs`, `learning_notes`, `brag_tags`, `note_tags`).
- **Endpoint (Modifikasi / Pengetatan)**:
  - `GET /api/auth/google` (rate limited)
  - `GET /api/auth/google/callback` (rate limited)

## 5. Risiko & Hal yang Perlu Dicek
- Penyajian SPA fallback oleh Workers Static Assets: pastikan request ke path API (`/api/*`) tidak tertelan oleh static asset router atau SPA fallback. Rute Hono harus diprioritaskan sebelum fallback asset.
- Eksekusi migrasi D1 di Remote: Pastikan skrip migrasi SQL bersifat aman untuk dijalankan di database produksi Cloudflare D1 tanpa menghilangkan data yang sudah ada.
- Batasan environment Cloudflare: Pastikan tidak ada dependensi Node.js native atau API khusus Bun yang bocor ke kode Worker.

## 6. Di Luar Scope Slice Ini
- Pengaturan domain kustom eksternal di luar instruksi standar Cloudflare.
- Integrasi pihak ketiga berbayar (Sentry, Datadog, dll).
- Otomatisasi CI/CD GitHub Actions lanjutan.

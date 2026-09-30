# Slice 0 — Fondasi + Auth

## Tujuan

Inisialisasi proyek dari nol (Bun, Vite, Hono, Drizzle, Tailwind, shadcn, React Router v7, Vitest), setup Google OAuth end-to-end, dan bangun shell aplikasi (layout dengan sidebar, auth guard, toggle tema).

## Selesai Jika

- User bisa klik "Continue with Google", login berhasil, dan masuk ke layout kosong yang terproteksi (sidebar + area konten).
- Refresh halaman tetap login (JWT di cookie).
- Logout menghapus sesi dan redirect ke halaman login.
- Toggle tema (light/dark/system) berfungsi dan persisten di localStorage.
- User yang belum login tidak bisa akses halaman selain login.

## Dependensi

Tidak ada — ini slice pertama.

## Checklist

### Setup Proyek

- [x] `bun create vite` dengan template React + TypeScript
- [x] Install semua dependency inti (hono, drizzle-orm, drizzle-kit, @hono/zod-validator, arctic, zod, tailwindcss, react-router, @tanstack/react-query, nanoid)
- [x] Konfigurasi `wrangler.jsonc` (D1 binding, Workers Static Assets dengan SPA fallback)
- [x] Konfigurasi `@cloudflare/vite-plugin` di `vite.config.ts`
- [x] Konfigurasi Tailwind CSS + shadcn/ui (CSS variables untuk tema)
- [x] Konfigurasi Drizzle (`drizzle.config.ts` untuk D1)
- [x] Konfigurasi Vitest + `@cloudflare/vitest-pool-workers`
- [x] Setup semua script di `package.json`: `dev`, `build`, `deploy`, `db:generate`, `db:migrate:local`, `db:migrate:remote`, `test`, `typecheck`
- [x] Buat `.dev.vars` template (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET)
- [x] Setup `.gitignore` (termasuk `.dev.vars`, `node_modules`, `.wrangler`)

### Database

- [x] Definisi tabel `users` di Drizzle schema (id, google_sub unique, email, name, avatar_url, created_at, updated_at)
- [x] Generate migrasi dengan `bunx drizzle-kit generate`
- [x] Jalankan migrasi lokal dengan `bunx wrangler d1 migrations apply <db> --local`

### Skema Zod (shared)

- [x] `src/shared/schemas/auth.ts` — schema response untuk `/api/auth/me`

### Route Hono (worker)

- [x] `src/worker/index.ts` — entry point Hono, mount route auth
- [x] `src/worker/db/index.ts` — inisialisasi Drizzle dengan D1 binding
- [x] `src/worker/db/schema.ts` — re-export schema tabel users
- [x] `src/worker/features/auth/route.ts`:
  - `GET /api/auth/google` — buat state + code_verifier, simpan di cookie, redirect ke Google
  - `GET /api/auth/google/callback` — validasi state, tukar code, ambil profil, upsert user, buat JWT cookie
  - `POST /api/auth/logout` — hapus cookie sesi
  - `GET /api/auth/me` — kembalikan data user dari JWT
- [x] `src/worker/middleware/auth.ts` — verifikasi JWT, taruh `user_id` di context, proteksi semua `/api/*` kecuali `/api/auth/*`

### Frontend

- [x] `src/client/lib/api.ts` — inisialisasi Hono RPC client (`hc`)
- [x] `src/client/lib/utils.ts` — utility `cn` untuk shadcn
- [x] `src/client/app/router.tsx` — React Router v7 (mode library/SPA), definisi routes
- [x] `src/client/app/providers.tsx` — QueryClientProvider, tema
- [x] `src/client/app/auth-guard.tsx` — cek `/api/auth/me`, redirect ke login jika belum auth
- [x] `src/client/app/layout.tsx` — sidebar (navigasi, avatar/nama user, logout) + area konten, responsif
- [x] `src/client/features/auth/login-page.tsx` — tombol "Continue with Google" di tengah layar
- [x] Toggle tema (light/dark/system) di sidebar atau header
- [x] Install komponen shadcn yang dibutuhkan (button, avatar, dropdown-menu, dll.)

### Dokumentasi

- [x] Tulis panduan singkat setup Google Cloud Console (OAuth consent screen, OAuth client ID, redirect URI lokal + production)

### Verifikasi

- [x] Jalankan `bun run dev`, buka browser
- [x] Akses halaman → redirect ke login
- [x] Klik "Continue with Google" → login berhasil → masuk layout
- [x] Refresh → tetap login
- [x] Toggle tema → persisten
- [x] Logout → kembali ke login
- [x] `bun run typecheck` tanpa error

## Tabel yang Disentuh

| Tabel   | Aksi                                                                  |
| ------- | --------------------------------------------------------------------- |
| `users` | CREATE (migrasi), INSERT/UPDATE (upsert saat login), SELECT (auth/me) |

## Endpoint

| Method | Path                        | Deskripsi                                   |
| ------ | --------------------------- | ------------------------------------------- |
| GET    | `/api/auth/google`          | Mulai OAuth flow, redirect ke Google        |
| GET    | `/api/auth/google/callback` | Callback OAuth, upsert user, set JWT cookie |
| POST   | `/api/auth/logout`          | Hapus cookie sesi                           |
| GET    | `/api/auth/me`              | Data user yang sedang login                 |

## Risiko / Hal yang Perlu Dicek

- Verifikasi API `@cloudflare/vite-plugin` terbaru — struktur config dan cara integrasi dengan Hono Worker.
- Verifikasi Arctic v3 Google provider mendukung PKCE. Jika tidak, gunakan Authorization Code biasa.
- Cookie `Secure` flag tidak bisa diset di HTTP localhost — perlu conditional.
- `PRAGMA foreign_keys = ON` di D1 — cek apakah Drizzle atau koneksi D1 perlu setting ini secara manual.
- Workers Static Assets + SPA fallback: pastikan `not_found_handling = "single-page-application"` di wrangler.jsonc.
- Verifikasi `@cloudflare/vitest-pool-workers` setup dan kompatibilitas versi.

## Di Luar Scope Slice Ini

- Tabel selain `users` (workspaces, tags, dll.)
- Halaman selain login dan layout kosong
- Fitur CRUD apa pun
- Isi sidebar selain navigasi placeholder dan user info
- Test isolasi data (dimulai di Slice 1)

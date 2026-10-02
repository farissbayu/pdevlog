# Panduan Deployment — Personal Dev Log

Dokumen ini merangkum langkah-langkah menyiapkan environment produksi dan
men-deploy Worker (API Hono) beserta Static Assets (SPA React) ke Cloudflare
Workers.

> Untuk setup OAuth lokal, lihat [google-oauth-setup.md](./google-oauth-setup.md).
> Untuk setup CI/CD GitHub Actions, lihat
> [cicd-cloudflare-guide.md](../tasks/cicd-cloudflare-guide.md).

## 1. Prasyarat

- Akun Cloudflare dengan Workers & D1 aktif.
- Akun Google Cloud dengan akses membuat OAuth Client ID.
- Runtime [Bun](https://bun.sh) dan dependency terpasang (`bun install`).
- Login Wrangler: `bunx wrangler login`.

## 2. Buat Google Cloud OAuth Client

1. Buka [Google Cloud Console](https://console.cloud.google.com/) →
   **APIs & Services** → **Credentials** → **+ Create Credentials** →
   **OAuth client ID**.
2. Application type: **Web application**, name: `Personal Dev Log`.
3. **Authorized JavaScript origins** (tambahkan origin produksi):
   - `https://pdevlog.<subdomain>.workers.dev`
   - (opsional) custom domain Anda
4. **Authorized redirect URIs**:
   - `https://pdevlog.<subdomain>.workers.dev/api/auth/google/callback`
   - (opsional) `https://<custom-domain>/api/auth/google/callback`

Redirect URI harus sama persis dengan `${origin}/api/auth/google/callback`.
Salin **Client ID** dan **Client Secret** untuk langkah berikutnya.

## 3. Buat Database D1

```bash
bunx wrangler d1 create pdevlog-db
```

Salin `database_id` yang dihasilkan ke `wrangler.jsonc` pada blok
`d1_databases` (binding `DB`).

> Jika `database_id` berubah, jalankan ulang migrasi lokal sebelum `bun run dev`
> karena penyimpanan lokal di-key berdasarkan `database_id`:
> ```bash
> bun run db:migrate:local
> ```

## 3b. Buat Bucket R2 (Lampiran)

Lampiran gambar (mis. screenshot Spark) disimpan di R2 dan disajikan lewat
endpoint backend (`/api/sparks/attachments/:id`) yang memeriksa kepemilikan,
bukan lewat URL publik. Bucket ini bersifat universal untuk pdevlog — object
di-key dengan folder `attachments/{userId}/{ownerType}/{ownerId}/...`, sehingga
spark, learning note, dan brag log berbagi satu bucket.

```bash
bunx wrangler r2 bucket create pdevlog-storage
```

Binding `STORAGE` sudah dideklarasikan di `wrangler.jsonc` pada blok
`r2_buckets`. Saat `bun run dev`, Wrangler memakai penyimpanan R2 lokal secara
otomatis; tidak ada secret tambahan yang diperlukan (akses memakai binding, bukan
API token S3).

## 4. Daftarkan Secrets ke Worker

Jalankan satu per satu dan ketik nilainya saat diminta:

```bash
bunx wrangler secret put GOOGLE_CLIENT_ID
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put JWT_SECRET
```

- `JWT_SECRET` harus berupa string acak minimal 32 karakter.
- Jangan pernah meng-commit `.dev.vars` atau nilai secret ke Git.

## 5. Migrasi Database Produksi

```bash
bun run db:migrate:remote
```

Setara dengan
`wrangler d1 migrations apply pdevlog-db --remote`. Skrip migrasi di `drizzle/`
bersifat aditif sehingga aman dijalankan pada database yang sudah berisi data.

## 6. Build & Deploy

```bash
bun run build   # tsc -b && vite build  -> dist/client + dist/pdevlog
bun run deploy  # bun run build && wrangler deploy
```

`@cloudflare/vite-plugin` menghasilkan bundel Worker (`dist/pdevlog/index.js`)
dan Static Assets SPA (`dist/client`), lalu mengarahkan deployment Wrangler ke
konfigurasi hasil build sehingga `assets.directory` otomatis menunjuk ke
`dist/client`. Karena itu, **jangan** menambahkan `assets.directory` manual di
`wrangler.jsonc` saat memakai plugin ini.

## 7. Konfigurasi Produksi Penting

### Static Assets & SPA Fallback (`wrangler.jsonc`)

```jsonc
"assets": {
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*"]
}
```

- `run_worker_first: ["/api/*"]` memastikan seluruh request API ditangani Hono
  lebih dulu, sehingga tidak tertelan SPA fallback.
- `not_found_handling: "single-page-application"` mengarahkan navigasi
  non-API ke `index.html` (routing React Router).

### Cookie Sesi

Cookie sesi (`pdevlog_session`) dan cookie OAuth selalu memakai
`httpOnly: true` dan `sameSite: "Lax"`, dengan `secure` otomatis aktif saat
request dilayani melalui HTTPS (produksi Cloudflare). Cookie `Secure` tidak
di-set di `http://localhost` agar pengembangan lokal tetap berjalan.

### Rate Limiting Auth

Endpoint `GET /api/auth/google` dan
`GET /api/auth/google/callback` dibatasi **10 request per menit per client IP**
(basis `CF-Connecting-IP`). Melebihi ambang batas mengembalikan
`429 Too Many Requests` beserta header `Retry-After`.

## 8. Verifikasi

- Dry-run bundling tanpa meng-upload:
  ```bash
  bun run build
  bunx wrangler deploy --dry-run
  ```
- Cek health endpoint setelah deploy (butuh sesi login):
  ```bash
  curl https://pdevlog.<subdomain>.workers.dev/api/health
  ```
- Jalankan gerbang kualitas lengkap sebelum deploy:
  ```bash
  bun run typecheck && bun run lint && bun run test
  ```

## 9. CI/CD

Otomasi typecheck, test isolasi, migrasi D1 remote, dan deploy pada push ke
`main` tersedia di [cicd-cloudflare-guide.md](../tasks/cicd-cloudflare-guide.md)
(Fase C).

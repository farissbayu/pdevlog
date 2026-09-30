# Panduan Setup Cloudflare, Google OAuth, & CI/CD (GitHub Actions)

Dokumen ini berisi panduan terstruktur langkah demi langkah untuk menyiapkan **Google OAuth 2.0**, **Cloudflare (D1 & Workers)**, dan otomatisasi deployment dengan **GitHub Actions (CI/CD)**, serta penjelasan tahapan waktu yang tepat untuk menjalankannya.

---

## 1. Timeline & Waktu Pelaksanaan

Untuk menjaga alur kerja tetap lean dan anti-overengineering, setup dibagi ke dalam 3 fase berikut:

| Fase | Waktu Eksekusi | Fokus Aktivitas |
|---|---|---|
| **Fase A (Lokal & OAuth)** | **Sebelum / Saat Slice 0** | Setup Google Cloud Console (URI localhost) dan isi file `.dev.vars` lokal. |
| **Fase B (Cloudflare Remote)** | **Setelah Slice 0 Selesai** | Buat database D1 remote di Cloudflare dan daftarkan Worker secrets. |
| **Fase C (CI/CD & Domain Prod)** | **Pada Slice 7 (Hardening & Deploy)** | Setup Cloudflare API Token, GitHub Secrets, workflow deployment, dan update redirect URI production. |

---

## 2. Fase A: Setup Google Cloud Console (Sebelum/Saat Slice 0)

Google OAuth dibutuhkan agar autentikasi pengguna pada Slice 0 dapat diuji secara end-to-end di environment lokal.

### Langkah-langkah:
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru: klik dropdown proyek di bilah atas → **New Project** → beri nama `pdevlog` → **Create**.
3. **Konfigurasi OAuth Consent Screen**:
   - Navigasi ke: **APIs & Services** > **OAuth consent screen**.
   - User Type: pilih **External** → klik **Create**.
   - Isi informasi dasar aplikasi:
     - **App name**: `Personal Dev OS`
     - **User support email**: pilih email Google Anda.
     - **Developer contact information**: masukkan email Google Anda.
   - Klik **Save and Continue**.
   - Pada langkah **Scopes**:
     - Klik **Add or Remove Scopes**.
     - Centang: `openid`, `.../auth/userinfo.email`, dan `.../auth/userinfo.profile`.
     - Klik **Update** → **Save and Continue**.
   - Pada langkah **Test users**:
     - Tambahkan email Google Anda sendiri (karena aplikasi masih dalam status "Testing").
     - Klik **Save and Continue**.
4. **Buat OAuth Client ID**:
   - Navigasi ke: **APIs & Services** > **Credentials**.
   - Klik **+ Create Credentials** > pilih **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `pdevlog-local`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
   - **Authorized redirect URIs**:
     - `http://localhost:5173/api/auth/google/callback`
   - Klik **Create**.
5. Salin **Client ID** dan **Client Secret** ke file `.dev.vars` di root repositori:
   ```env
   GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
   JWT_SECRET="masukkan-string-acak-panjang-dan-rahasia-minimal-32-karakter"
   ```

---

## 3. Fase B: Setup Cloudflare D1 Remote & Worker Secrets (Setelah Slice 0 Selesai)

Setelah login lokal dan database lokal (Miniflare) terbukti berhasil, siapkan database D1 remote di Cloudflare.

### 1. Login Cloudflare via Terminal
```bash
bunx wrangler login
```

### 2. Buat Database D1 Remote
```bash
bunx wrangler d1 create pdevlog-db
```
Catat output konfigurasi yang muncul:
```jsonc
[[d1_databases]]
binding = "DB"
database_name = "pdevlog-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
Salin nilai `database_id` tersebut ke dalam berkas `wrangler.jsonc`.

> **Catatan penting:** Database D1 lokal (Miniflare) disimpan di `.wrangler/state/v3/d1` dengan kunci berdasarkan `database_id`. Saat Anda mengganti placeholder `database_id` dengan ID remote yang asli, penyimpanan lokal akan dianggap sebagai database baru yang **kosong**. Jalankan ulang migrasi lokal sebelum `bun run dev`:
> ```bash
> bun run db:migrate:local
> ```
> Jika tidak, login akan gagal dengan error `D1_ERROR: no such table: users`.

### 3. Daftarkan Secrets ke Cloudflare Worker
Jalankan perintah ini satu per satu (wrangler akan meminta Anda mengetikkan nilai rahasia di terminal):
```bash
bunx wrangler secret put GOOGLE_CLIENT_ID
bunx wrangler secret put GOOGLE_CLIENT_SECRET
bunx wrangler secret put JWT_SECRET
```

---

## 4. Fase C: Setup GitHub Actions CI/CD (Di Slice 7)

Workflow ini secara otomatis akan menjalankan typecheck, test isolasi data, migrasi D1 remote, dan deployment Worker setiap kali ada push ke branch `main`.

### 1. Buat Cloudflare API Token
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) > Icon Profil > **My Profile** > **API Tokens**.
2. Klik **Create Token** > pilih template **Edit Cloudflare Workers** (atau Custom Token).
3. Pastikan token memiliki hak akses berikut:
   - `Account` - `Workers D1` - `Edit`
   - `Account` - `Workers Scripts` - `Edit`
   - `Account` - `Account Settings` - `Read`
4. Account Resources: **Include All Accounts** (atau akun Cloudflare spesifik).
5. Klik **Continue to summary** → **Create Token** → Salin token yang dihasilkan.
6. Catat juga **Account ID** Cloudflare Anda (terlihat di URL dashboard atau halaman Workers & Pages).

### 2. Konfigurasi GitHub Repository Secrets
Buka repository GitHub proyek:
1. Masuk ke tab **Settings** > **Secrets and variables** > **Actions**.
2. Klik **New repository secret**:
   - `CLOUDFLARE_API_TOKEN`: Token API yang dibuat di langkah sebelumnya.
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID milik Anda.

### 3. File Workflow `.github/workflows/deploy.yml`
```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  test-and-typecheck:
    name: Test & Typecheck
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run Typecheck
        run: bun run typecheck

      - name: Run Isolation & Unit Tests
        run: bun run test

  deploy:
    name: Migrate D1 & Deploy
    needs: test-and-typecheck
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Apply D1 Migrations (Remote)
        run: bun run db:migrate:remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Build Frontend & Worker
        run: bun run build

      - name: Deploy to Cloudflare Workers
        run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 4. Tambahkan Redirect URI Production di Google Console
Setelah deployment pertama berhasil dan Anda mendapatkan domain Worker (`https://pdevlog.<subdomain>.workers.dev` atau custom domain):
1. Buka [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**.
2. Klik ikon edit pada OAuth Client ID yang sudah dibuat.
3. Pada **Authorized JavaScript origins**, tambahkan:
   - `https://pdevlog.<subdomain>.workers.dev`
4. Pada **Authorized redirect URIs**, tambahkan:
   - `https://pdevlog.<subdomain>.workers.dev/api/auth/google/callback`
5. Klik **Save**.

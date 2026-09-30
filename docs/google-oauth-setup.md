# Panduan Setup Google OAuth (Google Cloud Console)

Slice 0 membutuhkan OAuth Client ID agar login "Continue with Google" bisa diuji end-to-end secara lokal.

## 1. Buat Proyek

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Klik dropdown proyek di bilah atas → **New Project**.
3. Beri nama `pdevlog` → **Create**.

## 2. Konfigurasi OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**.
2. User Type: **External** → **Create**.
3. Isi:
   - **App name**: `Personal Dev OS`
   - **User support email**: email Google Anda
   - **Developer contact information**: email Google Anda
4. **Save and Continue**.
5. **Scopes**: **Add or Remove Scopes** → centang `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → **Update** → **Save and Continue**.
6. **Test users**: tambahkan email Google Anda sendiri (aplikasi masih berstatus "Testing") → **Save and Continue**.

## 3. Buat OAuth Client ID

1. **APIs & Services** → **Credentials** → **+ Create Credentials** → **OAuth client ID**.
2. Application type: **Web application**.
3. Name: `pdevlog-local`.
4. **Authorized JavaScript origins**:
   - `http://localhost:5173`
5. **Authorized redirect URIs**:
   - `http://localhost:5173/api/auth/google/callback`
6. **Create**, lalu salin **Client ID** dan **Client Secret**.

> Redirect URI harus sama persis dengan `${origin}/api/auth/google/callback`. Worker membentuk URL callback dari origin request, jadi jumlah path harus sesuai.

## 4. Isi `.dev.vars`

Salin `.dev.vars.example` menjadi `.dev.vars` di root repositori dan isi nilainya:

```env
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
JWT_SECRET="string-acak-panjang-minimal-32-karakter"
```

`.dev.vars` sudah di-ignore oleh Git. Jangan pernah commit file ini.

## 5. Redirect URI Production

Setelah Worker ter-deploy (lihat [cicd-cloudflare-guide.md](../tasks/cicd-cloudflare-guide.md) Fase C), tambahkan origin dan redirect URI production pada OAuth Client ID yang sama:

- **Authorized JavaScript origins**: `https://<worker-name>.<subdomain>.workers.dev`
- **Authorized redirect URIs**: `https://<worker-name>.<subdomain>.workers.dev/api/auth/google/callback`

## 6. Jalankan

```bash
bun run dev
```

Buka `http://localhost:5173`, klik **Continue with Google**, lalu pastikan login berhasil dan halaman terproteksi tampil.

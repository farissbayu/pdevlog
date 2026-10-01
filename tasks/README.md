# Personal Dev OS — Rencana Kerja

## Daftar Slice

| # | Slice | File | Status | Dependensi |
|---|-------|------|--------|------------|
| 0 | Fondasi + Auth | [00-foundation-auth.md](./00-foundation-auth.md) | `todo` | — |
| 1 | Workspaces | [01-workspaces.md](./01-workspaces.md) | `todo` | Slice 0 |
| 2 | Tags | [02-tags.md](./02-tags.md) | `todo` | Slice 0 |
| 3 | Brag Logs | [03-brag-logs.md](./03-brag-logs.md) | `todo` | Slice 1, 2 |
| 4 | Learning Notes | [04-learning-notes.md](./04-learning-notes.md) | `todo` | Slice 1, 2 |
| 5 | Cari & Filter | [05-search-filter.md](./05-search-filter.md) | `done` | Slice 3, 4 |
| 6 | Dashboard & Settings | [06-dashboard-settings.md](./06-dashboard-settings.md) | `todo` | Slice 3, 4 |
| 7 | Hardening & Deploy | [07-hardening-deploy.md](./07-hardening-deploy.md) | `todo` | Slice 0–6 |

## Panduan Infrastruktur & CI/CD
- [Panduan Setup Cloudflare, Google OAuth, & CI/CD](./cicd-cloudflare-guide.md)

## Diagram Dependensi

```
0 (Foundation + Auth)
├── 1 (Workspaces)
│   ├── 3 (Brag Logs) ← juga butuh 2
│   └── 4 (Learning Notes) ← juga butuh 2
├── 2 (Tags)
│   ├── 3 (Brag Logs)
│   └── 4 (Learning Notes)
│
5 (Search & Filter) ← butuh 3, 4
6 (Dashboard & Settings) ← butuh 3, 4
7 (Hardening & Deploy) ← butuh semua (0–6)
```

> Slice 5 dan 6 independen satu sama lain, bisa dikerjakan dalam urutan mana pun setelah 3 dan 4 selesai.

## Asumsi yang Diambil

1. **Local dev** menggunakan `@cloudflare/vite-plugin` (satu command `vite dev` yang mengintegrasikan Vite HMR + miniflare). Jika belum stabil, fallback ke Vite proxy + `wrangler dev` terpisah.
2. **`nanoid`** ditambahkan sebagai dependency karena skema membutuhkan text-based primary key, meski tidak disebut eksplisit di tech stack.
3. **Syntax highlighting** untuk code block di Learning Notes menggunakan library paling ringan yang kompatibel dengan `react-markdown` (misal `rehype-highlight`). Ditentukan saat Slice 4.
4. **Nama workspace** unik per user (mencegah kebingungan).
5. **Sidebar** menampilkan workspace sebagai flat list dengan badge tipe (work/learning), tanpa pengelompokan per section.
6. **Dashboard** menampilkan 10 item terbaru (brag logs + learning notes digabung, diurutkan `created_at` desc).
7. **Hapus akun** menggunakan dialog konfirmasi sederhana (ketik "DELETE" untuk mengonfirmasi).
8. **Cookie `Secure`** hanya di-set saat environment production, tidak di localhost.
9. **Export Markdown** menghasilkan satu file `.md` yang di-download langsung dari browser.
10. **Onboarding user baru**: empty state dengan CTA "Buat workspace pertama" saat user belum punya workspace.
11. **PKCE**: jika Arctic tidak mendukung PKCE untuk Google, gunakan Authorization Code flow biasa (tetap aman karena server-side dengan `client_secret`).

## Pertanyaan Terbuka

1. Pendekatan local dev — `@cloudflare/vite-plugin` terintegrasi vs Vite + wrangler terpisah? (asumsi: terintegrasi, lihat #1 di atas)
2. Sidebar workspace — flat list vs dikelompokkan per tipe? (asumsi: flat list, lihat #5 di atas)

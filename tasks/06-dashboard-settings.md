# Slice 6 — Dashboard & Settings

## 1. Tujuan & Kriteria Selesai
- **Tujuan**: Membangun tampilan Dashboard utama yang merangkum aktivitas terbaru developer (agregasi Brag Logs dan Learning Notes terkini), serta halaman Settings untuk melihat data profil, mengekspor Brag Logs ke format Markdown, dan menghapus akun beserta seluruh data secara permanen (cascade delete).
- **Selesai jika**:
  - Halaman Dashboard menampilkan timeline aktivitas terbaru (maksimal 10 item kombinasi log & note) milik user, diurutkan kronologis terbaru, dengan tautan cepat ke detail masing-masing item.
  - Halaman Settings menampilkan informasi profil Google user (nama, email, avatar).
  - Fitur Ekspor: user dapat memilih rentang tanggal dan mengunduh berkas Markdown `.md` yang berisi seluruh Brag Logs dalam format STAR rapi.
  - Fitur Hapus Akun: user dapat meminta penghapusan akun dengan konfirmasi eksplisit; akun user dan seluruh data di 7 tabel terhapus tuntas dari D1; sesi JWT dicabut, user ter-redirect ke halaman login.

## 2. Dependensi
- **Slice 3 (Brag Logs)** & **Slice 4 (Learning Notes)**: Sebagai sumber data aktivitas agregasi dashboard dan data ekspor.

## 3. Checklist Task
- [x] **Skema Zod (Shared)**
  - [x] Buat file `src/shared/schemas/settings.ts`:
    - Skema query export brag logs (`exportLogsQuerySchema`: `from`, `to` opsional).
    - Skema konfirmasi hapus akun (validasi input konfirmasi misal teks `"DELETE"`).
- [x] **Route Hono (Worker)**
  - [x] Buat `src/worker/features/dashboard/route.ts`:
    - `GET /api/dashboard/recent`: Mengambil 10 item terbaru milik user (query 10 brag logs terbaru + 10 learning notes terbaru, satukan di memory worker, urutkan tanggal desc, ambil top 10).
  - [x] Buat `src/worker/features/export/route.ts`:
    - `GET /api/export/brag-logs`: Ambil data brag logs user sesuai filter rentang tanggal, susun string Markdown dengan format STAR terstruktur, kirim sebagai file attachment (`Content-Disposition: attachment; filename=brag-logs.md`).
  - [x] Buat/perbarui endpoint hapus akun di `src/worker/features/auth/route.ts` atau `settings/route.ts`:
    - `DELETE /api/auth/account`:
      - Ambil `userId` dari context.
      - Hapus baris dari tabel `users` (foreign key `ON DELETE CASCADE` di SQLite D1 akan otomatis menghapus workspaces, tags, brag_logs, learning_notes, brag_tags, note_tags).
      - Bersihkan cookie auth JWT (set cookie maxAge 0).
      - Return status 200 / success.
- [x] **API Client & Hooks (Frontend)**
  - [x] Definisikan hooks di `src/client/features/dashboard/api.ts` dan `src/client/features/settings/api.ts`:
    - `useRecentActivityQuery`
    - `useExportBragLogs` (trigger browser download)
    - `useDeleteAccountMutation` (invalidation total dan redirect ke `/login`)
- [x] **Komponen & UI (Frontend)**
  - [x] Buat halaman `src/client/features/dashboard/dashboard-page.tsx`:
    - Kartu ringkasan aktivitas terbaru.
    - List interaktif dengan icon pembeda tipe (piala/star untuk Brag Log, dokumen/buku untuk Learning Note), judul, tag, dan tanggal.
    - Sediakan Loading skeleton dan Empty state ("Belum ada aktivitas, mulai dengan mencatat brag log atau learning note!").
  - [x] Buat halaman `src/client/features/settings/settings-page.tsx`:
    - Bagian Profil: Avatar Google, Nama Lengkap, Alamat Email (tampilan read-only).
    - Bagian Ekspor Data: Pemilih rentang tanggal + tombol aksi "Export to Markdown (.md)".
    - Bagian Zona Bahaya (Danger Zone): Tombol "Hapus Akun", dialog konfirmasi ketik teks konfirmasi untuk mencegah ketidaksengajaan.
  - [x] Pastikan navigasi sidebar memiliki link aktif ke Dashboard dan Settings.
- [x] **Test Isolasi & Cascade Hapus Akun**
  - [x] Buat test `tests/isolation/delete-account.test.ts`:
    - User membuat workspace, tag, brag log, dan learning note.
    - Panggil endpoint `DELETE /api/auth/account`.
    - Verifikasi baris di tabel `users` hilang.
    - Verifikasi seluruh data terkait di tabel `workspaces`, `tags`, `brag_logs`, `learning_notes`, `brag_tags`, `note_tags` benar-benar terhapus (cascade berfungsi sempurna).
    - Pastikan data milik user lain tidak terhapus.
- [x] **Verifikasi Akhir**
  - [x] Cek alur download file Markdown dan buka isi berkasnya.
  - [x] Cek eksekusi hapus akun di browser dan pastikan kembali ke halaman login.
  - [x] Jalankan `bun run test` dan `bun run typecheck`.

## 4. Tabel dan Endpoint yang Disentuh
- **Tabel**:
  - `users` (SELECT, DELETE)
  - `brag_logs`, `learning_notes`, `workspaces`, `tags`, `brag_tags`, `note_tags` (SELECT untuk dashboard/export, CASCADE DELETE saat user dihapus)
- **Endpoint**:
  - `GET /api/dashboard/recent`
  - `GET /api/export/brag-logs`
  - `DELETE /api/auth/account`

## 5. Risiko & Hal yang Perlu Dicek
- Kehandalan Cascade Delete di SQLite D1: Pastikan D1 mengeksekusi Foreign Key cascade dengan benar. Jika pragma foreign keys perlu diaktifkan eksplisit, pastikan konfigurasi Drizzle/D1 menanganinya.
- Response stream / binary text download: Header HTTP untuk download berkas `.md` harus menyertakan `Content-Type: text/markdown; charset=utf-8` dan `Content-Disposition`.
- Pembersihan cache client: Saat akun dihapus, `queryClient.clear()` wajib dipanggil agar tidak ada data stale di memori browser.

## 6. Di Luar Scope Slice Ini
- Ekspor ke format PDF / DOCX.
- Fitur edit profil (karena nama, email, dan avatar murni terikat pada profil Google OAuth).
- Pemulihan akun (soft delete) — sesuai requirement, hapus akun bersifat langsung dan permanen.

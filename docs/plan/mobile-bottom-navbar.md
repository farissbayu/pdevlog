# Technical Plan: Mobile Bottom Navigation Bar Implementation

> **Status:** Draft / Active Experiment (Rencana Implementasi & Prototipe Aktif)  
> **Target Version:** `pdevlog` v0.4+  
> **Audience:** Frontend & UX Engineer  
> **Core Objective:** Mengganti navigasi mobile berbasis *top hamburger dropdown* dengan *persistent bottom navigation bar* (Tab Bar) yang ergonomis, mengintegrasikan tombol aksi cepat *Spark Capture*, serta menyediakan menu sekunder *"More"* untuk menjaga kesederhanaan visual tanpa menghilangkan aksesibilitas fitur.

---

## 1. Problem Statement & Latar Belakang

### 1.1 Kondisi Saat Ini (Current State)
Saat ini pada layar mobile (`< 768px`), navigasi dikelola oleh komponen `MobileHeader` di [`src/client/app/layout.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/app/layout.tsx#L270-L326):
1. **Pola:** Top App Bar (`h-14`, sticky) dengan logo di kiri, serta `ThemeToggle` dan tombol *Hamburger Menu* di kanan atas.
2. **Interaksi:** Menekan tombol hamburger membuka Radix `DropdownMenu` yang berisi seluruh 8 rute aplikasi (`Dashboard`, `Workspaces`, `Notes`, `Brag Logs`, `Skill Shredder`, `Sparks`, `Tags`, `Settings`) plus email dan tombol *Log out*.
3. **Floating Action Button (FAB):** Di [`src/client/features/sparks/sparks-provider.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/sparks-provider.tsx#L73-L82), terdapat tombol capture Spark mengambang di pojok kanan bawah (`fixed right-6 bottom-6 z-40`).

### 1.2 Masalah UX & Ergonomi
1. **The "Thumb Zone" Constraint:** Pada smartphone modern berukuran layar 6.1 inci ke atas, sudut kanan atas adalah area yang paling sulit dijangkau oleh satu tangan (*one-handed grip*). Pengguna dipaksa menggunakan tangan kedua atau meregangkan jempol.
2. **Interaction Friction:** Berpindah antar bagian rutin (misalnya memeriksa *Dashboard*, membuka *Notes*, lalu melihat *Workspaces*) membutuhkan 2 ketukan setiap kali: Ketuk Menu $\rightarrow$ Ketuk Rute.
3. **Ketiadaan Konteks Halaman Aktif (*Wayfinding*):** Header mobile saat ini hanya menampilkan nama statis *"Personal Dev Log"* tanpa indikator visual halaman mana yang sedang aktif.
4. **Hilangnya Rute Profile:** Di desktop, link `/profile` (*Profile & CV*) tersedia di `UserMenu`, namun pada menu hamburger mobile link ini terlewat dan tidak dapat diakses langsung.

---

## 2. Analisis & Trade-off Navigasi

| Kriteria | Top Hamburger Menu (Lama) | Bottom Navigation Bar (Baru) |
| :--- | :--- | :--- |
| **Ergonomi Jempol** | ❌ Sangat rendah (area kanan atas) | ✅ Sangat tinggi (area bawah layar) |
| **Efisiensi Navigasi** | ❌ 2-tap per perpindahan rute | ✅ 1-tap instan untuk rute utama |
| **Kesadaran Konteks (*Active State*)** | ❌ Tersembunyi di dalam menu tertutup | ✅ Persisten (ikon + label aktif tersorot) |
| **Kapasitas Rute** | ✅ Menampung seluruh 8+ rute sekaligus | ⚠️ Terbatas pada 4–5 slot agar tidak sesak |
| **Ruang Vertikal Konten** | ✅ Mengosongkan area bawah | ⚠️ Mengambil ~56–64px ruang vertikal di bawah |
| **Interaksi dengan Floating Spark FAB** | ✅ Tidak bersinggungan | ⚠️ Bersinggungan langsung dengan FAB kanan bawah |

---

## 3. Desain Arsitektur Bottom Navigation

### 3.1 Pola 5-Slot Hybrid (4 Primary Tabs + 1 Center Quick Action)
Karena `pdevlog` memiliki 8 rute navigasi utama, memaksakan seluruh 8 rute ke dalam bar bawah akan merusak *touch target* (< 48px standar Apple HIG & WCAG).

Solusi terbaik adalah pola **Hybrid 5-Slot**:
```
┌────────────────────────────────────────────────────────────────────────┐
│   [Dashboard]    [Workspaces]    ( ⚡ Spark )    [Notes]    [More...]  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Pembagian Slot Navigasi:
1. **Slot 1: Dashboard (`LayoutDashboard`)**
   - Rute: `/dashboard`
   - Peran: Tinjauan metrik, statistik harian, dan aktivitas terkini.
2. **Slot 2: Workspaces (`FolderKanban`)**
   - Rute: `/workspaces`
   - Peran: Manajemen konteks kerja, repositori, dan proyek aktif.
3. **Slot 3: Quick Spark Capture (`Sparkles`) — Center Elevated Action**
   - Aksi: Membuka dialog `openCapture()` dari `useSparks()`.
   - Menggantikan floating FAB di mobile sehingga tidak terjadi tumpang tindih visual.
4. **Slot 4: Notes (`NotebookPen`)**
   - Rute: `/notes`
   - Peran: Akses cepat ke catatan terstruktur harian.
5. **Slot 5: More Menu (`Menu` / `MoreHorizontal`)**
   - Membuka menu popover / drawer untuk rute sekunder:
     - 📜 **Brag Logs** (`/brag-logs`)
     - ✂️ **Skill Shredder** (`/skill-shredder`)
     - ✨ **Sparks Feed** (`/sparks`)
     - 🏷️ **Tags** (`/tags`)
     - 👤 **Profile & CV** (`/profile`)
     - ⚙️ **Settings** (`/settings`)
     - 🚪 **Log out**

### 3.2 Penanganan Modus Admin (`AdminLayout`)
Untuk console admin, bar bawah disesuaikan dengan kebutuhan navigasi admin:
1. **Slot 1: Overview** (`/admin`, `Shield`)
2. **Slot 2: Users** (`/admin/users`, `Users`)
3. **Slot 3: App Workspace** (`/dashboard`, `LayoutDashboard`) — Shortcut kembali ke aplikasi utama.
4. **Slot 4: More / Log out** (`Menu`)

---

## 4. Rincian Teknis Implementasi

### 4.1 Safe Area Inset & Viewport Padding
1. **Padding Konten Bawah:**
   Elemen `<main>` pada layout harus ditambahkan padding bawah pada layar mobile:
   ```tsx
   <main className={cn(
     "transition-[padding] duration-200",
     collapsed ? "md:pl-16" : "md:pl-56",
     "pb-20 md:pb-6" // Mencegah konten tertutup bottom bar
   )}>
   ```
2. **iOS Home Indicator Support:**
   Bottom bar harus mendukung CSS env safe-area:
   ```css
   padding-bottom: env(safe-area-inset-bottom, 0px);
   ```

### 4.2 Konsolidasi Floating Spark FAB ([`sparks-provider.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/sparks-provider.tsx))
Tombol floating capture yang berada di `fixed right-6 bottom-6 z-40` disembunyikan pada layar mobile (`hidden md:inline-flex`), karena fungsi penangkapan spark sudah terintegrasi secara elegan di slot tengah bottom bar. Pada layar desktop (`md`), tombol FAB tetap muncul seperti semula.

### 4.3 Penyederhanaan Top Header ([`MobileHeader`])
Top header di mobile tetap dipertahankan namun disederhanakan:
- Sisi Kiri: Logo `pdevlog` & Judul.
- Sisi Kanan: `ThemeToggle` & User Avatar / Menu ringkas (`UserMenu` compact).
- Hamburger dropdown yang sebelumnya digunakan dikomentari (*commented out*) untuk memvalidasi alur navigasi bottom navbar.

---

## 5. Rencana Fase & Rollout

### Fase 1: Prototipe Aktif (Saat Ini)
- Berikan komentar (*comment out*) pada menu navigasi hamburger lama di `MobileHeader`.
- Pasang komponen prototipe `MobileBottomNav` di `AppLayout` dan `AdminLayout`.
- Atur FAB Spark agar `hidden md:inline-flex`.
- Beri ruang padding bawah `pb-20` pada kontainer utama.
- Uji coba responsivitas dan interaksi langsung di peramban.

### Fase 2: Peningkatan Interaksi & Haptic Feel
- Evaluasi penggunaan *Bottom Sheet* / *Drawer* geser ke atas (menggunakan Radix Dialog atau Vaul) untuk menu "More" agar terasa lebih native dibanding dropdown menu standar.
- Tambahkan animasi transisi halus saat menekan tombol tengah Spark.
- Uji alur input ketika virtual keyboard muncul (memastikan bar bawah tidak menghalangi input form panjang pada mobile browser).

### Fase 3: Evaluasi Metrik & Keputusan Permanen
- Bandingkan kenyamanan penulisan log harian antara versi lama dan versi baru.
- Jika disetujui penuh: Hapus kode lama yang dikomentari, bersihkan style tidak terpakai, dan perbarui dokumentasi arsitektur antarmuka pengguna.

---

## 6. Prosedur Rollback
Jika pengguna merasa navigasi lama lebih disukai:
1. Hapus komponen `<MobileBottomNav />` dari [`src/client/app/layout.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/app/layout.tsx).
2. Hapus komentar pada blok `DropdownMenu` di dalam fungsi `MobileHeader`.
3. Kembalikan class tombol di [`src/client/features/sparks/sparks-provider.tsx`](file:///home/farissbayu/projects/pdevlog/src/client/features/sparks/sparks-provider.tsx) dari `hidden md:inline-flex` menjadi `inline-flex`.


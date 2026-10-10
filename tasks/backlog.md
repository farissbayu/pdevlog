## feats

### Quick Wins & Improvements

- [x] navigation: tambahkan menu "Notes" ke sidebar & mobile navigation (`src/client/app/layout.tsx`).

### Frictionless Capture

- [ ] chrome extension (web clipper & quick spark)
  - Quick Spark popup via shortcut (`Alt+S` / `Cmd+Shift+S`) untuk brain dump instan tanpa context switching.
  - Highlight to Spark: seleksi teks di artikel/GitHub/docs -> klik kanan -> simpan kutipan sebagai Spark dengan auto-attach title & source URL.
  - Intentional bookmarking: simpan link dengan catatan 1-kalimat / takeaway relevansi (bukan sekadar penimbun link mati).
  - Autentikasi via Personal Access Token (PAT) dari menu Settings pdevlog.
- [ ] telegram bot integration
  - Webhook endpoint di Cloudflare Workers (`/api/telegram/webhook`) dengan autentikasi pairing code.
  - Forward pesan, link, gambar, atau audio langsung menjadi Spark.
  - Daily/weekly reflection check-in ("Apa win kamu hari ini?") dengan AI STAR auto-drafting.

### Insights & Career Growth

- [ ] insight
  - Activity Heatmap (GitHub-style contribution/log heatmap untuk brag logs, notes, dan sparks).
  - STAR Competency & Skill Distribution (analisis tag: System Design, Leadership, Incident, Mentoring, dll).
  - Workspace balance (analisis perbandingan fokus `work` vs `learning`).
- [ ] ai: performance review & brag sheet synthesizer
  - Sintesis brag logs dalam rentang waktu tertentu menjadi dokumen evaluasi diri (self-appraisal) atau bullet points resume siap pakai.

### Idea & Project Incubation

- [ ] idea bank
  - Manajemen ide proyek teknis / eksplorasi arsitektur dengan status lifecycle (`Ideation` -> `POC/Spike` -> `Building` -> `Shipped` / `Shelved`).
  - Promosi dari Spark ke Idea (`promotedType: 'idea'`).
  - Integrasi ide yang selesai (`Shipped`) langsung menjadi STAR Brag Log.

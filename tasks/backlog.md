## feats

### Quick Wins & Improvements

- [ ] navigation: tambahkan menu "Notes" ke sidebar & mobile navigation (`src/client/app/layout.tsx`).

### Frictionless Capture

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

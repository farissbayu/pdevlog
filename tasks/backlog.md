### Anti-Overwhelm & Idea Execution (Overcoming Fear of Difficult Projects)

- [ ] skill shredder & toy-project deconstructor
  - Mengubah topik belajar abstrak ("ingin belajar X") menjadi **Toy Project minimalis** (seperti analogi Todo App pada fullstack) yang berfokus 100% pada pemahaman fundamental.
  - Generator otomatis:
    - **The "Todo App" Analog**: Merumuskan 1 proyek mainan berukuran mikro tanpa distraksi domain/boilerplate.
    - **Spike 0 (15-Min Scratch)**: Eksperimen terkecil pembukti koneksi/sintaks di terminal.
    - **Milestones 1–3**: 3 langkah implementasi bertahap dari hulu ke hilir.
    - **Ignore List**: Melarang over-engineering (styling CSS, auth, clustering).
    - **Deliberate Practice Challenge**: 1 tantangan modifikasi mandiri tanpa AI untuk menguji pemahaman sejati.
- [ ] idea bank: momentum & execution lifecycle
  - Status lifecycle anti-macet: `Spark` -> `30-Min Spike` -> `Walking Skeleton` -> `Building` -> `Shipped` / `Shelved`.
  - Alert "Stale Idea": Jika ide mengendap >14 hari di fase konsepsi, paksa dekonstruksi ulang menjadi slice yang 3x lebih kecil atau archive agar tidak membebani mental.
  - Promosi ide yang berhasil di-ship langsung menjadi STAR Brag Log.

### Anti-AI Dependency & Deliberate Practice (Skill Preservation & Upgrade)

- [ ] "explain it without ai" (feynman note section)
  - Bagian refleksi khusus di Note / Brag Log: _"Jelaskan arsitektur/logika ini dengan kata-katamu sendiri seolah menerangkannya ke junior"_.
  - Menjaga pemahaman fundamental agar tidak sekadar copy-paste code dari LLM.
- [ ] ai socratic sparring partner (bukan joki koding)
  - Mode AI di Notes/Logs yang berperan sebagai **Senior Staff Engineer**:
  - Alih-alih memberikan kode langsung, AI menantang pemikiranmu dengan pertanyaan Sokrates:
    - _"Kenapa kamu memilih arsitektur X daripada Y di sini?"_
    - _"Apa edge case dan potensi bottleneck dari skema D1 yang kamu rancang ini?"_
- [ ] crafting badge / effort distinction
  - Tag penanda keaslian solusi di Brag Log: `[Hard Win - Pure Logic]` vs `[AI-Assisted]`.
  - Memberi dopamin dan rasa bangga saat berhasil menyelesaikan algoritma/desain arsitektur dengan pemikiran sendiri.

### Autonomous Growth & Objective Self-Appraisal (Tanpa Tech Lead / Manager)

- [ ] ai senior dev mirror & monthly growth auditor
  - Menggantikan ketiadaan tech lead di kantor dengan audit berkala berbasis data nyata di pdevlog.
  - Review objektif bulanan:
    - _"Bulan ini kamu banyak berkutat di CRUD berulang. Coba tantang dirimu di level caching, queue, atau async worker."_
    - Identifikasi peningkatan kedalaman teknis (_depth_) vs sekadar rutinitas (_busywork_).
- [ ] skill radar & mastery milestones
  - Visualisasi perkembangan skill mandiri (Database Internals, Edge Runtimes, System Design, Security, Frontend Performance).
  - Milestones pembuktian (_Evidence-based_): Menghubungkan log/note spesifik sebagai bukti penguasaan materi (misal: "Zero-Downtime Migration Handled").
- [ ] activity heatmap & consistency tracker
  - Heatmap kontribusi (seperti GitHub heatmap) untuk merekam konsistensi belajar, riset notes, dan pengiriman kode mandiri.

### Developer Knowledge Base & Low-Friction Capture

- [ ] engineering templates (post-mortem/RCA, ADR, TIL)
  - Template bawaan di Note Editor: Incident RCA (Timeline, 5 Whys), Architecture Decision Record (ADR), dan Today I Learned (TIL).
- [ ] semantic search & "ask your devlog" (RAG)
  - Integrasi native Cloudflare Vectorize + Workers AI untuk mencari solusi teknis masa lalu berbasis makna konseptual.
- [ ] cli companion (`pdl` / `pdevlog-cli`) & quick spark capture
  - Quick dump pemikiran teknis atau snippet dari terminal tanpa memecah fokus kerja.
- [ ] full data backup & restore (portability)
  - 1-click export seluruh data menjadi berkas `.zip` (Markdown notes/brags, metadata JSON, dan lampiran R2) untuk rasa aman kedaulatan data sendiri.

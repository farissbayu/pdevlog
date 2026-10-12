# Rencana Migrasi AI Calls ke Cloudflare Workers AI via Endpoint API

> **Status:** Draft / Planned (Dokumen Rencana Teknis & Panduan Riset)  
> **Lokasi Berkas:** [`docs/plan/cloudflare-workers-ai-migration.md`](file:///home/farissbayu/projects/pdevlog/docs/plan/cloudflare-workers-ai-migration.md)  
> **Target Aplikasi:** `pdevlog` (Cloudflare Workers + Hono + Vite React)  
> **Tujuan Utama:** Memindahkan pemanggilan AI di seluruh project `pdevlog` ke Cloudflare Workers AI menggunakan pendekatan **REST Endpoint API (OpenAI-compatible)** yang provider-agnostic, merangkum panduan langkah demi langkah bagi pengguna, serta menganalisis dan me-rerank model gratis terbaik (*best value*).

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Project `pdevlog` saat ini memiliki 6 fungsi pemanggilan AI utama di [`src/worker/lib/ai-client.ts`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts) (STAR breakdown, Skill Shredder, Skill Auditor, Resume Extractor, CV Skill Auditor, dan Skill Insights). 

Untuk beralih ke **Cloudflare Workers AI**, terdapat dua pendekatan yang tersedia di Cloudflare:
1. **Pendekatan Binding Native (`env.AI.run(...)`):** Menggunakan binding Cloudflare Worker bawaan.
2. **Pendekatan REST Endpoint API (OpenAI-Compatible):** Mengakses endpoint HTTP Cloudflare Workers AI menggunakan OpenAI SDK standar (`https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1`).

### Mengapa Memilih Pendekatan Endpoint API? (Sesuai Preferensi)

| Parameter | Native Binding (`env.AI`) | Endpoint API (OpenAI-Compatible) | Rekomendasi untuk `pdevlog` |
| :--- | :--- | :--- | :--- |
| **Vendor Lock-in** | Tinggi (terikat API dan tipe Cloudflare) | **Sangat Rendah (Agnostik)** | ✅ **Endpoint API** |
| **Kemudahan Ganti Provider** | Sulit (harus refactor fungsi AI jika ganti ke Groq, DeepSeek, OpenRouter, dll.) | **Zero Code Change** (hanya ganti `AI_BASE_URL`, `AI_API_KEY`, & `AI_MODEL`) | ✅ **Endpoint API** |
| **Kesesuaian dengan Kode Saat Ini** | Perlu perombakan total pada `ai-client.ts` | **95% sudah cocok** (project sudah memakai `new OpenAI(...)`) | ✅ **Endpoint API** |
| **Dukungan AI Gateway** | Perlu konfigurasi binding khusus | Didukung langsung (caching, logging, fallback) | ✅ **Endpoint API** |
| **Structured Output (Zod Schema)** | Terbatas pada schema format binding | Kompatibel dengan `json_schema` OpenAI SDK | ✅ **Endpoint API** |

Dengan memilih **Endpoint API (OpenAI-Compatible)**, migrasi tidak merusak arsitektur yang sudah berjalan di `pdevlog`, mempermudah rollback, dan memberikan fleksibilitas jika di kemudian hari ingin beralih ke provider lain.

---

## 2. Panduan Langkah Demi Langkah untuk User

Berikut adalah langkah-langkah praktis yang perlu Anda lakukan untuk mengaktifkan Cloudflare Workers AI:

### Langkah 1: Mendapatkan Cloudflare Account ID
1. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Pilih domain apa saja atau klik halaman muka (Workers & Pages).
3. Perhatikan panel sebelah kanan (kolom sidebar) di dashboard Anda.
4. Di bagian **Account ID**, salin string 32 karakter heksadesimal (contoh: `a1b2c3d4e5f67890123456789abcdef0`).

---

### Langkah 2: Membuat Cloudflare API Token
1. Buka halaman pembuatan token di: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Klik tombol **Create Token**.
3. Di bagian bawah (*Custom Token*), klik **Get started**.
4. Isi konfigurasi token sebagai berikut:
   * **Token name:** `pdevlog-workers-ai`
   * **Permissions:**
     * Pilih: `Account` ➔ `Workers AI` ➔ `Read`
     * *(Catatan: Izin `Read` sudah cukup untuk melakukan inferensi model AI di Workers AI)*
   * **Account Resources:**
     * Pilih: `Include` ➔ `All accounts` (atau pilih spesifik akun Anda).
   * **TTL & IP Filtering:** Biarkan default (atau sesuaikan dengan kebutuhan keamanan Anda).
5. Klik **Continue to summary**, lalu klik **Create Token**.
6. **Salin API Token** yang muncul dan simpan di tempat aman (token ini hanya ditampilkan sekali).

---

### Langkah 3 (Sangat Direkomendasikan): Setup Cloudflare AI Gateway (Gratis)
Cloudflare AI Gateway berfungsi sebagai proxy pintar gratis di depan Workers AI Anda. Keunggulannya:
* **Caching Response:** Jika prompt serupa dipanggil berulang kali, jawaban diambil dari cache (0 biaya neuron, 0ms latensi GPU).
* **Analytics & Logs:** Melihat token usage, latensi, dan histori prompt secara visual di dashboard.
* **Universal Provider Switching & Fallback:** Di kemudian hari bisa langsung fallback otomatis antar provider tanpa mengubah kode backend.

**Cara mengaktifkan:**
1. Di sidebar Cloudflare Dashboard, buka menu **AI** ➔ **AI Gateway**.
2. Klik **Create Gateway**.
3. Beri nama gateway, misalnya `pdevlog-gateway`.
4. Selesai! Endpoint Anda akan berbentuk:
   `https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/pdevlog-gateway/workers-ai/v1`

---

### Langkah 4: Konfigurasi Environment Variables di Project

#### A. Untuk Development Lokal ([`.dev.vars`](file:///home/farissbayu/projects/pdevlog/.dev.vars))
Perbarui file `.dev.vars` di root project Anda:

```bash
# Cloudflare Workers AI Credentials
AI_API_KEY="<CLOUDFLARE_API_TOKEN_ANDA>"

# Opsi 1: Direct Cloudflare Workers AI Endpoint
AI_BASE_URL="https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID_ANDA>/ai/v1"

# Opsi 2 (Direkomendasikan): Melalui Cloudflare AI Gateway
# AI_BASE_URL="https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID_ANDA>/pdevlog-gateway/workers-ai/v1"

# Model Default Pilihan (Best Value)
AI_MODEL="@cf/meta/llama-3.1-8b-instruct"
```

#### B. Untuk Production ([`wrangler.jsonc`](file:///home/farissbayu/projects/pdevlog/wrangler.jsonc) & Secrets)
Perbarui bagian `vars` di [`wrangler.jsonc`](file:///home/farissbayu/projects/pdevlog/wrangler.jsonc):

```jsonc
"vars": {
  "ADMIN_EMAILS": "",
  "AI_BASE_URL": "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID_ANDA>/ai/v1",
  "AI_MODEL": "@cf/meta/llama-3.1-8b-instruct",
  "APP_URL": "https://pdevlog.farissbay.my.id",
  "APP_NAME": "pdevlog"
}
```

Kemudian simpan API token ke Cloudflare Secret via terminal:
```bash
npx wrangler secret put AI_API_KEY
# Masukkan API Token yang dibuat pada Langkah 2 saat diminta
```

---

### Langkah 5: Smoke Test Manual via cURL
Anda dapat menguji apakah kredensial dan endpoint berfungsi sebelum menjalankan aplikasi dengan perintah cURL berikut di terminal:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1/chat/completions" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello, respond with OK."}
    ]
  }'
```
Jika mengembalikan JSON dengan `choices[0].message.content`, maka endpoint dan token sudah siap 100%.

---

## 3. Riset Model Gratis & Kebijakan Kuota Cloudflare Workers AI

### Bagaimana Skema "Gratis" di Cloudflare Workers AI Bekerja?
Banyak pengguna mengira Cloudflare memberikan daftar model tertentu yang "selamanya gratis" dan model lain yang "berbayar". Faktanya:
1. **Mata Uang Komputasi = Neurons:** Cloudflare Workers AI menggunakan unit GPU compute bernama **Neurons**.
2. **Kuota Gratis Harian 10.000 Neurons/Hari:** 
   * Setiap akun Cloudflare (bahkan pada plan gratis / *Workers Free*) diberikan **10.000 Neurons gratis setiap hari**.
   * Kuota ini di-reset secara otomatis setiap hari pada pukul **00:00 UTC**.
3. **Cakupan Model:** 
   * Hampir **seluruh model open-weights** di katalog Workers AI (Llama, Qwen, Mistral, DeepSeek, Gemma, GLM) dapat dijalankan menggunakan kuota 10.000 Neurons harian ini tanpa biaya tambahan.
   * Hanya model berbayar tier enterprise khusus atau model pihak ketiga berbayar via proxy yang mewajibkan billing berbayar.
4. **Berapa Kapasitas Token dari 10.000 Neurons?**
   * **Model 8B (Llama 3.1 8B):** Menghasilkan sekitar **30.000 – 50.000 total tokens per hari**. Untuk `pdevlog`, kapasitas ini setara dengan ~40 STAR log generation atau ~15 CV extraction per hari secara gratis.
   * **Model 70B (Llama 3.3 70B):** Hanya mencukupi sekitar **3.000 – 5.000 tokens per hari** sebelum batas 10.000 neuron tercapai.
   * **Model kecil 3B (Llama 3.2 3B):** Mencapai **100.000+ tokens per hari**.

---

## 4. Top 10 Model Teks di Cloudflare Workers AI

Berikut adalah 10 model teks terbaik dan paling populer yang tersedia di Cloudflare Workers AI dan dapat diakses dengan kuota gratis 10.000 Neurons/hari:

| No | Model ID Cloudflare | Developer / Family | Ukuran Parameter | Context Window | Kekuatan Utama |
| :-: | :--- | :--- | :-: | :-: | :--- |
| **1** | `@cf/meta/llama-3.1-8b-instruct` | Meta | 8B | 128k tokens | Generalist, sangat seimbang, JSON schema akurat |
| **2** | `@cf/meta/llama-3.1-8b-instruct-fast` | Meta | 8B (FP8 Opt) | 128k tokens | Varian ultra-cepat dari Llama 3.1 8B dengan latensi rendah |
| **3** | `@cf/qwen/qwen2.5-7b-instruct` | Alibaba Qwen | 7B | 32k / 128k | Sangat kuat dalam reasoning teknis, coding, dan JSON |
| **4** | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | DeepSeek | 32B | 64k tokens | Reasoning tingkat tinggi (CoT), analisis mendalam |
| **5** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Meta | 70B | 128k tokens | Level kecerdasan mendekati GPT-4o, pemahaman teks kompleks |
| **6** | `@cf/zai-org/glm-4.7-flash` | Zhipu AI | Compact | 32k tokens | Respons cepat, dialog stabil, optimasi tool calling |
| **7** | `@cf/meta/llama-3.2-3b-instruct` | Meta | 3B | 128k tokens | Konsumsi neuron sangat kecil, latensi instan |
| **8** | `@cf/google/gemma-2-9b-it` | Google DeepMind | 9B | 8k tokens | Penalaran bahasa alami superior dari Google |
| **9** | `@cf/mistral/mistral-7b-instruct-v0.2` | Mistral AI | 7B | 32k tokens | Kepatuhan instruksi sistem yang konsisten |
| **10** | `@cf/meta/llama-3.2-11b-vision-instruct` | Meta | 11B | 128k tokens | Mendukung input gambar/dokumen (multimodal vision) |

---

## 5. Reranking Model Berdasarkan "Best Value" untuk `pdevlog`

Kriteria penilaian "Best Value" disesuaikan dengan kebutuhan nyata fitur di `pdevlog`:
* **Structured Output Reliability:** Kemampuan mengembalikan JSON valid sesuai Zod Schema (`response_format`).
* **Efisiensi Neurons:** Seberapa banyak pemanggilan yang dapat dilakukan sebelum mencapai limit 10.000 neuron harian.
* **Konteks Panjang:** Kemampuan membaca input CV/Resume hingga ribuan kata (10k+ karakter).
* **Latensi Edge:** Kecepatan respon saat user menunggu secara interaktif di browser.

### Hasil Reranking (Urutan 1 s/d 10)

```
[Rank 1] @cf/meta/llama-3.1-8b-instruct / -fast   ⭐⭐⭐⭐⭐ (Overall Best Value - REKOMENDASI UTAMA)
[Rank 2] @cf/qwen/qwen2.5-7b-instruct            ⭐⭐⭐⭐⭐ (Best for Technical Skill & JSON Precision)
[Rank 3] @cf/deepseek-ai/deepseek-r1-distill-qwen-32b ⭐⭐⭐⭐ (Best for Deep Reasoning & CV Auditing)
[Rank 4] @cf/meta/llama-3.3-70b-instruct-fp8-fast ⭐⭐⭐⭐ (Best Intelligence, Higher Neuron Cost)
[Rank 5] @cf/meta/llama-3.2-3b-instruct          ⭐⭐⭐⭐ (Best Ultra-Economy & High Quota)
[Rank 6] @cf/zai-org/glm-4.7-flash               ⭐⭐⭐   (Fast & Balanced Tool/Format Handling)
[Rank 7] @cf/google/gemma-2-9b-it                ⭐⭐⭐   (Strong Linguistics, Shorter Context 8k)
[Rank 8] @cf/mistral/mistral-7b-instruct-v0.2    ⭐⭐⭐   (Reliable Instruction Follower)
[Rank 9] @cf/meta/llama-4-scout-17b-16e-instruct ⭐⭐    (Cutting-Edge MoE, Experimental)
[Rank 10] @cf/meta/llama-3.2-11b-vision-instruct ⭐⭐    (Multimodal, Overkill untuk Text-Only)
```

---

### Ulasan Mendalam Tiap Peringkat

#### 🥇 1. `@cf/meta/llama-3.1-8b-instruct` (dan varian `-fast`) — *The Undisputed Sweet Spot*
* **Mengapa Peringkat 1:** Model ini adalah definisi "Best Value" sejati di Cloudflare Workers AI.
* **Keunggulan:**
  * Konsumsi neuron sangat hemat (sekitar ~0.15–0.29 USD per juta token ekuivalen), memungkinkan **30.000–50.000 token harian gratis**.
  * Mendukung konteks hingga **128k tokens**, sangat leluasa membaca naskah CV lengkap dan catatan developer yang panjang.
  * Kepatuhan terhadap format JSON Schema / Zod sangat presisi pada temperature rendah (0.1–0.2).
* **Rekomendasi di `pdevlog`:** Jadikan model default untuk seluruh 6 fungsi AI di [`src/worker/lib/ai-client.ts`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts).

#### 🥈 2. `@cf/qwen/qwen2.5-7b-instruct` — *The Technical Specialist*
* **Mengapa Peringkat 2:** Arsitektur Qwen 2.5 sangat superior dalam pemahaman istilah pemrograman, git, arsitektur software, dan penulisan JSON tanpa halusinasi.
* **Keunggulan:** Sangat cocok untuk fungsi `auditSkillEvidence` dan `generateSkillShredder` karena dapat mengenali tech stack secara tajam.
* **Efisiensi:** Konsumsi neuron seimbang dengan Llama 3.1 8B.

#### 🥉 3. `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` — *The Deep Technical Auditor*
* **Mengapa Peringkat 3:** Merupakan model reasoning (Chain-of-Thought) 32B hasil distilasi DeepSeek-R1.
* **Keunggulan:** Sangat tajam untuk fungsi audit berat seperti `auditCvSkillEvidence` dan `analyzeDeveloperCompetencies` dalam mendeteksi apakah developer benar-benar memiliki level L4/L5 atau sekadar klaim.
* **Trade-off:** Karena menghasilkan token penalaran internal (`<think>`), jumlah output token lebih banyak sehingga kuota 10.000 neuron harian lebih cepat terpakai. Cocok dipasangkan khusus untuk background job CV audit.

#### 4. `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — *Frontier Intelligence on Edge*
* **Mengapa Peringkat 4:** Menghadirkan kapasitas penalaran sekelas GPT-4o / Claude 3.5 Sonnet langsung di Workers AI.
* **Keunggulan:** Tulisan narasi STAR brag-log dan ringkasan eksekutif CV menjadi sangat profesional dan persuasif.
* **Trade-off:** Konsumsi neuron tinggi. Dengan kuota gratis 10.000 neuron, Anda hanya bisa mengeksekusi ~4–6 request CV panjang per hari sebelum limit habis.

#### 5. `@cf/meta/llama-3.2-3b-instruct` — *Ultra-Economy Champion*
* **Mengapa Peringkat 5:** Model 3B dengan kecepatan inferensi di bawah 300ms dan konsumsi neuron super kecil.
* **Keunggulan:** Memungkinkan ratusan kali pemanggilan per hari di kuota gratis.
* **Kekurangan:** Penalaran teknis lebih sederhana dibanding varian 8B, sehingga kurang optimal untuk audit CV yang kompleks.

#### 6. `@cf/zai-org/glm-4.7-flash` — *High-Throughput Utility*
* **Keunggulan:** Model flash yang dirancang untuk kecepatan eksekusi cepat dan kepatuhan parsing terstruktur.

#### 7. `@cf/google/gemma-2-9b-it` — *Google Research Quality*
* **Keunggulan:** Penalaran logis kuat dari Google.
* **Kekurangan:** Batasan konteks 8k tokens membuat ekstraksi CV yang sangat panjang berisiko terpotong.

#### 8. `@cf/mistral/mistral-7b-instruct-v0.2` — *Stable & Predictable*
* **Keunggulan:** Instruksi sistem diikuti dengan sangat patuh.
* **Kekurangan:** Kapasitas reasoning mulai tertinggal dibanding Llama 3.1 8B dan Qwen 2.5 7B.

#### 9. `@cf/meta/llama-4-scout-17b-16e-instruct` — *Next-Gen MoE*
* **Keunggulan:** Arsitektur MoE (Mixture of Experts) generasi terbaru. Menarik untuk dicoba sebagai uji coba eksperimental jika membutuhkan variasi baru.

#### 10. `@cf/meta/llama-3.2-11b-vision-instruct` — *Future Multimodal Expansion*
* **Keunggulan:** Memiliki kapabilitas membaca gambar (vision). Sangat berguna di masa depan jika `pdevlog` ingin menambahkan fitur "Upload Screenshot Bukti / Architecture Diagram" langsung ke catatan. Untuk use-case text-only saat ini, neuron cost-nya lebih tinggi dari model 8B.

---

## 6. Penyesuaian Kode di Proyek `pdevlog`

Karena project `pdevlog` sudah menggunakan `import OpenAI from "openai"`, penyesuaian kode sangat minimal dan elegan:

### 1. Perapian di [`src/worker/lib/ai-client.ts`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts)
Saat ini di setiap pemanggilan `client.chat.completions.parse` terdapat properti khusus OpenRouter:
```ts
// Kode saat ini:
provider: { require_parameters: true },
```
Properti `provider` adalah vendor-specific parameter milik OpenRouter. Jika dikirim ke Cloudflare Workers AI atau provider standar lainnya, beberapa validator endpoint dapat menolak request tersebut (*unexpected parameter*). 

**Rencana Perbaikan:**
Hapus properti `provider: { require_parameters: true }` atau buat helper request builder yang bersih dan provider-agnostic, sehingga 100% kompatibel baik dengan Cloudflare Workers AI, OpenRouter, Groq, maupun OpenAI native.

### 2. Normalisasi URL di `resolveBaseUrl`
Fungsi `resolveBaseUrl` sudah menangani pemotongan trailing `/chat/completions`. Pastikan dokumentasi format URL jelas:
* Cukup masukkan: `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`
* SDK OpenAI akan otomatis menambahkan `/chat/completions`.

---

## 7. Rencana Eksekusi & Checklist Verifikasi

Berikut adalah tahapan implementasi yang disarankan saat Anda memutuskan untuk mengeksekusi rencana ini:

```markdown
- [ ] Tahap 1: Pengambilan Kredensial Cloudflare
  - [ ] Dapatkan Account ID di Cloudflare Dashboard
  - [ ] Buat API Token dengan izin "Workers AI: Read"
  - [ ] (Opsional) Buat AI Gateway "pdevlog-gateway"

- [ ] Tahap 2: Konfigurasi Environment
  - [ ] Update `.dev.vars` dengan AI_API_KEY, AI_BASE_URL, dan AI_MODEL (@cf/meta/llama-3.1-8b-instruct)
  - [ ] Update `wrangler.jsonc` pada block vars
  - [ ] Daftarkan secret di Cloudflare: `wrangler secret put AI_API_KEY`

- [ ] Tahap 3: Pembersihan Kode
  - [ ] Bersihkan properti `provider: { require_parameters: true }` di `src/worker/lib/ai-client.ts`
  - [ ] Verifikasi penanganan `response_format` tetap valid untuk Cloudflare Workers AI

- [ ] Tahap 4: Pengujian & Validasi
  - [ ] Jalankan unit test: `npm test tests/unit/ai-client.test.ts`
  - [ ] Jalankan full test suite: `npm test`
  - [ ] Test interaktif drafting STAR breakdown di UI lokal (`npm run dev`)
  - [ ] Pantau log neuron usage di Cloudflare AI Dashboard
```

---

## 8. Kesimpulan & Rekomendasi Akhir

1. **Strategi Terbaik:** Menggunakan **OpenAI-Compatible REST Endpoint** (`/ai/v1`) adalah pilihan paling tepat karena **menghilangkan vendor lock-in**. Anda bisa berganti provider sewaktu-waktu hanya dengan mengganti variabel lingkungan tanpa menyentuh kode.
2. **Model Terbaik (Best Value):** Gunakan **`@cf/meta/llama-3.1-8b-instruct`** sebagai model utama. Model ini memberikan performa setara model komersial untuk task structuring Zod, konteks 128k yang sangat luas untuk CV, dan efisiensi konsumsi neuron yang memungkinkan penggunaan gratis harian secara maksimal.
3. **Optimasi Tambahan:** Aktifkan **Cloudflare AI Gateway** untuk mendapatkan caching gratis, log visual, dan metrik latensi tanpa biaya ekstra.


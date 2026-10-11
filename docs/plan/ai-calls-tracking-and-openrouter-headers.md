# Technical Plan: AI Calls Tracking & OpenRouter Headers Integration

> **Status:** Draft / Planned (Dokumen Rencana - Belum Diimplementasikan)  
> **Target Version:** `pdevlog` v0.4+  
> **Audience:** Fullstack & Platform Engineer  
> **Core Objective:** Menginventarisasi dan melacak seluruh fungsi pemanggilan AI di seluruh sistem `pdevlog`, serta merancang integrasi header standar gateway AI (`HTTP-Referer` dan `X-Title`) yang nilainya bersumber secara dinamis dari `.dev.vars` (lokal) dan Cloudflare Worker Bindings (production).

---

## 1. Problem Statement & Latar Belakang

1. **Kebutuhan Identitas Provider (OpenRouter & Gateway Standar):**  
   Saat menggunakan provider AI seperti OpenRouter, request yang dikirim dari backend serverless (Cloudflare Workers) sangat direkomendasikan menyertakan dua header identitas:
   * `HTTP-Referer`: URL publik aplikasi (misal `https://pdevlog.pages.dev` atau `http://localhost:5173` saat dev).
   * `X-Title`: Nama pengenal aplikasi (misal `pdevlog`).  
   Tanpa kedua header ini, gateway AI tidak dapat mengidentifikasi asal aplikasi, mempersulit pemantauan log konsumsi token, dan pada beberapa model gratis (*free tier*), request dapat ditolak (*refused*) atau terkena batasan ketat (*rate limit*).

2. **Duplikasi Instansiasi OpenAI Client:**  
   Saat ini, instansiasi `new OpenAI(...)` dilakukan secara terpisah di **6 fungsi berbeda** di dalam file [`src/worker/lib/ai-client.ts`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts). Jika konfigurasi header ditambahkan manual satu per satu, akan terjadi duplikasi kode (*boilerplate drift*) dan inkonsistensi penanganan environment variable.

3. **Solusi Dinamis dari Lingkungan:**  
   Nilai header tidak boleh di-*hardcode*, melainkan harus ditarik dari variabel lingkungan:
   * **Lokal (`.dev.vars`):** Diisi alamat lokal dan nama dev (misal `http://localhost:5173`).
   * **Production (`wrangler.jsonc` / Cloudflare Secrets):** Diisi domain produksi resmi (misal `https://pdevlog.pages.dev`).

---

## 2. Matriks & Audit Lengkap Seluruh AI Call

Berikut adalah hasil audit pemanggilan AI di seluruh sistem `pdevlog`:

| No | Nama Fungsi AI | File Sumber | Dipanggil Oleh (Caller) | HTTP Endpoint | Mode Eksekusi | Model Default | Structured Output (Zod Schema) |
| :-: | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **1** | `generateStarBreakdown` | `src/worker/lib/ai-client.ts` | `bragLogsRoute` | `POST /api/brag-logs/star-breakdown` | Sinkron (Blocking) | `deepseek-v4.1-flash` | `starBreakdownSchema` |
| **2** | `generateSkillShredder` | `src/worker/lib/ai-client.ts` | `runShredGeneration` (`skillShredderRoute`) | `POST /api/skill-shredder` & `POST /api/skill-shredder/:id/retry` | Asinkron (`waitUntil`) | `deepseek-v4.1-flash` | `skillShredderResultSchema` |
| **3** | `auditSkillEvidence` | `src/worker/lib/ai-client.ts` | `auditAndLinkEvidence` (`skills/service.ts`) | Background saat add note / brag-log & `syncAllUserGrowth` | Asinkron / Sinkron per service | `deepseek-v4.1-flash` | `automatedSkillAuditSchema` |
| **4** | `extractAndFormatResume` | `src/worker/lib/ai-client.ts` | `extractAndSaveCv` & `extractPersonaFromCv` (`profile/service.ts`) | `POST /api/profile/cv/upload` & `POST /api/profile/persona/extract` | Asinkron (`waitUntil`) / Sinkron | `deepseek-v4.1-flash` | `resumeExtractionSchema` |
| **5** | `auditCvSkillEvidence` | `src/worker/lib/ai-client.ts` | `syncCvGrowth` (`skills/service.ts`) | `POST /api/profile/cv/sync-skills` | Asinkron (`waitUntil`) | `deepseek-v4.1-flash` | `cvSkillAuditResultSchema` |
| **6** | `analyzeDeveloperCompetencies` | `src/worker/lib/ai-client.ts` | `analyzeAndSaveSkillInsights` (`profile/service.ts`) | `POST /api/profile/skills/analyze` | Asinkron (`waitUntil`) | `deepseek-v4.1-flash` | `skillInsightsSchema` |

---

## 3. Detail Pelacakan Tiap Fungsi AI

### 3.1 `generateStarBreakdown`
* **Lokasi:** [`src/worker/lib/ai-client.ts:134`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L134)
* **Tujuan:** Mengubah catatan mentah pencapaian teknis developer menjadi format STAR (*Situation, Task, Action, Result*) dan memilih tag relevan secara terstruktur.
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });
  ```
* **Karakteristik:** Sinkron (interactive drafting di UI). Timeout: 30 detik.

### 3.2 `generateSkillShredder`
* **Lokasi:** [`src/worker/lib/ai-client.ts:218`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L218)
* **Tujuan:** Membuat rancangan kurikulum *Toy Project* (Spike 0, Milestones, Ignore List, Anti-AI Challenge) dari sebuah topik/catatan.
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });
  ```
* **Karakteristik:** Background job (`c.executionCtx.waitUntil`). Timeout: 60 detik.

### 3.3 `auditSkillEvidence`
* **Lokasi:** [`src/worker/lib/ai-client.ts:325`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L325)
* **Tujuan:** Menganalisis catatan/brag-log terhadap 5 pilar Product Engineering (ui-craft, fullstack-data, product-sense, product-telemetry, velocity-ai) untuk mengaitkan milestone kompetensi secara otomatis.
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });
  ```
* **Karakteristik:** Sinkron per evaluasi item. Timeout: 30 detik.

### 3.4 `extractAndFormatResume`
* **Lokasi:** [`src/worker/lib/ai-client.ts:428`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L428)
* **Tujuan:** Mengekstrak teks CV/Resume (dari PDF atau teks mentah) menjadi Markdown terstruktur, headline, bio, dan daftar primary stack.
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });
  ```
* **Karakteristik:** Background job saat upload CV atau sinkron saat persona extract. Timeout: 90 detik.

### 3.5 `auditCvSkillEvidence`
* **Lokasi:** [`src/worker/lib/ai-client.ts:512`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L512)
* **Tujuan:** Mengaudit seluruh isi CV/Resume terhadap 25 milestone standar kompetensi engineering (L1-L5 pada 5 pilar).
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });
  ```
* **Karakteristik:** Background job (`c.executionCtx.waitUntil`). Timeout: 90 detik.

### 3.6 `analyzeDeveloperCompetencies`
* **Lokasi:** [`src/worker/lib/ai-client.ts:608`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts#L608)
* **Tujuan:** Memberikan analisis kualitatif terhadap profil engineer (archetype signature, strengths, growth areas, rekomendasi langkah berikutnya).
* **Instansiasi Client Saat Ini:**
  ```ts
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });
  ```
* **Karakteristik:** Background job (`c.executionCtx.waitUntil`). Timeout: 90 detik.

---

## 4. Desain Konfigurasi Environment Variable

Dua variabel lingkungan baru akan diperkenalkan:
* **`APP_URL`**: URL aplikasi untuk mengisi header `HTTP-Referer`.
* **`APP_NAME`**: Nama aplikasi untuk mengisi header `X-Title`.

### 4.1 Pemetaan Lokal (`.dev.vars`)
Tambahkan ke file [`.dev.vars`](file:///home/farissbayu/projects/pdevlog/.dev.vars):
```env
# Existing variables:
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
JWT_SECRET="..."
AI_API_KEY="..."
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_MODEL="deepseek-v4.1-flash"
ADMIN_EMAILS="farissbay.dev@gmail.com"

# New OpenRouter / Gateway metadata variables:
APP_URL="http://localhost:5173"
APP_NAME="pdevlog (local)"
```

### 4.2 Pemetaan Produksi (`wrangler.jsonc`)
Tambahkan ke bagian `vars` di [`wrangler.jsonc`](file:///home/farissbayu/projects/pdevlog/wrangler.jsonc):
```jsonc
  "vars": {
    "ADMIN_EMAILS": "",
    "AI_BASE_URL": "https://openrouter.ai/api/v1",
    "AI_MODEL": "deepseek-v4.1-flash",
    "APP_URL": "https://pdevlog.pages.dev",
    "APP_NAME": "pdevlog"
  },
```

### 4.3 Pembaruan Type Definition (`worker-configuration.d.ts` & `src/worker/env.ts`)
Tambahkan `APP_URL` dan `APP_NAME` ke dalam interface bindings:
```ts
interface __BaseEnv_Env {
  STORAGE: R2Bucket;
  pdevlog_storage: R2Bucket;
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  AI_API_KEY: string;
  AI_BASE_URL: string;
  AI_MODEL: string;
  ADMIN_EMAILS: string;
  APP_URL?: string;
  APP_NAME?: string;
}
```

---

## 5. Rencana Arsitektur: Centralized AI Client Factory

Alih-alih menyalin `defaultHeaders` ke 6 tempat berbeda, buat sebuah fungsi factory terpusat di [`src/worker/lib/ai-client.ts`](file:///home/farissbayu/projects/pdevlog/src/worker/lib/ai-client.ts):

### 5.1 Desain Fungsi Factory (`getAiClient`)

```ts
type CreateAiClientOptions = {
  maxRetries?: number;
};

function getAiClient(
  env: AppEnv["Bindings"],
  options: CreateAiClientOptions = {},
): OpenAI {
  const referer = env.APP_URL || "https://pdevlog.pages.dev";
  const appTitle = env.APP_NAME || "pdevlog";

  return new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: options.maxRetries ?? 2,
    defaultHeaders: {
      "HTTP-Referer": referer,
      "X-Title": appTitle,
    },
  });
}
```

### 5.2 Rencana Refactoring pada ke-6 Fungsi
Seluruh 6 fungsi AI akan diganti instansiasinya menjadi:

1. `generateStarBreakdown`:
   ```ts
   const client = getAiClient(env);
   ```
2. `generateSkillShredder`:
   ```ts
   const client = getAiClient(env);
   ```
3. `auditSkillEvidence`:
   ```ts
   const client = getAiClient(env);
   ```
4. `extractAndFormatResume`:
   ```ts
   const client = getAiClient(env, { maxRetries: 0 });
   ```
5. `auditCvSkillEvidence`:
   ```ts
   const client = getAiClient(env, { maxRetries: 0 });
   ```
6. `analyzeDeveloperCompetencies`:
   ```ts
   const client = getAiClient(env, { maxRetries: 0 });
   ```

---

## 6. Rencana Pengujian (Test & Verification Strategy)

Ketika rencana ini diimplementasikan di kemudian hari, pengujian wajib memvalidasi hal-hal berikut:

1. **Unit Test Header Verification ([`tests/unit/skill-shredder-ai.test.ts`](file:///home/farissbayu/projects/pdevlog/tests/unit/skill-shredder-ai.test.ts)):**
   * Menginspeksi objek `fetchMock.mock.calls[0][1].headers` untuk memastikan `HTTP-Referer` dan `X-Title` terkirim dengan nilai yang sesuai dari `env`.
2. **Fallback Verification:**
   * Jika `env.APP_URL` atau `env.APP_NAME` kosong/undefined, pastikan sistem tetap menggunakan fallback default yang aman (`https://pdevlog.pages.dev` dan `pdevlog`) tanpa melempar runtime exception.
3. **Integration Test ([`tests/isolation/profile.test.ts`](file:///home/farissbayu/projects/pdevlog/tests/isolation/profile.test.ts)):**
   * Menjalankan `npm run test` untuk memastikan seluruh 150 test suite tetap berstatus *PASS*.

---

## 7. Status Eksekusi

> [!IMPORTANT]
> **Catatan Implementasi:** Sesuai instruksi, dokumen ini disusun sebagai **spesifikasi teknis dan panduan pelacakan (planning document)**. Perubahan kode sumber pada `src/worker/lib/ai-client.ts`, `.dev.vars`, dan `wrangler.jsonc` **belum diterapkan** dan akan dieksekusi pada iterasi berikutnya setelah disetujui.


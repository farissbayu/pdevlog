import { z } from "zod";

export const skillShredderInputSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, "Masukkan topik atau teknologi yang ingin kamu pelajari")
    .max(200, "Topik maksimal 200 karakter"),
  currentContext: z
    .string()
    .trim()
    .max(500, "Konteks latar belakang maksimal 500 karakter")
    .optional(),
  targetTimeMinutes: z.number().int().min(15).max(240).default(60),
});

export const fundamentalPillarSchema = z.object({
  name: z
    .string()
    .describe("Nama konsep fundamental inti, misal: 'Connection Handshake'"),
  explanation: z
    .string()
    .describe(
      "Penjelasan sederhana 1-2 kalimat mengapa konsep ini adalah jantung dari topik ini.",
    ),
});

export const spike0Schema = z.object({
  title: z.string().describe("Judul eksperimen 15 menit"),
  objective: z
    .string()
    .describe("Tujuan spesifik membuktikan sintaks/koneksi hidup."),
  scratchSnippet: z
    .string()
    .describe(
      "Kode scratch minimalis 10-20 baris untuk dijalankan langsung di terminal/scratch file.",
    ),
  successCriteria: z
    .string()
    .describe("Kriteria sukses terlihat di console/output."),
  estimatedMinutes: z.number().int().default(15),
});

export const milestoneStepSchema = z.object({
  stepNumber: z.number().int(),
  title: z.string().describe("Judul langkah implementasi"),
  actionDescription: z.string().describe("Apa yang harus dibuat atau diketik"),
  verificationGuide: z
    .string()
    .describe("Cara memverifikasi langkah ini berhasil"),
  estimatedMinutes: z.number().int(),
});

export const practiceChallengeSchema = z.object({
  challenge: z
    .string()
    .describe(
      "Tantangan modifikasi logika tanpa bantuan AI untuk menguji pemahaman sejati.",
    ),
  hint: z.string().describe("Petunjuk konseptual tanpa membocorkan kode."),
});

export const skillShredderResultSchema = z.object({
  topicTitle: z.string().describe("Judul topik belajar yang diformulasikan rapi"),
  toyProjectTitle: z
    .string()
    .describe("Nama toy project minimalis (analog Todo App)"),
  toyProjectPitch: z
    .string()
    .describe(
      "Mengapa proyek ini mengajarkan 100% fundamental topik ini tanpa distraksi.",
    ),
  fundamentalPillars: z.array(fundamentalPillarSchema).min(2).max(4),
  spike0: spike0Schema,
  milestones: z.array(milestoneStepSchema).min(2).max(4),
  ignoreList: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Hal-hal yang DILARANG dibuat/dipikirkan hari ini."),
  practiceChallenge: practiceChallengeSchema,
});

export const skillShredStatusSchema = z.enum([
  "generating",
  "draft",
  "spike_done",
  "building",
  "completed",
  "failed",
  "archived",
]);

export const createSkillShredSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  currentContext: z.string().trim().max(500).optional(),
  targetTimeMinutes: z.number().int().min(15).max(240).default(60),
  noteId: z.string().min(1).optional(),
});

export const listSkillShredsQuerySchema = z.object({
  note_id: z.string().optional(),
});

export const exportSkillNoteQuerySchema = z.object({
  mode: z.enum(["new", "append"]).default("new"),
});

export function noteToShredContext(content: string, max = 500): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[>\-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() : plain;
}

export const updateSkillProgressSchema = z.object({
  completedSteps: z.array(z.string().min(1)).max(100).optional(),
  status: skillShredStatusSchema.optional(),
});

export const skillShredResponseSchema = z.object({
  id: z.string(),
  topic: z.string(),
  currentContext: z.string().nullable(),
  targetTimeMinutes: z.number().int(),
  toyProjectTitle: z.string().nullable(),
  blueprint: skillShredderResultSchema.nullable(),
  status: skillShredStatusSchema,
  errorMessage: z.string().nullable().optional(),
  completedSteps: z.array(z.string()),
  spikeCompletedAt: z.string().nullable(),
  challengeCompletedAt: z.string().nullable(),
  noteId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillShredListResponseSchema = z.object({
  shreds: z.array(skillShredResponseSchema),
});

export const skillShredDetailResponseSchema = z.object({
  shred: skillShredResponseSchema,
});

export const skillShredNoteResponseSchema = z.object({
  noteId: z.string(),
  shred: skillShredResponseSchema,
});

export type SkillShredderInput = z.infer<typeof skillShredderInputSchema>;
export type FundamentalPillar = z.infer<typeof fundamentalPillarSchema>;
export type Spike0 = z.infer<typeof spike0Schema>;
export type MilestoneStep = z.infer<typeof milestoneStepSchema>;
export type PracticeChallenge = z.infer<typeof practiceChallengeSchema>;
export type SkillShredderResult = z.infer<typeof skillShredderResultSchema>;
export type SkillShredStatus = z.infer<typeof skillShredStatusSchema>;
export type CreateSkillShredInput = z.infer<typeof createSkillShredSchema>;
export type ListSkillShredsQuery = z.infer<typeof listSkillShredsQuerySchema>;
export type ExportSkillNoteQuery = z.infer<typeof exportSkillNoteQuerySchema>;
export type UpdateSkillProgressInput = z.infer<
  typeof updateSkillProgressSchema
>;
export type SkillShredResponse = z.infer<typeof skillShredResponseSchema>;
export type SkillShredListResponse = z.infer<
  typeof skillShredListResponseSchema
>;
export type SkillShredDetailResponse = z.infer<
  typeof skillShredDetailResponseSchema
>;
export type SkillShredNoteResponse = z.infer<
  typeof skillShredNoteResponseSchema
>;

export const SPIKE_STEP_KEY = "spike";
export const CHALLENGE_STEP_KEY = "challenge";

export function milestoneStepKey(stepNumber: number): string {
  return `step-${stepNumber}`;
}

export function deriveSkillShredStatus(
  completedSteps: string[],
  blueprint: SkillShredderResult,
): SkillShredStatus {
  const done = new Set(completedSteps);
  const milestoneKeys = blueprint.milestones.map((step) =>
    milestoneStepKey(step.stepNumber),
  );
  const allMilestones =
    milestoneKeys.length > 0 && milestoneKeys.every((key) => done.has(key));
  const anyMilestone = milestoneKeys.some((key) => done.has(key));

  if (allMilestones) {
    return "completed";
  }
  if (anyMilestone) {
    return "building";
  }
  if (done.has(SPIKE_STEP_KEY)) {
    return "spike_done";
  }
  return "draft";
}

export function buildTilNoteContent(blueprint: SkillShredderResult): string {
  const pillars = blueprint.fundamentalPillars
    .map((pillar) => `- **${pillar.name}**: ${pillar.explanation}`)
    .join("\n");

  const milestones = blueprint.milestones
    .map(
      (step) =>
        `### ${step.stepNumber}. ${step.title} (~${step.estimatedMinutes} min)\n${step.actionDescription}\n\n_Verify: ${step.verificationGuide}_`,
    )
    .join("\n\n");

  const ignoreList = blueprint.ignoreList.map((item) => `- ${item}`).join("\n");

  return [
    `# TIL: ${blueprint.topicTitle}`,
    "",
    `## Toy Project: ${blueprint.toyProjectTitle}`,
    blueprint.toyProjectPitch,
    "",
    "## Fundamental Pillars",
    pillars,
    "",
    `## Spike 0: ${blueprint.spike0.title} (~${blueprint.spike0.estimatedMinutes} min)`,
    blueprint.spike0.objective,
    "",
    "```",
    blueprint.spike0.scratchSnippet,
    "```",
    "",
    `Success: ${blueprint.spike0.successCriteria}`,
    "",
    "## Milestones",
    milestones,
    "",
    "## Ignore List (forbidden today)",
    ignoreList,
    "",
    "## Deliberate Practice Challenge (no AI)",
    blueprint.practiceChallenge.challenge,
    "",
    `_Hint: ${blueprint.practiceChallenge.hint}_`,
  ].join("\n");
}

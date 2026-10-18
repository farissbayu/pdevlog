import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
  starBreakdownSchema,
  type StarBreakdown,
} from "@/shared/schemas/brag-log";
import {
  resumeExtractionSchema,
  skillStrengthItemSchema,
  type ResumeExtraction,
  type SkillInsights,
} from "@/shared/schemas/profile";

import type { AppEnv } from "@/worker/env";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;
// 60s to allow slow reasoning generations; the job runs in waitUntil(), which
// Workers may cancel ~30s after the response, so the status self-heals via
// STALE_JOB_MS in the profile route if the isolate is killed first.
const CV_REQUEST_TIMEOUT_MS = 60_000;
// OpenRouter reasoning budget; null skips the param (needed for non-reasoning
// models like gpt-4o-mini). Set to "low"/"none" when AI_MODEL is a reasoning model.
const REASONING_EFFORT: string | null = null;

const SYSTEM_PROMPT = [
  "You help software professionals turn rough notes about their work into a",
  "concise STAR (Situation, Task, Action, Result) brag-log entry.",
  "Rewrite the notes from a first-person perspective, staying strictly faithful",
  "to the facts provided. Do not invent metrics, tools, or outcomes.",
  "Keep each section focused and free of markdown.",
  "Respond with a single JSON object whose top-level keys are exactly",
  "title, situation, task, action, result and tag_ids. Do not nest the",
  "STAR fields or add any other keys.",
  "When a list of available tags is provided, choose only the tags that",
  "genuinely apply to the entry; never invent tags.",
].join(" ");

const REFINE_SYSTEM_PROMPT = [
  "You help software professionals refine and polish an existing",
  "STAR (Situation, Task, Action, Result) brag-log entry.",
  "Sharpen the headline and rewrite each section in clear, concise, active",
  "first-person prose that highlights technical depth and impact while staying",
  "strictly faithful to the facts provided. Do not invent metrics, tools, or outcomes.",
  "Keep each section focused and free of markdown.",
  "Respond with a single JSON object whose top-level keys are exactly",
  "title, situation, task, action, result and tag_ids. Do not nest the",
  "STAR fields or add any other keys.",
  "When a list of available tags is provided, choose only the tags that",
  "genuinely apply to the entry; never invent tags.",
].join(" ");

const RESUME_EXTRACTOR_SYSTEM_PROMPT = [
  "You are an expert technical resume architect and product engineering coach.",
  "You receive raw, noisy, or unformatted text extracted from a software engineer's resume or CV.",
  "Your task is to structure it into clean, high-signal GitHub Flavored Markdown and extract structured metadata.",
  "1. headline: A concise, impactful professional title (e.g. 'Senior Product Engineer', 'Fullstack Engineer & Tech Lead').",
  "2. bio: A crisp 2-3 sentence executive summary highlighting core engineering strength, domains, and accomplishments.",
  "3. primaryStack: An array of 6 to 12 primary technologies, frameworks, and engineering tools prominent in their career.",
  "4. markdown: A comprehensive, cleanly formatted Markdown document containing standard sections: Summary, Technical Skills, Professional Experience (with company, role, dates, and metric-driven STAR impact bullet points), Projects, and Education/Certifications.",
  "Preserve all specific technologies, numbers, user counts, performance percentages, and achievements faithful to the source.",
].join(" ");

// Stage 1: separate CV claims from capabilities proven by shipped work.
const REALITY_EXTRACTION_SYSTEM_PROMPT = [
  "You are an Elite Staff Engineer extracting an evidence-based reality profile of a software engineer.",
  "You receive their CV/resume plus recent devlog entries (brag logs and notes).",
  "Distinguish what is proven by shipped work from passive CV keywords.",
  "Respond with a single JSON object matching the requested schema:",
  "- archetype: A concise 2-4 word professional signature (e.g. 'Product-Centric Fullstack Engineer').",
  "- summary: A crisp 2-3 sentence narrative of their engineering identity and trajectory.",
  "- strengths: 3 to 5 objects with area, description (1-2 sentences), and evidenceSummary (specific reference from the material).",
  "- productionStack: technologies clearly demonstrated in their work.",
  "- observedPatterns: recurring architecture or workflow patterns you actually see.",
  "- recommendedNextSteps: 2 to 3 practical next milestones to log in their dev log.",
  "Base every claim strictly on the provided facts.",
].join(" ");

// Stage 2: act as a principal auditor hunting for what is absent.
const BLIND_SPOT_AUDIT_SYSTEM_PROMPT = [
  "You are a Principal Systems Engineer acting as a constructive devil's advocate.",
  "Given an engineer's demonstrated reality profile, identify the architectural and reliability blind spots absent from their work.",
  "Audit across distributed systems and reliability, data consistency and scaling, and observability and operational hardening.",
  "Respond with a single JSON object matching the requested schema:",
  "- criticalGaps: 2 to 4 objects with area (a short title), gap (what is missing or limited), and whyItMattersForSoloDev (the concrete risk this creates for a solo developer).",
  "Be specific and non-generic; avoid buzzword advice.",
].join(" ");

const DAILY_LEARNING_SYSTEM_PROMPT = [
  "You are an Elite Staff Engineer and Technical Mentor guiding a software engineer.",
  "You are given a chronological feed of the engineer's actual work over the LAST 7 DAYS",
  "(their project backlog items, brag logs, and notes).",
  "Recommend ONE hyper-relevant, concrete technical topic for them to learn today.",
  "Rules:",
  "1. The topic MUST directly build upon, harden, or optimize what they built or documented recently.",
  "2. Do NOT recommend generic beginner roadmaps. Propose a specific architectural pattern,",
  "performance nuance, edge-case hardening, or internal mechanism relevant to their recent work.",
  "3. Explain the connection explicitly: 'Because you built [X] in [Project Y], the next natural concept to master is [Z]'.",
  "4. Provide a concrete practical next step: a 1-2h spike, benchmark, or prototype.",
  "5. Write the suggested outline as a short Markdown note template with 3-4 guiding questions.",
  "6. In usedSourceTitles, copy verbatim (1 to 3) the exact titles of the notes, brag logs, or project items",
  "   from the feed that inspired this suggestion. Use the real titles from the feed, never invented ones.",
  "Respond with a single JSON object matching the requested schema.",
].join(" ");

const dailyLearningSuggestionSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  reason: z.string().min(1),
  practicalNextStep: z.string().min(1),
  suggestedOutline: z.string().min(1),
  suggestedTags: z.array(z.string().min(1)),
  usedSourceTitles: z.array(z.string().min(1)),
  sourceContextSummary: z.string().min(1),
});

const realityExtractionSchema = z.object({
  archetype: z.string().min(1),
  summary: z.string().min(1),
  strengths: z.array(skillStrengthItemSchema),
  productionStack: z.array(z.string()),
  observedPatterns: z.array(z.string()),
  recommendedNextSteps: z.array(z.string()),
});
type RealityExtraction = z.infer<typeof realityExtractionSchema>;

const blindSpotAuditSchema = z.object({
  criticalGaps: z.array(
    z.object({
      area: z.string().min(1),
      gap: z.string().min(1),
      whyItMattersForSoloDev: z.string().min(1),
    }),
  ),
});
type BlindSpotAudit = z.infer<typeof blindSpotAuditSchema>;

type TagOption = {
  id: string;
  name: string;
};

export type RefineStarBreakdownInput = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
};

export class StarBreakdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StarBreakdownError";
  }
}

export type StarBreakdownUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type StarBreakdownResult = {
  breakdown: StarBreakdown;
  usage: StarBreakdownUsage;
};

export class ResumeExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeExtractionError";
  }
}

export type ResumeExtractionResult = {
  data: ResumeExtraction;
  usage: StarBreakdownUsage;
};

export class SkillInsightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillInsightsError";
  }
}

export type SkillInsightsUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type SkillInsightsResult = {
  insights: SkillInsights;
  usage: SkillInsightsUsage;
};

function buildTagSchema(tagIds: string[]) {
  if (tagIds.length === 0) {
    return z.array(z.string()).max(0);
  }
  return z.array(z.enum(tagIds as [string, ...string[]]));
}

function resolveBaseUrl(baseUrl: string | undefined): string {
  const value = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  return value.endsWith("/chat/completions")
    ? value.slice(0, -"/chat/completions".length)
    : value;
}

const DEFAULT_APP_URL = "https://pdevlog.pages.dev";
const DEFAULT_APP_NAME = "pdevlog";

type CreateAiClientOptions = {
  maxRetries?: number;
};

function getAiClient(
  env: AppEnv["Bindings"],
  options: CreateAiClientOptions = {},
): OpenAI {
  return new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: options.maxRetries ?? 2,
    defaultHeaders: {
      "HTTP-Referer": env.APP_URL || DEFAULT_APP_URL,
      "X-Title": env.APP_NAME || DEFAULT_APP_NAME,
    },
  });
}

function buildUserPrompt(content: string, tagOptions: TagOption[]): string {
  if (tagOptions.length === 0) {
    return content;
  }

  const tagList = tagOptions
    .map((tag) => `- id: ${tag.id}, name: ${tag.name}`)
    .join("\n");

  return `Available tags:\n${tagList}\n\nNotes:\n${content}`;
}

function buildRefineUserPrompt(
  entry: RefineStarBreakdownInput,
  tagOptions: TagOption[],
): string {
  const starContent = [
    `Title: ${entry.title}`,
    `Situation: ${entry.situation}`,
    `Task: ${entry.task}`,
    `Action: ${entry.action}`,
    `Result: ${entry.result}`,
  ].join("\n\n");

  if (tagOptions.length === 0) {
    return starContent;
  }

  const tagList = tagOptions
    .map((tag) => `- id: ${tag.id}, name: ${tag.name}`)
    .join("\n");

  return `Available tags:\n${tagList}\n\nCurrent Brag Log:\n${starContent}`;
}

type StructuredCompletionParams<T> = {
  env: AppEnv["Bindings"];
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  temperature: number;
  timeoutMs: number;
  maxRetries?: number;
  makeError: (message: string) => Error;
  refusalLabel: string;
};

async function runStructuredCompletion<T>({
  env,
  schema,
  schemaName,
  system,
  user,
  temperature,
  timeoutMs,
  maxRetries,
  makeError,
  refusalLabel,
}: StructuredCompletionParams<T>): Promise<{ data: T; usage: StarBreakdownUsage }> {
  const client = getAiClient(env, { maxRetries });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature,
    ...(REASONING_EFFORT ? { reasoning: { effort: REASONING_EFFORT } } : {}),
    response_format: zodResponseFormat(schema, schemaName),
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
    provider: { require_parameters: true },
  };

  let parsed: T | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: timeoutMs,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as T | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw makeError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw makeError(`${refusalLabel}: ${refusal}`);
    }
    throw makeError("AI returned no structured output");
  }

  return {
    data: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}

async function requestStarBreakdown(
  env: AppEnv["Bindings"],
  system: string,
  user: string,
  tagOptions: TagOption[],
  refusalLabel: string,
): Promise<StarBreakdownResult> {
  const validTagIds = new Set(tagOptions.map((tag) => tag.id));
  const schema = starBreakdownSchema.extend({
    tag_ids: buildTagSchema([...validTagIds]),
  });

  const { data, usage } = await runStructuredCompletion<StarBreakdown>({
    env,
    schema,
    schemaName: "star_breakdown",
    system,
    user,
    temperature: 0.2,
    timeoutMs: REQUEST_TIMEOUT_MS,
    makeError: (message) => new StarBreakdownError(message),
    refusalLabel,
  });

  return {
    breakdown: {
      ...data,
      tag_ids: data.tag_ids.filter((id) => validTagIds.has(id)),
    },
    usage,
  };
}

export async function generateStarBreakdown(
  env: AppEnv["Bindings"],
  content: string,
  tagOptions: TagOption[] = [],
): Promise<StarBreakdownResult> {
  return requestStarBreakdown(
    env,
    SYSTEM_PROMPT,
    buildUserPrompt(content, tagOptions),
    tagOptions,
    "AI refused to generate a breakdown",
  );
}

export async function refineStarBreakdown(
  env: AppEnv["Bindings"],
  entry: RefineStarBreakdownInput,
  tagOptions: TagOption[] = [],
): Promise<StarBreakdownResult> {
  return requestStarBreakdown(
    env,
    REFINE_SYSTEM_PROMPT,
    buildRefineUserPrompt(entry, tagOptions),
    tagOptions,
    "AI refused to refine the breakdown",
  );
}

export class DailyLearningSuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyLearningSuggestionError";
  }
}

export type DailyLearningAiSuggestion = z.infer<
  typeof dailyLearningSuggestionSchema
>;

export type DailyLearningSuggestionResult = {
  suggestion: DailyLearningAiSuggestion;
  usage: StarBreakdownUsage;
};

export async function generateDailyLearningSuggestion(
  env: AppEnv["Bindings"],
  context: string,
  options: { regenerate?: boolean } = {},
): Promise<DailyLearningSuggestionResult> {
  const user = options.regenerate
    ? [
        "The engineer already saw an earlier suggestion today and asked for a different direction.",
        "Propose a meaningfully different topic that still follows the rules.",
        "",
        context,
      ].join("\n")
    : context;

  const { data, usage } = await runStructuredCompletion<DailyLearningAiSuggestion>({
    env,
    schema: dailyLearningSuggestionSchema,
    schemaName: "daily_learning_suggestion",
    system: DAILY_LEARNING_SYSTEM_PROMPT,
    user,
    temperature: 0.4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    makeError: (message) => new DailyLearningSuggestionError(message),
    refusalLabel: "AI refused to suggest a learning topic",
  });

  return { suggestion: data, usage };
}

export async function extractAndFormatResume(
  env: AppEnv["Bindings"],
  rawText: string,
): Promise<ResumeExtractionResult> {
  const { data, usage } = await runStructuredCompletion<ResumeExtraction>({
    env,
    schema: resumeExtractionSchema,
    schemaName: "resume_extraction",
    system: RESUME_EXTRACTOR_SYSTEM_PROMPT,
    user: `Raw Extracted Resume Content:\n\n${rawText.slice(0, 8_000)}`,
    temperature: 0.1,
    timeoutMs: CV_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    makeError: (message) => new ResumeExtractionError(message),
    refusalLabel: "AI refused to process resume",
  });

  return { data, usage };
}

export async function analyzeDeveloperCompetencies(
  env: AppEnv["Bindings"],
  cvMarkdown: string,
  devlogContext?: string,
): Promise<SkillInsightsResult> {
  const cv = cvMarkdown.slice(0, 8_000);
  const devlog = devlogContext?.slice(0, 5_000) ?? "";
  const context = [
    "Developer CV / Resume:",
    cv,
    devlog ? `Recent Devlog & Accomplishments:\n${devlog}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const makeError = (message: string) => new SkillInsightsError(message);

  const reality = await runStructuredCompletion<RealityExtraction>({
    env,
    schema: realityExtractionSchema,
    schemaName: "reality_extraction",
    system: REALITY_EXTRACTION_SYSTEM_PROMPT,
    user: context,
    temperature: 0.2,
    timeoutMs: CV_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    makeError,
    refusalLabel: "AI refused to extract the reality profile",
  });

  const audit = await runStructuredCompletion<BlindSpotAudit>({
    env,
    schema: blindSpotAuditSchema,
    schemaName: "blind_spot_audit",
    system: BLIND_SPOT_AUDIT_SYSTEM_PROMPT,
    user: `Demonstrated reality profile:\n${JSON.stringify(reality.data)}`,
    temperature: 0.3,
    timeoutMs: CV_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    makeError,
    refusalLabel: "AI refused to audit blind spots",
  });

  const growthAreas = audit.data.criticalGaps.map((gap) => ({
    id: nanoid(),
    area: gap.area,
    gap: gap.gap,
    recommendation: gap.whyItMattersForSoloDev,
  }));

  const insights: SkillInsights = {
    archetype: reality.data.archetype,
    summary: reality.data.summary,
    strengths: reality.data.strengths,
    growthAreas,
    recommendedNextSteps: reality.data.recommendedNextSteps,
    analyzedAt: new Date().toISOString(),
  };

  const usage = [reality.usage, audit.usage].reduce(
    (acc, item) => ({
      model: acc.model || item.model,
      promptTokens: acc.promptTokens + item.promptTokens,
      completionTokens: acc.completionTokens + item.completionTokens,
      totalTokens: acc.totalTokens + item.totalTokens,
    }),
    { model: "", promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );

  return { insights, usage };
}

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  starBreakdownSchema,
  type StarBreakdown,
} from "@/shared/schemas/brag-log";
import {
  resumeExtractionSchema,
  skillInsightsSchema,
  type ResumeExtraction,
  type SkillInsights,
} from "@/shared/schemas/profile";

import type { AppEnv } from "@/worker/env";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;
// keep under the ~30s waitUntil budget so a timeout rejects and gets persisted
// as "failed" before the isolate is killed
const CV_REQUEST_TIMEOUT_MS = 25_000;
// OpenRouter reasoning budget. These calls only extract structured JSON, so
// "low" cuts generation time; raise to "medium"/"high" if quality suffers.
const REASONING_EFFORT = "low";

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

const SKILL_INSIGHTS_SYSTEM_PROMPT = [
  "You are an Elite Staff Engineer and Career Mentor evaluating a software engineer's profile.",
  "Analyze the provided CV/resume and developer work to provide an objective, actionable, and human-friendly evaluation of where they excel and what technical aspects they need to improve.",
  "Do not use confusing points, numerical RPG levels, or rigid rubrics. Focus on concrete technical superpowers, real gaps, and practical next steps.",
  "Respond with a single JSON object matching the requested schema with:",
  "- archetype: A concise 2-4 word professional signature (e.g. 'Product-Centric Fullstack Engineer', 'High-Velocity Frontend Architect', 'Pragmatic Systems Builder').",
  "- summary: A crisp 2-3 sentence narrative describing their engineering identity, primary domain impact, and current trajectory.",
  "- strengths: An array of 3 to 5 objects with area (title), description (1-2 sentences), and evidenceSummary (quote or specific reference).",
  "- growthAreas: An array of 2 to 4 objects with area (title), gap (what is missing/limited), and recommendation (concrete project/task to learn/document).",
  "- recommendedNextSteps: An array of 2 to 3 practical next milestones or projects to log in their dev log.",
  "- analyzedAt: The current ISO timestamp string.",
  "Be constructive, insightful, and technically accurate. Base all insights strictly on provided facts.",
].join(" ");

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
    reasoning: { effort: REASONING_EFFORT },
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

export async function extractAndFormatResume(
  env: AppEnv["Bindings"],
  rawText: string,
): Promise<ResumeExtractionResult> {
  const { data, usage } = await runStructuredCompletion<ResumeExtraction>({
    env,
    schema: resumeExtractionSchema,
    schemaName: "resume_extraction",
    system: RESUME_EXTRACTOR_SYSTEM_PROMPT,
    user: `Raw Extracted Resume Content:\n\n${rawText.slice(0, 15_000)}`,
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
  const promptContent = [
    "Developer CV / Resume:",
    cvMarkdown.slice(0, 15_000),
    devlogContext
      ? `\nRecent Devlog & Accomplishments:\n${devlogContext.slice(0, 5_000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data, usage } = await runStructuredCompletion<SkillInsights>({
    env,
    schema: skillInsightsSchema,
    schemaName: "skill_insights",
    system: SKILL_INSIGHTS_SYSTEM_PROMPT,
    user: promptContent,
    temperature: 0.2,
    timeoutMs: CV_REQUEST_TIMEOUT_MS,
    maxRetries: 0,
    makeError: (message) => new SkillInsightsError(message),
    refusalLabel: "AI refused to analyze skills",
  });

  return { insights: data, usage };
}

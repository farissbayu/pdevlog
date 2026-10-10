import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  starBreakdownSchema,
  type StarBreakdown,
} from "@/shared/schemas/brag-log";
import {
  skillShredderResultSchema,
  type SkillShredderResult,
} from "@/shared/schemas/skill-shredder";
import type { AppEnv } from "@/worker/env";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;
const RESPONSE_FORMAT_NAME = "star_breakdown";

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

const SKILL_SHREDDER_SYSTEM_PROMPT = [
  "You are a Principal Software Engineer and Pragmatic Mentor specializing in",
  "deliberate practice and rapid skill acquisition. A developer wants to learn a",
  "topic or technology but feels overwhelmed or stuck in tutorial hell, not",
  "knowing what step-by-step project to build. Invent a hyper-focused TOY PROJECT",
  "(the Todo App equivalent of this topic): a tiny, self-contained project with",
  "ZERO domain complexity that forces hands-on implementation of 100% of the",
  "topic's core fundamentals.",
  "Respond with a single JSON object whose top-level keys are exactly topicTitle,",
  "toyProjectTitle, toyProjectPitch, fundamentalPillars, spike0, milestones,",
  "ignoreList and practiceChallenge.",
  "fundamentalPillars is an array of 2 to 4 objects with keys name and explanation.",
  "spike0 is an object with keys title, objective, scratchSnippet, successCriteria",
  "and estimatedMinutes (15 to 30).",
  "milestones is an array of 2 to 4 objects with keys stepNumber, title,",
  "actionDescription, verificationGuide and estimatedMinutes.",
  "ignoreList is an array of exactly 3 to 5 strings.",
  "practiceChallenge is an object with keys challenge and hint.",
  "spike0 is a 10-20 line throwaway scratch script that proves the technology is",
  "alive, verifiable in the console. Each milestone is a vertical build step with",
  "a concrete action and verification. ignoreList forbids over-engineering today,",
  "for example auth, complex CSS or production scale. practiceChallenge is one",
  "modification challenge to solve WITHOUT AI. Do not use markdown inside string",
  "values. Tone: encouraging, razor-sharp, practical and anti-overengineering.",
].join(" ");

type TagOption = {
  id: string;
  name: string;
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

export class SkillShredderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillShredderError";
  }
}

export type SkillShredderGeneration = {
  blueprint: SkillShredderResult;
  usage: StarBreakdownUsage;
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

function buildUserPrompt(content: string, tagOptions: TagOption[]): string {
  if (tagOptions.length === 0) {
    return content;
  }

  const tagList = tagOptions
    .map((tag) => `- id: ${tag.id}, name: ${tag.name}`)
    .join("\n");

  return `Available tags:\n${tagList}\n\nNotes:\n${content}`;
}

export async function generateStarBreakdown(
  env: AppEnv["Bindings"],
  content: string,
  tagOptions: TagOption[] = [],
): Promise<StarBreakdownResult> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });

  const validTagIds = new Set(tagOptions.map((tag) => tag.id));
  const schema = starBreakdownSchema.extend({
    tag_ids: buildTagSchema([...validTagIds]),
  });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    response_format: zodResponseFormat(schema, RESPONSE_FORMAT_NAME),
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: buildUserPrompt(content, tagOptions) },
    ],
    provider: { require_parameters: true },
  };

  let parsed: StarBreakdown | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as StarBreakdown | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new StarBreakdownError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new StarBreakdownError(
        `AI refused to generate a breakdown: ${refusal}`,
      );
    }
    throw new StarBreakdownError("AI returned no structured output");
  }

  return {
    breakdown: {
      ...parsed,
      tag_ids: parsed.tag_ids.filter((id) => validTagIds.has(id)),
    },
    usage: {
      model,
      promptTokens,
      completionTokens,
      totalTokens,
    },
  };
}

function buildSkillUserPrompt(
  topic: string,
  currentContext: string | undefined,
  targetTimeMinutes: number,
): string {
  const context = currentContext
    ? `What I already understand: ${currentContext}\n\n`
    : "";
  return `I have about ${targetTimeMinutes} minutes to learn today.\n\n${context}What I want to learn: ${topic}`;
}

export async function generateSkillShredder(
  env: AppEnv["Bindings"],
  topic: string,
  currentContext: string | undefined,
  targetTimeMinutes = 60,
): Promise<SkillShredderGeneration> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.3,
    response_format: zodResponseFormat(
      skillShredderResultSchema,
      "skill_shredder",
    ),
    messages: [
      { role: "system" as const, content: SKILL_SHREDDER_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildSkillUserPrompt(
          topic,
          currentContext,
          targetTimeMinutes,
        ),
      },
    ],
    provider: { require_parameters: true },
  };

  let parsed: SkillShredderResult | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as SkillShredderResult | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new SkillShredderError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new SkillShredderError(`AI refused to shred the topic: ${refusal}`);
    }
    throw new SkillShredderError("AI returned no structured output");
  }

  return {
    blueprint: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}

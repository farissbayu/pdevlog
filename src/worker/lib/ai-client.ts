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
import {
  automatedSkillAuditSchema,
  type AutomatedSkillAudit,
} from "@/shared/schemas/skills";
import {
  resumeExtractionSchema,
  cvSkillAuditResultSchema,
  skillInsightsSchema,
  type ResumeExtraction,
  type CvSkillAuditResult,
  type SkillInsights,
} from "@/shared/schemas/profile";

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

export class SkillAuditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillAuditorError";
  }
}

export type SkillAuditResult = {
  audit: AutomatedSkillAudit;
  usage: StarBreakdownUsage;
};

const SKILL_AUDITOR_SYSTEM_PROMPT = [
  "You are an objective Principal Product Engineer and Technical Growth Auditor.",
  "Evaluate developer work logs (STAR brag logs or technical notes) against 5 core Product Engineering mastery pillars:",
  "1. ui-craft: Accessible design systems, optimistic UI, micro-animations, tactile feedback, sub-16ms fluid interfaces, layout polish.",
  "2. fullstack-data: Pragmatic relational schemas, state machines, multi-step business workflows, auth/RBAC, webhooks, payments, resilient APIs.",
  "3. product-sense: Problem validation, aggressive scope de-risking, vertical slice delivery, frictionless onboarding, UX architecture, high-leverage trade-offs.",
  "4. product-telemetry: Client error tracking (Sentry), funnel analytics, user behavior event telemetry, Core Web Vitals, business metric anomaly alerts.",
  "5. velocity-ai: Rapid throwaway prototyping, feature flags, progressive rollouts, pragmatic AI/LLM workflow integration, A/B testing, dev multipliers.",
  "Determine whether this note/log provides concrete evidence of technical depth, user value delivery, or hands-on implementation.",
  "If the entry is merely generic busywork or unrelated to the 5 pillars, return matchedSkillSlug: 'none', inferredLevel: null, confidenceScore: 0, and explain why in reasoningSnippet.",
  "If it provides genuine technical evidence, return the matchedSkillSlug, an inferredLevel between 1 and 5, a concise milestoneTitle (e.g. 'Optimistic UI & Resilient State'), a confidenceScore between 0.0 and 1.0, and a reasoningSnippet quoting the concrete actions that prove this mastery.",
].join(" ");


function buildAuditUserPrompt(
  title: string,
  content: string,
  tags: string[] = [],
): string {
  const parts = [
    `Title: ${title}`,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : "",
    "Content:",
    content,
  ].filter(Boolean);
  return parts.join("\n\n");
}

export async function auditSkillEvidence(
  env: AppEnv["Bindings"],
  entry: { title: string; content: string; tags?: string[] },
): Promise<SkillAuditResult> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
  });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    response_format: zodResponseFormat(
      automatedSkillAuditSchema,
      "skill_audit",
    ),
    messages: [
      { role: "system" as const, content: SKILL_AUDITOR_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildAuditUserPrompt(
          entry.title,
          entry.content,
          entry.tags,
        ),
      },
    ],
    provider: { require_parameters: true },
  };

  let parsed: AutomatedSkillAudit | null;
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
    parsed = (message?.parsed as AutomatedSkillAudit | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new SkillAuditorError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new SkillAuditorError(`AI refused to audit the entry: ${refusal}`);
    }
    throw new SkillAuditorError("AI returned no structured output");
  }

  return {
    audit: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}

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

export class CvAuditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvAuditorError";
  }
}

export type CvAuditResult = {
  result: CvSkillAuditResult;
  usage: StarBreakdownUsage;
};

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

const CV_REQUEST_TIMEOUT_MS = 90_000;

export async function extractAndFormatResume(
  env: AppEnv["Bindings"],
  rawText: string,
): Promise<ResumeExtractionResult> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    response_format: zodResponseFormat(
      resumeExtractionSchema,
      "resume_extraction",
    ),
    messages: [
      { role: "system" as const, content: RESUME_EXTRACTOR_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Raw Extracted Resume Content:\n\n${rawText.slice(0, 15_000)}`,
      },
    ],
    provider: { require_parameters: true },
  };

  let parsed: ResumeExtraction | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: CV_REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as ResumeExtraction | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new ResumeExtractionError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new ResumeExtractionError(
        `AI refused to process resume: ${refusal}`,
      );
    }
    throw new ResumeExtractionError("AI returned no structured output");
  }

  return {
    data: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}

const CV_SKILL_AUDITOR_SYSTEM_PROMPT = [
  "You are a Staff Product Engineering Principal and Technical Growth Auditor.",
  "Your task is to evaluate a developer's complete CV/Resume Markdown against the 5 canonical Product Engineering mastery pillars and their L1-L5 milestones:",
  "1. ui-craft (L1: Accessible & Responsive Layouts, L2: Fluid Micro-interactions & Motion, L3: Optimistic UI & Robust Offline Resilience, L4: Scalable Design Systems & Component Architecture, L5: Bespoke Interaction Engines & Canvas Polish)",
  "2. fullstack-data (L1: Relational Schema & Clean Migrations, L2: Explicit State Machines & Business Invariants, L3: Role-Based Access Control & Auth Boundaries, L4: Resilient Webhooks & Payment Lifecycles, L5: Live Multi-Client Data Sync & Conflict Resolution)",
  "3. product-sense (L1: User Pain-Point Validation, L2: Ruthless Scope De-risking, L3: End-to-End Vertical Slice Delivery, L4: Frictionless Onboarding & Activation Funnel, L5: Strategic Product Trade-offs & North Star Alignment)",
  "4. product-telemetry (L1: Meaningful Error Tracking & Sentry Context, L2: Funnel Event Tracking & Conversion Telemetry, L3: Real-User Performance & Core Web Vitals, L4: Proactive Anomaly Alerts & Business Thresholds, L5: Evidence-Based Iteration Loops)",
  "5. velocity-ai (L1: Rapid Technical Spikes & Throwaway Prototyping, L2: Safe Rollouts with Feature Flags, L3: Pragmatic LLM Workflows & Prompt Chaining, L4: Controlled A/B Testing & Hypothesis Validation, L5: Internal Developer Multipliers & Automation)",
  "candidateOverview MUST be exactly 1 short sentence summarizing the developer's core profile.",
  "Review the candidate's career history and extract concrete bullet points that genuinely substantiate any of these 25 milestones.",
  "For each match:",
  "- pillarSlug: must be one of 'ui-craft', 'fullstack-data', 'product-sense', 'product-telemetry', 'velocity-ai'.",
  "- level: integer 1 to 5.",
  "- quoteSnippet: direct, verbatim quote from the CV (e.g. 'Built reusable design system in React used across 4 squads' or 'Integrated Stripe webhooks with exponential backoff queues').",
  "- reasoning: clear explanation why this specific accomplishment proves this level of mastery.",
  "- confidenceScore: between 0.6 and 1.0 (do not include vague or unverified assumptions).",
  "Only match milestones with real substance in the CV. Quality and precision over quantity.",
].join(" ");

export async function auditCvSkillEvidence(
  env: AppEnv["Bindings"],
  cvMarkdown: string,
): Promise<CvAuditResult> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.1,
    response_format: zodResponseFormat(
      cvSkillAuditResultSchema,
      "cv_skill_audit",
    ),
    messages: [
      { role: "system" as const, content: CV_SKILL_AUDITOR_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Developer CV / Resume Markdown:\n\n${cvMarkdown.slice(0, 15_000)}`,
      },
    ],
    provider: { require_parameters: true },
  };

  let parsed: CvSkillAuditResult | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: CV_REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as CvSkillAuditResult | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new CvAuditorError(`AI request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new CvAuditorError(`AI refused to audit CV: ${refusal}`);
    }
    throw new CvAuditorError("AI returned no structured output");
  }

  return {
    result: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}

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

export async function analyzeDeveloperCompetencies(
  env: AppEnv["Bindings"],
  cvMarkdown: string,
  devlogContext?: string,
): Promise<SkillInsightsResult> {
  const client = new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: resolveBaseUrl(env.AI_BASE_URL),
    maxRetries: 0,
  });

  const promptContent = [
    "Developer CV / Resume:",
    cvMarkdown.slice(0, 15_000),
    devlogContext
      ? `\nRecent Devlog & Accomplishments:\n${devlogContext.slice(0, 5_000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const requestParams = {
    model: env.AI_MODEL || DEFAULT_MODEL,
    temperature: 0.2,
    response_format: zodResponseFormat(skillInsightsSchema, "skill_insights"),
    messages: [
      { role: "system" as const, content: SKILL_INSIGHTS_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: promptContent,
      },
    ],
    provider: { require_parameters: true },
  };

  let parsed: SkillInsights | null;
  let refusal: string | null;
  let model = requestParams.model;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: CV_REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as SkillInsights | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
    model = completion.model || requestParams.model;
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
    totalTokens = completion.usage?.total_tokens ?? 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new SkillInsightsError(`AI analysis request failed: ${detail}`);
  }

  if (!parsed) {
    if (refusal) {
      throw new SkillInsightsError(`AI refused to analyze skills: ${refusal}`);
    }
    throw new SkillInsightsError("AI returned no structured output");
  }

  return {
    insights: parsed,
    usage: { model, promptTokens, completionTokens, totalTokens },
  };
}


import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  starBreakdownSchema,
  type StarBreakdown,
} from "@/shared/schemas/brag-log";
import type { AppEnv } from "@/worker/env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30_000;
const RESPONSE_FORMAT_NAME = "star_breakdown";

const SYSTEM_PROMPT = [
  "You help software professionals turn rough notes about their work into a",
  "concise STAR (Situation, Task, Action, Result) brag-log entry.",
  "Rewrite the notes from a first-person perspective, staying strictly faithful",
  "to the facts provided. Do not invent metrics, tools, or outcomes.",
  "Keep each section focused and free of markdown.",
  "When a list of available tags is provided, choose only the tags that",
  "genuinely apply to the entry; never invent tags.",
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

function buildTagSchema(tagIds: string[]) {
  if (tagIds.length === 0) {
    return z.array(z.string()).max(0);
  }
  return z.array(z.enum(tagIds as [string, ...string[]]));
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
): Promise<StarBreakdown> {
  const client = new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://pdevlog.app",
      "X-Title": "pdevlog",
    },
  });

  const validTagIds = new Set(tagOptions.map((tag) => tag.id));
  const schema = starBreakdownSchema.extend({
    tag_ids: buildTagSchema([...validTagIds]),
  });

  const requestParams = {
    model: env.OPENROUTER_MODEL || DEFAULT_MODEL,
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
  try {
    const completion = await client.chat.completions.parse(requestParams, {
      timeout: REQUEST_TIMEOUT_MS,
    });
    const message = completion.choices[0]?.message;
    parsed = (message?.parsed as StarBreakdown | null | undefined) ?? null;
    refusal = message?.refusal ?? null;
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
    ...parsed,
    tag_ids: parsed.tag_ids.filter((id) => validTagIds.has(id)),
  };
}

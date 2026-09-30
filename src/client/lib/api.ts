import { hc } from "hono/client";

import type { AppType } from "@/worker/index";

export const client = hc<AppType>("/", {
  init: {
    credentials: "include",
  },
});

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type JsonResponse = {
  status: number;
  json: () => Promise<unknown>;
};

export async function parseApiError(
  response: JsonResponse,
  fallback: string,
): Promise<ApiError> {
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) {
      message = body.error;
    }
  } catch {
    // keep fallback message when the body is not JSON
  }
  return new ApiError(message, response.status);
}

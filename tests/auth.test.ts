import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import app from "@/worker/index";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return await app.fetch(new Request(`https://example.com${path}`, init), env);
}

describe("auth API", () => {
  it("protects /api/health for unauthenticated requests", async () => {
    const response = await request("/api/health");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 401 from /api/auth/me without a session", async () => {
    const response = await request("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("redirects /api/auth/google to Google with PKCE", async () => {
    const response = await request("/api/auth/google");

    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("code_challenge=");
  });
});

describe("auth rate limiting", () => {
  it("returns 429 after exceeding the limit for a client IP", async () => {
    const headers = { "CF-Connecting-IP": "198.51.100.24" };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request("/api/auth/google", { headers });
      expect(response.status).toBe(302);
    }

    const blocked = await request("/api/auth/google", { headers });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    await expect(blocked.json()).resolves.toEqual({
      error: "Too many requests",
    });
  });

  it("does not throttle a different client IP", async () => {
    const response = await request("/api/auth/google", {
      headers: { "CF-Connecting-IP": "198.51.100.25" },
    });

    expect(response.status).toBe(302);
  });
});

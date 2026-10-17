import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  SESSION_COOKIE,
  createSessionToken,
} from "@/worker/features/auth/session";
import app from "@/worker/index";

async function createUser(id: string): Promise<string> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, google_sub, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, `google-sub-${id}`, `${id}@example.com`, `User ${id}`, now, now)
    .run();

  return createSessionToken(id, env.JWT_SECRET);
}

async function request(path: string, token?: string): Promise<Response> {
  const headers = new Headers();
  if (token) {
    headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
  }

  return app.fetch(new Request(`https://example.com${path}`, { headers }), env);
}

describe("server-rendered landing page and guides", () => {
  it("renders the landing page HTML with SEO tags and app content", async () => {
    const response = await request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("Stop Repeating 1 Year of Experience 5 Times Over.");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain(
      'rel="canonical" href="https://test.pdevlog.example/"',
    );
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).not.toContain("__PDEVLOG_ME__");
  });

  it("server-renders the interactive capture demo with accessible controls", async () => {
    const response = await request("/");
    const html = await response.text();

    expect(html).toContain("Choose a sample rough note");
    expect(html).toContain("Break into STAR");
    expect(html).toContain('type="radio"');
  });

  it("renders a guide with markdown content and article SEO tags", async () => {
    const response = await request("/guides/overview");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("Introduction &amp; Core Loop");
    expect(html).toContain("Why Personal Dev Log Exists");
    expect(html).toContain('"@type":"TechArticle"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain(
      'rel="canonical" href="https://test.pdevlog.example/guides/overview"',
    );
  });

  it("returns a 404 page for unknown guide slugs", async () => {
    const response = await request("/guides/does-not-exist");

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Guide not found");
  });

  it("redirects /guides to the first guide", async () => {
    const response = await request("/guides");

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/guides/overview");
  });

  it("renders the authenticated CTA and bootstraps the session for logged-in users", async () => {
    const token = await createUser("ssr-user");

    const response = await request("/", token);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-cache");
    expect(html).toContain("Open dashboard");
    expect(html).toContain("__PDEVLOG_ME__");
    expect(html).not.toContain("Sign in with Google");
  });

  it("keeps API routes untouched", async () => {
    const health = await request("/api/health");
    expect(health.status).toBe(401);
  });
});

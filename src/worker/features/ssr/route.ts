import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";

import { GUIDES, getGuideBySlug } from "@/shared/guides/content";
import type { MeResponse } from "@/shared/schemas/auth";
import { createDb } from "@/worker/db";
import { users } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";
import { getSessionUserId } from "@/worker/features/auth/session";
import { isAdminEmail, toUserResponse } from "@/worker/lib/users";

import { renderApp, renderGuideNotFound } from "./renderer";
import {
  buildHeadTags,
  guideSeo,
  injectSsr,
  landingSeo,
  notFoundSeo,
  type SeoMeta,
} from "./seo";

const GUEST_CACHE =
  "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
const PRIVATE_CACHE = "private, no-cache";

let cachedTemplate: string | null = null;

async function getIndexTemplate(env: Env, origin: string): Promise<string> {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  const response = await env.ASSETS.fetch(`${origin}/index.html`);
  if (!response.ok) {
    throw new Error(`Failed to fetch index.html: ${response.status}`);
  }

  const html = await response.text();
  if (import.meta.env.PROD) {
    cachedTemplate = html;
  }
  return html;
}

async function getSsrMe(c: Context<AppEnv>): Promise<MeResponse | null> {
  const userId = await getSessionUserId(c);
  if (!userId) {
    return null;
  }

  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    user: toUserResponse(user, isAdminEmail(user.email, c.env.ADMIN_EMAILS)),
  };
}

function bootstrapScript(me: MeResponse | null): string {
  if (!me) {
    return "";
  }
  return `<script>window.__PDEVLOG_ME__=${JSON.stringify(me).replace(/</g, "\\u003c")}</script>`;
}

async function renderDocument(
  c: Context<AppEnv>,
  meta: SeoMeta,
  bodyHtml: string,
  me: MeResponse | null,
): Promise<string> {
  const origin = c.env.APP_URL.replace(/\/+$/, "");
  const template = await getIndexTemplate(c.env, new URL(c.req.url).origin);

  return injectSsr(template, {
    headTags: buildHeadTags(meta, origin),
    bodyHtml,
    bootstrapScript: bootstrapScript(me),
  });
}

function htmlResponse(
  html: string,
  status: number,
  cacheControl: string,
): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": cacheControl,
    },
  });
}

function appOrigin(c: Context<AppEnv>): string {
  return c.env.APP_URL.replace(/\/+$/, "");
}

export const ssrRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const me = await getSsrMe(c);
    const html = await renderDocument(
      c,
      landingSeo(appOrigin(c)),
      renderApp("/", me),
      me,
    );
    return htmlResponse(html, 200, me ? PRIVATE_CACHE : GUEST_CACHE);
  })
  .get("/guides", (c) => {
    return c.redirect(`/guides/${GUIDES[0]?.slug ?? "overview"}`, 301);
  })
  .get("/guides/:slug", async (c) => {
    const slug = c.req.param("slug");
    const guide = getGuideBySlug(slug);
    const me = await getSsrMe(c);

    if (!guide) {
      const html = await renderDocument(
        c,
        notFoundSeo(appOrigin(c)),
        renderGuideNotFound(slug),
        null,
      );
      return htmlResponse(html, 404, "no-cache");
    }

    const html = await renderDocument(
      c,
      guideSeo(guide, appOrigin(c)),
      renderApp(`/guides/${slug}`, me),
      me,
    );
    return htmlResponse(html, 200, me ? PRIVATE_CACHE : GUEST_CACHE);
  });

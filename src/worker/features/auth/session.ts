import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";

import type { AppEnv } from "@/worker/env";

export const SESSION_COOKIE = "pdevlog_session";
export const OAUTH_STATE_COOKIE = "pdevlog_oauth_state";
export const OAUTH_CODE_VERIFIER_COOKIE = "pdevlog_oauth_code_verifier";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function isSecureRequest(c: Context<AppEnv>): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export async function createSessionToken(
  userId: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: userId,
      iat: now,
      exp: now + SESSION_MAX_AGE_SECONDS,
    },
    secret,
  );
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string | null> {
  try {
    const payload = await verify(token, secret, "HS256");
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  c: Context<AppEnv>,
  token: string,
  secure: boolean,
): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export async function getSessionUserId(
  c: Context<AppEnv>,
): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  return verifySessionToken(token, c.env.JWT_SECRET);
}

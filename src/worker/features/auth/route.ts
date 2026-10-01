import { Google, generateCodeVerifier, generateState } from "arctic";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { nanoid } from "nanoid";

import type { UserResponse } from "@/shared/schemas/auth";
import { createDb, type Database } from "@/worker/db";
import { users, type UserRow } from "@/worker/db/schema";
import type { AppEnv } from "@/worker/env";

import {
  OAUTH_CODE_VERIFIER_COOKIE,
  OAUTH_STATE_COOKIE,
  clearSessionCookie,
  createSessionToken,
  getSessionUserId,
  isSecureRequest,
  setSessionCookie,
} from "./session";

const GOOGLE_SCOPES = ["openid", "email", "profile"];
const OAUTH_COOKIE_MAX_AGE = 60 * 10;
const GOOGLE_USERINFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleUserInfo = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

function createGoogleClient(c: Context<AppEnv>): Google {
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`;
  return new Google(
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );
}

async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo request failed: ${response.status}`);
  }

  return (await response.json()) as GoogleUserInfo;
}

async function upsertUser(
  db: Database,
  info: GoogleUserInfo,
): Promise<UserRow> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, info.sub))
    .limit(1);

  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email: info.email,
        name: info.name,
        avatarUrl: info.picture ?? null,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      id: nanoid(),
      googleSub: info.sub,
      email: info.email,
      name: info.name,
      avatarUrl: info.picture ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

const googleHandler = (c: Context<AppEnv>) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const google = createGoogleClient(c);
  const url = google.createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES);

  const cookieOptions = {
    httpOnly: true,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
    secure: isSecureRequest(c),
    sameSite: "Lax" as const,
  };

  setCookie(c, OAUTH_STATE_COOKIE, state, cookieOptions);
  setCookie(c, OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return c.redirect(url.toString());
};

const googleCallbackHandler = async (c: Context<AppEnv>) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const storedState = getCookie(c, OAUTH_STATE_COOKIE);
  const codeVerifier = getCookie(c, OAUTH_CODE_VERIFIER_COOKIE);

  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
  deleteCookie(c, OAUTH_CODE_VERIFIER_COOKIE, { path: "/" });

  if (
    !code ||
    !state ||
    !storedState ||
    !codeVerifier ||
    state !== storedState
  ) {
    return c.json({ error: "Invalid OAuth state" }, 400);
  }

  try {
    const google = createGoogleClient(c);
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const userInfo = await fetchGoogleUserInfo(tokens.accessToken());

    const db = createDb(c.env.DB);
    const user = await upsertUser(db, userInfo);
    const sessionToken = await createSessionToken(user.id, c.env.JWT_SECRET);

    setSessionCookie(c, sessionToken, isSecureRequest(c));

    return c.redirect("/");
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return c.json({ error: "Authentication failed" }, 400);
  }
};

const logoutHandler = (c: Context<AppEnv>) => {
  clearSessionCookie(c);
  return c.json({ success: true });
};

const deleteAccountHandler = async (c: Context<AppEnv>) => {
  const userId = await getSessionUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDb(c.env.DB);
  await db.delete(users).where(eq(users.id, userId));

  clearSessionCookie(c);
  return c.json({ success: true });
};

const meHandler = async (c: Context<AppEnv>) => {
  const userId = await getSessionUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createDb(c.env.DB);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    clearSessionCookie(c);
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json({ user: toUserResponse(user) });
};

export const authRoute = new Hono<AppEnv>()
  .get("/google", googleHandler)
  .get("/google/callback", googleCallbackHandler)
  .post("/logout", logoutHandler)
  .get("/me", meHandler)
  .delete("/account", deleteAccountHandler);

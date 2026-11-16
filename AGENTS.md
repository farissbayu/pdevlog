# AGENTS.md

Private dev log on Cloudflare Workers + D1. React 19 SPA and Hono API ship as **one
Worker** via `@cloudflare/vite-plugin`. Bun is the package manager/runtime.

## Commands

```bash
bun run typecheck          # tsc -b over 4 projects (app, node, worker, test)
bun run lint               # oxlint, no config file in repo
bun run test               # vitest run — full suite ~80s, 23 files
bunx vitest run tests/isolation/skills.test.ts   # single file
bun run dev                # Vite dev server w/ Worker runtime on :5173
```

Deploys run on **Cloudflare Workers Builds**, configured in the Cloudflare
dashboard (no `.github/workflows` in this repo, so GitHub Actions is not involved).
The dashboard build command is `bun install --frozen-lockfile && bun run build`;
the deploy command is `bun run deploy:ci`, which applies remote D1 migrations and
then runs `wrangler deploy`.

There is no remote test gate: run `bun run typecheck && bun run test` locally
before pushing, because the build only type-checks via `tsc -b`.

Commit messages are lowercase Conventional Commits: `feat: ...`, `fix: ...`, `chore: ...`.

## Layout

```
src/worker/index.ts        Hono app; every route module is mounted here
src/worker/features/<d>/  route.ts (handlers + zValidator) and service.ts (queries)
src/client/app/router.tsx every page route is registered here
src/client/features/<d>/  api.ts (react-query hooks) + page components
src/shared/schemas/       Zod schemas imported by BOTH client and worker
```

Add a feature in that order: schema -> `route.ts`/`service.ts` -> mount in
`worker/index.ts` -> `api.ts` -> register in `client/app/router.tsx`.

## Things an agent will get wrong

- **Types flow from the worker to the client.** The client uses the typed Hono
  client (`hc<AppType>`, `src/client/lib/api.ts`), so changing a route's response
  type breaks client code at compile time. Put request/response shapes in
  `src/shared/schemas`, never redefine them client-side.
- **Auth.** `/api/auth/*` and `/api/health` are the only unauthenticated paths;
  `authMiddleware` covers the rest of `/api/*`. Admin routes add `requireAdmin`,
  which checks the session user's email against the `ADMIN_EMAILS` var.
- **Per-user isolation.** Scope every query by `c.get("userId")`. Cross-user
  access must answer **404, not 403** — `tests/isolation/*` asserts this.
- **DB changes need a generated migration.** Edit `src/worker/db/schema.ts`, then
  `bun run db:generate`, then `bun run db:migrate:local`. Tests build their D1
  from the files in `drizzle/` at run time, so a schema change without a migration
  makes the new test fail. Hand-written SQL migrations are mixed in with the
  drizzle-kit ones; keep the `--> statement-breakpoint` separators.
- **`worker-configuration.d.ts` is generated and committed.** After changing
  bindings in `wrangler.jsonc`, run `bun run cf-typegen`.
- **tsconfig is strict about extras:** `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax`, and `erasableSyntaxOnly` (no enums, no constructor
  parameter properties) apply to worker, client, and tests.
- **Rate limiting is per-IP, 10/min**, on auth, `/api/brag-logs/star-breakdown`,
  and profile AI endpoints (`/api/profile/cv/upload`, `/api/profile/skills/analyze`,
  `/api/profile/persona/extract`). `rateLimit()` state is an in-memory `Map`, so
  it is per-isolate, not global.

## Tests

Vitest runs inside the Workers runtime (`@cloudflare/vitest-pool-workers`). No
`.dev.vars` needed — every binding is hardcoded in `vitest.config.ts`, and
migrations are applied by `tests/setup/apply-migrations.ts`.

To call an authenticated endpoint in a test, insert a user row and mint a real
session cookie — copy `createUser`/`request` from `tests/isolation/workspaces.test.ts`:

```ts
const token = await createUser("user-a");          // returns a signed JWT
headers.set("Cookie", `${SESSION_COOKIE}=${token}`);
await app.fetch(new Request(`https://example.com${path}`, { headers }), env);
```

Mock the AI provider with `vi.stubGlobal("fetch", ...)` (see
`tests/unit/ai-client.test.ts`) — there is no live AI call in tests.

## AI calls

All AI lives in `src/worker/lib/ai-client.ts` behind `getAiClient(env)`:
`AI_BASE_URL` is passed through `resolveBaseUrl()`. `wrangler.jsonc` and
`.dev.vars.example` now store plain provider base URLs without a
`/chat/completions` suffix, and `resolveBaseUrl()` still strips a trailing
`/chat/completions` when present for backward compatibility. OpenRouter
attribution headers come from `APP_URL` / `APP_NAME`.

Long AI work (CV parse and skill audits) is sent to the `AI_QUEUE` producer,
handled by `handleAiJobBatch` in `src/worker/features/profile/queue.ts`, and
returns `202` with a status; the client polls via `refetchInterval`. A
`user_profiles.ai_job_started_at` timestamp lets `GET /api/profile` mark jobs
older than 2 minutes as failed so polling never hangs. Follow the queue pattern
instead of blocking the request (the synchronous `/api/profile/persona/extract`
endpoint is the one exception).

## Stale docs

`README.md` is mostly accurate but can lag behind new routes. Trust
`src/worker/index.ts` over the README's route table.
# Personal Dev Log (`pdevlog`)

A private dev log for software engineers. Capture brag-worthy wins in STAR
format, write Markdown notes, organize everything with workspaces and
tags, and export it all whenever you want. Runs entirely on Cloudflare Workers
with a D1 (SQLite) database.

## Features

- **Google sign-in** — OAuth 2.0 with PKCE via [Arctic](https://arctic.js.org/), session stored in a signed `httpOnly` JWT cookie.
- **Workspaces** — group entries by context, typed as `work`, `learning`, or `general`.
- **Brag logs** — record achievements in **STAR** format (Situation, Task, Action, Result). Assign them to a workspace or keep them standalone; filter by "Unassigned" from the global Brag Logs page.
- **AI STAR breakdown** — paste rough notes and let an LLM draft the STAR entry plus suggest applicable tags (via OpenRouter, structured output validated with Zod).
- **Notes** — Markdown editor with live preview, syntax highlighting, and auto-generated table of contents. Attach a note to a workspace of any type or keep it standalone.
- **Source material** — attach links (with optional labels) to a note; each opens in a new tab.
- **Sparks** — a frictionless capture inbox. Press `Cmd/Ctrl+K` (or the Spark button) anywhere to dump a link, idea, or screenshot. Recall old sparks with full-text/tag/date filters or a "Surprise me" random pick, then promote them into a note or brag log.
- **Screenshot attachments** — paste, drag-and-drop, or pick images (PNG/JPEG/WebP/GIF, up to 10 MB, 20 per owner). Stored in R2 and served through an owner-checked backend proxy; carried along when a spark is promoted into a note.
- **Tags** — cross-cut brag logs and notes; filter and search across them.
- **Dashboard** — totals and recent activity at a glance.
- **Export** — download brag logs as Markdown, optionally scoped to a date range.
- **Account deletion** — remove your account and all owned data (cascading deletes).
- **Light/dark theme**, collapsible sidebar, responsive layout.

## Tech Stack

| Layer      | Technology |
| ---------- | ---------- |
| Runtime    | Cloudflare Workers, D1 (SQLite) |
| API        | [Hono](https://hono.dev/) + `@hono/zod-validator` |
| Database   | [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit |
| Storage    | Cloudflare R2 (spark image attachments) |
| Frontend   | React 19, React Router 7, TanStack Query |
| UI         | Tailwind CSS 4, Radix UI, lucide-react |
| Auth       | Arctic (Google OAuth), JWT sessions |
| AI         | OpenAI SDK pointed at [OpenRouter](https://openrouter.ai/) |
| Validation | Zod (shared between client and worker) |
| Build      | Vite 8 + `@cloudflare/vite-plugin`, Bun |
| Testing    | Vitest + `@cloudflare/vitest-pool-workers` |
| Linting    | oxlint |

## Prerequisites

- [Bun](https://bun.sh)
- A Cloudflare account (for deploy) — local development only needs Wrangler
- A Google Cloud OAuth Client ID — see [docs/google-oauth-setup.md](docs/google-oauth-setup.md)
- An [OpenRouter](https://openrouter.ai/) API key (for the AI STAR breakdown feature)

## Getting Started

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Configure local secrets**

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   Then fill in `.dev.vars`:

   ```env
   GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
   JWT_SECRET="random-string-at-least-32-characters-long"
   OPENROUTER_API_KEY="sk-or-v1-xxx"
   OPENROUTER_MODEL="openai/gpt-4o-mini"
   ```

   See [docs/google-oauth-setup.md](docs/google-oauth-setup.md) to create the
   Google OAuth client. The authorized redirect URI must be exactly
   `http://localhost:5173/api/auth/google/callback`.

3. **Apply database migrations locally**

   ```bash
   bun run db:migrate:local
   ```

4. **Start the dev server**

   ```bash
   bun run dev
   ```

   Open <http://localhost:5173> and sign in with Google.

## Environment Variables

| Variable | Where | Description |
| -------- | ----- | ----------- |
| `GOOGLE_CLIENT_ID` | secret | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | secret | Google OAuth client secret |
| `JWT_SECRET` | secret | Signing key for session cookies, min 32 chars |
| `OPENROUTER_API_KEY` | secret | OpenRouter API key for AI features |
| `OPENROUTER_MODEL` | var | Model slug, defaults to `openai/gpt-4o-mini` |

`.dev.vars` is git-ignored. In production these are set with
`wrangler secret put`. `OPENROUTER_MODEL` can also be set in `wrangler.jsonc`
under `vars`.

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start Vite dev server with the Worker runtime |
| `bun run build` | Type-check and build client + worker to `dist/` |
| `bun run preview` | Build and preview the production bundle |
| `bun run deploy` | Build and deploy to Cloudflare Workers |
| `bun run typecheck` | Run `tsc -b` across all TS projects |
| `bun run lint` | Run oxlint |
| `bun run test` | Run the Vitest suite once |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run db:generate` | Generate a Drizzle migration from schema changes |
| `bun run db:migrate:local` | Apply migrations to the local D1 database |
| `bun run db:migrate:remote` | Apply migrations to the remote D1 database |
| `bun run cf-typegen` | Regenerate `worker-configuration.d.ts` from Wrangler |

## Testing

Tests run inside the Workers runtime with a real (in-memory) D1 database
created from the migrations in `drizzle/`.

- `tests/isolation/` — HTTP-level feature and data-isolation tests
- `tests/unit/` — unit tests (e.g. OpenRouter client)
- `tests/auth.test.ts`, `tests/dashboard.test.ts`, `tests/export.test.ts` — endpoint tests

```bash
bun run test
```

## Project Structure

```
src/
  client/                  # React SPA
    app/                   # router, layout, auth guard, providers
    components/            # shared + shadcn-style UI primitives
    features/              # auth, dashboard, brag-logs, notes,
                           # workspaces, tags, sparks, settings, landing
    lib/                   # api client, filter params, utils
  shared/schemas/          # Zod schemas shared by client and worker
  worker/                  # Hono API on Cloudflare Workers
    features/              # one route module per domain
    middleware/            # auth + rate limiting
    db/                    # Drizzle client and schema
    lib/                   # OpenRouter client
    index.ts               # app entry, route mounting
drizzle/                   # generated SQL migrations
tests/                     # vitest suites
docs/                      # OAuth and deployment guides
tasks/                     # CI/CD guide and backlog
wrangler.jsonc             # Worker, D1, R2, assets config
```

## Architecture Notes

- **Single Worker, two runtimes.** `@cloudflare/vite-plugin` serves the React
  SPA as static assets and runs the Hono API in the Worker. `run_worker_first`
  ensures `/api/*` is handled by the Worker before the SPA fallback.
- **Shared schemas.** `src/shared/schemas` are imported by both the client and
  the worker, so request/response shapes stay in sync.
- **Per-user isolation.** Every query is scoped by `userId` from the session;
  foreign keys use `ON DELETE CASCADE` so deleting a user or workspace removes
  owned rows.
- **Rate limiting.** Auth endpoints are limited to 10 requests/min per IP; the
  AI STAR breakdown endpoint likewise.
- **AI safety.** The STAR generator uses a strict system prompt (first-person,
  no invented facts) and Zod-structured output; suggested tag IDs are filtered
  against the user's actual tags.

## API Overview

All routes are prefixed with `/api`. Except for the auth and health routes,
requests require a valid session cookie.

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/auth/google` | Start Google OAuth flow |
| GET | `/auth/google/callback` | OAuth callback, sets session cookie |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/me` | Current user |
| DELETE | `/auth/account` | Delete account and owned data |
| GET/POST | `/workspaces` | List or create workspaces |
| GET/PUT/DELETE | `/workspaces/:id` | Read/update/delete a workspace |
| GET/POST | `/tags` | List or create tags |
| PUT/DELETE | `/tags/:id` | Update/delete a tag |
| GET/POST | `/brag-logs` | List (filter/search/paginate) or create |
| POST | `/brag-logs/star-breakdown` | AI-generate a STAR entry |
| GET/PUT/DELETE | `/brag-logs/:id` | Read/update/delete a brag log |
| GET/POST | `/notes` | List or create notes |
| GET/PUT/DELETE | `/notes/:id` | Read/update/delete a note |
| GET | `/dashboard` | Counts and recent workspaces |
| GET | `/dashboard/recent` | Recent activity feed |
| GET/POST | `/sparks` | List (filter/search/paginate) or create sparks |
| GET | `/sparks/random` | Recall a random open spark |
| GET/PUT/DELETE | `/sparks/:id` | Read/update/delete a spark |
| POST | `/sparks/:id/attachments` | Upload an image attachment (multipart) |
| POST | `/notes/:id/attachments` | Upload an image attachment (multipart) |
| GET/DELETE | `/attachments/:id` | Owner-checked image proxy / delete |
| GET | `/export/brag-logs` | Export brag logs as Markdown |
| GET | `/health` | Health check |

## Deployment

Deployment to Cloudflare Workers is documented in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). CI/CD runs typecheck, tests, remote
D1 migrations, and deploy on every push to `main` via
[.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## License

Private project. All rights reserved.

# Foundation & App Shell

## Purpose

Turn the fresh better-t scaffold into the named, observable, deployable skeleton every feature builds on: workspace naming, env validation, API module structure, the SPA shell with the three routes, and the public landing page skeleton.

## Owns

- Workspace rebrand: `@wandit/*` → `@wandit/*` (product name: **Wandit**).
- `packages/env` schemas for every surface (server, worker, web, edge).
- `packages/contracts` (new): shared Zod API contracts + types between web and server.
- `apps/server` base: Nest module layout, Fastify adapter config, CORS, global validation, `/health`, versioned `/api` prefix, Sentry.
- `apps/worker` base: BullMQ connection wiring, Sentry, graceful shutdown.
- `apps/web` shell: TanStack Router file routes (`/`, `/dashboard`, `/p/$projectId`) with lazy chunks, TanStack Query provider, base layout + theme, Sentry.
- Public landing page skeleton: hero prompt box (state only), examples grid, pricing section (static).
- Deploy config: Cloudflare Pages (SPA fallback) for web; Dockerfiles for server/worker.

## Working model

Everything here is scaffolding for vertical slices — no product tables, no business endpoints. The landing page's prompt box stores the prompt in React state and hands off to Auth (modal) and Projects (auto-create); those integrations are stubs behind interfaces until their features land. `/` must stay a light chunk: workspace code loads only on `/p/*`.

## Does not own

- Auth flow and modal internals (→ auth-accounts).
- Any product DB tables (each vertical slice owns its own).
- The Cloudflare edge worker (→ publishing-serving).

## Issue breakdown

### 1. Rebrand + backend/platform foundation

Rename the workspace scope everywhere (package.json files, imports, lockfile). Flesh out `packages/env` (server/worker/web/edge schemas; fail-fast). Create `packages/contracts` with a first shared schema + error envelope convention. Structure `apps/server`: config module, `/api` prefix, CORS for the app origin, global Zod/class-validator pipe, `/health`, Sentry init. Wire `apps/worker`: shared BullMQ connection from env, Sentry, graceful shutdown. Dockerfiles for both.

**Acceptance criteria**
- `pnpm dev` boots web + server + worker with validated envs; missing env fails fast with a clear message.
- No `wandit` string remains; `pnpm check-types` and `biome check` pass.
- `GET /api/health` returns ok from the server; worker connects to Redis and registers no-op queue.
- Sentry receives a test event from server and worker.

### 2. Web SPA shell + public landing skeleton

TanStack Router file routes for `/`, `/dashboard`, `/p/$projectId` with lazy chunks (verify `/` bundle stays light). TanStack Query provider + typed API client reading `packages/contracts`. Base layout: header (logo → dashboard), theme, toaster. Landing page: hero prompt box (React state + textarea UX), examples grid placeholder, pricing section placeholder. Cloudflare Pages config with SPA fallback. Sentry web init.

**Acceptance criteria**
- The three routes render; `/p/*` code is in a separate chunk (checked via build output).
- Prompt box holds state and exposes an `onSubmit(prompt)` handoff point.
- Deployed preview on Cloudflare Pages serves deep links via SPA fallback.

**Files:** root `package.json`, `apps/server/src/**`, `apps/worker/src/**`, `apps/web/src/routes/**`, `packages/env/src/**`, `packages/contracts/**`, Dockerfiles.

Source docs: docs/PRD.md, docs/features/foundation-app-shell.md

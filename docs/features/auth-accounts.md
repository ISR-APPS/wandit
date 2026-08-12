# Auth & Accounts

## Purpose

Google-only sign-in that keeps the prompt-first funnel intact: an auth modal overlays any route, launches Better Auth's full-page Google redirect, and lands the user on the dashboard. A prompt typed before sign-in is restored there and generation starts without a second click.

## Owns

- Better Auth configuration in `packages/auth`: Google social provider, Drizzle adapter, auth tables in Postgres, trusted origins, and the signup `databaseHooks.user.create.after` hook other features can subscribe to later.
- Auth schema tables (`user`, `session`, `account`, `verification`) + migration.
- Mounting Better Auth on the Fastify server under `/api/auth/*`.
- Server auth infrastructure: global Nest `APP_GUARD`, `@Public()` opt-out, `@CurrentUser()` decorator, and `GET /api/v1/auth/me`.
- API endpoint security conventions live in `docs/api-security.md`; Auth owns the guard, endpoint slices own the checklist.
- Web: auth modal over any route, a single Continue-with-Google button, full-page redirect handling, session state via the Better Auth React client, account menu, and sign-out.
- Prompt stash: a **one-shot sessionStorage stash** used to hand a signed-out landing prompt to the dashboard after auth. The dashboard restores the draft, creates the project, and starts generation. Image-animation drafts that still need a source still stay as prefill only. The stash is consumed after that handoff, on modal dismiss, and on auth errors.

## Working model

Better Auth handles all auth routes under `/api/auth/*`; our API never re-implements auth logic. The web app opens a modal from any route, but Google sign-in is a full-page redirect. By default the callback lands on `/dashboard`; guarded-route recovery and 401 handling may pass a sanitized internal `next` path so the user returns to the route they were trying to access.

When a signed-out visitor submits a prompt, the prompt is written to the one-shot sessionStorage stash before opening the modal. After Google (or email) returns, the dashboard consumes the stash, restores it into the prompt box, creates the project, and starts generation. The user does not click Generate again. Image-animation drafts that still need a source still are restored as prefill only. If the modal is dismissed before redirect, or if Google returns an error, the stale stash is consumed.

Signup fires a Better Auth database hook so future features can subscribe to account creation. Credits will grant the free starting balance there; Auth only exposes the hook.

## Does not own

- Project creation from the restored prompt (→ projects-dashboard).
- The signup credit grant amount/logic (→ credits; Auth only exposes the hook).
- Organizations/teams — post-MVP Business plan (Better Auth organizations plugin).
- Non-Google sign-in methods or a dedicated `/login` page.

## Issue breakdown

### 1. Better Auth backend: config, schema, Nest guard

Configure Better Auth in `packages/auth` with the Drizzle adapter and Google provider. Generate + migrate auth tables in `packages/db`. Mount the handler on Fastify. Implement the global `AuthGuard` as a Nest `APP_GUARD`, with `@Public()` for unauthenticated endpoints and `@CurrentUser()` for protected handlers. Expose `GET /api/v1/auth/me` for the web client and a signup hook for other modules.

**Acceptance criteria**
- Google sign-in produces a session persisted in Postgres.
- Public endpoints remain reachable through `@Public()`.
- Protected endpoints return 401 without a session, 200 with one, and receive the typed user via `@CurrentUser()`.
- `GET /api/v1/auth/me` returns the current user shape expected by the shared auth contract.
- Auth cookies are httpOnly, secure in production, and scoped with CORS credentials working from the app origin.
- A future Credits grant can subscribe to account creation through the Better Auth signup hook.

### 2. Auth modal + funnel integration (web)

Auth modal renders above any route with one Continue-with-Google button. Better Auth React client is wired for session state and invalidation. Account menu shows avatar/session actions and sign-out returns to `/`. Prompt stash writes before auth, survives the Google redirect, is consumed once by the dashboard, and is cleaned up when it becomes stale.

**Acceptance criteria**
- Typing a prompt while signed out → modal → Google redirect → `/dashboard` creates the project and starts generation without a second click.
- Image-animation drafts that still need a source still restore as prefill only; the user adds the still and clicks Generate.
- Guard/401 recovery may return to a sanitized internal `next` path instead of `/dashboard`.
- Dismissing the modal before redirect clears any stale prompt stash.
- Session persists across reloads; sign-out clears state and returns to `/`.

**Files:** `packages/auth/src/**`, `packages/db/src/schema/auth.ts`, `apps/server/src/modules/auth/**`, `apps/web/src/features/auth/**`, `packages/contracts/src/v1/auth.ts`.

Source docs: docs/PRD.md, docs/features/auth-accounts.md

# Auth & Accounts

## Purpose

Sign-in that never breaks the prompt-first funnel: an auth modal + Google OAuth popup overlaying any route (magic link as fallback), with the typed prompt surviving the whole flow.

## Owns

- Better Auth configuration in `packages/auth`: Google social provider (popup-first) + magic link plugin, Drizzle adapter (auth tables in our Postgres).
- Auth schema tables (`user`, `session`, `account`, `verification`) + migration.
- Mounting Better Auth on the Fastify server; Nest `AuthGuard` + `@CurrentUser()` decorator for protected endpoints.
- Web: auth modal (overlay on any route), Google popup flow, magic-link email form + "check your email" state, session state via the Better Auth React client, account menu (avatar, sign out).
- Prompt stash: React state through the popup flow; **one-shot sessionStorage stash** for redirect flows (magic link) — replayed once after auth, then cleared.

## Working model

Better Auth handles all auth routes under `/api/auth/*`; our API never re-implements auth logic. Google uses the popup flow so the SPA (and the typed prompt in React state) never unloads. Magic links necessarily redirect, so before sending the email we stash the prompt in sessionStorage; on the post-auth landing, the shell checks the stash, replays it into the project-creation flow (owned by Projects), and clears it. Signup fires a hook other features subscribe to (Credits grants the free balance there).

## Does not own

- Project auto-creation from the replayed prompt (→ projects-dashboard).
- The signup credit grant amount/logic (→ credits; Auth only emits the hook).
- Organizations/teams — post-MVP Business plan (Better Auth organizations plugin).

## Issue breakdown

### 1. Better Auth backend: config, schema, Nest guard

Configure Better Auth in `packages/auth` with the Drizzle adapter, Google provider, and magic link plugin (email provider TBD — suggest Resend; **ask before adding the dependency**). Generate + migrate auth tables in `packages/db`. Mount the handler on Fastify. Implement `AuthGuard` (session lookup from cookie) + `@CurrentUser()` decorator. Expose a signup hook for other modules.

**Acceptance criteria**
- Google sign-in and magic-link sign-in both produce a session persisted in Postgres.
- A protected test endpoint returns 401 without a session, 200 with one, and receives the typed user.
- Auth cookies are httpOnly, secure, and scoped to the API domain with CORS credentials working from the app origin.

### 2. Auth modal + funnel integration (web)

Auth modal rendered above any route: Google button (popup flow) and magic-link email form with sent-state. Better Auth React client wired for session state (query invalidation on change). Account menu with avatar + sign out. Prompt stash: keep prompt in React state through the popup; sessionStorage one-shot stash + replay for magic-link redirects (cleared after replay). Expose `requireAuth(then)` so the prompt box can trigger the modal and continue the flow after success.

**Acceptance criteria**
- Typing a prompt while signed out → modal → Google popup → back with session, prompt intact, continuation callback fired.
- Magic-link path: stash survives the redirect, replays exactly once, and is cleared from sessionStorage.
- Session persists across reloads; sign-out clears state and returns to `/`.

**Files:** `packages/auth/src/**`, `packages/db/src/schema/auth.ts`, `apps/server/src/modules/auth/**`, `apps/web/src/features/auth/**`.

Source docs: docs/PRD.md, docs/features/auth-accounts.md

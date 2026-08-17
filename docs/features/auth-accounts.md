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
- Prompt stash: a **one-shot sessionStorage stash** used to hand a signed-out landing prompt to the dashboard after auth. The dashboard restores the draft and, when the stash marked it autostart-eligible and it is still fresh (30-minute TTL — wide enough to cover the mandatory post-signup onboarding), creates the project and starts generation. Drafts that need inputs the redirect cannot carry (attachments, source stills) and video drafts (whose higher price the landing hero never showed) restore as prefill only. The stash is consumed after that handoff, on modal dismiss (unless a Google redirect or a sent magic link is still pending), on auth errors, and cleared on sign-out; the TTL bounds every other leftover, so a stale draft can only ever prefill.

## Working model

Better Auth handles all auth routes under `/api/auth/*`; our API never re-implements auth logic. The web app opens a modal from any route, but Google sign-in is a full-page redirect. By default the callback lands on `/dashboard`; guarded-route recovery and 401 handling may pass a sanitized internal `next` path so the user returns to the route they were trying to access. The landing route itself also redirects signed-in visitors: `/` sends an authenticated user to `/dashboard` (or `/onboarding` while onboarding is incomplete), except when `?auth=` is present (the error/required flows must render the modal) or the visit targets a section hash like `/#pricing`.

When a signed-out visitor submits a prompt, the prompt is written to the one-shot sessionStorage stash before opening the modal, together with an autostart-eligibility flag and a timestamp. After Google or OTP completes (both finish in the tab that holds the stash), the dashboard consumes the stash, restores it into the prompt box, and — for fresh eligible drafts — creates the project and starts generation without a second click. A magic link completes in whichever tab opens it: the origin tab keeps its stash while the link is pending (dismissing the modal does not clear it for the link's 10-minute lifetime, including after a client-side Google error or a Back from the consent screen; a full reload of that tab or a server-side auth error ends the pending state), so returning there and visiting the dashboard within the TTL still autostarts; a link opened in another tab, browser, or profile lands on a normal dashboard (sessionStorage is per-tab). Known trade-off: if the user re-types the same prompt in that other tab and then visits the dashboard in the origin tab within the TTL, the origin tab creates a second project. Ineligible drafts (attachments, source stills, video mode) and drafts older than the 30-minute TTL restore as prefill only — the user reviews and clicks Generate. If the modal is dismissed with no auth handoff pending, or if auth returns an error, the stale stash is consumed. Every autostart that does not create (signed-out settle, balance error, refused create, in-app navigation away mid-wait) re-stashes the draft as prefill-only, so a later reload or re-auth still restores it and nothing can bill it twice (a hard reload during the short wait itself, before any of those paths run, loses the draft — same as base). Prefill-only drafts (ineligible, stale, or written by another app version) are consumed at first dashboard render and are not re-stashed, so they do not survive a reload either — also same as base. A server-side 402 during autostart behaves as on a manual submit: the global billing interceptor opens the upgrade modal; the hook itself adds no toast.

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
- Drafts with attachments or a source still, video drafts, and drafts older than the 30-minute autostart TTL restore as prefill only; the user completes them and clicks Generate.
- Guard/401 recovery may return to a sanitized internal `next` path instead of `/dashboard`.
- Dismissing the modal with no Google redirect or sent magic link pending clears any stale prompt stash.
- Session persists across reloads; sign-out clears state (including the prompt stash) and returns to `/`.

**Files:** `packages/auth/src/**`, `packages/db/src/schema/auth.ts`, `apps/server/src/modules/auth/**`, `apps/web/src/features/auth/**`, `packages/contracts/src/v1/auth.ts`.

Source docs: docs/PRD.md, docs/features/auth-accounts.md

# V1 inspection: auth, workspaces, billing, credits, metering

Report id: `auth-billing-credits`
Worktree: `.claude/worktrees/v2-builder` (branch `feat/v2-builder`, same as `dev` at `1b2a9a1e`).
Date: 2026-09-03.

All file paths are repo-relative. Line numbers come from the worktree at the date above.
Statements that I could not check in code or in a document carry the tag **UNVERIFIED**.

---

## 0. Scope and method

I read these areas:

- `packages/auth/src/**` (Better Auth server config, permissions).
- `apps/server/src/modules/{auth,workspaces,billing,credits,metering,onboarding,settings}/**`.
- `packages/db/src/schema/{auth,organizations,credits,billing,monthly-costs,onboarding,user-activity}.ts`.
- `packages/contracts/src/v1/{billing,credits,settings,workspaces,ai-chat,chats}.ts`.
- The call sites that use `MeteringService` (chat, project creation, page build, builder media children, Trigger.dev sweeps).
- Docs: `docs/features/auth-accounts.md`, `billing.md`, `billing-v2-subscriptions-credits-affiliates.md`, `credits.md`, `pricing-v4-fractional-credits.md`, `pricing-v5-usd-anchor.md`, `pricing-v6-starter-plan.md`, `teams-workspaces.md`, `admin-permissions.md`, and the head of `manual-billing.md`.

I did not run code. I did not use the network.

Library versions that matter (from `pnpm-workspace.yaml` and `apps/server/package.json`):

| Library | Version | Evidence |
|---|---|---|
| `better-auth` | 1.6.22 | `pnpm-workspace.yaml:35` |
| `@better-auth/expo` | 1.6.22 | `pnpm-workspace.yaml:42` |
| `ai` (Vercel AI SDK) | ^7.0.19 | `apps/server/package.json:45` |
| `@ai-sdk/gateway` | 4.0.15 | `apps/server/package.json:23` |
| `stripe` | ^20.4.1 | `apps/server/package.json:62` |
| `@trigger.dev/sdk` | 4.5.3 | `apps/server/package.json:37` |

---

## 1. Short summary

- Auth is Better Auth 1.6.22 with a Drizzle/Postgres adapter. Sign-in methods are Google OAuth, magic link, and email OTP. Both email methods sit behind a product toggle (`emailAuthEnabled`) and Cloudflare Turnstile. The native app uses the Expo plugin. There are two Better Auth instances: one for users (`/api/auth`) and one for staff (`/api/admin-auth`).
- A "workspace" is the personal space (implicit) or a Better Auth organization. The `x-wandit-workspace` request header is the only scope source. Roles are fixed: `owner`, `admin`, `member`.
- Credits live in an append-only ledger in integer centi-credits (1 credit = 100 cc). Balance = `sum(delta)`. Three buckets: `plan`, `promo`, `topup`. Spend order: plan, then promo, then topup.
- One credit = $0.04 of AI-provider cost (`AI_USD_PER_CREDIT`). The server converts provider USD micros to centi-credits with round-up and a 1 cc minimum.
- Every AI action follows reserve -> settle -> reconcile (or refund). Each action is an `ai_usage_events` row. Reserve debits the ledger before provider work. Settle debits or refunds the difference. Reconcile fetches the exact cost from the AI Gateway by generation id and corrects the charge.
- Plans: Starter ($8/mo, 50 credits, personal), Pro (9 tiers from 175 credits/$25, personal), Business (same tiers, 2x Pro, organizations). Yearly = 10x monthly. Top-ups are disabled. Stripe is the payment provider. Manual (offline) subscriptions exist for Algeria.
- Limits: reserve floors, per-event sanity ceilings, an "any positive balance admits" rule, 3 concurrent streams per actor, per-member monthly credit limits in organizations, and many product-setting kill switches.
- V2 must add: a long-running "agent session" operation with incremental settlement, sandbox-minute metering, backend-provisioning charges, and a per-project hard cap. The ledger, credit owner model, billing, and sweeps can be reused as they are.

---

## 2. Auth

### 2.1 Better Auth server configuration

File: `packages/auth/src/index.ts`.

**Adapter and schema.** The Drizzle adapter receives a merged schema object `{ ...authSchema, ...orgSchema }` (line 44). The organization plugin looks up models by export name (`organization`, `member`, `invitation`), so the merge is required (lines 41-43).

**Base options** (`createBaseAuthOptions`, lines 179-236):

- Cookie policy: on https deployments the code sets `sameSite` and `secure: true` explicitly (lines 200-219). `resolveAuthCookieSameSite` decides `lax` (production: one site) or `none` (a cross-site web origin, for example a `vercel.app` feature-branch preview; staging itself is on `preview.wandit.dev` and same-site since a check on 2026-09-07). Local http keeps Better Auth defaults.
- Trusted proxies come from `TRUSTED_PROXY_CIDRS` (lines 184-187, 220).
- `account.encryptOAuthTokens: true` (line 222).
- `rateLimit.storage: "database"` as the fallback limiter (lines 232-234). The `rate_limit` table is in `packages/db/src/schema/auth.ts:148-162`.
- `disabledPaths` removes every HTTP route of the admin plugin (lines 52-68) and the password-reset/email-change routes of the email-otp plugin (lines 73-81). The NestJS admin controllers serve those functions instead.

**User instance** (`createAuth`, lines 405-769):

- `basePath: "/api/auth"` (line 429).
- When the server injects `secondaryStorage` (Redis), rate limiting moves to `rateLimit.customStorage` with atomic `INCR` (lines 430-435, 273-329). Sessions stay in Postgres (`storeSessionInDatabase: true`, line 440). A cookie cache is enabled with `maxAge: 300` seconds and `strategy: "compact"` (lines 445-449). Verification rows stay in the database (line 451). The comment at lines 436-438 explains why root `secondaryStorage` is not used in 1.6.22.
- Session lifetime (`session.expiresIn`, `updateAge`) is not set in this file. Better Auth defaults apply. **UNVERIFIED**: the default values in 1.6.22.
- User additional fields: `displayEmail` and `onboardingCompletedAt`, both `input: false` (lines 454-468).
- Trusted origins: CORS web origins, `wandit://`, `exp://`, and Expo dev origins only when the API runs on localhost (lines 476-483).
- Social provider: Google only (lines 484-486, 371-403). `accessType: "offline"`. `mapProfileToUser` canonicalizes the email and stores the raw spelling as `displayEmail`.
- Hooks (`hooks.before`, lines 501-573): pins the Expo authorization proxy target (lines 506-513); canonicalizes the email on `/sign-in/magic-link`, `/email-otp/send-verification-otp`, `/sign-in/email-otp`, and `/organization/invite-member`; rejects OTP types other than `sign-in`; checks `emailAuth.isEnabled`, `isDeliverable`, and `guardSend` (per-email and per-IP caps, disposable-domain blocklist) before any send. `hooks.after` (lines 574-619) refreshes `displayEmail` after an OTP sign-in and reissues the session cookie.
- Database hooks (lines 622-631): `user.create.before` re-injects the display email from OAuth state; `user.create.after` runs `onUserCreated`.

**Plugins** (lines 632-767):

| Plugin | Config | Lines |
|---|---|---|
| `expo()` | default | 633 |
| `admin` | `defaultRole: "user"`, `adminRoles: ["admin"]`; kept for schema fields only | 634 |
| `organization` | `ac`/`roles` from `permissions.ts`; `allowUserToCreateOrganization` delegates to `canCreateOrganization` (default: closed); `creatorRole: "owner"`; `requireEmailVerificationOnInvitation: true`; `membershipLimit: 10_000`; `disableOrganizationDeletion: true`; `invitationExpiresIn: 7 days`; `cancelPendingInvitationsOnReInvite: true`; analytics hooks; `sendInvitationEmail` -> `onInvitationCreated` | 635-707 |
| `magicLink` | `storeToken: "hashed"`, `expiresIn: 600 s`; the emailed link is rewritten to the web origin (`email-magic-link-url.ts:18-46`) | 712-733 |
| `emailOTP` | `storeOTP: "hashed"`, `otpLength: 6`, `expiresIn: 600 s`, `allowedAttempts: 3`, sign-in type only | 734-750 |
| `captcha` | Cloudflare Turnstile on the two send endpoints, only when `TURNSTILE_SECRET_KEY` is set | 755-766 |

**Expo plugin details.** `packages/auth/src/expo-authorization-proxy.ts:18-68` guards `GET /api/auth/expo-authorization-proxy`. The proxy may only redirect to `accounts.google.com` with our `client_id` and our `redirect_uri`. This closes an open redirect and a state-fixation hole in the plugin.

**Email canonical form.** `packages/auth/src/email-canonical.ts:24-37`: trim, lowercase, drop one `+suffix`, and for gmail drop dots and normalize the domain. One inbox = one user row.

### 2.2 Admin (staff) auth instance

`createAdminAuth` (`packages/auth/src/index.ts:771-828`):

- `basePath: "/api/admin-auth"`, `cookiePrefix: "wandit-admin"`, in-memory rate limit, trusted origin = `ADMIN_ORIGIN` only.
- Google with `disableImplicitSignUp` and `disableSignUp` (no new accounts).
- `session.create.before` hook rejects users whose stored role is not a staff role (`isStaffRole`, lines 797-817). Error code `ADMIN_ACCESS_REQUIRED`.
- Plugin: `admin` with `adminAccessControl`/`adminRoles` from `admin-permissions.ts`.

### 2.3 Server integration (NestJS)

File: `apps/server/src/modules/auth/auth.module.ts`.

- `AUTH_INSTANCE` is built by a factory (lines 64-221). It injects `canCreateOrganization` (reads `organizationsEnabled`, lines 95-98), `emailAuth` (reads `emailAuthEnabled`, `EmailService`, `EmailSendPolicyService`, lines 100-111), invitation hooks (lines 116-160), and `onUserCreated` (lines 166-218).
- `onUserCreated` order: affiliate attribution lock, UTM attribution lock, analytics `user_signed_up`, lifecycle event `signup_completed`, signup credit grant (`SignupGrantsService.handleUserCreated`), then admin bootstrap from `ADMIN_EMAILS` (lines 167-218).
- Global guards in this order: `CrossSiteWriteGuard` (CSRF), then `AuthGuard` (lines 256-267). `WorkspaceContextGuard` follows in `WorkspacesModule` (section 3.2).
- `onModuleInit` promotes existing users named in `ADMIN_EMAILS` to `admin`; it never demotes (lines 280-310).

`AuthGuard` (`apps/server/src/modules/auth/presentation/http/guards/auth.guard.ts:60-112`):

- Skips `@Public()` routes.
- Picks the user or admin Better Auth instance from route metadata (`AUTH_SURFACE_KEY`), never by fallback (lines 77-81).
- Calls `auth.api.getSession` with web headers. No session -> 401.
- Active ban -> 401 (lines 96-98, 141-147). A ban can stay in the 5-minute cookie cache; the admin ban flow deletes session rows.
- Refreshes `user.last_seen_at` at most every 5 minutes with raw SQL (lines 122-138), records daily activity (`UserActivityService`), and sets the Sentry user.

`GET /api/v1/auth/me` returns id, name, email, emailVerified, image, normalized role, timestamps (`me.controller.ts:7-21`).

Redis rate-limit storage: `better-auth-redis-secondary-storage.ts`. Keys are prefixed `better-auth:rate-limit:` (line 12). A Lua script does `INCR` with a fixed TTL (lines 16-22). Every operation has a 500 ms timeout and fails open (lines 92-158).

### 2.4 Clients

- Web (`apps/web/src/features/auth/lib/auth-client.ts:17-60`): `createAuthClient` with `inferAdditionalFields`, `adminClient`, `magicLinkClient`, `emailOTPClient`, and `organizationClient({ ac, roles })`. The `onRequest` hook injects the affiliate token into sign-up requests.
- Native (`apps/native/lib/auth-client.ts:8-29`): `createAuthClient` with `inferAdditionalFields` and `expoClient({ scheme, storagePrefix, storage: SecureStore })`.

### 2.5 Auth tables

File: `packages/db/src/schema/auth.ts`.

| Table | Notes | Lines |
|---|---|---|
| `user` | `email` unique (canonical), `displayEmail`, `role` (comma-joined multi-role text, default `user`), `earlyAccess`, `onboardingCompletedAt`, `banned`/`banReason`/`banExpires`, `lastSeenAt` | 14-56 |
| `session` | `token` unique, `ipAddress`, `userAgent`, `impersonatedBy`, `activeOrganizationId` (never read by the API for scoping) | 58-84 |
| `account` | OAuth account per provider; unique `(providerId, accountId)` | 86-123 |
| `verification` | magic link / OTP tokens (hashed) | 125-141 |
| `rate_limit` | Better Auth database limiter | 148-162 |
| `auth_email_sends` | per-email and per-IP send audit for abuse caps | 167-198 |

Other user-owned tables: `user_onboarding` (`onboarding.ts:5-23`), `user_activity_days` (`user-activity.ts:11-26`).

### 2.6 Onboarding

`OnboardingService.complete` (`apps/server/src/modules/onboarding/application/services/onboarding.service.ts:22-59`) stores answers in `user_onboarding`, sets `user.name`, and sets `user.onboardingCompletedAt` once (`onboarding.repository.ts:23-58`). The web routes users with a null `onboardingCompletedAt` to `/onboarding` (`docs/features/auth-accounts.md:20`).

### 2.7 Staff permissions

File: `packages/auth/src/admin-permissions.ts`.

- One statement per admin dashboard section (lines 10-24): `overview`, `users`, `organizations`, `billing`, `publications`, `feedback`, `affiliates`, `links`, `costs`, `academy`, `analytics`, `conversations`, `settings`.
- Roles: `admin` (everything) and `support` (default eight views with safe actions) (lines 55-104).
- `staffHasPermission` builds a Better Auth role from the stored view grants (`admin_view_grants` table) and evaluates it (lines 125-141).
- The NestJS `AdminGuard` and `@AdminPermission` enforce this (`docs/features/admin-permissions.md:133-173`). Non-staff get 404. Staff without permission get 403 `ADMIN_PERMISSION_REQUIRED`.

---

## 3. Workspaces (organizations)

### 3.1 Roles and permissions

File: `packages/auth/src/permissions.ts`.

- Statement (lines 15-24): Better Auth defaults plus `project: [create, update, delete]`, `publish: [manage]`, `domain: [manage]`, `billing: [manage]`, `limits: [manage]`.
- Roles (lines 28-55):
  - `owner`: everything.
  - `admin`: everything except `billing:manage` and organization delete. Money is owner-only by product decision (comment at lines 40-42).
  - `member`: `project: [create, update]`, `publish: [manage]`.
- `workspaceRoleHasPermission` splits the comma-joined role string and passes when any role grants all requested actions (lines 71-85).

### 3.2 Request scoping

- Header constant `WORKSPACE_HEADER = "x-wandit-workspace"`, `PERSONAL_WORKSPACE = "personal"` (`packages/contracts/src/v1/workspaces.ts:10-12`).
- `WorkspaceContextGuard` (`apps/server/src/modules/workspaces/presentation/http/guards/workspace-context.guard.ts:51-163`): skips `@Public()`; reads the header; for an org value loads the caller's `member` row; a non-member gets 404; attaches `request.workspace`; enforces `@PersonalWorkspaceOnly`, `@RequireOrgWorkspace`, and `@RequireWorkspacePermission(resource, ...actions)`. Personal scope bypasses role checks (lines 149-153).
- The guard is registered as `APP_GUARD` after `AuthGuard` (`workspaces.module.ts:17-19, 35-38`).
- Decorators: `workspace.decorators.ts:15-69`.
- The session's `activeOrganizationId` is never used for scoping (`packages/db/src/schema/auth.ts:79-82`, `workspace-context.ts:3-7`).

### 3.3 Tables

File: `packages/db/src/schema/organizations.ts`.

| Table | Notes | Lines |
|---|---|---|
| `organization` | `slug` unique; `metadata` is text JSON | 21-38 |
| `member` | unique `(organizationId, userId)`; `role` comma-joined text, default `member` | 40-71 |
| `invitation` | `status`, `expiresAt`, `inviterId` | 73-99 |
| `organization_billing_settings` | `defaultMemberMonthlyCreditLimit` (centi-credits, NULL = unlimited) | 106-132 |
| `organization_member_credit_limits` | per-member `monthlyCreditLimit` (centi-credits) | 137-170 |

### 3.4 Credit owner and metering subject

File: `apps/server/src/modules/credits/domain/credit-owner.ts`.

- `CreditOwner = { type: "user", userId } | { type: "org", organizationId }` (lines 7-9).
- Advisory lock value: raw `userId` for personal, `org:<id>` for org (lines 43-47). This is a compatibility invariant.
- `ownerColumns(owner)` gives the column pair for pool-owned rows (lines 59-66).
- `MeteringSubject = { actorUserId, organizationId?, actorIsLimitExempt? }` (lines 85-89). `subjectPayer(subject)` returns the org when set, else the user (lines 91-93).
- `ProjectScope` and `meteringSubjectFrom` (`apps/server/src/modules/projects/domain/project-scope.ts:16-70`): owners and admins get `actorIsLimitExempt: true` (lines 36-37).

### 3.5 Member limits

- `OrganizationLimitsRepository.resolveMemberLimit` (`organization-limits.repository.ts:61-100`): explicit member row binds anyone; org default binds non-exempt members; NULL = unlimited.
- `sumMemberSpendThisMonth` (lines 197-220): `SUM(COALESCE(final_credits, reserved_credits))` over `ai_usage_events` for `(organizationId, userId)` since the first day of the UTC month.
- Limit writes take the org credit advisory lock so they serialize with in-flight reserves (lines 48-59; `member-limits.service.ts:88-92`).
- API: `GET/PUT /api/v1/workspace/member-limits`, org scope + `limits:manage` (`member-limits.controller.ts:21-24`). The API uses whole credits; storage uses centi-credits (`member-limits.service.ts:47-49, 90-92`).

---

## 4. Credits ledger

### 4.1 Units and tables

File: `packages/db/src/schema/credits.ts`.

- Unit: integer **centi-credits** (1 cc = 0.01 credit). Migration 0038 rescaled old rows x100 (comment at lines 72-76). Contracts convert once at the API boundary: `centiCreditsToCredits` and `creditsToCentiCredits` (`packages/contracts/src/v1/credits.ts:44-54`).
- `credit_kind`: `grant`, `consume`, `topup`, `expire`, `revoke` (lines 24-30). A CHECK enforces the sign per kind (lines 109-112).
- `credit_bucket`: `plan`, `promo`, `topup` (line 32). Spend order `CREDIT_SPEND_ORDER = [plan, promo, topup]` (`contracts/v1/credits.ts:27`).
- `credit_ledger` (lines 55-118): `userId` and/or `organizationId` (CHECK: one present), `bucket`, signed `delta`, `kind`, unique `idempotencyKey`, `meta` jsonb. Append-only. Balance = `sum(delta)`.
- `credit_plan_hold_pools` (lines 134-172) and `credit_plan_holds` (lines 181-228): refundable plan entitlement for a reservation across a refill boundary (rollover cap logic).
- `ai_usage_events` (lines 259-355): one row per metered operation. Columns: actor `userId` (NOT NULL), payer `organizationId` (nullable), `operation` enum, `parentEventId`, `status` enum (`reserved`, `settled`, `reconciled`, `refunded`, `reconcile_failed`), `model`, `provider`, `reservedCredits`, `finalCredits`, `estimatedCostUsdMicros`, `reconciledCostUsdMicros`, four token columns, `rawUsage`, `pricingSnapshot`, `chatId`, `messageId`, `attemptRef`, unique `idempotencyKey`, `executionLeaseToken`/`executionLeaseExpiresAt`, `reconcileAttempts`, `nextReconcileAttemptAt`, `settledAt`, `reconciledAt`.
- `ai_usage_generation_refs` (lines 357-378): one row per AI Gateway or OpenRouter generation id (`providerSource`), with `stepUsage` and reconciled cost.
- `ai_provider_call_evidence` (lines 410-458): receipts for non-gateway providers (`transport` enum: `vercel`, `openrouter`, `serper`, `higgsfield`, `mcp`; `costStatus`: `measured`, `contract_rate`, `estimated`, `pending`; `units`, `chargedUsdMicros`, `rateUsdMicrosPerUnit`, `customerBillable`).
- `model_prices` (lines 460-480): per-model rates in USD micros per million tokens, per image, per video second, per transcription second, plus variant pricing.

### 4.2 CreditsService

File: `apps/server/src/modules/credits/application/services/credits.service.ts`.

- `consume(owner, amount, options, tx?)` (lines 138-267):
  - Admission modes: `admission: "requirePositiveBalance"` admits the full amount when balance > 0 (the remainder overdrafts); `allowOverdraft: true` always admits; default refuses when balance < amount (lines 178-186). Refusal is `InsufficientCreditsError` (HTTP 402, code `INSUFFICIENT_CREDITS`, `insufficient-credits.error.ts:10-31`).
  - Splits the amount over buckets in spend order and writes one consume row per bucket with key `<idempotencyKey>:<bucket>` (lines 188-229).
  - Idempotent replays compare a fingerprint in `meta` (lines 154-176).
  - Locks: operation lock on the idempotency key, then the owner lock (lines 255-266).
  - `planHold: "active"` creates a `credit_plan_holds` row (lines 244-250).
- `refundConsume` (273-321) and `refundConsumeAmount` (328+) write compensating `grant` rows that unwind topup -> promo -> plan.
- `grant`/`grantWithReplayStatus` (638-704): idempotent grant under the owner lock.
- `applyCappedRefill` (713+): one transaction that snapshots the plan balance, expires rollover above `allotment x capMultiplier` (default 1), and grants one allotment.
- `topup` (949-983), `expirePlanRemainder` (985-1031, also forfeits all plan holds), `expireAmount` (1033-1077), `revoke` (1079-1115, default bucket `topup`).
- `grantSignupCredits` (1117-1136): promo bucket, key `signup:<userId>`.

### 4.3 Balance queries

File: `apps/server/src/modules/credits/infrastructure/persistence/credits.repository.ts`.

- `getBalance` sums per bucket (line 173).
- `getSettledBalanceSnapshot` (lines 237-303): one SQL statement that returns the ledger balance per bucket plus the in-flight reserve holds added back (`settled*` fields). The UI shows only the settled fields (`contracts/v1/credits.ts:57-71`).
- `netConsumedCentiCredits` (lines 186-210): lifetime personal consumption net of refunds, used for lifecycle email thresholds.

### 4.4 Credits API

`apps/server/src/modules/credits/presentation/http/controllers/credits.controller.ts:32-143`:

- `GET /api/v1/credits/balance` (workspace-scoped), `GET /api/v1/credits/balances` (personal + every org), `GET /api/v1/credits/ledger`, `GET /api/v1/credits/activity` (one row per usage event; reserve/refund pairs hidden, `credit-activity.mapper.ts:16-51`).
- Admin grants use keys `admin-grant:<userId>:<requestId>` (`admin-users.service.ts:177`) and `admin-grant:org:<orgId>:<requestId>` (`admin-organizations.service.ts:135`).

### 4.5 Signup grant pipeline

- Product settings: `signupGrantEnabled` (default false) and `signupGrantCredits` (default 700 cc = 7 credits) (`packages/db/src/schema/billing.ts:110-114`; `product-settings.constants.ts:3-20`).
- `SignupGrantsService.handleUserCreated` (`signup-grants.service.ts:21-64`) writes a `signup_grant_outbox` row (`pending` or `skipped`), tries inline delivery, and hands off to a Trigger.dev task on failure. A scheduled sweep every 5 minutes is authoritative (`docs/features/billing.md:158-168`).

---

## 5. How a credit maps to USD and to AI cost

### 5.1 The anchor

- `AI_USD_PER_CREDIT` defaults to `0.04` (`packages/env/src/server.ts:118`). `DEFAULT_USD_MICROS_PER_CREDIT = 40_000` (`apps/server/src/modules/metering/domain/model-pricing.ts:5`).
- `ModelPricingService.usdMicrosPerCredit` reads the env at boot (`model-pricing.service.ts:100-105`).
- Conversion (`model-pricing.ts:209-222`):

```
centiCredits = ceil(costUsdMicros * 100 / usdMicrosPerCredit)
centiCredits = max(1, centiCredits)
```

So $0.0004 of provider cost = 1 cc, and the smallest charge is 1 cc.

- Reserve stamps `usdMicrosPerCredit` into `ai_usage_events.pricing_snapshot` (`metering.service.ts:2532-2549`). Settle and reconcile read the stamped value, never the live one (`metering.service.ts:667-671, 2585-2608`). This keeps in-flight events stable across a config change (`docs/features/pricing-v5-usd-anchor.md:38-49`).

### 5.2 Provider prices

- `model_prices` is refreshed hourly from `https://ai-gateway.vercel.sh/v1/models` by the `model-price-refresh` Trigger task (`refresh-model-prices.task.ts:8-39`; `model-pricing.service.ts:283-311`). A checked-in seed (`apps/server/src/modules/metering/data/model-prices.seed.json`, 6143 lines) is the cold-start fallback. Each process caches prices for 1 hour (`model-pricing.ts:4`, `model-pricing.service.ts:108-127`).
- Token cost (`model-pricing.ts:256-294`): `uncachedInput x inputRate + cacheRead x cacheReadRate + cacheWrite x cacheWriteRate + output x outputRate`, divided by 1e6 with round-up. If a provider reports cached tokens but no cache rate, the input rate applies (lines 272-275).
- `normalizeTokenUsage` (lines 224-254) derives uncached input as `input - cacheRead - cacheWrite` when details are missing.
- Image, video (per-second, variant aware), and transcription (per-second) estimates: lines 296-416.

### 5.3 Retail value of a credit

Catalog: `packages/contracts/src/v1/billing.ts:145-209`. The product never shows a dollar-per-credit value to users (`pricing-v6-starter-plan.md` D9).

| Plan | Tier | Monthly USD | Retail USD per credit | Provider cost per credit | Ratio |
|---|---|---|---|---|---|
| Starter | 50 | 8 | 0.160 | 0.04 | 4.0x |
| Pro | 175 | 25 | 0.143 | 0.04 | 3.6x |
| Pro | 8750 | 1125 | 0.129 | 0.04 | 3.2x |
| Business | 175 | 50 | 0.286 | 0.04 | 7.1x |
| Top-up (disabled) | 175 | 25 | 0.143 | 0.04 | 3.6x |

The signup grant of 7 credits carries $0.28 of provider cost (`packages/env/src/server.ts:114-117`).

---

## 6. How each AI action is metered and charged

### 6.1 The lifecycle

1. **Reserve** (`MeteringService.reserveWithReplay`, `metering.service.ts:434-567`). Runs before provider work, in one DB transaction:
   - Operation lock on the idempotency key; replay returns the existing event (lines 449-466).
   - Parent/child check: same payer, allowed nesting (lines 470-496; registry in section 6.2).
   - Minimum reserve = registry floor (a connector child uses the connector floor) (lines 468-502).
   - `credits.consume(payer, credits, { admission: "requirePositiveBalance", planHold: "active", idempotencyKey: "reserve:<eventId>" })` (lines 507-524). Any positive balance admits the full reserve (ruling 5).
   - Org member-limit gate after the debit, inside the transaction (lines 526-531; 574-630). Breach -> `MemberCreditLimitError` (HTTP 403 `MEMBER_CREDIT_LIMIT_REACHED`).
   - Inserts `ai_usage_events` with status `reserved` and the pricing snapshot (lines 533-557).
2. **Capture** (`captureGeneration`, line 985): records every AI Gateway / OpenRouter generation id from `providerMetadata` into `ai_usage_generation_refs`. Errors also carry ids (`gateway-metering.ts:110-160`). Non-gateway providers write `ai_provider_call_evidence` rows (`captureProviderCallEvidence`, line 1068).
3. **Settle** (`settle`, lines 645-687; `prepareSettlement`, 2097-2150; `applyCreditAdjustment`, 2152-2305):
   - `pricing: "token"`: quotes the reported usage with `quoteTokenUsage(modelId, usage, stampedAnchor)`.
   - `pricing: "direct"`: caller supplies `finalCredits`, `costUsdMicros`, and a snapshot (used by measured media and fixed operations).
   - The delta versus the reserve is debited with `allowOverdraft: true` (key `settle:<eventId>`) or refunded (key `settle-refund:<eventId>`).
   - A **sanity ceiling** caps the debit at `max(floor, 25 x reserved)`; the deliverable is never discarded; the event gets a `sanityCeiling` marker for admin review (lines 2166-2186; `operation-registry.ts:176-208`).
   - A soft member-limit re-check only logs and marks (lines 2190-2214).
   - Plan hold becomes inactive; lifecycle credit thresholds are enqueued for personal owners (lines 2276-2297, 2307-2325).
4. **Reconcile** (`reconcile`, lines 1149-1454): fetches `getGenerationInfo` for every ref (`metering-provider-gateway.ts:12-56`), sums `totalCost`, adds evidence rows, excludes refunded failures and legacy unmetered helpers from the customer charge (lines 1258-1284), recomputes the final credits with the stamped anchor, applies the adjustment, marks refs reconciled, and sets status `reconciled`. Pending gateway usage throws `GatewayUsagePendingError` (retry). A terminal gateway error marks `reconcile_failed` with exponential backoff (5 min base, 6 h max, 10 attempts, then dead-letter; lines 93-98).
5. **Refund** (`refund`, line 962; `refundWithProviderCost`, line 975): voids a hold when no deliverable was produced. Events with durable generation refs stay reserved for the sweep instead.

### 6.2 Operation registry

File: `apps/server/src/modules/metering/domain/operation-registry.ts`.

| Operation | Mode | Reserve floor (cc) | Allowed parents | Allowed children | Ceiling floor (cc) |
|---|---|---|---|---|---|
| `chat` | token | 10 (0.10 credit) | none (root) | page_build, image, video, marketing, connector, lead_scrape | 50,000 |
| `page_build` | token | 1000 (10 credits) | chat | image, video | 250,000 |
| `image` | measured, unit image | 350 | chat, page_build, connector | none | 20,000 (default) |
| `video` | measured, unit video | 550 | chat, page_build, connector | none | 100,000 |
| `marketing` | token | 150 | chat | none | 20,000 |
| `connector` | measured, unit operation | 1 | chat | image, video | 100,000 |
| `lead_scrape` | fixed, 5 cc per lead, min 100 cc | 100 | chat | none | 20,000 |
| `transcription` | measured, max 300 s | 25 | none | none | 20,000 |
| `topup_adjust` | fixed, 0 | 0 | none | none | 20,000 |

Registry: lines 85-166. Floors: lines 16-25. Ceilings: `EVENT_CEILING_FLOOR_CC = 20_000`, `EVENT_CEILING_MULTIPLIER = 25`, overrides at lines 176-192. Legacy `per_minute` mode remains only to settle old snapshots (lines 47-57).

`AI_INVOCATION_COVERAGE` (lines 313-461) is a grep-verified list of every AI call site with its billing (`metered` or `helper` billed into a parent). Helper calls (project title, prompt refine, tool-call repair, video director, video inspect, voiceover TTS) tag their generation refs `helper_billable` and bill inside the parent at reconciliation (`metering.ts:49-82`).

### 6.3 Call sites by operation

| Operation | Reserve | Settle / refund | Notes |
|---|---|---|---|
| chat (stream turn) | `ai-chat.service.ts:498-598` (`admitTurnReservation`, key `ai-chat:<chatId>:<requestId>` with up to 4 generations) | `ai-chat.service.ts:1281-1333` (`onEnd`, token settle with `env.AI_CHAT_MODEL`) | Estimate from the transcript (`estimateReservation`, 1650+). Captures per step (1334-1345). |
| chat (project creation bundle) | `projects.service.ts:206-231` (`reserveCreation`, key `projectCreationMeteringKey(projectId)`) | first stream claims it via `claimBundledReservation` (`ai-chat.service.ts:317-340`; `metering.service.ts:201-344`) | The creation reserve pays for the first stream. |
| page_build | `apps/server/src/trigger/generate-page.task.ts:196-205` (Trigger.dev task, key `page-build:<attemptId>:<runId>`, `parentEventId` from the chat tool) | `generate-page.task.ts:639-698` (token settle over all builder steps; refund when no usage) | Generation refs captured through a buffer (246-252). |
| image / video inside the builder | `site-builder-agent.ts:1391-1437` (`reserveMeasuredChild`, measured estimate or floor) | `site-builder-agent.ts:600-655, 1032-1062` (direct settlement from the reservation terms; refund on failure) | Child of `page_build`. |
| image (standalone) | `image-generations.service.ts` + `image-generation.runtime.ts` (Trigger) | same files | Coverage id `standalone-image`. |
| video (standalone: animate, text-to-video, edit, extend, product) | `media-generations.service.ts`, video tools in `apps/server/src/modules/ai-chat/agent/tools/*.ts`, Trigger runtimes | same | Coverage ids `standalone-*`. |
| marketing | `marketing-assets.service.ts` / `marketing-asset.runtime.ts` | same | token mode. |
| connector (MCP, Higgsfield) | `mcp-chat-tools.service.ts`, `run-connector-generation.task.ts`, `connector-generation-billing.ts:425-434` | same | Provider evidence rows (`mcp`, `higgsfield`). |
| lead_scrape | `lead-scrape-billing.ts:120` (`reserveWithReplay`) | `lead-scrape-billing.ts:183, 266` | Fixed 5 cc per delivered lead, min 100 cc; Serper evidence. |
| transcription | `transcription.service.ts:157` | `transcription.service.ts:299, 406` | Duration capped at 300 s. |
| legacy worker chat | `apps/worker/src/processors/ai-generation.processor.ts:190-357` | same | BullMQ path, personal only. |

### 6.4 Chat stream protections

File: `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts`.

- `MAX_IN_FLIGHT_STREAMS_PER_USER = 3` (line 180), per actor.
- `AI_CHAT_MAX_STREAM_DURATION_MS = 35 min` (line 182).
- In-process turn key (`claimTurnKey`, 453-483) -> 409 `AI_CHAT_TURN_ACTIVE` for a duplicate POST.
- Cross-replica execution lease on the event: `AI_CHAT_LEASE_TTL_MS = 5 min`, heartbeat every 60 s (lines 200-201; `acquireStreamLease`, 605-621; `metering.service.ts:1672-1720`).
- Stale hold adoption up to 4 minutes; otherwise supersede and take a new key generation (lines 195, 572-592, 633-660).
- Mid-stream billing errors go to the client as the typed data part `data-billing-error` (402 or 403) (`packages/contracts/src/v1/ai-chat.ts:40-51`). After settle, one `data-credits-settled` part carries `usageEventId`, `credits`, and `settledBalance` (lines 62-69; `ai-chat.service.ts:1322-1332`).
- Each assistant message stores `usage`, `stepCount`, `lastStepUsage`, `model`, `provider`, `finishReason`, `gatewayGenerationId` in metadata (`ai-chat.ts:81-127`). Staff can read a per-chat aggregate at `GET /api/v1/chats/:id/usage` (`chats.ts:128-137`).

### 6.5 Gateway attribution

`withGatewayAttribution` (`gateway-metering.ts:166-186`) adds `providerOptions.gateway = { tags: ["op:<operation>", "ws:org" | "ws:personal"], user: <actorUserId> }` to every AI SDK call. `quotaEntityId` is deliberately not sent (comment at lines 174-178).

### 6.6 Scheduled sweeps (Trigger.dev)

| Task | Cron | What it does | File |
|---|---|---|---|
| `metering-reconciliation-sweep` | every minute | reconciles settled events older than 60 s (batch 500), retries `reconcile_failed` (batch 100), finalizes settled events with no refs after 30 min | `reconcile-metering.task.ts:14-59` |
| `metering-stranded-reservation-recovery` | every 15 min | connector checkpoint repair, then refunds or reconciles reserved events older than 40 min | `recover-stranded-metering.task.ts:11-49` |
| `model-price-refresh` | hourly | refreshes `model_prices` from the gateway | `refresh-model-prices.task.ts:8-39` |
| `subscription-refill` | every 10 min | grants due yearly refill slots | `docs/features/billing.md:160-168` |
| `sweep-signup-grants` | every 5 min | delivers pending signup grants | same |
| `retry-billing-webhooks` | every 10 min | retries failed webhook inbox rows | same |
| `manual-subscription-expiry` | every 10 min | ends expired manual subscriptions | `docs/features/manual-billing.md:24-27` |

The Trigger runtime hand-wires the same `MeteringService` graph without NestJS (`metering.runtime.ts:25-37`).

### 6.7 Billing kill switch

`GENERATION_BILLING_MODE` is `enforce` or `off` (`packages/env/src/server.ts:234`). `off` is rejected in production (lines 53-64). When off, chat and page build skip reservations (`ai-chat.service.ts:349-383`; `generate-page.task.ts:183-186`).

---

## 7. Billing

### 7.1 Catalog

File: `packages/contracts/src/v1/billing.ts`.

- Plan ids: `starter`, `pro`, `business` (line 14). Intervals: `month`, `year` (line 20).
- Purchasable tiers (`PLAN_TIERS`, lines 65-69): Starter `[50]`; Pro and Business `[175, 350, 700, 1400, 2100, 3500, 5250, 7000, 8750]`.
- Legacy tiers `[250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500]` stay parseable for existing subscriptions (lines 37-40, 50-60).
- Prices: `BILLING_CATALOG.plans[plan].monthlyPricesUsd` (lines 145-209). `yearlyPriceMultiplier = 10`. Business = 2x Pro.
- Top-ups: `topup_175/$25`, `topup_700/$100`, `topup_1750/$250`; disabled by the `topupsEnabled` setting (lines 97-143).
- Stripe prices resolve by lookup key `<plan>_<tier>_<interval>` (lines 245-288).
- Entitled statuses: `active`, `trialing` (line 29). `past_due` keeps credits but grants no entitlement.
- Providers: `stripe`, `manual` (lines 497-509).

### 7.2 Billing tables

File: `packages/db/src/schema/billing.ts`.

| Table | Purpose | Lines |
|---|---|---|
| `product_settings` | singleton of kill switches and grant amount (see section 8) | 103-166 |
| `billing_customers` | one Stripe customer per user | 168-193 |
| `organization_billing_customers` | one Stripe customer per org, with `attributionUserId` (earliest owner) for affiliates | 265-301 |
| `subscriptions` | mirror of Stripe/manual subscriptions; `tierCredits` is whole credits; one live personal sub per user, one live sub per org (partial unique indexes) | 195-259 |
| `billing_webhook_events` | durable webhook inbox with claim leases | 303-322 |
| `subscription_state_events` | audit of plan/status changes | 324-356 |
| `billing_payment_adjustments` | refunds and failed payments | 358-389 |
| `billing_checkout_attempts` | nonce before Checkout Session creation | 391-426 |
| `subscription_refill_slots` | 11 monthly slots per paid yearly period | 428-474 |
| `billing_invoice_applications` | invoice-scoped grant journal and cycle monotonic guard | 476-512 |
| `billing_change_intents` | preview -> change consistency | 514-562 |
| `signup_grant_outbox` | durable signup grant delivery | 564-588 |
| `billing_financial_reconciliation_outbox` | post-grant charge recheck | 601-628 |
| `billing_topup_receipts` | cash record of top-ups | 636-661 |
| `beta_access_events` | early-access audit | 663-686 |
| `manual_subscription_requests`, `manual_subscription_payments` | offline billing (COD, wire, CCP) | 688-810 |

`monthly_costs` (`packages/db/src/schema/monthly-costs.ts:13-48`) is an admin-entered table of ad spend, infrastructure, and other cost per month. It is not per project.

### 7.3 BillingService

File: `apps/server/src/modules/billing/application/services/billing.service.ts`.

- `resolveBillingScope` (lines 124-145): personal owner unless the workspace is an org; org admissions require `organizationsEnabled`.
- `assertPlanMatchesScope` (148-163): org -> `business`; personal -> `starter` or `pro`.
- `assertPurchasableSelection` (165-174): rejects legacy tiers.
- `plans()` (176-197): public catalog.
- `getSubscriptionView` (199-226): subscription mirror + settled balance.
- `checkout` (236-373): ensures the Stripe customer (personal or org), refuses when a live subscription exists, persists a checkout attempt under the owner lock, creates the Stripe Checkout Session, attaches the session id.
- Other endpoints: `topup`, `portal`, `previewChange`, `change`, `sync`, `cancel`, `resume` (lines 375-1230). Routes: `contracts/v1/billing.ts:652-667`.
- Org billing routes require `billing:manage` (owner only) (`docs/features/teams-workspaces.md:1757-1765`).

### 7.4 Webhooks and credit grants

File: `apps/server/src/modules/billing/application/services/subscription-credits.service.ts`.

- `grantForPaidInvoice` (447-709): accepts `subscription_create`, `subscription_cycle`, `subscription_update`; checks the invoice amount against the catalog; resolves the owner; requires the invoice's subscription to be the canonical entitled mirror for that owner; journals `billing_invoice_applications`; dispatches per reason.
- Allotment = `tierCredits x 100` cc (lines 1575-1581). A yearly payment funds 12 monthly refills; it never mints 12 allotments at once.
- Cycle (887-949): `applyCappedRefill` with key `inv:<invoiceId>:grant`; rollover cap multiplier 1 (carry at most one allotment); yearly slots replaced.
- Deletion: expire the plan bucket only when no other entitled subscription exists for the same owner (`docs/features/billing.md:113`).
- Refunds/disputes: cancel funded slots and revoke purchased credits cumulatively; won disputes restore only the excess (`billing.md:114, 148-149`).
- Event set and Stripe API version `2026-02-25.clover`: `billing.md:174-196`.

### 7.5 Manual (offline) billing

`docs/features/manual-billing.md:1-40`: users file a request from the plan picker; an admin records the payment and grants a `provider = "manual"` subscription; it never auto-renews; a Trigger cron ends it at `currentPeriodEnd`. Kill switch `manualPaymentsEnabled`. Grace days and DZD rate are product settings.

### 7.6 Affiliates (brief)

Org invoices attribute to `organization_billing_customers.attributionUserId`. Commission logic is in `apps/server/src/modules/affiliates/**`. Not needed for V2 metering; listed for completeness (`docs/features/billing-v2-subscriptions-credits-affiliates.md:316-397`).

---

## 8. Plan gating and limits (consolidated)

| Gate | Where | Effect |
|---|---|---|
| `earlyAccessRequired` (default true) | `product_settings`, `EarlyAccessGuard` | non-beta users are blocked when on (`billing-v2` doc §3) |
| `signupGrantEnabled` / `signupGrantCredits` | `product_settings`; `signup-grants.service.ts` | free credits on signup |
| `paidSubscriptionsEnabled` | `SubscriptionsEnabledGuard` (`subscriptions-enabled.guard.ts:13-21`) | 403 `SUBSCRIPTIONS_DISABLED` on checkout/change/resume |
| `topupsEnabled` | `TopupsEnabledGuard` | 403 `TOPUPS_DISABLED` |
| `organizationsEnabled` | `canCreateOrganization` (`auth.module.ts:95-98`); `resolveBillingScope` | workspace creation and Business checkout |
| `emailAuthEnabled` | `hooks.before` (`packages/auth/src/index.ts:549-552`) | magic link / OTP sends |
| `manualPaymentsEnabled`, `manualGraceDays`, `dzdPerUsdRate` | `product_settings` | offline billing |
| `lifecycleEmailsEnabled` | dispatcher | lifecycle emails |
| Settings cache | `ProductSettingsService` 30 s TTL (`product-settings.service.ts:32-52`; constants line 22) | toggles are admission controls, not retroactive |
| Plan/scope pairing | `billing.service.ts:148-163` | personal: starter/pro; org: business |
| Entitlement statuses | `contracts/v1/billing.ts:29` | `active`, `trialing` |
| One live subscription per owner | partial unique indexes (`billing.ts:245-257`) | |
| Reserve admission | `credits.service.ts:180-183` | balance must be > 0; the run may finish negative |
| Reserve floors | `operation-registry.ts:16-25, 85-166` | see section 6.2 |
| Per-event sanity ceiling | `operation-registry.ts:176-208`; `metering.service.ts:2166-2186` | caps the debit, never the work |
| Member monthly credit limits (org) | `metering.service.ts:574-630`; `organization-limits.repository.ts` | 403 at reserve; soft at settle |
| Concurrency | `MAX_IN_FLIGHT_STREAMS_PER_USER = 3`; execution lease | per actor, per process |
| Stream duration | 35 min (`ai-chat.service.ts:182`) | |
| Transcription duration | 300 s (`operation-registry.ts:21`) | |
| Org membership | `membershipLimit: 10_000` (`packages/auth/src/index.ts:654`) | abuse bound |
| Staff permissions | `admin-permissions.ts`; `AdminGuard` | 404 / 403 |
| Lifecycle credit thresholds | `lifecycle-event.ts:57-75` | events at 50% and 80% of the grant |

There is **no per-project cost cap** in V1. `ai_usage_events` has `chatId` and `attemptRef` but no `projectId` column (`packages/db/src/schema/credits.ts:259-313`).

---

## 9. Observability of cost

- Per assistant message: token usage and gateway generation id in message metadata (`contracts/v1/ai-chat.ts:81-127`). Commit `da026a04` added token/cost breakdowns in the web workspace and the admin conversation inspector, plus usage aggregation endpoints.
- Per event: `ai_usage_events` columns and `pricingSnapshot` (`costUsdMicros`, `settlementUsage`, review flags `gateway_zero_cost` / `no_catalog_rate`, `sanityCeiling`, `memberLimitBreach`).
- Per chat: `GET /api/v1/chats/:id/usage` (staff only).
- Admin analytics reads `ai_usage_events` for funnel and margin cards (index comment at `credits.ts:330-334`).
- Monthly infra and ad spend are manual entries in `monthly_costs`.

---

## 10. What V2 needs

V2 runs a coding harness (Claude Code / Claude Agent SDK through the AI SDK harness feature) inside a sandbox, provisions backends (Supabase-like), and previews mobile apps on streamed simulators. These are new cost shapes. V1 meters short, single-provider operations. The gaps and the proposals follow.

**UNVERIFIED items in this section:** the exact usage fields that the AI SDK harness feature and the Claude Agent SDK expose, and whether harness model calls can route through the Vercel AI Gateway. Check these before design freeze.

### 10.1 Metering long-running harness sessions (token usage from Claude Code)

What V1 does not support:

- Settle is terminal. `settle` moves `reserved -> settled` once; a second call is a replay check (`metering.service.ts:654-665`). A harness session that runs for 20 minutes with hundreds of model calls cannot debit as it goes.
- Token settlement takes one `modelId` (`TokenMeteringSettlement`, `metering.ts:150-153`; `prepareSettlement`, 2101-2120). Claude Code uses several models in one session (main model plus subagents and small helper models). **UNVERIFIED**: which models V2's harness will use.
- Reconciliation depends on gateway generation ids (`ai_usage_generation_refs`, `metering-provider-gateway.ts`). If the harness calls Anthropic directly, there are no gateway ids, and reconciliation cannot price the event.
- The reserve is a single-call input quote (chat floor 10 cc). A harness session can cost dollars. "Any positive balance admits the full reserve" (ruling 5) would let a user with 0.01 credit start a long run.
- The chat execution lease and turn key logic assume one HTTP stream per turn (`ai-chat.service.ts:283-414`). A harness run is a background job with its own lifecycle.

Proposal:

1. Add an operation `agent_session` to `ai_usage_operation` and to `OPERATION_REGISTRY` with a new mode `incremental` (or reuse `token` with a checkpoint path). Root allowed; children: `image`, `video`, `sandbox`, `backend_provision`. Reserve floor: at least 500-1000 cc (5-10 credits), tuned from the first sessions. Ceiling override: high (like `page_build`, 250,000 cc) or driven by the project cap (section 10.4).
2. Add a **checkpoint** API: `MeteringService.checkpoint(eventId, { usageDelta, costUsdMicrosDelta, modelId })` that debits the delta with `allowOverdraft: true` under a new idempotency key `checkpoint:<eventId>:<n>`, keeps status `reserved` (or a new status `running`), renews the execution lease, and re-checks the balance and the project cap. Stop the harness when the check fails. The existing `applyCreditAdjustment` logic (`metering.service.ts:2152-2305`) can be generalized; today it assumes one settle and one reconcile key.
3. Use **direct settlement** for the final charge: `pricing: "direct"` with `costUsdMicros` from the harness result and `finalCredits = usdMicrosToCentiCredits(cost, stampedAnchor)`. The Claude Agent SDK result message reports usage and a USD total (**UNVERIFIED** field names, likely `total_cost_usd` and `usage`). Store the per-model breakdown in `rawUsage` and `pricingSnapshot`.
4. Reconciliation source: if harness calls go through the Vercel AI Gateway, capture generation ids per step exactly like the page builder (`generate-page.task.ts:246-252`) and the V1 sweep reprices for free. If not, add a transport value (for example `anthropic` or `harness`) to `ai_cost_transport` and write one `ai_provider_call_evidence` row per session (or per turn) with `costStatus: "measured"`, `units = turns`, and the raw usage in `rawReceipt`. The reconcile path already sums evidence rows (`metering.service.ts:1255-1284`).
5. Model prices: the gateway catalog already lists `anthropic/*` ids (used for `AI_PAGE_DESIGN_MODEL`, `packages/env/src/server.ts`). Anthropic direct pricing for 1-hour cache writes differs from 5-minute cache writes (**UNVERIFIED** in the catalog). If V2 prices from harness-reported USD, this does not matter.
6. Keep the reserve-time stamped anchor (`usdMicrosPerCredit`) for the whole session, as V1 does.
7. Reuse the execution lease (`acquireExecutionLease` / `heartbeatExecutionLease`, `metering.service.ts:1672-1720`) as the liveness proof of the sandbox job. Extend the stranded-recovery window for `agent_session` (today 40 min, `recover-stranded-metering.task.ts:11`; the comment mentions a longer window for Personal Clipper jobs, so a per-operation window already exists as a pattern).
8. Concurrency: cap concurrent harness sessions per actor and per project (V1 has 3 streams per actor, in-process only). Use a DB-backed count of `reserved` `agent_session` events for the actor.

### 10.2 Sandbox minutes

V1 has no wall-clock metering. The legacy `per_minute` mode exists only for old snapshots (`operation-registry.ts:47-57`).

Proposal:

1. Add operation `sandbox` (or `sandbox_minutes`) with mode `measured`, `unit: "minute"` (extend `MeasuredOperationPricing.unit`, `operation-registry.ts:64-69`). Rate = provider price per minute (for example the sandbox vendor's CPU/memory rate) stored as `rateUsdMicrosPerUnit` in an evidence row so the customer charge follows `usdMicrosToCentiCredits(minutes x rate)`.
2. Lifecycle: reserve N minutes at sandbox start (floor), heartbeat every minute (the harness checkpoint loop can also extend the sandbox hold), settle on stop with `completedUnits = ceil(activeSeconds / 60)`. `settleMeasuredFromEvidence` (`metering.service.ts:698`) already settles a measured event from the strongest durable unit count; reuse it.
3. Idle policy is a limit, not a charge: stop the sandbox after X idle minutes; stop at a hard maximum per session.
4. Whether to charge sandbox minutes in credits or include them in the plan is a product decision. If included in the plan, still record the evidence rows with `customerBillable: false` (the column exists, `credits.ts:428-430`) so margins stay visible.

### 10.3 Backend provisioning costs

V1 charges only AI actions in credits; recurring costs are subscriptions. A Supabase-style backend per project has: a one-time provision step, a monthly base, storage and egress, edge function invocations, emails, and jobs.

Proposal:

1. Plan entitlement first: define per-plan limits (number of live backends, DB size, email count) in the catalog `features` block (`contracts/v1/billing.ts:150-151, 157-158, 183`). `BillingService.plans()` already returns `features`.
2. For metered infra, add operation `backend_provision` (fixed, unit `operation`) for the provision step and `backend_hosting` (measured, unit `month` or `day`) charged by a Trigger cron with key `hosting:<projectId>:<yyyy-mm>` through the ledger `consume` path (`allowOverdraft: true`, `meta.reason: "backend_hosting"`). The ledger is append-only and idempotent, so a cron charge is safe to retry.
3. Evidence: one `ai_provider_call_evidence` row per vendor invoice line with `transport` = vendor (add enum values), `customerBillable` per policy.
4. Suspension instead of overdraft: when a project's owner balance is <= 0 for more than N days, pause the backend rather than let the ledger go deeply negative. V1 never pauses anything; it only refuses new AI work.
5. Keep vendor keys and project ids out of the ledger `meta`; store them in a V2 project-backend table. `monthly_costs` stays the admin roll-up.

### 10.4 Per-project hard cost caps

V1 caps: per-member monthly limits inside orgs (calendar month, `ai_usage_events` sums) and per-event sanity ceilings. Nothing is per project.

Proposal:

1. Add `projectId` to `ai_usage_events` with a partial index `(project_id, created_at)`. Backfill is optional (chat -> project join exists).
2. Add a `project_cost_caps` table (or columns on `projects`): `monthlyCreditCap` (cc, NULL = none), `sessionCreditCap` (cc), `updatedByUserId`. Owners/admins edit them; members see them. Reuse the org credit advisory lock so cap writes serialize with reserves (pattern in `organization-limits.repository.ts:48-59`).
3. Enforce in three places: at reserve (hard, same transaction as the debit, like `enforceMemberLimit`, `metering.service.ts:526-531`); at each checkpoint of an `agent_session` (hard: stop the harness and settle what ran); at settle/reconcile (soft marker, like `memberLimitBreach`).
4. Spend sum: `SUM(COALESCE(final_credits, reserved_credits))` per project for the month, plus the running checkpoint debits.
5. Return a typed error `PROJECT_CREDIT_CAP_REACHED` (403) and a `data-billing-error` variant so the web can show "raise the cap" instead of "buy credits". The discriminated union at `contracts/v1/ai-chat.ts:40-51` extends cleanly.
6. Sandbox minutes and backend hosting must count toward the same project cap, so they must be `ai_usage_events` rows (sections 10.2 and 10.3), not separate tables.

### 10.5 Auth and workspace implications for V2

- Reuse Better Auth as is. V2 adds no sign-in method. The `project` resource in `permissions.ts` already has `create/update/delete`; add `sandbox: [manage]`, `backend: [manage]`, `secrets: [manage]` statements if members must be restricted.
- Sandbox-to-API credentials: the harness inside the sandbox must call the wandit API (write files, read secrets, publish). Better Auth sessions are cookie-based and tied to a browser. V1 has one precedent for a signed short-lived token (the affiliate HMAC token, `billing-v2` doc §6). V2 needs a per-session scoped token (project id, owner, expiry) that the API validates without a user session. **Open question**: Better Auth API-key plugin vs. a custom HMAC token.
- Workspace scoping stays header-based. Background jobs (Trigger.dev) must carry the `MeteringSubject` in the payload, as `generate-page.task.ts:95, 133` does for `actorIsLimitExempt`.
- Project ownership by org already exists (`projects.organizationId`). V2 backends and sandboxes must be owned by the same `CreditOwner`.
- End-user auth for apps that V2 users build (their own users) is a product feature of the generated app (Supabase Auth), not wandit's Better Auth. Keep the two separate.
- Mobile preview (Expo): wandit's own native app auth uses the Expo plugin and works unchanged. Simulator streaming has no auth dependency on Better Auth beyond the normal session.
- Add a product setting `v2BuilderEnabled` (or per-user early access) to gate the new module, in the same style as `organizationsEnabled` (13-step toggle chain in `teams-workspaces.md:1920-1921`).
- Admin: add a `builder` or `sandboxes` resource to `adminStatement` if a new dashboard section appears (`admin-permissions.md:230-239`).

### 10.6 Schema deltas (summary)

| Change | Table / file | Why |
|---|---|---|
| enum values `agent_session`, `sandbox`, `backend_provision`, `backend_hosting` | `ai_usage_operation` (`credits.ts:34-44`) and `OPERATION_REGISTRY` | new cost shapes |
| optional status `running` or a checkpoint counter column | `ai_usage_events` | incremental debits |
| `projectId` column + index | `ai_usage_events` | project caps |
| `project_cost_caps` | new | hard caps |
| enum values for new transports (`anthropic`/`harness`, sandbox vendor, backend vendor) | `ai_cost_transport` (`credits.ts:383-389`) | evidence rows |
| `unit: "minute" | "month"` | `MeasuredOperationPricing` | time-based measured ops |
| `creditActivityOperations` | `contracts/v1/credits.ts:136-146` | activity feed |
| `data-billing-error` variant `PROJECT_CREDIT_CAP_REACHED` | `contracts/v1/ai-chat.ts:40-51` | UX |
| plan `features` for backend limits | `contracts/v1/billing.ts:145-209` | entitlement |

---

## 11. Reuse, replace, extend

**Reuse as is**

- Better Auth server and client config, canonical email, admin auth instance, `AuthGuard`, `CrossSiteWriteGuard`, staff permissions.
- Workspace header scoping, `WorkspaceContextGuard`, role matrix, member limits.
- `CreditOwner`, `MeteringSubject`, `ProjectScope`, advisory lock values.
- `credit_ledger`, `CreditsService` (consume/refund/grant/refill/topup/expire/revoke), plan holds, settled balance snapshot, credits API.
- `AI_USD_PER_CREDIT` anchor, `usdMicrosToCentiCredits`, `model_prices` refresh, pricing snapshots.
- `ai_usage_events` state machine, generation refs, provider call evidence, reconciliation sweep, stranded recovery, execution lease.
- Stripe billing, catalog, webhooks, refill slots, manual billing, product settings, signup grant outbox.
- Gateway attribution tags, `data-billing-error` and `data-credits-settled` stream parts, per-message usage metadata.

**Extend**

- Registry and enums (new operations, units, transports).
- `MeteringService`: checkpoint debits, per-operation recovery windows, multi-model direct settlement, project cap checks.
- `ai_usage_events`: `projectId`.
- Contracts: error codes, activity operations, plan features.
- Product settings: `v2BuilderEnabled`.
- Permissions: sandbox/backend/secrets statements.

**Replace (V2-only paths)**

- The chat-stream admission code in `ai-chat.service.ts` (turn keys, lease heartbeat inside an HTTP stream) does not fit a background harness job. Write a V2 session admission service that uses the same `MeteringService` primitives from a Trigger.dev or sandbox-controller context (pattern: `generate-page.task.ts`).
- Hand-built `ToolLoopAgent` billing sites for page build become one `agent_session` per harness run.

---

## 12. Open questions

1. Can the AI SDK harness feature route Claude Code model calls through the Vercel AI Gateway so that generation ids exist for reconciliation? If not, direct settlement from harness-reported cost is the only source. **UNVERIFIED**.
2. Which usage fields does the Claude Agent SDK expose per turn and per session (input, output, cache read, cache write, USD total, per-model split)? **UNVERIFIED**.
3. Should sandbox minutes and backend hosting be charged in credits, or included in plan entitlements with hard limits? This decides whether the `$0.04` anchor applies to non-AI cost.
4. What is the hard per-session credit cap for a harness run, and who can raise it (owner only, like billing)?
5. How does the sandbox authenticate to the wandit API (API-key plugin vs. signed token)?
6. What happens to a running sandbox and backend when the owner balance is negative: pause after N days, or let it run to the monthly cap?
7. Do V2 projects live in the same `projects` table (with `kind`), or in a new table? Metering `projectId` and caps depend on the answer.
8. Better Auth 1.6.22 session defaults (`expiresIn`, `updateAge`) are not set in code; confirm they are acceptable for long builder sessions.

---

## 13. Evidence index

Auth: `packages/auth/src/index.ts`, `permissions.ts`, `admin-permissions.ts`, `expo-authorization-proxy.ts`, `email-canonical.ts`, `email-magic-link-url.ts`, `user-created-hook.ts`; `apps/server/src/modules/auth/auth.module.ts`, `presentation/http/guards/auth.guard.ts`, `presentation/http/controllers/me.controller.ts`, `application/services/signup-grants.service.ts`, `infrastructure/redis/better-auth-redis-secondary-storage.ts`; `apps/web/src/features/auth/lib/auth-client.ts`; `apps/native/lib/auth-client.ts`; `packages/db/src/schema/auth.ts`, `onboarding.ts`, `user-activity.ts`; `docs/features/auth-accounts.md`, `admin-permissions.md`.

Workspaces: `packages/db/src/schema/organizations.ts`; `apps/server/src/modules/workspaces/**`; `apps/server/src/modules/projects/domain/project-scope.ts`; `packages/contracts/src/v1/workspaces.ts`; `docs/features/teams-workspaces.md`.

Credits and metering: `packages/db/src/schema/credits.ts`; `apps/server/src/modules/credits/**`; `apps/server/src/modules/metering/**`; `apps/server/src/modules/ai-provider/infrastructure/metering-provider-gateway.ts`; `apps/server/src/modules/ai-chat/application/services/ai-chat.service.ts`; `apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts`; `apps/server/src/modules/projects/application/services/projects.service.ts`; `apps/server/src/trigger/{generate-page.task,metering.runtime,reconcile-metering.task,recover-stranded-metering.task,refresh-model-prices.task}.ts`; `packages/env/src/server.ts`; `packages/contracts/src/v1/{credits,ai-chat,chats}.ts`; `docs/features/credits.md`, `pricing-v4-fractional-credits.md`, `pricing-v5-usd-anchor.md`, `billing-v2-subscriptions-credits-affiliates.md`.

Billing: `packages/db/src/schema/billing.ts`, `monthly-costs.ts`; `apps/server/src/modules/billing/**`; `apps/server/src/modules/settings/**`; `packages/contracts/src/v1/{billing,settings}.ts`; `docs/features/billing.md`, `pricing-v6-starter-plan.md`, `manual-billing.md`.

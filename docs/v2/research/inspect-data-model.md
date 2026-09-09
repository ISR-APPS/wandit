# V2 research: data model entity map

Date: 2026-09-03
Worktree: `.claude/worktrees/v2-builder` (branch `feat/v2-builder`, identical to `dev`)
Scope: `packages/db/src/schema/*` (all 37 files), `packages/db/src/migrations/*` (skimmed), plus the storage and serving code the schema points at.

All file paths are repo-relative. Line numbers refer to the files as they are on this branch. Items I could not confirm from code are marked UNVERIFIED.

---

## 0. Summary

- The database is one Postgres instance. Drizzle ORM describes it in TypeScript. There are 79 tables and 63 Postgres enums. The schema and the migrations agree (79 `CREATE TABLE` statements, zero `DROP TABLE`, zero `RENAME`).
- There are 67 migrations, `0000_great_boom_boom.sql` to `0066_signup-grant-7.sql`. The latest is `0066_signup-grant-7.sql`.
- The root entity is `projects`. Almost every product table hangs off `projects.id` with `ON DELETE cascade`. `projects` itself points at `user` and optionally `organization` with `ON DELETE restrict`.
- The content model is thin: one `artifacts` row per project (kind `landing_page` only), many immutable `versions` rows, each pointing at one R2 key for `index.html`. Extra files land beside it in R2 but have no DB row.
- Publishing is a pointer model. `deployments` rows record the history. Cloudflare KV holds `domain:{host} -> {projectId}`. R2 holds `published/{projectId}/current.html`. The edge worker never reads Postgres.
- Every AI operation follows one "attempt row" pattern: a mutable status row with a snapshot spec, a Trigger.dev run id, an idempotency key, and normalized failure columns.
- Money is split in two layers: `credit_ledger` (append-only, centi-credits) with metering `ai_usage_events`, and a Stripe-shaped `billing` group with manual (offline) billing on top.
- Ownership uses one rule everywhere: `userId` plus nullable `organizationId`. Personal rows have `organizationId NULL`. Org rows carry `organizationId`.
- V2 can keep the whole identity, workspace, credit, billing, connector, domain, lead, and admin layers unchanged. V2 must replace the content model (`artifacts`/`versions`/`page_generation_attempts`) and extend `projects`, `deployments`, `chats`, `messages`, and the metering enums. V2 needs new tables for sandboxes, agent runs, file snapshots, backend provisioning, secrets, mobile builds, and app-level publishing targets.

---

## 1. Package overview

| Item | Evidence |
|---|---|
| ORM | `drizzle-orm ^0.45.1`, `drizzle-kit ^0.31.8`, driver `pg ^8.22.0` — `packages/db/package.json` |
| Dialect | `postgresql` — `packages/db/drizzle.config.ts` |
| Schema dir | `./src/schema`, migrations out dir `./src/migrations` — `packages/db/drizzle.config.ts` |
| Env | `DATABASE_URL` from `apps/server/.env` — `packages/db/drizzle.config.ts` |
| Client factory | `createDb()` wraps a `pg.Pool` and passes the schema barrel — `packages/db/src/index.ts:43-55` |
| Dedicated client | `createDedicatedClient()` for advisory locks — `packages/db/src/index.ts:38-40` |
| Barrel | `packages/db/src/schema/index.ts:1-75` re-exports every table file |
| Consumers | `apps/server` (157 files), `apps/worker` (3), `packages/auth` (1). The web, admin, native and edge apps never import the DB. |
| Scripts | `db:push`, `db:generate`, `db:studio`, `db:migrate` — `packages/db/package.json` |

Conventions that all tables follow (relevant for any V2 table):

- Primary keys: `uuid("id").primaryKey().defaultRandom()` for app tables. Better Auth tables use `text("id")` (`packages/db/src/schema/auth.ts:17`, `organizations.ts:24`).
- Timestamps: `timestamp(..., { withTimezone: true })`, `createdAt.defaultNow()`, `updatedAt.$onUpdate(() => new Date())`.
- User references: `onDelete: "restrict"` on money and history rows (`credits.ts:67`, `projects.ts:34`, `member` in `organizations.ts:51`). `onDelete: "cascade"` only on throwaway user-owned rows (`session`, `account`, `push_tokens`, `mcp_connections`, `user_onboarding`).
- Tenant-proof composite foreign keys. A child proves it belongs to the same project by a `(projectId, childId)` pair: `versions_artifact_project_fk` (`artifacts.ts:100-104`), `deployments_project_version_fk` (`deployments.ts:66-70`), `leads_project_deployment_fk` (`leads.ts:81-85`), `artifacts_active_version_fk` (`artifacts.ts:55-59`).
- "One active" rules use partial unique indexes: `deployments_active_project_uq` (`deployments.ts:59-61`), `subscriptions_userId_nonTerminal_uq` (`billing.ts:248-251`), `domains_primary_project_uq` (`domains.ts:90-92`).
- Owner rule: `userId` nullable/not-null plus nullable `organizationId`, with a `..._owner_present_ck` check when both are nullable (`credits.ts:113-116`, `credits.ts:167-170`, `credits.ts:215-218`).
- Credit unit: centi-credits (1 cc = 0.01 credit) in every ledger, hold, limit and grant column. Migration `0038_centi-credit-rescale.sql` rescaled old rows. `subscriptions.tierCredits` is the one exception (whole credits, `billing.ts:210-213`).
- Storage: tables store R2 object keys, not URLs (`versions.r2Key` `artifacts.ts:74`, `marketing_assets.r2Key` `marketing-assets.ts:55`, `lead_scrape_attempts.r2Key` `lead-scrape-attempts.ts:77`). Public URLs are derived by `publicAssetUrl()` in `apps/server/src/infrastructure/storage/r2.ts:257`.

---

## 2. Migrations

- Count: 67 SQL files in `packages/db/src/migrations/` (`0000` to `0066`), plus `meta/_journal.json` and 67 snapshots. Total 1,974 SQL lines.
- Latest: `0066_signup-grant-7.sql` (journal idx 66). It changes the default signup grant to 700 cc (7 credits) — `packages/db/src/migrations/0066_signup-grant-7.sql:1-5`.
- Recent tail: `0060_ai-inspector-foundation.sql` (adds `admin_audit_events` and the `failure_*` + `sentry_event_id` columns to `messages` and every attempt table), `0061_ai-usage-events-chat-idx.sql`, `0062_manual-billing-dzd-rate.sql`, `0063_real_namora.sql` (adds `domains.external_delegation_reminder_sent_at`), `0064_admin-view-grants.sql` (new table `admin_view_grants`), `0065_starter-plan-enum.sql` (adds `starter` to `billing_plan`).
- Named milestones worth knowing: `0024_provider-source`, `0025_attempt-lifecycle`, `0032_user-onboarding`, `0035`–`0037` (attribution and activity analytics), `0038_centi-credit-rescale`, `0041_manual-billing`, `0044_video-pipeline-foundations`, `0046_ws4-guards-leases-idempotency`, `0048_provider-call-evidence`, `0049_stripe-lifecycle-admin-truth`, `0051_push-tokens`, `0054_lifecycle-emails`, `0057_feedback`.
- Migrations are additive only. No table was ever dropped or renamed. This is a good sign for V2: adding tables and columns is the established path, and enum value additions (`ALTER TYPE ... ADD VALUE`) are already used (`0065`).

---

## 3. Entity map by group

Notation: `->` means foreign key. `(c)` = `ON DELETE cascade`, `(r)` = `restrict`, `(n)` = `set null`, `(x)` = no action.

### 3.1 Auth / users — `packages/db/src/schema/auth.ts`

Better Auth owns these tables through the drizzle adapter, which resolves models by export name (`packages/auth/src/index.ts:4-5, 44, 223-225`). Plugins in use: `admin`, `organization`, `magicLink`, `emailOTP` (`packages/auth/src/index.ts:632-635, 712, 734`).

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `user` (L14-56) | Account identity | `id text PK`, `email unique`, `displayEmail`, `emailVerified`, `role` (admin plugin), `earlyAccess`, `onboardingCompletedAt`, `banned/banReason/banExpires`, `lastSeenAt` | Referenced by almost every table. `userRelations` -> sessions, accounts (L200-203). |
| `session` (L58-84) | Login session | `token unique`, `expiresAt`, `ipAddress`, `userAgent`, `impersonatedBy`, `activeOrganizationId` (written by org plugin, never read for scoping, L78-81) | `userId -> user (c)` |
| `account` (L86-123) | External identity / password | `providerId`, `accountId`, OAuth tokens, `password` | `userId -> user (c)`; unique `(providerId, accountId)` |
| `verification` (L125-141) | Magic-link / OTP tokens | `identifier`, `value`, `expiresAt` | none |
| `rate_limit` (L148-162) | Better Auth DB rate limiter | `key unique`, `count`, `lastRequest bigint` | none |
| `auth_email_sends` (L167-198) | Per-email send caps and audit | `emailCanonical`, `ipHash`, `kind`, `actorId` (no FK by design, L175-179) | none |

Workspace scope does not come from `session.activeOrganizationId`. It comes from the `x-wandit-workspace` request header (`docs/features/teams-workspaces.md` §2, `auth.ts:78-81`).

### 3.2 Organizations / workspaces — `packages/db/src/schema/organizations.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `organization` (L21-38) | Better Auth org model | `id text PK`, `name`, `slug unique`, `logo`, `metadata text` (plugin serializes JSON itself, L28) | has many `member`, `invitation` |
| `member` (L40-71) | Org membership | `role text` (comma-separated multi-role, L52-54) | `organizationId -> organization (c)`, `userId -> user (r)`; unique `(organizationId, userId)` |
| `invitation` (L73-99) | Pending invites | `email`, `role?`, `status`, `expiresAt` | `organizationId -> organization (c)`, `inviterId -> user (r)` |
| `organization_billing_settings` (L106-132) | Default per-member monthly credit cap | `defaultMemberMonthlyCreditLimit` (cc, NULL = unlimited) | PK = `organizationId -> organization (r)` |
| `organization_member_credit_limits` (L137-170) | Explicit per-member cap | `monthlyCreditLimit` (cc) | `organizationId (r)`, `userId (r)`; unique `(org, user)` |

Org Stripe customers live in `organization_billing_customers` in `billing.ts` (see 3.12).

### 3.3 Projects — `packages/db/src/schema/projects.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `projects` (L25-85) | Root workspace object. Soft-deleted. | `userId` (creator, provenance only for org projects, L29-34), `organizationId` (NULL = personal, L37-39), `name`, `publicFormId uuid unique` (used by generated lead forms, L43), `previewToken uuid unique` (L45), `metaPixelId`, `tiktokPixelId` (L46-47), `previewImageUrl` (L50), `logoUrl` (L52), `hideWanditBadge` (L56), `deletedAt` (L58) | `userId -> user (r)`, `organizationId -> organization (r)`. `projectsRelations` -> chats, artifacts, deployments, leads (L88-97). |

Indexes: `projects_dashboard_idx (userId, updatedAt) WHERE deletedAt IS NULL` (L72-74), `projects_org_dashboard_idx` (L76-80).

Children that cascade from `projects.id`: `chats`, `artifacts`, `versions` (through artifacts), `deployments`, `leads`, `lead_sheet_syncs`, `lead_scrape_attempts`, `page_generation_attempts`, `image_generation_attempts`, `media_generation_attempts`, `marketing_assets`. `domains.projectId` is `set null` (`domains.ts:37-39`).

There is no `project_assets` table. The Assets tab is a union of the attempt tables (`apps/server/src/modules/project-assets/infrastructure/persistence/project-assets.repository.ts:3, 9`).

### 3.4 Chats / messages — `packages/db/src/schema/chats.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `chats` (L29-51) | One conversation per project (MVP: one chat per project, L28) | `createdAt`, `updatedAt` only | `projectId -> projects (c)` |
| `messages` (L55-89) | Persisted AI SDK UIMessages | `id text PK` (random uuid), `seq bigint identity` (server order, L66), `role enum system/user/assistant` (L21-25), `parts jsonb` (AI SDK parts, L69), `metadata jsonb` (model/usage, L71), `failureKind/Source/Provider/ProviderMessage/RequestId`, `sentryEventId` (L72-77) | `chatId -> chats (c)` |

Live streaming deltas are not stored here; they go through Redis/SSE (L53-54). Messages have no `projectId`; scope goes through `chats`.

### 3.5 Artifacts / versions — `packages/db/src/schema/artifacts.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `artifacts` (L21-61) | One generated deliverable per project | `kind enum artifact_kind` with the single value `landing_page` (L19), `activeVersionId` (current draft pointer, L33) | `projectId -> projects (c)`. Partial unique `artifacts_project_landing_uq` = one landing page per project (L48-50). Composite FK `(id, activeVersionId) -> versions(artifactId, id)` (L55-59). |
| `versions` (L65-106) | Immutable output snapshots, never updated (L63-64) | `artifactId`, `projectId` (denormalized tenant key, L71-72), `number int` (v1, v2... per artifact, L74), `r2Key` = `sites/{projectId}/{versionId}/index.html` (L75-76), `messageId -> messages (n)` (L78-80), `productSku` (L83), `meta jsonb` (L85) | Composite FK `(artifactId, projectId) -> artifacts(id, projectId)` cascade (L100-104). Unique `(artifactId, number)`, `(artifactId, id)`, `(projectId, id)`. |

A version row stores exactly one R2 key. The page task also uploads extra files to `sites/{projectId}/{versionId}/{path}` via `siteFileKey` (`apps/server/src/infrastructure/storage/r2.ts:71-76`, `apps/server/src/trigger/generate-page.task.ts:327-335`), but there is no per-file DB row and no manifest column. This is the main gap for a multi-file V2 project.

### 3.6 Page attempts — `packages/db/src/schema/page-attempts.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `page_generation_attempts` (L30-96) | Mutable lifecycle of one background page build | `status enum queued/generating/succeeded/failed/canceled` (L19-25), `spec jsonb` (brief + builder prompt snapshot, L49), `model` (L51), `triggerRunId` (L53), `versionId -> versions (n)` (L56-58), `error`, `failureCode`, `failure*`, `sentryEventId` (L60-70), `lastProgressPercent` (L74), `dismissedAt` (L77), `startedAt`, `completedAt` | `projectId (c)`, `artifactId (c)`, `chatId -> chats (n)` (L42-44) |

This is the canonical "attempt row" for the V1 builder. Live progress is in Trigger run metadata, not in the row (L71-73).

### 3.7 Deployments — `packages/db/src/schema/deployments.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `deployments` (L27-78) | One row per publish attempt; ordered history | `versionId` (paired FK, L36), `slug` (subdomain on `wandit.app`, L38), `status enum pending/active/failed/superseded/unpublished` (L19-25), `error` | `projectId -> projects (c)`. Composite FK `(projectId, versionId) -> versions(projectId, id)` NO ACTION (L66-70). Partial unique: one active slug globally (L55-57), one active deployment per project (L59-61). Check: slug is a DNS label <= 63 chars (L73-76). |

Runtime serving is outside Postgres. Publish writes R2 `published/{projectId}/current.html` and `published/{projectId}/v/{deploymentId}.html`, and KV `domain:{host} -> {projectId, ...}` (`docs/features/publishing-serving.md` "Working model", `apps/edge/src/index.ts:1-22, 56-63`). The edge worker has only KV and R2 bindings (`apps/edge/src/index.ts:32-34`).

### 3.8 Domains — `packages/db/src/schema/domains.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `domains` (L30-106) | Purchased or external custom domains | `name unique lowercase`, `tld`, `source enum purchased/external` (L19), `status enum registering/configuring/active/failed/expired/transferred_out` (L21-28), `isPrimary` (one per project, L90-92), `registrant jsonb`, `whoisPrivacy`, `autoRenew`, `expiresAt`, `provider` (`namecom` or `openprovider`, L101-104), `providerDomainId/OrderId/TotalPaidUsd`, `transferLockExpiresAt`, `cfCustomHostnameId` (Cloudflare for SaaS, L67), `dns jsonb` (L68), `externalDelegationReminderSentAt` (L69-72), `priceSnapshot`, `error` | `userId -> user (r)`, `projectId -> projects (n)`, `paymentOrderId -> payment_orders (n)` |

### 3.9 Leads — `packages/db/src/schema/leads.ts`, `lead-sheet-syncs.ts`, `lead-scrape-attempts.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `leads` (L28-90) | Inbound form submissions from published pages | `deploymentId` (which live deployment captured it, L38), `productSku`, `name`, `phone` (E.164, check L88), `wilaya`, `commune` (Algeria-first, optional, L46-47), `extras jsonb` (form fields), `attribution jsonb` (utm/fbclid/ttclid/referrer, L54), `status enum to_confirm/confirmed/shipped/delivered/returned/cancelled` (L19-26), `statusChangedAt`, `archivedAt` | `projectId -> projects (c)`. Composite FK `(projectId, deploymentId) -> deployments(projectId, id)` (L81-85). Recency indexes L67-79. |
| `lead_sheet_syncs` (L19-42) | One Google Sheet per project | `spreadsheetId`, `spreadsheetUrl`, `syncedByUserId -> user (n)`, `lastSyncedAt`, `syncedLeadCount` | `projectId -> projects (c)`; unique per project |
| `lead_scrape_attempts` (L41-101) | Outbound prospect scrape attempt (NOT inbound leads, L35-40) | `requestKey`, `status enum queued/running/succeeded/failed` (L18-23), `stage enum` (L27-33), `progress`, `spec jsonb`, `triggerRunId`, `foundCount`, `rowCount`, `columnCount`, `fileName`, `fileSize`, `r2Key`, `previewRows jsonb`, `error` | `projectId (c)`, `chatId -> chats (n)`; unique `(chatId, requestKey)` |

Leads are captured by `projects.publicFormId` (`projects.ts:42-43`) and the leads runtime script the publish pass injects (`docs/features/publishing-serving.md`).

### 3.10 Orders — `packages/db/src/schema/orders.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `payment_orders` (L30-83) | One-off Stripe purchases | `kind enum` with the single value `domain_registration` (L26-28), `status enum pending/paid/fulfilling/fulfilled/failed/canceled/refunded` (L16-24), `amountCents > 0`, `currency` (3-letter lowercase), `provider` default `stripe`, `providerCheckoutSessionId/PaymentIntentId/RefundId` (each unique), `refundStatus`, `metadata jsonb notNull`, `fulfillmentError`, `paidAt`, `fulfilledAt` | `userId -> user (r)`. Referenced by `domains.paymentOrderId`. |

### 3.11 Credits / metering — `packages/db/src/schema/credits.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `credit_ledger` (L55-118) | Append-only balance ledger, balance = sum(delta) (L54) | `userId?`, `organizationId?` (owner rule L59-66), `bucket enum plan/promo/topup` (L32), `delta int` (signed, cc, L73-76), `kind enum grant/consume/topup/expire/revoke` (L24-30), `idempotencyKey` (partial unique), `meta jsonb` (reason, jobId, refundOf, paymentIntentId, chargeId) | `userId -> user (r)`, `organizationId -> organization (r)`. Sign check L109-112. Owner check L113-116. Expression indexes on `meta->>'paymentIntentId'` and `meta->>'chargeId'` (L95-98). |
| `credit_plan_hold_pools` (L134-172) | Shared carry allowance at a refill boundary | owner pair, `boundaryIdempotencyKey unique`, `remainingCredits >= 0`, `closedAt` | owner FKs (r) |
| `credit_plan_holds` (L181-228) | Refundable plan entitlement per consume | PK `consumeIdempotencyKey`, `consumeLedgerId -> credit_ledger (r) unique`, owner pair, `poolId -> pools (r)`, `originalCredits`, `refundableCredits`, `active` | owner FKs (r) |
| `ai_usage_events` (L259-355) | Metering reservation per AI operation | `userId notNull` (actor, L263-267), `organizationId?` (payer, L269-271), `operation enum chat/page_build/image/video/marketing/connector/lead_scrape/transcription/topup_adjust` (L34-44), `parentEventId` (self FK), `status enum reserved/settled/reconciled/refunded/reconcile_failed` (L46-52), `model`, `provider`, `reservedCredits`, `finalCredits`, `estimatedCostUsdMicros`, `reconciledCostUsdMicros`, token counts incl. cache read/write (L285-288), `rawUsage`, `pricingSnapshot`, `chatId`, `messageId`, `attemptRef` (L291-293), `idempotencyKey unique`, `executionLeaseToken/ExpiresAt` (cross-replica lease, L294-301), `reconcileAttempts`, `nextReconcileAttemptAt`, `settledAt`, `reconciledAt` | `userId (r)`, `organizationId (r)`. Partial indexes for reserved sweeps and reconcile retries (L345-352). Funnel index on `(operation, attemptRef, createdAt desc, userId)` (L335-344). |
| `ai_usage_generation_refs` (L357-378) | Gateway generation ids for cost reconciliation | `gatewayGenerationId unique`, `providerSource` (`vercel` or `openrouter`, L365-367), `stepUsage`, `reconciledCostUsdMicros` | `usageEventId -> ai_usage_events (r)` |
| `ai_provider_call_evidence` (L410-458) | Receipt of one non-gateway provider call | `transport enum vercel/openrouter/serper/higgsfield/mcp` (L383-389), `providerRequestId`, `unitKind`, `units > 0`, `chargedUsdMicros`, `rateUsdMicrosPerUnit`, `costStatus enum measured/contract_rate/estimated/pending` (L391-400), `customerBillable`, `rawReceipt`, `idempotencyKey unique` | `usageEventId -> ai_usage_events (r)` |
| `model_prices` (L460-480) | Cached provider price list | `modelId unique`, `provider`, `modelType`, per-MTok USD micros (input/output/cache read/cache write), `imageUsdMicros`, `videoUsdMicrosPerSecond`, `transcriptionUsdMicrosPerSecond`, `variantPricing`, `raw`, `refreshedAt` | none |

### 3.12 Billing — `packages/db/src/schema/billing.ts`, `cancellation-reasons.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `product_settings` (L104-166) | Singleton kill-switch row (`id = 1`) | `earlyAccessRequired`, `signupGrantEnabled`, `signupGrantCredits` (700 cc), `paidSubscriptionsEnabled`, `topupsEnabled`, `organizationsEnabled`, `emailAuthEnabled`, `lifecycleEmailsEnabled`, `manualPaymentsEnabled`, `manualGraceDays`, `dzdPerUsdRate`, `version` | `updatedByUserId -> user (r)` |
| `billing_customers` (L168-193) | Personal Stripe customer | `provider`, `providerCustomerId`, `openCheckoutSessionId` | `userId -> user (r)`; one per user |
| `subscriptions` (L195-259) | Live plan | `userId` (purchasing admin for orgs, provenance only, L199-203), `organizationId?`, `provider` (`stripe` or `manual`), `providerSubscriptionId unique`, `plan enum pro/business/starter` (L18-22), `tierCredits` (whole credits), `pendingTierCredits`, `pendingAppliedBy`, `interval enum month/year`, `status text`, `priceLookupKey`, `currentPeriodStart/End`, `cancelAtPeriodEnd` | One non-terminal personal sub per user (L248-251), one per org (L253-258) |
| `organization_billing_customers` (L265-301) | Org Stripe customer, kept separate on purpose (L261-264) | `attributionUserId` (affiliate policy snapshot), `createdByUserId`, `openCheckoutSessionId` | `organizationId (r) unique`, user FKs (r) |
| `billing_webhook_events` (L303-322) | Stripe webhook inbox | `id text PK` (Stripe event id), `provider`, `type`, `payload`, `status enum received/processing/processed/failed/skipped`, `attemptCount`, `claimedAt`, `deadLetteredAt` | none |
| `subscription_state_events` (L324-356) | Subscription lifecycle audit | `stripeEventId unique`, `stripeSubscriptionId`, owner pair, `kind enum created/plan_changed/status_changed/cancel_scheduled/cancel_unscheduled/ended`, from/to lookup key and status, `occurredAt` | owner FKs (r) |
| `billing_payment_adjustments` (L358-389) | Refunds and failed payments | `stripeEventId unique`, `kind enum refund/failed_payment`, `stripeObjectId`, owner pair, `amountCents`, `cumulativeRefundedCents` | owner FKs (r) |
| `billing_checkout_attempts` (L391-426) | Checkout session tracking | `id uuid PK` (client-minted), owner pair, `purpose enum subscription/topup`, `priceLookupKey`, `packId`, `providerSessionId unique`, `status enum created/session_attached/completed/expired` | `userId (r)`, `organizationId (r)` |
| `subscription_refill_slots` (L428-474) | Yearly-plan monthly refills | `periodOrdinal 2..12`, `dueAt`, `credits`, `fundingInvoiceId`, `fundingChargeId`, `status enum pending/granted/canceled`, `canceledReason`, `supersededByInvoiceId` | `subscriptionId -> subscriptions (r)` |
| `billing_invoice_applications` (L476-512) | Idempotent invoice -> credit application | `stripeInvoiceId unique`, `billingReason`, old/new lookup key, `periodStart/End`, `creditsDelta`, `amountPaidMinor`, `currency`, `paidAt` | `subscriptionId (r)` |
| `billing_change_intents` (L514-562) | Plan change quotes | owner pair, `currentPriceLookupKey`, `targetPriceLookupKey`, `prorationDate`, `previewTotalMinor`, `anchorReset`, `status enum open/processing/consumed/expired`, provider outcome fields | `subscriptionId (r)` |
| `signup_grant_outbox` (L564-588) | Outbox for the signup grant | PK `userId`, `credits`, `settingsVersion`, `status enum pending/done/skipped`, `attempts` | `userId (r)` |
| `billing_financial_reconciliation_outbox` (L601-628) | Outbox for post-grant charge reconciliation | `chargeId`, `triggerRef` (`inv:` / `slot:` / `topup:`), `status enum pending/done`, `attempts` | none; unique `(chargeId, triggerRef)` |
| `billing_topup_receipts` (L636-661) | Cash record of top-ups | `sessionId unique`, owner pair, `packId`, `amountCents`, `currency`, `chargeId`, `paymentIntentId`, `paidAt` | owner FKs (r) |
| `beta_access_events` (L663-686) | Early-access grant/revoke audit | `action enum granted/revoked`, `actorUserId`, `reason` | user FKs (r) |
| `manual_subscription_requests` (L688-757) | Offline (COD / bank) plan requests | owner pair, `plan`, `tierCredits`, `interval`, contact fields, `preferredPaymentMethod enum cash_on_delivery/bank_transfer/ccp/baridimob/other`, `status enum pending/contacted/approved/rejected/canceled`, `adminNotes`, `handledByUserId`, `subscriptionId` | One open request per owner (L743-752) |
| `manual_subscription_payments` (L762-810) | Append-only offline payment records | `kind enum initial/renewal`, `method`, `amountMinor`, `currency`, `reference`, `periodStart/End`, `idempotencyKey unique`, `recordedByUserId` | `subscriptionId (r)`, `requestId (r)` |
| `cancellation_reasons` (`cancellation-reasons.ts:29-64`) | Cancel survey | `reason enum` (7 values), `details`, `status enum pending/scheduled/resumed/ended/provider_failed`, `endedStateEventId` | `subscriptionId (r)`, `endedStateEventId -> subscription_state_events (r)`. `subscriptionUserId`, `organizationId`, `submittedByUserId` are plain text (no FK). |

### 3.13 MCP connectors — `packages/db/src/schema/mcp-connectors.ts`, `connector-operation-events.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `mcp_connectors` (L24-51) | Catalog of third-party providers (seeded by `apps/server/scripts/seed-mcp-connectors.ts`) | `slug unique`, `name`, `description`, `iconUrl`, `authKind enum mcp_dcr/oauth_prereg` (L19-22), `mcpServerUrl`, `authorizationUrl`, `tokenUrl`, `scopes`, `enabled`, `sortOrder`, `toolPolicy jsonb` | has many `mcp_connections` |
| `mcp_connections` (L53-92) | Per-user OAuth connection + transient authorize state | `oauthState`, `codeVerifier`, `returnUrl`, `clientInfo jsonb` (DCR client), `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `scope`, `connectedAt` | `userId -> user (c)`, `connectorId -> mcp_connectors (c)`; unique `(userId, connectorId)` |
| `connector_operation_events` (`connector-operation-events.ts:24-76`) | Analytics of connector tool calls | owner pair, `connectorSlug`, `toolName`, `targetEntityIds text[]` (GIN, L41, L71-74), `feature enum ads_analysis/ads_launch/other`, `status enum succeeded/failed`, `errorCode`, `errorMessage`, `chatId`, `messageId` (no FK), `durationMs` | `userId (r)`, `organizationId (r)` |

Connections are per user, not per project (`connector-generation-attempts.ts:27-29`). Tokens are stored in plain text columns. UNVERIFIED whether the app layer encrypts them before insert.

### 3.14 Connector generation attempts — `packages/db/src/schema/connector-generation-attempts.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `connector_generation_attempts` (L30-94) | Long MCP generation call moved to Trigger.dev (L16-19) | `organizationId?` (payer snapshot, L37-42), `requestKey`, `connectorSlug`, `toolName`, `args jsonb`, `status enum queued/running/succeeded/failed` (L20-25), `triggerRunId`, `media jsonb` (`[{kind, url}]`), `error`, `failure*`, `sentryEventId`, `startedAt`, `completedAt` | `userId -> user (c)`, `organizationId (n)`, `chatId -> chats (n)`; unique `(chatId, requestKey)`. No `projectId`. |

### 3.15 Image / media generations and marketing assets

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `image_generation_attempts` (`image-generation-attempts.ts:39-108`) | Standalone `generate_image` tool call | `requestKey`, `status enum media_generation_status` (queued/generating/succeeded/failed), `title`, `prompt`, `aspect enum` (7 values, L18-26), `count 1..6` (L103-106), `sourceImageUrls jsonb`, `images jsonb GeneratedImageRef[]` (L28-33, L65), `spec jsonb`, `triggerRunId`, `error`, `failure*`, `sentryEventId` | `projectId (c)`, `chatId (n)`; unique `(chatId, requestKey)` |
| `media_generation_attempts` (`media-generation-attempts.ts:64-226`) | One video workflow, discriminated by `kind` | `kind enum image-animation/text-to-video/video-product/video-edit/video-extension` (L43-49), `sourceAttemptId` (self FK, lineage, L83-86), `model`, `quality`, `talking`, `sourceImageUrl`, `sourceMediaType enum`, `sourceVideoUrl`, `sourceVideoMediaType`, `sourceDurationMs`, `actualDurationMs`, `chainDepth`, `aspect enum 16:9/9:16/1:1`, `motion enum`, `prompt`, `durationSeconds 4..45`, `title`, `voiceover jsonb`, `triggerRunId`, `videoUrl`, `videoMediaType`, failure columns | `projectId (c)`, `chatId (n)`. Two large CHECKs enforce kind/column pairing (L154-188) and lifecycle/column pairing (L189-224). |
| `media_generation_legs` (`media-generation-legs.ts:18-81`) | Continuation legs for retries | `seq`, `status`, `model`, `durationSeconds in (5,10)`, `sourceFrameKey`, `segmentKey`, `error` | `attemptId -> media_generation_attempts (c)`; unique `(attemptId, seq)` |
| `marketing_assets` (`marketing-assets.ts:30-89`) | Marketing tab deliverables | `assetType enum ad-copy/marketing-strategy/video-script/creative-brief/html-asset` (L19-25), `name`, `brief`, `spec`, `r2Key` (`marketing/{projectId}/{assetId}/index.html`), `triggerRunId`, failure columns | `projectId (c)`, `chatId (n)`; unique `(chatId, requestKey)` |

### 3.16 Story links — `packages/db/src/schema/story-links.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `story_links` (L10-31) | Admin-managed short links for campaign attribution | `slug unique`, `name`, `utmSource/Medium/Campaign/Content`, `destinationPath`, `archivedAt` | none |
| `story_link_clicks` (L33-57) | Click log | `ipHash`, `userAgent` | `storyLinkId -> story_links (r)` |

### 3.17 Push tokens — `packages/db/src/schema/push-tokens.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `push_tokens` (L18-36) | Mobile device push registration (one row per install; the token is the device identity, L16-17) | `token unique`, `platform enum ios/android` (L11-14) | `userId -> user (c)` |

### 3.18 Onboarding — `packages/db/src/schema/onboarding.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `user_onboarding` (L5-23) | Questionnaire answers | PK `userId`, `answers jsonb Record<string,string>`, `questionsVersion`, `completedAt` | `userId -> user (c)` |

### 3.19 Admin, analytics, support

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `admin_audit_events` (`admin-audit-events.ts:4-32`) | Admin action trail | `action`, `targetUserId`, `targetId`, `requestId` | `adminUserId -> user (c)`, `targetUserId (n)` |
| `admin_funnel_contacts` (`admin-funnel-contacts.ts:10-33`) | Outreach tracking per person | `contactedByUserId`, `contactedAt` | `userId (r) unique`, `contactedByUserId (r)` |
| `admin_view_grants` (`admin-view-grants.ts:6-23`) | Per-user support dashboard views | PK `userId`, `views jsonb string[]`, `updatedByUserId` | `userId (c)`, `updatedByUserId (n)` |
| `academy_guides` (`academy.ts:4-33`) | Help-center guides | `title`, `description`, `category`, `youtubeUrl`, `youtubeVideoId`, `bodyHtml`, `status`, `publishedAt` | `createdByUserId (r)` |
| `feedback` (`feedback.ts:39-92`) | In-app feedback reports | `reporterName/Email` snapshot, `projectId`, `chatId`, `authSessionId` (all without FK on purpose, L49-58), `category enum bug/idea/other`, `message`, `pageUrl`, `replayUrl`, `sentryEventId`, viewport, `locale`, `screenshotUrl`, `linearIssueId/Url`, `status enum new/reviewing/planned/resolved`, `priority enum`, `adminNote`, `resolvedAt` | `userId (n)` |
| `feedback_activities` (`feedback.ts:94-118`) | Feedback change log | `kind enum received/status_changed/priority_changed/note_updated`, `fromValue`, `toValue` | `feedbackId (c)`, `actorUserId (n)` |
| `lifecycle_events` (`lifecycle-events.ts:35-75`) | Outbox for lifecycle emails | `event enum` (15 values, L17-33), `payload jsonb`, `idempotencyKey unique`, `dispatchAfter`, `dispatchedAt`, `droppedAt`, `dropReason`, `attempts`, `lastError` | `userId (r)` |
| `monthly_costs` (`monthly-costs.ts:13-48`) | Admin cost inputs | PK `month date` (first day check), `currency`, `adSpendBySourceCents jsonb`, `infrastructureCostCents`, `otherCostCents`, `notes`, `version` | created/updated by user (r) |
| `product_events` (`product-events.ts:18-45`) | Product intent events | `kind enum pricing_viewed/upgrade_clicked`, `properties jsonb`, `surface`, `idempotencyKey unique` | `userId (r)` |
| `user_activity_days` (`user-activity.ts:11-26`) | Daily active user marks | PK `(userId, activityDate)` | `userId (r)` |
| `user_attributions` (`user-attributions.ts:16-42`) | Signup acquisition attribution | utm fields, `storyLinkSlug`, `landingPath`, `referrer`, `country`, `device`, `source enum cookie/body` | `userId (r) unique` |

### 3.20 Affiliates — `packages/db/src/schema/affiliates.ts`

| Table | Purpose | Key columns | Relations |
|---|---|---|---|
| `affiliate_programs` (L70-109) | Commission terms | `kind enum percentage_recurring/fixed_one_time`, `commissionRateBps`, `fixedAmountCents`, `fixedCurrency`, `commissionDurationMonths`, `holdDays`, `cookieWindowDays`, `status enum active/archived` | none |
| `affiliates` (L111-142) | Partner record | `userId?` (unique when set), `name`, `email`, `company`, `channel`, `country`, `payoutMethod enum manual/paypal/wise`, `payoutDetails jsonb`, `status enum active/paused`, `notes` | `userId (r)` |
| `affiliate_links` (L144-172) | Tracking links | `code unique`, `label`, `landingPath`, `expiresAt`, `active` | `programId (r)`, `affiliateId (r)` |
| `affiliate_clicks` (L174-199) | Click log | `ipHash`, `userAgent`, `landingUrl` | `linkId (r)` |
| `affiliate_attributions` (L201-257) | Locked attribution per signed-up user | program term snapshot, `clickedAt`, `lockedAt`, `source enum signup_cookie/signup_body/manual`, `status enum active/voided`, `fraudFlags jsonb` | `userId (r) unique`, `linkId`, `affiliateId`, `programId` (r) |
| `affiliate_invoice_candidates` (L259-292) | Paid invoices waiting for attribution | `stripeInvoiceId unique`, `billingReason`, `baseAmountCents`, `currency`, `paidAt`, `status enum pending_attribution/processed/ineligible` | `userId (r)` |
| `affiliate_payouts` (L294-330) | Payout batches | `totalCents`, `currency`, `method`, `externalRef`, `requestId unique`, `status enum draft/processing/paid/failed`, `periodStart/End`, `paidAt` | `affiliateId (r)`, `createdByUserId (r)` |
| `affiliate_commissions` (L332-409) | Earnings and adjustments | `entryType enum earning/adjustment`, `originalCommissionId` (self FK), Stripe invoice/refund/dispute/charge ids, `baseAmountCents`, `rateBps`, `amountCents`, `status enum pending/approved/paid/reversed`, `holdUntil`, `payoutId`, `reversalReason` | `attributionId (r)`, `affiliateId (r)`, `payoutId (r)` |

---

## 4. Relationship diagram (text)

```
user ──< session, account, push_tokens, mcp_connections, user_onboarding, admin_view_grants
user ──< projects (restrict)            organization ──< member >── user
user ──< credit_ledger / ai_usage_events / subscriptions / billing_customers (restrict)
organization ──< projects, credit_ledger, ai_usage_events, subscriptions,
                 organization_billing_customers, organization_billing_settings,
                 organization_member_credit_limits (restrict)

projects ──< chats ──< messages
projects ──< artifacts ──< versions ──(messageId)── messages
projects ──< page_generation_attempts ──(versionId)── versions
projects ──< deployments ──(projectId, versionId)── versions
projects ──< leads ──(projectId, deploymentId)── deployments
projects ──< lead_sheet_syncs, lead_scrape_attempts
projects ──< image_generation_attempts, media_generation_attempts ──< media_generation_legs
projects ──< marketing_assets
projects <──(set null) domains ──(paymentOrderId)── payment_orders ── user

ai_usage_events ──< ai_usage_generation_refs, ai_provider_call_evidence
credit_ledger <── credit_plan_holds ── credit_plan_hold_pools
subscriptions ──< subscription_refill_slots, billing_invoice_applications,
                  billing_change_intents, manual_subscription_requests,
                  manual_subscription_payments, cancellation_reasons

mcp_connectors ──< mcp_connections ── user
connector_generation_attempts ── user (no project)
affiliate_programs ──< affiliate_links ──< affiliate_clicks
affiliates ──< affiliate_links, affiliate_attributions ──< affiliate_commissions >── affiliate_payouts
```

Outside Postgres (owned by `apps/server/src/infrastructure/storage/r2.ts` and the edge worker):

| Key pattern | Line | Meaning |
|---|---|---|
| `sites/{projectId}/{versionId}/index.html` | L65-67 | canonical draft version file (`versions.r2Key`) |
| `sites/{projectId}/{versionId}/{path}` | L71-76 | extra site files, no DB row |
| `published/{projectId}/current.html` | L83-85 | live bytes the edge worker streams |
| `published/{projectId}/v/{deploymentId}.html` | L89-93 | immutable publish archive |
| `sites/{projectId}/assets/{attemptId}/...` | L99-146 | builder images, videos, frames, audio |
| `sites/{projectId}/thumbnails/{versionId}.jpg` | L166-170 | dashboard cover |
| `images/{projectId}/{attemptId}/img-{i}.{ext}` | L177-183 | `generate_image` output |
| `marketing/{projectId}/{assetId}/index.html` | L188-189 | marketing asset |
| `lead-scrapes/{projectId}/{attemptId}/{file}` | L196-201 | scrape export |
| `uploads/{userId}/{uuid}/{filename}` | L207-212 | user uploads (no DB row) |
| KV `domain:{host}` -> `{projectId, source, slug?}` | `apps/edge/src/index.ts:10-16, 61-63` | hostname routing |

Background work: 20 Trigger.dev tasks in `apps/server/src/trigger/*.task.ts` (page build, connector generation, lead scrape, metering sweeps, billing sweeps, domain sync). A BullMQ worker also exists (`apps/worker/src/processors/{ai-generation,lead-processing,media-generation,publish}.processor.ts`, queue names in `packages/jobs/src/index.ts:9-15`). UNVERIFIED which of the two paths handles each operation in production today.

---

## 5. Cross-cutting patterns V2 should copy

1. **Attempt row pattern.** Every long AI operation has: `status` enum with terminal states, a snapshot `spec jsonb`, `requestKey` + unique `(chatId, requestKey)` for tool-call idempotency, `triggerRunId`, `error` + `failureKind/Source/Provider/ProviderMessage/RequestId` + `sentryEventId`, `startedAt`/`completedAt`, and `chatId -> chats (set null)`. Reference: `page-attempts.ts:30-96`, `image-generation-attempts.ts:39-108`. A V2 "agent run" table should follow this exact shape so the AI inspector and admin analytics keep working.
2. **Metering hook.** `ai_usage_events.operation` enum + `attemptRef` links a reservation to an attempt row (`credits.ts:34-44, 293`). Adding a V2 operation is one enum value plus the same reserve/settle/reconcile flow.
3. **Immutable output + mutable pointer.** `versions` never change; `artifacts.activeVersionId` and `deployments.status = active` are the only moving parts. V2 file snapshots should keep this split.
4. **Tenant-proof composite FKs.** Keep `(projectId, childId)` unique targets on every V2 table that another table must point at across the project boundary.
5. **Owner pair.** `userId` + nullable `organizationId` on every row that a workspace can own. Authorization always goes through workspace membership, never through `projects.userId` (`projects.ts:31-34`).
6. **Keys, not URLs.** Store R2 keys and derive URLs at read time.
7. **Kill switches.** New surfaces gate on a `product_settings` boolean (`billing.ts:104-166`). V2 rollout should add one.

---

## 6. V2 proposal

Keep this as a list. No DDL.

### 6.1 Tables V2 reuses unchanged

- Auth: `user`, `session`, `account`, `verification`, `rate_limit`, `auth_email_sends`. Reason: Better Auth owns them; V2 users are the same users.
- Workspaces: `organization`, `member`, `invitation`, `organization_billing_settings`, `organization_member_credit_limits`. Reason: V2 projects use the same owner pair and the same `x-wandit-workspace` scoping.
- Credits: `credit_ledger`, `credit_plan_hold_pools`, `credit_plan_holds`, `ai_usage_generation_refs`, `ai_provider_call_evidence`, `model_prices`. Reason: provider-agnostic ledger; V2 only adds new consume writers.
- Billing: every table in `billing.ts` and `cancellation-reasons.ts`. Reason: plans and money are per owner, not per builder generation. A V2 plan tier may add a `billing_plan` enum value later, but no table change.
- Domains: `domains`, `payment_orders`. Reason: a V2 web app publishes to the same Cloudflare for SaaS hostnames. `domains.projectId` already points at `projects`.
- Connectors: `mcp_connectors`, `mcp_connections`, `connector_operation_events`, `connector_generation_attempts`. Reason: per-user OAuth tokens are builder-independent. V2 may expose the same connections to the harness as MCP servers.
- Media: `image_generation_attempts`, `media_generation_attempts`, `media_generation_legs`, `marketing_assets`. Reason: these hang off `projects.id` and a V2 project can keep using them for assets.
- Leads: `leads`, `lead_sheet_syncs`, `lead_scrape_attempts`. Reason: a V2 web app can still post to the same capture endpoint keyed by `projects.publicFormId`. See 6.2 for the `deploymentId` pairing.
- Story links, push tokens, onboarding, affiliates, admin, feedback, lifecycle, analytics tables. Reason: no builder coupling.

### 6.2 Tables that need new columns or enum values

- `projects` — add a builder kind or "engine" discriminator (`v1_page` vs `v2_app`), a target platform (web, mobile, both), a template/framework identity, and a pointer to the V2 backend/provisioning row. `publicFormId`, `previewToken`, pixels, `hideWanditBadge`, and `deletedAt` stay. Reason: the dashboard, workspace scoping, and cascade graph all key on `projects.id`; a separate `v2_projects` root table would break `domains`, `leads`, media, and org scoping.
- `chats` — add a builder-scope column (which V2 workspace/branch/session the chat drives) and a title. Today a chat has no state beyond timestamps (`chats.ts:29-51`). V2 will want several chats per project (already allowed, L28).
- `messages` — keep `parts jsonb`. Add a link to the V2 agent run row (run id) so a message can be joined to its harness session, tool calls, and file diffs. The `failure_*` columns stay.
- `deployments` — today a row means "static HTML at slug on wandit.app" (`deployments.ts:16-18, 37-38`). Add a target kind (cloudflare static, cloudflare worker/pages, other host, expo update, app-store build), a target reference (host id, worker name, EAS build id), a build log pointer, and make `versionId` optional or pair it with a V2 snapshot id instead. Keep the "one active per project" and "one active slug" partial indexes.
- `leads` — the composite FK `(projectId, deploymentId) -> deployments` (`leads.ts:81-85`) stays valid only if V2 publishes keep writing `deployments` rows. Decide that early (see open questions).
- `ai_usage_events.operation` enum — add V2 operations (for example `agent_run`, `sandbox`, `build`, `provision`). Migration pattern exists (`0065_starter-plan-enum.sql`).
- `ai_provider_call_evidence.transport` enum — add sandbox/compute and harness transports if V2 bills compute minutes or harness tokens outside the AI gateway.
- `artifacts.kind` enum — either add `app` kinds or leave `artifacts` as a V1-only table. Recommendation: leave it V1-only and give V2 its own snapshot table (6.3). The `artifacts_project_landing_uq` "one landing page per project" rule (`artifacts.ts:48-50`) does not fit an app.
- `lifecycle_events.event` enum — add V2 milestones (`app_generated`, `backend_provisioned`, `mobile_build_completed`) if lifecycle emails should fire for V2.
- `product_settings` — add a `v2BuilderEnabled` kill switch (and optionally a per-user `earlyAccess`-style flag on `user`) for the preview rollout.

### 6.3 New tables V2 likely needs

Grouped by concern. Each should follow the conventions in section 1 and the attempt-row pattern in section 5.

**Project content and versions**
- `app_snapshots` (or `project_snapshots`): immutable point-in-time capture of a V2 project's file tree. Columns: `projectId`, `number` (per-project sequence), `parentSnapshotId`, `messageId` / `agentRunId` that produced it, a content manifest (file path -> R2 key + hash + size), a root R2 prefix, `meta` (framework, entry points), `createdAt`. Composite FK targets `(projectId, id)` like `versions`. Replaces `versions` for V2.
- `app_snapshot_files` (optional if the manifest stays in jsonb): one row per file for diffs, search, and large trees. Trade-off: jsonb manifest is simpler; a row table scales better and allows content-addressed dedupe by hash.
- `app_branches` (optional, later): named heads (`main`, `preview`) pointing at a snapshot, so "current draft" is a pointer like `artifacts.activeVersionId`. At minimum, add a `currentSnapshotId` pointer column on `projects` or a one-row-per-project `app_workspaces` table with the composite FK pattern.

**Agent runtime**
- `agent_runs`: the V2 attempt row. One row per harness invocation (a user turn). Columns: `projectId`, `chatId (set null)`, `messageId`, `requestKey`, `status` (queued/running/succeeded/failed/canceled), `harness` + `model` + `provider` snapshot, `spec` (prompt, mode, tool policy), `sandboxSessionId`, `triggerRunId` or equivalent job id, `inputSnapshotId`, `outputSnapshotId`, token/cost fields or a link to `ai_usage_events`, `error` + `failure_*` + `sentryEventId`, `startedAt`, `completedAt`, `dismissedAt`.
- `agent_run_events` (optional): ordered tool-call / file-change / log entries for the inspector, if `messages.parts` is not enough. Alternative: keep everything in `messages.parts` and skip this table at first.

**Sandboxes**
- `sandbox_sessions`: lifecycle of one remote sandbox (provider id, region, image/template, status created/warm/running/stopped/expired/failed, `projectId`, `snapshotId` mounted, preview URL or port map, `expiresAt`, `lastActiveAt`, resource limits, error). Store provider ids, never credentials.
- `sandbox_usage_evidence` or reuse `ai_provider_call_evidence` with a new transport value for compute minutes.

**Backend provisioning (hidden Supabase)**
- `app_backends`: one row per V2 project backend (provider `supabase`, provider project ref, region, status provisioning/active/paused/deleted, API URL, anon key reference, database host reference, created by, timestamps). One-to-one with `projects` via unique `projectId`. Keys go to the secrets table, not here.
- `app_backend_migrations` (optional): applied schema migrations the agent generated, with snapshot id and status, so rollbacks stay consistent between code snapshot and database schema.
- `app_backend_resources` (optional): buckets, edge functions, cron jobs, auth providers the agent enabled, for the product's "Cloud" tab.

**Secrets and env**
- `project_secrets`: per project (and per environment: preview/production) key names with encrypted values or a reference into an external secret store, `createdBy`, `updatedAt`, `lastUsedAt`. Never store plaintext. This is different from `mcp_connections`, which holds per-user OAuth tokens.
- `project_env_vars` can merge into `project_secrets` with an `isSecret` flag.

**Publishing targets**
- `app_builds` (web): one row per build of a snapshot (status, log R2 key, output R2 prefix or worker script version, duration, error). `deployments` then points at a build rather than a `versions` row.
- `mobile_builds`: one row per Expo/EAS build or OTA update (`projectId`, `snapshotId`, `platform ios/android`, `kind dev-client/preview/store/ota`, provider build id, status, artifact URL or key, QR/install URL, `expiresAt`, error).
- `app_hosting_targets` (optional): if V2 supports non-Cloudflare hosts, a per-project target config table keyed by provider.

**Preview streaming for mobile**
- `preview_sessions`: simulator/emulator stream sessions (provider, device profile, status, stream URL/token reference, `sandboxSessionId`, `expiresAt`). Could fold into `sandbox_sessions` with a `kind` column.

**Connectors for apps (Lovable Cloud style)**
- `app_integrations`: project-level enabled integrations (payments/Stripe Connect, email provider, analytics) with provider account references and status. Distinct from user-level `mcp_connections`.

### 6.4 Tables V2 should not touch

`artifacts`, `versions`, `page_generation_attempts` remain the V1 content model. Do not extend `artifact_kind` for apps. V1 keeps working for existing users while V2 rows live in the new tables. Migration of a V1 project to V2 is a one-way import: read the latest `versions.r2Key` HTML, create an `app_snapshots` row, and set `projects` engine to V2.

### 6.5 Rollout notes for the data layer

- Separate endpoint/module can still share the same database and the same `projects` root. Only add columns with defaults so V1 code paths are unaffected.
- Partial unique indexes make coexistence safe: a project with engine `v2_app` never inserts an `artifacts` row, so `artifacts_project_landing_uq` is not hit.
- Enum additions are non-transactional in Postgres (`ADD VALUE` cannot run inside a transaction that also uses the value). The existing migration `0065` shows the repo already handles this as a standalone statement.
- All V2 attempt rows should keep `failure_*` + `sentry_event_id` so `0060_ai-inspector-foundation` tooling covers V2 without change.
- `deployments_active_slug_uq` is global across V1 and V2. That is desirable: one slug namespace on `wandit.app`.

---

## 7. Open questions

1. Should V2 web publishes keep writing `deployments` rows and the KV pointer contract, so `leads.deploymentId`, the admin publish log, and the edge worker stay unchanged? Or does a Worker/Pages target need its own row type? (The edge worker only serves one HTML file per project: `apps/edge/src/index.ts:56-58`.)
2. Is `versions.meta` shaped by a contract, and does anything in the web app depend on a `versions` row for a V2 project (version switcher, thumbnails)? I did not find a `meta` schema in `packages/contracts/src/v1/artifacts.ts` (UNVERIFIED).
3. Which background path is live for page builds today: Trigger.dev `generate-page.task.ts` or the BullMQ `ai-generation.processor.ts`? Both exist. V2 agent runs need one durable job system.
4. Are `mcp_connections.accessToken` / `refreshToken` encrypted at the app layer? The schema stores `text`. V2 `project_secrets` must not copy a plaintext pattern if one exists (UNVERIFIED).
5. One chat per project is only an MVP convention (`chats.ts:28`). Does the web client assume it? V2 likely needs many chats (one per feature or branch).
6. Should V2 mobile builds be metered through `ai_usage_events` (new `operation`) or only through `ai_provider_call_evidence` (new `transport`) when they cost provider money but no model tokens?
7. Will a V2 project's Supabase backend be shared across preview and production environments, or one backend per environment? This decides whether `app_backends` is one-to-one or one-to-many with `projects`.
8. `connector_generation_attempts` has no `projectId` (`connector-generation-attempts.ts:27-29`). If V2 media goes through the harness, decide whether to keep user-scoped attempts or move them under the project.

---

## 8. Evidence index

- Schema barrel: `packages/db/src/schema/index.ts:1-75`
- DB client: `packages/db/src/index.ts:30-58`
- Drizzle config: `packages/db/drizzle.config.ts`; package: `packages/db/package.json`
- Migrations: `packages/db/src/migrations/0000_great_boom_boom.sql` … `0066_signup-grant-7.sql`; journal `packages/db/src/migrations/meta/_journal.json`
- Auth adapter: `packages/auth/src/index.ts:4-5, 44, 223-225, 632-635, 712, 734`
- R2 keys: `apps/server/src/infrastructure/storage/r2.ts:65-237, 257`
- Multi-file version upload: `apps/server/src/trigger/generate-page.task.ts:319-347`
- Edge worker: `apps/edge/src/index.ts:1-63`
- Publishing model: `docs/features/publishing-serving.md` ("Working model")
- Workspace scoping and owner semantics: `docs/features/teams-workspaces.md` §2, §3.2, §4.1, §5.1
- Assets tab union: `apps/server/src/modules/project-assets/infrastructure/persistence/project-assets.repository.ts:3-9`
- Trigger tasks: `apps/server/src/trigger/*.task.ts` (20 files); BullMQ queues: `packages/jobs/src/index.ts:9-24`; worker processors: `apps/worker/src/processors/`
- Native app: `apps/native/package.json` (`expo ~56.0.3`, `react-native 0.85.3`)

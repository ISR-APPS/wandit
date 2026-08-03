# Teams / Workspaces v1 — Business plan, org credit pooling, member roles

> Status: **Design — Revision 2** (post two-track adversarial review; pre-implementation).
> Revision 1 was reviewed by a codex read-only pass (15 findings) and a 13-agent Claude
> fleet (19 findings, 7 adversarially confirmed — 5 critical). Every confirmed finding is
> folded in below; §14 lists the review-driven changes so the deltas are auditable.
> Builds directly on `docs/features/billing-v2-subscriptions-credits-affiliates.md` and the
> shipped billing v2 system (branch `feat/billing-subscriptions`, HEAD `856fb49`).

## 0. Product summary

- A **workspace** is either the user's **Personal** space (implicit, exists today) or an
  **organization** (Better Auth organization). Slack/Notion-style switcher; everything —
  projects list, credit balance, billing — is contextual to the active workspace.
- **Business plan**: second catalog plan, same tier ladder as Pro at **2× the price per credit**
  (100 cr/$50 … 5,000 cr/$2,250 monthly; yearly = monthly × 10 = 2 months free). Unlimited
  seats; the pool is what's priced, not chairs.
- **Entity rule**: at most one live subscription per entity (user or org). A person may hold a
  personal Pro *and* administer any number of org Business subscriptions.
- **Pooling**: work done in an org workspace debits the org pool; the acting member is recorded
  on every usage event. Optional per-member credit limits (calendar-month UTC).
- **Roles v1**: fixed `owner` / `admin` / `member` (Better Auth defaults + our permission
  statements). Custom/dynamic roles deferred.
- **Kill switch**: `product_settings.organizationsEnabled` (default **false**) gates workspace
  creation and Business checkout — same beta posture as billing v2.
- **AI**: enforce permissions in server tools/routes (typed errors), inform in the prompt
  (role + capability block in the agent context).

### Explicitly deferred (non-goals for v1)

- SSO/SAML; sub-teams (`teams.enabled` stays off); dynamic access control / custom roles.
- **Workspace deletion** (`disableOrganizationDeletion: true`). Better Auth 1.6.22's delete is
  non-transactional and deletes only member/invitation rows (`adapter.mjs:266`); our RESTRICT
  FKs from projects/ledger/subscriptions would make it fail — and a live renewing Business sub
  must never be strandable behind a deleted org. Soft-delete/offboarding is its own batch.
- Transferring existing personal projects into an org (upload namespaces are user-prefixed
  (`projects.service.ts:291`) and `domains.userId` duplicates ownership (`domains.ts:30`)).
  v1 orgs start with new projects.
- Cross-customer proration when upgrading personal→Business (see §5.6).
- Org-owned domain purchases: domain buying stays personal (payer = acting user, personal
  Stripe customer — unambiguous now that org customers live in their own table, §5.1); an org
  project can have a domain attached only by a member holding `domain:manage` — this includes
  the purchase-with-attach path `POST /v1/orders/domain` (`orders.controller.ts:29`), which
  gets the same workspace permission guard when `projectId` targets an org project.
- Legacy BullMQ chat path (`apps/worker` `ai-generation.processor`): personal-only. Legacy
  generation endpoints **reject** an org workspace header with a typed 400
  (`WORKSPACE_NOT_SUPPORTED`) rather than silently debiting the member's personal pool; their
  repositories are excluded from the §6.2 predicate swap.

---

## 1. Better Auth organization plugin

Installed better-auth is **1.6.22**; the plugin ships in it (probe P1 verified the full option
surface at `plugins/organization/types.d.mts`).

### 1.1 Server configuration (`packages/auth/src/index.ts`)

```ts
organization({
  allowUserToCreateOrganization: async (user) =>
    options.canCreateOrganization ? options.canCreateOrganization(user) : false,
  creatorRole: "owner",
  membershipLimit: 10_000,                      // "unlimited seats" (100 default would cap paid
                                                // orgs — crud-invites.mjs:275); 10k = abuse bound
  disableOrganizationDeletion: true,            // §0 non-goals
  invitationExpiresIn: 60 * 60 * 24 * 7,        // 7 days
  cancelPendingInvitationsOnReInvite: true,
  ac, roles,                                    // §1.3
  organizationHooks: {
    afterCreateOrganization: ...(analytics),
    afterAddMember: ...(analytics),             // fires on direct add + org creation
    afterAcceptInvitation: ...(analytics),      // invitation accepts do NOT fire afterAddMember
                                                // (crud-invites.mjs:280) — both hooks needed
  },
  sendInvitationEmail: async (data) => options.onInvitationCreated?.(data),
})
```

- `canCreateOrganization` / `onInvitationCreated` are injected from Nest exactly like the
  existing `onUserCreated` hook (`auth.module.ts:60`): the callback consults
  `ProductSettingsService` (`organizationsEnabled`).
- **No email infra exists in the repo** → v1 invitation delivery is (a) copyable invite link
  (`{WEB_URL}/invite/$invitationId`) surfaced to the inviter, and (b) in-app: pending
  invitations for the signed-in user's email shown on the dashboard
  (`organization.listUserInvitations()`; Google users are email-verified so the browser gate in
  `crud-invites.mjs:591` passes). `onInvitationCreated` only logs/captures analytics for now.
- **Re-invite rule**: the web NEVER calls `inviteMember({ resend: true })` — in 1.6.22 the
  resend branch reuses the stored role and returns before `cancelPendingInvitationsOnReInvite`
  runs (`crud-invites.mjs:135` vs `:163`), so a role downgrade on re-invite would be silently
  ignored. Changing an invitee's role = cancel the pending invitation, then invite fresh.
- `teams` and `dynamicAccessControl` stay **unset** (off).
- Organization Better Auth routes ride the existing public catch-all `/api/auth/*`
  (`auth.controller.ts:18`). `organization/delete` is disabled via the plugin option; nothing
  else is added to `disabledPaths`.
- **Known upstream edges (accepted v1, with mitigations)**:
  - *Zero-owner race*: two owners concurrently leaving/demoting can pass the "not last owner"
    count (`crud-members.mjs:399`, `:289`) and leave an ownerless org that no HTTP call can
    repair (`:295`). Mitigation: admin repair endpoint (§10) writes the member row directly;
    web UI blocks leave/demote for the last *visible* owner.
  - *Org creation is not atomic* (`crud-org.mjs:74`): a mid-flight failure can leave an
    ownerless org holding a slug. Rows without members are invisible to users; the UI treats
    "slug taken" as "pick another name"; admin repair can delete-or-adopt strays.
  - *Members can list pending invitations* (`crud-invites.mjs:523` checks membership only):
    accepted for v1 — same-workspace members seeing who's been invited is Slack-normal.

### 1.2 Client configuration

- `apps/web/src/features/auth/lib/auth-client.ts`: add `organizationClient({ ac, roles })`.
- **Explicit-org rule**: every org client call passes `organizationId` explicitly
  (`inviteMember`, `removeMember`, `updateMemberRole`, `listMembers`, `listInvitations`,
  `cancelInvitation`, `leave`, …). Ambient `session.activeOrganizationId` is never relied on —
  the same cross-tab staleness §2 exists to prevent applies to membership mutations.
- `apps/admin`: no org client plugin (admin talks to our own `/admin/organizations` API).

### 1.3 Access control statements + roles (shared module `packages/auth/src/permissions.ts`)

```ts
const statement = {
  ...defaultStatements,                       // organization, member, invitation, ac
  project: ["create", "update", "delete"],
  publish: ["manage"],                        // publish/rollback/unpublish
  domain:  ["manage"],                        // attach/verify/primary/detach + buy-with-attach
  billing: ["manage"],                        // checkout/change/cancel/resume/portal for the org
  limits:  ["manage"],                        // member credit limits
} as const;
export const ac = createAccessControl(statement);
export const roles = {
  owner:  ac.newRole({ ...full statement... }),
  admin:  ac.newRole({ everything except organization:["delete"] AND billing:["manage"] }),
  member: ac.newRole({ project: ["create", "update"], publish: ["manage"] }),
};
```

**Billing is OWNER-ONLY** (Zack's explicit product decision, 2026-08-03): checkout, top-ups,
plan changes, cancel/resume, and the Stripe portal require the `owner` role. Admins manage
members/projects/limits/domains but never money. Besides the simpler mental model, this
structurally removes the payer-vs-creator ambiguity from affiliate commissions (§8's creator
snapshot stays as belt-and-suspenders).

Member CAN publish in v1 (core product loop); the permission exists so tightening later is a
config change. Member cannot delete projects, manage domains/billing/members/limits.

**Role parsing**: `member.role` is a comma-separated multi-role string in this plugin version
(`organization.mjs:18`); our server-side permission check uses the plugin's own semantics
(split on comma; any role granting the permission passes) — never `role === "admin"` string
equality.

### 1.4 Schema (hand-written Drizzle, repo convention: camelCase props / snake_case columns)

New file `packages/db/src/schema/organizations.ts`. **The Better Auth drizzle adapter only sees
the schema object it is given** — `packages/auth/src/index.ts:39` currently passes
`@wandit/db/schema/auth` alone, and the adapter throws for missing model keys
(`drizzle-adapter/index.mjs:79`). The auth package therefore passes a merged object:

```ts
import * as authSchema from "@wandit/db/schema/auth";
import * as orgSchema from "@wandit/db/schema/organizations";
const schema = { ...authSchema, ...orgSchema };   // exports MUST be named
                                                  // organization, member, invitation
```

| Table | Columns (per plugin runtime schema `organization.mjs:239/277/315`) | Extra (ours) |
|---|---|---|
| `organization` | id text PK, name, slug (unique), logo?, metadata? (text-JSON), createdAt tz | index on createdAt |
| `member` | id text PK, organizationId FK→organization (cascade), userId FK→user (restrict), role (default `member`), createdAt | **UNIQUE(organizationId, userId)** — plugin omits it (P1 gotcha 14). Note: the invitation-accept path inserts without a find (`crud-invites.mjs:280`), so a double-invite race can hit this constraint *after* the invitation was consumed; the accept endpoint's error handler maps unique-violation → "already a member" (invitation burned, membership intact — safe outcome). |
| `invitation` | id text PK, organizationId FK, email, role?, status (default `pending`), expiresAt, createdAt, inviterId FK→user | index (organizationId, status), index (email) |

`session` gains `activeOrganizationId text` (nullable, no FK — plugin-managed; the plugin
writes it on org create/setActive, so the column must exist even though our API scoping never
reads it — §2).

---

## 2. Workspace request scoping — explicit, single-source

Better Auth persists an "active organization" per session row, but billing correctness must not
depend on ambient session state. **The API scopes by an explicit request header, and the header
is the ONLY scope source:**

- Contract constant `WORKSPACE_HEADER = "x-wandit-workspace"`; value = an organization id, or
  absent/`personal` = personal workspace. (Native app and all existing callers send nothing →
  personal; fully backward compatible.)
- **Workspace-scoped routes carry no `:organizationId` URL parameter** (§7) — a URL/header
  split would create two authorities that can disagree (confirmed review finding). Admin routes
  (§10) keep URL params because they are `AdminGuard`-scoped, not workspace-scoped.
- `WorkspaceContextGuard` (registered after `AuthGuard`, same `APP_GUARD` pattern as
  `auth.module.ts:95`): **skips `@Public()` routes entirely** (same reflector check as
  AuthGuard — public routes have no `request.user` and must not 500 on a stray header).
  Otherwise: resolves the header; for an org value loads the caller's `member` row; non-members
  get **404** (information-hiding posture of `projects.service.ts:67`). Attaches
  `request.workspace: { kind: "personal" } | { kind: "org"; organizationId; role; permissions }`.
- `@CurrentWorkspace()` param decorator; `@RequireWorkspacePermission("billing", "manage")`
  route decorator checked against the role matrix (server-side check via the shared `ac`/`roles`
  module with comma-split role parsing — no HTTP round-trip).
- **CORS**: `x-wandit-workspace` is added to the API's CORS `allowedHeaders` in the same
  package as the guard (P1) — it must be live **before** any web bundle that sends the header
  (§11 sequencing), or every cross-origin preflight fails.
- Client injection (§9) covers **both** transports: the Axios instance (`BaseService.ts:81`)
  AND the AI-chat fetch transport (`use-ai-chat.ts:134` builds a `DefaultChatTransport` on
  `globalThis.fetch`, bypassing Axios — confirmed review finding). P5 includes a grep-audit for
  any other direct `fetch` to the API origin.
- Better Auth `setActive` is still called on switch (keeps `useActiveOrganization` coherent for
  UI), but the server never trusts it for scoping, and membership mutations pass explicit
  `organizationId` (§1.2).

## 3. The credit owner abstraction

One shared domain type used by credits, metering, and billing:

```ts
type CreditOwner =
  | { type: "user"; userId: string }
  | { type: "org"; organizationId: string };
```

### 3.1 Advisory locks — compatibility invariant

Five repositories share the raw `hashtext(userId)` namespace byte-for-byte
(`credits.repository.ts:508`, `subscription-credits.repository.ts:38`, checkout attempts,
change intents, refund reconciliation — P2 gotcha 5). **Personal lock keys stay exactly the raw
user id.** Org locks use `hashtext('org:' || organizationId)` — a namespace no raw Better Auth
user id can collide with. One helper `creditOwnerLockValue(owner)` in a shared module; every
one of the five sites switches to it in the same package (P2), never piecemeal.

### 3.2 `credit_ledger` (`packages/db/src/schema/credits.ts:53`)

- `userId` becomes **nullable**; new CHECK `user_id IS NOT NULL OR organization_id IS NOT NULL`.
- Row semantics: personal rows — `userId` set, `organizationId` NULL (all existing rows,
  unchanged). Org rows — `organizationId` set; `userId` = acting member for consumption rows
  (provenance/attribution), NULL for grants/refills/topups/revokes originating from invoices.
- `organizationId` gains FK → organization (restrict) and indexes `(organizationId, createdAt)`
  and `(organizationId, bucket)`, both partial `WHERE organization_id IS NOT NULL`.
- Balance queries (`credits.repository.ts:476`): personal → `userId = X AND organizationId IS
  NULL`; org → `organizationId = O`. Existing rows are all org-NULL → personal balances are
  bit-identical before/after migration.
- **Idempotency fingerprint compatibility** (`credits.service.ts:1271`): personal writes keep
  the exact current fingerprint shape (`userId` field, no new keys). Org writes use a
  fingerprint with `organizationId` and `actorUserId`. Replays of pre-deploy personal rows must
  keep matching — hard invariant with a regression test.
- Ledger idempotency keys: shapes unchanged (resource-scoped, globally unique).

### 3.3 Plan holds (`credit_plan_hold_pools`, `credit_plan_holds`)

Same treatment as the ledger: `organizationId` nullable FK on both; `userId` nullable with the
same CHECK; owner-scoped queries via the same helper. Org plan rollover works identically to
personal because holds/pools are pool-owner-scoped.

### 3.4 `CreditsService` / `CreditsRepository`

All owner-taking methods (`getBalance`, `listLedger`, `consume`, `grant`,
`grantWithReplayStatus`, `applyCappedRefill`, `topup`, `expirePlanRemainder`, `expireAmount`,
`revoke`, `refundConsumeAmount`, `markPlanHoldInactive`) change `userId: string` →
`owner: CreditOwner`, plus `actorUserId?: string` on `consume` (stamped on org consumption
rows). Bucket policy (`plan → promo → topup`, reverse refunds, overdraft-to-topup —
`credits.service.ts:1293`) is owner-agnostic and unchanged.

## 4. Metering — org pool + member attribution + per-member limits

### 4.1 `ai_usage_events` (`credits.ts:219`)

- Add nullable `organizationId` FK + index `(organizationId, userId, createdAt)` partial.
- `userId` stays **NOT NULL = acting member** (actor attribution is never lost).
- Payer derivation: `payerOwner(event) = organizationId ? org : user`.

### 4.2 Service changes (`metering.service.ts`)

- `reserve` / `reserveWithReplay(operation, subject: { actorUserId; organizationId?: string | null }, estimate)`.
  All debit/refund/adjustment paths (`applyCreditAdjustment`, `refundReserved`, settle/reconcile
  consume+grants, `terminalizeReconciliationFailure` hold closes) act on the payer owner.
- Parent/child guard (`:362`) becomes **same-payer**: parent and child must resolve to the same
  `CreditOwner` (actor may differ — a different member continuing a chat still reserves under
  the same org payer).
- Gateway attribution (`gateway-metering.ts:94`): `user` stays the acting user id;
  `quotaEntityId` becomes the payer owner key (`org:{id}` or userId); tags gain `ws:org` /
  `ws:personal`.
- Reconciliation, stranded recovery, sweeps: unchanged logic; payer derives from the stored
  event row.

### 4.3 Per-member limits

New tables (`packages/db/src/schema/organizations.ts`):

- `organization_billing_settings`: `organizationId` PK/FK, `defaultMemberMonthlyCreditLimit
  int?` (NULL = unlimited), `updatedByUserId`, `updatedAt`.
- `organization_member_credit_limits`: id uuid PK, `organizationId` FK, `userId` FK,
  `monthlyCreditLimit int` (>0), `updatedByUserId`, timestamps, UNIQUE(organizationId, userId).

Enforcement — inside the reserve transaction, **after** the org balance lock is held (so two
concurrent reserves by the same member serialize; same guarantee class as the overdraft guard):

```
limit  = memberLimit ?? orgDefault ?? ∞
period = CALENDAR MONTH UTC                     // NOT the subscription period: a yearly
                                                // Business sub has a 12-month Stripe period
                                                // (stripe-subscription-sync.service.ts:243),
                                                // which would turn "monthly" caps into annual
                                                // caps (confirmed finding)
spent  = SUM(COALESCE(final_credits, reserved_credits)) over ai_usage_events
         WHERE organizationId = O AND userId = member AND createdAt >= date_trunc(month, now())
if spent + estimate.credits > limit → MemberCreditLimitError (403,
  MEMBER_CREDIT_LIMIT_REACHED, details { limitCredits, spentCredits, requiredCredits })
```

- Owner/admin are exempt from the default limit but honor an explicit per-member row.
- **Limit writes serialize with reserves**: the member-limits PUT (§7) acquires the same org
  credit advisory lock in its transaction — a lowered limit can never interleave with an
  in-flight reserve that read the old value (review finding).
- Settlement/reconcile overdraft is intentionally NOT limit-checked (provider work already
  happened — same rationale as `allowOverdraft: true`).

## 5. Billing owner abstraction

### 5.1 Org Stripe customers — separate table (review-driven redesign)

Revision 1 relaxed `billing_customers` uniqueness to admit org rows. Both review tracks
independently confirmed that breaks the personal money path three ways: the shipped
`ON CONFLICT (user_id)` upsert loses its arbiter the moment the partial index lands
(new-customer checkout outage, `billing-customers.repository.ts:41`); `findByUserId` becomes
ambiguous for every org creator (personal renewals/top-ups dead-letter, domain purchases can
charge the org's card, `orders.service.ts:304`); and the personal portal could return the org
customer — whose portal config allows cancellation — letting a demoted creator cancel the org's
subscription (`billing.service.ts:307`, `stripe.provider.ts:739`).

**Fix: `billing_customers` is untouched — schema, uniques, upsert, lookups all byte-identical.**
New table `organization_billing_customers`:

| Column | Notes |
|---|---|
| id uuid PK | |
| organizationId text FK→organization (restrict), **UNIQUE** | one customer per org |
| provider text, providerCustomerId text | UNIQUE(provider, providerCustomerId) |
| attributionUserId text FK→user (restrict) | affiliate policy snapshot (§8): the org's earliest `owner`-role member at customer-creation time — NOT the checkout actor |
| createdByUserId text FK→user (restrict) | audit: who triggered creation |
| openCheckoutSessionId text? | same serialization role as the personal column |
| createdAt / updatedAt | |

- `ensureOrgCustomer(organizationId, actor)`: lock `billing-customer:org:{organizationId}`;
  Stripe customer metadata `{ organizationId, attributionUserId, createdByUserId,
  ...affiliateCode-of-attribution-user }`; idempotency key `customer:org:{organizationId}`.
- Owner resolution for webhooks: `resolveOwnerByProviderCustomerId(providerCustomerId)` →
  checks `billing_customers` then `organization_billing_customers`, returns
  `{ owner: CreditOwner, attributionUserId }`. The `(provider, providerCustomerId)` uniqueness
  in each table plus Stripe's global customer-id uniqueness make the union unambiguous.
- Personal code paths (`findByUserId`, `upsertByUserId`, portal, orders/domains reconciliation
  — `orders.service.ts:304`) never see org customers by construction. No migration risk window.

### 5.2 `subscriptions` (`billing.ts:120`)

- `organizationId` gains FK → organization (restrict). `userId` stays NOT NULL: for org subs it
  mirrors `organization_billing_customers.createdByUserId`-at-purchase — **provenance only;
  no money path reads it** (§5.4).
- Uniqueness rework (drop + recreate in migration):
  - `subscriptions_userId_nonTerminal_uq` → partial adds `AND organization_id IS NULL`.
  - NEW `subscriptions_orgId_nonTerminal_uq` on `organizationId`
    `WHERE organization_id IS NOT NULL AND status NOT IN ('canceled','incomplete_expired')`.
- **The entire subscription resolution family becomes owner-keyed** (confirmed critical: a
  creator with personal Pro + org Business has two entitled rows under one `userId`, and every
  `…ByUserId` resolver silently cross-talks between them):
  - `SubscriptionsRepository.findActiveByUserId` → `findActiveByOwner(owner)`
    (personal adds `organization_id IS NULL`).
  - `SubscriptionCreditsRepository.findCanonicalEntitledByUserId` →
    `findCanonicalEntitledByOwner(owner)` (`subscription-credits.repository.ts:51` — WHERE
    owner predicate, same `updatedAt DESC` tie-break *within* the owner). This is the
    resolution authority at three money sites and all three become owner-scoped:
    grant canonical assert (`subscription-credits.service.ts:366`), deletion-expiry
    `anotherEntitled` check (`:293` — must only look for another sub **of the same owner**),
    and refill canonical match (`subscription-refill.service.ts:201` — slot owner =
    `CreditOwner` from the slot's subscription row).
- **Ownership assertions compare `CreditOwner`, never `userId`**: Stripe subscription/checkout
  metadata gains `organizationId` for org flows (`stripe.provider.ts:881`);
  `assertSubscriptionOwnership`-class checks and the event router's redundant cross-checks
  (`stripe-event-router.service.ts:314`) compare owner identity (org id ↔ org id, or user id ↔
  user id with org absent on both sides). A purchaser-vs-creator `userId` difference on an org
  sub is legal and irrelevant (confirmed major).
- `StripeSubscriptionSyncService`: resolves customer → owner via §5.1; writes `organizationId`
  from the org customer (today it hardcodes `null`, `:243`); canonicalization keyed by owner.

### 5.3 Checkout attempts + change intents

Both tables gain nullable `organizationId`; repository locks move to `creditOwnerLockValue`;
`beginProviderAttempt`/`completeProviderAttempt` predicates include the owner; replay
comparisons extend to org. Stripe idempotency keys for org flows:
`sub-checkout:org:{orgId}:{attemptId}`, `sub-change:org:{orgId}:{intentId}` (personal shapes
unchanged).

### 5.4 `BillingService` + controller scoping

Every method that today derives scope from `@CurrentUser()` (`billing.controller.ts:41-112`)
gains the workspace dimension via `@CurrentWorkspace()`:

- Personal workspace → behavior byte-identical to today (same tables, same queries).
- Org workspace → `@RequireWorkspacePermission("billing", "manage")` on checkout, topup,
  change/preview, cancel, resume, portal, sync; subscription view readable by any member.
- `checkout` with org scope requires `plan: "business"`; personal scope requires
  `plan: "pro"` (v1 pairing rule; typed 400 otherwise).
- Org portal sessions are created from the **org** customer id only; personal portal from the
  personal customer only — the §5.1 table split makes crossover structurally impossible.
- Top-ups: org top-ups allowed for billing managers; ledger row `organizationId` set;
  `topupsEnabled` still applies.
- `SubscriptionCreditsService.userIdForInvoice` (`:776`) → `ownerForInvoice`, returning
  `CreditOwner`. **Rung precedence (explicit)**: (1) invoice subscription-detail metadata —
  `organizationId` if present wins over `userId`; (2) expanded subscription metadata, same
  rule; (3) local subscription mirror → its owner; (4) customer mapping via §5.1 resolver.
  Any rung disagreeing with a *later* resolved rung on owner identity → dead-letter (same
  posture as today's user mismatch).
- `PaymentRefundsService.singleOwner` (`:480`): owner-set comparison uses `CreditOwner`
  equality; **pending-refill-slot owner recovery derives the owner from the slot's
  subscription row (`organizationId ?? userId`), not `subscriptions.userId`** — otherwise org
  clawbacks would compare org-resolved grant rows against the creator user and throw
  "different owners", leaving refunded org credits unrevoked (confirmed major).
- Kill-switch guards: `SubscriptionsEnabledGuard`/`TopupsEnabledGuard` unchanged; new
  `OrganizationsEnabledGuard` additionally on org-scoped billing admission + workspace
  creation. Webhooks always honor paid money regardless of toggles (unchanged principle) —
  including org invoices while `organizationsEnabled` is off.

### 5.5 Business catalog + seed

- `billingPlanIds = ["pro", "business"]`; `BILLING_CATALOG.plans.business =
  { basePer100Usd: 50, monthlyPricesUsd: {100:50, 200:100, 400:200, 800:400, 1200:588,
  2000:960, 3000:1410, 4000:1840, 5000:2250} }` (exactly 2× Pro per tier; yearly ×10 rule
  shared). `billing-catalog.spec.ts` locks both tables.
- Plan `features` become catalog data: `pro → {seats:false, teamWorkspace:false}`,
  `business → {seats:true, teamWorkspace:true}`; `BillingService.plans()` reads them.
- `seed-stripe.ts` needs zero structural change (it iterates `billingPlanIds`); run against
  Stripe TEST first. Lookup keys: `business_{tier}_{month|year}`.
- `admin-user.mapper.ts:96` `normalizePlan` recognizes `business`; admin `planClasses` record
  gains the key (compile-enforced).
- The DB enum already contains `business` — no enum migration needed.

### 5.6 Personal → Business upgrade flow (the org birth moment)

1. User picks Business (landing/plan picker) → "Name your workspace" step → client calls
   `organization.create({ name, slug })` (gated by `organizationsEnabled`). Slug conflicts
   surface as "name taken — pick another" (org creation is not atomic upstream; §1.1).
2. Client switches active workspace to the new org → Business checkout for that org (§5.4) →
   standard Stripe Checkout → webhook grants the org pool.
3. The personal sub (if any) is untouched — we never silently cancel a paid thing, and no
   cross-customer proration in v1. The owner cancels it themselves from the personal
   workspace's billing page. (A one-click "cancel personal plan at period end" offer on the
   success screen was considered and DEFERRED: the success page runs in org scope and the
   cancel targets the personal scope, which needs cross-scope request plumbing that does not
   exist yet.)
4. Org exists with no live sub (checkout abandoned) → workspace works but is unfunded: members
   can be invited, projects created; any metered reserve fails 402 → upgrade modal points the
   billing manager at Business checkout. (Admin can also promo-grant an org for beta.)

## 6. Projects + org authorization

### 6.1 Schema (`projects.ts:23`)

- `projects.organizationId` nullable FK → organization (restrict); `userId` stays NOT NULL =
  creator. Personal project: org NULL + authz by `userId`. Org project: authz by membership;
  `userId` is provenance only.
- Indexes: `(organizationId, updatedAt) WHERE deleted_at IS NULL AND organization_id IS NOT
  NULL`; personal dashboard queries add `AND organization_id IS NULL` (existing index stays).

### 6.2 Authorization predicate swap

Every `projects.userId = :me` predicate (full inventory in probe P3 §1.7: projects, chats,
pages, sites/deployments, domains, project assets, image/media/marketing repositories, leads,
lead-scrapes, lead-sheet-syncs — **plus the Orders module**, `orders.service.ts:89/304`, which
Revision 1 missed; **minus the legacy generation chat repository**, §0) moves to a single
repository-level scope helper:

```ts
projectScopePredicate(scope):    // scope = request.workspace
  personal → userId = me AND organizationId IS NULL
  org      → organizationId = O          // membership already proven by WorkspaceContextGuard
```

`getOwnedProject` / `findOwnedChatById` / `assertProjectOwned` become `*ForScope(scope, ...)`
with identical 404 posture. Role checks layer at controllers via
`@RequireWorkspacePermission` (`project:delete` on delete, `domain:manage` on domain
attach/verify/primary/detach AND on `POST /v1/orders/domain` when it targets an org project,
`publish:manage` on publish/rollback/unpublish — personal workspace bypasses role checks
entirely).

Creating a project in an org workspace writes `organizationId = O, userId = actor` and requires
`project:create`.

### 6.3 Payer changes in background work

- `generate-page.task.ts:82` selects `projects.userId` as payer → selects
  `{userId, organizationId}` and reserves against the project's owner entity; actor = the
  attempt's initiating user.
- Image/video/marketing runners' ownership assertions (`image-generation-runner.ts:237` et al.)
  compare `(projectId, ownerEntity)` payload vs reload (a member who left mid-generation does
  NOT strand org work); refunds go to the payer owner recorded on the reservation. Payload
  types gain optional `organizationId?: string | null` (pre-rollout jobs unaffected, same
  convention as `usageEventId`).
- Lead scrape / transcription / connector flows: payer = active workspace owner at admission,
  actor = user.

### 6.4 AI chat + tools

- Admission: `findAccessibleChatById(scope, chatId)` (join project, scope predicate).
- `prepareStream` reserves with `{ actorUserId, organizationId }`; the same subject flows to
  every tool's fixed-operation billing adapter — their `reserve(userId, ...)` signatures
  become `reserve(subject, ...)`.
- **Prompt injection**: `ChatRequestContext` (`request-context.ts:13`) gains
  `workspace?: { name; role; can: string[]; cannot: string[] }`; `buildChatRequestContext`
  renders a `## Workspace` block ("You are working in 'Acme Marketing'. This user's role is
  member: they can create/edit pages and publish, but cannot delete projects, manage domains,
  or manage billing — if asked, direct them to a workspace admin."). Tools stay the enforcement
  layer; the block only makes refusals graceful.
- In-flight stream cap (`MAX_IN_FLIGHT_STREAMS_PER_USER`, process-local) keys by actor —
  unchanged.

## 7. Contracts (`packages/contracts`)

- `v1/workspaces.ts` (new): `WORKSPACE_HEADER`, workspace summary schema
  (`{ id, name, slug, logo, role }`), member/limit schemas. **Workspace-scoped routes are
  header-scoped and carry no org URL param** (§2): `GET /api/v1/workspaces` (my orgs + role;
  personal-scope callable), `GET/PUT /api/v1/workspace/member-limits` (org scope required,
  `limits:manage` for PUT; PUT takes the org credit lock — §4.3). Per-member spend this
  calendar month ships as `spentThisMonth` inside the member-limits GET response — there is
  no separate members-usage route.
  Membership CRUD itself stays on Better Auth routes with explicit `organizationId` (§1.2).
- `v1/billing.ts`: catalog additions (§5.5); checkout/change bodies unchanged (scope from the
  header only).
- `v1/credits.ts`: balance/ledger responses unchanged (owner-implicit via header).
- `v1/settings.ts`: `organizationsEnabled` through the full 13-step toggle chain (public
  projection included — web shows/hides workspace creation).
- `http/error-codes.ts`: add `MEMBER_CREDIT_LIMIT_REACHED`, `ORGANIZATIONS_DISABLED`,
  `WORKSPACE_PERMISSION_DENIED`, `WORKSPACE_NOT_SUPPORTED` (legacy paths, §0).
- `v1/admin.ts`: organization list/detail/grant/repair schemas + routes (§10).

## 8. Affiliates policy for org revenue

Org invoices attribute to `organization_billing_customers.attributionUserId` — snapshotted at
org-customer creation as the org's earliest `owner`-role member (deterministic; NOT the
checkout actor, closing the confirmed hole where a referred invited admin runs the first
checkout and captures lifetime commissions on the org's revenue).
`AffiliateCommissionService.handlePaidInvoice` resolves via the §5.1 owner resolver and
processes against the attribution user's affiliate attribution; machinery otherwise unchanged.
Self-referral guard unchanged. Documented in affiliate admin docs.

## 9. Web app

- **WorkspaceProvider** (root-level): active workspace state (`'personal' | organizationId`),
  persisted per-user in localStorage; hydrates from `useListOrganizations`; exposes
  `switchWorkspace()` (calls `organization.setActive` for UI coherence + updates state).
- **Header injection — two transports** (§2): the Axios request interceptor
  (`BaseService.ts:81`) AND the AI-chat `DefaultChatTransport` construction
  (`use-ai-chat.ts:134` — pass `headers` into the transport). P5 includes a repo grep for any
  other direct `fetch` to the API origin (attachment/upload paths) and covers them.
- **Query keys**: `projectKeys`, `billingKeys`, `creditsKeys` gain a leading workspace segment
  — `['projects', ws, 'list']` etc. Switching workspaces changes keys → clean cache
  partition. Balance poll + terminal invalidation helpers move to the scoped keys.
- **WorkspaceSwitcher** (dropdown; `packages/ui` primitives): mounted in the dashboard sidebar
  header (`app-sidebar.tsx:74`) and the workspace header left cluster
  (`workspace-header.tsx:24`, beside the project-level ProjectSwitcher). Items: Personal, each
  org (logo/name/role), "Create workspace" (visible when `organizationsEnabled`).
- **Workspace settings surface** (routes under `/_auth`): `/workspace/members` (list, roles,
  remove, leave — guarded against last-owner self-removal client-side; invite dialog with
  copyable link; re-invite = cancel + fresh invite, §1.1), `/workspace/limits` (default +
  per-member limits + usage-this-month table), org billing reuses `/billing` scoped by the
  active workspace.
- **Invite accept**: `/invite/$invitationId` route → `organization.getInvitation` →
  accept/reject; unauthenticated hits get the auth modal with `next` back to the invite;
  "already a member" unique-violation outcome (§1.4) renders as success-with-notice.
  Dashboard shows a pending-invitations banner via `listUserInvitations`.
- **Business in pricing + picker**: second card (landing `pricing.tsx` + `plan-picker-dialog`)
  with its own tier dropdown/toggle fed from the catalog (no more hardcoded `find("pro")`);
  Business CTA runs §5.6. Plan features render from catalog `features`.
- **402/limit UX**: billing-error dispatch gains `MEMBER_CREDIT_LIMIT_REACHED` → dedicated
  dialog ("Your workspace limit this month is N…", CTA "Ask an admin"); org-pool 402 in an org
  workspace opens the plan picker only for billing managers, otherwise "workspace out of
  credits — tell your admin".
- **Credits chip**: shows active workspace balance (scoped query); dropdown labels the
  workspace; top-up entry only for billing managers in org context.
- i18n: every new string in `en`/`fr`/`ar` (`workspaces.json` namespace).

## 10. Admin app + API

- Server `AdminOrganizationsController` (`AdminGuard`): list (name, slug, members, plan/tier,
  balance, created), detail (members+roles, subscription, balance buckets, recent ledger,
  limits, attribution user), `POST /admin/organizations/:id/credits` (promo grant to the org
  pool, request-id idempotency like user grants), **`PATCH
  /admin/organizations/:id/members/:userId/role`** (direct member-row write — the §1.1
  zero-owner repair tool; also adopts/cleans stray ownerless orgs).
- Admin SPA: `Organizations` nav item + list/detail pages; user detail gains a "Workspaces"
  section; settings page gains the `organizationsEnabled` toggle.
- Admin aggregates (`admin.repository.ts:345`): per-user scalar subqueries add
  `organization_id IS NULL` (user rows mean "personal"); org equivalents live on org pages.

## 11. Migrations & rollout

- One additive migration **0018** via `drizzle-kit generate`: org tables (organization, member,
  invitation, org billing customers, billing settings, member limits), new columns
  (`session.active_organization_id`, `projects.organization_id`, ledger/holds/usage-events org
  columns + nullable user_id + CHECKs, subscriptions org FK, attempts/intents org columns),
  partial-unique swap on `subscriptions` only (**`billing_customers` is untouched** — §5.1),
  new indexes, `product_settings.organizations_enabled`.
- **No ON CONFLICT arbiter anywhere loses its index**: the only unique-index swap
  (`subscriptions_userId_nonTerminal_uq`) has no ON CONFLICT consumer (subscriptions upsert by
  `providerSubscriptionId`), verified in P1 review.
- Index-build locking: acceptable at current beta scale (tables are small); ops runbook notes
  that re-running this class of migration on mature data should split index creation.
- Deploy order: **API deploy carries the CORS allowedHeaders change (§2) → migrate → Trigger.dev
  deploy (hard release gate) → web/admin deploy → seed Stripe Business prices (TEST first) →
  toggle `organizationsEnabled`**. Everything ships dark behind the toggle; personal behavior
  is regression-tested unchanged.
- No new scheduled tasks.

## 12. Test plan (highlights)

- Fingerprint/lock compatibility: personal consume replay recorded pre-change validates
  post-change; org/personal lock keys distinct; the five lock sites share one helper
  (grep-guard test).
- Balance isolation: same user in personal + 2 orgs — three independent balances; ledger
  provenance rows correct.
- **Owner-scoped resolution family** (the confirmed critical, all three legs, both
  directions): with personal Pro + org Business under one userId — (a) each sub's cycle
  invoice grants only its own pool (no canonical cross-talk dead-letter); (b) deleting either
  sub expires ITS plan remainder even though the other entity's sub is still entitled; (c) a
  personal yearly refill slot grants when due even when the org row has fresher `updatedAt`,
  and vice versa.
- Uniqueness: personal Pro + org Business coexist; second live org sub rejected at admission
  and by sync canonicalization.
- Member limits: concurrent reserves by one member serialize at the limit; limit PUT
  serializes against an in-flight reserve (lock test); owner exempt from default, bound by
  explicit row; calendar-month boundary.
- Parent/child same-payer: org parent + org child OK, cross-owner child rejected; second
  member continuing the first member's org chat reserves under the org payer.
- Webhook org flow: checkout→invoice→grant lands in org pool; org metadata/owner mismatch
  dead-letters; refund/dispute claws back from org pool including pending-refill-slot
  clawback (owner-derived, §5.4); affiliate commission attributes to `attributionUserId`,
  NOT the checkout actor.
- Portal isolation: org creator with personal workspace active gets the personal portal only;
  demoted creator cannot reach the org portal (403 typed).
- Role guards: member cannot delete project / manage domains (incl. `POST /v1/orders/domain`
  against an org project) / open org portal; publish allowed; non-member 404 on org project
  routes.
- Media runner: org project generation settles to org pool after the acting member is removed
  mid-run.
- Workspace scoping: org header on legacy generation endpoints → typed 400; header on
  `@Public` routes ignored; unknown/foreign org header → 404; chat transport carries the
  header (integration test through `use-ai-chat`).
- Toggle: `organizationsEnabled=false` hides creation + Business checkout while org webhooks
  still honor paid money.
- Full suites: server unit/integration, web typecheck+build, admin typecheck+build, boot smoke.

## 13. Implementation packages (Fable implements directly — Zack's instruction 2026-08-03)

| Pkg | Scope | Key risk gates |
|---|---|---|
| P1 | Org plugin + merged adapter schema + migration 0018 + shared permissions module + WorkspaceContextGuard + CORS header + `organizationsEnabled` toggle chain | §11 checklist; boot smoke; no-arbiter-loss check |
| P2 | CreditOwner in credits (ledger/balance/locks/holds) + metering org column + gateway tagging + member limits (incl. lock-serialized PUT) | fingerprint/lock invariants + §12 credit tests |
| P3 | Billing owner abstraction (org customers table/resolver, checkout, intents, sync, owner-keyed canonical family, grants/expiry/refills, refunds, portal) + Business catalog/seed + affiliates attribution snapshot + Orders module sweep | §12 owner-resolution + webhook + portal tests; catalog spec |
| P4 | Projects/chats/sites/domains/orders scope predicates + role guards + AI tools subject threading + worker/trigger payer changes + prompt injection + legacy-path rejection | full predicate inventory swept; runner tests |
| P5 | Web: provider/switcher/both-transport header injection/query-key scoping/business picker/org pages/invite route/i18n | typecheck+build; header-transport audit; UX states |
| P6 | Admin org surfaces (incl. repair endpoint) + toggle UI + docs (billing.md ops appendix, this doc → Revision 3 if needed) | admin build; grant idempotency test |

Each package lands with its tests green before the next starts; adversarial review between P3
and P4 (money paths) and after P6 (full pass).

## 14. Revision 2 changelog (review-driven)

1. Org Stripe customers moved to a dedicated `organization_billing_customers` table;
   `billing_customers` untouched (kills: ON CONFLICT arbiter outage, findByUserId ambiguity,
   portal crossover, orders misresolution — 4 confirmed criticals + 2 codex findings).
2. Entire subscription resolution family owner-keyed, incl.
   `findCanonicalEntitledByOwner` and its three money sites (confirmed critical).
3. Ownership assertions + `ownerForInvoice` compare `CreditOwner` with explicit rung
   precedence; org sub `userId` demoted to provenance (confirmed major).
4. Refund clawback slot-owner recovery owner-derived (confirmed major).
5. Workspace deletion disabled (`disableOrganizationDeletion: true`) (confirmed critical).
6. Affiliate attribution snapshot (`attributionUserId` = earliest owner member), not checkout
   actor (codex critical).
7. Member limits: calendar-month UTC; limit PUT takes the org credit lock (codex majors).
8. Merged schema object passed to the Better Auth drizzle adapter (fleet + codex major).
9. Header-only scoping (no URL org params); guard skips `@Public`; CORS allowedHeaders
   sequenced first; chat-transport header injection + fetch audit (fleet majors).
10. Explicit-organizationId rule for all org client calls (fleet major).
11. Orders module added to scope/guard sweeps; `POST /v1/orders/domain` gets `domain:manage`
    for org projects (codex majors).
12. `membershipLimit: 10_000`; no `resend:true` (cancel+reinvite); `afterAcceptInvitation`
    hook added; comma-multi-role parsing; invitation-accept unique-violation → already-member;
    legacy endpoints reject org header; zero-owner admin repair endpoint; org-creation
    non-atomicity + invitation-listing leak accepted & documented (remaining findings).

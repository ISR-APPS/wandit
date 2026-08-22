# Billing v2 — Subscriptions, Credits, Metering, Beta, Affiliates

Design document for `feat/billing-subscriptions`. **Revision 2** — incorporates two adversarial
design reviews (codex gpt-5.6-sol ultra: 33 findings; claude: 20 findings). Synthesized from six
codebase probes + three external research reports (AI Gateway cost APIs, Stripe mechanics on API
`2026-02-25.clover` / stripe-node v20, affiliate architectures). 2026-08-01.

**Standing assumption (verified pre-launch state): there are ZERO live paid subscriptions.**
Several review blockers (stranding existing subscribers on repriced lookup keys, backfilling
12×-upfront annual grants) are therefore documented assumptions, enforced by a pre-deploy
assertion: `SELECT count(*) FROM subscriptions WHERE status NOT IN ('canceled','incomplete_expired')`
must be 0 at first prod deploy of this branch; otherwise the grandfathering appendix (§12) applies.

## 0. Product model

- **One paid plan ("Pro")**, Lovable-style: $30/mo = 200 monthly credits; credit-tier variants;
  monthly + yearly (yearly = exactly 2 months free = 10× monthly).
- **Credits fuel every AI action.** Zero balance ⇒ refuse + upgrade modal. Paid users consume
  credits like everyone else (subscription = refill, never a bypass).
- **Free plan**: 50 credits (= $2 of AI-provider value) at signup, toggleable, default OFF (beta posture).
- **Beta**: admins grant access + credits; kill switches keep free/paid off; ending beta = flip
  settings; testers keep leftover granted credits.
- **Affiliates**: links can expire; attributions locked before expiry earn for the user's paying
  lifetime (or the program's capped duration).

## 1. Credit unit economics (decided)

| Constant | Value |
|---|---|
| Retail credit value | $0.10/credit (base tier anchor: 250 credits = $25) |
| Metering conversion `usdPerCredit` | $0.04/credit (pricing v5: 1 credit = $0.04 of AI-provider cost) |
| Debit formula (token-metered) | `max(1, ceil(rawUsd / usdPerCredit))` — min-1 is deliberate Lovable-style pricing |
| Signup grant | 50 credits, configurable, `promo` bucket |

Fixed action costs (config-owned registry, §5.6): image **5/image**, video 25 (including
video generated inside builder/connector flows — the operation registry decides by operation
type, resolving the old "connector=5 vs video=25" ambiguity: the child op's own type wins),
marketing 5, connector generation 5 (+ its inline child generations at their own types' prices),
lead scrape 5, transcription: per-minute table with 1-credit minimum. Chat + page-builder are
token-metered. Project-title generation is bundled into the project-creation charge (min 1
credit for the creation flow covers it; it can only run once per creation).

### Catalog (single Pro plan)

Monthly: 200/$30, 400/$60, 800/$120, 1600/$240, 2400/$353 (2%), 4000/$576 (4%), 6000/$846 (6%),
8000/$1,104 (8%), 10000/$1,350 (10%). **Yearly = 10 × monthly.** Top-ups: 200/$30, 1,000/$150,
2,000/$300. Remove `business` + 7,500/10,000 tiers from contracts/seed/UI/specs (DB enum value
stays). `billing-catalog.spec.ts` is rewritten to lock the new economics. Seed script validates
product/currency/interval/metadata of existing lookup-key prices; sync/fulfillment parse unknown
lookup keys tolerantly (log + skip grant, never crash) — with the zero-live-subs assertion this
is belt-and-braces.

**Rollover**: at cycle refill, carry = `min(preRefillPlanBalance, allotment × capMultiplier)`
(capMultiplier=1, config); expire `preRefill − carry`, grant allotment — all inside ONE
transaction (§4.2).

## 2. Schema (packages/db) — all additive, migrations via db:generate

1. **`credit_bucket` + `'promo'`.** Spend order `plan → promo → topup` defined ONCE as a shared
   exported constant; every consumer (credits.service consume + refund-lookup, legacy worker
   metering, contracts zod enums, balance/ledger repos, web/admin DTOs) uses it. Clawback code paths keep a
   separate `PURCHASED_CREDIT_BUCKETS = ['plan','topup']` and **fail loudly** if a payment-linked
   `promo` row is ever encountered (promo is never payment-funded, by construction).
   Metering consumes that touch the plan bucket also create a durable `credit_plan_holds` row.
   At a refill, unresolved holds participate in the pre-refill snapshot and share one
   `credit_plan_hold_pools` carry allowance for that boundary. Delayed settlement/refund may
   restore plan credits only while both its hold and the shared allowance remain; the excess is
   recorded as forfeited, so a reservation cannot evade rollover expiry. A terminal subscription
   boundary forfeits all plan holds before expiring the ledger balance, while promo/top-up refund
   rights remain intact.
2. **`product_settings`** singleton: `id integer PK DEFAULT 1 CHECK (id = 1)`,
   `earlyAccessRequired bool DEFAULT true`, `signupGrantEnabled bool DEFAULT false`,
   `signupGrantCredits int DEFAULT 20 CHECK (> 0)`, `paidSubscriptionsEnabled bool DEFAULT false`,
   `topupsEnabled bool DEFAULT false`, `version int DEFAULT 1` (optimistic bump on write),
   `updatedByUserId FK restrict`, `updatedAt`.
3. **`ai_usage_events`** — crash-durable operation lifecycle (created BEFORE provider work):
   `id, userId, operation` enum (chat|page_build|image|video|marketing|connector|lead_scrape|transcription|topup_adjust),
   `parentEventId FK nullable` (nested tool calls), `status` enum
   (**reserved** → **settled** → **reconciled** | **refunded** | **reconcile_failed**),
   `model, provider, reservedCredits, finalCredits, estimatedCostUsdMicros,
   reconciledCostUsdMicros, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
   rawUsage jsonb, pricingSnapshot jsonb` (rates/version used), `chatId, messageId, attemptRef,
   idempotencyKey unique, createdAt, settledAt, reconciledAt`. Indexes: (userId, createdAt),
   (status) partial WHERE status='reserved' (stranded-op sweep).
4. **`ai_usage_generation_refs`** — one row per gateway generation (a ToolLoop op produces many):
   `id, usageEventId FK, gatewayGenerationId unique, stepUsage jsonb,
   reconciledCostUsdMicros, reconciledAt`.
5. **`subscription_refill_slots`** — yearly monthly-refill state machine (replaces the rev-1
   "nextRefillAt pointer"): on `invoice.paid[subscription_create|cycle]` for a YEARLY price,
   grant month-1 and insert **11 slot rows**: `id, subscriptionId FK, periodOrdinal int (2..12),
   dueAt timestamptz, credits int, fundingInvoiceId text, fundingChargeId text,
   fundingPaymentIntentId text, status` (pending|granted|canceled), `grantedAt,
   UNIQUE(subscriptionId, fundingInvoiceId, periodOrdinal)`, index (status, dueAt).
   Sweep claims a due slot via CAS (`UPDATE … SET status='granted' WHERE id=$1 AND
   status='pending'`), then grants with ledger idempotency
   `refill:{subscriptionId}:{fundingInvoiceId}:{ordinal}` carrying the funding charge refs in
   meta (clawback-compatible). Missed ordinals are naturally swept after downtime (each slot is
   independent; `dueAt <= now`). `dueAt` day-of-month clamped; all slots satisfy
   `dueAt < paid period end`.
6. **`billing_invoice_applications`** — journal making credit policy auditable + replay-safe:
   `stripeInvoiceId unique, subscriptionId, billingReason, oldPriceLookupKey,
   newPriceLookupKey, periodStart, periodEnd, creditsDelta, appliedAt`.
   Monotonic-staleness guard uses this: **cycle** invoices are skipped iff an application row
   exists with `periodEnd >= this invoice's periodEnd` and reason `subscription_cycle`
   (period monotonicity applies to cycles ONLY — a second legitimate upgrade in the same period
   must not be dropped; `subscription_update` stays invoice-scoped-idempotent).
7. **`billing_change_intents`** — preview/change consistency: `id uuid, userId, subscriptionId,
   currentPriceLookupKey, targetPriceLookupKey, prorationDate timestamptz,
   previewTotalMinor int, currency, status` (open|processing|consumed|expired), `expiresAt
   (~15min), providerAttemptedAt, providerOutcome, providerHostedInvoiceUrl,
   providerPendingExpiresAt, consumedAt, createdAt`. `/billing/change` claims an intent
   (CAS open→processing under the user advisory lock), performs the provider write outside the
   transaction, then persists processing→consumed with the provider result. A processing intent
   retries the SAME provider idempotency key; a consumed intent replays its stored outcome for
   the same user. It passes the SAME `proration_date` (top-level param on update;
   `subscription_details.proration_date` on preview — verified in installed stripe-node v20).
8. **`signup_grant_outbox`** — durable free-credit delivery: `userId PK, credits,
   settingsVersion, status (pending|done|skipped), attempts, lastError, createdAt, doneAt`.
   Inline grant attempted first; on failure the outbox row (already written) is swept by a
   Trigger.dev scheduled task. The API also makes a best-effort on-demand Trigger handoff so
   recovery can start sooner; the schedule remains the durable backstop and ledger idempotency
   stays `signup:{userId}`.
9. **`beta_access_events`**: `id, userId, action (granted|revoked), actorUserId, reason,
   createdAt`.
10. **`model_prices`**: `modelId unique, provider, modelType, inputUsdMicrosPerMTok,
    outputUsdMicrosPerMTok, cacheReadUsdMicrosPerMTok, cacheWriteUsdMicrosPerMTok,
    imageUsdMicros, raw jsonb, refreshedAt` — DB-persisted (API/worker/Trigger.dev are separate
    processes); each process reads through a ~1h TTL cache; an hourly Trigger.dev task refreshes
    from gateway `GET /v1/models`; checked-in seed JSON = cold-start fallback.
11. **Affiliates** (all tables: uuid PKs default gen_random_uuid, createdAt/updatedAt
    timestamptz, FKs restrict, money integer cents + currency text, rates int bps with
    `CHECK (rate BETWEEN 0 AND 10000)`, amount sign checks; indexes as noted):
    - `affiliate_programs`: `name, kind (percentage_recurring|fixed_one_time),
      commissionRateBps, fixedAmountCents, fixedCurrency, commissionDurationMonths` (NULL =
      lifetime), `holdDays DEFAULT 30, cookieWindowDays DEFAULT 60, status (active|archived)`.
      CHECK: percentage ⇒ rateBps NOT NULL; fixed ⇒ fixedAmountCents NOT NULL.
    - `affiliates`: `userId?` + `UNIQUE(userId) WHERE userId IS NOT NULL`, `name, email,
      company, channel, country, payoutMethod (manual|paypal|wise), payoutDetails jsonb,
      status (active|paused), notes`.
    - `affiliate_links`: `programId, affiliateId, code unique (unguessable slug), label,
      landingPath, expiresAt` (NULL = never; **enforced only at attribution lock**), `active`.
      Index (affiliateId).
    - `affiliate_clicks`: `linkId, ipHash, userAgent, landingUrl, createdAt`. Index (linkId, createdAt).
    - `affiliate_attributions`: `userId unique, linkId, affiliateId, programId` + **full terms
      snapshot**: `programKind, commissionRateBps, fixedAmountCents, fixedCurrency,
      commissionDurationMonths`, `clickedAt` (server-issued, §6), `lockedAt, source
      (signup_cookie|signup_body|manual), status (active|voided), fraudFlags jsonb`.
    - `affiliate_invoice_candidates`: `stripeInvoiceId unique, userId, billingReason,
      baseAmountCents, currency, paidAt, status (pending_attribution|processed|ineligible),
      createdAt` — written for EVERY whitelisted paid invoice (subscription_create|cycle|update)
      regardless of attribution existing; closes the checkout-before-signup race: attribution
      lock reconciles this table.
    - `affiliate_commissions`: `attributionId, affiliateId, entryType (earning|adjustment),
      originalCommissionId FK nullable` (adjustments MUST link), `stripeInvoiceId` +
      `UNIQUE(stripeInvoiceId) WHERE entryType='earning'`, `stripeRefundId unique nullable,
      stripeDisputeId unique nullable, stripeChargeId, currency, baseAmountCents, rateBps,
      amountCents` (sign CHECK: earning > 0, adjustment any), `status
      (pending|approved|paid|reversed), holdUntil, payoutId?, reversalReason`.
      Index (affiliateId, status), (status, holdUntil). Fixed-one-time single-earning invariant
      enforced in service under the invoice lock + spec (`WHERE entryType='earning'` count per
      attributionId must be 0 before insert for fixed programs).
    - `affiliate_payouts`: `affiliateId, totalCents CHECK (> 0), currency, method,
      externalRef` + `UNIQUE(method, externalRef) WHERE externalRef IS NOT NULL`,
      `requestId uuid unique` (admin idempotency), `status (draft|processing|paid|failed),
      periodStart, periodEnd, paidAt, createdByUserId`.

## 3. Settings, kill-switch semantics, beta lifecycle

- `ProductSettingsService`: singleton upsert, ~30s cache + invalidation-on-write, optimistic
  `version`. Admin `GET/PATCH /api/v1/admin/settings`; public
  `GET /api/v1/settings/public` → `{paidSubscriptionsEnabled, topupsEnabled, signupGrantEnabled}`.
- **Semantics: switches are ADMISSION CONTROLS, not retroactive stops.** They gate NEW
  checkout/change/topup/signup-grant admissions (30s staleness accepted and documented).
  **Webhook fulfillment always honors money already moved** (paid invoices grant credits, paid
  top-ups fulfill, yearly refill slots for already-paid periods keep granting) — flipping a
  switch never confiscates paid entitlements.
- Guards: checkout/change/resume → 403 `SUBSCRIPTIONS_DISABLED`; topup → 403 `TOPUPS_DISABLED`;
  `EarlyAccessGuard` passes everyone when `earlyAccessRequired=false`.
- Billing Portal sessions are created with a **restricted portal configuration** (payment
  method, invoice history, cancel only — NO plan switching; our own UI owns changes so portal
  can't bypass kill switches or the change-intent flow).
- Signup grant: settings-gated, `promo` bucket, inline attempt + `signup_grant_outbox` fallback
  sweep (§2.8). Trigger dispatch is best-effort and never substitutes for the persisted outbox;
  the API boots without Redis/BullMQ and a missing Trigger key only delays work until the
  deployed schedule runs.
- Atomic beta enroll `POST /admin/users/:userId/beta-enroll {credits, reason, idempotencyKey}`:
  one transaction = earlyAccess flag + promo grant + `beta_access_events` row. Requires
  `CreditsService.grant` to become **transaction-aware** (accept an external tx/conn), ledger
  idempotency keys namespaced per operation+user (`admin-grant:{userId}:{uuid}`), and replay
  conflict handling that verifies the existing row matches (owner + amount fingerprint in meta)
  — a reused key with different payload is a hard error, not silent success.
- Existing grant/revoke access admin actions also write `beta_access_events`.

## 4. Subscription lifecycle

### 4.1 Money (Stripe)
- **Upgrades (tier increase, monthly→yearly)**: immediate. `subscriptions.update` with
  `proration_behavior:'always_invoice'`, `payment_behavior:'pending_if_incomplete'`,
  `proration_date` from the consumed change intent, `billing_cycle_anchor:'now'` ONLY for
  interval change. **The pending update call must NOT include `metadata`** (installed
  stripe-node restricts pending-update-eligible params; tier is derived from price lookup key
  at sync — metadata writes are unnecessary).
- `/billing/change` response becomes `{outcome: 'applied'|'payment_required'|'failed',
  hostedInvoiceUrl?, pendingExpiresAt?, subscription, balance}` — SCA/decline is visible, the
  client can send the user to the hosted invoice; a second change while one is pending is
  rejected (or explicitly replaces after the first expires).
- **Downgrades (tier decrease): Stripe Subscription Schedule at period end, no monetary
  proration.** The schedule keeps the already-paid live price through `current_period_end`, then
  enters a one-interval phase at the lower price with `proration_behavior:'none'` and releases
  the subscription at that price. The local mirror stores `pendingTierCredits`; its
  `pendingAppliedBy` is the Stripe schedule id. Schedule create/configure and intent completion
  use deterministic idempotency keys, so a timeout or webhook replay cannot create a second
  change. `invoice.upcoming` remains subscribed but is informational: its real
  `billing_reason:'upcoming'` payload NEVER mutates the live subscription. At the paid cycle,
  sync observes the scheduled target and clears the local pending fields.
- **Upgrade while a downgrade is pending:** release the application-owned schedule first, then
  clear the local pending fields and perform the normal immediate upgrade. Because the live
  price was never lowered, Stripe prorates from the tier the customer actually paid for and
  there is no double-grant window. Selecting the current tier simply releases/cancels the
  schedule without creating an invoice. A foreign/unowned schedule fails closed. UI copy:
  "changes at renewal". **Yearly→monthly not offered in v2.**
- Preview endpoint `POST /billing/change/preview` creates the change intent (§2.7) via
  `invoices.createPreview` and returns `{intentId, amountDueMinor, currency, creditsDelta,
  expiresAt}` in minor units.

### 4.2 Credits (webhook policy — all inside per-user advisory lock, transactional)
- **One primitive: `applyCappedRefill(tx, userId, allotment, capMultiplier, idempotencyKey,
  fundingRefs)`** — snapshots pre-refill plan balance, writes expire-excess + grant atomically
  in ONE transaction (rev-1's separate grant/expire transactions allowed replay-after-crash to
  misread the fresh grant as prior balance). Used by monthly cycles AND yearly slot sweeps.
- **Grant admission rule**: credits are granted only when the invoice's subscription is the
  canonical entitled mirror for that user (duplicate remote subscriptions: only the mirrored
  one funds credits; others log + skip). Entitlement recheck + slot cancelation happen inside
  the same locked transaction as any expiry.
- **Transition matrix** (explicit, each cell = policy on `invoice.paid[subscription_update]` /
  sync):

| From → To | Credits | Slots |
|---|---|---|
| monthly tier ↑ | grant full delta (`inv:{id}:grant`) | — |
| monthly tier ↓ (period end) | at renewal: refill at new allotment | — |
| monthly → yearly | expire plan remainder via capped-refill at new-tier month-1 | create 11 slots (new funding invoice) |
| yearly tier ↑ mid-year | grant this month's delta now | cancel pending slots from old invoice; create replacement slots (2..remaining ordinals) at new tier funded by the update invoice |
| yearly renewal (cycle) | month-1 refill via capped-refill | cancel any stale pending slots; create 11 new |
| yearly canceled at period end | keep granting already-paid slots through period end | slots stay pending until dueAt |
| deleted (terminal) | expire plan bucket IFF no other entitled sub | cancel all pending slots |
| refund/dispute on funding charge | existing clawback revokes purchased credits | **full** refund/dispute of the charge: cancel pending slots funded by that invoice/charge. **Partial** refund: slots are PRESERVED (`payment-refunds.service.ts` `refundCoversFullCharge`) — a $10 goodwill refund on a yearly tier must not destroy 11 months of prepaid credits. Partial refunds on slot-funded charges are a manual-review case: if the intent is to revoke future months, cancel the remaining slots by hand (or refund the full charge). |

For `subscription_update`, target/predecessor prices come from the paid invoice lines: positive
proration lines first, then positive non-proration new-period lines for anchor-reset invoices.
The predecessor must cover the same paid period. For `subscription_cycle`, allotment, interval,
period, and yearly-slot funding come strictly from that paid invoice, never from a newer local or
remote subscription mirror.

- **`charge.dispute.closed` (won/withdrawn)**: under the existing charge lock, fetch fresh
  charge refund/dispute state, recompute ONE cumulative revocation target (refunds remain
  valid!), restore only the excess over that target (compensating grants, idempotent per
  dispute) — never blanket-restore.
- **Webhook dead-lettering**: a scheduled Trigger.dev sweep retries `failed` events with capped backoff;
  `POST /admin/webhooks/:id/replay` (audited) for events Stripe no longer redelivers; alert log
  on dead-letter.
- Checkout intent nonce (Stripe idempotency key `sub-checkout:{userId}:{nonce}` persisted
  before session creation); top-up fulfillment validates pack/credits/amount/currency/customer
  against catalog + session; top-up open sessions persisted like subscription ones.

## 5. Metering (reserve → execute → settle → reconcile)

1. **`model_prices`** (§2.10) + margin at debit time (`usdPerCredit`).
2. **Reserve**: BEFORE provider work (and before `reply.hijack()` for chat), create
   `ai_usage_events` row (status `reserved`) + ledger hold = reserve credits under the user
   lock: chat reserves `max(1, estimate)`; fixed ops reserve their fixed price; builder
   reserves a floor (10) — reservation is a real `consume` row (idempotency
   `reserve:{eventId}`), so concurrent streams CANNOT overdraw (rev-1's check-then-debit had
   unbounded concurrent overdraft). Per-user in-flight cap on streams (e.g. 3) + `maxOutputTokens`
   + step caps (`stopWhen`) bound worst-case cost. Refusal = 402 with typed details.
3. **Settle**: at end event (`onEnd`/`onStepEnd`; v7 aggregate `usage`), compute actual credits;
   write delta rows (extra consume `settle:{eventId}` — allowed to exceed reserve boundedly —
   or partial refund grant `settle-refund:{eventId}`), mark event `settled` with token detail +
   pricing snapshot. Usage-detail fallback: uncached input = `inputTokens − cacheRead −
   cacheWrite` (clamped ≥0) when `inputTokenDetails` absent — never bill zero input on missing
   details.
4. **Stranded recovery**: a scheduled Trigger.dev sweep finds `reserved` events older than T (crash mid-stream):
   attempt gateway reconciliation by any captured generation refs; else refund the hold and
   mark `refunded`.
5. **Reconcile**: `ai_usage_generation_refs` (§2.4) captures EVERY generationId (ToolLoop = many
   per op; providerMetadata is generically typed — runtime narrowing). One scheduled Trigger.dev
   run per minute claims and processes a bounded batch of all pending refs; there is deliberately
   no per-event Trigger run. It calls `gateway.getGenerationInfo(id)` per ref → aggregates
   authoritative cost; adjusts ≥1-credit deltas with compensating rows; and writes
   `reconciled`/`reconcile_failed`. "Usage event not found" remains retryable because provider
   ingestion is asynchronous.
6. **Operation registry** (single module): operation type → pricing mode (token|fixed|per-minute)
   + reserve floor + parent/child rules. EXHAUSTIVE coverage, verified by a spec that walks
   every AI invocation site: chat, builder steps, **builder's direct image (≤6) and video (≤2)
   tool calls (child events with parentEventId)**, standalone image (per-image) / animation /
   marketing, **MCP connector inline generations (child events)**, lead scrape, transcription
   (duration capped pre-call, per-minute rate, stable operation ID, user-scoped), legacy worker
   chat (reserve-1-at-enqueue fixes free-delivery race).
7. **Gateway tagging**: `providerOptions.gateway = {user: userId, tags: ['op:'+operation],
   quotaEntityId: userId}` on every call.
8. **402 wire contract**: exception filter emits typed `details {requiredCredits,
   availableCredits}` (unified naming across both error classes, zod schema in contracts, web
   `ApiClientError` carries it); pre-stream refusals are HTTP 402; mid-stream exhaustion emits
   typed `data-billing-error` UI part then ends the stream; image/video chat tools stop
   swallowing 402s into tool text. Web adds a status/code-preserving chat-transport wrapper.

## 6. Affiliates

- **Capture (cross-origin-safe; web SPA and API are different sites in prod; OAuth completes on
  the API origin)**:
  1. Web reads `?ref=code` → localStorage `{code}` + `fetch(API/api/v1/affiliates/click,
     {method:'POST', credentials:'include', keepalive:true})` (not sendBeacon — CORS preflight).
  2. Click endpoint validates the link (active, unexpired), **timestamps server-side**, and
     responds `Set-Cookie` on the **API origin** with an **HMAC-signed compact token**
     `{linkCode, issuedAt}` (secret: BETTER_AUTH_SECRET-derived; SameSite/Secure mirroring the
     `crossSiteCookies` logic; Max-Age = min(cookieWindowDays, link expiry window)). Client
     `clickedAt` is never trusted.
  3. `@Public()` + per-IP throttle (LeadsCaptureThrottle pattern + `x-forwarded-for` extraction
     — Fastify has no trustProxy; `request.ip` is the LB). IP stored hashed.
- **Lock at signup**: widen `CreateAuthOptions.onUserCreated` to forward Better Auth's hook ctx
  (current wrapper drops it — headers unreachable today). Hook order: attribution lock BEFORE
  signup grant. Primary source: verified API-origin cookie token; fallback: signed token echoed
  from localStorage by the shared Better Auth client's `/sign-up/email` request hook (individual
  signup forms must not own this wiring). Verify HMAC + link validity **at lock time**
  (`issuedAt < link.expiresAt`), insert attribution with full terms snapshot (first-wins
  UNIQUE(userId)), then **reconcile `affiliate_invoice_candidates`** for this user (closes
  checkout-before-signup). Mirror `affiliateCode` into Stripe customer metadata at customer
  creation (reconciliation aid only).
- **Commissions** (`invoice.paid`, whitelisted `billing_reason` ∈ {subscription_create,
  subscription_cycle, subscription_update} — upgrade prorations DO earn, per lifetime revenue
  share): always write the invoice candidate first; if attribution active + within duration
  window (lockedAt + durationMonths): base = `min(total_excluding_tax ?? amount_paid,
  amount_paid)` in cents (conservative: never commission on tax nor on invoice portions covered
  by customer-balance credit), amount = `round(base × rateBps / 10000)` (or fixed: single
  earning per attribution, enforced under the invoice lock); insert earning
  (UNIQUE(stripeInvoiceId) among earnings), `holdUntil = paidAt + holdDays`.
- **Clawbacks**: `charge.refunded` / `charge.dispute.created` → adjustment rows LINKED to the
  original earning (`originalCommissionId` + unique stripeRefundId/DisputeId), cumulative
  targeting under an invoice/charge lock (mirror the payment-refunds pattern); dispute won →
  compensating positive adjustment. Post-payout clawbacks = negative affiliate balance carried
  forward.
- **Approval sweep** (Trigger.dev, daily at 04:00 UTC): pending → approved when `holdUntil` passes AND
  attribution not voided AND no unresolved fraud flags (**flagged rows are excluded from
  approval/payout, not just decorated**). Self-referral checks run at lock AND re-run when an
  affiliate later links a userId.
- **Payouts v1 (manual, atomic)**: builder locks eligible rows and claims via
  `UPDATE … SET payout_id=$1 WHERE payout_id IS NULL AND status='approved' AND affiliate/currency
  match RETURNING`; one payout per (affiliate, currency); `requestId` unique idempotency;
  `(method, externalRef)` unique; payout + entries transition atomically; net ≤ 0 → forbidden
  (carry negative forward).
- Admin API + UI per §8; program-level terms (mock's per-code rate/window dies), payout methods
  manual|paypal|wise, statuses map to active+expiresAt, synthetic mock fields dropped.

## 7. Web app

- Kill the localStorage mock ledger; chip/ledger/affordability from real endpoints; invalidate
  after settles/402s.
- `/billing` page + plan-picker modal (Lovable parity): monthly/yearly toggle ("2 months free"),
  tier dropdown with savings badges, checkout (no sub) / preview-then-change ("Pay $X now ·
  +Y credits", from the intent) / downgrade marked "changes at renewal". Cancel-pending sub →
  resume-first, tier change blocked. Beta posture: balance + ledger + beta badge, no picker.
  CTAs hidden until public settings resolve. Landing pricing: restructure (remove Business card,
  slider → tier dropdown, dictionary-driven).
- 402 anywhere (typed details / `data-billing-error` part) → upgrade modal; top-up buttons
  enabled (gated by `topupsEnabled`).
- Referral capture in root route (§6.1).
- **i18n mandatory**: all new strings in en/fr/ar typed dictionaries; RTL-safe layout.
- **Native (minimal)**: wire chip to real balance + invalidate on 402; 402 copy via
  `native.json`; legacy chat path already maps 402s; new SSE part safely ignored; NO purchases
  on native (IAP question deferred).

## 8. Admin app

- Settings page (switches + grant amount, confirm dialogs, last-changed-by). `apiPatch`/
  `apiDelete` added to the admin client (currently GET/POST only). Paginated lists embed
  pagination inside `data` (client discards `meta`).
- Users: beta-enroll action; promo bucket visible in balances.
- Affiliates: programs CRUD (new surface), affiliates/links wiring to real API, attributed
  users, commission ledger with statuses, payout builder, real CSV export.
- Webhook replay: audited admin action (§4.2).

## 9. Implementation packages (codex gpt-5.6-sol ultra, sequential)

- **P1 — Schema + contracts + settings + wire format.** All §2 schema (now complete for
  P2–P4: slots, applications journal, change intents, outbox, generation refs, candidates,
  adjustments linkage), migrations, catalog rewrite + spec + seed + `business|7500|10000|topup_*`
  sweep, error codes + 402 details end-to-end plumbing, settings module + guards +
  public endpoint, signup grant rework (promo/outbox/toggle), spend-order promo everywhere
  (+ PURCHASED_CREDIT_BUCKETS guard), transaction-aware grant + namespaced idempotency +
  replay fingerprint, beta-enroll + audit events, Trigger.dev task contracts and best-effort
  API handoffs backed by persisted sweep state.
  *Tests*: catalog spec rewrite; settings spec; early-access passthrough; promo spend-order +
  refund-with-promo cases; beta-enroll atomicity/idempotency/replay-mismatch; 402 filter
  details; outbox sweep.
- **P2 — Subscription lifecycle.** §4 in full: applyCappedRefill primitive, transition matrix,
  slot machine + sweep, monotonic cycle guard via applications journal, canonical-mirror grant
  admission, deletion-with-second-sub guard, change intents + preview + pending_if_incomplete
  (metadata-free) + outcome contract, period-end downgrades (pendingTierCredits), dispute.closed
  cumulative restore, checkout nonce, top-up validation, portal restriction, webhook
  dead-letter sweep + admin replay, seed hardening, subscriber-bypass removal.
  *Tests*: NEW subscription-credits spec (capped refill math incl. crash-replay, matrix cells,
  slot lifecycle incl. upgrade mid-year + cancel + refund, monotonic guard allows same-period
  double upgrade); webhook-processor extensions (stale replay, dup-sub deletion, dispute
  restore-with-refund-overlap); change-intent consume CAS.
- **P3 — Metering.** §5 in full: model_prices + refresh + seed JSON, MeteringService
  (reserve/settle/recover/reconcile), operation registry + exhaustive-coverage spec, chat gate
  + transport-visible 402, builder + child tool events, media/marketing/connector/lead/
  transcription integration, legacy worker reserve-at-enqueue, gateway tagging, generation refs.
  *Tests*: usd→credits (cache tiers, missing-details fallback, max(1,ceil)); reserve/settle/
  recover state machine; registry completeness; ai-chat gate+debit; idempotency contracts.
- **P4 — Affiliates backend.** §6 in full + admin API contracts.
  *Tests*: lock (expiry-at-lock, first-wins, HMAC verify, candidate reconcile), commissions
  (whitelist, zero-amount skip, duration window, fixed single-earning, base-amount rule),
  clawback linkage + cumulative, approval excludes flagged, payout claim atomicity/idempotency,
  click throttle.
- **P5 — Web + native.** §7. *Tests*: 402-dispatch lib, picker math, transport wrapper (repo
  pure-lib spec convention). i18n en/fr/ar.
- **P6 — Admin.** §8. *Tests*: first admin specs — settings client mapper + affiliate DTO
  mappers; rest manual QA (admin status quo).

Each package: codex implements → check-types + scoped vitest + biome → codex review pass →
fixes. Final: full build/tests, multi-agent adversarial review of payment paths, dev-server
boot + auth URLs. **No commits.**

## 10. Non-goals (v2)

Team/Business plan; automated payout rails; yearly→monthly switching; mid-stream abort;
native purchases; Chargily/CIB subscription parity; domain-order client idempotency;
grant-lot accounting (promo bucket + targeted guards suffice pre-launch); settings history
table (version + updatedBy + logs suffice).

## 11. Dev/prod operational contract

Billing maintenance is Trigger.dev-native and independent of `QUEUE_ENABLED`, Redis, and
`apps/worker`. The production schedules are declarative and UTC:

| Task | Cron | Notes |
|---|---|---|
| Subscription refill slot sweep | `*/10 * * * *` | CAS-claims due slots; entitlement is rechecked under the existing charge → user → refill-row lock order. |
| Batched metering reconciliation | `* * * * *` | One bounded batch run handles all pending generation refs; never one Trigger run per event. |
| Stranded reservation/checkpoint recovery | `*/15 * * * *` | Reconciles captured provider work before deciding whether a reservation is refundable. |
| Affiliate commission approval | `0 4 * * *` | Rechecks attribution, fraud, and hold eligibility before approval. |
| Billing webhook dead-letter retry | `*/10 * * * *` | Claim leases and persisted attempts preserve exactly-once terminal transitions. |
| Signup-grant outbox | `*/5 * * * *` | Persisted outbox is authoritative; failed inline grants may also request an on-demand run. |
| Model-price refresh | `0 * * * *` | Refreshes the shared DB catalog used by API, worker, and Trigger processes. |

Frequent tasks use bounded-concurrency financial, metering, and model-pricing queues, finite
`maxDuration`, and a TTL shorter than the schedule interval so stale runs cannot accumulate.
Payment- or user-scoped on-demand handoffs use globally scoped hashed idempotency keys. The API
imports task types only and triggers by task id; it does not bundle task implementations.

`QUEUE_ENABLED=false` now disables only the remaining non-billing BullMQ paths. `apps/worker`'s
AI queue performs `generate-copy` chat streaming and settles the reservation carried by that job;
`generate-site` and `revise-site` remain reserved job names. The media-generation,
lead-processing, and publishing consumers are currently scaffolds that return `processed: false`
without product or billing side effects. The worker runs no refill, reconciliation, recovery,
affiliate, webhook, signup-grant, or pricing schedule. Consequently worker + Redis are not
billing-maintenance dependencies.

The API must boot without Redis and without `TRIGGER_SECRET_KEY`. Without a Trigger key,
signup-grant and admin-replay handoffs can fall back to persisted outbox/inbox state and deployed
schedules. Affiliate attribution has only its inline attempt because its signed token is not
persisted locally, so production must configure the Trigger key before attributed signups.
Stripe unconfigured locally → billing endpoints 503 (`BILLING_NOT_CONFIGURED`), specs run on
fakes; Zack must seed test-mode Stripe + set
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (+ portal configuration) before E2E. Production must
also deploy the complete `apps/server/src/trigger` task set and configure Trigger.dev's runtime
environment before enabling billing admissions. The Redis drain and affiliate-token translation
gates in `docs/features/billing.md` are mandatory before deploying the final consumer removal.

Teams (organizations) refunds: a refund or dispute on an ORG invoice claws back from the ORG
credit pool, and any pending-refill-slot clawback derives the slot's owner from the slot's
subscription row (`organizationId ?? userId`) — never from `subscriptions.userId`, which on org
rows is purchase provenance only (teams-workspaces.md §5.4). When investigating a partial refund
on an org subscription, expect the revoke rows in the org's ledger (admin → Organizations →
detail), not in the purchasing owner's personal ledger; the personal ledger view deliberately
filters org rows out.

## 12. Grandfathering appendix (activates ONLY if the zero-live-subs assertion fails)

Legacy lookup keys stay recognized (immutable internal price-ID map); existing annual buyers
keep their 12×-upfront grant for the current paid period, slots begin at next renewal; repriced
tiers apply to new checkouts only.

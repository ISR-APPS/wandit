# Billing (Stripe, SlickPay, offline)

> **Status: pricing v8 (pay as you go), 2026-11-12.** There are no plans. A user tops up a
> wallet with a one-time payment, and credits never expire. The design record is
> [`pricing-v8-pay-as-you-go.md`](pricing-v8-pay-as-you-go.md). This doc is the operations
> reference of the code. The subscription text is under "History (before pricing v8)" at the end.

## Purpose

A personal workspace and an organization workspace each have one wallet. The owner buys
credits with one of three payment methods:

- Card: Stripe Checkout, USD. Switch: admin setting `topups_enabled`.
- SlickPay (CIB / Edahabia), DZD. Switch: the env key `SLICKPAY_PUBLIC_KEY`. See [`slickpay.md`](slickpay.md).
- Offline (cash, transfer, CCP): the customer sends a request, and an admin records the payment.
  Switch: admin setting `manual_payments_enabled`. See [`manual-billing.md`](manual-billing.md).

The three switches are independent. The rate is 10 credits for 1 USD for each method.

A fourth switch, `product_settings.starter_pass_required` (admin Settings, Product controls, toggle "Starter pass"), is a
fraud gate. When it is on, a pool that never paid must buy the Starter pass (1 USD by card, or
250 DZD by SlickPay at the default rate) before it can spend credits. Cash on delivery does not
sell the pass. See "Starter pass" below and pricing v8 section 14.

Old Stripe subscriptions stay readable until the cutover script ends them (pricing v8 section 9).
Their invoices, refunds, and disputes still work.

## Settled decisions

- **Hand-rolled billing, not the Better Auth Stripe plugin.** We own the schema, the ledger
  semantics, and the provider port.
- **The server computes the credits.** The amount rules are in `@wandit/contracts`
  (`TOPUP_PRESET_AMOUNTS_USD`, `TOPUP_MIN_AMOUNT_USD` = 10, `TOPUP_MAX_AMOUNT_USD` = 1000,
  `TOPUP_CREDITS_PER_USD` = 10, `topupCreditsForUsd`). The web count is display only.
  `STARTER_PASS_USD` = 1 is below the minimum on purpose. Only a `starterPass: true` body uses it.
- **Stripe top-ups use `price_data`.** No lookup-key Price and no seed is necessary for a top-up.
- **Webhooks are the source of truth** for payment state. The return page only reads the result.
- **Currency:** Stripe is USD and cards only. SlickPay is DZD. Offline receipts keep the currency
  of the money received.

## Wallet top-up

### Stripe flow (`BillingService.topup`)

1. The body is `{ amountUsd }` (whole USD, 10 to 1000), or `{ starterPass: true }`. The Starter
   pass amount is always `STARTER_PASS_USD` (1 USD, 10 credits). For one release the API also accepts
   `{ packId }` from a cached v7 web bundle. The API maps the pack to its USD price (25, 100,
   250) and then uses the same 10-credits-for-1-USD rate.
2. Open attempt of the same owner (before the lock, then under the owner lock):
   - It has a Stripe session: the API expires the session. If Stripe says the session is
     `complete`, the API answers 409 `BILLING_CHECKOUT_PENDING`.
   - It has no session and is younger than 5 minutes (`TOPUP_IN_FLIGHT_MS`): its request is in
     flight. The API answers 409.
   - It has no session and is older than 5 minutes: the API ignores it and does not set it to
     `expired`. A later webhook attaches it by `metadata.attemptId`.
3. Under the owner lock, the API inserts a `billing_checkout_attempts` row with `purpose = topup`,
   `amount_usd_cents`, and `credits` (centi-credits). For a Starter pass body, the API first reads
   the pool balance under the same lock. If the pool does not need the pass, it answers 409
   `STARTER_PASS_NOT_AVAILABLE`.
4. `createTopupCheckout` creates the session: `price_data` in USD, product name "Wandit credits",
   `payment_method_types: ["card"]`, `adaptive_pricing` off, metadata `attemptId`, `purpose`,
   `userId`, and `organizationId` on the session and on the payment intent. The success URL is
   `/billing/success?purpose=topup&session_id={CHECKOUT_SESSION_ID}`. The Stripe idempotency key
   comes from the attempt row only, so a replay sends the same request. A Starter pass session also
   sets `payment_method_options.card.request_three_d_secure = "any"`. Card testers try stolen
   cards on a 1 USD price, and 3-D Secure stops them.
5. The webhook verifies the session (see "Webhooks") and grants the credits of the attempt row.
   It never reads credits from Stripe metadata.
6. The return page polls `GET /billing/topup/status?sessionId=` until the status is `credited`.

### Grant (`SubscriptionCreditsService.grantTopup`)

One transaction: `CreditsService.topup` (bucket `topup`, key `topup:{sessionId}`), one row in
`billing_topup_receipts`, and the reconciliation outbox row. Then the router calls
`AffiliateCommissionService.handlePaidTopup`. The grant also enqueues the lifecycle event
`payment_completed` with `interval: "topup"`. A new receipt also gives the credit pool its
Starter pass (source `stripe`), in the same transaction, if the pool has no live pass. This is
true for each card top-up, not only for the 1 USD pass. A webhook replay finds the receipt and
writes no pass. A top-up below 10 USD earns no affiliate commission.

An attempt with an amount goes to the amount checks: currency `usd`,
`amount_subtotal = attempt.amount_usd_cents`, and `total_details.amount_discount = 0`. An old v7
attempt with no amount goes to the old pack checks.

### Receipts

`billing_topup_receipts` is the payment history of the wallet for every provider. The column
`session_id` (Drizzle property `providerReference`) is unique: a Stripe session id,
`slickpay:{paymentId}`, or `offline:{idempotencyKey}`. `provider` is `stripe`, `slickpay`, or
`offline`. `credits` is in centi-credits. `reversed_at` is set by the admin action "Reverse top-up".

`GET /billing/payments` returns the last 50 receipts of the pool. `revokedCredits` comes from the
ledger: the `revoke` rows minus the `clawback_restore` grants with the `meta.chargeId` of the
receipt. It is null for a receipt with no charge id.

### Paid owner

`PaidOwnerRepository.isPaidOwner(owner)` is true when the pool has a ledger row of kind `topup`
of `PAID_OWNER_MIN_TOPUP_CENTI_CREDITS` or more (100 credits, the credits of a 10 USD top-up), or a
`subscriptions` row whose status is not `incomplete` or `incomplete_expired`. V2 backends,
V2 device minutes, the project move, the page badge gate, and the lifecycle dispatcher read it.
A full refund of the only top-up keeps the owner paid. The 1 USD Starter pass does not make a
paid owner. The admin users list has a SQL copy of the rule with the same constant.

### Starter pass

A pass is one row of `starter_passes`. `StarterPassesRepository` writes it. One pool has at most
one live pass (`revoked_at` NULL). A team pass has `organization_id` set and `user_id` NULL.

- Gate: `CreditsRepository.getSettledBalanceSnapshot` computes `starterPassRequired` in the same
  statement as the sums. It is true when the switch is on and the pool has no live pass.
  `CreditsService.consume` with `admission: "requirePositiveBalance"` then throws the usual 402
  `INSUFFICIENT_CREDITS` with `details.reason = "starter_pass_required"`. The V2 project create
  refuses the same way. Settle and completion debits do not check the pass.
- Read: `GET /credits/balance`, `GET /billing/wallet`, and the V2 turn estimate payer block carry
  `starterPassRequired` (optional in the contracts).
- Writers: each new card, SlickPay, and admin-recorded offline receipt (source `stripe`,
  `slickpay`, `offline`), an admin grant (source `admin`), the dev seed, and the backfill of the
  switch (source `grandfathered`).
- Revokers: "Reverse top-up", a Stripe dispute (`charge.dispute.created`), and an admin revoke.
  The first two move the pass to another live receipt of the pool when one exists.

The full rules and the rollout runbook are in pricing v8 section 14.

## Data model (packages/db)

- `credit_ledger` *(exists)* — `bucket` uses `credit_bucket('plan','promo','topup')`;
  `organization_id` identifies an organization-owned pool when present; index
  `(user_id, bucket)`. Pricing v8 writes no `expire` row.
- `billing_customers` — `id` uuid PK, `user_id` text unique FK→user (restrict), `provider` text (`'stripe'`), `provider_customer_id` text, unique(provider, provider_customer_id), timestamps.
- `subscriptions` — the mirror of old Stripe and manual subscriptions. No endpoint creates a row
  now. The cutover script ends each live row. The table stays for refunds, disputes, and reports.
- `billing_webhook_events` — durable inbox with claim leases, attempt counts, failed-event retry, and terminal processed/skipped states.
- `billing_checkout_attempts` — a UUID nonce is persisted before the Checkout Session creation; guarded states are `created → session_attached → completed|expired`. A new row is always `purpose = topup` with `amount_usd_cents` and `credits`.
- `billing_topup_receipts` — one row for each wallet payment of any provider (see "Receipts").
- `slickpay_payments`, `manual_subscription_requests` — a new row stores `amount_usd_cents` and
  `credits`, and NULL in `plan`, `tier_credits`, and `interval`.
- `billing_change_intents`, `billing_invoice_applications`, `subscription_refill_slots` — history
  of the plan changes, the invoice grants, and the yearly slots. Only old subscription invoices
  and the cutover script write to the last two.

## Credit mechanics (modules/credits)

- **Balance** = `sum(delta)`. The wallet is the sum of the three buckets. The burn order stays
  plan → promo → top-up. With no expiry, the order has no money effect.
- **No expiry.** No code writes an `expire` row or lowers a plan hold.
- **Old subscription invoices** (until the cutover): `grantForPaidInvoice` grants one allotment
  one time (key `inv:{invoiceId}:grant`), also when the local row is `canceled`. A yearly invoice
  plans eleven pending slots. Only the cutover script grants a pending slot.
- **Refunds and disputes** revoke purchased credits in proportion, and cancel the pending slots
  that the charge funded. A favorable dispute closure restores only the excess revocation.

## Billing module (modules/billing)

`PaymentProvider` port: `createOrderCheckout`, `createPortalSession`, `createRefund`,
`createTopupCheckout`, `ensureCustomer`, `ensureOrganizationCustomer`, `expireCheckoutSession`,
`listSubscriptionsForCustomer`, `retrieveCharge`, `retrieveCheckoutSession`,
`retrievePaymentIntent`. `StripeProvider` implements it. It also keeps `cancelSubscriptionNow`
and the methods that `scripts/migrate-subscriptions-v6.ts` calls.

Endpoints (authed by the global guard unless `@Public`):

| Route | Behavior |
|---|---|
| `GET /api/v1/billing/plans` | Public. Old v7 catalog, unchanged for one release: cached web bundles call it. |
| `GET /api/v1/billing/subscription` | Old v7 read, unchanged for one release. |
| `GET /api/v1/billing/wallet` | `{ balance, isPaidOwner, starterPassRequired, hasStripeCustomer, spentLast30DaysCredits, topup: { enabled, presetAmountsUsd, minAmountUsd, maxAmountUsd, creditsPerUsd } }` for the active workspace. Each member can read it. |
| `POST /api/v1/billing/topup` | `{ amountUsd }`, `{ starterPass: true }`, or a v7 `{ packId }` → `{ url }`. A Starter pass body for a pool that does not need it gives 409 `STARTER_PASS_NOT_AVAILABLE`. Guards: `TopupsEnabledGuard`, `WebOriginWriteGuard`, `billing: manage`. |
| `GET /api/v1/billing/topup/status` | Query `sessionId` (`cs_…`) → `{ status: "pending" }` or `{ status: "credited", credits }` (decimal credits, bonus included). `credits` is null for an old pack receipt with an unknown pack id. Finds the receipt by session id and the caller's user id. |
| `GET /api/v1/billing/payments` | The last 50 receipts of the pool. Guard: `billing: manage`. |
| `POST /api/v1/billing/portal` | Restricted Billing Portal, for old invoices and the payment method. Guard: `billing: manage`. |
| `GET /api/v1/billing/local-pricing` | Public. `{ dzdPerUsdRate, slickpay }`. `dzdPerUsdRate` goes to every visitor when SlickPay has a key: the web then shows DZD prices and the SlickPay tab. `slickpay` stays Algeria-only for old web bundles. |
| `POST /api/v1/billing/slickpay/checkout` | `{ amountUsd, ...contact }` or `{ starterPass: true, ...contact }` → SlickPay invoice URL. Same 409 rule as the card. Guards: `WebOriginWriteGuard`, `billing: manage`. |
| `POST /api/v1/billing/slickpay/payments/:id/confirm` | Reads the invoice state from SlickPay and fulfils a paid row. Guard: `WebOriginWriteGuard`. |
| `GET /api/v1/billing/manual-request` | The open offline request of the owner, or null. |
| `POST /api/v1/billing/manual-request` | `{ amountUsd, ...contact }`. Guards: `WebOriginWriteGuard`, `ManualPaymentsEnabledGuard`, `billing: manage`. |
| `POST /api/v1/billing/manual-request/cancel` | Cancels the open request. Guards: `WebOriginWriteGuard`, `billing: manage`. |
| `POST /api/webhooks/stripe` | Public, raw body, signature-verified. See "Webhooks". |

Removed in pricing v8: `POST /billing/checkout`, `/change/preview`, `/change`, `/cancel`,
`/resume`, and `/sync`.

Admin routes (`/api/v1/admin`, billing module): `GET manual-requests`, `GET manual-requests/:id`,
`PATCH manual-requests/:id`, `GET manual-subscriptions` and `GET manual-subscriptions/:id` (history),
`GET topup-receipts` (`billing: read`), `POST topup-receipts` ("Record top-up", `billing: manage`),
and `POST topup-receipts/reverse` ("Reverse top-up", `billing: manage`). The admin module adds
`POST users/:userId/starter-pass`, `POST users/:userId/starter-pass/revoke`,
`POST organizations/:organizationId/starter-pass`, and `POST organizations/:organizationId/starter-pass/revoke`
(`credits: grant`, body `{ note }`, 3 to 500 characters).

## Webhooks

Bootstrap gets `rawBody: true` (Nest native support on the Fastify adapter); the webhook controller is `@Public`, reads `RawBodyRequest`, verifies with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Then: insert event into `billing_webhook_events` (`on conflict do nothing` — if already processed, 200 immediately), process in a transaction, mark `processed|failed`. Always 200 on handled/skipped; 400 only on signature failure; 500 lets Stripe retry on processing failure.

`StripeEventRouter.route` does this for each event:

| Event | Effect |
|---|---|
| `checkout.session.completed`, `checkout.session.async_payment_succeeded` | Purpose `topup`: verify paid, mode, attempt, user, workspace, customer, and the amount (see "Grant"). Grant the credits of the attempt row once, then the affiliate commission. Purpose `order`: the order reconciler. Purpose `subscription` (an old session): sync the mirror and complete the attempt. |
| `checkout.session.expired`, `checkout.session.async_payment_failed` | Set the billing attempt to `expired`. An attempt with no session is found by `metadata.attemptId`. An order session goes to the order reconciler. |
| `customer.subscription.created`, `.updated` | Record the billing history and sync the mirror. |
| `customer.subscription.deleted` | Record the billing history and sync the mirror. No ledger row, no slot change (pricing v8 I5). |
| `customer.subscription.paused`, `.resumed`, `.pending_update_applied`, `.pending_update_expired`, `.trial_will_end` | Sync the mirror. |
| `invoice.paid` | Sync the mirror. Grant the old plan allotment one time (`inv:{invoiceId}:grant`), also for a canceled local row. Affiliate commission of the invoice. |
| `invoice.upcoming` | No effect. |
| `invoice.payment_failed` | Record the billing history and sync the mirror. |
| `invoice.payment_action_required`, `invoice.marked_uncollectible` | Sync the mirror. |
| `payment_intent.succeeded`, `.payment_failed`, `.canceled` | The order reconciler. |
| `charge.refunded` | Record the billing history. Revoke the purchased credits of the charge in proportion. Affiliate clawback. Order refund. |
| `charge.refund.updated`, `refund.updated`, `refund.failed` | Refund state of the charge and the order. Affiliate clawback. |
| `charge.dispute.created` | Revoke the purchased credits of the charge. Affiliate clawback. Take the Starter pass of the receipt: move it to another live receipt of the pool, else revoke it (reason `dispute:{disputeId}`). |
| `charge.dispute.closed` | On won, warning-closed, or prevented: restore only the excess revocation. |
| anything else | Mark `skipped`, 200. |

Failed inbox events are retried by a scheduled Trigger.dev task with capped exponential backoff; `POST /api/v1/admin/webhooks/:id/replay` dispatches an idempotent on-demand Trigger task for one durable event. Metering reconciliation and recovery, affiliate approval and attribution retry, signup-grant recovery, financial reconciliation, the SlickPay sweep, and model-price refresh also run in Trigger.dev. These billing jobs do not depend on `QUEUE_ENABLED`, Redis, or `apps/worker`.

The signup-grant handoff is only an accelerator: failed grants remain in `signup_grant_outbox` and the scheduled database sweep is authoritative. Affiliate-attribution retry is different because the signed signup token is intentionally not persisted in our database: its globally idempotent Trigger handoff is the durable retry. A missing or temporarily unavailable Trigger API key must not make the API fail to boot, but then attribution has only its inline attempt; production must configure the key before accepting attributed signups.

`apps/worker` and Redis remain only for four non-billing BullMQ queue contracts. The AI queue's `generate-copy` consumer performs chat streaming and settles the durable reservation carried by that job (`generate-site` and `revise-site` remain reserved job names). The media-generation, lead-processing, and publishing consumers are currently scaffolds that acknowledge jobs with `processed: false`; they do not perform product or billing side effects. The worker runs no billing maintenance schedule.

Trigger.dev deploys these UTC billing schedules (`apps/server/src/trigger`):

| Task id | Cron |
|---|---|
| `metering-reconciliation-sweep` | `* * * * *` |
| `metering-stranded-reservation-recovery` | `*/15 * * * *` |
| `affiliate-commission-approval-sweep` | `0 4 * * *` |
| `billing-webhook-dead-letter-retry-sweep` | `*/10 * * * *` |
| `financial-reconciliation-outbox-sweep` | `*/10 * * * *` |
| `signup-grant-outbox-sweep` | `*/5 * * * *` |
| `slickpay-payment-sweep` | `*/5 * * * *` |
| `lifecycle-events-sweep` | `*/5 * * * *` |
| `model-price-refresh` | `0 * * * *` |

Removed in pricing v8: `subscription-refill-sweep`, `manual-subscription-expiry`, and
`subscription-renewal-reminders`. After the deploy, the Trigger dashboard must not list them.

The metering schedule deliberately processes a bounded set of all pending generation references in one run per minute; provider events never fan out into per-event Trigger runs. Frequent schedules have bounded concurrency, finite maximum duration, and run TTLs shorter than their intervals so a delayed deployment cannot build an expensive stale backlog.

### Stripe endpoint operations

Local development uses the `stripe:listen` script in `apps/server/package.json`. The production webhook endpoint must use Stripe API version **`2026-02-25.clover`** and subscribe to this exact event set (keep it synchronized with that script). The subscription and invoice events stay until the next release, because old subscriptions can still send them:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.upcoming
invoice.payment_failed
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
charge.refunded
charge.refund.updated
refund.updated
refund.failed
charge.dispute.created
charge.dispute.closed
```

Set `STRIPE_PORTAL_CONFIGURATION_ID` to the reviewed restricted Billing Portal configuration in production. Without the override, the provider lists active configurations, reuses the named restricted fallback when present (or creates it once), re-enforces payment methods + invoices + period-end cancellation only, then caches its ID for the process. That fallback is code-owned; Dashboard edits are overwritten the next time a process resolves it.

### Cutover of the old subscriptions

Run `pnpm --filter server billing:cutover-payg` (dry run), then add `--apply`. The script grants
each pending refill slot, ends each live Stripe subscription with no proration
(`cancelSubscriptionNow`, key `payg-cutover:{subscriptionId}`), and ends each manual row. The
order and the runbook are in pricing v8 section 9. Before `--apply`, confirm that
`select count(*) from subscriptions where status = 'incomplete'` is 0.

Do not run `billing:migrate-v6` after pricing v8. It schedules plan downgrades.

## Env

Server (`packages/env/src/server.ts`), also in the Trigger.dev dashboard for the tasks:

- `STRIPE_SECRET_KEY` (`sk_`), `STRIPE_WEBHOOK_SECRET` (`whsec_`), and the production-stable
  `STRIPE_PORTAL_CONFIGURATION_ID` (`bpc_`).
- `SLICKPAY_PUBLIC_KEY`, `SLICKPAY_ENVIRONMENT` (`sandbox` or `production`), and
  `SLICKPAY_ACCOUNT_TYPE` (`merchant` or `user`). See [`slickpay.md`](slickpay.md).
- `TRIGGER_SECRET_KEY` for API-originated task handoffs.

Each key is optional at local boot. A billing endpoint fails on use when its provider is not
configured. The top-up and offline switches are admin settings, not env vars. Pricing v8 adds
no env var.

## Does not own

- Chat/generation consume wiring (slice 4 calls `CreditsService.consume` — interface ready here).
- Auto top-up, Stripe Tax, a card refund from the admin app, and in-app purchase in the native app.

## Files

`packages/db/src/schema/{credits,billing}.ts` + migrations · `packages/contracts/src/v1/{credits,billing}.ts` · `packages/env/src/server.ts` · `apps/server/src/modules/credits/**` · `apps/server/src/modules/billing/**` · `apps/server/src/main.ts` (rawBody) · `apps/server/scripts/cutover-pay-as-you-go.ts` · server AuthModule (`onUserCreated` wiring).

Source docs: docs/PRD.md §6.1, docs/features/credits.md, docs/features/pricing-v8-pay-as-you-go.md

## History (before pricing v8)

The text below describes the subscription system of pricing v6 and v7. It is not true for new
payments. Keep it for refunds, disputes, and reports of old rows.

### Old purpose

Everything needed for a personal workspace to start **Pro** and an organization workspace to
start **Business**. It supports enabled **top-up packs**, Stripe portal management, and
idempotent credit updates from webhooks. Stripe is adapter #1. LASATIM (CIB, DZD) can later
write the same ledger through adapter #2.

Starter remains available to existing subscribers and as a cancel-time retention offer.
See [`starter-cancel-offer.md`](starter-cancel-offer.md).

### Old settled decisions

- **Hand-rolled billing, not the Better Auth Stripe plugin** — we own the schema, the ledger semantics, and the provider port; the plugin would fight all three.
- **Plan catalog is code**: one config file in `@wandit/contracts` is the single source of truth for plans, tiers, prices, credit costs. The Stripe seed script, API responses, and the future pricing UI all derive from it. Zack tunes numbers in ONE place.
- **Stripe Prices resolved by `lookup_key`** (`starter_50_month`, `pro_175_year`,
  `topup_175` — format = `priceLookupKey()` in `@wandit/contracts`) — never hardcoded price
  IDs. The seed script creates Products and safely creates or replaces Prices.
- **Annual = ten monthly payments**, with month 1 granted on the paid invoice and eleven paid refill slots delivered by a scheduled Trigger.dev task over the annual period.
- **Upgrades are immediate** (proration `always_invoice`, with credit policy derived from the paid invoice). Tier downgrades apply at renewal without proration; yearly→monthly is not offered in v2.
- **Webhooks are the source of truth** for subscription state; API responses update the mirror opportunistically but never skip the inbox.
- **Currency:** USD prices in v1 (Stripe Checkout Adaptive Pricing can localize display later; EUR/DZD are catalog/config concerns, not schema concerns).

### Plan catalog (pricing v7 with Starter retention)

The plan ids are `starter`, `pro`, and `business`. Pro starts new personal subscriptions.
Business starts new organization subscriptions. Yearly prices are exactly 10× the monthly
prices.

Starter is a retention offer only. Entitled Stripe Pro subscribers on personal workspaces see
it in the cancel dialog. Acceptance schedules Starter at renewal through the existing change flow.
New checkouts and new offline requests reject Starter. The public catalog still includes it
for this offer and for existing Starter subscribers.

| Plan | Credits / month | Monthly | Yearly | Volume discount |
|---|---:|---:|---:|---:|
| Starter | 60 | $9 | $90 | 0% |
| Pro | 250 | $25 | $250 | 0% |
| Pro | 500 | $50 | $500 | 0% |
| Pro | 1,000 | $100 | $1,000 | 0% |
| Pro | 2,000 | $200 | $2,000 | 0% |
| Pro | 3,000 | $294 | $2,940 | 2% |
| Pro | 5,000 | $480 | $4,800 | 4% |
| Pro | 7,500 | $705 | $7,050 | 6% |
| Pro | 10,000 | $920 | $9,200 | 8% |
| Pro | 12,500 | $1,125 | $11,250 | 10% |
| Business | 250 | $50 | $500 | 0% |
| Business | 500 | $100 | $1,000 | 0% |
| Business | 1,000 | $200 | $2,000 | 0% |
| Business | 2,000 | $400 | $4,000 | 0% |
| Business | 3,000 | $588 | $5,880 | 2% |
| Business | 5,000 | $960 | $9,600 | 4% |
| Business | 7,500 | $1,410 | $14,100 | 6% |
| Business | 10,000 | $1,840 | $18,400 | 8% |
| Business | 12,500 | $2,250 | $22,500 | 10% |

Business is exactly 2× Pro at each tier; the pooled workspace allowance is what is priced.

The legacy Pro and Business tiers `250`, `500`, `1000`, `2000`, `3000`, `5000`, `7500`,
`10000`, and `12500` remain parseable and priced for existing subscriptions for up to 12
months. They are never purchasable and must not appear in the public catalog, checkout, plan
picker, or Stripe seed.

Top-ups stay disabled. Their v6 catalog values, for a future re-enable, are:

| Pack id | Credits | Price |
|---|---:|---:|
| `topup_175` | 175 | $25 |
| `topup_700` | 700 | $100 |
| `topup_1750` | 1,750 | $250 |

The old ids `topup_250`, `topup_1000`, and `topup_2500` remain parseable only for persisted
receipts, ledger metadata, and other history. Top-ups never expire and burn after plan and
promo credits.

The configurable signup grant is **20 promo credits = 2000 centi-credits = $0.64 of
AI-provider cost** and is disabled by default. Existing free users keep grants already issued;
there is no claw-back. Token-metered actions use the pricing-v7 anchor of $0.032 of
AI-provider cost per whole credit. Fixed per-operation costs remain superseded by measured
provider cost; see `pricing-v5-usd-anchor.md`.

#### Credit ↔ token costing: starting point + how to tune

Every metered operation records usage and the pricing snapshot used for its debit. Compare the
Gateway invoice with credits burned and tune the operation registry or `usdPerCredit` without
changing the ledger schema. Pricing v6 has no global retail-per-credit anchor; prices are
defined by valid plan/tier pairs.

### Old subscription tables

- `subscriptions` *(new)* — `id` uuid PK, `user_id` text FK→user (restrict), nullable
  `organization_id`, `provider`, `provider_subscription_id` unique, `plan` (`starter | pro |
  business`), `tier_credits` int, `interval` (`'month'|'year'`), `status` text (Stripe status
  vocabulary), `price_lookup_key` text, `current_period_start/end` timestamptz,
  `cancel_at_period_end` bool, timestamps + `updatedAt $onUpdate`. New personal subscriptions
  start on Pro. Current entitled Stripe personal subscribers on other plans can schedule Starter at renewal.
  Existing Starter rows, admin manual Starter grants, and renewals remain valid. Organization
  owners use Business. Partial unique indexes allow one non-terminal
  (`status not in ('canceled','incomplete_expired')`) subscription per owner.
- `billing_change_intents` — binds a preview, target price, `proration_date`, amount/currency, expiry, durable provider-attempt state, and replayable provider outcome. Stripe gets `proration_date` only when `anchor_reset` is false. An anchor reset (every upgrade) prorates at request time, because Stripe refuses both fields together.
- `billing_invoice_applications` — invoice-scoped grant journal and monotonic cycle guard.
- `subscription_refill_slots` — eleven charge/invoice-funded monthly refill slots for a paid yearly period.

### Old credit mechanics

- **Balance** = `sum(delta)`; burn order is plan → promo → top-up. Paid subscribers debit credits like everyone else.
- **Capped refill**: under the user advisory lock, one transaction snapshots the plan balance, expires only rollover above one allotment, grants one allotment, and journals the invoice application. Replay uses the same invoice/slot key and cannot take a fresh post-grant snapshot.
- **In-flight plan reservations**: durable plan holds participate in that snapshot and share the boundary's carry allowance. A delayed settlement can refund only its surviving allowance; subscription deletion forfeits plan holds before expiration so it cannot resurrect ended entitlements.
- **Monthly renewal** refills one tier allotment. **Yearly purchase/renewal** grants month 1 only and creates eleven calendar-month slots funded by that invoice/charge. A scheduled Trigger.dev task CAS-claims due slots and rechecks the canonical entitled mirror before granting.
- **Upgrades** grant only the current-month positive delta. Monthly→yearly performs a capped month-1 refill and creates slots. Yearly upgrades cancel/replace remaining slots. A tier downgrade creates an application-owned Stripe Subscription Schedule immediately, keeps the live paid tier unchanged, and takes effect at renewal with no proration; the local mirror records its target. Yearly→monthly is not supported.
- **Cancel at period end** leaves already-paid yearly slots active. Terminal deletion cancels slots and expires plan credits only when no other entitled subscription mirror exists.
- **Refunds/disputes** cancel pending slots funded by the charge and cumulatively claw back purchased credits. A favorable dispute closure recomputes fresh refund/dispute state and restores only excess revocation; valid refunds remain revoked.
- Top-ups: `topup` rows, bucket `topup`, never expire.

### Old endpoints

`PaymentProvider` port: `ensureCustomer`, `createSubscriptionCheckout`, `createTopupCheckout`, `createPortalSession`, `changeSubscription`, `setCancelAtPeriodEnd`, `parseWebhookEvent`. `StripeProvider` implements it (official `stripe` SDK, client built from validated env; explicit `@Inject` everywhere per repo DI convention).

Endpoints (all authed via global guard, `@CurrentUser`; response envelope idiom):

| Route | Behavior |
|---|---|
| `GET /api/v1/billing/plans` | catalog (public — UI pricing page reads this pre-auth) |
| `GET /api/v1/billing/subscription` | current subscription mirror + per-bucket balance |
| `POST /api/v1/billing/checkout` | persist attempt nonce, then create a nonce-idempotent subscription Checkout Session |
| `POST /api/v1/billing/topup` | `{packId}` → Checkout Session URL (payment mode) |
| `POST /api/v1/billing/portal` | restricted Billing Portal (payment method, invoices, cancel only) |
| `POST /api/v1/billing/change/preview` | Stripe preview (upgrades prorate at request time; downgrades use the fixed `proration_date`) + one-time change intent |
| `POST /api/v1/billing/change` | consume `{intentId}`; return `applied|payment_required|failed` plus fresh subscription/balance |
| `POST /api/v1/billing/cancel` · `/resume` | toggle `cancel_at_period_end` |
| `POST /api/v1/billing/sync` | re-fetch the authenticated user's Stripe subscriptions and return the refreshed subscription view; safe no-op without a configured customer/provider |
| `POST /api/webhooks/stripe` | public, raw body, signature-verified — below |

### Old webhook effects

| Event | Effect |
|---|---|
| `checkout.session.completed` | validate the persisted attempt; top-ups additionally verify pack, credits, amount, currency, and customer before fulfillment |
| `customer.subscription.created/updated` | upsert `subscriptions` mirror (plan/tier/interval derived from price lookup_key) |
| `customer.subscription.deleted` | cancel slots; conditionally expire plan bucket |
| `invoice.upcoming` | informational preview only; the application-owned Stripe Subscription Schedule already owns the period-end downgrade |
| `invoice.paid` | canonical-mirror, journaled lifecycle matrix; creates/replaces yearly slots as applicable |
| `invoice.payment_failed` | mirror status only (Stripe owns dunning) |
| `charge.refunded`, `charge.dispute.created` | cancel funded slots and proportionally revoke linked purchased grants |
| `charge.dispute.closed` | on won/warning-closed/prevented, restore only excess cumulative clawback |
| anything else | mark `skipped`, 200 |

### Old renewal reminders

Renewal reminder emails do not come from `invoice.upcoming`. The `subscription-renewal-reminders` Trigger task runs every hour. It emails only manual plans (SlickPay and offline), because they never renew by themselves. It picks each `active` or `trialing` manual subscription that does not cancel at the period end. The email goes to the buyer (`subscriptions.user_id`, never a banned user), about 3 days before `current_period_end`: "the plan expires; renew it on the billing page". The column `subscriptions.renewal_reminder_period_end` keeps it to one email per period. Stripe sends the renewal email of Stripe plans: keep the Stripe dashboard setting "Send emails about upcoming renewals" on.

### Old schedules

| Task | Cron |
|---|---|
| Subscription refill slots | `*/10 * * * *` |
| Batched metering reconciliation | `* * * * *` |
| Stranded reservation/checkpoint recovery | `*/15 * * * *` |
| Affiliate commission approval | `0 4 * * *` |
| Billing webhook dead-letter retry | `*/10 * * * *` |
| Signup-grant outbox | `*/5 * * * *` |
| Model-price refresh | `0 * * * *` |
| Subscription renewal reminders | `0 * * * *` |

### Old Stripe seed of subscription prices

The Stripe seed validates product, amount, currency, recurring interval, and metadata before
reusing a lookup-key price. Replacing a mismatched price is a prelaunch-only operation: the
script refuses any price attached to a non-terminal Stripe subscription, deactivates the old
price before transferring its lookup key, and uses an idempotent replacement create. If a
replacement is interrupted after deactivation, leave paid admissions disabled and rerun the
seed; do not manually reactivate and sell the stale price. For pricing v6, the seed iterates
only the purchasable tiers for each plan. It must not seed legacy tiers.

### Pricing v6 seed, migration, and deploy order

Use this order exactly.

1. Update the Resend welcome template to use the dynamic grant count, and update the W15/W16
   credit-threshold subject copy so it no longer quotes the old 25-credit milestone. Do this
   before changing any database or application code.
2. Run `pnpm db:migrate`. The repository migrator applies 0065 to 0068 together: 0065
   adds the `starter` enum label with `IF NOT EXISTS`, 0066 changes the signup grant to
   700 centi-credits, 0067 lifts it to 1800 centi-credits, and 0068 to 2000 centi-credits (20 credits, pricing v7). This is safe on PostgreSQL 12+: an enum value may be added inside a
   transaction when it is not used until after commit, and 0066 never references `starter`.
3. After 0066, restart every server instance or wait more than 30 seconds for each process's
   product-settings cache to expire before relying on the 20-credit grant.
4. Deploy contracts, server, web, admin, and the Trigger.dev image together as one release.
5. Run `pnpm --filter server stripe:seed` in Stripe test mode. Verify exactly 38 new
   subscription prices: 2 Starter, 18 Pro, and 18 Business. Also verify the 3 re-priced
   top-ups. Repeat with the live key only after test verification. **Do not archive old Stripe
   prices**: existing legacy subscriptions need them for up to 12 months.
6. Run `pnpm --filter server billing:migrate-v6` first and inspect every Stripe and manual row
   (pricing v7: it maps every legacy tier to the purchasable tier with the same price, e.g. 175 → 250),
   including its status and reason. Then rerun it with `--apply`. Monthly active/trialing legacy
   subscriptions switch price/local tier without proration; already-granted current-period
   credits remain. Yearly subscriptions retain the paid legacy allotment until renewal and use
   the pending-renewal mechanism. Pause paid admissions, plan changes, and resume operations for
   the duration of the apply run. Resolve every `failed` row; the apply command exits non-zero
   when any row fails. Treat the migration as an operational backstop after launch: whenever a
   legacy subscription is resumed, including through the Billing Portal, rerun the idempotent
   apply command and then rerun the dry run. Continue doing this after later resumes until the dry
   run reports no subscriptions requiring migration.
7. Send `pricing-v6-subscriber-notice.md`; the founder sends it.

### Historical billing-v2 production migration and rollback contract

> The following Redis-to-Trigger procedure is retained as the billing-v2 rollout record. It is
> not the pricing-v6 deployment sequence; use the ordered runbook above for v6.

> The Redis-to-Trigger cutover is deploy-time operational work. It is documented here but was
> not executed in this feature worktree. Do not deploy the final consumer-removal image directly
> over a worker that still has delayed billing jobs.

> **First-deploy fast path (the expected case):** the six billing BullMQ queues
> have never run in production — billing lands only via this branch, already in
> its final Trigger.dev form. If billing has never been deployed, SKIP steps 2
> and 6–9 entirely (there is nothing to drain, and the "transitional worker
> build" they reference exists only at commit `51fe67c`, not on any deployable
> branch). The full staged contract below applies only if an intermediate
> BullMQ-billing build was ever deployed.

Deploy and drain in this order:

1. Keep `signupGrantEnabled`, paid subscriptions, and top-ups disabled. Run `pnpm db:migrate`, then `pnpm --filter server billing:assert-zero-live-subs`; run the Stripe seed only after the assertion returns zero.
2. Deploy a transitional worker build that retains all six billing consumers but no longer calls `upsertJobScheduler`. Remove these persisted BullMQ scheduler ids and restart once to prove they are not recreated: `subscription-refill-sweep-scheduler`, `sweep-signup-grants`, `billing-webhook-retry-sweep-scheduler`, `refresh-model-prices`, `recover-stale-ai-usage`, and `affiliate-approval-daily`. Do not delete jobs they already emitted.
3. Deploy/index the complete `apps/server/src/trigger` task set with the seven schedules initially paused. Configure its database, Stripe, AI Gateway, and shared eager-bootstrap environment; smoke each task in a test environment.
4. Deploy the API producer switch with `TRIGGER_SECRET_KEY`, while leaving the transitional worker running. Confirm new signup-grant, affiliate-attribution, and admin-webhook handoffs go only to Trigger.dev.
5. Activate each UTC Trigger schedule exactly once using the table above. Confirm the one-minute metering task creates one batched run—not per-generation runs—that every schedule uses its bounded queue, and that the frequent schedules enforce their configured TTLs.
6. Audit the six legacy Redis queues—`subscription-refills`, `signup-grants`, `billing-webhooks`, `model-pricing`, `metering`, and `affiliate-maintenance`—across `waiting`, `active`, `delayed`, and `failed`. Cross-check DB truth: due pending refill slots, pending signup outbox rows, claimable webhook inbox rows, reserved/settled generation refs, and pending affiliate commissions.
7. Let active legacy jobs finish. Refill, signup, webhook, pricing, and metering sweep/reconcile jobs are DB-backed and may be removed only after the corresponding Trigger schedule has demonstrated recovery of the same persisted state.
8. Treat every legacy `retry-affiliate-attribution` payload as irreplaceable: it contains the only durable copy of the signed signup token. Trigger `affiliate-attribution-retry` with the exact `{userId, source, token}` and the global hashed tuple key used by the new dispatcher. Remove the Redis job only after Trigger accepts the run; never log or tag the token.
9. Require two consecutive clean audits: no active/delayed affiliate token jobs, no unaccounted legacy job, Trigger sweeps converging, and no new writes to the six old queues. Only then deploy this final worker/jobs-contract removal while retaining the AI/media/lead/publish worker and Redis.
10. Configure the pinned-version production webhook endpoint and `STRIPE_PORTAL_CONFIGURATION_ID`; verify Trigger schedules/runs, API health, remaining-worker health where enabled, and webhook delivery before enabling signup grants or paid admissions.

Migration 0017 is roll-forward-only because PostgreSQL cannot safely remove the added `promo` enum value in place. After any promo ledger row exists, rolling application code back before billing v2 will break bucket parsing. Recovery must keep the new contracts/schema-aware code deployed (or explicitly neutralize every promo row before a coordinated rollback); apply a corrective forward migration rather than reverting `0017`.

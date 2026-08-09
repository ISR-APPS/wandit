# Billing & Subscriptions (Stripe now, LASATIM/CIB later)

**Status:** billing v2 implementation · **Branch:** `feat/billing-subscriptions`
Extends `docs/features/credits.md` (slice 7) with the real-money layer (slice 8). This doc is the implementation spec.

## Purpose

Everything needed for a user to subscribe to **Pro** (choosing a monthly credit tier, Lovable-style), buy one-time **top-up packs**, manage/cancel via the Stripe portal, and have credits granted, expired, and revoked correctly and idempotently by webhooks. Payment-provider-agnostic: Stripe is adapter #1; LASATIM (CIB, DZD) can later write the same ledger through adapter #2.

## Settled decisions

- **Hand-rolled billing, not the Better Auth Stripe plugin** — we own the schema, the ledger semantics, and the provider port; the plugin would fight all three.
- **Plan catalog is code**: one config file in `@wandit/contracts` is the single source of truth for plans, tiers, prices, credit costs. The Stripe seed script, API responses, and the future pricing UI all derive from it. Zack tunes numbers in ONE place.
- **Stripe Prices resolved by `lookup_key`** (`pro_2400_month`, `pro_200_year`, `topup_1000` — format = `priceLookupKey()` in `@wandit/contracts`) — never hardcoded price IDs. The seed script creates Products and safely creates or replaces Prices.
- **Annual = ten monthly payments**, with month 1 granted on the paid invoice and eleven paid refill slots delivered by a scheduled Trigger.dev task over the annual period.
- **Upgrades are immediate** (proration `always_invoice`, with credit policy derived from the paid invoice). Tier downgrades apply at renewal without proration; yearly→monthly is not offered in v2.
- **Webhooks are the source of truth** for subscription state; API responses update the mirror opportunistically but never skip the inbox.
- **Currency:** USD prices in v1 (Stripe Checkout Adaptive Pricing can localize display later; EUR/DZD are catalog/config concerns, not schema concerns).

## Plan catalog (decided)

There is one paid plan, **Pro**, with nine monthly credit tiers. Yearly prices are exactly 10× the corresponding monthly price (two months free).

| Credits / month | Monthly | Yearly | Volume discount |
|---:|---:|---:|---:|
| 200 | $30 | $300 | 0% |
| 400 | $60 | $600 | 0% |
| 800 | $120 | $1,200 | 0% |
| 1,600 | $240 | $2,400 | 0% |
| 2,400 | $353 | $3,530 | 2% |
| 4,000 | $576 | $5,760 | 4% |
| 6,000 | $846 | $8,460 | 6% |
| 8,000 | $1,104 | $11,040 | 8% |
| 10,000 | $1,350 | $13,500 | 10% |

Business is exactly 2× Pro per tier (the pooled workspace allowance is what's priced).

Top-up packs (never expire, burn after plan and promo credits): `topup_200` $30 · `topup_1000` $150 · `topup_2000` $300.

The configurable signup grant is 50 promo credits and is disabled by default. Retail value is anchored at $0.10 per credit (250 credits = $25 base tier); token-metered actions use `max(1, ceil(rawUsd / usdPerCredit))` with `usdPerCredit = $0.028` ($7 of AI value per 250-credit base tier). Fixed costs are image 5/image, video 25, marketing 5, connector generation 5 (plus inline child operations at their own rates), lead scrape 5, and transcription by minute with a 1-credit minimum. Chat and page-builder usage are token-metered.

### Credit ↔ token costing: starting point + how to tune

Every metered operation records usage and the pricing snapshot used for its debit. After launch: compare Gateway invoice vs credits burned, target model COGS ≤ ~30% of retail credit value (1 credit retail = $0.10 at base tier), and tune the operation registry or `usdPerCredit` without changing the ledger schema.

## Data model (packages/db)

- `credit_ledger` *(exists)* — `bucket` uses `credit_bucket('plan','promo','topup')`; nullable `organization_id` remains a legacy/reserved field and is not an offered organization plan in v2; index `(user_id, bucket)`.
- `billing_customers` *(new)* — `id` uuid PK, `user_id` text unique FK→user (restrict), `provider` text (`'stripe'`), `provider_customer_id` text, unique(provider, provider_customer_id), timestamps.
- `subscriptions` *(new)* — `id` uuid PK, `user_id` text FK→user (restrict), nullable legacy `organization_id`, `provider`, `provider_subscription_id` unique, `tier_credits` int, `interval` (`'month'|'year'`), `status` text (Stripe status vocabulary), `price_lookup_key` text, `current_period_start/end` timestamptz, `cancel_at_period_end` bool, timestamps + `updatedAt $onUpdate`. Contracts and catalog accept only `pro`; the database `billing_plan` enum retains the legacy `business` value for migration compatibility only. Partial unique index: one non-terminal (`status not in ('canceled','incomplete_expired')`) subscription per user.
- `billing_webhook_events` — durable inbox with claim leases, attempt counts, failed-event retry, and terminal processed/skipped states.
- `billing_checkout_attempts` — a UUID nonce is persisted before either subscription or top-up Checkout Session creation; guarded states are `created → session_attached → completed|expired`.
- `billing_change_intents` — binds a preview, target price, fixed `proration_date`, amount/currency, expiry, durable provider-attempt state, and replayable provider outcome.
- `billing_invoice_applications` — invoice-scoped grant journal and monotonic cycle guard.
- `subscription_refill_slots` — eleven charge/invoice-funded monthly refill slots for a paid yearly period.

## Credit mechanics (modules/credits)

- **Balance** = `sum(delta)`; burn order is plan → promo → top-up. Paid subscribers debit credits like everyone else.
- **Capped refill**: under the user advisory lock, one transaction snapshots the plan balance, expires only rollover above one allotment, grants one allotment, and journals the invoice application. Replay uses the same invoice/slot key and cannot take a fresh post-grant snapshot.
- **In-flight plan reservations**: durable plan holds participate in that snapshot and share the boundary's carry allowance. A delayed settlement can refund only its surviving allowance; subscription deletion forfeits plan holds before expiration so it cannot resurrect ended entitlements.
- **Monthly renewal** refills one tier allotment. **Yearly purchase/renewal** grants month 1 only and creates eleven calendar-month slots funded by that invoice/charge. A scheduled Trigger.dev task CAS-claims due slots and rechecks the canonical entitled mirror before granting.
- **Upgrades** grant only the current-month positive delta. Monthly→yearly performs a capped month-1 refill and creates slots. Yearly upgrades cancel/replace remaining slots. A tier downgrade creates an application-owned Stripe Subscription Schedule immediately, keeps the live paid tier unchanged, and takes effect at renewal with no proration; the local mirror records its target. Yearly→monthly is not supported.
- **Cancel at period end** leaves already-paid yearly slots active. Terminal deletion cancels slots and expires plan credits only when no other entitled subscription mirror exists.
- **Refunds/disputes** cancel pending slots funded by the charge and cumulatively claw back purchased credits. A favorable dispute closure recomputes fresh refund/dispute state and restores only excess revocation; valid refunds remain revoked.
- Top-ups: `topup` rows, bucket `topup`, never expire.

## Billing module (modules/billing)

`PaymentProvider` port: `ensureCustomer`, `createSubscriptionCheckout`, `createTopupCheckout`, `createPortalSession`, `changeSubscription`, `setCancelAtPeriodEnd`, `parseWebhookEvent`. `StripeProvider` implements it (official `stripe` SDK, client built from validated env; explicit `@Inject` everywhere per repo DI convention).

Endpoints (all authed via global guard, `@CurrentUser`; response envelope idiom):

| Route | Behavior |
|---|---|
| `GET /api/v1/billing/plans` | catalog (public — UI pricing page reads this pre-auth) |
| `GET /api/v1/billing/subscription` | current subscription mirror + per-bucket balance |
| `POST /api/v1/billing/checkout` | persist attempt nonce, then create a nonce-idempotent subscription Checkout Session |
| `POST /api/v1/billing/topup` | `{packId}` → Checkout Session URL (payment mode) |
| `POST /api/v1/billing/portal` | restricted Billing Portal (payment method, invoices, cancel only) |
| `POST /api/v1/billing/change/preview` | fixed-proration Stripe preview + one-time change intent |
| `POST /api/v1/billing/change` | consume `{intentId}`; return `applied|payment_required|failed` plus fresh subscription/balance |
| `POST /api/v1/billing/cancel` · `/resume` | toggle `cancel_at_period_end` |
| `POST /api/v1/billing/sync` | re-fetch the authenticated user's Stripe subscriptions and return the refreshed subscription view; safe no-op without a configured customer/provider |
| `POST /api/webhooks/stripe` | public, raw body, signature-verified — below |

## Webhooks

Bootstrap gets `rawBody: true` (Nest native support on the Fastify adapter); the webhook controller is `@Public`, reads `RawBodyRequest`, verifies with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Then: insert event into `billing_webhook_events` (`on conflict do nothing` — if already processed, 200 immediately), process in a transaction, mark `processed|failed`. Always 200 on handled/skipped; 400 only on signature failure; 500 lets Stripe retry on processing failure.

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

Failed inbox events are retried by a scheduled Trigger.dev task with capped exponential backoff; `POST /api/v1/admin/webhooks/:id/replay` dispatches an idempotent on-demand Trigger task for one durable event. Yearly refills, metering reconciliation and recovery, affiliate approval and attribution retry, signup-grant recovery, and model-price refresh also run in Trigger.dev. These billing jobs do not depend on `QUEUE_ENABLED`, Redis, or `apps/worker`.

The signup-grant handoff is only an accelerator: failed grants remain in `signup_grant_outbox` and the scheduled database sweep is authoritative. Affiliate-attribution retry is different because the signed signup token is intentionally not persisted in our database: its globally idempotent Trigger handoff is the durable retry. A missing or temporarily unavailable Trigger API key must not make the API fail to boot, but then attribution has only its inline attempt; production must configure the key before accepting attributed signups.

`apps/worker` and Redis remain only for four non-billing BullMQ queue contracts. The AI queue's `generate-copy` consumer performs chat streaming and settles the durable reservation carried by that job (`generate-site` and `revise-site` remain reserved job names). The media-generation, lead-processing, and publishing consumers are currently scaffolds that acknowledge jobs with `processed: false`; they do not perform product or billing side effects. The worker runs no billing maintenance schedule.

Trigger.dev deploys these UTC schedules:

| Task | Cron |
|---|---|
| Subscription refill slots | `*/10 * * * *` |
| Batched metering reconciliation | `* * * * *` |
| Stranded reservation/checkpoint recovery | `*/15 * * * *` |
| Affiliate commission approval | `0 4 * * *` |
| Billing webhook dead-letter retry | `*/10 * * * *` |
| Signup-grant outbox | `*/5 * * * *` |
| Model-price refresh | `0 * * * *` |

The metering schedule deliberately processes a bounded set of all pending generation references in one run per minute; provider events never fan out into per-event Trigger runs. Frequent schedules have bounded concurrency, finite maximum duration, and run TTLs shorter than their intervals so a delayed deployment cannot build an expensive stale backlog.

### Stripe endpoint and catalog operations

Local development uses the `stripe:listen` script in `apps/server/package.json`. The production webhook endpoint must use Stripe API version **`2026-02-25.clover`** and subscribe to this exact event set (keep it synchronized with that script):

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

The Stripe seed validates product, amount, currency, recurring interval, and metadata before reusing a lookup-key price. Replacing a mismatched price is a prelaunch-only operation: the script refuses any price attached to a non-terminal Stripe subscription, deactivates the old price before transferring its lookup key, and uses an idempotent replacement create. If a replacement is interrupted after deactivation, leave paid admissions disabled and rerun the seed; do not manually reactivate and sell the stale price. Before the first production deployment, run `pnpm --filter server billing:assert-zero-live-subs`; any nonzero result activates the grandfathering appendix and must stop deployment.

Set `STRIPE_PORTAL_CONFIGURATION_ID` to the reviewed restricted Billing Portal configuration in production. Without the override, the provider lists active configurations, reuses the named restricted fallback when present (or creates it once), re-enforces payment methods + invoices + period-end cancellation only, then caches its ID for the process. That fallback is code-owned; Dashboard edits are overwritten the next time a process resolves it.

### Production migration and rollback contract

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

Env (packages/env server): `STRIPE_SECRET_KEY` (`sk_`), `STRIPE_WEBHOOK_SECRET` (`whsec_`), the production-stable `STRIPE_PORTAL_CONFIGURATION_ID` (`bpc_`), and `TRIGGER_SECRET_KEY` for API-originated task handoffs. Stripe and Trigger keys are optional at local boot; billing endpoints fail on use when Stripe is not configured, while persisted scheduled billing recovery is owned by the deployed Trigger.dev task runtime.

## Does not own

- Chat/generation consume wiring (slice 4 calls `CreditsService.consume` — interface ready here).
- Credits UI, pricing UI, org/seat mechanics (Better Auth organizations plugin later), LASATIM adapter (port ready), non-card async payment methods.

## Files

`packages/db/src/schema/{credits,billing}.ts` + migration · `packages/contracts/src/v1/{credits,billing}.ts` + catalog · `packages/env/src/server.ts` · `apps/server/src/modules/credits/**` · `apps/server/src/modules/billing/**` · `apps/server/src/main.ts` (rawBody) · `apps/server/scripts/seed-stripe.ts` · server AuthModule (`onUserCreated` wiring).

Source docs: docs/PRD.md §6.1, docs/features/credits.md

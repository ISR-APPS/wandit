# Billing & Subscriptions (Stripe now, LASATIM/CIB later)

**Status:** infrastructure build (backend only — UI plugs in later) · **Branch:** `feat/billing` (based on `feat/auth-accounts` + `dev`)
Extends `docs/features/credits.md` (slice 7) with the real-money layer (slice 8). This doc is the implementation spec.

## Purpose

Everything needed so that the moment the pricing UI exists, a user can: subscribe to **Pro** (choosing a monthly credit tier, Lovable-style), later **Business** (Pro + team features — backend-real, UI-hidden), buy one-time **top-up packs**, manage/cancel via the Stripe portal — and have credits granted/expired/revoked correctly and idempotently by webhooks. Payment-provider-agnostic: Stripe is adapter #1, LASATIM (CIB, DZD) slots in later as adapter #2 writing the same ledger.

## Settled decisions

- **Hand-rolled billing, not the Better Auth Stripe plugin** — we own the schema, the ledger semantics, and the provider port; the plugin would fight all three.
- **Plan catalog is code**: one config file in `@wandit/contracts` is the single source of truth for plans, tiers, prices, credit costs. The Stripe seed script, API responses, and the future pricing UI all derive from it. Zack tunes numbers in ONE place.
- **Stripe Prices resolved by `lookup_key`** (`pro_1200_month`, `business_100_year`, `topup_1000` — format = `priceLookupKey()` in `@wandit/contracts`) — never hardcoded price IDs. Idempotent seed script creates/updates Products + Prices.
- **Annual = 12× credits granted upfront** at each yearly cycle (no monthly-drip scheduler in v1; documented refinement — a BullMQ repeatable job — if we ever want drip).
- **Upgrades are immediate** (proration `always_invoice`, credit delta granted on the resulting invoice). Downgrade-at-period-end is a documented v2 refinement; v1 exposes the same immediate-change endpoint.
- **Webhooks are the source of truth** for subscription state; API responses update the mirror opportunistically but never skip the inbox.
- **Currency:** USD prices in v1 (Stripe Checkout Adaptive Pricing can localize display later; EUR/DZD are catalog/config concerns, not schema concerns).

## Plan catalog (placeholders — Zack tunes)

| | Free | Pro | Business (UI-hidden) |
|---|---|---|---|
| Signup grant | 100 credits, one-time, never expires | — | — |
| Base price | — | $25 / mo per 100 credits | $50 / mo per 100 credits |
| Credit tiers | — | 100, 200, 400, 800, 1200, 2000, 3000, 4000, 5000, 7500, 10000 / month | same |
| Annual | — | 20% off | 20% off |
| Volume discount | — | 0% ≤400 · 5% 800–2000 · 10% 3000–5000 · 15% 7500+ | same |
| Features | — | full generation access | Pro + `teamWorkspace`, `seats` flags (org mechanics post-MVP) |

Top-up packs (never expire, burn after plan credits): `topup_500` $15 · `topup_1000` $28 · `topup_2500` $65.
Credit costs (from credits.md, constants): page generation **10**, chat message **1**; reserved: image 5, video 25.
`price(tier, interval) = ceil(basePer100 × tier/100 × (1 − volumeDiscount(tier))) × (interval == annual ? 12 × 0.8 : 1)` — computed in the catalog, stored on Stripe by the seed script.

### Credit ↔ token costing: starting point + how to tune

Flat per-action prices now (above). Every `consume` row stores AI SDK token usage in `meta.tokenUsage` from day one. After launch: compare Gateway invoice vs credits burned, target model COGS ≤ ~30% of retail credit value (1 credit retail ≈ $0.25 at base tier), adjust the constants — no schema change ever needed to reprice.

## Data model (packages/db)

- `credit_ledger` *(exists)* — **additive migration**: add `bucket` `credit_bucket('plan','topup')` NOT NULL DEFAULT `'plan'` (existing rows are free/plan grants — backfill is the default), add nullable `organization_id` text (reserved for Business, no FK), add index `(user_id, bucket)`.
- `billing_customers` *(new)* — `id` uuid PK, `user_id` text unique FK→user (restrict), `provider` text (`'stripe'`), `provider_customer_id` text, unique(provider, provider_customer_id), timestamps.
- `subscriptions` *(new)* — `id` uuid PK, `user_id` text FK→user (restrict), nullable `organization_id` text (reserved), `provider`, `provider_subscription_id` unique, `plan` (`'pro'|'business'`), `tier_credits` int, `interval` (`'month'|'year'`), `status` text (Stripe status vocabulary), `price_lookup_key` text, `current_period_start/end` timestamptz, `cancel_at_period_end` bool, timestamps + `updatedAt $onUpdate`. Partial unique index: one non-terminal (`status not in ('canceled','incomplete_expired')`) subscription per user.
- `billing_webhook_events` *(new)* — `id` text PK (provider event id), `provider`, `type`, `payload` jsonb, `status` (`'received'|'processed'|'failed'|'skipped'`), `error` text, `processed_at`, `created_at`. Insert `on conflict do nothing` = at-least-once → exactly-once.

## Credit mechanics (modules/credits)

- **Balance** = `sum(delta)`; per-bucket sums for burn order. `GET /api/v1/credits/balance` → `{ balance, plan, topup }`.
- **Atomic consume**: tx → `pg_advisory_xact_lock(hashtext(user_id))` → per-bucket balances → split negative `consume` rows (plan bucket first, then topup) or throw typed `InsufficientCreditsError` (→ 402 in the exception filter). Idempotency key on the caller's job id.
- **Signup grant**: `grantSignupCredits(userId)`, idempotency key `signup:{userId}`, wired into `createAuth({ onUserCreated })` in the server AuthModule (seam already exists on the auth branch).
- **Renewal** (`invoice.paid`, billing_reason `subscription_cycle`): one `expire` row zeroing the plan bucket remainder + one `grant` row for the full tier (×12 if annual). Both idempotency-keyed on the invoice id.
- **Initial subscribe** (`subscription_create` invoice): grant tier (×12 annual). **Upgrade** (`subscription_update` invoice): grant `newTier − oldTier` when positive; when negative, write an `expire` row of `min(|delta|, plan-bucket balance)`.
- **Cancel**: flag at period end; on `customer.subscription.deleted`, expire the plan bucket remainder. **`past_due`** keeps previously granted credits until normal expiry, but is not an entitled subscription state and cannot bypass generation credit checks. Only `active` and `trialing` grant subscription entitlement.
- **Refunds/disputes** (`charge.refunded`, `charge.dispute.created`): cumulative refund target = `floor(original granted credits × amount_refunded / amount_captured)`. Revoke only the delta not already clawed back for the charge, from the same `plan` or `topup` bucket as each original grant. Deterministic refund/dispute ledger keys make retries idempotent, and each path subtracts prior charge clawbacks so a dispute followed by a refund cannot double-revoke. An owned refund that arrives before its order/grant remains retryable instead of being skipped; every payment-linked grant immediately re-fetches its Charge and applies any already-recorded refund/dispute. Paid invoice grants bind only to a paid payment source and fail loudly rather than choose arbitrarily when multiple paid sources exist. Balance may go negative by design.
- Top-ups: `topup` rows, bucket `topup`, never expire.

## Billing module (modules/billing)

`PaymentProvider` port: `ensureCustomer`, `createSubscriptionCheckout`, `createTopupCheckout`, `createPortalSession`, `changeSubscription`, `setCancelAtPeriodEnd`, `parseWebhookEvent`. `StripeProvider` implements it (official `stripe` SDK, client built from validated env; explicit `@Inject` everywhere per repo DI convention).

Endpoints (all authed via global guard, `@CurrentUser`; response envelope idiom):

| Route | Behavior |
|---|---|
| `GET /api/v1/billing/plans` | catalog (public — UI pricing page reads this pre-auth) |
| `GET /api/v1/billing/subscription` | current subscription mirror + per-bucket balance |
| `POST /api/v1/billing/checkout` | `{plan, tierCredits, interval}` → Checkout Session URL (subscription mode; ensures customer; `client_reference_id = userId`, metadata userId) |
| `POST /api/v1/billing/topup` | `{packId}` → Checkout Session URL (payment mode) |
| `POST /api/v1/billing/portal` | Billing Portal URL |
| `POST /api/v1/billing/change` | `{tierCredits, interval, plan?}` → optional Pro/Business plan switch plus subscription item price swap, proration `always_invoice` |
| `POST /api/v1/billing/cancel` · `/resume` | toggle `cancel_at_period_end` |
| `POST /api/v1/billing/sync` | re-fetch the authenticated user's Stripe subscriptions and return the refreshed subscription view; safe no-op without a configured customer/provider |
| `POST /api/webhooks/stripe` | public, raw body, signature-verified — below |

## Webhooks

Bootstrap gets `rawBody: true` (Nest native support on the Fastify adapter); the webhook controller is `@Public`, reads `RawBodyRequest`, verifies with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Then: insert event into `billing_webhook_events` (`on conflict do nothing` — if already processed, 200 immediately), process in a transaction, mark `processed|failed`. Always 200 on handled/skipped; 400 only on signature failure; 500 lets Stripe retry on processing failure.

| Event | Effect |
|---|---|
| `checkout.session.completed` | mode=payment → `topup` grant keyed on session id; mode=subscription → ensure `billing_customers` mapping |
| `customer.subscription.created/updated` | upsert `subscriptions` mirror (plan/tier/interval derived from price lookup_key) |
| `customer.subscription.deleted` | status canceled + expire plan bucket |
| `invoice.paid` | by `billing_reason`: create → grant; cycle → expire + re-grant; update → delta grant/expire |
| `invoice.payment_failed` | mirror status only (Stripe owns dunning) |
| `charge.refunded`, `charge.dispute.created` | proportionally `revoke` linked grants; owned-but-not-yet-mapped events fail retryably, while grant creation also reconciles the current Charge immediately |
| anything else | mark `skipped`, 200 |

Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` script in `apps/server/package.json`. Seed script `apps/server/scripts/seed-stripe.ts` (tsx): idempotently ensures 2 Products + all tier/interval Prices + top-up Prices by lookup_key.

Env (packages/env server): `STRIPE_SECRET_KEY` (`sk_`), `STRIPE_WEBHOOK_SECRET` (`whsec_`), `BILLING_ENABLED` flag optional — missing keys must fail loudly in prod, but dev without keys must still boot (provider throws on use, not on import).

## Does not own

- Chat/generation consume wiring (slice 4 calls `CreditsService.consume` — interface ready here).
- Credits UI, pricing UI, org/seat mechanics (Better Auth organizations plugin later), LASATIM adapter (port ready), monthly-drip for annual, period-end downgrades, non-card async payment methods.

## Files

`packages/db/src/schema/{credits,billing}.ts` + migration · `packages/contracts/src/v1/{credits,billing}.ts` + catalog · `packages/env/src/server.ts` · `apps/server/src/modules/credits/**` · `apps/server/src/modules/billing/**` · `apps/server/src/main.ts` (rawBody) · `apps/server/scripts/seed-stripe.ts` · server AuthModule (`onUserCreated` wiring).

Source docs: docs/PRD.md §6.1, docs/features/credits.md

# Pricing v8: pay as you go (wallet top-ups, no plans)

Decision date: 2026-11-12 (founder). Supersedes the plan catalog of
`pricing-v7-032-anchor.md` and the subscription parts of `billing.md`. The credit
unit does not change: 1 credit = $0.032 of AI-provider cost.

## 1. Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Product model | No plans. A user tops up a wallet with a one-time payment. Credits never expire. |
| D2 | Wallet | The wallet is the total balance: `plan + promo + topup`. The three ledger buckets stay. No ledger row moves at the cutover. |
| D3 | Expiry | No code writes an `expire` ledger row. No code lowers the refundable part of a plan hold. |
| D4 | Rate | Base rate: 10 credits for 1 USD. Pricing v8.1 adds a volume bonus (table below). It reverses the decision of Nov 12 ("no volume bonus"). One rate for personal and team wallets. No cashback. |
| D5 | Amounts | Presets 10, 20, 40, 100, 200 USD (v8.1). Custom amount in whole USD, minimum 10, maximum 1000. A custom amount gets the bonus of the same tier as a preset. One exception: the 1 USD Starter pass (D15). |
| D6 | Stripe | Checkout `mode: payment` with `price_data` (no lookup-key Price, no seed). USD only, cards only. |
| D7 | Algeria | SlickPay (DZD) and the offline request flow stay. Each one sells a wallet top-up of an amount. |
| D8 | Existing subscribers | They keep every remaining credit. The cutover script ends each subscription with no proration and no refund. |
| D9 | Entitlements | One rule replaces the plan: a **paid owner** has one or more top-ups, or had a subscription. |
| D10 | Models | Every priced model is available to every user. Credits bill the real provider cost. |
| D11 | Teams | Team creation needs only `organizationsEnabled`. The owner tops up the team wallet. |
| D12 | Affiliates | A Stripe top-up earns a commission with the terms of the attribution. |
| D13 | Trophies | v8.1: 40 personal trophies in 8 tracks (section 8). The spend badges are the Fuel track. A trophy gives no credits and no money. |
| D14 | Tables | No table and no enum value is dropped. Refunds, disputes, and reports read the old rows. |
| D15 | Starter pass | 2026-11-20 (founder). With the admin switch on, a pool that never paid cannot spend credits. It buys the Starter pass: 1 USD by card, or 250 DZD by SlickPay at the default rate (10 credits). Cash on delivery never sells the pass. See section 14. |
| D16 | DZD for everyone | 2026-11-20 (founder). The default rate is 250 DZD for 1 USD. Each visitor sees DZD prices next to USD prices, and the SlickPay tab, when SlickPay has a key. |

Volume bonus of D4 (`TOPUP_BONUS_TIERS`, pricing v8.1). The tier of an amount is
the last tier with `minAmountUsd <= amountUsd`.

| Amount (USD) | Bonus | Example |
|---|---:|---|
| 10 to 39 | 0% | 20 USD = 200 credits |
| 40 to 99 | +5% | 40 USD = 420 credits |
| 100 to 199 | +10% | 100 USD = 1,100 credits |
| 200 and more | +15% | 200 USD = 2,300 credits, 1000 USD = 11,500 credits |

Integers only: `baseCredits = usd * 10`, `bonusCredits = floor(baseCredits * percent / 100)`.
The margin stays at 60% or more for each amount (Stripe 2.9% + 0.30 USD, all
credits used). To go back to the flat rate, set `TOPUP_BONUS_TIERS` to `[]`. The
web then hides the bonus track.

Production at the decision date (read-only count): 76 live subscriptions, all
monthly. 70 Stripe (4 Starter, 64 Pro, 2 Business) and 6 manual Pro. 12 are set to
cancel at the period end and 10 are `past_due`. No refill slot, no top-up receipt,
no active plan hold, no `incomplete` row. 34 offline requests are open and 2
SlickPay rows are pending. `topups_enabled` is false.

## 2. Why the credits do not move

A move from bucket `plan` to bucket `topup` needs two ledger rows for each owner.
Each row can break a later refund:

- An `expire` row with `meta.subscriptionId` counts as "already taken back". A
  later refund of the subscription charge then revokes nothing.
- A positive row with `meta.chargeId` counts as a second grant of the charge. A
  later refund then revokes two times.
- A settle refund of a job that started before the move goes back to bucket
  `plan`, limited by its plan hold.

The balance is already the sum of the three buckets, and the admission check
reads the total. So the plan credits become wallet credits when the expiry
stops. The clients show one wallet number (`settledBalance`).

The spend order stays `plan`, `promo`, `topup`. The order is part of stored
idempotency fingerprints. With no expiry, the order has no money effect.

## 3. Invariants of this release

These rules hold from the moment this release is live, before the cutover script
runs. A Stripe webhook can be late or replayed, so each handler must be safe.

- I1. No code writes an `expire` row. `applyCappedRefill`, `expirePlanRemainder`,
  and `expireAmount` are deleted. Each caller of `applyCappedRefill` calls
  `CreditsService.grant` with bucket `plan`, the same idempotency key, and the
  same meta. The amount is the amount that the caller grants today.
- I2. No code calls `forfeitAllPlanHolds`, `applyPlanHoldBoundary`,
  `insertPlanHoldPool`, or `closePlanHoldPools`. The four repository methods are
  deleted. `refundConsumeAmount` keeps its read of the pools that exist today.
- I3. No code cancels a `pending` refill slot. Two exceptions stay: the refund
  and dispute clawback, and reason `replaced` when a new yearly invoice plans the
  same months again. The task `subscription-refill-sweep`, `sweepDueSlots`,
  `grantDueSlot`, `listDueSlotIds`, and `cancelPendingSlot` are deleted. The
  cutover script grants each pending slot.
- I4. A paid subscription invoice always grants its credits one time (key
  `inv:{invoiceId}:grant`), also when the local subscription row is `canceled`.
  Edits in `grantForPaidInvoice`: (a) the journal replay check stays the first
  step; (b) find the row with `findSubscriptionByProviderId` and throw only when
  no row exists; (c) delete the stale-cycle branch that journals `creditsDelta: 0`
  and delete `findCycleAtOrAfter`.
- I5. `customer.subscription.deleted` updates the local row and writes its state
  event. It writes no ledger row and cancels no slot.
- I6. No endpoint starts, changes, cancels, or resumes a subscription.
- I7. The refund and dispute code for old subscription charges stays, with two
  fixes in `findExpiredPlanCreditsForPayment`:
  - Do not count the `expire` row that the same refill transaction wrote
    (`created_at > earliestGrantAt`, not `>=`). That row removed credits of an
    earlier charge.
  - Also count an `expire` row whose `meta.providerSubscriptionId` is the
    provider id of the subscription of the grant. The `subdel:` rows of today
    have no `meta.subscriptionId`, so a late refund debits two times.
  Each fix has one spec case that fails on the old code.

Removed tasks: `subscription-refill-sweep`, `manual-subscription-expiry`,
`subscription-renewal-reminders`. Removed services: the renewal reminder service
and the sweep half of the refill service. The invoice handlers, the slot
planning, the subscription sync, and the webhook inbox stay.

## 4. Wallet top-up

### Contract (`packages/contracts/src/v1/billing.ts`)

```ts
TOPUP_PRESET_AMOUNTS_USD = [10, 20, 40, 100, 200]
TOPUP_MIN_AMOUNT_USD = 10
TOPUP_MAX_AMOUNT_USD = 1000
TOPUP_CREDITS_PER_USD = 10      // base rate, before the bonus
STARTER_PASS_USD = 1            // price of the Starter pass (D15), below the minimum on purpose
TOPUP_BONUS_TIERS               // [{ minAmountUsd, bonusPercent }], ascending (D4)
topupQuoteForUsd(amountUsd)     // { baseCredits, bonusPercent, bonusCredits, credits, nextTier }
topupCreditsForUsd(amountUsd)   // whole credits, bonus included
smallestTopupCovering(shortfall) // smallest whole USD whose credits cover a 402 shortfall
topupAmountUsdSchema            // z.number().int().min(10).max(1000)
```

The server computes the credits and stores them on the attempt row, the
SlickPay row, or the receipt. The webhook grants the stored number. The web
shows a quote from the same contracts function. The web credit count is display
only. The Stripe Checkout page shows the split as the product description, for
example "1,100 credits (1,000 + 100 bonus)". The
Stripe, SlickPay, and offline request bodies all use `topupAmountUsdSchema`. The Stripe and
SlickPay bodies have one more variant, `{ starterPass: true }`, with the fixed amount
`STARTER_PASS_USD`. The offline body has no such variant.

`// LIMIT:` the maximum is for one payment, not for one owner per day. Upgrade: a
daily sum from `billing_topup_receipts`.

### API (`/api/v1`)

| Route | Behavior |
|---|---|
| `GET /billing/wallet` | New. `{ balance, isPaidOwner, starterPassRequired, hasStripeCustomer, spentLast30DaysCredits, topup: { enabled, presetAmountsUsd, minAmountUsd, maxAmountUsd, creditsPerUsd } }` for the active workspace. `starterPassRequired` is optional (section 14). Each member can read it. `spentLast30DaysCredits` is the net consumption of this wallet in the last 30 days, in decimal credits, never below 0. |
| `POST /billing/topup` | `{ amountUsd }` or `{ starterPass: true }` → `{ url }`. Guards: `TopupsEnabledGuard`, `WebOriginWriteGuard` (new), `@RequireWorkspacePermission("billing", "manage")` (kept). For one release it also accepts `{ packId }` from a cached web bundle and maps the pack to its USD price (25, 100, 250). |
| `GET /billing/topup/status?sessionId=` | New. `{ status: "pending" }` or `{ status: "credited", credits }` (decimal credits, bonus included). `credits` is null for an old pack receipt with an unknown pack id. Finds the receipt by session id and the caller's user id. It does not read the workspace header. |
| `GET /billing/payments` | New. The last 50 receipts of the pool. Guard: `billing: manage`. Fields: provider, method, amount, currency, credits, paid date, `revokedCredits`, reversed date. |
| `POST /billing/slickpay/checkout` | `{ amountUsd }` or `{ starterPass: true }`, with the contact, in place of plan, tier, interval. |
| `POST /billing/slickpay/payments/:id/confirm` | Stays. The view has nullable `amountUsd`, `plan`, `tierCredits`, `interval`, and adds `credits`. |
| `POST /billing/manual-request` | `{ amountUsd, ...contact }` in place of plan, tier, interval. |
| `GET /billing/manual-request`, `POST /billing/manual-request/cancel` | Stay. The view has nullable `amountUsd`, `plan`, `tierCredits`, `interval` (34 open requests have a plan and no amount). |
| `POST /billing/portal` | Stays, for old invoices. |
| `GET /billing/plans`, `GET /billing/subscription` | Stay unchanged for one release. Cached web bundles call them. The new web does not. |

Removed: `POST /billing/checkout`, `/change/preview`, `/change`, `/cancel`,
`/resume`, `/sync`.

Kept unchanged for installed clients: `GET /credits/balance` (all eight fields)
and every field of the public settings. Section 14 adds only optional fields to both. `paidSubscriptionsEnabled` is the
constant `false` in the public settings. The admin settings card loses its
toggle and the grace-days field.

`revokedCredits` of a receipt comes from the ledger: `revoke` rows minus
`clawback_restore` rows with `meta.chargeId` of the receipt. It is null for a
receipt with no charge id. It always agrees with the wallet.

### Stripe flow

1. Under the owner lock, insert a `billing_checkout_attempts` row with
   `purpose = topup`, `amount_usd_cents`, and `credits` (centi-credits).
2. Open attempt of the same owner:
   - It has a session: expire the Stripe session, then continue. If Stripe says
     the session is complete, answer 409. (Before: a 30 minute block.)
   - It has no session and is younger than 5 minutes: its request is in flight.
     Answer 409.
   - It has no session and is older than 5 minutes: do not count it and do not
     set it to `expired`. If its session is paid later, the webhook attaches it
     by `metadata.attemptId`.
3. Create the session: `price_data` in USD with product name "Wandit credits",
   `payment_method_types: ["card"]`, `adaptive_pricing` off, metadata `attemptId`,
   `purpose`, `userId`, `organizationId`, success URL with
   `session_id={CHECKOUT_SESSION_ID}`. The Stripe idempotency key does not change.
4. The webhook verifies: paid, mode, attempt, purpose, user, workspace, Stripe
   customer, currency `usd`, `amount_subtotal = attempt.amount_usd_cents`, and
   `total_details.amount_discount = 0`. It takes the credits from the attempt
   row, never from Stripe metadata.
5. The grant does not change: `CreditsService.topup`, bucket `topup`, key
   `topup:{sessionId}`, receipt row, reconciliation outbox, in one transaction.

The web top-up start emits the product event `upgrade_clicked` with its
`method`. The lifecycle automations read it.

### Receipts: one table for every provider

`billing_topup_receipts` is the payment history of the wallet.

| Column | Rule |
|---|---|
| `session_id` (Drizzle property `providerReference`) | Stays NOT NULL and unique. Stripe session id, `slickpay:{paymentId}`, or `offline:{idempotencyKey}`. |
| `provider` | New. `text NOT NULL DEFAULT 'stripe'`. Values `stripe`, `slickpay`, `offline`. |
| `pack_id` | Becomes nullable. |
| `amount_cents`, `currency` | The money received, in the minor unit of `currency`. The currency is lower case. |
| `amount_usd_cents` | New, nullable. The USD value that set the credits. |
| `credits` | New, nullable. Centi-credits granted, the unit of the ledger. |
| `method` | New, nullable, enum `manual_payment_method`. |
| `reference`, `note` | New, nullable. The bank reference and the admin note of an offline row. |
| `recorded_by_user_id`, `request_id` | New, nullable. The admin and the offline request. |
| `reversed_at`, `reversed_by_user_id` | New, nullable. Set by "Reverse top-up". |

## 5. SlickPay and offline top-ups

Three independent switches stay: the card (`topups_enabled`), SlickPay (the env
key), and offline requests (`manual_payments_enabled`).

New rows store NULL in `plan`, `tier_credits`, and `interval`, never a
placeholder. Old code that reads such a row fails closed, and the new code
fulfils it.

### SlickPay

- The row stores `amount_usd_cents` and `credits` (centi-credits) at checkout.
  The invoice item name is "Wandit credits".
- Fulfil, under the owner lock, in one transaction: `CreditsService.topup` with
  key `slickpay-topup:{paymentId}`, one receipt (`slickpay:{paymentId}`), row set
  to `fulfilled`.
- A row from before this release (no `credits`): first run `findRecordedPayment`
  on `manual_subscription_payments`. On a hit, set the row to `fulfilled` and
  grant nothing. Else grant the larger of `tier_credits` (times 12 for a yearly
  row) and 10 credits for each USD of `amount_dzd * 100 / dzd_per_usd_rate`.
- A row can never fulfil with zero credits.
- The per-user limit and `WebOriginWriteGuard` stay. The country rule changed on 2026-11-20 (D16):
  `GET /billing/local-pricing` sends `dzdPerUsdRate` to every visitor. Its `slickpay` field stays
  Algeria-only, because old cached web bundles read it as "the visitor is in Algeria".

### Offline

- The customer asks for an amount.
- Admin action "Record top-up" (`@AdminPermission({ billing: ["manage"] })`). It
  can run with or with no request. Order:
  1. Resolve the owner. Keep the 404 and the refusal of an organization that is
     a personal workspace.
  2. Take the owner lock.
  3. Find the receipt `offline:{idempotencyKey}`. Same owner and credits: return
     the first result. Other values: 409.
  4. Load the request by id, or the open request of the owner. Run
     `assertRequestCanFundOwner`.
  5. Insert the receipt, call `CreditsService.topup` (key
     `offline-topup:{idempotencyKey}`), approve the request, in one transaction.
- The amount must be above zero. The method `slickpay` is refused.
- A request from before this release keeps its plan columns. The admin form
  shows the plan and suggests the plan price.
- `// LIMIT:` two records with two keys and no request both grant. Upgrade:
  refuse a second receipt with the same method and reference for one owner.

### Reverse top-up

SlickPay and offline payments have no refund event. Admin action "Reverse
top-up" on a receipt with provider `slickpay` or `offline`: under the owner lock,
`CreditsService.revoke` of the receipt credits (bucket `topup`, key
`topup-reverse:{receiptId}`) and `reversed_at` set, in one transaction. The
balance can go below zero, the same rule as a Stripe refund.

### Removed

Manual subscription grant, renew, and end. The expiry task. The renewal reminder
task. Grace days.

SlickPay and offline top-ups earn no affiliate commission (same as today).

## 6. Paid owner and entitlements

One function holds the rule: `isPaidOwner(owner)` is true when the pool has a
ledger row of kind `topup` of 100 credits or more (`PAID_OWNER_MIN_TOPUP_CENTI_CREDITS`,
the credits of a 10 USD top-up), or a `subscriptions` row whose status is not
`incomplete` or `incomplete_expired`. The threshold is a fraud rule: the 1 USD
Starter pass does not buy a backend, device minutes, or the badge removal. A personal check needs
`organization_id IS NULL`: an organization row holds the buyer in `user_id`.

Seven readers call this one function: V2 backends, V2 device sessions, the
project move, the page badge gate, the lifecycle dispatcher, the wallet view
(`GET /billing/wallet`), and the admin organization detail. The admin users list
uses a SQL copy of the same rule.
`resolveBillingPlan`, `ownerIsEntitled`, and the `entitled` lateral join are
removed.

| Gate | Free owner | Paid owner |
|---|---|---|
| Hide the "Made with Wandit" page badge | no | yes |
| V2 backends | 0 | personal 1, team 1000 |
| V2 device minutes each month | 0 | personal 60, team 180 |
| LLM models | all | all |
| Team creation | `organizationsEnabled` | `organizationsEnabled` |

The limits for a paid owner equal the Pro and Business limits of today.

- LLM run token: the API does not read `claims.plan`. The schema field becomes
  optional. The minters keep one constant value for this release, because an old
  API instance needs the claim during a deploy. The next release deletes it.
- Team creation dialog: name, create the organization, switch workspace, close.
  It reads no plan and starts no checkout.
- Dev seed: one `CreditsService.topup` of 250 credits with key
  `dev-seed:topup:{userId}`, and one Starter pass (source `admin`, note
  "dev seed"). No subscription row and no receipt. The dev account needs
  `BACKEND_LIMIT_OFF=true` for more than one V2 backend.
- Lifecycle emails: "free" means "not a paid owner and no open offline request".
  `payload.plan` is `paid` or `free`. A past customer gets no follow-up email of
  the four free-only events.

The user referral program does not use `isPaidOwner`. It has its own payment
rule, because it pays credits to a second user:

- First payment mark: the friend has a personal top-up receipt of 10 USD or more
  and no reversal (Stripe, SlickPay, or offline), or a personal plan payment with
  an amount above 0. A team payment does not count. The receipt value is
  `amount_usd_cents`. A receipt from before v8 has no such value: a USD receipt
  then uses `amount_cents`, and another currency does not count. Fraud rule: a
  1 USD Starter pass of a fake friend must not earn the 100-credit paid reward.
- Paid reward, after the 7-day hold: one of these payments has a net revoke of
  0. Net revoke = the `revoke` rows minus the `clawback_restore` rows of the
  payment in `credit_ledger`. Strict rule: any refund means "not paid".
- `UserReferralsRepository.markFirstPayments` and `hasLivePersonalPayment` hold
  the rule. The wire names `subscribed` and `subscribedCount` stay.

`// LIMIT:` a full refund of the only top-up keeps the owner paid. A hosted
backend, device minutes, and the team limit of 1000 are recurring costs that a
one-time top-up does not fund. V2 is closed on production; price them before V2
opens (WANDIT-153).

## 7. Affiliate commission on a top-up

- `AffiliateCommissionService.handlePaidTopup(session)`. `routeTopupCheckout`
  calls it after `grantTopup`. A throw keeps the webhook `failed`, as for an
  invoice.
- Source id: the Checkout Session id, in the existing columns
  `affiliate_invoice_candidates.stripe_invoice_id` and
  `affiliate_commissions.stripe_invoice_id`, with `billing_reason = 'topup'`. The
  two unique indexes are the idempotency keys. No migration.
- Always read the session again with `retrieveCheckoutSession`. Use
  `latest_charge.id` as the charge and `latest_charge.created` as the paid time.
- User: `billing_customers.user_id`, or
  `organization_billing_customers.attribution_user_id` for a team. Never the buyer.
- `reconcileCandidatesForUser` uses `retrieveCheckoutSession` when the reason is
  `topup`.
- Base: `amount_total` of the session. Same rate, window, hold, approval sweep,
  clawback, and payout as an invoice.
- A fixed one-time commission is `min(fixedAmountCents, base)`. No commission can
  be larger than its payment.
- A USD session with `amount_total` below 10 USD (the 1 USD Starter pass) earns no
  commission and writes no candidate. The one fixed earning of a program then stays
  for a real top-up.
- If the payer of the session is the affiliate, the candidate is `ineligible`.
  `// LIMIT:` a second account of the affiliate is not found; the hold stays.

## 8. Trophies (v8.1)

Code name: `trophy` (the word "badge" alone means the "Made with Wandit" page
badge). The v8 spend badges are now the Fuel track.

- Catalog: 40 trophies, 8 tracks (build, ship, craft, grow, team, rhythm, fuel,
  special), 4 rarities, 7 levels, in `packages/contracts/src/v1/trophies.ts`.
  Points come from the rarity. The level comes from the points.
- Personal to the user. The server computes the facts on read and stores each
  trophy on its first unlock in `user_trophies` (migration 0102). A stored trophy
  stays, so points and the level never go down.
- Rhythm: build weeks (ISO week, UTC, one settled build or more). No day streak
  and no penalty for a lost streak.
- Routes: `GET /api/v1/trophies` and `POST /api/v1/trophies/seen`. Both read the
  session user id. They do not read the workspace header.
- A trophy gives no credits and no money (D13).

Fuel track: the figure is the lifetime net credits consumed from the personal
wallet of the user, all buckets: consume rows minus settle and reconcile refunds
(`CreditsRepository.netConsumedCentiCredits`, cast to `bigint`). Credits spent
before v8 count. The targets come from `SPEND_BADGES` in `credits.ts`. The
trophy id is `spend_<badge id>`, for example `spend_spark`.

| Spend badge id | Credits spent |
|---|---:|
| `spark` | 10 |
| `apprentice` | 100 |
| `builder` | 500 |
| `artisan` | 2,000 |
| `master` | 5,000 |
| `legend` | 20,000 |

The spend badges have no route of their own. They are the Fuel track of
`GET /api/v1/trophies`. No released build called a spend-badge route.

`// LIMIT:` team-wallet spend earns no personal trophy. An open reservation
counts until it settles, and a refund can lower the figure below a target. The
stored trophy stays in that case.

## 9. Cutover

### Migration (additive, `0101`)

New nullable columns, the receipts columns of section 4, and `DROP NOT NULL` on
`plan`, `tier_credits`, `interval` of `slickpay_payments` and
`manual_subscription_requests`, and on `billing_topup_receipts.pack_id`. No new
enum value. No data change: the founder flips the switches in the admin settings.

### Script `apps/server/scripts/cutover-pay-as-you-go.ts`

Run: `pnpm --filter server billing:cutover-payg` (dry run), then `--apply`.
Design copied from `migrate-subscriptions-v6.ts`: a pure function with injected
dependencies, one report row for each subscription, exit code 1 on a failure, a
second run is a no-op.

Order of one run:

1. Preflight. Stop on a `billing_webhook_events` row that is not `processed` or
   `skipped` and whose type is `invoice.paid`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `checkout.session.completed`, or `checkout.session.async_payment_succeeded`.
   Print each blocking row.
2. Expire each open Stripe Checkout Session of purpose `subscription`. If Stripe
   says a session is complete, print it and exit with code 1 at the end: run
   `--apply` again after the webhook is processed.
3. Select each subscription whose status is not `canceled` or
   `incomplete_expired`, and each subscription of any status that has a `pending`
   refill slot.
4. For each one, after a fresh read:
   - Report: owner, provider, plan, tier, status, the balance of each bucket, the
     pending refill slots, and a Stripe customer balance that is not zero.
   - Grant each `pending` slot in its own transaction under the owner lock: plain
     grant, bucket `plan`, key
     `refill:{subscriptionId}:{fundingInvoiceId}:{periodOrdinal}`, the meta and
     the reconciliation outbox row of the slot grant of today, slot set to
     `granted`.
   - Stripe row: `cancelSubscriptionNow` (no proration, no final invoice), Stripe
     idempotency key `payg-cutover:{subscriptionId}`, then
     `syncFromStripe(providerCustomerId)`. The script writes no state event for a
     Stripe row; the webhook writes it. A row that was `incomplete` before the
     cancel gets the local status `incomplete_expired`.
   - Manual row: set `canceled` and write one `ended` state event with the key
     form of the old `terminate`.
5. Print the ledger sum of each owner before and after. For a monthly subscriber
   the two sums are equal.
6. With `--released-at=<ISO time>`: count the `expire` ledger rows created after
   that time. A count above zero prints the rows and gives exit code 1. An
   `expire` row after the release proves that old code handled an event.

The script does not void open invoices. Stripe stops automatic collection for a
canceled subscription. If a `past_due` customer pays an old invoice from its
link, I4 grants the credits of that plan.

### Runbook

Precondition: `main` contains `dev` at migration 0100 and the release steps of
those features are complete.

0. Before the deploy:
   - Admin settings: turn off paid subscriptions. Wait 30 seconds.
   - Read-only SQL: the open SlickPay rows (`created`, `pending`, `paid`). Set
     each refunded `paid` row to `failed`.
   - Read-only SQL: the manual subscriptions that end during the deploy. Deploy
     after that time.
   - Read-only SQL: each owner with a negative sum in bucket `plan`, and each
     owner with a `subdel:` expire row and a later refund revoke. Correct a wrong
     debt with the admin grant.
   - Trigger dashboard: deactivate the `slickpay-payment-sweep` schedule. The
     old worker grants a manual plan for a paid SlickPay row, and the new API
     grants a top-up for the same row. Then read-only SQL: no SlickPay row has
     the status `pending` or `paid`. Wait for each such row to settle first.
   - Resend: stop the pre-renewal automation and end its waiting runs. Replace
     the plan text of the upgrade automations with top-up text.
   - SlickPay sandbox and production: create one invoice of 2700 DZD and one of
     270000 DZD. If one fails, change the SlickPay limits.
   - Send the notice to subscribers (the founder sends it).
1. Run `pnpm db:migrate` against production (no deploy pipeline runs it). It
   applies 0101 and 0102 (`user_trophies`). Then deploy in this order: API and harness host, then
   the Trigger.dev worker, then web and admin. Gate: the Trigger dashboard shows
   the new version as current, the three removed schedules are not in the list,
   and no old API instance gets traffic. Wait 5 minutes. Then activate the
   `slickpay-payment-sweep` schedule again.
2. Admin settings: turn on top-ups. Make one card top-up and one SlickPay top-up.
3. In the same session: run the script dry run, read every row, then run it with
   `--apply --released-at=<deploy time>`.
4. Stripe Dashboard: list the subscriptions of each status but `canceled`. The
   list must be empty. Cancel a remaining one by hand with no proration.
5. After 24 hours run the dry run again with `--released-at`. If it lists a row,
   run `--apply` again.
6. Stripe Dashboard: archive the subscription Prices. Do not delete them.

A renewal that Stripe charges between step 1 and step 3 grants one allotment of
the plan (I4) and expires nothing. The plan rate applies: 250 credits for 25 USD
on Pro, 60 for 9 USD on Starter, 250 for 50 USD on Business.

## 10. Copy and surfaces

Every text that states a plan, a renewal, or an upgrade changes to wallet and
top-up text, in `en`, `fr`, and `ar`:

- Web: the `/pricing` page and its meta description, the landing pricing section
  and FAQ, the wallet page at `/billing`, the top-up dialog, the credits chip,
  the out-of-credits texts, the sidebar and header button, the page badge hint,
  the team texts, the app database limit text, the V2 banner, the billing return
  pages, the error codes, and the view of an open offline request.
- The return page keeps a `purpose=subscription` branch for one release. It
  refreshes the balance and shows a neutral "payment received" text.
- Legal terms: the plan and renewal statements become false. The web changes
  them to the top-up facts. A legal review is still necessary.
- Native: no code change. Change the text of the shared keys in place. Do not
  rename or remove a key: `apps/native` has no type check. The link to `/billing`
  stays. The native app shows no price.
- Admin: the offline billing pages, the settings card, the refund dialog texts,
  the user and organization detail.
- Server: the staff email for a new offline request.

## 11. Admin numbers

- Revenue analytics: the two top-up queries add `provider = 'stripe'`. An offline
  or SlickPay row never joins the USD cash total.
- Overview revenue card: add the Stripe USD receipts.
- Offline billing header: sum the old payment table plus the receipts of
  provider `slickpay` and `offline`, for each currency.
- Story links: a receipt makes a user paid; add the Stripe USD receipts to the
  revenue.
- "Paid" in analytics: one SQL fragment gives the first payment time of an owner,
  the earliest of the first subscription and the first receipt. The CTEs
  `paid_users`, `first_subscriptions`, `ever_paid_owners`, and `live_owners` use it.
- MRR, churn, retention, and plan mix stay as history in this release.
- "Refund last plan payment": the title and texts name the plan payment and send
  the admin to the Stripe Dashboard for a top-up. `paidOffline` is true when the
  personal pool has a `slickpay` or `offline` receipt newer than the latest paid
  Stripe invoice.

## 12. After the cutover (next release)

Delete only after the runbook reports no subscription and Stripe lists no open
invoice for these customers: the invoice half of `SubscriptionCreditsService`,
the subscription mirror sync, the yearly slot code, the plan catalog, the Stripe
subscription provider methods, the `customer.subscription.*` and `invoice.*`
webhook routes, `GET /billing/plans`, `GET /billing/subscription`, the `packId`
body, the plan claim of the LLM run token, and the subscription cards of the
admin analytics and affiliate pages. Keep the refund and dispute code and every
table.

## 13. Out of scope

Auto top-up, Stripe Tax, a refund of a card top-up from the admin app (use the
Stripe Dashboard: the webhook revokes the credits in proportion), a low-balance
email, in-app purchase in the native app.

## 14. Starter pass (2026-11-20)

Founder request: show prices in DZD (1 USD = 250 DZD). A user spends credits only after a real
payment of 1 USD or 250 DZD. Many accounts abused the free credits. Cash on delivery stays
for top-ups only, never for the 1 USD payment.

Names: the UI says "Starter pass" (fr "Pass Démarrage", ar "تذكرة البداية"). The code says
`starterPass` or `starter_pass`. The word `starter` alone is the old v6 plan id.

### Rules

| Item | Value |
|---|---|
| Switch | `product_settings.starter_pass_required`, default `false`. Admin Settings, Product controls, toggle "Starter pass". |
| Price | `STARTER_PASS_USD` = 1 USD by card. By SlickPay, `dzdPriceFor(1, rate)`: 250 DZD at the default rate. |
| Credits | `topupCreditsForUsd(1)` = 10 credits, bucket `topup`. |
| Pool | The credit pool: a personal wallet or a team wallet. A team pass never holds the buyer. |
| Cash | The offline request keeps its 10 USD minimum. The dialog has no Cash / transfer tab in Starter pass mode. |
| Paid owner | The pass does not make a paid owner. That needs a top-up of 100 credits or more (section 6). |

The gate applies only while the switch is on. A pool with no live pass then keeps its credits, but
it cannot start new spend. This includes the signup grant, the referral credits, and promo credits.

### Data (`packages/db`, migration `0104_starter-pass`)

- Enum `starter_pass_source`: `stripe`, `slickpay`, `offline`, `grandfathered`, `admin`.
- Table `starter_passes`: `user_id` or `organization_id` (CHECK: exactly one), `source`,
  `receipt_id` (FK `billing_topup_receipts`, set null), `granted_by_user_id`, `note`,
  `created_at`, `revoked_at`, `revoked_by_user_id`, `revoked_reason`.
- Two partial unique indexes keep one live pass (`revoked_at` NULL) for each personal pool and
  for each team pool. A revoked row stays as history.
- `product_settings.starter_pass_required boolean NOT NULL DEFAULT false`.
- The `dzd_per_usd_rate` default becomes 25000 (250.00 DZD). The migration also sets the row to
  25000 when it still holds the old default 27000. A rate that an admin chose stays.

### Gate (`modules/credits`)

- `CreditsRepository.getSettledBalanceSnapshot` returns `starterPassRequired` from the same SQL
  statement as the sums. It is true when the switch is on and the pool has no live pass.
  A missing settings row means "off".
- `CreditsService.consume` with `admission: "requirePositiveBalance"` checks it after the replay
  return. A reserve that already committed stays admitted.
- The refusal is the usual 402 `INSUFFICIENT_CREDITS` (`InsufficientCreditsError`), with the same
  message and `details.reason = "starter_pass_required"`.
- `AppProjectsService` refuses a V2 project create the same way, before any row exists.
- Settle and completion debits (`allowOverdraft`) do not check the pass, so a running job
  never gets stuck.
- The Trigger.dev runtimes build `CreditsService` with `CreditsRepository`, so they get the gate
  with no other change.
- `GET /credits/balance`, `GET /billing/wallet`, and the payer block of the V2 turn estimate
  send `starterPassRequired`. The field is optional, so a new client survives an old API.

### Buy the pass

- Card: `POST /billing/topup` with `{ starterPass: true }`. Under the owner lock, the API reads
  the snapshot. If the pool does not need the pass, it answers 409 `STARTER_PASS_NOT_AVAILABLE`.
  The session sets `request_three_d_secure = "any"` against card testing.
- SlickPay: `POST /billing/slickpay/checkout` with `{ starterPass: true, fullName, phone, city }`.
  Same 409 rule, under the same owner lock.
- One open Starter pass page per pool, over card and SlickPay. The check and the insert run under
  the owner lock. SlickPay cannot cancel an invoice, so an open SlickPay pass row younger than
  30 min blocks:
  - SlickPay again, same buyer: the API answers the same `{ paymentId, url }` and makes no invoice.
    Another team admin gets 409 `STARTER_PASS_SLICKPAY_OPEN`.
  - Card: 409 `STARTER_PASS_SLICKPAY_OPEN`.
  A SlickPay pass request first expires the open card sessions of the pool. A session that Stripe
  does not expire answers 409 `BILLING_CHECKOUT_PENDING`. After 30 min, a buyer can still pay the
  old SlickPay page. It then grants its 10 credits like a normal payment.
- Each fulfilled card top-up and SlickPay top-up gives the pass, not only the 1 USD payment.

### Writers and revokers

Every write runs in the transaction and under the owner lock of its receipt or credit grant.
`StarterPassesRepository.grantIfAbsent` returns null when the pool has a live pass, so a second
grant is a no-op.

| Event | Effect | Source or reason |
|---|---|---|
| Paid card top-up (`SubscriptionCreditsService.grantTopup`) | Grant, with the new receipt | `stripe` |
| Paid SlickPay top-up (`SlickpayPaymentsService`) | Grant, with the new receipt | `slickpay` |
| Admin "Record top-up" (cash, transfer, CCP) | Grant, with the new receipt | `offline` |
| Admin grant | Grant. A live pass is returned with no write. | `admin`, with the note |
| Dev seed | Grant on each boot. A live pass makes it a no-op. | `admin`, note "dev seed" |
| Switch goes from off to on | Backfill (`grandfatherAll`) | `grandfathered` |
| Admin "Reverse top-up" | Move or revoke the pass of this receipt | `receipt_reversed:{receiptId}` |
| Stripe `charge.dispute.created` | Move or revoke the pass of this receipt | `dispute:{disputeId}` |
| Admin revoke | Revoke the live pass | `admin:{note}` |

Move rule: the pass of a lost receipt goes to the newest other live receipt of the same pool. A
live receipt is not reversed, has no refund or dispute revoke row on its charge, and never gave
a revoked pass. If no such receipt exists, the pass is revoked.

A refund (`charge.refunded`) and a won dispute do not change the pass. An admin can grant it again.

### Backfill when the switch goes on

`ProductSettingsRepository.updateIfVersion` runs `grandfatherAll` in the same transaction as the
settings write, only when the value goes from `false` to `true`. So no paying pool is refused
between the two writes. The API then logs
`starter_pass_required_enabled admin=<id> grandfathered_passes=<count>` when the count is above 0.

A pool gets a `grandfathered` pass when it paid before (the old paid-owner rule, with no amount
threshold):

- a `subscriptions` row whose status is not `incomplete` or `incomplete_expired`,
- a `credit_ledger` row with kind `topup` in bucket `topup`,
- a `credit_ledger` row with `meta.reason = 'admin_grant'`,
- for a personal pool only, a `payment_orders` row (domain purchase) in `paid`, `fulfilling`, or
  `fulfilled`.

A pool with any pass row, a revoked one included, gets nothing. An admin revoke then stays after
a second flip. `// LIMIT:` two full scans of `credit_ledger` for each flip. Upgrade: batch by owner id.

### Fraud rules for a 1 USD payment

- Paid owner: a top-up ledger row of 100 credits or more (`PAID_OWNER_MIN_TOPUP_CENTI_CREDITS`).
  The admin users list uses the same constant.
- User referrals: only a receipt of 10 USD or more marks the first payment and pays the reward
  (section 6).
- Affiliates: a USD top-up below 10 USD earns no commission (section 7).

### Surfaces

- Web top-up dialog: when the wallet says `starterPassRequired`, it opens in Starter pass mode. It
  shows the fixed price and the Card and "CIB / Edahabia" tabs only.
- Web `/billing`: a Starter pass card at the top. `/billing?starterPass=1` opens the dialog once.
- Web out-of-credits banner, builder chat, V1 chat, project create, and the insufficient-credits
  dialog show the Starter pass text. They read `starterPassRequired` from the balance, or
  `reason = "starter_pass_required"` from a 402.
- A team member without billing rights sees "Ask the team owner to buy the Starter pass".
- `/pricing`: a Starter pass strip replaces "Start free" when the public setting
  `starterPassRequired` is true.
- Native: the banner and the create error show the Starter pass text. The button opens
  `/billing?starterPass=1` on the web.
- Admin: a badge in the users list, and a pass card on the user and organization detail. The card
  grants and revokes with a note. The credit grant and "Record top-up" dialogs show a note when
  the pool has no pass. The overview tile `starterPassesInRange` counts passes of source `stripe` and `slickpay` created
  in the range. A revoked pass still counts.
- Admin routes: `POST /api/v1/admin/users/:userId/starter-pass` and `.../starter-pass/revoke`, and
  the same two for `organizations/:organizationId`. Permission `credits: grant`. Body `{ note }`,
  3 to 500 characters.

Out of scope:
- one pass for each card fingerprint,
- a payer check on the sandbox wake,
- the copy of the Resend welcome template,
- `paymentEventsSql` of the admin analytics.

### Rollout runbook

Precondition: section 9 is complete, and the branch with migration 0104 is on `main`.

1. In the SlickPay sandbox, create one invoice of 250 DZD, one of 2500 DZD, and one of 250000 DZD.
2. In SlickPay production, create the same three invoices.
3. If an invoice fails, change the SlickPay limits before you continue. The 250 DZD invoice is the pass.
4. Run `pnpm db:migrate` against production. It applies `0104_starter-pass`.
5. Deploy the API and the harness host.
6. Deploy the Trigger.dev worker. Make sure that the Trigger dashboard shows the new version as current.
7. Deploy web and admin.
8. In admin Settings, read "USD → DZD rate". If the value is not 250, set it to 250.
9. In admin Settings, make sure that "Card top-ups" is on. Users outside Algeria can pay only by card.
10. List the open offline requests with read-only SQL (query below). Process each one, or contact the customer.
11. In admin Settings, Product controls, turn on "Starter pass". The save runs the backfill.
12. In the API log, find `starter_pass_required_enabled`. Write down `grandfathered_passes`.
13. Count the passes by source with read-only SQL (query below).
14. On a test account that never paid, make sure that the web shows the Starter pass.
15. Buy the pass by card. Make sure that the account can then start a builder turn.

```sql
-- Step 10: open offline requests.
select id, user_id, organization_id, amount_usd_cents, status, created_at
from manual_subscription_requests
where status in ('pending','contacted','no_answer','call_back','wrong_number','awaiting_payment')
order by created_at;

-- Step 13: passes by source.
select source, count(*) from starter_passes where revoked_at is null group by source;
```

A pool with an open offline request and no pass cannot spend after step 11. "Record top-up" of
its payment gives the pass and unlocks the pool.

Rollback: turn off "Starter pass" in admin Settings. Every pool can spend again, and the passes
stay. A second turn-on runs the backfill again and adds only pools that have no pass row.

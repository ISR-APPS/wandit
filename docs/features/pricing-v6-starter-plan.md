# Pricing v6 — Starter plan, 175-credit Pro base, 7-credit grant

Decision date: 2026-09-02. Founder decisions after the pricing A/B tests.
Supersedes the plan catalog of `billing.md` §"Catalog" and the 50-credit grant
of `pricing-v5-usd-anchor.md` §1 (the $0.04 unit itself is unchanged and
`pricing-v5-usd-anchor.md` stays authoritative for it).

## 1. Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Credit unit | Unchanged. 1 credit = $0.04 of AI-provider cost (`AI_USD_PER_CREDIT`). No metering change. |
| D2 | Free signup grant | 18 credits = 1800 centi-credits = $0.72 of provider cost (amended 2026-09-04; was 7 credits / 700 cc / $0.28 from 2026-09-02 to 2026-09-04). Was 50 credits / 5000 cc / $2.00. |
| D3 | New plan `starter` | $9 / month, $90 / year (amended 2026-09-03; was $8 / $80). One tier: 50 credits / month ($2.00 of AI). Personal workspaces only. |
| D4 | Pro | Same 9 monthly prices as today. Credits × 0.7. Base tier 175 credits / $25 ($7.00 of AI). |
| D5 | Business | Same rule as today: same tiers as Pro, exactly 2× the Pro price. Org workspaces only. |
| D6 | Top-ups | Stay disabled. Re-priced to the Pro rate so they never undercut a plan if re-enabled. |
| D7 | Existing subscribers (~50) | Monthly: move to the new tier at the next renewal (same price, fewer credits). Yearly: keep the legacy tier until the year ends, then move. |
| D8 | Existing free users | Keep their 50-credit grant. No claw-back. |
| D9 | Per-credit dollar values | Never shown to users. No "$0.04", "$0.10", "per credit" price anywhere in en / fr / ar copy. |
| D10 | Landing free card | Shows the real grant count ("7 free credits") when the grant switch is on. |
| D11 | Starter card | Shows the included credits as a headline line ("50 credits / month"). |

## 2. The catalog (authoritative numbers)

Plan ids: `["starter", "pro", "business"]`. `starter` has no underscore, so
lookup keys `starter_50_month` / `starter_50_year` parse.

### Purchasable tiers (per plan)

| Plan | Tier credits | Monthly USD | Yearly USD (×10) |
|---|---|---|---|
| starter | 50 | 9 | 90 |
| pro | 175 | 25 | 250 |
| pro | 350 | 50 | 500 |
| pro | 700 | 100 | 1000 |
| pro | 1400 | 200 | 2000 |
| pro | 2100 | 294 | 2940 |
| pro | 3500 | 480 | 4800 |
| pro | 5250 | 705 | 7050 |
| pro | 7000 | 920 | 9200 |
| pro | 8750 | 1125 | 11250 |
| business | 175 | 50 | 500 |
| business | 350 | 100 | 1000 |
| business | 700 | 200 | 2000 |
| business | 1400 | 400 | 4000 |
| business | 2100 | 588 | 5880 |
| business | 3500 | 960 | 9600 |
| business | 5250 | 1410 | 14100 |
| business | 7000 | 1840 | 18400 |
| business | 8750 | 2250 | 22500 |

The Pro volume-discount badges stay identical to today (0 / 0 / 0 / 0 / 2 / 4 /
6 / 8 / 10 %). Credits and the base rate both scaled by 0.7, so the ratio is
unchanged. Implement the savings computation so this holds (per-plan base
rate, or savings relative to the plan's first tier — implementer's choice, but
`tierSavingsPercent` must return the same percentages for Pro as before and
0 % for Starter).

### Legacy tiers (parse-only, never purchasable)

`[250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500]` for `pro` and
`business`. Existing Stripe subscriptions carry lookup keys such as
`pro_250_month` and `business_1000_year`. These keys MUST keep parsing
(`parsePriceLookupKey`), MUST keep validating in `subscriptionSchema.tierCredits`
and `pendingTierCredits`, and MUST keep working in refill / renewal / MRR /
churn / affiliate code paths for up to 12 months (yearly subscribers). They
MUST NOT appear in the public plans catalog, in checkout validation, in the
Stripe seed script, or in the plan picker.

Model this explicitly in `packages/contracts/src/v1/billing.ts`: an active
per-plan tier table plus a legacy tier list, with helpers such as
`purchasableTiersFor(plan)`, `isPurchasableTier(plan, tier)`,
`isKnownTier(tier)`, and `priceUsdFor` that also resolves legacy tiers (their
prices are the current Pro / Business tables: legacy 250 = $25 Pro / $50
Business, etc. — copy today's tables verbatim as the legacy price table).

### Top-up packs (disabled, re-priced)

| Pack id | Credits | USD |
|---|---|---|
| topup_175 | 175 | 25 |
| topup_700 | 700 | 100 |
| topup_1750 | 1750 | 250 |

If pack ids are persisted anywhere (receipts, ledger metadata, product events),
keep the old ids `topup_250 / topup_1000 / topup_2500` parseable for history
and exclude them from the purchasable list.

## 3. Signup grant

- `SIGNUP_GRANT_CREDITS = 7` (`packages/contracts/src/v1/credits.ts`).
- `DEFAULT_PRODUCT_SETTINGS.signupGrantCredits = 700` (centi-credits).
- `product_settings.signup_grant_credits` default 700; migration also runs
  `UPDATE ... SET signup_grant_credits = 700 WHERE signup_grant_credits = 5000`
  (precedent: `0026_signup-grant-50.sql`).
- The admin API keeps whole credits (`z.int().positive()`); 7 is whole, no
  schema relaxation needed.
- `publicSettingsSchema` gains `signupGrantCredits` (whole credits) so the
  landing free card can print the number (D10). Convert at the same
  presentation boundary as the admin controller.
- Lifecycle thresholds scale proportionally, event names unchanged (Resend
  automations key on the names): `credits_25_used` fires at 50 % and
  `credits_40_used` at 80 % of the grant snapshotted in
  `signup_grant_outbox.credits` for that user, falling back to the current
  product setting when no row exists. This is 900 / 1440 cc for an 1800 cc grant, 350 / 560 cc for a 700 cc grant
  and 2500 / 4000 cc for a legacy 5000 cc grant.
- Historical migration `0026_signup-grant-50.sql` remains byte-for-byte
  immutable. It predates the centi-credit storage conversion; migration 0038
  later multiplied the stored grant values by 100.
- Admin analytics: `HEALTHY_TRIAL_MIN_CREDITS` 20 → 3. Consumption buckets
  re-cut for an 18-credit grant: `["0", "1-4", "5-9", "10-17", "18+"]` (floor of
  credits used). Update the contract enum, the SQL/metrics bucketer, and the
  admin label map together.
- The Resend welcome template still says 50 — out of code scope; the dispatcher
  SHOULD now send the real count (`FREE_CREDITS`) in the payload so the
  template fallback is never used.

## 4. Existing subscribers (D7)

Add `apps/server/scripts/migrate-subscriptions-v6.ts` (dry-run by default,
`--apply` to write):

- Monthly `active` / `trialing` subscriptions on a legacy tier: update the
  Stripe subscription item to the price with lookup key
  `${plan}_${legacy × 0.7}_month` with `proration_behavior: "none"` (same
  amount, so nothing to prorate), then update the local `subscriptions` row
  (`tier_credits`, `price_lookup_key`). The current period's credits are
  already granted and stay. The next refill uses the new tier.
- Yearly subscriptions: do not touch the Stripe price now. Use the existing
  renewal-change mechanism (`pendingTierCredits` and the code paths in
  `billing.service.ts` around lines 497 / 674 / 745 and the lifecycle /
  refill services) so the tier switches at `current_period_end`. Inspect how
  a pending tier is applied at renewal today and reuse it exactly. Their
  pre-minted yearly refill slots keep the legacy credits (they paid for them).
- Print a table of every subscription touched (id, owner type, plan, old tier,
  new tier, interval, effective date).
- Idempotent: re-running after `--apply` changes nothing.

## 5. Change map (from the exploration report)

### Contracts and DB
- `packages/contracts/src/v1/billing.ts` — plan ids, per-plan tiers, legacy
  tiers, prices, top-ups, helpers, schemas (`creditTierSchema` must accept
  active + legacy; `createBillingCheckoutBodySchema` must reject legacy and
  cross-plan tiers via a refine or a server check).
- `packages/contracts/src/v1/credits.ts` — `SIGNUP_GRANT_CREDITS`.
- `packages/contracts/src/v1/admin.ts:144` — `adminUserPlans` + starter.
- `packages/contracts/src/v1/admin-analytics.ts:204-210, 685-691` — plans list,
  consumption buckets.
- `packages/contracts/src/v1/settings.ts` — public `signupGrantCredits`.
- `packages/db/src/schema/billing.ts:18, 110` — enum value, grant default.
- Two migrations, two files, generated with drizzle-kit in this order:
  1. 0065 contains only
     `ALTER TYPE "public"."billing_plan" ADD VALUE IF NOT EXISTS 'starter';`.
  2. Grant default 700 + the UPDATE above.
  PostgreSQL 12+ allows both files to run in the same migration transaction
  because the second migration never references the newly added enum value.

### Server (`apps/server`)
- `modules/billing/application/services/billing.service.ts:135-171` — scope
  rule becomes a set test (personal: starter | pro; org: business); plans
  endpoint uses per-plan purchasable tiers; checkout rejects legacy tiers.
- `.../manual-subscription-requests.service.ts:175`,
  `.../manual-subscriptions.service.ts:987` — same scope rewrite (offline
  cash payments for Starter are allowed by the rule but the admin dialog gets
  a plan selector — see admin).
- `scripts/seed-stripe.ts` — iterate per-plan purchasable tiers; never legacy.
- `modules/admin/infrastructure/persistence/admin-analytics.repository.ts:2673,
  2697-2699, 4935-4955` — plan rank and churn plan expressions.
- `modules/lifecycle-events/domain/lifecycle-event.ts:57-60` — thresholds.
- `modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository.ts:37,60`,
  `modules/email/templates/auth-email-templates.ts:23,122` — widen unions,
  plan-name map instead of ternary.
- `modules/settings/domain/product-settings.constants.ts:16` — 700.
- `modules/admin/application/services/admin-analytics.metrics.ts:53,141-152`.
- `modules/lifecycle-events/application/services/lifecycle-events-dispatcher.service.ts:151-178`
  — send `FREE_CREDITS`.
- `packages/env/src/server.ts:115-117` — comment only.
- Specs: `billing-catalog.spec.ts`, `admin-analytics.metrics.spec.ts:723,749`,
  `admin-analytics.repository.spec.ts:1418-1426`, `credits.service.spec.ts:1279-1292`,
  `product-settings.service.spec.ts:126-147`, `settings-contracts.spec.ts`,
  `manual-subscriptions.service.spec.ts`, `manual-subscription-requests.service.spec.ts`,
  `lifecycle-events.service.spec.ts`, `metering.service.spec.ts` (thresholds).

### Web (`apps/web`) and dictionaries (`packages/internationalization`)
- `features/billing/components/plan-picker-dialog.tsx:198,570,607-611,1117` —
  personal scope shows Starter and Pro cards side by side (Business teaser
  unchanged); plan-id → copy map; tier fallback is the plan's first tier.
- `features/billing/components/plan-card.tsx` — headline "N credits / month"
  line (D11); single-tier plans render no tier select; parse tiers against the
  plan's purchasable list.
- `features/billing/pages/billing-page.tsx:508-510,659-661`,
  `features/billing/components/manual-payment-request-panel.tsx:229-233,753`,
  `features/billing/components/upgrade-button.tsx:77-79`,
  `features/billing/pages/billing-success-page.tsx:177-182` — plan-name map.
- `features/billing/lib/plan-pricing.ts` — savings per plan; fix the stale
  comment; `formatUsd` must not round $7.50-style values (all v6 prices are
  whole dollars, but keep the landing and picker formatters consistent).
- `features/landing/components/pricing.tsx` — four cards: Free, Starter, Pro,
  Business (Business stays a showcase gated as today); free card prints the
  grant count from public settings when `signupGrantEnabled`.
- Dictionaries en / fr / ar (`billing.json`, `landing.json`, `credits.json`,
  `legal.json`): add `starter*` keys; make `chooseTitle`, `noSubscriptionBody`,
  landing `title`, `meta.description` plan-neutral; remove every per-credit
  dollar sentence (D9). Replacement copy (English; translate fr / ar with the
  same meaning):
  - landing `credits.body` (was "You pay the measured AI cost of each action,
    at $0.04 per credit. No markup, no surprise bills."): "Every AI action uses
    credits. Your balance shows what each run used. No surprise bills."
  - landing FAQ credits answer (was "Credits are Wandit's single currency: 1
    credit = $0.04 of AI provider cost. ..."): "Credits are Wandit's single
    currency. Every page build, image, video or chat edit uses credits. A short
    chat edit uses a fraction of a credit. A long page build uses more. Your
    balance shows what each run used."
  - landing `pricing.title` (was "One plan. Pick your pace."): "Start small.
    Grow when you need more."
  - landing `pricing.meta.description`: "Start free, go Starter for $9, or
    Pro when you need more credits. Monthly or yearly."
  - landing `pricing.free.creditsLine` when the grant is on: "{count} free
    credits" (plural-aware); keep "Signup credits when available" as the
    fallback when the grant is off.
  - Starter copy: name "Starter"; tagline "For your first store and first
    campaigns"; features (amended 2026-09-04, no video for Starter): ["AI store pages
    built in minutes", "AI product images and marketing copy", "Custom domain
    included", "Leads CRM for your orders", "Publishing always free, cancel anytime"]. Business
    "Everything in Pro" and Pro "Nine credit tiers as your workload grows"
    stay true and stay.
  - `legal.json` "a starter balance of free credits" → "an initial balance of
    free credits" (the word now collides with the plan name).
  - `Dictionary = WidenDictionary<typeof en>`: fr and ar must carry every key
    en carries or check-types fails.
- Specs: `plan-pricing.spec.ts`, `billing.services.spec.ts`, and any spec that
  pins tier lists or plan names.

### Admin (`apps/admin`)
- `features/users/lib/constants.ts:62-66` — `{ label: "Starter", value: "starter" }`.
- `features/users/components/table/user-table-cells.tsx:62` — plan class map.
- `features/analytics/components/margin-after-ai-card.tsx:55-71,171`,
  `mrr-breakdown-card.tsx:35,48-93,123-126` — starter segment.
- `features/analytics/lib/analytics-data.ts:107-114` — bucket labels.
- `features/analytics/components/funnel-step-visualization.tsx:49` — copy.
- `features/offline-billing/lib/receipt.ts:58-75`, `offline-receipt.tsx:274,557`,
  `grant-manual-subscription-dialog.tsx:85,91,288-320` (plan selector,
  tiers per plan), `renew-manual-subscription-dialog.tsx` (plan-aware).
- `features/settings/components/product-controls-card.tsx` — no validation
  change (7 is whole); update helper text if it mentions 50.
- Specs: `margin-after-ai-card.spec.ts:46`, `settings.dto.spec.ts`, users
  specs that enumerate plans.

### Docs
- This file (ADR). `billing.md` §catalog and §grant, `billing-v2-…md` money
  table, `teams-workspaces.md:395,417-429` pairing rule, `manual-billing.md`,
  `lifecycle-emails.md` plan list and thresholds. Add a supersede banner to
  `pricing-v5-usd-anchor.md` §1 for the grant sentence only.

## 6. Deploy order

1. Update the Resend welcome template and W15 / W16 threshold copy first.
2. Run `pnpm db:migrate`; this applies 0065 and 0066 together. This is safe on
   PostgreSQL 12+ because 0066 never references `starter`, so the enum value is
   not used inside the transaction that adds it.
3. Restart every server instance or wait more than 30 seconds for the
   product-settings cache before relying on the 18-credit grant.
4. Deploy contracts + server + web + admin + Trigger.dev (one release).
5. `pnpm --filter server stripe:seed` in test mode; verify the 38 new subscription prices
   (`starter` 2, `pro` 18, `business` 18) and 3 re-priced top-ups; then live.
   Old prices stay active in Stripe for legacy subscribers — do not archive.
6. Run `pnpm --filter server billing:migrate-v6` (dry-run, then `--apply`),
   resolve every failed row, and retain the output table.
7. Send the subscriber notice (copy drafted separately; founder sends).

## 7. Out of scope

- Any change to `AI_USD_PER_CREDIT`, metering, reserve floors or overdraft
  admission.
- A per-plan kill switch (use `paidSubscriptionsEnabled` + deploy order).
- Native app: it deep-links to `/billing` and reads the API; no change.

# Pricing v7 — 1 credit = $0.032 of AI, the 250-credit Pro ladder returns

Decision date: 2026-09-04 (founder + co-founder). Supersedes the credit unit of
`pricing-v5-usd-anchor.md` §1, the catalog of `pricing-v6-starter-plan.md` §2
and the grant of `pricing-v6-starter-plan.md` §3 (all stay as history).

## 1. Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Credit unit | **1 credit = $0.032 of AI-provider cost.** `AI_USD_PER_CREDIT` default 0.032; `DEFAULT_USD_MICROS_PER_CREDIT` 32_000. Was $0.04. |
| D2 | Pro | The pre-v6 ladder returns: 250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500 credits at the unchanged prices $25, $50, $100, $200, $294, $480, $705, $920, $1125. $25 buys $8.00 of AI. |
| D3 | Business | Same tiers as Pro at exactly 2× the Pro price. Org workspaces only. |
| D4 | Starter | $9 / month, $90 / year, **60 credits** ($1.92 of AI). Personal workspaces only. |
| D5 | Free signup grant | **20 credits = 2000 centi-credits = $0.64 of AI.** Was 18 / 1800. |
| D6 | Top-ups | Back to 250 / 1000 / 2500 credits at $25 / $100 / $250 (ids `topup_250`, `topup_1000`, `topup_2500`). Still disabled. The v6 ids `topup_175` / `topup_700` / `topup_1750` become persisted-only. |
| D7 | Existing subscribers (36, all monthly Stripe) | Move back to the tier with the same price: 175 → 250, 350 → 500. Same price, no proration, effective at the next renewal (first one 2026-09-11). Nobody has renewed on a v6 tier yet. |
| D8 | Existing balances | Untouched. A credit simply buys 20 % less AI from the flip onward; in-flight runs keep their stamped rate (pricing v5 snapshot mechanism). |
| D9 | Per-credit dollar values | Still never shown to users. |
| D10 | Copy | No user-facing text states the old numbers except the Starter headline ("60 credits every month" comes from the catalog) and the French offline receipt line. |

## 2. Catalog (authoritative)

### Purchasable tiers

| Plan | Tier credits | Monthly USD | Yearly USD (×10) |
|---|---|---|---|
| starter | 60 | 9 | 90 |
| pro | 250 | 25 | 250 |
| pro | 500 | 50 | 500 |
| pro | 1000 | 100 | 1000 |
| pro | 2000 | 200 | 2000 |
| pro | 3000 | 294 | 2940 |
| pro | 5000 | 480 | 4800 |
| pro | 7500 | 705 | 7050 |
| pro | 10000 | 920 | 9200 |
| pro | 12500 | 1125 | 11250 |
| business | same nine tiers | 2× Pro | 2× Pro yearly |

`basePer100Usd`: starter 15, pro 10, business 20. Savings badges for Pro return
to the pre-v6 values (0 / 0 / 0 / 0 / 2 / 4 / 6 / 8 / 10 %), starter 0 %.

### Legacy tiers (parse-only, never purchasable)

The v6 tiers become legacy: starter 50; pro and business 175, 350, 700, 1400,
2100, 3500, 5250, 7000, 8750 (prices: the v6 tables — 175 = $25 / $50 etc.).
`CREDIT_TIERS` stays the sorted union of purchasable ∪ legacy. `creditTierSchema`,
`subscriptionSchema`, `parsePriceLookupKey`, refill, MRR, churn and affiliate
paths keep accepting them exactly as v6 did for the old ladder.

### Legacy → purchasable mapping

Replace the hard-coded `V6_TIER_BY_LEGACY` table and `v6TierForLegacy()` with a
**price-based** helper, e.g. `purchasableTierForLegacy(plan, legacyTier)`: the
purchasable tier of the same plan whose monthly price equals the legacy tier's
monthly price (175 → 250, 350 → 500, …, starter 50 → 60). It must return null
when no purchasable tier has that price. Use it in the migration script and in
`billing.service.ts` resume(). Keep the export name `v6TierForLegacy` as a
deprecated alias only if removing it is disproportionate; prefer removal.

## 3. The anchor flip

- `packages/env/src/server.ts`: `AI_USD_PER_CREDIT` default `0.032`, comment
  rewritten (v7 anchor; the 20-credit grant carries $0.64).
- `apps/server/src/modules/metering/domain/model-pricing.ts`:
  `DEFAULT_USD_MICROS_PER_CREDIT = 32_000`.
- `apps/server/src/modules/metering/application/services/model-pricing.service.ts`:
  the literal fallback `0.04` → `0.032`.
- Reserve floors in `operation-registry.ts` stay as they are (they are credit
  amounts; their USD coverage drops 20 %, accepted). Update the comments that
  say "at $0.04/credit" to "$0.032/credit" where they describe the derivation.
- Snapshot preservation (`pricing_snapshot.usdMicrosPerCredit`) is unchanged;
  verify `model-pricing.spec.ts` (default anchor) and the anchor-migration test in
  `metering.service.spec.ts` encode 32_000 / 40_000 correctly.

## 4. Signup grant

- `SIGNUP_GRANT_CREDITS = 20`; `DEFAULT_PRODUCT_SETTINGS.signupGrantCredits = 2000`;
  DB default 2000; migration `0068_signup-grant-20`: `SET DEFAULT 2000` then
  `UPDATE ... SET 2000 WHERE signup_grant_credits = 1800` (precedent 0067).
- Lifecycle thresholds stay per-user (50 % / 80 % of the user's own grant); the
  fallback follows `SIGNUP_GRANT_CREDITS`.
- Admin analytics: `HEALTHY_TRIAL_MIN_CREDITS` 7 → 8; consumption buckets
  `["0", "1-4", "5-9", "10-19", "20+"]`; admin label map and the "7+ credits"
  healthy-trial copy → "8+ credits".
- Resend welcome fallback → 20 (out of code scope; done by the founder's agent).

## 5. Existing subscribers

`apps/server/scripts/migrate-subscriptions-v6.ts` (rename to
`migrate-subscriptions.ts` with the package script `billing:migrate-tiers`, or
keep the file and make it generic — implementer's choice, document it):
candidates are active/trialing subscriptions whose `tier_credits` is a legacy
tier; target = `purchasableTierForLegacy(plan, tier)`; everything else (dry run,
`--apply`, monthly price switch without proration, yearly pending mechanism,
manual provider branch, owner lock + re-read, table, idempotency, exit code)
stays exactly as reviewed. Specs cover 175 → 250, 350 → 500 and starter 50 → 60.

## 6. Change map

- Contracts: `billing.ts` (tiers, legacy, prices, base rates, top-ups, mapping
  helper), `credits.ts`, `admin-analytics.ts` (buckets).
- Env + metering: the three anchor sites in §3 and their specs.
- Server: settings constants, analytics metrics + repository (bucket edges,
  healthy threshold), affiliate repository threshold (8 × 100), lifecycle
  repository fallback (follows the constant), migration script + spec, seed
  script (unchanged logic; it will create `starter_60_*` and find the rest),
  billing.service.ts resume() mapping, every server spec that pins 175 / 350 /
  50 as purchasable, 7 / 700 / 18 / 1800 as the grant, 3 / 7 as healthy trial,
  the v6 buckets, `MRR_PRICE_MAP` size (purchasable 19 tiers × 2 = 38 plus
  legacy 10 tiers × 2 = 20 → 58 keys unless the implementation keeps more) and
  the 74-price count.
- Web: `plan-pricing.spec.ts` ladder, picker / landing / manual-payment specs
  (fixtures on 175 → 250, starter 50 → 60, free 18 → 20), `format-credits`
  untouched.
- Admin: `receipt.ts` starter line "60 crédits chaque mois", receipt specs,
  `user-detail-helpers.spec.ts` ("60 credits/mo · $90/yr"), analytics labels and
  specs, settings dto spec fixtures (20).
- DB: schema default 2000, migration 0068, journal + snapshot generated by
  drizzle-kit.
- Docs: this ADR; `billing.md` catalog table, grant sentence, runbook (0068, the
  env flip, the subscriber move-back); `pricing-v6-starter-plan.md` and
  `pricing-v5-usd-anchor.md` get a supersede banner; `credits.md` grant line;
  `lifecycle-emails.md` example thresholds (1000 / 1600 cc for a 2000 cc grant);
  rewrite `pricing-v6-subscriber-notice.md` into a v7 notice: the subscriber
  keeps their credit count (250 stays 250), a credit now covers a little less AI
  work (a typical page build uses about 12 credits instead of 10), Starter is
  new at $9. English, French, Arabic. DRAFT, founder sends.

## 7. Release order

1. Merge + deploy (code default 0.032 flips the anchor at boot; migration 0068
   lifts the grant to 2000).
2. `pnpm -F server stripe:seed` in test mode, then live: creates
   `starter_60_month` / `starter_60_year`, finds every other price.
3. `billing:migrate-…` dry run, then `--apply`: 36 rows move 175 → 250 and
   350 → 500 at the same price.
4. Resend welcome fallback 20.
5. Send the v7 notice.

## 8. Out of scope

Reserve-floor rescaling, a per-plan kill switch, native app changes.

# Pricing v3 implementation — 250-credit base unit at $25

Decision date: 2026-08-09. Source: co-founder pricing decision ("$25, we give
them $7 of AI usage"). Supersedes `pricing-v2-implementation.md` (which never
reached production subscribers). This file is the authoritative record of the
numbers, what changed, and the rollout steps.

## 1. The money model

| Constant | v2 | v3 | Where it lives |
|---|---:|---:|---|
| Base pack | 200 cr / $30 | **250 cr / $25** | `BILLING_CATALOG` (`packages/contracts/src/v1/billing.ts`) |
| Retail price per credit | $0.15 | **$0.10 exactly** | Derived: $25 / 250 |
| AI-provider value per credit | $0.04 | **$0.028** | `AI_USD_PER_CREDIT` env default (`packages/env/src/server.ts`) |
| Default micros per credit | 40_000 | **28_000** | `DEFAULT_USD_MICROS_PER_CREDIT` (`metering/domain/model-pricing.ts`) |
| AI value bundled in a Pro month | $8 | **$7** | 250 × $0.028 |
| Gross markup on AI spend | 3.75× (73.3%) | **~3.57× (72%)** | $0.10 sell vs $0.028 cost |
| Free signup grant | 50 credits | **50 credits (unchanged)** | $5 face value, $1.40 AI value. No DB migration needed. |

Debit formula unchanged: `max(1, ceil(costUsdMicros / usdMicrosPerCredit))`,
settled on actual provider-reported cost (OpenRouter or Vercel AI Gateway).
Generations are never killed mid-run; overage past the $7 allowance is accepted
by design. In-flight reservations keep their admission-time rate via the stored
pricing snapshot, so the v2→v3 rate change cannot corrupt a running settle.

Reading the ledger: 1 credit = the customer consumed $0.10 of prepaid value and
cost us at most $0.028 of AI spend (usually much less — the round-up remainder
is margin).

## 2. Plan catalog (`packages/contracts/src/v1/billing.ts`)

Base unit **250 credits**: Pro $25/mo, Business $50/mo (exactly 2× Pro, pooled
workspace allowance — same credits, the price difference buys the org features,
Lovable-style). Doubling ladder, volume-discount curve kept (2/4/6/8/10% off
linear on the top five tiers). Yearly = 10× monthly (two months free).

| Credits / month | Pro monthly | Pro yearly | Business monthly | Discount |
|---:|---:|---:|---:|---:|
| 250 | $25 | $250 | $50 | 0% |
| 500 | $50 | $500 | $100 | 0% |
| 1,000 | $100 | $1,000 | $200 | 0% |
| 2,000 | $200 | $2,000 | $400 | 0% |
| 3,000 | $294 | $2,940 | $588 | 2% |
| 5,000 | $480 | $4,800 | $960 | 4% |
| 7,500 | $705 | $7,050 | $1,410 | 6% |
| 10,000 | $920 | $9,200 | $1,840 | 8% |
| 12,500 | $1,125 | $11,250 | $2,250 | 10% |

Top-up packs (retail rate $0.10/credit, no volume discount, never expire):
`topup_250` = 250/$25 · `topup_1000` = 1,000/$100 · `topup_2500` = 2,500/$250.

## 3. Reserve floors (unchanged, re-based)

Product floors stay in credits (`metering/domain/operation-registry.ts` +
`CREDIT_COSTS` in contracts): chat 1, page build 10, image 5, video 25,
marketing 5. At $0.028/credit these hold $0.028 / $0.28 / $0.14 / $0.70 /
$0.14 of AI value. At $0.10 retail they read as 10¢ / $1 / 50¢ / $2.50 / 50¢ —
every price tag is now a round dime multiple.

## 4. Every file changed

| File | Change |
|---|---|
| `packages/contracts/src/v1/billing.ts` | Tiers 250…12,500, new price tables, top-ups, basePer100Usd 10/20 |
| `packages/contracts/src/v1/credits.ts` | `SIGNUP_GRANT_CREDITS` comment only (stays 50) |
| `packages/env/src/server.ts` | `AI_USD_PER_CREDIT` default 0.04 → 0.028 |
| `apps/server/.../metering/domain/model-pricing.ts` | `DEFAULT_USD_MICROS_PER_CREDIT` 40_000 → 28_000 |
| `apps/server/.../metering/.../model-pricing.service.ts` | env fallback 0.04 → 0.028 |
| `apps/server/.../settings/domain/product-settings.constants.ts` | comment only (stays 50) |
| `apps/web/.../billing/lib/plan-pricing.ts` | `DEFAULT_BASE_PER_100_USD` 15 → 10 |
| `apps/web/.../billing/components/plan-picker-dialog.tsx` | tier fallback 200 → 250 |
| `apps/web/.../workspaces/components/create-workspace-dialog.tsx` | tier fallbacks 200 → 250 |
| 9 spec files (server + web) | Tiers ×1.25, money to the v3 curve, all suites green |

No DB migration: the signup grant count is unchanged at 50.

Test state: server 2,314/2,314 · web 423/423 · server tsc clean. (Web tsc has
two pre-existing route-tree errors from the dashboard PR — stale
`routeTree.gen.ts`, regenerates on next dev/build run; unrelated to pricing.)

## 5. Rollout checklist

1. Merge to dev → staging → prod as usual. No migration step.
2. Railway (staging + prod): `AI_USD_PER_CREDIT` must be UNSET (code default
   0.028) — delete any explicit 0.04/0.05 override.
3. Re-run the Stripe seed per mode (test key for staging, live key in Zack's
   own terminal for prod). Collisions (`*_10000_*`, `topup_1000`) are replaced
   by lookup key; v2 keys (`pro_200_*` …) become harmless orphans in test mode.
4. Test-mode subscriptions on v2 lookup keys are skipped by sync as foreign —
   acceptable pre-launch; production has zero subscribers.
5. Billing stays dark behind `paidSubscriptionsEnabled` until the owner flips
   it per environment.

## 6. Standing follow-ups (carried from v2, still open)

- Workspace dialog shows `$N/mo` even when Yearly is selected (pre-existing).
- Landing free-plan card can't display "50 credits" dynamically
  (`signupGrantCredits` not in the public settings contract — deliberate).
- "2 months free" / "nine tiers" landing copy are manual sync points.

# Pricing v2 implementation — 200-credit base unit

> **SUPERSEDED 2026-08-09 by `pricing-v3-implementation.md`** (250-credit base
> unit at $25, $0.028/credit AI value). v2 never reached production
> subscribers. Kept for the audit results in §6, which still apply.

Decision date: 2026-08-07. Source: co-founder pricing feedback. This file is the
authoritative record of what changed, the exact numbers, and what must happen at
rollout. All code changes listed here are uncommitted on `dev` pending review.

## 1. The money model

| Constant | Old | New | Where it lives |
|---|---:|---:|---|
| AI-provider value per credit | $0.05 | **$0.04** | `AI_USD_PER_CREDIT` env default (`packages/env/src/server.ts`) |
| Default micros per credit | 50_000 | **40_000** | `DEFAULT_USD_MICROS_PER_CREDIT` (`metering/domain/model-pricing.ts`) |
| Retail price per credit (base tier) | $0.25 | **$0.15** | Derived: $30 / 200 credits |
| AI value bundled in a Pro month | $5 (100 cr) | **$8 (200 cr)** | 200 × $0.04 |
| Gross markup on AI spend | 5× (80%) | **3.75× (73.3%)** | $0.15 sell vs $0.04 cost |
| Free signup grant | 20 credits ($1) | **50 credits ($2)** | See §4 — three synchronized places |

Debit formula unchanged: `max(1, ceil(costUsdMicros / usdMicrosPerCredit))`,
settled on actual provider-reported cost (OpenRouter or Vercel AI Gateway).
Generations are never killed mid-run when the reserve is exceeded; the settle
simply charges the real cost. Cents-level overage past the $8 allowance is
accepted by design.

## 2. Plan catalog (`packages/contracts/src/v1/billing.ts`)

Base unit is now **200 credits**: Pro $30/mo, Business $60/mo (exactly 2× Pro,
pooled workspace allowance). Tiers double Lovable-style up to 10,000 credits,
keeping the previous volume-discount curve (2/4/6/8/10% off linear on the top
five tiers). Yearly = 10× monthly (two months free) — unchanged.

| Credits / month | Pro monthly | Pro yearly | Business monthly | Discount |
|---:|---:|---:|---:|---:|
| 200 | $30 | $300 | $60 | 0% |
| 400 | $60 | $600 | $120 | 0% |
| 800 | $120 | $1,200 | $240 | 0% |
| 1,600 | $240 | $2,400 | $480 | 0% |
| 2,400 | $353 | $3,530 | $706 | 2% |
| 4,000 | $576 | $5,760 | $1,152 | 4% |
| 6,000 | $846 | $8,460 | $1,692 | 6% |
| 8,000 | $1,104 | $11,040 | $2,208 | 8% |
| 10,000 | $1,350 | $13,500 | $2,700 | 10% |

Top-up packs (retail rate, no volume discount, never expire):
`topup_200` = 200/$30 · `topup_1000` = 1,000/$150 · `topup_2000` = 2,000/$300.

Open product choice, flagged not blocking: the discount curve above mirrors the
old catalog. If pure doubling with no discounts is preferred, only the five
discounted rows in `BILLING_CATALOG` change + seed re-run.

## 3. Reserve floors (unchanged, re-based)

Product floors stay in credits (`metering/domain/operation-registry.ts` +
`CREDIT_COSTS` in contracts): chat 1, page build 10, image 5, video 25,
marketing 5. At $0.04/credit these now hold $0.04 / $0.40 / $0.20 / $1.00 /
$0.20 of AI value respectively. Fixed-price ops (image/video) still charge the
fixed credit amount regardless of provider cost.

## 4. Free signup grant — three synchronized places

The audit found the contract constant alone does NOT control production grants.
All three now say 50:

| Place | File |
|---|---|
| Contract constant (fallback/display) | `packages/contracts/src/v1/credits.ts` `SIGNUP_GRANT_CREDITS` |
| Server settings default | `apps/server/src/modules/settings/domain/product-settings.constants.ts` |
| DB column default + live row | `packages/db/src/schema/billing.ts` + migration `0026_signup-grant-50.sql` |

Migration 0026 also runs `UPDATE product_settings SET signup_grant_credits = 50
WHERE signup_grant_credits = 20` so the existing settings row moves off the old
default while a deliberately customized value would be preserved. Already
pending outbox rows snapshotted at 20 stay 20 (immutable snapshots, accepted).

## 5. Every file changed

| File | Change |
|---|---|
| `packages/contracts/src/v1/billing.ts` | New tiers, prices, top-up packs, basePer100Usd 15/30 |
| `packages/contracts/src/v1/credits.ts` | `SIGNUP_GRANT_CREDITS` 20 → 50 |
| `packages/env/src/server.ts` | `AI_USD_PER_CREDIT` default 0.05 → 0.04 |
| `apps/server/.../metering/domain/model-pricing.ts` | `DEFAULT_USD_MICROS_PER_CREDIT` 50_000 → 40_000 |
| `apps/server/.../metering/.../model-pricing.service.ts` | env fallback 0.05 → 0.04 |
| `apps/server/.../settings/domain/product-settings.constants.ts` | settings default 20 → 50 |
| `packages/db/src/schema/billing.ts` + migration `0026` | column default 20 → 50 + data update |
| `apps/web/.../billing/lib/plan-pricing.ts` | Savings baseline $0.25 → per-plan `basePer100Usd` (fixes Business badges) |
| `apps/web/.../billing/components/plan-picker-dialog.tsx` | Pass plan baseline to savings; tier fallback 100 → 200 |
| `apps/web/.../workspaces/components/create-workspace-dialog.tsx` | Tier fallbacks 100 → 200 (3 spots) |
| `docs/features/billing.md`, `docs/features/billing-v2-…md` | Economics updated |
| 11 spec files (server + web) | Fixtures doubled, prices ×1.2, all suites green |

Test state: server 2,225/2,225 · web 411/411 · tsc clean both apps.

## 6. Audit results (4 read-only probes, gpt-5.6-sol)

| Chain | Verdict |
|---|---|
| Subscription → credit grants | Sound. Tier N grants exactly N credits per period, idempotent at 4 layers (outbox PK, trigger key, ledger key `inv:{id}:grant`, unique index). Renewals use one-allotment rollover cap; yearly = 12 monthly refill slots; upgrades grant the delta immediately; same-interval downgrades defer to renewal. |
| Usage settle (OpenRouter + Vercel Gateway) | Sound. Every conversion goes through the env rate or the reservation's stored pricing snapshot; no hardcoded rates left. In-flight operations keep their admission-time rate; reconciliation sweeps use the same source. |
| Free users / gating | Sound. Generation gates on credits only, not subscription. `past_due` keeps remaining credits usable, blocks new subscription checkout. Zero-credit users get the billing modal. |
| UI surfaces | All pricing renders from the `/billing/plans` API (catalog-driven) — landing page, plan picker, top-ups, workspace dialog. No hardcoded dollar amounts in components or dictionaries. |

## 7. Rollout checklist (production)

1. Deploy → run `pnpm db:migrate` (applies 0026, lifts the settings row to 50).
2. Check Railway (staging + prod): if `AI_USD_PER_CREDIT` is set explicitly, change it to `0.04` or delete it (code default is now 0.04). An old `0.05` override would silently under-grant value.
3. Re-run the Stripe seed against the LIVE key (in Zack's own terminal): creates all new prices (`pro_200_month` … `business_10000_year`, new top-ups). Old-tier prices in TEST Stripe become orphans — harmless.
4. Any staging/test subscriptions on old lookup keys (`pro_100_*`) will be skipped by sync as foreign — acceptable pre-launch; production has zero subscribers.
5. Billing stays dark behind `paidSubscriptionsEnabled` until the owner flips it.

## 8. Known follow-ups (not blocking)

- Workspace dialog shows `$N/mo` even when Yearly is selected, and hardcodes `$`/`/mo` formatting (pre-existing).
- Landing free-plan card can't display "50 credits" dynamically — `signupGrantCredits` is not in the public settings contract (deliberate; expose it if marketing wants the number shown).
- "2 months free" and "nine tiers" landing copy are manual sync points if the multiplier or tier count ever changes.

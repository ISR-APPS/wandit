# Pricing v4 — fractional credits (centi-credit ledger)

> **PARTIALLY SUPERSEDED.** The centi-credit ledger remains authoritative. Pricing v5
> (`pricing-v5-usd-anchor.md`) replaced the AI-provider-cost anchor, and
> `pricing-v6-starter-plan.md` replaced the plan catalog, top-ups, and signup grant. All old
> monetary and catalog figures below are retained only as historical context.

Decision date: 2026-08-16. Source: co-founder decision in chat ("go please"), after
the credit-drain audit. Supersedes the debit formula of
`pricing-v3-implementation.md`; at the time, the other v3 numbers (plan catalog, $0.10 retail,
$0.028 AI value per credit) were retained.

## 1. Why

The v3 debit formula `max(1, ceil(costUsdMicros / 28_000))` charges 1 whole credit
for any message, even one that costs $0.0001. Measured on production (30 days):
users paid 12,329 credits for 8,485 credits of real value — 31% overhead. This is
the "credits drain fast" complaint. v4 charges real cost in 0.01-credit steps,
Lovable-style (balance 3.0 → 2.9 → 2.87).

## 2. The money model

| Constant | v3 | v4 |
|---|---:|---:|
| Internal ledger unit | 1 credit | **1 centi-credit (cc) = 0.01 credit** |
| AI value per credit | $0.028 | **$0.028 (unchanged)** |
| AI value per cc | — | $0.00028 (280 USD micros) |
| Retail per cc | — | $0.001 |
| Token debit formula | `max(1, ceil(micros / 28_000))` credits | **`max(1, ceil(micros / 280))` cc** |
| Smallest possible charge | 1.00 credit | **0.01 credit** |
| AI value bundled in a Pro month | $7 | **$7 (unchanged)** |

The round-up is still UP, so 250 credits can never buy more than $7 of AI usage.
Overage from generations that finish after the balance hits zero stays accepted
(never kill mid-run), same as v3.

## 3. Fixed prices (in credits; stored as cc = ×100)

| Operation | v3 | v4 | Rationale |
|---|---:|---:|---|
| image (per image) | 5 | **3.00** | real median cost ~2 credits; 5 was a 5.4× retail markup |
| video (per operation) | 25 | **20.00** | real ~13; brings markup near the 3.6× design line |
| marketing (per asset) | 5 | **7.00** | real ~6.2 — v3 LOST money on every asset |
| connector (per call) | 5 | **5.00 (unchanged)** | |
| lead_scrape (per run) | 5 | **5.00 (unchanged)** | |
| transcription | 1/min, cap 5 min | **1.00/min (unchanged)** | |

## 4. Reserve floors (admission holds, in credits)

chat 1 → **0.10** (users with fractional balances can still send messages);
page_build **10.00** (unchanged); fixed operations hold their full price
(unchanged); transcription **1.00** (unchanged).

## 5. Storage and boundaries

- **DB + server domain: integers only, unit = cc.** Same columns, reinterpreted:
  `credit_ledger.delta`, `credit_plan_holds.{original,refundable,remaining}Credits`,
  `ai_usage_events.{reserved,final}Credits`, org member monthly limits. No float
  money math anywhere.
- **API boundary: decimal credits.** The server divides by 100 when building
  responses and multiplies by 100 when accepting credit inputs (admin grants,
  filters). Contracts carry decimal numbers with 2-dp semantics.
- **UI:** header balance shows one decimal (floor, never round up what the user
  has); usage history shows the exact 2-dp charge (−0.01, −0.87).
- `pricingSnapshot.usdMicrosPerCredit` keeps meaning micros per WHOLE credit
  (28_000); the conversion function owns the ×100. In-flight v3 reservations
  settle correctly after migration because their stored `reservedCredits` is
  migrated ×100 and the new conversion also outputs cc.

## 6. Data migration

One SQL migration (`0038_centi-credit-rescale.sql`) multiplies every stored
credit amount by 100: `credit_ledger.delta`, plan hold pools/holds,
`ai_usage_events.reserved_credits` and `final_credits`, signup grant settings +
outbox, refill slots, invoice applications, member monthly credit limits.
Balances are preserved exactly (37 credits → 3,700 cc → shown "37.0").
It ALSO rewrites the JSON amounts that replay/reconcile code compares against
those columns: `credit_ledger.meta.idempotencyFingerprint` (amount,
grantedAmount, forfeitedPlanCredits, bucketSplit, refundSplit),
`credit_ledger.meta.refill` (all amounts; capMultiplier ratio kept), and
`ai_usage_events.pricing_snapshot` unit prices (`creditsPerUnit`,
`reserveFloorCredits`, `creditsPerMinute`, top level and nested under
`reservationPricingSnapshot`). `usdMicrosPerCredit` stays 28_000 (per whole
credit). Catalog numbers (`tierCredits` = 250 etc.) are NOT stored amounts and
are NOT multiplied — grant paths multiply at write time. Deploy note: migrate and release
together (Railway runs migrations before boot); rows written by v3 code after the
migration would be 100× too small, so ship at a low-traffic moment.

## 7. Rollout

1. Merge → dev → staging: verify decimal deductions on staging chat.
2. Production deploy runs the migration automatically. No env changes
   (`AI_USD_PER_CREDIT` stays unset → $0.028).
3. After deploy: spot-check a fresh chat message settles at < 1 credit and the
   admin analytics totals divide by 100 correctly.

# Pricing v5 — the $0.04 unit, everywhere

Decision date: 2026-08-22. Founder decision 1 of the credit-system rework.
Supersedes the $0.028 anchor of `pricing-v3-implementation.md` /
`pricing-v4-fractional-credits.md` (both stay as historical records).

## 1. The unit

> **Grant-only supersession:** pricing v6 supersedes only the signup-grant sentence in this
> section. The current grant is 7 credits = 700 centi-credits = $0.28 of provider cost;
> existing free users keep grants already issued. The $0.04 unit and the rest of this document
> remain authoritative.

- **1 credit = $0.04 of AI-provider cost.** The server bills from the gateway
  `total_cost`; every operation bills its measured cost (flat per-operation
  prices are removed in a separate workstream).
- At the pricing-v5 rollout, the signup grant stayed at the then-current 50 credits, worth
  $2.00 of provider value (previously $1.40 at $0.028). Pricing v6 later replaced this grant
  value as noted above.
- The ledger keeps integer centi-credits (1 credit = 100 cc, pricing v4). The
  anchor only converts future provider USD into centi-credits; historic rows
  keep their meaning, so there is no schema change and no migration.
- Runs finish and can settle slightly negative; a NEW operation needs a
  positive balance. The web precheck blocks only `balance <= 0` — the server
  reservation stays authoritative.
- The UI shows no price labels. `CREDIT_COSTS`, `PriceTag`, `QUALITY_CREDITS`,
  and the related i18n keys are deleted.

## 2. Where the anchor lives

- `packages/env/src/server.ts` — `AI_USD_PER_CREDIT` defaults to `0.04`.
- `apps/server/src/modules/metering/domain/model-pricing.ts` —
  `DEFAULT_USD_MICROS_PER_CREDIT = 40_000` (micros per WHOLE credit;
  `usdMicrosToCentiCredits` owns the ×100).
- `apps/server/src/modules/metering/application/services/model-pricing.service.ts`
  reads the env value at boot; there is no separate literal fallback.

## 3. Snapshot preservation (in-flight events)

Reserve stamps the current anchor into `ai_usage_events.pricing_snapshot`
(`usdMicrosPerCredit`). Settle and reconcile read the stamped value back from
the stored event, never the live service value. Therefore:

- An event reserved under 28,000 settles and reconciles at 28,000 after the
  flip; only events reserved after the flip use 40,000.
- Legacy events without the field fall back to the current service value —
  accepted (a few cc at most per event, rare after the v4 rollout).
- Regression tests: `model-pricing.spec.ts` (default anchor) and the
  anchor-migration test in `metering.service.spec.ts`.

## 4. Env rollout — safe order

Production convention: `AI_USD_PER_CREDIT` is normally unset, so the code
default rules.

1. Set `AI_USD_PER_CREDIT=0.04` explicitly on Railway staging and production,
   restart. Old code reads the env at boot, so the anchor flips immediately;
   in-flight events keep their snapshots.
2. Deploy the code change (new default 0.04). The explicit var and the default
   now agree — no window where an old default can win.
3. After the deploy is verified, delete the var so the code default rules
   again, per house convention.

Step 1 first removes the risk that a rollback re-instates 0.028.

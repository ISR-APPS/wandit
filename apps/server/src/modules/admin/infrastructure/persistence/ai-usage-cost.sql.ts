import { sql } from "@wandit/db";
import { aiUsageEvents } from "@wandit/db/schema/credits";

/**
 * Best-known provider cost of one usage event, in USD micros. Settlement
 * writes the final catalog cost only into pricing_snapshot.costUsdMicros —
 * the dedicated columns keep the reservation estimate until the
 * reconciliation sweep runs — so the fallback order is: reconciled provider
 * cost, then the settle-time snapshot cost, then the reservation estimate.
 * Null when none exists. Same expression as AdminOverviewRepository's usage
 * queries.
 */
export const aiUsageEventCostUsdMicros = sql`coalesce(
	${aiUsageEvents.reconciledCostUsdMicros},
	case
		when jsonb_typeof(${aiUsageEvents.pricingSnapshot} -> 'costUsdMicros') = 'number'
			then (${aiUsageEvents.pricingSnapshot} ->> 'costUsdMicros')::bigint
	end,
	${aiUsageEvents.estimatedCostUsdMicros}
)`;

/**
 * Statuses whose cost is money actually spent. Excludes in-flight
 * reservations and refunded work, whose estimates never materialized into
 * provider spend. Mirrors the AdminOverviewRepository usage filters.
 */
export const AI_SPEND_STATUSES = [
	"settled",
	"reconciled",
	"reconcile_failed",
] as const;

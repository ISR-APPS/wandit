import { sql } from "@wandit/db";
import {
	aiProviderCallEvidence,
	aiUsageEvents,
} from "@wandit/db/schema/credits";

/**
 * Sum of the non-gateway provider receipts attached to one usage event
 * (Serper pages, Higgsfield/MCP submits), in USD micros; NULL when the
 * event has none. Gateway transports are excluded so a future mirroring of
 * gateway generations into the evidence table can never double count the
 * reconciled gateway cost.
 */
export const aiUsageEventEvidenceCostUsdMicros = sql`(
	select sum(${aiProviderCallEvidence.chargedUsdMicros})::bigint
	from ${aiProviderCallEvidence}
	where ${aiProviderCallEvidence.usageEventId} = ${aiUsageEvents.id}
		and ${aiProviderCallEvidence.transport} not in ('vercel', 'openrouter')
)`;

/**
 * Best-known provider cost of one usage event, in USD micros. Settlement
 * writes the final catalog cost only into pricing_snapshot.costUsdMicros —
 * the dedicated columns keep the reservation estimate until the
 * reconciliation sweep runs — so the fallback order is: reconciled provider
 * cost, then the settle-time snapshot cost, then the reservation estimate.
 *
 * Provider-call evidence joins without double counting: reconciliation folds
 * evidence into reconciled_cost_usd_micros and a lead-scrape settlement
 * snapshots the same Serper cost, so a live event reads its event-level cost
 * only. A REFUNDED event never materialized its estimate — it contributes
 * its evidence cost alone (ruling 6: a failed scrape still paid Serper),
 * falling back to the refund-with-provider-cost column.
 * Null when none exists. Same expression as AdminOverviewRepository's usage
 * queries.
 */
export const aiUsageEventCostUsdMicros = sql`case
	when ${aiUsageEvents.status} = 'refunded'
		then coalesce(
			${aiUsageEventEvidenceCostUsdMicros},
			${aiUsageEvents.reconciledCostUsdMicros}
		)
	else coalesce(
		${aiUsageEvents.reconciledCostUsdMicros},
		case
			when jsonb_typeof(${aiUsageEvents.pricingSnapshot} -> 'costUsdMicros') = 'number'
				then (${aiUsageEvents.pricingSnapshot} ->> 'costUsdMicros')::bigint
		end,
		${aiUsageEvents.estimatedCostUsdMicros}
	)
end`;

/**
 * Statuses whose cost is money actually spent. Excludes in-flight
 * reservations. Refunded work is included because its provider evidence
 * (and refund-with-provider-cost) is real spend; the cost expression above
 * never reads a refunded event's estimate. Mirrors the AdminOverviewRepository
 * usage filters.
 */
export const AI_SPEND_STATUSES = [
	"settled",
	"reconciled",
	"reconcile_failed",
	"refunded",
] as const;

/**
 * Where the best-known cost came from, in the same precedence as
 * aiUsageEventCostUsdMicros: `measured` (gateway-reconciled), `contract`
 * (settle-time catalog snapshot), `estimate` (reservation estimate).
 */
export const aiUsageEventCostProvenance = sql<string>`case
	when ${aiUsageEvents.status} = 'refunded' then 'measured'
	when ${aiUsageEvents.reconciledCostUsdMicros} is not null then 'measured'
	when jsonb_typeof(${aiUsageEvents.pricingSnapshot} -> 'costUsdMicros') = 'number' then 'contract'
	else 'estimate'
end`;

export const AI_COST_PROVENANCES = [
	"measured",
	"contract",
	"estimate",
] as const;

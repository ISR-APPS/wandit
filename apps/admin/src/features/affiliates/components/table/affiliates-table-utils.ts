import type { Affiliate } from "../../api/affiliates.dto";
import { TOP_AFFILIATE_REVENUE_USD_MINOR } from "../../lib/constants";

export type AffiliateTablePresetId =
	| "all"
	| "active"
	| "top-performers"
	| "payout-due"
	| "paused"
	| "pending"
	| "no-conversions";

export const AFFILIATE_TABLE_PRESETS: readonly {
	id: AffiliateTablePresetId;
	label: string;
}[] = [
	{ id: "all", label: "All" },
	{ id: "active", label: "Active" },
	{ id: "top-performers", label: "Top performers" },
	{ id: "payout-due", label: "Payout due" },
	{ id: "paused", label: "Paused" },
	{ id: "pending", label: "Pending" },
	{ id: "no-conversions", label: "No conversions" },
];

export function matchesAffiliatePreset(
	affiliate: Affiliate,
	preset: AffiliateTablePresetId,
) {
	switch (preset) {
		case "active":
			return affiliate.status === "active";
		case "top-performers":
			return (
				affiliate.performance.revenueUsdMinor >= TOP_AFFILIATE_REVENUE_USD_MINOR
			);
		case "payout-due":
			return affiliate.performance.pendingCommissionUsdMinor > 0;
		case "paused":
			return affiliate.status === "paused";
		case "pending":
			return affiliate.status === "pending";
		case "no-conversions":
			return affiliate.performance.paidConversions === 0;
		case "all":
			return true;
	}
}

export function getAffiliateSearchValue(affiliate: Affiliate) {
	return [
		affiliate.name,
		affiliate.email,
		affiliate.id,
		affiliate.company ?? "",
		affiliate.country,
		...affiliate.codes.map((code) => code.code),
	]
		.join(" ")
		.toLowerCase();
}

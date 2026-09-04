import {
	ActivityIcon,
	BadgeDollarSignIcon,
	HeartHandshakeIcon,
	ReceiptTextIcon,
	UserRoundCheckIcon,
	UserRoundPlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AnalyticsRevenueResponse } from "@/features/analytics/api/analytics.dto";
import { AnalyticsMetricStrip } from "@/features/analytics/components/analytics-metric-strip";
import {
	formatOverviewPercentValue,
	formatOverviewRoundedUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type RevenueMetricsProps = {
	tiles: AnalyticsRevenueResponse["tiles"];
};

function RevenueMetrics({ tiles }: RevenueMetricsProps) {
	const healthyTrials = tiles.healthyTrials;

	return (
		<AnalyticsMetricStrip
			label="Revenue headline metrics"
			metrics={[
				{
					key: "mrr",
					label: "MRR",
					tooltip:
						"Monthly recurring revenue at list price. Yearly plans are counted as their price divided by 12. Discounts are not subtracted.",
					value: formatOverviewRoundedUsdMinor(tiles.mrrMinor),
					description: "Monthly revenue · list price",
					icon: BadgeDollarSignIcon,
					badge: (
						<Badge variant="outline" className="px-1.5">
							List price
						</Badge>
					),
				},
				{
					key: "arpu",
					label: "ARPU",
					tooltip:
						"Average revenue per paying user: MRR divided by active paid users.",
					value: formatOverviewRoundedUsdMinor(tiles.arpuMinor),
					description: "MRR per active paid user.",
					icon: ReceiptTextIcon,
				},
				{
					key: "active-paid",
					label: "Active paid",
					tooltip: "Paying accounts with a subscription that is active now.",
					value: formatOverviewWholeNumber(tiles.activePaidUsers),
					description: "Live subscriptions today.",
					icon: UserRoundCheckIcon,
				},
				{
					key: "new-paid",
					label: "New paid",
					tooltip:
						"Paying accounts whose first subscription started during the selected range.",
					value: formatOverviewWholeNumber(tiles.newPaidUsersInRange),
					description: "First subscription in range",
					icon: UserRoundPlusIcon,
				},
				{
					key: "trial-to-paid",
					label: "Trial to paid",
					tooltip:
						"Share of users who ever became paying customers. Counted for accounts older than 7 days.",
					value: formatOverviewPercentValue(tiles.trialToPaidPctAllTime),
					description: "Accounts older than 7 days",
					icon: ActivityIcon,
				},
				{
					key: "healthy-trials",
					label: "Healthy trials",
					tooltip:
						"Free users who really used the product: 7+ credits and 2+ generations in their first 7 days. The supporting percentages show healthy trials as a share of all trials, then healthy versus other trial-to-paid rates.",
					value: formatOverviewWholeNumber(healthyTrials.count),
					description: (
						<>
							{formatOverviewPercentValue(healthyTrials.pctOfTrials)} of trials
							{" · paid: "}
							{formatOverviewPercentValue(healthyTrials.healthyToPaidPct)}
							{" vs "}
							{formatOverviewPercentValue(healthyTrials.nonHealthyToPaidPct)}
						</>
					),
					icon: HeartHandshakeIcon,
				},
			]}
		/>
	);
}

export type { RevenueMetricsProps };
export { RevenueMetrics };

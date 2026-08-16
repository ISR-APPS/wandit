import type { AdminAnalyticsChurn } from "@wandit/contracts";
import { DatabaseIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatNullableAnalyticsMetric } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewPercentValue,
	formatOverviewRoundedUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type ChurnCardProps = {
	churn: AdminAnalyticsChurn;
};

type ChurnMetricProps = {
	description: string;
	label: string;
	tooltip: string;
	value: ReactNode;
};

function ChurnMetric({ description, label, tooltip, value }: ChurnMetricProps) {
	return (
		<div className="min-w-0 border-r border-b px-5 py-5">
			<div className="flex min-h-4 items-center gap-1">
				<p className="text-muted-foreground text-xs leading-4">{label}</p>
				<MetricInfoTooltip label={label} content={tooltip} />
			</div>
			<div className="mt-1.5 min-h-8 font-semibold text-2xl tabular-nums tracking-tight">
				{value}
			</div>
			<p className="mt-1 text-muted-foreground text-xs leading-4">
				{description}
			</p>
		</div>
	);
}

function ChurnCard({ churn }: ChurnCardProps) {
	return (
		<Card className="h-full gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Churn and MRR movement</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Subscription lifecycle changes in the selected range
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						Lifecycle history
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="flex-1 p-0">
				<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
					<ChurnMetric
						label="Customer churn"
						tooltip="Billing owners with an ended subscription in the selected range and no other live subscription at range end, divided by active paid owners at range start. The range-start baseline is approximate. A dash means no baseline was available."
						value={formatNullableAnalyticsMetric(
							churn.customerChurnPct,
							formatOverviewPercentValue,
						)}
						description="Paid owners lost in range"
					/>
					<ChurnMetric
						label="MRR churn"
						tooltip="Churned list-price MRR divided by list-price MRR at range start. The range-start baseline is approximate. A dash means no baseline was available."
						value={formatNullableAnalyticsMetric(
							churn.mrrChurnPct,
							formatOverviewPercentValue,
						)}
						description="List-price MRR lost"
					/>
					<ChurnMetric
						label="Churned MRR"
						tooltip="Monthly list-price value of subscriptions that ended during the selected range."
						value={formatOverviewRoundedUsdMinor(churn.churnedMrrCents)}
						description="Ended subscriptions"
					/>
					<ChurnMetric
						label="Net-new MRR"
						tooltip="New MRR plus upgrade gains, minus downgrade losses and churned MRR during the selected range."
						value={formatOverviewRoundedUsdMinor(churn.netNewMrrCents)}
						description="New and expansion, less losses"
					/>
					<ChurnMetric
						label="Plan changes"
						tooltip="Confirmed plan changes during the selected range. A higher monthly catalog price is an upgrade; a lower price is a downgrade."
						value={
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span>
									{formatOverviewWholeNumber(churn.upgrades)}
									<span className="ml-1 font-normal text-muted-foreground text-xs">
										up
									</span>
								</span>
								<span>
									{formatOverviewWholeNumber(churn.downgrades)}
									<span className="ml-1 font-normal text-muted-foreground text-xs">
										down
									</span>
								</span>
							</div>
						}
						description="Upgrades and downgrades"
					/>
					<ChurnMetric
						label="LTV"
						tooltip="ARPU divided by monthly customer churn. A dash means customer churn was unavailable or zero."
						value={formatNullableAnalyticsMetric(
							churn.ltvCents,
							formatOverviewRoundedUsdMinor,
						)}
						description="Estimated customer lifetime value"
					/>
				</div>
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<DatabaseIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Subscription history rebuilt from stored Stripe events (since July
					2026).
				</p>
			</div>
		</Card>
	);
}

export type { ChurnCardProps };
export { ChurnCard };

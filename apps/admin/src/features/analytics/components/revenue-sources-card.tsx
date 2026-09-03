import type { AdminAnalyticsRevenueBySource } from "@wandit/contracts";
import { CircleAlertIcon } from "lucide-react";
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
import {
	formatOverviewPercentValue,
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type RevenueSourcesCardProps = {
	revenueBySource: AdminAnalyticsRevenueBySource;
};

type RevenueSourceMetricProps = {
	description: string;
	label: string;
	tooltip: string;
	value: ReactNode;
};

function RevenueSourceMetric({
	description,
	label,
	tooltip,
	value,
}: RevenueSourceMetricProps) {
	return (
		<div className="min-w-0 border-r border-b px-5 py-4">
			<div className="flex min-h-4 items-center gap-1">
				<p className="text-muted-foreground text-xs leading-4">{label}</p>
				<MetricInfoTooltip label={label} content={tooltip} />
			</div>
			<p className="mt-1.5 font-semibold text-xl tabular-nums tracking-tight">
				{value}
			</p>
			<p className="mt-1 text-muted-foreground text-xs leading-4">
				{description}
			</p>
		</div>
	);
}

function RevenueSourcesCard({ revenueBySource }: RevenueSourcesCardProps) {
	const totalCents =
		revenueBySource.subscriptionsCents +
		revenueBySource.topupsCents +
		revenueBySource.domainsCents;
	const domainSharePct =
		totalCents > 0 ? (revenueBySource.domainsCents / totalCents) * 100 : null;

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6 pb-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[200px] flex-1">
						<CardTitle>
							<h2>Revenue by source</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Where the cash collected in this range came from, and what domain
							resales actually earn
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						USD
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
					<RevenueSourceMetric
						label="Subscriptions"
						tooltip="Cash collected from paid subscription invoices during the selected range, before refunds."
						value={formatOverviewUsdMinor(revenueBySource.subscriptionsCents)}
						description="Paid subscription invoices"
					/>
					<RevenueSourceMetric
						label="Top-ups"
						tooltip="Cash collected from credit top-up packs during the selected range, before refunds. Backfilled receipts use catalog prices; the oldest purchases without a pack id are missing, so this can only understate."
						value={formatOverviewUsdMinor(revenueBySource.topupsCents)}
						description="Credit pack purchases"
					/>
					<RevenueSourceMetric
						label="Domain sales"
						tooltip="Cash collected from domain purchase orders (paid, fulfilling, or fulfilled) during the selected range, before refunds."
						value={formatOverviewUsdMinor(revenueBySource.domainsCents)}
						description={`${formatOverviewWholeNumber(revenueBySource.domainOrders)} ${revenueBySource.domainOrders === 1 ? "order" : "orders"}`}
					/>
					<RevenueSourceMetric
						label="Domain wholesale cost"
						tooltip="What the registrar charged us for those domains — the actual charge when recorded, else the wholesale price quoted at checkout."
						value={formatOverviewUsdMinor(revenueBySource.domainCostCents)}
						description="Paid to the registrar"
					/>
					<RevenueSourceMetric
						label="Domain margin"
						tooltip="Domain sales minus the registrar wholesale cost. Gross of refunds."
						value={formatOverviewUsdMinor(revenueBySource.domainMarginCents)}
						description={
							revenueBySource.domainMarginPct === null
								? "No domain sales in range"
								: `${formatOverviewPercentValue(revenueBySource.domainMarginPct)} of domain revenue`
						}
					/>
					<RevenueSourceMetric
						label="Domain share"
						tooltip="Domain sales as a share of all cash collected in the range (subscriptions + top-ups + domains)."
						value={
							domainSharePct === null
								? "—"
								: formatOverviewPercentValue(domainSharePct)
						}
						description="Of gross collected revenue"
					/>
				</div>
			</CardContent>

			{revenueBySource.domainCostUnknownOrders > 0 ? (
				<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
					<CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
					<p>
						{formatOverviewWholeNumber(revenueBySource.domainCostUnknownOrders)}{" "}
						{revenueBySource.domainCostUnknownOrders === 1
							? "order has"
							: "orders have"}{" "}
						no recorded wholesale cost; the margin treats them as zero cost.
					</p>
				</div>
			) : null}
		</Card>
	);
}

export type { RevenueSourcesCardProps };
export { RevenueSourcesCard };

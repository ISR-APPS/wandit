import type { AdminAnalyticsUnitEconomics } from "@wandit/contracts";
import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRightIcon,
	BadgeDollarSignIcon,
	CircleDollarSignIcon,
	Clock3Icon,
	GaugeIcon,
	ReceiptTextIcon,
	ServerCogIcon,
	UserRoundCheckIcon,
	UsersRoundIcon,
	WalletCardsIcon,
} from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	formatOverviewUsdMinor,
} from "@/features/overview/lib/formatters";

type UnitEconomicsCardProps = {
	unitEconomics: AdminAnalyticsUnitEconomics;
};

type UnitEconomicsMetric = {
	key: string;
	label: string;
	description: string;
	tooltip: string;
	value: string;
	icon: LucideIcon;
};

const missingCostCoverageTooltip = "needs cost data for every month in range";

function formatUnitEconomicsRatio(value: number): string {
	return `${new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 2,
	}).format(value)}×`;
}

function formatUnitEconomicsMonths(value: number): string {
	return `${new Intl.NumberFormat("en-US", {
		maximumFractionDigits: 1,
	}).format(value)} mo`;
}

function UnitEconomicsMetricCell({ metric }: { metric: UnitEconomicsMetric }) {
	const Icon = metric.icon;

	return (
		<div className="flex min-w-0 gap-3 border-r border-b px-5 py-5">
			<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
				<Icon aria-hidden="true" className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex min-h-4 items-center gap-1">
					<p className="text-muted-foreground text-xs leading-4">
						{metric.label}
					</p>
					<MetricInfoTooltip label={metric.label} content={metric.tooltip} />
				</div>
				<p className="mt-1.5 font-semibold text-xl tabular-nums tracking-tight">
					{metric.value}
				</p>
				<p className="mt-1 text-muted-foreground text-xs leading-4">
					{metric.description}
				</p>
			</div>
		</div>
	);
}

function UnitEconomicsCard({ unitEconomics }: UnitEconomicsCardProps) {
	const money = (value: number | null) =>
		formatNullableAnalyticsMetric(value, formatOverviewUsdMinor);
	const metrics: UnitEconomicsMetric[] = [
		{
			key: "cac",
			label: "CAC",
			description: "Ad spend per new paid user",
			tooltip:
				"Prorated ad spend divided by signup-cohort users who became paid in the selected range.",
			value: money(unitEconomics.cacCents),
			icon: BadgeDollarSignIcon,
		},
		{
			key: "ltv-cac",
			label: "LTV:CAC",
			description: "Lifetime value per acquisition dollar",
			tooltip:
				"Estimated customer lifetime value divided by customer acquisition cost.",
			value: formatNullableAnalyticsMetric(
				unitEconomics.ltvCacRatio,
				formatUnitEconomicsRatio,
			),
			icon: GaugeIcon,
		},
		{
			key: "gross-margin",
			label: "Gross margin",
			description: "After infrastructure costs",
			tooltip:
				"Net collected revenue less infrastructure costs, divided by net collected revenue. Ad spend and other costs are excluded.",
			value: formatNullableAnalyticsMetric(
				unitEconomics.grossMarginPct,
				formatOverviewPercentValue,
			),
			icon: ReceiptTextIcon,
		},
		{
			key: "cac-payback",
			label: "CAC payback",
			description: "Months to recover acquisition spend",
			tooltip: "CAC divided by monthly gross profit per active paid user.",
			value: formatNullableAnalyticsMetric(
				unitEconomics.cacPaybackMonths,
				formatUnitEconomicsMonths,
			),
			icon: Clock3Icon,
		},
		{
			key: "cost-free-active",
			label: "Cost / free active user",
			description: "All operating costs",
			tooltip:
				"Prorated total costs divided by active free users in the selected range.",
			value: money(unitEconomics.costPerFreeActiveUserCents),
			icon: UsersRoundIcon,
		},
		{
			key: "cost-healthy-trial",
			label: "Cost / healthy trial",
			description: "All operating costs",
			tooltip:
				"Prorated total costs divided by healthy trials in the selected range.",
			value: money(unitEconomics.costPerHealthyTrialCents),
			icon: WalletCardsIcon,
		},
		{
			key: "cost-active-paid",
			label: "Cost / active paid user",
			description: "All operating costs",
			tooltip:
				"Prorated total costs divided by active paid users in the selected range.",
			value: money(unitEconomics.costPerActivePaidUserCents),
			icon: UserRoundCheckIcon,
		},
		{
			key: "ad-spend",
			label: "Ad spend",
			description: "Prorated source spend",
			tooltip:
				"Total source-level advertising spend prorated across the selected range.",
			value: money(unitEconomics.adSpendCents),
			icon: CircleDollarSignIcon,
		},
		{
			key: "infrastructure-cost",
			label: "Infrastructure",
			description: "Prorated hosting and platform cost",
			tooltip: "Infrastructure costs prorated across the selected range.",
			value: money(unitEconomics.infrastructureCostCents),
			icon: ServerCogIcon,
		},
		{
			key: "other-cost",
			label: "Other costs",
			description: "Prorated non-ad operating cost",
			tooltip: "Other operating costs prorated across the selected range.",
			value: money(unitEconomics.otherCostCents),
			icon: WalletCardsIcon,
		},
		{
			key: "total-cost",
			label: "Total costs",
			description: "Ads, infrastructure, and other",
			tooltip:
				"Prorated advertising, infrastructure, and other costs combined.",
			value: money(unitEconomics.totalCostCents),
			icon: ReceiptTextIcon,
		},
	];

	return (
		<Card
			className="gap-0 overflow-hidden py-0 shadow-none"
			data-state={
				unitEconomics.costCoverageComplete ? "complete" : "incomplete"
			}
		>
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2>Unit economics</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Acquisition efficiency, contribution margin, and operating costs
							for the selected range
						</CardDescription>
					</div>
					{unitEconomics.costCoverageComplete ? (
						<Badge variant="outline" className="shrink-0 bg-muted/30">
							Complete cost coverage
						</Badge>
					) : (
						<div className="flex flex-wrap items-center justify-end gap-2">
							<Badge
								variant="outline"
								className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
							>
								Coverage incomplete
								<MetricInfoTooltip
									label="Cost data coverage"
									content={missingCostCoverageTooltip}
								/>
							</Badge>
							<Button asChild size="sm" variant="outline">
								<a href="/costs">
									Manage costs
									<ArrowUpRightIcon aria-hidden="true" />
								</a>
							</Button>
						</div>
					)}
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
					{metrics.map((metric) => (
						<UnitEconomicsMetricCell key={metric.key} metric={metric} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export type { UnitEconomicsCardProps };
export {
	formatUnitEconomicsMonths,
	formatUnitEconomicsRatio,
	missingCostCoverageTooltip,
	UnitEconomicsCard,
};

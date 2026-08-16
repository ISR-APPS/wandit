import type { LucideIcon } from "lucide-react";
import {
	ArrowUpRightIcon,
	BadgeDollarSignIcon,
	CircleDollarSignIcon,
	UserRoundSearchIcon,
} from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsAcquisitionResponse } from "@/features/analytics/api/analytics.dto";
import { formatNullableAnalyticsMetric } from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type AcquisitionCostMetricsProps = Pick<
	AnalyticsAcquisitionResponse,
	"adSpendCents" | "cacCents" | "costCoverageComplete"
> & {
	unattributedSignups: number;
	hasActiveAttributionFilters: boolean;
};

type AcquisitionHeadlineMetricProps = {
	icon: LucideIcon;
	label: string;
	value: string;
	description: string;
	tooltip: string;
};

const acquisitionCostCoverageTooltip =
	"needs cost data for every month in range";
const filteredAcquisitionCostTooltip =
	"Cost metrics are unavailable while source, country, or device filters are active because spend cannot be allocated to a filtered subset.";

function AcquisitionHeadlineMetric({
	icon: Icon,
	label,
	value,
	description,
	tooltip,
}: AcquisitionHeadlineMetricProps) {
	return (
		<Card className="gap-0 py-0 shadow-none">
			<CardContent className="flex items-start gap-3 px-5 py-5">
				<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
					<Icon aria-hidden="true" className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-h-4 items-center gap-1">
						<p className="text-muted-foreground text-xs leading-4">{label}</p>
						<MetricInfoTooltip label={label} content={tooltip} />
					</div>
					<p className="mt-1.5 min-h-7 font-semibold text-xl tabular-nums tracking-tight">
						{value}
					</p>
					<p className="mt-1.5 min-h-8 text-muted-foreground text-xs leading-4">
						{description}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

function AcquisitionCostMetrics({
	adSpendCents,
	cacCents,
	costCoverageComplete,
	unattributedSignups,
	hasActiveAttributionFilters,
}: AcquisitionCostMetricsProps) {
	const costTooltip = hasActiveAttributionFilters
		? filteredAcquisitionCostTooltip
		: costCoverageComplete
			? "Prorated advertising spend from the monthly cost ledger for the selected range."
			: acquisitionCostCoverageTooltip;
	const costDescription = hasActiveAttributionFilters
		? "Unavailable with attribution filters"
		: costCoverageComplete
			? "Prorated across the selected range"
			: "Monthly cost coverage is incomplete";
	const cacDescription = hasActiveAttributionFilters
		? "Unavailable with attribution filters"
		: costCoverageComplete
			? "Ad spend per new paid user"
			: "Monthly cost coverage is incomplete";

	return (
		<section
			aria-label="Acquisition headline metrics"
			className="space-y-3"
			data-state={
				hasActiveAttributionFilters
					? "filtered"
					: costCoverageComplete
						? "complete"
						: "incomplete"
			}
		>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				<AcquisitionHeadlineMetric
					icon={CircleDollarSignIcon}
					label="Ad spend"
					tooltip={costTooltip}
					value={formatNullableAnalyticsMetric(
						adSpendCents,
						formatOverviewUsdMinor,
					)}
					description={costDescription}
				/>
				<AcquisitionHeadlineMetric
					icon={BadgeDollarSignIcon}
					label="CAC"
					tooltip={
						hasActiveAttributionFilters
							? filteredAcquisitionCostTooltip
							: costCoverageComplete
								? "Prorated ad spend divided by signup-cohort users who became paid in the selected range. An em dash means there were no paid users to divide by."
								: acquisitionCostCoverageTooltip
					}
					value={formatNullableAnalyticsMetric(
						cacCents,
						formatOverviewUsdMinor,
					)}
					description={cacDescription}
				/>
				<AcquisitionHeadlineMetric
					icon={UserRoundSearchIcon}
					label="Unattributed signups"
					tooltip="Signups with no attribution record. Attribution tracking started 2026-08-15, so earlier users cannot be assigned a source."
					value={formatOverviewWholeNumber(unattributedSignups)}
					description="Signed up before tracking"
				/>
			</div>

			{hasActiveAttributionFilters || !costCoverageComplete ? (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-muted-foreground text-xs leading-relaxed">
					<div className="flex flex-wrap items-center gap-2">
						{hasActiveAttributionFilters ? (
							<p>
								Cost metrics are unavailable with attribution filters because
								spend cannot be allocated to the filtered subset.
							</p>
						) : null}
						{!costCoverageComplete ? (
							<Badge
								variant="outline"
								className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
							>
								Coverage incomplete
								<MetricInfoTooltip
									label="Cost data coverage"
									content={acquisitionCostCoverageTooltip}
								/>
							</Badge>
						) : null}
					</div>
					{!costCoverageComplete ? (
						<Button asChild size="sm" variant="outline">
							<a href="/costs">
								Manage costs
								<ArrowUpRightIcon aria-hidden="true" />
							</a>
						</Button>
					) : null}
				</div>
			) : null}
		</section>
	);
}

export type { AcquisitionCostMetricsProps };
export {
	AcquisitionCostMetrics,
	acquisitionCostCoverageTooltip,
	filteredAcquisitionCostTooltip,
};

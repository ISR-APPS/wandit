import type { AdminAnalyticsChurnBreakdown } from "@wandit/contracts";
import { DatabaseIcon, ListFilterIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	featureAdoptionMetadata,
	formatAcquisitionSource,
} from "@/features/analytics/lib/analytics-data";
import { hasChurnBreakdownRows } from "@/features/analytics/lib/revenue-history-data";
import {
	formatOverviewRoundedUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type ChurnBreakdownCardProps = {
	breakdown: AdminAnalyticsChurnBreakdown;
};

type BreakdownItem = {
	key: string;
	label: string;
	value: number;
	detail?: ReactNode;
};

function BreakdownList({
	emptyLabel,
	items,
	title,
	tooltip,
}: {
	emptyLabel: string;
	items: BreakdownItem[];
	title: string;
	tooltip: string;
}) {
	const tooltipLabel = title.startsWith("By ")
		? `Churn ${title.toLowerCase()}`
		: `Churn by ${title}`;

	return (
		<section className="min-w-0 border-r border-b px-5 py-5">
			<h3 className="flex items-center gap-1 font-medium text-sm">
				{title}
				<MetricInfoTooltip label={tooltipLabel} content={tooltip} />
			</h3>
			{items.length > 0 ? (
				<ul className="mt-4 space-y-3">
					{items.map((item) => (
						<li key={item.key} className="flex min-w-0 items-start gap-3">
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm">{item.label}</p>
								{item.detail ? (
									<p className="mt-0.5 text-[11px] text-muted-foreground">
										{item.detail}
									</p>
								) : null}
							</div>
							<span className="shrink-0 font-medium font-mono text-sm tabular-nums">
								{formatOverviewWholeNumber(item.value)}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-muted-foreground text-xs">{emptyLabel}</p>
			)}
		</section>
	);
}

function ChurnBreakdownCard({ breakdown }: ChurnBreakdownCardProps) {
	const reasonRows = breakdown.byReason ?? [];
	const hasRows = hasChurnBreakdownRows(breakdown) || reasonRows.length > 0;
	const planItems = breakdown.byPlan.map((row) => ({
		key: row.plan,
		label: formatBreakdownLabel(row.plan),
		value: row.churned,
		detail: `${formatOverviewRoundedUsdMinor(row.churnedMrrCents)} churned MRR`,
	}));
	const sourceItems = breakdown.bySource.map((row) => ({
		key: row.source,
		label: formatAcquisitionSource(row.source),
		value: row.churned,
	}));
	const reasonItems = reasonRows.map((row) => ({
		key: row.reason,
		label: formatCancellationReason(row.reason),
		value: row.churned,
	}));
	const countryItems = breakdown.byCountry.map((row) => ({
		key: row.country,
		label:
			row.country.toLowerCase() === "unknown"
				? "Unknown"
				: row.country.toUpperCase(),
		value: row.churned,
	}));
	const featureItems = breakdown.byFeature.map((row) => ({
		key: row.feature,
		label: featureAdoptionMetadata[row.feature].label,
		value: row.churned,
	}));

	return (
		<Card className="gap-0 overflow-hidden py-0 shadow-none">
			<CardHeader className="border-b pt-6">
				<CardTitle>
					<h2 className="flex items-center gap-1">
						Churn breakdown
						<MetricInfoTooltip
							label="Churn breakdown"
							content="Owners whose subscription ended in the selected range and who had no other live subscription at range end."
						/>
					</h2>
				</CardTitle>
				<CardDescription className="mt-1">
					Churned owners grouped by plan, acquisition, cancellation reason,
					geography, and prior product use
				</CardDescription>
			</CardHeader>

			<CardContent className="p-0">
				{hasRows ? (
					<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
						<BreakdownList
							title="Plan"
							tooltip="The ended subscription's plan. Unknown catalog lookup keys appear as Unknown. MRR is monthly list-price value."
							emptyLabel="No plan breakdown available."
							items={planItems}
						/>
						<BreakdownList
							title="Source"
							tooltip="First-touch attribution source for the churned personal owner or the organization's attribution user. Missing attribution appears as Unknown."
							emptyLabel="No source breakdown available."
							items={sourceItems}
						/>
						<BreakdownList
							title="By reason"
							tooltip="The cancellation reason submitted for the churned subscription. Churn before the Phase 3 survey is grouped as Unknown (pre-survey)."
							emptyLabel="No cancellation reasons recorded."
							items={reasonItems}
						/>
						<BreakdownList
							title="Country"
							tooltip="Captured signup country for the owner's attribution user. Missing attribution appears as Unknown."
							emptyLabel="No country breakdown available."
							items={countryItems}
						/>
						<BreakdownList
							title="Feature used"
							tooltip="Features used before the owner's churn event. One churned owner can appear in several feature rows."
							emptyLabel="No prior feature use recorded."
							items={featureItems}
						/>
					</div>
				) : (
					<div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
						<span className="flex size-10 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground">
							<ListFilterIcon className="size-5" />
						</span>
						<p className="mt-3 font-medium text-sm">
							No churn recorded in this range
						</p>
						<p className="mt-1 max-w-sm text-muted-foreground text-xs">
							Plan, source, reason, country, and feature breakdowns appear after
							an owner churns.
						</p>
					</div>
				)}
			</CardContent>

			<div className="flex items-start gap-2 border-t bg-muted/25 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				<DatabaseIcon className="mt-0.5 size-3.5 shrink-0" />
				<p>
					Approximate: churn is rebuilt from stored Stripe events since July
					2026. Feature rows are not mutually exclusive.
				</p>
			</div>
		</Card>
	);
}

function formatBreakdownLabel(value: string) {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function formatCancellationReason(value: string) {
	return value === "unknown"
		? "Unknown (pre-survey)"
		: formatBreakdownLabel(value);
}

export type { ChurnBreakdownCardProps };
export { ChurnBreakdownCard, formatCancellationReason };

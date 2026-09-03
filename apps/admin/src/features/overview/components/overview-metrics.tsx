import type { LucideIcon } from "lucide-react";
import {
	CircleDollarSignIcon,
	CoinsIcon,
	Globe2Icon,
	HeartPulseIcon,
	ImagesIcon,
	MinusIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	UserRoundPlusIcon,
	UsersRoundIcon,
	WalletCardsIcon,
} from "lucide-react";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import { Badge } from "@/components/ui/badge";
import type { OverviewSnapshot } from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercent,
	formatOverviewRoundedUsdMinor,
	formatOverviewUsdMinor,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { cn } from "@/lib/utils";

type OverviewMetricsProps = {
	snapshot: OverviewSnapshot;
};

type MetricItem = {
	key: string;
	label: string;
	tooltip: string;
	value: string;
	description: string;
	changePercent?: number;
	changeLabel?: string;
	icon: LucideIcon;
};

const PERIOD_COMPARISON_TOOLTIP =
	"Compared with the period of the same length just before the selected range.";

function MetricDelta({ value, label }: { value: number; label?: string }) {
	const displayValue = label ?? formatOverviewPercent(value);

	return (
		<MetricInfoTooltip
			label={`${displayValue} change`}
			content={PERIOD_COMPARISON_TOOLTIP}
			trigger={
				<Badge
					asChild
					variant="outline"
					className={cn(
						"ml-auto shrink-0 cursor-help gap-1 border-transparent px-1.5 font-medium tabular-nums",
						value > 0 &&
							"bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
						value < 0 && "bg-destructive/10 text-destructive",
						value === 0 && "bg-muted text-muted-foreground",
					)}
				>
					<button
						type="button"
						aria-label={`${displayValue} change from the previous period`}
					>
						{value > 0 ? (
							<TrendingUpIcon />
						) : value < 0 ? (
							<TrendingDownIcon />
						) : (
							<MinusIcon />
						)}
						{displayValue}
					</button>
				</Badge>
			}
		/>
	);
}

function OverviewMetrics({ snapshot }: OverviewMetricsProps) {
	const { revenue, totals } = snapshot;
	const metrics: MetricItem[] = [
		{
			key: "revenue",
			label: "Gross revenue",
			tooltip:
				"Money actually received. Subscription payments recorded since June 2026 (migration 0029); older payments are not included.",
			value: formatOverviewRoundedUsdMinor(revenue.totalUsdMinor),
			description: "Collected · USD",
			changePercent: revenue.changePercent,
			icon: WalletCardsIcon,
		},
		{
			key: "mrr",
			label: "MRR",
			tooltip:
				"Monthly recurring revenue at list price. Yearly plans are counted as their price divided by 12. Discounts are not subtracted.",
			value: formatOverviewRoundedUsdMinor(snapshot.mrrMinor),
			description: "Live subs · list price",
			icon: CircleDollarSignIcon,
		},
		{
			key: "tokens",
			label: "Tokens used",
			tooltip:
				"The total number of small pieces of text and data processed by AI models in the selected range. The supporting text shows the recorded model cost in USD.",
			value: formatOverviewCompactNumber(totals.tokensUsed),
			description: `Model cost: ${formatOverviewUsdMinor(
				totals.tokenCostUsdMinor,
			)}`,
			changePercent: totals.tokensChangePercent,
			icon: CoinsIcon,
		},
		{
			key: "websites",
			label: "Websites generated",
			tooltip:
				"Successful website generations completed in the selected range. Rebuilds count again because each one creates a new version.",
			value: formatOverviewWholeNumber(totals.websitesGenerated),
			description: "Successful page builds",
			changePercent: totals.websitesChangePercent,
			icon: Globe2Icon,
		},
		{
			key: "signups",
			label: "New signups",
			tooltip: "New user accounts created in the selected range.",
			value: formatOverviewWholeNumber(totals.signups),
			description: "Signed up in selected range",
			changePercent: totals.signupsChangePercent,
			icon: UserRoundPlusIcon,
		},
		{
			key: "users",
			label: "Total users",
			tooltip:
				"All user accounts created so far. The smaller number below shows how many were active in the selected range.",
			value: formatOverviewWholeNumber(totals.totalUsers),
			description: `${formatOverviewWholeNumber(
				totals.activeUsers,
			)} active in range`,
			icon: UsersRoundIcon,
		},
		{
			key: "healthy-trials",
			label: "Healthy trials",
			tooltip:
				"Free users who really used the product: 3+ credits and 2+ generations in their first 7 days.",
			value: formatOverviewWholeNumber(snapshot.healthyTrials.count),
			description: "Qualified in first 7 days",
			icon: HeartPulseIcon,
		},
		{
			key: "images",
			label: "Images generated",
			tooltip:
				"Images successfully generated and saved in the selected range. Images made inside website builds are not included. The supporting total includes successful standalone image and video assets.",
			value: formatOverviewCompactNumber(totals.imagesGenerated),
			// MOCK DATA: Page-build R2 images lack a reliable database success marker,
			// so this total currently covers persisted generation attempts only.
			description: `${formatOverviewCompactNumber(
				totals.assetsGenerated,
			)} total assets`,
			changePercent: totals.imagesChangePercent,
			icon: ImagesIcon,
		},
	];

	return (
		<section aria-label="Platform headline metrics">
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="-mr-px -mb-px grid @[960px]/main:grid-cols-4 grid-cols-1 sm:grid-cols-2">
					{metrics.map((metric) => (
						<div
							key={metric.key}
							className="flex min-w-[200px] items-start gap-3 border-r border-b px-5 py-5"
						>
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
								<metric.icon className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex min-h-4 items-center gap-1">
									<p className="whitespace-nowrap text-muted-foreground text-xs leading-4">
										{metric.label}
									</p>
									<MetricInfoTooltip
										label={metric.label}
										content={metric.tooltip}
									/>
								</div>
								<div className="mt-1.5 flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1">
									<p className="min-w-0 whitespace-nowrap font-semibold text-xl tabular-nums tracking-tight">
										{metric.value}
									</p>
									{metric.changePercent === undefined ? null : (
										<MetricDelta
											value={metric.changePercent}
											label={metric.changeLabel}
										/>
									)}
								</div>
								<p className="mt-1.5 line-clamp-2 min-h-8 text-muted-foreground text-xs leading-4">
									{metric.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export type { OverviewMetricsProps };
export { OverviewMetrics };

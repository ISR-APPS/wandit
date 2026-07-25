import type { LucideIcon } from "lucide-react";
import {
	CoinsIcon,
	Globe2Icon,
	ImagesIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	UserRoundPlusIcon,
	UsersRoundIcon,
	WalletCardsIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { OverviewSnapshot } from "@/features/overview/api/overview.dto";
import {
	formatOverviewCompactNumber,
	formatOverviewPercent,
	formatOverviewRoundedCurrencyMinor,
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
	value: string;
	description: string;
	changePercent?: number;
	changeLabel?: string;
	icon: LucideIcon;
};

function MetricDelta({ value, label }: { value: number; label?: string }) {
	const isPositive = value >= 0;

	return (
		<Badge
			variant="outline"
			className={cn(
				"gap-1 border-transparent px-1.5 font-medium tabular-nums",
				isPositive
					? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					: "bg-destructive/10 text-destructive",
			)}
		>
			{isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
			{label ?? formatOverviewPercent(value)}
		</Badge>
	);
}

function OverviewMetrics({ snapshot }: OverviewMetricsProps) {
	const { revenue, totals } = snapshot;
	const metrics: MetricItem[] = [
		{
			key: "revenue",
			label: "Gross revenue",
			value: formatOverviewRoundedUsdMinor(revenue.totalReportingUsdMinor),
			description: `${formatOverviewRoundedUsdMinor(
				revenue.stripe.nativeTotalMinor,
			)} Stripe · ${formatOverviewRoundedCurrencyMinor(
				revenue.chargily.nativeTotalMinor,
				"DZD",
			)} Chargily`,
			changePercent: revenue.changePercent,
			icon: WalletCardsIcon,
		},
		{
			key: "tokens",
			label: "Tokens used",
			value: formatOverviewCompactNumber(totals.tokensUsed),
			description: `${formatOverviewUsdMinor(
				totals.estimatedTokenCostUsdMinor,
			)} estimated model cost`,
			changePercent: totals.tokensChangePercent,
			icon: CoinsIcon,
		},
		{
			key: "websites",
			label: "Websites generated",
			value: formatOverviewWholeNumber(totals.websitesGenerated),
			description: `${formatOverviewWholeNumber(
				snapshot.generation.successful,
			)} successful generations`,
			changePercent: totals.websitesChangePercent,
			icon: Globe2Icon,
		},
		{
			key: "signups",
			label: "New signups",
			value: formatOverviewWholeNumber(totals.signups),
			description: "Onboarded in the selected range",
			changePercent: totals.signupsChangePercent,
			icon: UserRoundPlusIcon,
		},
		{
			key: "users",
			label: "Total users",
			value: formatOverviewWholeNumber(totals.totalUsers),
			description: `${formatOverviewWholeNumber(
				totals.activeUsers,
			)} active in range`,
			icon: UsersRoundIcon,
		},
		{
			key: "images",
			label: "Images generated",
			value: formatOverviewCompactNumber(totals.imagesGenerated),
			description: `${formatOverviewCompactNumber(
				totals.assetsGenerated,
			)} assets created`,
			changePercent: totals.imagesChangePercent,
			icon: ImagesIcon,
		},
	];

	return (
		<section aria-label="Platform headline metrics">
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="grid @[1180px]/main:grid-cols-6 @[860px]/main:grid-cols-3 sm:grid-cols-2">
					{metrics.map((metric, index) => (
						<div
							key={metric.key}
							className={cn(
								"flex min-w-0 items-start gap-3 border-b px-4 py-4",
								index === metrics.length - 1 && "border-b-0",
								index % 2 === 0 && "sm:border-r",
								index >= metrics.length - 2 && "sm:border-b-0",
								index < 3
									? "@[860px]/main:border-b"
									: "@[860px]/main:border-b-0",
								index % 3 === 2
									? "@[860px]/main:border-r-0"
									: "@[860px]/main:border-r",
								"@[1180px]/main:border-b-0",
								index === metrics.length - 1
									? "@[1180px]/main:border-r-0"
									: "@[1180px]/main:border-r",
							)}
						>
							<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
								<metric.icon className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between gap-3">
									<p className="text-muted-foreground text-xs">
										{metric.label}
									</p>
									{metric.changePercent === undefined ? null : (
										<MetricDelta
											value={metric.changePercent}
											label={metric.changeLabel}
										/>
									)}
								</div>
								<p className="mt-1 font-semibold text-xl tabular-nums tracking-tight">
									{metric.value}
								</p>
								<p className="mt-1 max-w-[220px] truncate text-muted-foreground text-xs">
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

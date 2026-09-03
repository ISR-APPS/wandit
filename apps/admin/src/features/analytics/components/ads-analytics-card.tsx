import type {
	AdminAnalyticsAds,
	AdminAnalyticsAdsOperation,
} from "@wandit/contracts";
import {
	ChartNoAxesCombinedIcon,
	MegaphoneIcon,
	RocketIcon,
	UsersRoundIcon,
} from "lucide-react";

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
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type AdsAnalyticsCardProps = {
	ads: AdminAnalyticsAds;
};

type AdsOperationSummaryProps = {
	description: string;
	icon: typeof ChartNoAxesCombinedIcon;
	label: string;
	operation: AdminAnalyticsAdsOperation;
};

function AdsOperationSummary({
	description,
	icon: Icon,
	label,
	operation,
}: AdsOperationSummaryProps) {
	return (
		<section className="min-w-0 border-r border-b px-5 py-5">
			<div className="flex items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
					<Icon aria-hidden="true" className="size-4" />
				</span>
				<div className="min-w-0">
					<h3 className="font-medium text-sm">{label}</h3>
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
				</div>
			</div>

			<dl className="mt-5 grid grid-cols-3 gap-3">
				<div>
					<dt className="text-muted-foreground text-xs">Events</dt>
					<dd className="mt-1 font-semibold text-xl tabular-nums tracking-tight">
						{formatOverviewWholeNumber(operation.events)}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground text-xs">Users</dt>
					<dd className="mt-1 font-semibold text-xl tabular-nums tracking-tight">
						{formatOverviewWholeNumber(operation.users)}
					</dd>
				</div>
				<div>
					<dt className="flex items-center gap-1 text-muted-foreground text-xs">
						Error rate
						<MetricInfoTooltip
							label={`${label} error rate`}
							content="Failed provider executions divided by all provider executions. A dash means no executions were recorded."
						/>
					</dt>
					<dd className="mt-1 font-semibold text-xl tabular-nums tracking-tight">
						{formatNullableAnalyticsMetric(
							operation.errorRatePct,
							formatOverviewPercentValue,
						)}
					</dd>
				</div>
			</dl>
		</section>
	);
}

function AdsAnalyticsCard({ ads }: AdsAnalyticsCardProps) {
	const hasAdsActivity =
		ads.connectedUsers > 0 ||
		ads.analysis.events > 0 ||
		ads.launch.events > 0 ||
		(ads.analysis.errorRatePct !== null && ads.analysis.errorRatePct > 0) ||
		(ads.launch.errorRatePct !== null && ads.launch.errorRatePct > 0);

	return (
		<Card
			className="gap-0 overflow-hidden py-0 shadow-none"
			data-state={hasAdsActivity ? "data" : "empty"}
		>
			<CardHeader className="border-b pt-6">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-[220px] flex-1">
						<CardTitle>
							<h2 className="flex items-center gap-1">
								Ads
								<MetricInfoTooltip
									label="Ads"
									content="Ads analysis and launch activity through valid Meta Ads and TikTok Ads connections."
								/>
							</h2>
						</CardTitle>
						<CardDescription className="mt-1">
							Connector activity and account reach
						</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 bg-muted/30">
						<MegaphoneIcon aria-hidden="true" />
						Meta + TikTok
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="grid grid-cols-1 border-b sm:grid-cols-2 sm:divide-x">
					<div className="flex items-center gap-3 px-5 py-5">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
							<UsersRoundIcon aria-hidden="true" className="size-4" />
						</span>
						<div>
							<div className="flex items-center gap-1">
								<p className="text-muted-foreground text-xs">
									Users with connected ads accounts
								</p>
								<MetricInfoTooltip
									label="Users with connected ads accounts"
									content="Distinct users with a currently valid Meta Ads or TikTok Ads connection."
								/>
							</div>
							<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
								{formatOverviewWholeNumber(ads.connectedUsers)}
							</p>
						</div>
					</div>
					<div className="px-5 py-5">
						<p className="text-muted-foreground text-xs">Share of all users</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">
							{formatNullableAnalyticsMetric(
								ads.connectedPct,
								formatOverviewPercentValue,
							)}
						</p>
						<p className="mt-1 text-muted-foreground text-xs tabular-nums">
							{formatOverviewWholeNumber(ads.connectedUsers)} of{" "}
							{formatOverviewWholeNumber(ads.totalUsers)} users
						</p>
					</div>
				</div>

				<div className="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2">
					<AdsOperationSummary
						label="Analysis"
						description="Read-only reporting and insight runs"
						operation={ads.analysis}
						icon={ChartNoAxesCombinedIcon}
					/>
					<AdsOperationSummary
						label="Launch"
						description="Campaign-changing provider runs"
						operation={ads.launch}
						icon={RocketIcon}
					/>
				</div>
			</CardContent>

			<div className="border-t bg-muted/20 px-5 py-3 text-muted-foreground text-xs leading-relaxed">
				Events and users count successful provider runs in the selected range;
				the error rate also includes failed runs. Connected accounts are a
				point-in-time snapshot.
			</div>
		</Card>
	);
}

export type { AdsAnalyticsCardProps };
export { AdsAnalyticsCard };

import { ActivityIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import type {
	OverviewQuery,
	OverviewSnapshot,
} from "@/features/overview/api/overview.dto";
import { useOverviewQuery } from "@/features/overview/api/overview.queries";
import { GenerationHealthCard } from "@/features/overview/components/generation-health-card";
import { GrowthTrendCard } from "@/features/overview/components/growth-trend-card";
import { ModelUsageCard } from "@/features/overview/components/model-usage-card";
import { OverviewHeader } from "@/features/overview/components/overview-header";
import { OverviewMetrics } from "@/features/overview/components/overview-metrics";
import { OverviewPageSkeleton } from "@/features/overview/components/overview-page-skeleton";
import { RevenuePerformanceCard } from "@/features/overview/components/revenue-performance-card";

type OverviewPageProps = {
	query: OverviewQuery;
	onQueryChange: (query: OverviewQuery) => void;
};

function OverviewErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<Empty className="min-h-[480px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ActivityIcon />
				</EmptyMedia>
				<EmptyTitle>Overview could not be loaded</EmptyTitle>
				<EmptyDescription>
					The platform snapshot did not respond. Retry to restore the dashboard.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button type="button" onClick={onRetry}>
					<RefreshCwIcon data-icon="inline-start" />
					Retry
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function OverviewEmptyState() {
	return (
		<Empty className="min-h-[480px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ActivityIcon />
				</EmptyMedia>
				<EmptyTitle>No activity in this range</EmptyTitle>
				<EmptyDescription>
					Choose a longer reporting period to inspect revenue, usage, and
					generation activity.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function hasOverviewActivity(snapshot: OverviewSnapshot) {
	const { generation, healthyTrials, mrrMinor, revenue, totals } = snapshot;
	const periodStart = Date.parse(`${snapshot.periodStart}T00:00:00.000Z`);
	const periodEnd = Date.parse(`${snapshot.periodEnd}T23:59:59.999Z`);
	const hasSignalInPeriod = snapshot.recentSignals.some(({ occurredAt }) => {
		const occurredAtMs = Date.parse(occurredAt);

		return occurredAtMs >= periodStart && occurredAtMs <= periodEnd;
	});

	return (
		hasSignalInPeriod ||
		[
			revenue.totalUsdMinor,
			mrrMinor,
			healthyTrials.count,
			totals.tokensUsed,
			totals.tokenCostUsdMinor,
			totals.websitesGenerated,
			totals.assetsGenerated,
			totals.imagesGenerated,
			totals.signups,
			totals.activeUsers,
			generation.attempts,
		].some((value) => value > 0)
	);
}

function OverviewPage({ query, onQueryChange }: OverviewPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useOverviewQuery(query);

	const hasActivity = data ? hasOverviewActivity(data) : false;

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Overview snapshot refreshed");
			return;
		}

		toast.error("Overview snapshot could not be refreshed");
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] space-y-5">
			<OverviewHeader
				query={query}
				generatedAt={data?.generatedAt}
				isRefreshing={isFetching}
				onQueryChange={onQueryChange}
				onRefresh={() => void handleRefresh()}
			/>

			{isPending ? (
				<OverviewPageSkeleton />
			) : isError || !data ? (
				<OverviewErrorState onRetry={() => void refetch()} />
			) : !hasActivity ? (
				<OverviewEmptyState />
			) : (
				<>
					<OverviewMetrics snapshot={data} />

					<section
						aria-label="Revenue and model usage"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-8">
							<RevenuePerformanceCard
								revenue={data.revenue}
								points={data.revenueSeries}
								rangeLabel={data.rangeLabel}
							/>
						</div>
						{/* From lg the model card fills the row height set by the revenue
						    card instead of setting it: its long model list scrolls inside
						    the card, so the revenue card never stretches around it. */}
						<div className="relative min-w-0 lg:col-span-4">
							<div className="min-w-0 lg:absolute lg:inset-0">
								<ModelUsageCard models={data.modelUsage} />
							</div>
						</div>
					</section>

					<section
						aria-label="Growth and generation health"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-7">
							<GrowthTrendCard
								points={data.growthSeries}
								totals={data.totals}
								rangeLabel={data.rangeLabel}
							/>
						</div>
						<div className="min-w-0 lg:col-span-5">
							<GenerationHealthCard
								generation={data.generation}
								points={data.generationSeries}
								signals={data.recentSignals}
								generatedAt={data.generatedAt}
							/>
						</div>
					</section>
				</>
			)}
		</div>
	);
}

export type { OverviewPageProps };
export { OverviewPage };

import { ActivityIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
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
import type { OverviewRange } from "@/features/overview/api/overview.dto";
import { useOverviewQuery } from "@/features/overview/api/overview.queries";
import { GenerationHealthCard } from "@/features/overview/components/generation-health-card";
import { GrowthTrendCard } from "@/features/overview/components/growth-trend-card";
import { ModelUsageCard } from "@/features/overview/components/model-usage-card";
import { OverviewHeader } from "@/features/overview/components/overview-header";
import { OverviewMetrics } from "@/features/overview/components/overview-metrics";
import { OverviewPageSkeleton } from "@/features/overview/components/overview-page-skeleton";
import { RevenuePerformanceCard } from "@/features/overview/components/revenue-performance-card";

function OverviewErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<Empty className="min-h-[480px] border bg-background">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ActivityIcon />
				</EmptyMedia>
				<EmptyTitle>Overview could not be loaded</EmptyTitle>
				<EmptyDescription>
					The mock platform snapshot did not respond. Retry to restore the
					dashboard.
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

function OverviewPage() {
	const [range, setRange] = useState<OverviewRange>("30d");
	const { data, isError, isFetching, isPending, refetch } =
		useOverviewQuery(range);

	const hasActivity = Boolean(
		data &&
			(data.revenueSeries.length > 0 ||
				data.growthSeries.length > 0 ||
				data.generationSeries.length > 0),
	);

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
				range={range}
				generatedAt={data?.generatedAt}
				isRefreshing={isFetching}
				onRangeChange={setRange}
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
						className="grid items-stretch gap-5 xl:grid-cols-12"
					>
						<div className="min-w-0 xl:col-span-8">
							<RevenuePerformanceCard
								revenue={data.revenue}
								points={data.revenueSeries}
								rangeLabel={data.rangeLabel}
							/>
						</div>
						<div className="min-w-0 xl:col-span-4">
							<ModelUsageCard models={data.modelUsage} />
						</div>
					</section>

					<section
						aria-label="Growth and generation health"
						className="grid items-stretch gap-5 xl:grid-cols-12"
					>
						<div className="min-w-0 xl:col-span-7">
							<GrowthTrendCard
								points={data.growthSeries}
								totals={data.totals}
								rangeLabel={data.rangeLabel}
							/>
						</div>
						<div className="min-w-0 xl:col-span-5">
							<GenerationHealthCard
								generation={data.generation}
								points={data.generationSeries}
								generatedAt={data.generatedAt}
							/>
						</div>
					</section>
				</>
			)}
		</div>
	);
}

export { OverviewPage };

import { FunnelIcon } from "lucide-react";
import { toast } from "sonner";

import type {
	AnalyticsFunnelResponse,
	AnalyticsQuery,
} from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsFunnelQuery } from "@/features/analytics/api/analytics.queries";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import { FunnelDurationCards } from "@/features/analytics/components/funnel-duration-cards";
import { FunnelStepVisualization } from "@/features/analytics/components/funnel-step-visualization";

type FunnelAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

function hasFunnelActivity(data: AnalyticsFunnelResponse) {
	return (
		data.steps.some((step) => step.count !== null && step.count > 0) ||
		data.durations.signupToFirstAction.users > 0 ||
		data.durations.signupToFirstGeneration.users > 0
	);
}

function FunnelAnalyticsPage({
	query,
	onQueryChange,
}: FunnelAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsFunnelQuery(query);
	const hasActiveFilters = Boolean(
		query.source || query.country || query.device,
	);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Funnel analytics refreshed");
			return;
		}

		toast.error("Funnel analytics could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="Funnel"
				description="Follow a signup cohort from tracked traffic through product use and payment."
				query={query}
				filterMode="standard"
				updatedAt={data?.updatedAt}
				isRefreshing={isFetching}
				onQueryChange={onQueryChange}
				onRefresh={() => void handleRefresh()}
			/>

			{isPending ? (
				<AnalyticsPageSkeleton metricCount={4} />
			) : isError || !data ? (
				<AnalyticsPageState
					icon={FunnelIcon}
					title="Funnel analytics could not be loaded"
					description="Traffic and signup-cohort data did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasFunnelActivity(data) && !hasActiveFilters ? (
				<AnalyticsPageState
					icon={FunnelIcon}
					title="No funnel activity in this range"
					description="Tracked traffic and signup-cohort milestones will appear after people visit and create accounts."
				/>
			) : (
				<>
					<FunnelStepVisualization
						steps={data.steps}
						hasActiveFilters={hasActiveFilters}
					/>
					<FunnelDurationCards durations={data.durations} />
				</>
			)}
		</div>
	);
}

export type { FunnelAnalyticsPageProps };
export { FunnelAnalyticsPage };

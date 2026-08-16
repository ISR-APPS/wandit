import { MegaphoneIcon } from "lucide-react";
import { toast } from "sonner";

import type {
	AnalyticsAcquisitionResponse,
	AnalyticsQuery,
} from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsAcquisitionQuery } from "@/features/analytics/api/analytics.queries";
import { AcquisitionAnalyticsTables } from "@/features/analytics/components/acquisition-analytics-tables";
import { AcquisitionCostMetrics } from "@/features/analytics/components/acquisition-cost-metrics";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";

type AcquisitionAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

function hasAcquisitionActivity(
	data: AnalyticsAcquisitionResponse,
	hasActiveAttributionFilters = false,
) {
	return (
		hasActiveAttributionFilters ||
		!data.costCoverageComplete ||
		[data.adSpendCents, data.cacCents].some(
			(value) => value !== null && value > 0,
		) ||
		data.unattributed.signups > 0 ||
		data.sources.some((source) =>
			[
				source.signups,
				source.activated,
				source.paid,
				source.signupToPaidPct,
				source.mrrCents,
				source.adSpendCents,
				source.cacCents,
			].some((value) => value !== null && value > 0),
		) ||
		data.campaigns.some((campaign) =>
			[campaign.signups, campaign.paid, campaign.mrrCents].some(
				(value) => value > 0,
			),
		) ||
		data.countries.some((country) =>
			[country.signups, country.paid].some((value) => value > 0),
		)
	);
}

function AcquisitionAnalyticsPage({
	query,
	onQueryChange,
}: AcquisitionAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsAcquisitionQuery(query);
	const hasActiveAttributionFilters = Boolean(
		query.source || query.country || query.device,
	);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Acquisition analytics refreshed");
			return;
		}

		toast.error("Acquisition analytics could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="Acquisition"
				description="See which sources, campaigns, and countries bring people from signup to paid."
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
					icon={MegaphoneIcon}
					title="Acquisition analytics could not be loaded"
					description="Signup attribution data did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasAcquisitionActivity(data, hasActiveAttributionFilters) ? (
				<AnalyticsPageState
					icon={MegaphoneIcon}
					title="No acquisition activity in this range"
					description="Sources, campaigns, countries, and paid conversion will appear after people sign up."
				/>
			) : (
				<>
					<AcquisitionCostMetrics
						adSpendCents={data.adSpendCents}
						cacCents={data.cacCents}
						costCoverageComplete={data.costCoverageComplete}
						unattributedSignups={data.unattributed.signups}
						hasActiveAttributionFilters={hasActiveAttributionFilters}
					/>
					<AcquisitionAnalyticsTables
						sources={data.sources}
						campaigns={data.campaigns}
						countries={data.countries}
						costCoverageComplete={data.costCoverageComplete}
						hasActiveAttributionFilters={hasActiveAttributionFilters}
					/>
				</>
			)}
		</div>
	);
}

export type { AcquisitionAnalyticsPageProps };
export { AcquisitionAnalyticsPage, hasAcquisitionActivity };

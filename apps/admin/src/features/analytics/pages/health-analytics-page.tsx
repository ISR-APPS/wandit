import {
	ActivityIcon,
	CircleCheckBigIcon,
	HeartPulseIcon,
	RotateCcwIcon,
	WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";

import type {
	AnalyticsHealthResponse,
	AnalyticsQuery,
} from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsHealthQuery } from "@/features/analytics/api/analytics.queries";
import { AnalyticsMetricStrip } from "@/features/analytics/components/analytics-metric-strip";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import { GenerationHealthTable } from "@/features/analytics/components/generation-health-table";
import { SentryLinksCard } from "@/features/analytics/components/sentry-links-card";
import { TopFailuresCard } from "@/features/analytics/components/top-failures-card";
import { WebhookStatusCard } from "@/features/analytics/components/webhook-status-card";
import {
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { formatCreditAmount } from "@/lib/credit-format";

type HealthAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

function hasHealthActivity(snapshot: AnalyticsHealthResponse) {
	return (
		snapshot.creditsRefundedInRange > 0 ||
		Object.values(snapshot.webhooks).some((count) => count > 0) ||
		snapshot.generation.some(
			(item) =>
				item.attempts > 0 ||
				item.topFailures.some((failure) => failure.count > 0),
		)
	);
}

function HealthAnalyticsContent({ data }: { data: AnalyticsHealthResponse }) {
	const totalAttempts = data.generation.reduce(
		(total, item) => total + item.attempts,
		0,
	);
	const weightedSuccessPct =
		totalAttempts > 0
			? data.generation.reduce(
					(total, item) => total + item.attempts * item.successPct,
					0,
				) / totalAttempts
			: 0;

	return (
		<>
			<AnalyticsMetricStrip
				label="Health headline metrics"
				metrics={[
					{
						key: "attempts",
						label: "Generation attempts",
						tooltip:
							"AI generation jobs that finished successfully or failed during the selected range.",
						value: formatOverviewWholeNumber(totalAttempts),
						description: "Across all generation sources",
						icon: ActivityIcon,
					},
					{
						key: "success",
						label: "Weighted success",
						tooltip:
							"Overall share of generation attempts that succeeded. Features with more attempts affect this number more.",
						value:
							totalAttempts > 0
								? formatOverviewPercentValue(weightedSuccessPct)
								: "—",
						description: "Weighted by attempt volume",
						icon: CircleCheckBigIcon,
					},
					{
						key: "webhooks",
						label: "Webhooks received",
						tooltip:
							"Billing messages received from our payment provider during the selected range.",
						value: formatOverviewWholeNumber(data.webhooks.received),
						description: "Billing events in selected range",
						icon: WebhookIcon,
					},
					{
						key: "refunds",
						label: "Credits refunded",
						tooltip:
							"Total credits returned to users after failed AI work during the selected range.",
						value: formatCreditAmount(data.creditsRefundedInRange),
						description: "Returned after failed AI work",
						icon: RotateCcwIcon,
					},
				]}
			/>

			<section
				aria-label="Generation and billing health"
				className="grid items-start gap-5 lg:grid-cols-12"
			>
				<div className="min-w-0 lg:col-span-8">
					<GenerationHealthTable generation={data.generation} />
				</div>
				<div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
					<TopFailuresCard generation={data.generation} />
					<WebhookStatusCard webhooks={data.webhooks} />
				</div>
			</section>
		</>
	);
}

function HealthAnalyticsPage({
	query,
	onQueryChange,
}: HealthAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsHealthQuery(query);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Health analytics refreshed");
			return;
		}

		toast.error("Health analytics could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="System health"
				description="Generation reliability, latency, refunds, and billing webhook outcomes."
				query={query}
				updatedAt={data?.updatedAt}
				isRefreshing={isFetching}
				onQueryChange={onQueryChange}
				onRefresh={() => void handleRefresh()}
			/>

			{isPending ? (
				<AnalyticsPageSkeleton metricCount={4} />
			) : isError || !data ? (
				<AnalyticsPageState
					icon={HeartPulseIcon}
					title="Health analytics could not be loaded"
					description="Generation and billing health did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasHealthActivity(data) ? (
				<AnalyticsPageState
					icon={HeartPulseIcon}
					title="No health activity in this range"
					description="Generation attempts, latency, failure codes, credit refunds, and webhook outcomes will appear here."
				/>
			) : (
				<HealthAnalyticsContent data={data} />
			)}

			<SentryLinksCard />
		</div>
	);
}

export type { HealthAnalyticsPageProps };
export { HealthAnalyticsPage };

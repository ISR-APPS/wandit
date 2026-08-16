import {
	ActivityIcon,
	CalendarDaysIcon,
	CalendarRangeIcon,
	DatabaseIcon,
	GaugeIcon,
	Repeat2Icon,
	SparklesIcon,
	UserRoundCheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MetricInfoTooltip } from "@/components/metric-info-tooltip";
import type {
	AnalyticsEngagementResponse,
	AnalyticsQuery,
} from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsEngagementQuery } from "@/features/analytics/api/analytics.queries";
import { AnalyticsMetricStrip } from "@/features/analytics/components/analytics-metric-strip";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import {
	DailyActiveUsersCard,
	HealthyTrialsByDayCard,
} from "@/features/analytics/components/engagement-activity-cards";
import {
	RetentionCohortHeatmap,
	ReturningUsersCard,
} from "@/features/analytics/components/engagement-retention-cards";
import {
	hasNonZeroAnalyticsValue,
	mapEngagementDailyChartData,
} from "@/features/analytics/lib/analytics-data";
import {
	formatOverviewCompactNumber,
	formatOverviewPercentValue,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";

type EngagementAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

const activityScopeTooltip =
	"Activity metrics count individual authenticated users. Feature adoption counts billing owners, where an organization and its members count as one owner.";

function hasEngagementActivity(snapshot: AnalyticsEngagementResponse) {
	const { activity, returning } = snapshot;

	return hasNonZeroAnalyticsValue([
		activity.dau,
		activity.wau,
		activity.mau,
		activity.dauMauPct,
		activity.avgActiveDaysPerUser,
		activity.avgActionsPerUser,
		activity.activeFreeTrialUsers,
		returning.d1Pct,
		returning.d3Pct,
		returning.d7Pct,
		returning.d14Pct,
		returning.d30Pct,
		...snapshot.activityByDay.map((point) => point.activeUsers),
		...snapshot.healthyTrialsByDay.map((point) => point.count),
		...snapshot.cohorts.flatMap((cohort) => [cohort.size, ...cohort.weeks]),
	]);
}

function EngagementAnalyticsContent({
	data,
}: {
	data: AnalyticsEngagementResponse;
}) {
	const dailyChartData = mapEngagementDailyChartData(
		data.activityByDay,
		data.healthyTrialsByDay,
	);

	return (
		<>
			<AnalyticsMetricStrip
				label="Engagement headline metrics"
				metrics={[
					{
						key: "dau",
						label: "DAU",
						tooltip: `Distinct users active on the final complete UTC day in the selected range. ${activityScopeTooltip}`,
						value: formatOverviewWholeNumber(data.activity.dau),
						description: "Daily active users at range end",
						icon: ActivityIcon,
					},
					{
						key: "wau",
						label: "WAU",
						tooltip: `Distinct users active in the seven days ending at the selected range end. ${activityScopeTooltip}`,
						value: formatOverviewWholeNumber(data.activity.wau),
						description: "Seven-day active users",
						icon: CalendarDaysIcon,
					},
					{
						key: "mau",
						label: "MAU",
						tooltip: `Distinct users active in the 30 days ending at the selected range end. ${activityScopeTooltip}`,
						value: formatOverviewWholeNumber(data.activity.mau),
						description: "30-day active users",
						icon: CalendarRangeIcon,
					},
					{
						key: "dau-mau",
						label: "DAU / MAU",
						tooltip:
							"Daily active users divided by monthly active users at the selected range end. This indicates how often monthly users return on a typical day.",
						value: formatOverviewPercentValue(data.activity.dauMauPct),
						description: "Daily stickiness at range end",
						icon: GaugeIcon,
					},
					{
						key: "average-active-days",
						label: "Avg. active days",
						tooltip:
							"Average number of distinct UTC days each active user appeared during the selected range.",
						value: formatOverviewCompactNumber(
							data.activity.avgActiveDaysPerUser,
						),
						description: "Days per active user in range",
						icon: Repeat2Icon,
					},
					{
						key: "average-actions",
						label: "Avg actions / user",
						tooltip: "Metered AI operations per active user in the range",
						value: formatOverviewCompactNumber(data.activity.avgActionsPerUser),
						description: "AI operations per active user",
						icon: SparklesIcon,
					},
					{
						key: "active-free-trials",
						label: "Active free trials",
						tooltip:
							"Users active during the selected range who did not have a paid subscription by the range end.",
						value: formatOverviewWholeNumber(
							data.activity.activeFreeTrialUsers,
						),
						description: "Active users without a paid plan",
						icon: UserRoundCheckIcon,
					},
				]}
			/>

			<section
				aria-label="Daily activity and healthy trials"
				className="grid items-stretch gap-5 lg:grid-cols-12"
			>
				<div className="min-w-0 lg:col-span-8">
					<DailyActiveUsersCard points={dailyChartData} />
				</div>
				<div className="min-w-0 lg:col-span-4">
					<HealthyTrialsByDayCard points={dailyChartData} />
				</div>
			</section>

			<ReturningUsersCard returning={data.returning} />
			<RetentionCohortHeatmap cohorts={data.cohorts} />
		</>
	);
}

function EngagementAnalyticsPage({
	query,
	onQueryChange,
}: EngagementAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsEngagementQuery(query);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Engagement analytics refreshed");
			return;
		}

		toast.error("Engagement analytics could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="Engagement"
				description="Daily activity, returning users, and weekly retention after signup."
				query={query}
				filterMode="engagement"
				updatedAt={data?.updatedAt}
				isRefreshing={isFetching}
				onQueryChange={onQueryChange}
				onRefresh={() => void handleRefresh()}
			/>

			{isPending ? (
				<AnalyticsPageSkeleton metricCount={7} />
			) : isError || !data ? (
				<AnalyticsPageState
					icon={ActivityIcon}
					title="Engagement analytics could not be loaded"
					description="Activity and retention data did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasEngagementActivity(data) ? (
				<AnalyticsPageState
					icon={ActivityIcon}
					title="No tracked engagement in this range yet"
					description="Daily activity, returning users, and healthy trials will appear after authenticated users return."
				/>
			) : (
				<EngagementAnalyticsContent data={data} />
			)}

			<footer className="flex items-start gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-muted-foreground text-xs leading-relaxed">
				<DatabaseIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
				<div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
					<span>Activity tracking started 2026-08-15</span>
					<MetricInfoTooltip
						label="Activity metric scope"
						content={activityScopeTooltip}
					/>
				</div>
			</footer>
		</div>
	);
}

export type { EngagementAnalyticsPageProps };
export { EngagementAnalyticsPage };

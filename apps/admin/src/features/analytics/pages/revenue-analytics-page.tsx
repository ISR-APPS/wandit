import { ChartNoAxesCombinedIcon } from "lucide-react";
import { toast } from "sonner";

import type {
	AnalyticsQuery,
	AnalyticsRevenueResponse,
} from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsRevenueQuery } from "@/features/analytics/api/analytics.queries";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import { ChurnBreakdownCard } from "@/features/analytics/components/churn-breakdown-card";
import { ChurnCard } from "@/features/analytics/components/churn-card";
import { CollectedRevenueCard } from "@/features/analytics/components/collected-revenue-card";
import {
	CheckoutFunnelCard,
	DaysToConvertCard,
} from "@/features/analytics/components/conversion-analytics-cards";
import { MarginAfterAiCard } from "@/features/analytics/components/margin-after-ai-card";
import { MrrBreakdownCard } from "@/features/analytics/components/mrr-breakdown-card";
import { NetRevenueCard } from "@/features/analytics/components/net-revenue-card";
import { RevenueMetrics } from "@/features/analytics/components/revenue-metrics";
import { RevenueRetentionCard } from "@/features/analytics/components/revenue-retention-card";
import { RevenueSourcesCard } from "@/features/analytics/components/revenue-sources-card";
import { UnitEconomicsCard } from "@/features/analytics/components/unit-economics-card";
import { hasNonZeroAnalyticsValue } from "@/features/analytics/lib/analytics-data";
import { hasRevenueHistoryActivity } from "@/features/analytics/lib/revenue-history-data";

type RevenueAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

function hasRevenueActivity(data: AnalyticsRevenueResponse) {
	const { checkoutFunnel, tiles } = data;

	return (
		!data.unitEconomics.costCoverageComplete ||
		hasNonZeroAnalyticsValue([
			tiles.mrrMinor,
			tiles.arpuMinor,
			tiles.activePaidUsers,
			tiles.newPaidUsersInRange,
			tiles.trialToPaidPctAllTime,
			tiles.healthyTrials.count,
			tiles.healthyTrials.pctOfTrials,
			tiles.healthyTrials.healthyToPaidPct,
			tiles.healthyTrials.nonHealthyToPaidPct,
			checkoutFunnel.started,
			checkoutFunnel.completed,
			data.churn.customerChurnPct,
			data.churn.mrrChurnPct,
			data.churn.churnedMrrCents,
			data.churn.netNewMrrCents,
			data.churn.upgrades,
			data.churn.downgrades,
			data.churn.ltvCents,
			data.netRevenue.grossCents,
			data.netRevenue.refundsCents,
			data.netRevenue.netCents,
			data.netRevenue.failedPayments,
			data.netRevenue.failedPaymentsCents,
			data.revenueBySource.subscriptionsCents,
			data.revenueBySource.domainsCents,
			data.revenueBySource.domainOrders,
			data.revenueBySource.domainCostCents,
			data.unitEconomics.adSpendCents,
			data.unitEconomics.infrastructureCostCents,
			data.unitEconomics.otherCostCents,
			data.unitEconomics.totalCostCents,
			data.unitEconomics.cacCents,
			data.unitEconomics.ltvCacRatio,
			data.unitEconomics.grossMarginPct,
			data.unitEconomics.cacPaybackMonths,
			data.unitEconomics.costPerFreeActiveUserCents,
			data.unitEconomics.costPerHealthyTrialCents,
			data.unitEconomics.costPerActivePaidUserCents,
			...data.arpuByPlan.map((item) => item.arpuCents),
			...data.marginAfterAi.flatMap((row) => [
				row.revenueCents,
				row.aiCostCents,
			]),
			...data.mrrByPlan.flatMap((item) => [item.subscribers, item.mrrMinor]),
			...data.collectedRevenueByDay.flatMap((point) => [
				point.subscriptionsMinor,
				point.ordersMinor,
			]),
			...data.newPaidByDay.map((point) => point.count),
			...data.daysToConvert.map((point) => point.count),
		]) ||
		hasRevenueHistoryActivity(data) ||
		data.churnBreakdown.byReason.some((row) => row.churned > 0)
	);
}

function RevenueAnalyticsPage({
	query,
	onQueryChange,
}: RevenueAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsRevenueQuery(query);

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Revenue analytics refreshed");
			return;
		}

		toast.error("Revenue analytics could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="Revenue"
				description="Recurring revenue, collections, retention, and the path from trial to paid."
				query={query}
				updatedAt={data?.updatedAt}
				isRefreshing={isFetching}
				onQueryChange={onQueryChange}
				onRefresh={() => void handleRefresh()}
			/>

			{isPending ? (
				<AnalyticsPageSkeleton />
			) : isError || !data ? (
				<AnalyticsPageState
					icon={ChartNoAxesCombinedIcon}
					title="Revenue analytics could not be loaded"
					description="Billing and conversion data did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasRevenueActivity(data) ? (
				<AnalyticsPageState
					icon={ChartNoAxesCombinedIcon}
					title="No revenue activity in this range yet"
					description="MRR, collections, subscription movement, refunds, paid conversions, and checkout activity will appear here when billing starts."
				/>
			) : (
				<>
					<RevenueMetrics tiles={data.tiles} />

					<section aria-label="Revenue unit economics" className="min-w-0">
						<UnitEconomicsCard unitEconomics={data.unitEconomics} />
					</section>

					<section aria-label="Margin after AI by plan" className="min-w-0">
						<MarginAfterAiCard marginAfterAi={data.marginAfterAi} />
					</section>

					<section
						aria-label="Revenue collection and recurring revenue mix"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-8">
							<CollectedRevenueCard points={data.collectedRevenueByDay} />
						</div>
						<div className="min-w-0 lg:col-span-4">
							<MrrBreakdownCard
								items={data.mrrByPlan}
								arpuByPlan={data.arpuByPlan}
							/>
						</div>
					</section>

					<section aria-label="Revenue by source" className="min-w-0">
						<RevenueSourcesCard revenueBySource={data.revenueBySource} />
					</section>

					<section
						aria-label="Revenue retention and payment adjustments"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-7">
							<ChurnCard churn={data.churn} />
						</div>
						<div className="min-w-0 lg:col-span-5">
							<NetRevenueCard netRevenue={data.netRevenue} />
						</div>
					</section>

					<section
						aria-label="Paid and revenue retention cohorts"
						className="min-w-0"
					>
						<RevenueRetentionCard retention={data.retention} />
					</section>

					<section aria-label="Churn breakdowns" className="min-w-0">
						<ChurnBreakdownCard breakdown={data.churnBreakdown} />
					</section>

					<section
						aria-label="Paid conversion timing and checkout funnel"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-7">
							<DaysToConvertCard points={data.daysToConvert} />
						</div>
						<div className="min-w-0 lg:col-span-5">
							<CheckoutFunnelCard
								funnel={data.checkoutFunnel}
								newPaidByDay={data.newPaidByDay}
							/>
						</div>
					</section>
				</>
			)}
		</div>
	);
}

export type { RevenueAnalyticsPageProps };
export { RevenueAnalyticsPage };

import type { AdminAnalyticsFeaturesResponse } from "@wandit/contracts";
import {
	ActivityIcon,
	CoinsIcon,
	UserRoundPlusIcon,
	UsersRoundIcon,
	WalletCardsIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { AnalyticsQuery } from "@/features/analytics/api/analytics.dto";
import { useAdminAnalyticsFeaturesQuery } from "@/features/analytics/api/analytics.queries";
import { AdsAnalyticsCard } from "@/features/analytics/components/ads-analytics-card";
import { AnalyticsMetricStrip } from "@/features/analytics/components/analytics-metric-strip";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-page-header";
import { AnalyticsPageSkeleton } from "@/features/analytics/components/analytics-page-skeleton";
import { AnalyticsPageState } from "@/features/analytics/components/analytics-page-state";
import { CreditConsumptionCard } from "@/features/analytics/components/credit-consumption-card";
import { CreditEconomicsCard } from "@/features/analytics/components/credit-economics-card";
import {
	ConversionByCreditsCard,
	FreeCreditsCard,
} from "@/features/analytics/components/credits-rider-cards";
import { FeatureAdoptionTable } from "@/features/analytics/components/features-adoption-table";
import {
	formatOverviewCompactNumber,
	formatOverviewWholeNumber,
} from "@/features/overview/lib/formatters";
import { formatCreditAmount } from "@/lib/credit-format";

type FeaturesAnalyticsPageProps = {
	query: AnalyticsQuery;
	onQueryChange: (query: AnalyticsQuery) => void;
};

function hasFeaturesActivity(snapshot: AdminAnalyticsFeaturesResponse) {
	const { ads, conversionByCredits, credits, features, freeCredits } = snapshot;

	return (
		snapshot.activeUsersInRange > 0 ||
		ads.connectedUsers > 0 ||
		ads.analysis.events > 0 ||
		ads.analysis.users > 0 ||
		ads.analysis.errorRatePct !== null ||
		ads.launch.events > 0 ||
		ads.launch.users > 0 ||
		ads.launch.errorRatePct !== null ||
		features.some((feature) => feature.users > 0 || feature.uses > 0) ||
		credits.consumptionBuckets.some((bucket) => bucket.users > 0) ||
		conversionByCredits.some(
			(point) => point.owners > 0 || point.paidOwners > 0,
		) ||
		freeCredits.measuredUsers > 0 ||
		[
			credits.grantedInRange,
			credits.consumedInRange,
			credits.avgConsumedPerFreeUser,
			credits.avgConsumedPerPaidUser,
			credits.usersAtZeroBalance,
			credits.avgCreditsBeforeUpgrade,
			credits.providerCostPerCreditMicros,
		].some((value) => value > 0)
	);
}

function FeaturesAnalyticsPage({
	query,
	onQueryChange,
}: FeaturesAnalyticsPageProps) {
	const { data, isError, isFetching, isPending, refetch } =
		useAdminAnalyticsFeaturesQuery(query);
	const hasActivity = data ? hasFeaturesActivity(data) : false;

	async function handleRefresh() {
		const result = await refetch();

		if (result.isSuccess) {
			toast.success("Features and credits refreshed");
			return;
		}

		toast.error("Features and credits could not be refreshed");
	}

	return (
		<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
			<AnalyticsPageHeader
				eyebrow="Founder analytics"
				title="Features & credits"
				description="See which product workflows people use and how credits move through the business."
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
					icon={ActivityIcon}
					title="Feature analytics could not be loaded"
					description="Usage and credit data did not respond. Retry to restore this report."
					onRetry={() => void refetch()}
				/>
			) : !hasActivity ? (
				<>
					<AnalyticsPageState
						icon={CoinsIcon}
						title="No feature or credit activity in this range"
						description="Adoption, credit consumption, and upgrade economics will appear after users begin creating."
					/>
					<AdsAnalyticsCard ads={data.ads} />
				</>
			) : (
				<>
					<AnalyticsMetricStrip
						label="Feature and credit headline metrics"
						metrics={[
							{
								key: "active-users",
								label: "Active users",
								tooltip:
									"Users who performed at least one AI operation during the selected range.",
								value: formatOverviewWholeNumber(data.activeUsersInRange),
								description: "AI activity in selected range",
								icon: UsersRoundIcon,
							},
							{
								key: "granted",
								label: "Credits granted",
								tooltip:
									"Total credits added to user balances as grants during the selected range.",
								value: formatCreditAmount(data.credits.grantedInRange),
								description: "Granted in selected range",
								icon: UserRoundPlusIcon,
							},
							{
								key: "consumed",
								label: "Credits consumed",
								tooltip:
									"Total credits spent on AI work during the selected range.",
								value: formatCreditAmount(data.credits.consumedInRange),
								description: "Used in the selected range",
								icon: CoinsIcon,
							},
							{
								key: "average-free",
								label: "Avg. free usage",
								tooltip:
									"Average credits used per free user who was active during the selected range.",
								value: formatOverviewCompactNumber(
									data.credits.avgConsumedPerFreeUser,
								),
								description: "Credits per active free user",
								icon: ActivityIcon,
							},
							{
								key: "average-paid",
								label: "Avg. paid usage",
								tooltip:
									"Average credits used per paying user who was active during the selected range.",
								value: formatOverviewCompactNumber(
									data.credits.avgConsumedPerPaidUser,
								),
								description: "Credits per active paid user",
								icon: WalletCardsIcon,
							},
							{
								key: "zero-balance",
								label: "Zero balance",
								tooltip: "Accounts with no credits available now.",
								value: formatOverviewWholeNumber(
									data.credits.usersAtZeroBalance,
								),
								description: "No credits available now",
								icon: CoinsIcon,
							},
						]}
					/>

					<AdsAnalyticsCard ads={data.ads} />

					<section
						aria-label="Credit consumption and economics"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-8">
							<CreditConsumptionCard
								buckets={data.credits.consumptionBuckets}
							/>
						</div>
						<div className="min-w-0 lg:col-span-4">
							<CreditEconomicsCard credits={data.credits} />
						</div>
					</section>

					<section
						aria-label="Free-credit runway and paid conversion"
						className="grid items-stretch gap-5 lg:grid-cols-12"
					>
						<div className="min-w-0 lg:col-span-4">
							<FreeCreditsCard freeCredits={data.freeCredits} />
						</div>
						<div className="min-w-0 lg:col-span-8">
							<ConversionByCreditsCard points={data.conversionByCredits} />
						</div>
					</section>

					<FeatureAdoptionTable
						features={data.features}
						activeUsersInRange={data.activeUsersInRange}
					/>
				</>
			)}
		</div>
	);
}

export type { FeaturesAnalyticsPageProps };
export { FeaturesAnalyticsPage };

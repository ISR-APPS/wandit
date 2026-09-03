import type { AdminAnalyticsRevenueResponse } from "@wandit/contracts";

type RevenueHistoryData = Pick<
	AdminAnalyticsRevenueResponse,
	"churnBreakdown" | "retention"
>;

export function getRevenueRetentionColumns(
	cohorts: AdminAnalyticsRevenueResponse["retention"]["cohorts"],
): number[] {
	const count = cohorts.reduce(
		(maximum, cohort) => Math.max(maximum, cohort.points.length),
		0,
	);

	return Array.from({ length: Math.min(count, 12) }, (_, index) => index);
}

export function orderRevenueRetentionCohorts(
	cohorts: AdminAnalyticsRevenueResponse["retention"]["cohorts"],
) {
	return [...cohorts].sort((left, right) =>
		right.cohortMonth.localeCompare(left.cohortMonth),
	);
}

export function hasRevenueHistoryActivity(data: RevenueHistoryData): boolean {
	return (
		data.retention.cohorts.some(
			(cohort) =>
				cohort.owners > 0 ||
				cohort.m0MrrCents > 0 ||
				cohort.points.some(
					(point) => point.paidPct > 0 || (point.revenuePct ?? 0) > 0,
				),
		) ||
		data.churnBreakdown.byPlan.some(
			(row) => row.churned > 0 || row.churnedMrrCents > 0,
		) ||
		data.churnBreakdown.bySource.some((row) => row.churned > 0) ||
		data.churnBreakdown.byReason.some((row) => row.churned > 0) ||
		data.churnBreakdown.byCountry.some((row) => row.churned > 0) ||
		data.churnBreakdown.byFeature.some((row) => row.churned > 0)
	);
}

export function hasChurnBreakdownRows(
	breakdown: AdminAnalyticsRevenueResponse["churnBreakdown"],
): boolean {
	return (
		breakdown.byPlan.length > 0 ||
		breakdown.bySource.length > 0 ||
		breakdown.byReason.length > 0 ||
		breakdown.byCountry.length > 0 ||
		breakdown.byFeature.length > 0
	);
}

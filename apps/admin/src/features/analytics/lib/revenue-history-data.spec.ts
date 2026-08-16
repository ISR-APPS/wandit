import type { AdminAnalyticsRevenueResponse } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	getRevenueRetentionColumns,
	hasChurnBreakdownRows,
	hasRevenueHistoryActivity,
	orderRevenueRetentionCohorts,
} from "./revenue-history-data";

const emptyBreakdown: AdminAnalyticsRevenueResponse["churnBreakdown"] = {
	byPlan: [],
	bySource: [],
	byReason: [],
	byCountry: [],
	byFeature: [],
};

describe("revenue retention presentation data", () => {
	it("builds at most M0 through M11 from the longest ragged cohort", () => {
		const cohorts = [
			{
				cohortMonth: "2026-08-01",
				owners: 2,
				m0MrrCents: 2_000,
				points: [{ paidPct: 100, revenuePct: 100 }],
			},
			{
				cohortMonth: "2026-07-01",
				owners: 3,
				m0MrrCents: 3_000,
				points: Array.from({ length: 14 }, () => ({
					paidPct: 50,
					revenuePct: 80,
				})),
			},
		];

		expect(getRevenueRetentionColumns(cohorts)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
		]);
		expect(
			orderRevenueRetentionCohorts(cohorts).map((row) => row.cohortMonth),
		).toEqual(["2026-08-01", "2026-07-01"]);
	});

	it("detects new history signals even when legacy revenue metrics are zero", () => {
		expect(
			hasRevenueHistoryActivity({
				retention: {
					cohorts: [
						{
							cohortMonth: "2026-07-01",
							owners: 1,
							m0MrrCents: 0,
							points: [{ paidPct: 0, revenuePct: null }],
						},
					],
				},
				churnBreakdown: emptyBreakdown,
			}),
		).toBe(true);

		expect(
			hasRevenueHistoryActivity({
				retention: { cohorts: [] },
				churnBreakdown: {
					...emptyBreakdown,
					byCountry: [{ country: "DZ", churned: 2 }],
				},
			}),
		).toBe(true);
	});

	it("distinguishes empty churn dimensions from populated rows", () => {
		expect(hasChurnBreakdownRows(emptyBreakdown)).toBe(false);
		expect(
			hasChurnBreakdownRows({
				...emptyBreakdown,
				byReason: [{ reason: "technical_issues", churned: 1 }],
			}),
		).toBe(true);
	});
});

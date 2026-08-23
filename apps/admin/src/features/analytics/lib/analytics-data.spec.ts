import {
	adminAnalyticsConsumptionBuckets,
	adminAnalyticsDaysToConvertBuckets,
	adminAnalyticsFeatureKeys,
	adminAnalyticsFunnelStepKeys,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { formatOverviewUsdMinor } from "@/features/overview/lib/formatters";

import {
	calculatePercentage,
	clampPercentage,
	featureAdoptionMetadata,
	formatAcquisitionSource,
	formatAnalyticsDays,
	formatAnalyticsDurationHours,
	formatNullableAnalyticsMetric,
	funnelStepMetadata,
	getConsumptionBucketLabel,
	getDaysToConvertBucketLabel,
	getRetentionHeatmapBucket,
	getRetentionHeatmapColumns,
	hasNonZeroAnalyticsValue,
	mapCollectedRevenueChartData,
	mapConsumptionChartData,
	mapConversionByCreditsChartData,
	mapDaysToConvertChartData,
	mapEngagementDailyChartData,
	orderFeatureAdoptionRows,
	orderFunnelSteps,
} from "./analytics-data";

describe("analytics presentation helpers", () => {
	it("renders null metrics as an em dash without hiding zero", () => {
		const formatter = (value: number) => `$${value}`;

		expect(formatNullableAnalyticsMetric(null, formatter)).toBe("—");
		expect(formatNullableAnalyticsMetric(0, formatter)).toBe("$0");
	});

	it("preserves cents and signed values in exact USD metrics", () => {
		expect(formatOverviewUsdMinor(49)).toBe("$0.49");
		expect(formatOverviewUsdMinor(-49)).toBe("-$0.49");
	});

	it("formats funnel hours as days at the 48-hour boundary", () => {
		expect(formatAnalyticsDurationHours(3.24)).toBe("3.2 h");
		expect(formatAnalyticsDurationHours(47)).toBe("47 h");
		expect(formatAnalyticsDurationHours(48)).toBe("2 d");
		expect(formatAnalyticsDurationHours(50.4)).toBe("2.1 d");
	});

	it("keeps nullable and invalid duration values safe", () => {
		expect(formatAnalyticsDurationHours(null)).toBe("—");
		expect(formatAnalyticsDurationHours(Number.NaN)).toBe("—");
		expect(formatAnalyticsDurationHours(-1)).toBe("—");
		expect(formatAnalyticsDays(null)).toBe("—");
		expect(formatAnalyticsDays(3.26)).toBe("3.3 d");
	});

	it("finds positive and negative analytics activity while ignoring nulls", () => {
		expect(hasNonZeroAnalyticsValue([null, 0, 0])).toBe(false);
		expect(hasNonZeroAnalyticsValue([null, Number.NaN, 0])).toBe(false);
		expect(hasNonZeroAnalyticsValue([0, 3])).toBe(true);
		expect(hasNonZeroAnalyticsValue([0, -25])).toBe(true);
	});

	it("labels the legacy unknown acquisition source explicitly", () => {
		expect(formatAcquisitionSource("unknown")).toBe(
			"Unknown — signed up before tracking",
		);
		expect(formatAcquisitionSource("organic_search")).toBe("Organic search");
		expect(formatAcquisitionSource("newsletter")).toBe("newsletter");
		expect(formatAcquisitionSource("__proto__")).toBe("__proto__");
		expect(formatAcquisitionSource("toString")).toBe("toString");
	});
});

describe("funnel presentation", () => {
	it("labels the Phase 3 pricing and upgrade steps as tracked milestones", () => {
		expect(funnelStepMetadata.visitor.label).toBe(
			"Tracked clicks (approximate)",
		);
		expect(funnelStepMetadata.pricingViewed.unavailableLabel).toBeUndefined();
		expect(funnelStepMetadata.upgradeClicked).toMatchObject({
			label: "Upgrade clicked",
			tooltip: expect.stringContaining("Phase 3 deploy onward"),
		});
	});

	it("keeps a recorded pricing view available in the funnel visualization", () => {
		expect(funnelStepMetadata.pricingViewed).toMatchObject({
			label: "Pricing viewed",
			tooltip: expect.stringContaining("viewed a pricing surface"),
		});
		expect(funnelStepMetadata.pricingViewed.unavailableLabel).toBeUndefined();
	});

	it("returns every step in canonical contract order", () => {
		const steps = [
			{ key: "paid" as const, count: 2, pctOfPrevious: 50 },
			{ key: "signup" as const, count: 10, pctOfPrevious: 25 },
		];

		const ordered = orderFunnelSteps(steps);

		expect(ordered.map((step) => step.key)).toEqual(
			adminAnalyticsFunnelStepKeys,
		);
		expect(ordered.find((step) => step.key === "pricingViewed")).toEqual({
			key: "pricingViewed",
			count: null,
			pctOfPrevious: null,
		});
		expect(ordered.find((step) => step.key === "upgradeClicked")).toEqual({
			key: "upgradeClicked",
			count: null,
			pctOfPrevious: null,
		});
	});
});

describe("engagement daily chart data", () => {
	it("sorts, combines, and zero-fills both UTC daily series", () => {
		expect(
			mapEngagementDailyChartData(
				[
					{ date: "2026-03-10", activeUsers: 2 },
					{ date: "2026-03-08", activeUsers: 4 },
					{ date: "2026-03-10", activeUsers: 3 },
				],
				[
					{ date: "2026-03-11", count: 1 },
					{ date: "2026-03-08", count: 2 },
				],
			),
		).toEqual([
			{ date: "2026-03-08", activeUsers: 4, healthyTrials: 2 },
			{ date: "2026-03-09", activeUsers: 0, healthyTrials: 0 },
			{ date: "2026-03-10", activeUsers: 5, healthyTrials: 0 },
			{ date: "2026-03-11", activeUsers: 0, healthyTrials: 1 },
		]);
	});

	it("returns an empty series when both inputs are empty", () => {
		expect(mapEngagementDailyChartData([], [])).toEqual([]);
	});
});

describe("retention heatmap helpers", () => {
	it("uses the longest cohort to build heatmap columns", () => {
		expect(
			getRetentionHeatmapColumns([
				{ cohortWeekStart: "2026-08-03", size: 4, weeks: [100] },
				{ cohortWeekStart: "2026-08-10", size: 5, weeks: [100, 40, 20] },
			]),
		).toEqual([0, 1, 2]);
		expect(getRetentionHeatmapColumns([])).toEqual([]);
	});

	it.each([
		{ value: undefined, expected: "unavailable" },
		{ value: 0, expected: "zero" },
		{ value: 0.1, expected: "low" },
		{ value: 24.9, expected: "low" },
		{ value: 25, expected: "medium" },
		{ value: 49.9, expected: "medium" },
		{ value: 50, expected: "high" },
		{ value: 74.9, expected: "high" },
		{ value: 75, expected: "strong" },
		{ value: 100, expected: "strong" },
	])("buckets $value retention as $expected", ({ value, expected }) => {
		expect(getRetentionHeatmapBucket(value)).toBe(expected);
	});
});

describe("feature adoption presentation", () => {
	it("keeps websites and landing pages adjacent in the canonical row order", () => {
		const features = adminAnalyticsFeatureKeys.map((key, index) => ({
			key,
			users: index,
			pctOfActiveUsers: index,
			uses: index,
			avgUsesPerUser: index,
			usersToPaidPct: index,
			convertedAfterUsePct: index,
		}));

		expect(orderFeatureAdoptionRows(features.toReversed())).toEqual(features);
		expect(adminAnalyticsFeatureKeys.slice(0, 2)).toEqual([
			"websites",
			"landingPages",
		]);
	});

	it("uses distinct labels and plain-English definitions for page features", () => {
		expect(featureAdoptionMetadata.websites).toMatchObject({
			label: "Websites",
			description: "Full multi-section sites",
			tooltip: "Websites are full multi-section sites.",
		});
		expect(featureAdoptionMetadata.landingPages).toMatchObject({
			label: "Landing pages",
			description: "Single-page cash-on-delivery style pages",
			tooltip: "Landing pages are single-page cash-on-delivery style pages.",
		});
	});
});

describe("analytics bucket labels", () => {
	it("uses clear labels for every days-to-convert bucket", () => {
		expect(
			adminAnalyticsDaysToConvertBuckets.map(getDaysToConvertBucketLabel),
		).toEqual([
			"Same day",
			"1 day",
			"2 days",
			"3 days",
			"4–5 days",
			"6–7 days",
			"8–14 days",
			"15+ days",
		]);
	});

	it("uses credit units for every consumption bucket", () => {
		expect(
			adminAnalyticsConsumptionBuckets.map(getConsumptionBucketLabel),
		).toEqual([
			"0 credits",
			"1–9 credits",
			"10–24 credits",
			"25–39 credits",
			"40–49 credits",
			"50+ credits",
		]);
	});
});

describe("analytics percentage helpers", () => {
	it.each([
		{ value: -12, expected: 0 },
		{ value: 0, expected: 0 },
		{ value: 42.5, expected: 42.5 },
		{ value: 140, expected: 100 },
		{ value: Number.NaN, expected: 0 },
		{ value: Number.POSITIVE_INFINITY, expected: 0 },
	])("clamps $value to $expected", ({ value, expected }) => {
		expect(clampPercentage(value)).toBe(expected);
	});

	it("calculates a percentage without rounding away useful precision", () => {
		expect(calculatePercentage(1, 3)).toBeCloseTo(33.333_333, 5);
	});

	it("keeps progress values within the zero-to-one-hundred range", () => {
		expect(calculatePercentage(-1, 10)).toBe(0);
		expect(calculatePercentage(15, 10)).toBe(100);
	});

	it.each([
		[2, 0],
		[2, -1],
		[Number.NaN, 10],
		[2, Number.POSITIVE_INFINITY],
	])("returns zero for unsafe input (%s of %s)", (part, total) => {
		expect(calculatePercentage(part, total)).toBe(0);
	});
});

describe("mapCollectedRevenueChartData", () => {
	it("sorts dates, combines duplicate days, and adds stacked totals", () => {
		const points = [
			{
				date: "2026-08-03",
				subscriptionsMinor: 1_200,
				ordersMinor: 300,
				topupsMinor: 50,
			},
			{
				date: "2026-08-01",
				subscriptionsMinor: 800,
				ordersMinor: 0,
				topupsMinor: 0,
			},
			{
				date: "2026-08-03",
				subscriptionsMinor: 200,
				ordersMinor: 100,
				topupsMinor: 25,
			},
		];

		expect(mapCollectedRevenueChartData(points)).toEqual([
			{
				date: "2026-08-01",
				subscriptionsMinor: 800,
				ordersMinor: 0,
				topupsMinor: 0,
				totalMinor: 800,
			},
			{
				date: "2026-08-03",
				subscriptionsMinor: 1_400,
				ordersMinor: 400,
				topupsMinor: 75,
				totalMinor: 1_875,
			},
		]);

		expect(points[0]).toEqual({
			date: "2026-08-03",
			subscriptionsMinor: 1_200,
			ordersMinor: 300,
			topupsMinor: 50,
		});
	});

	it("returns an empty series for no revenue points", () => {
		expect(mapCollectedRevenueChartData([])).toEqual([]);
	});
});

describe("mapDaysToConvertChartData", () => {
	it("returns every bucket in contract order and fills missing values", () => {
		expect(
			mapDaysToConvertChartData([
				{ bucket: "15+", count: 2 },
				{ bucket: "0", count: 4 },
				{ bucket: "0", count: 1 },
			]),
		).toEqual([
			{ bucket: "0", label: "Same day", count: 5 },
			{ bucket: "1", label: "1 day", count: 0 },
			{ bucket: "2", label: "2 days", count: 0 },
			{ bucket: "3", label: "3 days", count: 0 },
			{ bucket: "4-5", label: "4–5 days", count: 0 },
			{ bucket: "6-7", label: "6–7 days", count: 0 },
			{ bucket: "8-14", label: "8–14 days", count: 0 },
			{ bucket: "15+", label: "15+ days", count: 2 },
		]);
	});
});

describe("mapConsumptionChartData", () => {
	it("returns every bucket in contract order and fills missing values", () => {
		expect(
			mapConsumptionChartData([
				{ bucket: "50+", users: 3 },
				{ bucket: "1-9", users: 8 },
				{ bucket: "1-9", users: 2 },
			]),
		).toEqual([
			{ bucket: "0", label: "0 credits", users: 0 },
			{ bucket: "1-9", label: "1–9 credits", users: 10 },
			{ bucket: "10-24", label: "10–24 credits", users: 0 },
			{ bucket: "25-39", label: "25–39 credits", users: 0 },
			{ bucket: "40-49", label: "40–49 credits", users: 0 },
			{ bucket: "50+", label: "50+ credits", users: 3 },
		]);
	});
});

describe("mapConversionByCreditsChartData", () => {
	it("returns canonical buckets with owners, paid owners, and conversion", () => {
		expect(
			mapConversionByCreditsChartData([
				{ bucket: "50+", owners: 3, paidOwners: 2, paidPct: 66.7 },
				{ bucket: "1-9", owners: 2, paidOwners: 1, paidPct: 50 },
				{ bucket: "1-9", owners: 1, paidOwners: 1, paidPct: 100 },
			]),
		).toEqual([
			{
				bucket: "0",
				label: "0 credits",
				owners: 0,
				paidOwners: 0,
				paidPct: null,
			},
			{
				bucket: "1-9",
				label: "1–9 credits",
				owners: 3,
				paidOwners: 2,
				paidPct: 66.666_666_666_666_66,
			},
			{
				bucket: "10-24",
				label: "10–24 credits",
				owners: 0,
				paidOwners: 0,
				paidPct: null,
			},
			{
				bucket: "25-39",
				label: "25–39 credits",
				owners: 0,
				paidOwners: 0,
				paidPct: null,
			},
			{
				bucket: "40-49",
				label: "40–49 credits",
				owners: 0,
				paidOwners: 0,
				paidPct: null,
			},
			{
				bucket: "50+",
				label: "50+ credits",
				owners: 3,
				paidOwners: 2,
				paidPct: 66.7,
			},
		]);
	});

	it("preserves a nullable paid percentage from the API", () => {
		expect(
			mapConversionByCreditsChartData([
				{ bucket: "10-24", owners: 4, paidOwners: 2, paidPct: null },
			]).find((point) => point.bucket === "10-24"),
		).toMatchObject({ owners: 4, paidOwners: 2, paidPct: null });
	});

	it("returns an all-empty, null-percentage state with no owners", () => {
		expect(mapConversionByCreditsChartData([])).toHaveLength(
			adminAnalyticsConsumptionBuckets.length,
		);
		expect(
			mapConversionByCreditsChartData([]).every(
				(point) =>
					point.owners === 0 &&
					point.paidOwners === 0 &&
					point.paidPct === null,
			),
		).toBe(true);
	});
});

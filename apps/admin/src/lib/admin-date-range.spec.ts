import { describe, expect, it } from "vitest";

import {
	createAdminCustomDateRangeQuery,
	formatAdminDateAxisTick,
	formatAdminDateRangeLabel,
	formatAdminDateTooltipLabel,
	getAdminAnalyticsNavigationSearch,
	getAdminCalendarRange,
	getAdminDateAxis,
	getAdminInclusiveDateCount,
	getUtcTodayAsLocalCalendarDate,
	mergeAdminAnalyticsDateRangeQuery,
	mergeAdminDashboardDateRangeQuery,
	parseAdminAnalyticsSearch,
	parseAdminCalendarDate,
	parseAdminDashboardSearch,
	parseAdminDateToUtcMilliseconds,
	parseAdminOverviewSearch,
	parseAdminStandardAnalyticsSearch,
	serializeAdminCalendarDate,
} from "./admin-date-range";

describe("admin date range route search", () => {
	it("normalizes missing and invalid overview search values", () => {
		expect(parseAdminOverviewSearch({})).toEqual({ range: "30d" });
		expect(parseAdminOverviewSearch({ range: "unknown" })).toEqual({
			range: "30d",
		});
		expect(parseAdminOverviewSearch({ range: ["30d"] })).toEqual({
			range: "30d",
		});
	});

	it("defaults analytics search to an unfiltered range", () => {
		expect(parseAdminAnalyticsSearch({})).toEqual({
			range: "30d",
			cohortOnly: false,
		});
		expect(parseAdminAnalyticsSearch({ range: "unknown" })).toEqual({
			range: "30d",
			cohortOnly: false,
		});
	});

	it.each([
		"7d",
		"30d",
		"90d",
		"180d",
		"365d",
	] as const)("keeps %s and removes stale custom dates", (range) => {
		expect(
			parseAdminOverviewSearch({
				range,
				from: "not-a-date",
				to: ["2026-02-01"],
			}),
		).toEqual({ range });
	});

	it("preserves a valid custom range", () => {
		expect(
			parseAdminAnalyticsSearch({
				range: "custom",
				from: "2026-03-12",
				to: "2026-04-04",
			}),
		).toEqual({
			range: "custom",
			from: "2026-03-12",
			to: "2026-04-04",
			cohortOnly: false,
		});
	});

	it("round-trips and normalizes analytics filters", () => {
		const parsed = parseAdminAnalyticsSearch({
			range: "90d",
			from: "2024-01-01",
			to: "2024-01-02",
			source: "  newsletter  ",
			country: "dz",
			device: "mobile",
			cohortOnly: true,
		});

		expect(parsed).toEqual({
			range: "90d",
			source: "newsletter",
			country: "DZ",
			device: "mobile",
			cohortOnly: true,
		});
		expect(parseAdminAnalyticsSearch(parsed)).toEqual(parsed);
	});

	it("drops invalid filters independently without resetting valid search", () => {
		expect(
			parseAdminAnalyticsSearch({
				range: "7d",
				source: " ",
				country: "DZA",
				device: "watch",
			}),
		).toEqual({ range: "7d", cohortOnly: false });

		expect(
			parseAdminAnalyticsSearch({
				range: "7d",
				source: "referral",
				country: "DZA",
			}),
		).toEqual({
			range: "7d",
			source: "referral",
			cohortOnly: false,
		});
	});

	it("keeps cohort scope engagement-local", () => {
		const search = {
			range: "30d",
			source: "direct",
			country: "FR",
			device: "desktop",
			cohortOnly: true,
		};

		expect(parseAdminStandardAnalyticsSearch(search)).toEqual({
			range: "30d",
			source: "direct",
			country: "FR",
			device: "desktop",
			cohortOnly: false,
		});
		expect(parseAdminDashboardSearch(search)).toEqual({
			range: "30d",
			source: "direct",
			country: "FR",
			device: "desktop",
		});
	});

	it("merges date changes without stale custom bounds or lost filters", () => {
		const analyticsQuery = parseAdminAnalyticsSearch({
			range: "custom",
			from: "2026-08-01",
			to: "2026-08-15",
			source: "affiliate",
			country: "US",
			device: "tablet",
			cohortOnly: true,
		});

		expect(
			mergeAdminAnalyticsDateRangeQuery(analyticsQuery, { range: "7d" }, true),
		).toEqual({
			range: "7d",
			source: "affiliate",
			country: "US",
			device: "tablet",
			cohortOnly: true,
		});
		expect(
			mergeAdminAnalyticsDateRangeQuery(analyticsQuery, { range: "7d" }),
		).toEqual({
			range: "7d",
			source: "affiliate",
			country: "US",
			device: "tablet",
			cohortOnly: false,
		});
		expect(
			mergeAdminDashboardDateRangeQuery(
				parseAdminDashboardSearch(analyticsQuery),
				{ range: "365d" },
			),
		).toEqual({
			range: "365d",
			source: "affiliate",
			country: "US",
			device: "tablet",
		});
	});

	it("carries common filters only between dashboard analytics links", () => {
		const search = {
			range: "30d",
			source: "organic_search",
			country: "GB",
			device: "mobile",
			cohortOnly: true,
		};

		expect(
			getAdminAnalyticsNavigationSearch(
				"/analytics/engagement",
				"/analytics/revenue",
				search,
			),
		).toEqual({
			range: "30d",
			source: "organic_search",
			country: "GB",
			device: "mobile",
		});
		expect(
			getAdminAnalyticsNavigationSearch(
				"/analytics/engagement",
				"/analytics/engagement",
				search,
			),
		).toEqual(search);
		expect(
			getAdminAnalyticsNavigationSearch(
				"/analytics/revenue",
				"/dashboard",
				search,
			),
		).toEqual({
			range: "30d",
			source: "organic_search",
			country: "GB",
			device: "mobile",
		});
		expect(
			getAdminAnalyticsNavigationSearch("/users", "/dashboard", search),
		).toBeUndefined();
	});

	it("accepts the maximum 731-date custom range", () => {
		expect(
			parseAdminOverviewSearch({
				range: "custom",
				from: "2024-01-02",
				to: "2026-01-01",
			}),
		).toEqual({
			range: "custom",
			from: "2024-01-02",
			to: "2026-01-01",
		});
	});

	it.each([
		{ range: "custom", from: "2026-02-30", to: "2026-03-01" },
		{ range: "custom", from: "2026-04-04", to: "2026-03-12" },
		{ range: "custom", from: "2026-03-12", to: "2999-04-04" },
		{ range: "custom", from: "2024-01-01", to: "2026-01-01" },
		{ range: "custom", from: "2026-03-12" },
	])("normalizes invalid custom search %#", (search) => {
		expect(parseAdminOverviewSearch(search)).toEqual({ range: "30d" });
	});
});

describe("admin calendar conversions", () => {
	it("round-trips date-only values through local calendar dates", () => {
		const date = parseAdminCalendarDate("2026-03-12");

		expect(date).toBeDefined();
		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(2);
		expect(date?.getDate()).toBe(12);
		expect(date ? serializeAdminCalendarDate(date) : undefined).toBe(
			"2026-03-12",
		);
	});

	it("rejects malformed and impossible date-only values", () => {
		expect(parseAdminCalendarDate("03/12/2026")).toBeUndefined();
		expect(parseAdminCalendarDate("2026-02-30")).toBeUndefined();
		expect(parseAdminDateToUtcMilliseconds("2026-13-01")).toBeUndefined();
	});

	it("uses UTC calendar days for range checks", () => {
		expect(getAdminInclusiveDateCount("2024-03-09", "2024-03-11")).toBe(3);
		expect(getAdminInclusiveDateCount("2026-12-31", "2027-01-01")).toBe(2);
	});

	it("builds the local calendar date from UTC today", () => {
		const today = getUtcTodayAsLocalCalendarDate(
			new Date("2026-04-04T23:30:00-07:00"),
		);

		expect(serializeAdminCalendarDate(today)).toBe("2026-04-05");
	});

	it("converts valid calendar drafts and rejects incomplete drafts", () => {
		const range = {
			from: new Date(2026, 2, 12),
			to: new Date(2026, 3, 4),
		};

		expect(createAdminCustomDateRangeQuery(range)).toEqual({
			range: "custom",
			from: "2026-03-12",
			to: "2026-04-04",
		});
		expect(
			createAdminCustomDateRangeQuery({ from: range.from }),
		).toBeUndefined();
		expect(
			getAdminCalendarRange({
				range: "custom",
				from: "2026-03-12",
				to: "2026-04-04",
			}),
		).toEqual(range);
	});

	it("formats same-year and cross-year custom labels", () => {
		expect(
			formatAdminDateRangeLabel({
				range: "custom",
				from: "2026-03-12",
				to: "2026-04-04",
			}),
		).toBe("12 Mar – 04 Apr 2026");
		expect(
			formatAdminDateRangeLabel({
				range: "custom",
				from: "2025-12-12",
				to: "2026-01-04",
			}),
		).toBe("12 Dec 2025 – 04 Jan 2026");
	});
});

function isoDateAtOffset(start: string, offset: number) {
	const startMilliseconds = parseAdminDateToUtcMilliseconds(start);
	if (startMilliseconds === undefined) throw new Error("Invalid test date");

	const date = new Date(startMilliseconds + offset * 86_400_000);
	const year = String(date.getUTCFullYear()).padStart(4, "0");
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

describe("admin chart date axes", () => {
	it("keeps daily labels through 90 inclusive dates", () => {
		const dates = Array.from({ length: 90 }, (_, index) =>
			isoDateAtOffset("2026-01-01", index),
		);
		const axis = getAdminDateAxis(dates);

		expect(axis).toEqual({ granularity: "day", includeYear: false });
		expect(formatAdminDateAxisTick("2026-01-02", axis)).toBe("02 Jan");
	});

	it("uses the first available date per month after 90 dates", () => {
		const dates = Array.from({ length: 91 }, (_, index) =>
			isoDateAtOffset("2026-01-15", index),
		);
		const axis = getAdminDateAxis(dates);

		expect(axis.granularity).toBe("month");
		expect(axis.ticks).toEqual([
			"2026-01-15",
			"2026-02-01",
			"2026-03-01",
			"2026-04-01",
		]);
	});

	it("handles empty and sparse series", () => {
		expect(getAdminDateAxis([])).toEqual({
			granularity: "day",
			includeYear: false,
		});
		expect(
			getAdminDateAxis(["invalid", "2026-01-15", "2026-05-20"]),
		).toMatchObject({
			granularity: "month",
			ticks: ["2026-01-15", "2026-05-20"],
		});
	});

	it("caps monthly ticks near seven and adds years across calendar years", () => {
		const dates = Array.from({ length: 366 }, (_, index) =>
			isoDateAtOffset("2025-10-01", index),
		);
		const axis = getAdminDateAxis(dates);

		expect(axis.granularity).toBe("month");
		expect(axis.includeYear).toBe(true);
		expect(axis.ticks?.length).toBeLessThanOrEqual(7);
		expect(formatAdminDateAxisTick("2026-01-01", axis)).toBe("Jan 26");
		expect(formatAdminDateTooltipLabel("2026-01-01")).toBe("01 Jan 2026");
	});

	it("keeps the first and final available months when ticks are capped", () => {
		const dates = Array.from({ length: 638 }, (_, index) =>
			isoDateAtOffset("2025-01-01", index),
		);
		const axis = getAdminDateAxis(dates);

		expect(axis.ticks?.[0]).toBe("2025-01-01");
		expect(axis.ticks?.at(-1)).toBe("2026-09-01");
		expect(axis.ticks?.length).toBeLessThanOrEqual(7);
	});
});

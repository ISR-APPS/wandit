import { describe, expect, it } from "vitest";

import { getLeadDateRange } from "./lead-date-filter";

const ALGIERS_AUGUST_12 = new Date("2026-08-11T23:30:00.000Z");

describe("getLeadDateRange", () => {
	it("uses the Africa/Algiers calendar day for today", () => {
		expect(getLeadDateRange("today", "", ALGIERS_AUGUST_12)).toEqual({
			createdFrom: "2026-08-12",
			createdTo: "2026-08-12",
		});
	});

	it("includes today and the prior six or twenty-nine calendar days", () => {
		expect(getLeadDateRange("last7Days", "", ALGIERS_AUGUST_12)).toEqual({
			createdFrom: "2026-08-06",
			createdTo: "2026-08-12",
		});
		expect(getLeadDateRange("last30Days", "", ALGIERS_AUGUST_12)).toEqual({
			createdFrom: "2026-07-14",
			createdTo: "2026-08-12",
		});
	});

	it("uses a picked day for both inclusive bounds", () => {
		expect(getLeadDateRange("pickDay", "2026-02-03")).toEqual({
			createdFrom: "2026-02-03",
			createdTo: "2026-02-03",
		});
		expect(getLeadDateRange("pickDay", "")).toEqual({});
		expect(getLeadDateRange("all", "2026-02-03")).toEqual({});
	});
});

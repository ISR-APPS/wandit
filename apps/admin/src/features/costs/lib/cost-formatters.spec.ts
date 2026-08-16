import { describe, expect, it } from "vitest";

import {
	formatCostMoney,
	formatCostMonth,
	formatCostSource,
	formatCostUpdatedAt,
} from "./cost-formatters";

describe("cost formatters", () => {
	it("formats month keys and timestamps in UTC", () => {
		expect(formatCostMonth("2026-07")).toBe("July 2026");
		expect(formatCostUpdatedAt("2026-08-15T12:30:00.000Z")).toContain(
			"Aug 15, 2026",
		);
	});

	it("formats cents as USD and source keys as labels", () => {
		expect(formatCostMoney(12_345)).toBe("$123.45");
		expect(formatCostSource("organic_search")).toBe("Organic Search");
	});
});

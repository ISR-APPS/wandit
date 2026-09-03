import { describe, expect, it } from "vitest";

import { monthlyCostsKeys } from "./costs.queries";

describe("monthly costs query keys", () => {
	it("uses a stable key for the server-default 12-month range", () => {
		expect(monthlyCostsKeys.list()).toEqual([
			"admin-costs",
			"list",
			null,
			null,
		]);
	});

	it("keeps optional month bounds in chronological key order", () => {
		expect(
			monthlyCostsKeys.list({
				fromMonth: "2025-08",
				toMonth: "2026-07",
			}),
		).toEqual(["admin-costs", "list", "2025-08", "2026-07"]);
	});

	it("rejects inverted or malformed range bounds", () => {
		expect(() =>
			monthlyCostsKeys.list({
				fromMonth: "2026-08",
				toMonth: "2026-07",
			}),
		).toThrow();
		expect(() => monthlyCostsKeys.list({ fromMonth: "2026-8" })).toThrow();
	});
});

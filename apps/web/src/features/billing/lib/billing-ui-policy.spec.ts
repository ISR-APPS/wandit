import { describe, expect, it } from "vitest";

import {
	areTopupsAvailable,
	resolvePlanPickerInterval,
} from "./billing-ui-policy";

describe("billing UI policy", () => {
	describe("top-up admission", () => {
		it("offers catalog packs whenever the independent top-up switch is enabled", () => {
			expect(areTopupsAvailable(true, 3)).toBe(true);
		});

		it.each([
			{ count: 3, enabled: undefined },
			{ count: 3, enabled: false },
			{ count: 0, enabled: true },
			{ count: undefined, enabled: true },
		])("hides packs until the switch and non-empty catalog are both resolved ($enabled, $count)", ({
			count,
			enabled,
		}) => {
			expect(areTopupsAvailable(enabled, count)).toBe(false);
		});
	});

	describe("plan-picker interval", () => {
		it("clamps a yearly subscriber to yearly despite a monthly landing selection", () => {
			expect(resolvePlanPickerInterval("month", "year")).toBe("year");
		});

		it("preserves a landing selection when the subscription permits it", () => {
			expect(resolvePlanPickerInterval("year", "month")).toBe("year");
		});
	});
});

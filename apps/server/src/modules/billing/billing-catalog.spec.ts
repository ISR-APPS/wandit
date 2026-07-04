import {
	billingIntervals,
	billingPlanIds,
	CREDIT_COSTS,
	CREDIT_TIERS,
	parsePriceLookupKey,
	priceLookupKey,
	priceUsdFor,
	SIGNUP_GRANT_CREDITS,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("billing catalog", () => {
	it("calculates monthly, annual, and volume-boundary prices", () => {
		expect(priceUsdFor("pro", 100, "month")).toBe(25);
		expect(priceUsdFor("business", 100, "month")).toBe(50);
		expect(priceUsdFor("pro", 10_000, "month")).toBe(
			Math.ceil(25 * 100 * 0.85),
		);
		expect(priceUsdFor("pro", 100, "year")).toBe(25 * 12 * 0.8);
		expect(priceUsdFor("pro", 400, "month")).toBe(100);
		expect(priceUsdFor("pro", 800, "month")).toBe(190);
	});

	it("round-trips every plan, tier, and interval lookup key", () => {
		for (const plan of billingPlanIds) {
			for (const tierCredits of CREDIT_TIERS) {
				for (const interval of billingIntervals) {
					const lookupKey = priceLookupKey(plan, tierCredits, interval);

					expect(parsePriceLookupKey(lookupKey)).toEqual({
						interval,
						plan,
						tierCredits,
					});
				}
			}
		}
	});

	it("rejects invalid price lookup keys", () => {
		for (const lookupKey of [
			"pro_150_month",
			"free_100_month",
			"pro_100_weekly",
			"pro_100_month_x",
			"",
		]) {
			expect(parsePriceLookupKey(lookupKey)).toBeNull();
		}
	});

	it("exports exact credit costs and signup grant values", () => {
		expect(CREDIT_COSTS).toEqual({
			chatMessage: 1,
			imageGeneration: 5,
			landingPageGeneration: 10,
			videoGeneration: 25,
		});
		expect(SIGNUP_GRANT_CREDITS).toBe(100);
	});
});

import {
	BILLING_CATALOG,
	type BillingTierPrice,
	CREDIT_TIERS,
	priceLookupKey,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { tierPriceUsd, tierSavingsPercent } from "./plan-pricing";

const EXPECTED_MONTHLY_PRICES = [
	25, 50, 100, 200, 294, 480, 705, 920, 1125,
] as const;
const EXPECTED_SAVINGS = [0, 0, 0, 0, 2, 4, 6, 8, 10] as const;

function catalogTiers(): BillingTierPrice[] {
	return CREDIT_TIERS.map((tierCredits, index) => {
		const monthlyUsd = BILLING_CATALOG.plans.pro.monthlyPricesUsd[tierCredits];

		expect(monthlyUsd).toBe(EXPECTED_MONTHLY_PRICES[index]);

		return {
			annualLookupKey: priceLookupKey("pro", tierCredits, "year"),
			annualUsd: monthlyUsd * 10,
			monthlyLookupKey: priceLookupKey("pro", tierCredits, "month"),
			monthlyUsd,
			tierCredits,
		};
	});
}

describe("plan picker pricing", () => {
	it("locks every catalog tier and its volume savings", () => {
		const tiers = catalogTiers();

		expect(tiers.map((tier) => tier.tierCredits)).toEqual([
			100, 200, 400, 800, 1200, 2000, 3000, 4000, 5000,
		]);
		expect(tiers.map(tierSavingsPercent)).toEqual(EXPECTED_SAVINGS);
	});

	it("prices yearly plans at exactly ten monthly payments", () => {
		for (const tier of catalogTiers()) {
			expect(tierPriceUsd(tier, "month")).toBe(tier.monthlyUsd);
			expect(tierPriceUsd(tier, "year")).toBe(tier.monthlyUsd * 10);
		}
	});
});

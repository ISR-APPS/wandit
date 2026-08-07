import {
	BILLING_CATALOG,
	type BillingTierPrice,
	CREDIT_TIERS,
	priceLookupKey,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import { tierPriceUsd, tierSavingsPercent } from "./plan-pricing";

const EXPECTED_MONTHLY_PRICES = [
	30, 60, 120, 240, 353, 576, 846, 1104, 1350,
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
			200, 400, 800, 1600, 2400, 4000, 6000, 8000, 10000,
		]);
		expect(tiers.map((tier) => tierSavingsPercent(tier))).toEqual(
			EXPECTED_SAVINGS,
		);
	});

	it("computes Business savings against the Business base rate, not Pro's", () => {
		const businessSavings = CREDIT_TIERS.map((tierCredits) =>
			tierSavingsPercent(
				{
					monthlyUsd:
						BILLING_CATALOG.plans.business.monthlyPricesUsd[tierCredits],
					tierCredits,
				},
				BILLING_CATALOG.plans.business.basePer100Usd,
			),
		);

		expect(businessSavings).toEqual(EXPECTED_SAVINGS);
	});

	it("prices yearly plans at exactly ten monthly payments", () => {
		for (const tier of catalogTiers()) {
			expect(tierPriceUsd(tier, "month")).toBe(tier.monthlyUsd);
			expect(tierPriceUsd(tier, "year")).toBe(tier.monthlyUsd * 10);
		}
	});
});

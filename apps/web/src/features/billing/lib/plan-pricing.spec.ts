import {
	BILLING_CATALOG,
	type BillingTierPrice,
	priceLookupKey,
	purchasableTiersFor,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	formatUsd,
	isRenewalDowngrade,
	tierPriceUsd,
	tierSavingsPercent,
} from "./plan-pricing";

const EXPECTED_MONTHLY_PRICES = [
	25, 50, 100, 200, 294, 480, 705, 920, 1125,
] as const;
const EXPECTED_SAVINGS = [0, 0, 0, 0, 2, 4, 6, 8, 10] as const;

function catalogTiers(): BillingTierPrice[] {
	return purchasableTiersFor("pro").map((tierCredits, index) => {
		const monthlyUsd = (
			BILLING_CATALOG.plans.pro.monthlyPricesUsd as Readonly<
				Record<number, number>
			>
		)[tierCredits];

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
			250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 12500,
		]);
		expect(
			tiers.map((tier) =>
				tierSavingsPercent(tier, BILLING_CATALOG.plans.pro.basePer100Usd),
			),
		).toEqual(EXPECTED_SAVINGS);
	});

	it("computes Business savings against the Business base rate, not Pro's", () => {
		const businessSavings = purchasableTiersFor("business").map((tierCredits) =>
			tierSavingsPercent(
				{
					monthlyUsd: (
						BILLING_CATALOG.plans.business.monthlyPricesUsd as Readonly<
							Record<number, number>
						>
					)[tierCredits],
					tierCredits,
				},
				BILLING_CATALOG.plans.business.basePer100Usd,
			),
		);

		expect(businessSavings).toEqual(EXPECTED_SAVINGS);
	});

	it("keeps Starter at zero savings against Starter's own base rate", () => {
		expect(
			tierSavingsPercent(
				{ monthlyUsd: 9, tierCredits: 60 },
				BILLING_CATALOG.plans.starter.basePer100Usd,
			),
		).toBe(0);
	});

	it("prices yearly plans at exactly ten monthly payments", () => {
		for (const tier of catalogTiers()) {
			expect(tierPriceUsd(tier, "month")).toBe(tier.monthlyUsd);
			expect(tierPriceUsd(tier, "year")).toBe(tier.monthlyUsd * 10);
		}
	});

	it("keeps cents for non-whole prices and omits them for whole dollars", () => {
		expect(formatUsd(8, "en")).toBe("$8");
		expect(formatUsd(7.5, "en")).toBe("$7.50");
	});

	it.each([
		{ currentTier: 5250, targetTier: 7500 },
		{ currentTier: 7000, targetTier: 10000 },
		{ currentTier: 5250, targetTier: 10000 },
	])("does not label legacy $currentTier to active $targetTier as a renewal downgrade when its price is not lower", ({
		currentTier,
		targetTier,
	}) => {
		expect(
			isRenewalDowngrade(
				{
					interval: "month",
					plan: "pro",
					tierCredits: currentTier as 5250 | 7000,
				},
				{
					interval: "month",
					plan: "pro",
					tierCredits: targetTier as 7500 | 10000,
				},
			),
		).toBe(false);
	});

	it("still identifies a same-interval target with a lower catalog price", () => {
		expect(
			isRenewalDowngrade(
				{ interval: "month", plan: "pro", tierCredits: 8750 },
				{ interval: "month", plan: "pro", tierCredits: 7500 },
			),
		).toBe(true);
	});

	it.each([
		"month",
		"year",
	] as const)("treats Pro to Starter on a %s cycle as a renewal downgrade", (interval) => {
		expect(
			isRenewalDowngrade(
				{ interval, plan: "pro", tierCredits: 250 },
				{ interval, plan: "starter", tierCredits: 60 },
			),
		).toBe(true);
	});

	it("does not let a switch to yearly billing hide a cheaper Starter plan", () => {
		expect(
			isRenewalDowngrade(
				{ interval: "month", plan: "pro", tierCredits: 250 },
				{ interval: "year", plan: "starter", tierCredits: 60 },
			),
		).toBe(true);
	});

	it("keeps Starter to Pro and same-tier yearly upgrades immediate", () => {
		expect(
			isRenewalDowngrade(
				{ interval: "month", plan: "starter", tierCredits: 60 },
				{ interval: "year", plan: "pro", tierCredits: 250 },
			),
		).toBe(false);
		expect(
			isRenewalDowngrade(
				{ interval: "month", plan: "pro", tierCredits: 250 },
				{ interval: "year", plan: "pro", tierCredits: 250 },
			),
		).toBe(false);
	});
});

import {
	apiErrorCodeSchema,
	billingIntervals,
	billingPlanIds,
	billingRoutes,
	CREDIT_SPEND_ORDER,
	CREDIT_TIERS,
	changeBillingSubscriptionBodySchema,
	createBillingCheckoutBodySchema,
	ENTITLED_SUBSCRIPTION_STATUSES,
	isPurchasableTier,
	LEGACY_CREDIT_TIERS,
	PERSISTED_TOPUP_PACKS,
	PURCHASED_CREDIT_BUCKETS,
	parsePriceLookupKey,
	paymentRequiredDetailsSchema,
	persistedTopupPackIdSchema,
	previewBillingSubscriptionChangeBodySchema,
	priceLookupKey,
	priceUsdFor,
	purchasableTiersFor,
	SIGNUP_GRANT_CREDITS,
	subscriptionSchema,
	TOPUP_PACKS,
	topupPackIdSchema,
	topupPackIds,
	tryPriceUsdFor,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const PRO_ECONOMICS = [
	{ monthlyUsd: 25, tierCredits: 175, yearlyUsd: 250 },
	{ monthlyUsd: 50, tierCredits: 350, yearlyUsd: 500 },
	{ monthlyUsd: 100, tierCredits: 700, yearlyUsd: 1000 },
	{ monthlyUsd: 200, tierCredits: 1400, yearlyUsd: 2000 },
	{ monthlyUsd: 294, tierCredits: 2100, yearlyUsd: 2940 },
	{ monthlyUsd: 480, tierCredits: 3500, yearlyUsd: 4800 },
	{ monthlyUsd: 705, tierCredits: 5250, yearlyUsd: 7050 },
	{ monthlyUsd: 920, tierCredits: 7000, yearlyUsd: 9200 },
	{ monthlyUsd: 1125, tierCredits: 8750, yearlyUsd: 11250 },
] as const;

const LEGACY_PRO_ECONOMICS = [
	{ monthlyUsd: 25, tierCredits: 250, yearlyUsd: 250 },
	{ monthlyUsd: 50, tierCredits: 500, yearlyUsd: 500 },
	{ monthlyUsd: 100, tierCredits: 1000, yearlyUsd: 1000 },
	{ monthlyUsd: 200, tierCredits: 2000, yearlyUsd: 2000 },
	{ monthlyUsd: 294, tierCredits: 3000, yearlyUsd: 2940 },
	{ monthlyUsd: 480, tierCredits: 5000, yearlyUsd: 4800 },
	{ monthlyUsd: 705, tierCredits: 7500, yearlyUsd: 7050 },
	{ monthlyUsd: 920, tierCredits: 10000, yearlyUsd: 9200 },
	{ monthlyUsd: 1125, tierCredits: 12500, yearlyUsd: 11250 },
] as const;

describe("billing catalog", () => {
	it("publishes Starter and the exact active Pro and Business economics", () => {
		expect(billingPlanIds).toEqual(["starter", "pro", "business"]);
		expect(purchasableTiersFor("starter")).toEqual([50]);
		expect(purchasableTiersFor("pro")).toEqual(
			PRO_ECONOMICS.map(({ tierCredits }) => tierCredits),
		);
		expect(purchasableTiersFor("business")).toEqual(
			PRO_ECONOMICS.map(({ tierCredits }) => tierCredits),
		);
		expect(priceUsdFor("starter", 50, "month")).toBe(9);
		expect(priceUsdFor("starter", 50, "year")).toBe(90);

		for (const row of PRO_ECONOMICS) {
			expect(priceUsdFor("pro", row.tierCredits, "month")).toBe(row.monthlyUsd);
			expect(priceUsdFor("pro", row.tierCredits, "year")).toBe(row.yearlyUsd);
			expect(priceUsdFor("business", row.tierCredits, "month")).toBe(
				row.monthlyUsd * 2,
			);
			expect(priceUsdFor("business", row.tierCredits, "year")).toBe(
				row.yearlyUsd * 2,
			);
			expect(row.yearlyUsd).toBe(row.monthlyUsd * 10);
		}

		const seededSubscriptionPriceCount = billingPlanIds.reduce(
			(total, plan) =>
				total + purchasableTiersFor(plan).length * billingIntervals.length,
			0,
		);
		expect(seededSubscriptionPriceCount).toBe(38);
	});

	it("keeps the old Pro and 2x Business prices available for history", () => {
		expect(LEGACY_CREDIT_TIERS).toEqual(
			LEGACY_PRO_ECONOMICS.map(({ tierCredits }) => tierCredits),
		);

		for (const row of LEGACY_PRO_ECONOMICS) {
			expect(priceUsdFor("pro", row.tierCredits, "month")).toBe(row.monthlyUsd);
			expect(priceUsdFor("pro", row.tierCredits, "year")).toBe(row.yearlyUsd);
			expect(priceUsdFor("business", row.tierCredits, "month")).toBe(
				row.monthlyUsd * 2,
			);
			expect(priceUsdFor("business", row.tierCredits, "year")).toBe(
				row.yearlyUsd * 2,
			);
			expect(isPurchasableTier("pro", row.tierCredits)).toBe(false);
			expect(isPurchasableTier("business", row.tierCredits)).toBe(false);
		}

		const expectedCreditTiers = [
			...new Set([
				50,
				...PRO_ECONOMICS.map(({ tierCredits }) => tierCredits),
				...LEGACY_CREDIT_TIERS,
			]),
		].sort((left, right) => left - right);
		expect([...CREDIT_TIERS]).toEqual(expectedCreditTiers);
		expect(new Set(CREDIT_TIERS).size).toBe(CREDIT_TIERS.length);
		expect(tryPriceUsdFor("starter", 250, "month")).toBeNull();
		expect(tryPriceUsdFor("pro", 50, "month")).toBeNull();
	});

	it("publishes new top-ups while parsing persisted legacy pack ids", () => {
		expect(topupPackIds).toEqual(["topup_175", "topup_700", "topup_1750"]);
		expect(TOPUP_PACKS).toEqual({
			topup_175: { credits: 175, usd: 25 },
			topup_700: { credits: 700, usd: 100 },
			topup_1750: { credits: 1750, usd: 250 },
		});
		expect(topupPackIdSchema.safeParse("topup_250").success).toBe(false);
		expect(persistedTopupPackIdSchema.parse("topup_250")).toBe("topup_250");
		expect(PERSISTED_TOPUP_PACKS.topup_250).toEqual({
			credits: 250,
			usd: 25,
		});
	});

	it("round-trips every purchasable price lookup key", () => {
		for (const plan of billingPlanIds) {
			for (const tierCredits of purchasableTiersFor(plan)) {
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

	it("round-trips every legacy key but rejects cross-plan tier keys", () => {
		for (const plan of ["pro", "business"] as const) {
			for (const tierCredits of LEGACY_CREDIT_TIERS) {
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

		expect(parsePriceLookupKey("starter_50_month")).toEqual({
			interval: "month",
			plan: "starter",
			tierCredits: 50,
		});
		expect(parsePriceLookupKey("starter_250_month")).toBeNull();
	});

	it("rejects unknown and malformed price lookup keys", () => {
		for (const lookupKey of [
			"enterprise_175_month",
			"pro_150_month",
			"free_175_month",
			"pro_175_weekly",
			"pro_175_month_x",
			"",
		]) {
			expect(parsePriceLookupKey(lookupKey)).toBeNull();
		}
	});

	it("accepts only purchasable plan-tier pairs at checkout", () => {
		expect(
			createBillingCheckoutBodySchema.safeParse({
				interval: "month",
				plan: "starter",
				tierCredits: 50,
			}).success,
		).toBe(true);
		expect(
			createBillingCheckoutBodySchema.safeParse({
				interval: "month",
				plan: "pro",
				tierCredits: 250,
			}).success,
		).toBe(false);
		expect(
			createBillingCheckoutBodySchema.safeParse({
				interval: "month",
				plan: "starter",
				tierCredits: 250,
			}).success,
		).toBe(false);
	});

	it("keeps subscription-change input history-safe for service validation", () => {
		expect(
			previewBillingSubscriptionChangeBodySchema.parse({
				interval: "month",
				tierCredits: 250,
			}),
		).toEqual({
			interval: "month",
			tierCredits: 250,
		});
		expect(
			previewBillingSubscriptionChangeBodySchema.parse({
				interval: "year",
				plan: "starter",
				tierCredits: 50,
			}),
		).toEqual({
			interval: "year",
			plan: "starter",
			tierCredits: 50,
		});
		expect(
			previewBillingSubscriptionChangeBodySchema.safeParse({
				interval: "month",
				plan: "free",
				tierCredits: 175,
			}).success,
		).toBe(false);
	});

	it("exports the exact signup grant and bucket policies", () => {
		expect(SIGNUP_GRANT_CREDITS).toBe(18);
		expect(CREDIT_SPEND_ORDER).toEqual(["plan", "promo", "topup"]);
		expect(PURCHASED_CREDIT_BUCKETS).toEqual(["plan", "topup"]);
	});

	it("limits subscription entitlement to active and trialing", () => {
		expect(ENTITLED_SUBSCRIPTION_STATUSES).toEqual(["active", "trialing"]);
		expect(ENTITLED_SUBSCRIPTION_STATUSES).not.toContain("past_due");
	});

	it("publishes all billing error codes", () => {
		for (const code of [
			"PAYMENT_PAST_DUE",
			"INSUFFICIENT_CREDITS",
			"GENERATION_PAYMENT_REQUIRED",
			"SUBSCRIPTIONS_DISABLED",
			"TOPUPS_DISABLED",
		] as const) {
			expect(apiErrorCodeSchema.parse(code)).toBe(code);
		}

		expect(
			paymentRequiredDetailsSchema.parse({
				availableCredits: -4,
				requiredCredits: 5,
			}),
		).toEqual({ availableCredits: -4, requiredCredits: 5 });
	});

	it("requires the explicit entitled flag and accepts legacy subscriptions", () => {
		const subscription = {
			cancelAtPeriodEnd: false,
			createdAt: "2026-07-24T10:00:00.000Z",
			currentPeriodEnd: "2026-08-24T10:00:00.000Z",
			currentPeriodStart: "2026-07-24T10:00:00.000Z",
			entitled: false,
			id: "11111111-1111-4111-8111-111111111111",
			interval: "month",
			organizationId: null,
			pendingTierCredits: null,
			plan: "pro",
			priceLookupKey: "pro_250_month",
			provider: "stripe",
			providerSubscriptionId: "sub_past_due",
			status: "past_due",
			tierCredits: 250,
			updatedAt: "2026-07-24T10:00:00.000Z",
			userId: "user_1",
		};

		expect(subscriptionSchema.parse(subscription).entitled).toBe(false);
		const { entitled: _entitled, ...withoutEntitled } = subscription;
		expect(subscriptionSchema.safeParse(withoutEntitled).success).toBe(false);
	});

	it("consumes subscription changes by persisted intent id", () => {
		const intentId = "11111111-1111-4111-8111-111111111111";

		expect(changeBillingSubscriptionBodySchema.parse({ intentId })).toEqual({
			intentId,
		});
		expect(changeBillingSubscriptionBodySchema.safeParse({}).success).toBe(
			false,
		);
	});

	it("exports the authenticated subscription sync route", () => {
		expect(billingRoutes.sync).toBe("/api/v1/billing/sync");
	});
});

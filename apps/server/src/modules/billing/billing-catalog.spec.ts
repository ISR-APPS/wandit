import {
	apiErrorCodeSchema,
	billingIntervals,
	billingPlanIds,
	billingRoutes,
	CREDIT_COSTS,
	CREDIT_SPEND_ORDER,
	CREDIT_TIERS,
	changeBillingSubscriptionBodySchema,
	ENTITLED_SUBSCRIPTION_STATUSES,
	PURCHASED_CREDIT_BUCKETS,
	parsePriceLookupKey,
	paymentRequiredDetailsSchema,
	previewBillingSubscriptionChangeBodySchema,
	priceLookupKey,
	priceUsdFor,
	SIGNUP_GRANT_CREDITS,
	subscriptionSchema,
	TOPUP_PACKS,
	topupPackIds,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

const PRO_ECONOMICS = [
	{ monthlyUsd: 25, tierCredits: 100, yearlyUsd: 250 },
	{ monthlyUsd: 50, tierCredits: 200, yearlyUsd: 500 },
	{ monthlyUsd: 100, tierCredits: 400, yearlyUsd: 1000 },
	{ monthlyUsd: 200, tierCredits: 800, yearlyUsd: 2000 },
	{ monthlyUsd: 294, tierCredits: 1200, yearlyUsd: 2940 },
	{ monthlyUsd: 480, tierCredits: 2000, yearlyUsd: 4800 },
	{ monthlyUsd: 705, tierCredits: 3000, yearlyUsd: 7050 },
	{ monthlyUsd: 920, tierCredits: 4000, yearlyUsd: 9200 },
	{ monthlyUsd: 1125, tierCredits: 5000, yearlyUsd: 11250 },
] as const;

describe("billing catalog", () => {
	it("publishes the exact single-plan economics table", () => {
		expect(billingPlanIds).toEqual(["pro"]);
		expect(CREDIT_TIERS).toEqual(
			PRO_ECONOMICS.map(({ tierCredits }) => tierCredits),
		);

		for (const row of PRO_ECONOMICS) {
			expect(priceUsdFor("pro", row.tierCredits, "month")).toBe(row.monthlyUsd);
			expect(priceUsdFor("pro", row.tierCredits, "year")).toBe(row.yearlyUsd);
			expect(row.yearlyUsd).toBe(row.monthlyUsd * 10);
		}
	});

	it("publishes the exact top-up economics", () => {
		expect(topupPackIds).toEqual(["topup_100", "topup_500", "topup_1000"]);
		expect(TOPUP_PACKS).toEqual({
			topup_100: { credits: 100, usd: 25 },
			topup_500: { credits: 500, usd: 125 },
			topup_1000: { credits: 1000, usd: 250 },
		});
	});

	it("round-trips every public price lookup key", () => {
		for (const tierCredits of CREDIT_TIERS) {
			for (const interval of billingIntervals) {
				const lookupKey = priceLookupKey("pro", tierCredits, interval);

				expect(parsePriceLookupKey(lookupKey)).toEqual({
					interval,
					plan: "pro",
					tierCredits,
				});
			}
		}
	});

	it("rejects unknown and malformed price lookup keys", () => {
		for (const lookupKey of [
			"enterprise_100_month",
			"pro_150_month",
			"free_100_month",
			"pro_100_weekly",
			"pro_100_month_x",
			"",
		]) {
			expect(parsePriceLookupKey(lookupKey)).toBeNull();
		}
	});

	it("exports exact credit costs, signup grant, and bucket policies", () => {
		expect(CREDIT_COSTS).toEqual({
			chatMessage: 1,
			imageGeneration: 5,
			landingPageGeneration: 10,
			marketingAssetGeneration: 5,
			videoGeneration: 25,
		});
		expect(SIGNUP_GRANT_CREDITS).toBe(20);
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

	it("requires the explicit entitled flag in subscription responses", () => {
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
			priceLookupKey: "pro_100_month",
			provider: "stripe",
			providerSubscriptionId: "sub_past_due",
			status: "past_due",
			tierCredits: 100,
			updatedAt: "2026-07-24T10:00:00.000Z",
			userId: "user_1",
		};

		expect(subscriptionSchema.parse(subscription).entitled).toBe(false);
		const { entitled: _entitled, ...withoutEntitled } = subscription;
		expect(subscriptionSchema.safeParse(withoutEntitled).success).toBe(false);
	});

	it("accepts only the Pro plan when previewing a subscription change", () => {
		expect(
			previewBillingSubscriptionChangeBodySchema.parse({
				interval: "month",
				tierCredits: 400,
			}),
		).toEqual({
			interval: "month",
			tierCredits: 400,
		});
		expect(
			previewBillingSubscriptionChangeBodySchema.parse({
				interval: "year",
				plan: "pro",
				tierCredits: 1200,
			}),
		).toEqual({
			interval: "year",
			plan: "pro",
			tierCredits: 1200,
		});
		expect(
			previewBillingSubscriptionChangeBodySchema.safeParse({
				interval: "month",
				plan: "free",
				tierCredits: 100,
			}).success,
		).toBe(false);
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

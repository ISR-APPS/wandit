import {
	apiErrorCodeSchema,
	billingIntervals,
	billingPlanIds,
	billingRoutes,
	CREDIT_COSTS,
	CREDIT_TIERS,
	changeBillingSubscriptionBodySchema,
	ENTITLED_SUBSCRIPTION_STATUSES,
	parsePriceLookupKey,
	priceLookupKey,
	priceUsdFor,
	SIGNUP_GRANT_CREDITS,
	subscriptionSchema,
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
			marketingAssetGeneration: 5,
			videoGeneration: 25,
		});
		expect(SIGNUP_GRANT_CREDITS).toBe(100);
	});

	it("limits subscription entitlement to active and trialing", () => {
		expect(ENTITLED_SUBSCRIPTION_STATUSES).toEqual(["active", "trialing"]);
		expect(ENTITLED_SUBSCRIPTION_STATUSES).not.toContain("past_due");
	});

	it("publishes the past-due checkout code in the API error contract", () => {
		expect(apiErrorCodeSchema.parse("PAYMENT_PAST_DUE")).toBe(
			"PAYMENT_PAST_DUE",
		);
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

	it("accepts an optional plan when changing a subscription", () => {
		expect(
			changeBillingSubscriptionBodySchema.parse({
				interval: "month",
				tierCredits: 400,
			}),
		).toEqual({
			interval: "month",
			tierCredits: 400,
		});
		expect(
			changeBillingSubscriptionBodySchema.parse({
				interval: "year",
				plan: "business",
				tierCredits: 1200,
			}),
		).toEqual({
			interval: "year",
			plan: "business",
			tierCredits: 1200,
		});
		expect(
			changeBillingSubscriptionBodySchema.safeParse({
				interval: "month",
				plan: "free",
				tierCredits: 100,
			}).success,
		).toBe(false);
	});

	it("exports the authenticated subscription sync route", () => {
		expect(billingRoutes.sync).toBe("/api/v1/billing/sync");
	});
});

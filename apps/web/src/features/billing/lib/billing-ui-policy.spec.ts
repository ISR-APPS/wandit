import type { BillingPlanCatalogItem, Subscription } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	areTopupsAvailable,
	getManualGraceNoticeDates,
	getPendingSubscriptionChange,
	getStarterCancelOffer,
	isStarterPlanVisible,
	resolvePlanPickerInterval,
	resolvePlanPickerPaymentMethod,
} from "./billing-ui-policy";

describe("billing UI policy", () => {
	describe("scheduled subscription change", () => {
		const subscription = {
			interval: "month" as const,
			pendingTierCredits: 60 as const,
			plan: "pro" as const,
		};

		it("keeps the target plan and interval separate from current paid benefits", () => {
			expect(
				getPendingSubscriptionChange({
					...subscription,
					pendingInterval: "year",
					pendingPlan: "starter",
				}),
			).toEqual({ interval: "year", plan: "starter", tierCredits: 60 });
		});

		it("preserves same-plan pending changes from older API responses", () => {
			expect(
				getPendingSubscriptionChange({
					...subscription,
					pendingTierCredits: 250,
				}),
			).toEqual({ interval: "month", plan: "pro", tierCredits: 250 });
		});

		it("does not show a scheduled plan without a pending tier", () => {
			expect(
				getPendingSubscriptionChange({
					...subscription,
					pendingPlan: "starter",
					pendingTierCredits: null,
				}),
			).toBeNull();
			expect(getPendingSubscriptionChange(null)).toBeNull();
		});
	});

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

	describe("manual grace notice", () => {
		const now = new Date("2026-08-21T12:00:00.000Z");
		const manualSubscription = {
			currentPeriodEnd: "2026-08-20T12:00:00.000Z",
			entitled: true,
			provider: "manual",
		};

		it("shows for an entitled manual subscription after its paid period", () => {
			expect(getManualGraceNoticeDates(manualSubscription, 3, now)).toEqual({
				accessEndDate: new Date("2026-08-23T12:00:00.000Z"),
				periodEndDate: new Date("2026-08-20T12:00:00.000Z"),
			});
		});

		it("does not special-case a strict zero-day setting", () => {
			expect(getManualGraceNoticeDates(manualSubscription, 0, now)).toEqual({
				accessEndDate: new Date("2026-08-20T12:00:00.000Z"),
				periodEndDate: new Date("2026-08-20T12:00:00.000Z"),
			});
		});

		it.each([
			{
				label: "Stripe subscription",
				subscription: { ...manualSubscription, provider: "stripe" },
			},
			{
				label: "future period end",
				subscription: {
					...manualSubscription,
					currentPeriodEnd: "2026-08-22T12:00:00.000Z",
				},
			},
			{
				label: "non-entitled manual subscription",
				subscription: { ...manualSubscription, entitled: false },
			},
		])("stays hidden for a $label", ({ subscription }) => {
			expect(getManualGraceNoticeDates(subscription, 3, now)).toBeNull();
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

	describe("plan-picker payment method", () => {
		it("defaults to card when both methods are available", () => {
			expect(resolvePlanPickerPaymentMethod(null, true, true)).toBe("card");
		});

		it("honors an available offline selection", () => {
			expect(resolvePlanPickerPaymentMethod("offline", true, true)).toBe(
				"offline",
			);
		});

		it("falls back to the only available method", () => {
			expect(resolvePlanPickerPaymentMethod("card", false, true)).toBe(
				"offline",
			);
			expect(resolvePlanPickerPaymentMethod("offline", true, false)).toBe(
				"card",
			);
		});

		it("returns null when every payment method is disabled", () => {
			expect(resolvePlanPickerPaymentMethod("card", false, false)).toBeNull();
		});
	});
});

const proSubscription: Subscription = {
	cancelAtPeriodEnd: false,
	createdAt: "2026-09-01T00:00:00.000Z",
	currentPeriodEnd: "2026-10-01T00:00:00.000Z",
	currentPeriodStart: "2026-09-01T00:00:00.000Z",
	entitled: true,
	id: "2d8aa13f-512f-41cd-be6d-bd76310cae02",
	interval: "month",
	organizationId: null,
	pendingInterval: null,
	pendingPlan: null,
	pendingTierCredits: null,
	plan: "pro",
	priceLookupKey: "pro_250_month",
	provider: "stripe",
	providerSubscriptionId: "sub_pro",
	status: "active",
	tierCredits: 250,
	updatedAt: "2026-09-01T00:00:00.000Z",
	userId: "user-1",
};
const starterPlan: BillingPlanCatalogItem = {
	basePer100Usd: 15,
	features: { seats: false, teamWorkspace: false },
	id: "starter",
	tiers: [
		{
			annualLookupKey: "starter_60_year",
			annualUsd: 90,
			monthlyLookupKey: "starter_60_month",
			monthlyUsd: 9,
			tierCredits: 60,
		},
	],
};
const eligibleOfferInput = {
	subscription: proSubscription,
	starterPlan,
	isPersonal: true,
	paidSubscriptionsEnabled: true,
};

describe("Starter cancel offer", () => {
	it.each([
		"month",
		"year",
	] as const)("keeps the Pro subscriber's %s interval and uses the catalog tier", (interval) => {
		expect(
			getStarterCancelOffer({
				...eligibleOfferInput,
				subscription: { ...proSubscription, interval },
			}),
		).toEqual({
			interval,
			plan: "starter",
			priceUsd: interval === "month" ? 9 : 90,
			tierCredits: 60,
		});
	});

	it.each([
		{
			label: "Starter subscriber",
			input: { subscription: { ...proSubscription, plan: "starter" as const } },
		},
		{
			label: "pending Starter change",
			input: {
				subscription: {
					...proSubscription,
					pendingPlan: "starter" as const,
					pendingTierCredits: 60 as const,
				},
			},
		},
		{
			label: "manual subscriber",
			input: { subscription: { ...proSubscription, provider: "manual" } },
		},
		{ label: "team workspace", input: { isPersonal: false } },
		{
			label: "disabled paid subscriptions",
			input: { paidSubscriptionsEnabled: false },
		},
		{ label: "missing Starter catalog", input: { starterPlan: undefined } },
		{
			label: "empty Starter tiers",
			input: { starterPlan: { ...starterPlan, tiers: [] } },
		},
		{
			label: "scheduled cancellation",
			input: { subscription: { ...proSubscription, cancelAtPeriodEnd: true } },
		},
		{
			label: "past-due subscriber without entitlement",
			input: {
				subscription: {
					...proSubscription,
					status: "past_due",
					entitled: false,
				},
			},
		},
		{
			label: "workspace without a subscription",
			input: { subscription: null },
		},
		{ label: "unresolved subscription", input: { subscription: undefined } },
	])("has no offer for $label", ({ input }) => {
		expect(
			getStarterCancelOffer({ ...eligibleOfferInput, ...input }),
		).toBeNull();
	});
});

describe("Starter plan visibility", () => {
	it("hides Starter without a subscription even when the initial plan asks for it", () => {
		expect(isStarterPlanVisible(null, "starter")).toBe(false);
		expect(isStarterPlanVisible(undefined, "starter")).toBe(false);
	});
	it("shows Starter to a Pro subscriber who opens the cancel offer", () => {
		expect(isStarterPlanVisible(proSubscription, "starter")).toBe(true);
	});
	it("keeps Starter visible for a current Starter subscriber", () => {
		expect(
			isStarterPlanVisible({ ...proSubscription, plan: "starter" }, undefined),
		).toBe(true);
	});
	it("hides Starter from the usual Pro picker", () => {
		expect(isStarterPlanVisible(proSubscription, undefined)).toBe(false);
	});
	it("shows a pending Starter change without an initial selection", () => {
		expect(
			isStarterPlanVisible(
				{ ...proSubscription, pendingPlan: "starter", pendingTierCredits: 60 },
				undefined,
			),
		).toBe(true);
	});
	it("hides Starter for manual subscribers even with an initial Starter selection", () => {
		expect(
			isStarterPlanVisible(
				{ ...proSubscription, provider: "manual", plan: "starter" },
				"starter",
			),
		).toBe(false);
	});
});

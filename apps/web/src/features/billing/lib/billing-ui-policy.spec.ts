import { describe, expect, it } from "vitest";

import {
	areTopupsAvailable,
	getManualGraceNoticeDates,
	resolvePlanPickerInterval,
	resolvePlanPickerPaymentMethod,
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

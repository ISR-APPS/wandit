import { describe, expect, it } from "vitest";

import {
	subscriptionPriceUsd,
	subscriptionTierLabel,
} from "./user-detail-helpers";

describe("subscription pricing helpers", () => {
	it("prices and labels a yearly Starter subscription", () => {
		const subscription = {
			plan: "starter",
			tierCredits: 60,
			interval: "year",
		} as const;

		expect(subscriptionPriceUsd(subscription)).toBe(90);
		expect(subscriptionTierLabel(subscription)).toBe("60 credits/mo · $90/yr");
	});

	it("keeps legacy Pro tier pricing visible", () => {
		expect(
			subscriptionPriceUsd({
				plan: "pro",
				tierCredits: 250,
				interval: "month",
			}),
		).toBe(25);
	});

	it("returns null for a cross-plan tier", () => {
		expect(
			subscriptionPriceUsd({
				plan: "starter",
				tierCredits: 175,
				interval: "month",
			}),
		).toBeNull();
	});
});

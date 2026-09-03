import { describe, expect, it } from "vitest";

import { getBillingPlanCopy, getBillingPlanName } from "./plan-copy";

const copy = {
	starterName: "Starter",
	starterTagline: "Starter tagline",
	starterFeatures: ["Starter feature"],
	proName: "Pro",
	proTagline: "Pro tagline",
	proFeatures: ["Pro feature"],
	businessName: "Business",
	businessTagline: "Business tagline",
	businessFeatures: ["Business feature"],
};

describe("billing plan copy", () => {
	it.each([
		["starter", "Starter", "Starter tagline", "Starter feature"],
		["pro", "Pro", "Pro tagline", "Pro feature"],
		["business", "Business", "Business tagline", "Business feature"],
	] as const)("maps %s without a binary plan fallback", (planId, name, tagline, feature) => {
		expect(getBillingPlanCopy(planId, copy)).toEqual({
			features: [feature],
			name,
			tagline,
		});
		expect(getBillingPlanName(planId, copy)).toBe(name);
	});
});

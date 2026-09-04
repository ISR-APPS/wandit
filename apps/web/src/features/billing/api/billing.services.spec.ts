import {
	type BillingCancelRequest,
	type BillingPlansResponse,
	type BillingSubscriptionViewResponse,
	billingRoutes,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: {
		get: vi.fn(),
		post: vi.fn(),
	},
}));

import { ApiService } from "@/lib/api-client";
import { cancelBillingSubscription, getBillingPlans } from "./billing.services";

const RESPONSE: BillingSubscriptionViewResponse = {
	balance: {
		balance: 125,
		plan: 100,
		promo: 25,
		settledBalance: 125,
		settledPlan: 100,
		settledPromo: 25,
		settledTopup: 0,
		topup: 0,
	},
	subscription: null,
};

const PLANS_RESPONSE = {
	plans: [
		{
			basePer100Usd: 18,
			features: { seats: false, teamWorkspace: false },
			id: "starter",
			tiers: [
				{
					annualLookupKey: "starter_50_year",
					annualUsd: 90,
					monthlyLookupKey: "starter_50_month",
					monthlyUsd: 9,
					tierCredits: 50,
				},
			],
		},
		{
			basePer100Usd: (25 / 175) * 100,
			features: { seats: false, teamWorkspace: false },
			id: "pro",
			tiers: [
				{
					annualLookupKey: "pro_175_year",
					annualUsd: 250,
					monthlyLookupKey: "pro_175_month",
					monthlyUsd: 25,
					tierCredits: 175,
				},
			],
		},
		{
			basePer100Usd: (50 / 175) * 100,
			features: { seats: true, teamWorkspace: true },
			id: "business",
			tiers: [
				{
					annualLookupKey: "business_175_year",
					annualUsd: 500,
					monthlyLookupKey: "business_175_month",
					monthlyUsd: 50,
					tierCredits: 175,
				},
			],
		},
	],
	topupPacks: [],
} satisfies BillingPlansResponse;

describe("getBillingPlans", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("parses the starter, pro, and business catalog", async () => {
		vi.mocked(ApiService.get).mockResolvedValueOnce(PLANS_RESPONSE);

		await expect(getBillingPlans()).resolves.toEqual(PLANS_RESPONSE);
		expect(ApiService.get).toHaveBeenCalledWith(billingRoutes.plans);
	});
});

describe("cancelBillingSubscription", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("posts the selected reason and trimmed details to the cancel route", async () => {
		const body: BillingCancelRequest = {
			details: "Missing bulk export",
			reason: "missing_features",
		};
		vi.mocked(ApiService.post).mockResolvedValueOnce(RESPONSE);

		await expect(cancelBillingSubscription(body)).resolves.toEqual(RESPONSE);
		expect(ApiService.post).toHaveBeenCalledWith(billingRoutes.cancel, body);
	});

	it("posts a valid reason when optional details are omitted", async () => {
		const body: BillingCancelRequest = { reason: "temporary_pause" };
		vi.mocked(ApiService.post).mockResolvedValueOnce(RESPONSE);

		await cancelBillingSubscription(body);

		expect(ApiService.post).toHaveBeenCalledWith(billingRoutes.cancel, body);
	});
});

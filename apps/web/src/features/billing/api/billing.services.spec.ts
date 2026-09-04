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
import {
	cancelBillingSubscription,
	getBillingPlans,
	getBillingSubscription,
} from "./billing.services";

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
		},
		{
			basePer100Usd: 10,
			features: { seats: false, teamWorkspace: false },
			id: "pro",
			tiers: [
				{
					annualLookupKey: "pro_250_year",
					annualUsd: 250,
					monthlyLookupKey: "pro_250_month",
					monthlyUsd: 25,
					tierCredits: 250,
				},
			],
		},
		{
			basePer100Usd: 20,
			features: { seats: true, teamWorkspace: true },
			id: "business",
			tiers: [
				{
					annualLookupKey: "business_250_year",
					annualUsd: 500,
					monthlyLookupKey: "business_250_month",
					monthlyUsd: 50,
					tierCredits: 250,
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

describe("getBillingSubscription", () => {
	it("preserves scheduled Starter and yearly billing separately from current Pro", async () => {
		const response: BillingSubscriptionViewResponse = {
			...RESPONSE,
			subscription: {
				cancelAtPeriodEnd: false,
				createdAt: "2026-09-01T00:00:00.000Z",
				currentPeriodEnd: "2026-10-01T00:00:00.000Z",
				currentPeriodStart: "2026-09-01T00:00:00.000Z",
				entitled: true,
				id: "2d8aa13f-512f-41cd-be6d-bd76310cae02",
				interval: "month",
				organizationId: null,
				pendingInterval: "year",
				pendingPlan: "starter",
				pendingTierCredits: 60,
				plan: "pro",
				priceLookupKey: "pro_250_month",
				provider: "stripe",
				providerSubscriptionId: "sub_pro",
				status: "active",
				tierCredits: 250,
				updatedAt: "2026-09-01T00:00:00.000Z",
				userId: "user-1",
			},
		};
		vi.mocked(ApiService.get).mockResolvedValueOnce(response);

		await expect(getBillingSubscription()).resolves.toEqual(response);
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

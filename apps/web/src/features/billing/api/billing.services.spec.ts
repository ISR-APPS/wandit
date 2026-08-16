import {
	type BillingCancelRequest,
	type BillingSubscriptionViewResponse,
	billingRoutes,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: {
		post: vi.fn(),
	},
}));

import { ApiService } from "@/lib/api-client";
import { cancelBillingSubscription } from "./billing.services";

const RESPONSE: BillingSubscriptionViewResponse = {
	balance: {
		balance: 125,
		plan: 100,
		promo: 25,
		topup: 0,
	},
	subscription: null,
};

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

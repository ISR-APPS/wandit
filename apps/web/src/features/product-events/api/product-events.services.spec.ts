import {
	type CreateProductEventRequest,
	PRODUCT_EVENTS_ROUTES,
} from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
	ApiService: {
		post: vi.fn(),
	},
}));

import { ApiService } from "@/lib/api-client";
import { createProductEvent } from "./product-events.services";

const REQUEST: CreateProductEventRequest = {
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	kind: "upgrade_clicked",
	properties: { method: "card" },
	surface: "workspace_header",
};

describe("createProductEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("posts the validated contract body to the normalized create route", async () => {
		vi.mocked(ApiService.post).mockResolvedValueOnce(undefined);

		await createProductEvent(REQUEST);

		expect(ApiService.post).toHaveBeenCalledWith(
			`/api${PRODUCT_EVENTS_ROUTES.create}`,
			REQUEST,
			{ skipAuthRedirect: true },
		);
	});

	it("rejects a request that drifts from the shared contract", async () => {
		await expect(
			createProductEvent({
				...REQUEST,
				idempotencyKey: "not-a-uuid",
			}),
		).rejects.toThrowError();

		expect(ApiService.post).not.toHaveBeenCalled();
	});
});

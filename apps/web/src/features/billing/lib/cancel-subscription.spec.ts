import { describe, expect, it } from "vitest";
import { parseBillingCancelRequest } from "./cancel-subscription";

describe("parseBillingCancelRequest", () => {
	it("requires a cancellation reason", () => {
		expect(parseBillingCancelRequest(null, "").success).toBe(false);
	});

	it("requires trimmed non-empty details when the reason is other", () => {
		expect(parseBillingCancelRequest("other", "   ").success).toBe(false);
		expect(
			parseBillingCancelRequest("other", " Needs an export API. "),
		).toEqual(
			expect.objectContaining({
				data: {
					details: "Needs an export API.",
					reason: "other",
				},
				success: true,
			}),
		);
	});

	it("omits blank optional details for a predefined reason", () => {
		expect(parseBillingCancelRequest("too_expensive", "  ")).toEqual(
			expect.objectContaining({
				data: { reason: "too_expensive" },
				success: true,
			}),
		);
	});
});

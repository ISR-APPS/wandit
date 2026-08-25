import { describe, expect, it, vi } from "vitest";

import {
	completeCardCheckoutStart,
	recordOfflineCheckoutStart,
} from "./checkout-product-events";

describe("checkout product events", () => {
	it("waits for card tracking before navigating to the created session", async () => {
		let resolveTracking: (() => void) | undefined;
		const emit = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveTracking = resolve;
				}),
		);
		const navigate = vi.fn();

		const completion = completeCardCheckoutStart(
			"https://checkout.example/session",
			"billing_page",
			emit,
			navigate,
		);

		expect(emit).toHaveBeenCalledWith(
			{ method: "card", surface: "billing_page" },
			"authenticated",
		);
		expect(navigate).not.toHaveBeenCalled();

		resolveTracking?.();
		await completion;

		expect(navigate).toHaveBeenCalledOnce();
		expect(navigate).toHaveBeenCalledWith("https://checkout.example/session");
	});

	it("records a successful offline request with its originating surface", async () => {
		const emit = vi.fn(async () => undefined);

		await recordOfflineCheckoutStart("out_of_credits", emit);

		expect(emit).toHaveBeenCalledWith(
			{ method: "offline", surface: "out_of_credits" },
			"authenticated",
		);
	});
});

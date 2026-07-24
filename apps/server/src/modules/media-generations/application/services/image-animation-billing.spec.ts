import { describe, expect, it, vi } from "vitest";

import {
	createImageAnimationBilling,
	type ImageAnimationBillingDependencies,
} from "./image-animation-billing";

function setup(input?: {
	activeSubscription?: boolean;
	billingDisabled?: boolean;
}) {
	const consumeCredits = vi
		.fn<ImageAnimationBillingDependencies["consumeCredits"]>()
		.mockResolvedValue(undefined);
	const hasActiveSubscription = vi
		.fn<ImageAnimationBillingDependencies["hasActiveSubscription"]>()
		.mockResolvedValue(input?.activeSubscription ?? false);
	const isBillingDisabled = vi
		.fn<ImageAnimationBillingDependencies["isBillingDisabled"]>()
		.mockReturnValue(input?.billingDisabled ?? false);
	const refundCredits = vi
		.fn<ImageAnimationBillingDependencies["refundCredits"]>()
		.mockResolvedValue(undefined);
	const billing = createImageAnimationBilling({
		consumeCredits,
		hasActiveSubscription,
		isBillingDisabled,
		refundCredits,
	});

	return {
		billing,
		consumeCredits,
		hasActiveSubscription,
		isBillingDisabled,
		refundCredits,
	};
}

describe("createImageAnimationBilling", () => {
	it("does not inspect subscriptions or reserve credits when billing is off", async () => {
		const { billing, consumeCredits, hasActiveSubscription } = setup({
			billingDisabled: true,
		});

		await expect(
			billing.reserve("user_1", "attempt_1"),
		).resolves.toBeUndefined();

		expect(hasActiveSubscription).not.toHaveBeenCalled();
		expect(consumeCredits).not.toHaveBeenCalled();
	});

	it("does not reserve credits for an active subscriber", async () => {
		const { billing, consumeCredits, hasActiveSubscription } = setup({
			activeSubscription: true,
		});

		await expect(
			billing.reserve("user_1", "attempt_1"),
		).resolves.toBeUndefined();

		expect(hasActiveSubscription).toHaveBeenCalledWith("user_1");
		expect(consumeCredits).not.toHaveBeenCalled();
	});

	it("reserves exactly 25 credits with a stable idempotency key across retries", async () => {
		const { billing, consumeCredits } = setup();

		await billing.reserve("user_1", "attempt_1");
		await billing.reserve("user_1", "attempt_1");

		expect(consumeCredits).toHaveBeenCalledTimes(2);
		expect(consumeCredits).toHaveBeenNthCalledWith(1, "user_1", 25, {
			idempotencyKey: "media-generation:attempt_1",
			meta: {
				action: "videoGeneration",
				attemptId: "attempt_1",
				reason: "generation_reservation",
			},
		});
		expect(consumeCredits).toHaveBeenNthCalledWith(2, "user_1", 25, {
			idempotencyKey: "media-generation:attempt_1",
			meta: {
				action: "videoGeneration",
				attemptId: "attempt_1",
				reason: "generation_reservation",
			},
		});
	});

	it("settles a prior reservation even when billing is now disabled", async () => {
		const { billing, isBillingDisabled, refundCredits } = setup({
			billingDisabled: true,
		});

		await expect(
			billing.refund("user_1", "attempt_1"),
		).resolves.toBeUndefined();

		expect(isBillingDisabled).not.toHaveBeenCalled();
		expect(refundCredits).toHaveBeenCalledWith(
			"user_1",
			"media-generation:attempt_1",
			{
				attemptId: "attempt_1",
				reason: "image_animation_failed",
			},
		);
	});
});

import { CREDIT_COSTS, mediaGenerationReservationKey } from "@wandit/contracts";

export type ImageGenerationBillingDependencies = {
	consumeCredits: (
		userId: string,
		amount: number,
		options: {
			idempotencyKey: string;
			meta: Record<string, unknown>;
		},
	) => Promise<unknown>;
	hasActiveSubscription: (userId: string) => Promise<boolean>;
	isBillingDisabled: () => boolean;
	refundCredits: (
		userId: string,
		consumeIdempotencyKey: string,
		meta: Record<string, unknown>,
	) => Promise<unknown>;
};

export type ImageGenerationBilling = {
	refund: (userId: string, attemptId: string) => Promise<void>;
	reserve: (userId: string, attemptId: string) => Promise<void>;
};

/**
 * Same reservation policy as image animation, priced at the flat
 * imageGeneration cost per ATTEMPT (not per image — the count cap keeps the
 * spread small). The ledger key is stable across Trigger retries; refunds
 * always consult the ledger even when billing is currently disabled.
 */
export function createImageGenerationBilling(
	dependencies: ImageGenerationBillingDependencies,
): ImageGenerationBilling {
	return {
		async refund(userId, attemptId) {
			await dependencies.refundCredits(
				userId,
				mediaGenerationReservationKey(attemptId),
				{
					attemptId,
					reason: "image_generation_failed",
				},
			);
		},
		async reserve(userId, attemptId) {
			if (dependencies.isBillingDisabled()) {
				return;
			}

			if (await dependencies.hasActiveSubscription(userId)) {
				return;
			}

			await dependencies.consumeCredits(userId, CREDIT_COSTS.imageGeneration, {
				idempotencyKey: mediaGenerationReservationKey(attemptId),
				meta: {
					action: "imageGeneration",
					attemptId,
					reason: "generation_reservation",
				},
			});
		},
	};
}

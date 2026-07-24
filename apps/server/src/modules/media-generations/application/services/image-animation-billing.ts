import { CREDIT_COSTS, mediaGenerationReservationKey } from "@wandit/contracts";

export type ImageAnimationBillingDependencies = {
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

export type ImageAnimationBilling = {
	refund: (userId: string, attemptId: string) => Promise<void>;
	reserve: (userId: string, attemptId: string) => Promise<void>;
};

/**
 * Billing policy shared by the Trigger task and its reconciler.
 *
 * Reservation is deliberately after the queued -> generating CAS in the
 * runner. The ledger key is stable across Trigger retries, so a lost database
 * response cannot consume twice. Refunds always consult the ledger even when
 * billing is currently disabled: an attempt may have reserved while billing
 * was enabled and failed after an operator changed the setting.
 */
export function createImageAnimationBilling(
	dependencies: ImageAnimationBillingDependencies,
): ImageAnimationBilling {
	return {
		async refund(userId, attemptId) {
			await dependencies.refundCredits(
				userId,
				mediaGenerationReservationKey(attemptId),
				{
					attemptId,
					reason: "image_animation_failed",
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

			await dependencies.consumeCredits(userId, CREDIT_COSTS.videoGeneration, {
				idempotencyKey: mediaGenerationReservationKey(attemptId),
				meta: {
					action: "videoGeneration",
					attemptId,
					reason: "generation_reservation",
				},
			});
		},
	};
}

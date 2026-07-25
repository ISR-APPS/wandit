import { CREDIT_COSTS, mediaGenerationReservationKey } from "@wandit/contracts";

export type MarketingAssetBillingDependencies = {
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

export type MarketingAssetBilling = {
	refund: (userId: string, assetId: string) => Promise<void>;
	reserve: (userId: string, assetId: string) => Promise<void>;
};

/**
 * Billing policy for marketing asset generation, mirrored from image
 * animation. Reservation happens after the queued -> generating CAS in the
 * runner; the ledger key is stable across Trigger retries so a lost database
 * response cannot consume twice. Refunds always consult the ledger even when
 * billing is currently disabled: an asset may have reserved while billing
 * was enabled and failed after an operator changed the setting.
 */
export function createMarketingAssetBilling(
	dependencies: MarketingAssetBillingDependencies,
): MarketingAssetBilling {
	return {
		async refund(userId, assetId) {
			await dependencies.refundCredits(
				userId,
				mediaGenerationReservationKey(assetId),
				{
					assetId,
					reason: "marketing_asset_failed",
				},
			);
		},
		async reserve(userId, assetId) {
			if (dependencies.isBillingDisabled()) {
				return;
			}

			if (await dependencies.hasActiveSubscription(userId)) {
				return;
			}

			await dependencies.consumeCredits(
				userId,
				CREDIT_COSTS.marketingAssetGeneration,
				{
					idempotencyKey: mediaGenerationReservationKey(assetId),
					meta: {
						action: "marketingAssetGeneration",
						assetId,
						reason: "generation_reservation",
					},
				},
			);
		},
	};
}

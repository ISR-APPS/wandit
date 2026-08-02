import {
	type BillingAdmissionMode,
	createFixedOperationBilling,
	type FixedOperationBillingDependencies,
	type FixedOperationReservation,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type MarketingAssetReservation = FixedOperationReservation & {
	operation: "marketing";
};

export type MarketingAssetBilling = {
	capture: (
		reservation: MarketingAssetReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (userId: string, assetId: string) => Promise<void>;
	reserve: (
		userId: string,
		assetId: string,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
	) => Promise<MarketingAssetReservation>;
	settle: (
		reservation: MarketingAssetReservation,
		units?: 0 | 1,
	) => Promise<void>;
	settleExisting: (userId: string, assetId: string) => Promise<boolean>;
};

export function createMarketingAssetBilling(
	dependencies: FixedOperationBillingDependencies,
): MarketingAssetBilling {
	const billing = createFixedOperationBilling("marketing", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (userId, assetId) =>
			billing.refund(userId, assetId, "marketing_asset_failed"),
		reserve: async (userId, assetId, parentEventId, billingMode) =>
			(await billing.reserve(userId, assetId, {
				billingMode,
				parentEventId,
			})) as MarketingAssetReservation,
		settle: (reservation, units = 1) => billing.settle(reservation, units),
		settleExisting: (userId, assetId) =>
			billing.settleExisting(userId, assetId),
	};
}

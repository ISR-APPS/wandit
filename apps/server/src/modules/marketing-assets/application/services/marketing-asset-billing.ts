import type { MeteringSubject } from "../../../credits/domain/credit-owner";
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
	refund: (subject: MeteringSubject, assetId: string) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		assetId: string,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
	) => Promise<MarketingAssetReservation>;
	settle: (
		reservation: MarketingAssetReservation,
		units?: 0 | 1,
	) => Promise<void>;
	settleExisting: (subject: MeteringSubject, assetId: string) => Promise<boolean>;
};

export function createMarketingAssetBilling(
	dependencies: FixedOperationBillingDependencies,
): MarketingAssetBilling {
	const billing = createFixedOperationBilling("marketing", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, assetId) =>
			billing.refund(subject, assetId, "marketing_asset_failed"),
		reserve: async (subject, assetId, parentEventId, billingMode) =>
			(await billing.reserve(subject, assetId, {
				billingMode,
				parentEventId,
			})) as MarketingAssetReservation,
		settle: (reservation, units = 1) => billing.settle(reservation, units),
		settleExisting: (subject, assetId) =>
			billing.settleExisting(subject, assetId),
	};
}

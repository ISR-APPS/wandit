import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type BillingAdmissionMode,
	createMeasuredOperationBilling,
	type MeasuredOperationBillingDependencies,
	type MeasuredOperationReservation,
	type MeasuredSettlementInput,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type MarketingAssetReservation = MeasuredOperationReservation & {
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
		units?: 0 | 1 | MeasuredSettlementInput,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		assetId: string,
	) => Promise<boolean>;
};

/**
 * Marketing is one generateText call, so it is token-priced like a chat
 * turn: the reserve is the registry floor and settlement prices the call's
 * usage (or the floor when a recovery has no usage); the gateway cost
 * reconciles the exact charge.
 */
export function createMarketingAssetBilling(
	dependencies: MeasuredOperationBillingDependencies,
): MarketingAssetBilling {
	const billing = createMeasuredOperationBilling("marketing", dependencies);

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

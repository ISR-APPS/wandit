import {
	type BillingAdmissionMode,
	createFixedOperationBilling,
	type FixedOperationBillingDependencies,
	type FixedOperationReservation,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type ImageAnimationReservation = FixedOperationReservation & {
	operation: "video";
};

export type ImageAnimationBilling = {
	capture: (
		reservation: ImageAnimationReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (userId: string, attemptId: string) => Promise<void>;
	reserve: (
		userId: string,
		attemptId: string,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
	) => Promise<ImageAnimationReservation>;
	settle: (
		reservation: ImageAnimationReservation,
		units?: 0 | 1,
	) => Promise<void>;
	settleExisting: (userId: string, attemptId: string) => Promise<boolean>;
};

export function createImageAnimationBilling(
	dependencies: FixedOperationBillingDependencies,
): ImageAnimationBilling {
	const billing = createFixedOperationBilling("video", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (userId, attemptId) =>
			billing.refund(userId, attemptId, "image_animation_failed"),
		reserve: async (userId, attemptId, parentEventId, billingMode) =>
			(await billing.reserve(userId, attemptId, {
				billingMode,
				parentEventId,
			})) as ImageAnimationReservation,
		settle: (reservation, units = 1) => billing.settle(reservation, units),
		settleExisting: (userId, attemptId) =>
			billing.settleExisting(userId, attemptId),
	};
}

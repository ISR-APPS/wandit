import type { MeteringSubject } from "../../../credits/domain/credit-owner";
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
	refund: (subject: MeteringSubject, attemptId: string) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		attemptId: string,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
	) => Promise<ImageAnimationReservation>;
	settle: (
		reservation: ImageAnimationReservation,
		units?: 0 | 1,
	) => Promise<void>;
	settleExisting: (subject: MeteringSubject, attemptId: string) => Promise<boolean>;
};

export function createImageAnimationBilling(
	dependencies: FixedOperationBillingDependencies,
): ImageAnimationBilling {
	const billing = createFixedOperationBilling("video", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId) =>
			billing.refund(subject, attemptId, "image_animation_failed"),
		reserve: async (subject, attemptId, parentEventId, billingMode) =>
			(await billing.reserve(subject, attemptId, {
				billingMode,
				parentEventId,
			})) as ImageAnimationReservation,
		settle: (reservation, units = 1) => billing.settle(reservation, units),
		settleExisting: (subject, attemptId) =>
			billing.settleExisting(subject, attemptId),
	};
}

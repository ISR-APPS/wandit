import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type BillingAdmissionMode,
	createFixedOperationBilling,
	type FixedOperationBillingDependencies,
	type FixedOperationReservation,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type ImageGenerationReservation = FixedOperationReservation & {
	operation: "image";
};

export type ImageGenerationBilling = {
	capture: (
		reservation: ImageGenerationReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (subject: MeteringSubject, attemptId: string) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		attemptId: string,
		count: number,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
	) => Promise<ImageGenerationReservation>;
	settle: (
		reservation: ImageGenerationReservation,
		units?: number,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		attemptId: string,
		count: number,
	) => Promise<boolean>;
};

/** Five credits per provider-completed image, not per attempt or retry. */
export function createImageGenerationBilling(
	dependencies: FixedOperationBillingDependencies,
): ImageGenerationBilling {
	const billing = createFixedOperationBilling("image", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId) =>
			billing.refund(subject, attemptId, "image_generation_failed"),
		reserve: async (subject, attemptId, count, parentEventId, billingMode) =>
			(await billing.reserve(subject, attemptId, {
				billingMode,
				parentEventId,
				units: count,
			})) as ImageGenerationReservation,
		settle: (reservation, units = reservation.units) =>
			billing.settle(reservation, units),
		settleExisting: (subject, attemptId, count) =>
			billing.settleExisting(subject, attemptId, count),
	};
}

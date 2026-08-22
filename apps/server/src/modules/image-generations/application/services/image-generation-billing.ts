import { env } from "@wandit/env/server";

import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type BillingAdmissionMode,
	createMeasuredOperationBilling,
	type MeasuredOperationBillingDependencies,
	type MeasuredOperationReservation,
	type MeasuredSettlementInput,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type ImageGenerationReservation = MeasuredOperationReservation & {
	operation: "image";
};

export type ImageGenerationEstimateInput = {
	/** Source-image edits run on AI_IMAGE_EDIT_MODEL, not AI_IMAGE_MODEL. */
	hasSourceImages?: boolean;
	size?: string;
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
		estimate?: ImageGenerationEstimateInput,
	) => Promise<ImageGenerationReservation>;
	settle: (
		reservation: ImageGenerationReservation,
		units?: number | MeasuredSettlementInput,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		attemptId: string,
		count: number,
	) => Promise<boolean>;
};

/**
 * Measured per provider-completed image: the reserve is the larger of the
 * registry floor and the configured model's per-image catalog rate; the
 * gateway cost reconciles the exact charge.
 */
export function createImageGenerationBilling(
	dependencies: MeasuredOperationBillingDependencies,
): ImageGenerationBilling {
	const billing = createMeasuredOperationBilling("image", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId) =>
			billing.refund(subject, attemptId, "image_generation_failed"),
		reserve: async (
			subject,
			attemptId,
			count,
			parentEventId,
			billingMode,
			estimate,
		) => {
			const modelId =
				estimate?.hasSourceImages && env.AI_IMAGE_EDIT_MODEL
					? env.AI_IMAGE_EDIT_MODEL
					: env.AI_IMAGE_MODEL;
			const quote =
				modelId && dependencies.meteringService.estimateMeasuredCost
					? await dependencies.meteringService.estimateMeasuredCost({
							count,
							kind: "image",
							modelId,
							...(estimate?.size === undefined ? {} : { size: estimate.size }),
						})
					: null;

			return (await billing.reserve(subject, attemptId, {
				billingMode,
				estimateUsdMicros: quote?.costUsdMicros ?? null,
				parentEventId,
				units: count,
			})) as ImageGenerationReservation;
		},
		settle: (reservation, units = reservation.units) =>
			billing.settle(reservation, units),
		settleExisting: (subject, attemptId, count) =>
			billing.settleExisting(subject, attemptId, count),
	};
}

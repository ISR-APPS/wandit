import { videoCostEstimateInput } from "../../../ai-chat/agent/site-builder/generate-video";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type BillingAdmissionMode,
	createMeasuredOperationBilling,
	type MeasuredOperationBillingDependencies,
	type MeasuredOperationReservation,
	type MeasuredSettlementInput,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type ImageAnimationReservation = MeasuredOperationReservation & {
	operation: "video";
};

export type ImageAnimationEstimateInput = {
	durationSeconds?: number | null;
	kind?: "image-animation" | "text-to-video";
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
		estimate?: ImageAnimationEstimateInput,
	) => Promise<ImageAnimationReservation>;
	settle: (
		reservation: ImageAnimationReservation,
		units?: 0 | 1 | MeasuredSettlementInput,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		attemptId: string,
	) => Promise<boolean>;
};

/**
 * Measured per render: the reserve is the larger of the registry floor and
 * duration × the configured model's per-second catalog rate (std mode, no
 * audio); the gateway cost reconciles the exact charge.
 */
export function createImageAnimationBilling(
	dependencies: MeasuredOperationBillingDependencies,
): ImageAnimationBilling {
	const billing = createMeasuredOperationBilling("video", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId) =>
			billing.refund(subject, attemptId, "image_animation_failed"),
		reserve: async (
			subject,
			attemptId,
			parentEventId,
			billingMode,
			estimate,
		) => {
			const input = videoCostEstimateInput(
				estimate?.kind ?? "image-animation",
				estimate?.durationSeconds,
			);
			const quote =
				input && dependencies.meteringService.estimateMeasuredCost
					? await dependencies.meteringService.estimateMeasuredCost(input)
					: null;

			return (await billing.reserve(subject, attemptId, {
				billingMode,
				estimateUsdMicros: quote?.costUsdMicros ?? null,
				parentEventId,
			})) as ImageAnimationReservation;
		},
		settle: (reservation, units = 1) => billing.settle(reservation, units),
		settleExisting: (subject, attemptId) =>
			billing.settleExisting(subject, attemptId),
	};
}

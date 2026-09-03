import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import type {
	BillingAdmissionMode,
	MeasuredOperationBillingDependencies,
	MeasuredOperationReservation,
	MeasuredSettlementInput,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";
import { createVideoBilling, type VideoReservation } from "./video-billing";

export type ImageAnimationReservation = MeasuredOperationReservation & {
	operation: "video";
};

export type ImageAnimationEstimateInput = {
	/** Kling voice control on (talking person / native narration). */
	audio?: boolean | null;
	durationSeconds?: number | null;
	kind?: "image-animation" | "text-to-video";
	/** Renderer resolved upstream (Brain-picked tier) and snapshotted on the row. */
	modelId?: string | null;
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
 * duration × the resolved renderer's per-second catalog rate (std mode);
 * the gateway cost reconciles the exact charge.
 */
export function createImageAnimationBilling(
	dependencies: MeasuredOperationBillingDependencies,
): ImageAnimationBilling {
	const billing = createVideoBilling(dependencies);

	return {
		capture: (reservation, capture) =>
			billing.capture(reservation as VideoReservation, capture),
		refund: (subject, attemptId) =>
			billing.refund(subject, attemptId, "image-animation"),
		reserve: async (subject, attemptId, parentEventId, billingMode, estimate) =>
			(await billing.reserve(
				subject,
				attemptId,
				1,
				parentEventId,
				billingMode,
				{
					audio: estimate?.audio,
					durationSeconds: estimate?.durationSeconds,
					kind: estimate?.kind ?? "image-animation",
					modelId: estimate?.modelId,
				},
			)) as ImageAnimationReservation,
		settle: (reservation, units = 1) =>
			billing.settle(reservation as VideoReservation, units),
		settleExisting: (subject, attemptId) =>
			billing.settleExisting(subject, attemptId),
	};
}

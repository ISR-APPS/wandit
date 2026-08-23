import type { MediaGenerationKind } from "@wandit/contracts";

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
import {
	VIDEO_EDIT_ENGINE_MODEL,
	VIDEO_PRODUCT_ENGINE_MODEL,
	VIDEO_QUALITY_MODELS,
} from "../../domain/video-quality-models";

export type VideoReservationUnits = 1 | 2 | 3;
export type VideoDeliveredUnits = 0 | VideoReservationUnits;

export type VideoReservation = MeasuredOperationReservation & {
	operation: "video";
	units: VideoReservationUnits;
};

export const VIDEO_REFUND_REASON_BY_KIND = {
	"image-animation": "image_animation_failed",
	"text-to-video": "image_animation_failed",
	"video-product": "product_video_failed",
	"video-edit": "video_edit_failed",
	"video-extension": "video_extension_failed",
} as const satisfies Record<MediaGenerationKind, string>;

/**
 * Per-unit render description for the local cost estimate: the resolved
 * renderer, one unit's duration, and whether Kling voice control (native
 * audio) is on. Missing fields fall back to the standard tier of the kind;
 * the gateway cost reconciles the exact charge either way.
 */
export type VideoEstimateHint = {
	audio?: boolean | null;
	durationSeconds?: number | null;
	kind?: MediaGenerationKind;
	modelId?: string | null;
};

export type VideoBilling = {
	capture: (
		reservation: VideoReservation,
		capture: CapturedGeneration,
	) => Promise<void>;
	refund: (
		subject: MeteringSubject,
		attemptId: string,
		kind: MediaGenerationKind,
	) => Promise<void>;
	reserve: (
		subject: MeteringSubject,
		attemptId: string,
		units: VideoReservationUnits,
		parentEventId?: string,
		billingMode?: BillingAdmissionMode,
		estimate?: VideoEstimateHint,
	) => Promise<VideoReservation>;
	settle: (
		reservation: VideoReservation,
		deliveredUnits: VideoDeliveredUnits | MeasuredSettlementInput,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		attemptId: string,
		deliveredUnits?: VideoReservationUnits,
	) => Promise<boolean>;
};

/** The renderer a hint implies when the attempt row predates model snapshots. */
export function defaultVideoModelForKind(
	kind: MediaGenerationKind | undefined,
): string {
	switch (kind) {
		case "video-edit":
			return VIDEO_EDIT_ENGINE_MODEL;
		case "video-product":
			return VIDEO_PRODUCT_ENGINE_MODEL;
		case "text-to-video":
			return VIDEO_QUALITY_MODELS.standard.t2v;
		default:
			return VIDEO_QUALITY_MODELS.standard.i2v;
	}
}

/**
 * Estimate hint for a durable attempt row. An extension bills per leg, so the
 * per-unit duration is the added length split over the reserved legs.
 */
export function videoEstimateHintForAttempt(
	attempt: {
		durationSeconds: number;
		kind: MediaGenerationKind;
		model: string | null;
		sourceDurationMs?: number | null;
		talking?: boolean | null;
	},
	units: VideoReservationUnits,
): VideoEstimateHint {
	let durationSeconds: number | null = attempt.durationSeconds;

	if (attempt.kind === "video-extension") {
		const sourceSeconds =
			typeof attempt.sourceDurationMs === "number" &&
			attempt.sourceDurationMs > 0
				? Math.round(attempt.sourceDurationMs / 1000)
				: 0;
		const added = attempt.durationSeconds - sourceSeconds;
		durationSeconds = added > 0 ? Math.max(1, Math.round(added / units)) : null;
	}

	return {
		audio: attempt.talking === true,
		durationSeconds,
		kind: attempt.kind,
		modelId: attempt.model,
	};
}

/**
 * Shared measured billing for every durable video attempt kind: the reserve
 * is the larger of the registry floor and units × the local per-unit estimate
 * (renderer's per-second catalog rate); the gateway cost reconciles the exact
 * charge. A zero-unit failure settles 0.
 */
export function createVideoBilling(
	dependencies: MeasuredOperationBillingDependencies,
): VideoBilling {
	const billing = createMeasuredOperationBilling("video", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId, kind) =>
			billing.refund(subject, attemptId, VIDEO_REFUND_REASON_BY_KIND[kind]),
		reserve: async (
			subject,
			attemptId,
			units,
			parentEventId,
			billingMode,
			estimate,
		) => {
			assertReservationUnits(units);

			const unitCostUsdMicros = await estimateUnitCostUsdMicros(
				dependencies,
				estimate,
			);

			return (await billing.reserve(subject, attemptId, {
				billingMode,
				estimateUsdMicros:
					unitCostUsdMicros === null ? null : unitCostUsdMicros * units,
				parentEventId,
				units,
			})) as VideoReservation;
		},
		settle: (reservation, deliveredUnits) => {
			if (typeof deliveredUnits === "number") {
				assertDeliveredUnits(deliveredUnits, reservation.units);
				return billing.settle(reservation, deliveredUnits);
			}

			if (deliveredUnits.completedUnits !== undefined) {
				assertDeliveredUnits(deliveredUnits.completedUnits, reservation.units);
			}
			return billing.settle(reservation, deliveredUnits);
		},
		settleExisting: (subject, attemptId, deliveredUnits = 1) => {
			assertReservationUnits(deliveredUnits);
			return billing.settleExisting(subject, attemptId, deliveredUnits);
		},
	};
}

async function estimateUnitCostUsdMicros(
	dependencies: MeasuredOperationBillingDependencies,
	estimate: VideoEstimateHint | undefined,
): Promise<number | null> {
	if (!estimate || !dependencies.meteringService.estimateMeasuredCost) {
		return null;
	}

	const input = videoCostEstimateInput({
		audio: estimate.audio === true,
		durationSeconds: estimate.durationSeconds,
		modelId: estimate.modelId ?? defaultVideoModelForKind(estimate.kind),
	});

	if (!input) {
		return null;
	}

	const quote = await dependencies.meteringService.estimateMeasuredCost(input);
	return quote?.costUsdMicros ?? null;
}

function assertReservationUnits(
	units: number,
): asserts units is VideoReservationUnits {
	if (!Number.isSafeInteger(units) || units < 1 || units > 3) {
		throw new Error("Video reservation units must be an integer from 1 to 3");
	}
}

function assertDeliveredUnits(
	units: number,
	reservedUnits: VideoReservationUnits,
): asserts units is VideoDeliveredUnits {
	if (!Number.isSafeInteger(units) || units < 0 || units > reservedUnits) {
		throw new Error(
			"Video delivered units must be between zero and the reserved units",
		);
	}
}

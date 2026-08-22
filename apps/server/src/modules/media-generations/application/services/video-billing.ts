import type { MediaGenerationKind } from "@wandit/contracts";

import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type BillingAdmissionMode,
	createFixedOperationBilling,
	type FixedOperationBillingDependencies,
	type FixedOperationReservation,
} from "../../../metering/application/services/fixed-operation-billing";
import type { CapturedGeneration } from "../../../metering/domain/metering";

export type VideoReservationUnits = 1 | 2 | 3;
export type VideoDeliveredUnits = 0 | VideoReservationUnits;

export type VideoReservation = FixedOperationReservation & {
	operation: "video";
	units: VideoReservationUnits;
};

export const VIDEO_REFUND_REASON_BY_KIND = {
	"image-animation": "image_animation_failed",
	"text-to-video": "image_animation_failed",
	"video-edit": "video_edit_failed",
	"video-extension": "video_extension_failed",
} as const satisfies Record<MediaGenerationKind, string>;

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
	) => Promise<VideoReservation>;
	settle: (
		reservation: VideoReservation,
		deliveredUnits: VideoDeliveredUnits,
	) => Promise<void>;
	settleExisting: (
		subject: MeteringSubject,
		attemptId: string,
		deliveredUnits?: VideoReservationUnits,
	) => Promise<boolean>;
};

/** Shared fixed-price billing for every durable video attempt kind. */
export function createVideoBilling(
	dependencies: FixedOperationBillingDependencies,
): VideoBilling {
	const billing = createFixedOperationBilling("video", dependencies);

	return {
		capture: (reservation, capture) => billing.capture(reservation, capture),
		refund: (subject, attemptId, kind) =>
			billing.refund(subject, attemptId, VIDEO_REFUND_REASON_BY_KIND[kind]),
		reserve: async (subject, attemptId, units, parentEventId, billingMode) => {
			assertReservationUnits(units);

			return (await billing.reserve(subject, attemptId, {
				billingMode,
				parentEventId,
				units,
			})) as VideoReservation;
		},
		settle: (reservation, deliveredUnits) => {
			assertDeliveredUnits(deliveredUnits, reservation.units);
			return billing.settle(reservation, deliveredUnits);
		},
		settleExisting: (subject, attemptId, deliveredUnits = 1) => {
			assertReservationUnits(deliveredUnits);
			return billing.settleExisting(subject, attemptId, deliveredUnits);
		},
	};
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

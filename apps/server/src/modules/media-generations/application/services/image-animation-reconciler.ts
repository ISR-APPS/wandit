import type { MediaGenerationKind } from "@wandit/contracts";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type ImageAnimationAttempt,
	type ImageAnimationAttemptStatus,
	type ImageAnimationVideo,
	userSafeGenerationError,
} from "./image-animation-runner";
import {
	isLegActivityTrackedGeneration,
	isMediaGenerationGeneratingStale,
	MEDIA_GENERATION_STALE_GENERATING_MS,
	MEDIA_GENERATION_STALE_QUEUED_MS,
	type MediaGenerationGeneratingCutoffs,
	mediaGenerationGeneratingCutoffs,
} from "./media-generation-staleness";
import type {
	VideoBilling,
	VideoDeliveredUnits,
	VideoReservationUnits,
} from "./video-billing";

export const IMAGE_ANIMATION_STALE_QUEUED_MS = MEDIA_GENERATION_STALE_QUEUED_MS;
// More conservative than the same-run retry cutoff: a separately scheduled
// process cannot know whether the original provider call is still unwinding.
// Match the API polling backstop so recovery never races a slow final upload.
export const IMAGE_ANIMATION_RECONCILIATION_STALE_GENERATING_MS =
	MEDIA_GENERATION_STALE_GENERATING_MS["image-animation"];
export const IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE = 100;

export type ImageAnimationReconciliationCategoryLimits = {
	failedRefund: number;
	staleGenerating: number;
	staleQueued: number;
};

export type MediaGenerationReconciliationAttempt = Omit<
	ImageAnimationAttempt,
	"kind"
> & {
	deliveredUnits: VideoDeliveredUnits;
	kind: MediaGenerationKind;
	plannedUnits: VideoReservationUnits;
};

export type ImageAnimationReconciliationCandidate =
	MediaGenerationReconciliationAttempt & {
		reconciliationReason: "failed_refund" | "stale_generating" | "stale_queued";
	};

export type ImageAnimationReconcilerDependencies = {
	failFromStatus: (
		attempt: MediaGenerationReconciliationAttempt,
		input: {
			activityBefore?: Date;
			completedAt: Date;
			error: string;
			expectedStatus: Extract<
				ImageAnimationAttemptStatus,
				"queued" | "generating"
			>;
			reason: string;
		},
	) => Promise<boolean>;
	listCandidates: (input: {
		generatingBefore: MediaGenerationGeneratingCutoffs;
		limit: number;
		queuedBefore: Date;
	}) => Promise<ImageAnimationReconciliationCandidate[]>;
	latestLegActivityAt: (attemptId: string) => Promise<Date | null>;
	markSucceeded: (
		attempt: MediaGenerationReconciliationAttempt,
		video: ImageAnimationVideo,
		completedAt: Date,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredVideo: (
		attempt: Pick<MediaGenerationReconciliationAttempt, "id" | "projectId">,
	) => Promise<ImageAnimationVideo | null>;
	refund: VideoBilling["refund"];
	settleExisting: VideoBilling["settleExisting"];
};

export type ImageAnimationReconciliationResult = {
	failed: number;
	refunded: number;
	recovered: number;
	scanned: number;
	skipped: number;
};

/**
 * Durable safety net for Trigger runs that crash, are canceled, or expire in
 * a status for which Trigger's onFailure hook is not called. Every operation
 * is CAS/idempotent, so a scheduled-task retry can safely replay the batch.
 */

/** The payer for this attempt: the project's org pool when org-owned. */
function candidateSubject(
	candidate: Pick<
		MediaGenerationReconciliationAttempt,
		"organizationId" | "userId"
	>,
): MeteringSubject {
	return {
		actorUserId: candidate.userId,
		...(candidate.organizationId
			? { organizationId: candidate.organizationId }
			: {}),
	};
}

export async function reconcileImageAnimations(
	dependencies: ImageAnimationReconcilerDependencies,
): Promise<ImageAnimationReconciliationResult> {
	const now = dependencies.now();
	const candidates = await dependencies.listCandidates({
		generatingBefore: mediaGenerationGeneratingCutoffs(now),
		limit: IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE,
		queuedBefore: new Date(now.getTime() - IMAGE_ANIMATION_STALE_QUEUED_MS),
	});
	const result: ImageAnimationReconciliationResult = {
		failed: 0,
		refunded: 0,
		recovered: 0,
		scanned: candidates.length,
		skipped: 0,
	};

	for (const candidate of candidates) {
		if (candidate.reconciliationReason === "failed_refund") {
			await settleDeliveredOrRefund(candidate, dependencies, result);
			continue;
		}

		if (candidate.projectDeletedAt !== null) {
			const expectedStatus =
				candidate.reconciliationReason === "stale_queued"
					? "queued"
					: "generating";
			const failed = await dependencies.failFromStatus(candidate, {
				completedAt: now,
				error: userSafeReconciliationError(candidate.kind),
				expectedStatus,
				reason: "project_deleted",
			});

			if (!failed) {
				result.skipped += 1;
				continue;
			}

			result.failed += 1;
			await settleDeliveredOrRefund(candidate, dependencies, result);
			continue;
		}

		if (
			candidate.reconciliationReason === "stale_generating" &&
			isLegActivityTrackedGeneration(candidate.kind)
		) {
			const latestLegActivityAt = await dependencies.latestLegActivityAt(
				candidate.id,
			);

			if (
				!isMediaGenerationGeneratingStale(
					{
						kind: candidate.kind,
						latestLegActivityAt,
						startedAt: candidate.startedAt,
					},
					now,
				)
			) {
				result.skipped += 1;
				continue;
			}
		}

		if (candidate.reconciliationReason === "stale_generating") {
			const recovered = await dependencies.recoverStoredVideo(candidate);

			if (recovered) {
				// Never consult the current kill switch or create a new hold here.
				// The admission-time event is authoritative; billing-off jobs have
				// nothing to settle and must remain free during later recovery.
				await dependencies.settleExisting(
					candidateSubject(candidate),
					candidate.id,
					candidate.plannedUnits,
				);
				// Settlement must precede the user-visible succeeded transition.
				const persisted = await dependencies.markSucceeded(
					candidate,
					recovered,
					now,
				);

				if (persisted) {
					result.recovered += 1;
				} else {
					result.skipped += 1;
				}
				continue;
			}
		}

		const expectedStatus =
			candidate.reconciliationReason === "stale_queued"
				? "queued"
				: "generating";
		const failed = await dependencies.failFromStatus(candidate, {
			...(candidate.reconciliationReason === "stale_generating"
				? {
						activityBefore: new Date(
							now.getTime() -
								MEDIA_GENERATION_STALE_GENERATING_MS[candidate.kind],
						),
					}
				: {}),
			completedAt: now,
			error: userSafeReconciliationError(candidate.kind),
			expectedStatus,
			reason:
				candidate.reconciliationReason === "stale_queued"
					? "stale_queued"
					: "stale_generation",
		});

		if (!failed) {
			result.skipped += 1;
			continue;
		}

		result.failed += 1;
		await settleDeliveredOrRefund(candidate, dependencies, result);
	}

	return result;
}

async function settleDeliveredOrRefund(
	candidate: MediaGenerationReconciliationAttempt,
	dependencies: Pick<
		ImageAnimationReconcilerDependencies,
		"refund" | "settleExisting"
	>,
	result: Pick<ImageAnimationReconciliationResult, "refunded">,
): Promise<void> {
	const subject = candidateSubject(candidate);
	const deliveredUnits = candidate.deliveredUnits;

	if (deliveredUnits !== 0) {
		await dependencies.settleExisting(subject, candidate.id, deliveredUnits);
		return;
	}

	await dependencies.refund(subject, candidate.id, candidate.kind);
	result.refunded += 1;
}

function userSafeReconciliationError(kind: MediaGenerationKind): string {
	if (kind === "video-edit") {
		return "We couldn't finish editing this video. Please try again in a moment.";
	}

	if (kind === "video-extension") {
		return "We couldn't finish extending this video. Please try again in a moment.";
	}

	return userSafeGenerationError(kind);
}

/**
 * Keep all three reconciliation classes moving even if one develops a large
 * backlog. The one extra slot goes to missing refunds, then recovery, then
 * queued handoffs; the total never exceeds the requested batch limit.
 */
export function allocateImageAnimationReconciliationCapacity(
	limit: number,
): ImageAnimationReconciliationCategoryLimits {
	const boundedLimit = Math.max(0, Math.floor(limit));
	const failedRefund = Math.ceil(boundedLimit / 3);
	const remaining = boundedLimit - failedRefund;
	const staleGenerating = Math.ceil(remaining / 2);

	return {
		failedRefund,
		staleGenerating,
		staleQueued: remaining - staleGenerating,
	};
}

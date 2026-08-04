import type { ImageAnimationBilling } from "./image-animation-billing";
import type { MeteringSubject } from "../../../credits/domain/credit-owner";
import {
	type ImageAnimationAttempt,
	type ImageAnimationAttemptStatus,
	type ImageAnimationVideo,
	USER_SAFE_IMAGE_ANIMATION_ERROR,
} from "./image-animation-runner";

export const IMAGE_ANIMATION_STALE_QUEUED_MS = 30 * 60_000;
// More conservative than the same-run retry cutoff: a separately scheduled
// process cannot know whether the original provider call is still unwinding.
// Match the API polling backstop so recovery never races a slow final upload.
export const IMAGE_ANIMATION_RECONCILIATION_STALE_GENERATING_MS = 15 * 60_000;
export const IMAGE_ANIMATION_RECONCILIATION_BATCH_SIZE = 100;

export type ImageAnimationReconciliationCategoryLimits = {
	failedRefund: number;
	staleGenerating: number;
	staleQueued: number;
};

export type ImageAnimationReconciliationCandidate = ImageAnimationAttempt & {
	reconciliationReason: "failed_refund" | "stale_generating" | "stale_queued";
};

export type ImageAnimationReconcilerDependencies = {
	failFromStatus: (
		attempt: ImageAnimationAttempt,
		input: {
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
		generatingBefore: Date;
		limit: number;
		queuedBefore: Date;
	}) => Promise<ImageAnimationReconciliationCandidate[]>;
	markSucceeded: (
		attempt: ImageAnimationAttempt,
		video: ImageAnimationVideo,
		completedAt: Date,
	) => Promise<boolean>;
	now: () => Date;
	recoverStoredVideo: (
		attempt: Pick<ImageAnimationAttempt, "id" | "projectId">,
	) => Promise<ImageAnimationVideo | null>;
	refund: ImageAnimationBilling["refund"];
	settleExisting: ImageAnimationBilling["settleExisting"];
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
	candidate: Pick<ImageAnimationAttempt, "organizationId" | "userId">,
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
		generatingBefore: new Date(
			now.getTime() - IMAGE_ANIMATION_RECONCILIATION_STALE_GENERATING_MS,
		),
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
			await dependencies.refund(candidateSubject(candidate), candidate.id);
			result.refunded += 1;
			continue;
		}

		if (candidate.projectDeletedAt !== null) {
			const expectedStatus =
				candidate.reconciliationReason === "stale_queued"
					? "queued"
					: "generating";
			const failed = await dependencies.failFromStatus(candidate, {
				completedAt: now,
				error: USER_SAFE_IMAGE_ANIMATION_ERROR,
				expectedStatus,
				reason: "project_deleted",
			});

			if (!failed) {
				result.skipped += 1;
				continue;
			}

			result.failed += 1;
			await dependencies.refund(candidateSubject(candidate), candidate.id);
			result.refunded += 1;
			continue;
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
			completedAt: now,
			error: USER_SAFE_IMAGE_ANIMATION_ERROR,
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
		await dependencies.refund(candidateSubject(candidate), candidate.id);
		result.refunded += 1;
	}

	return result;
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

import {
	ENTITLED_SUBSCRIPTION_STATUSES,
	mediaGenerationReservationKey,
} from "@wandit/contracts";
import { and, asc, type createDb, eq, lt, sql } from "@wandit/db";
import { creditLedger } from "@wandit/db/schema/credits";
import { mediaGenerationAttempts } from "@wandit/db/schema/media-generation-attempts";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";

import {
	type AnalyticsCapture,
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../infrastructure/analytics/generation-events";
import {
	getObjectContentType,
	publicAssetUrl,
	siteVideoKey,
} from "../infrastructure/storage/r2";
import { generateBuildVideo } from "../modules/ai-chat/agent/site-builder/generate-video";
import { SubscriptionsRepository } from "../modules/billing/infrastructure/persistence/subscriptions.repository";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
import {
	createImageAnimationBilling,
	type ImageAnimationBilling,
} from "../modules/media-generations/application/services/image-animation-billing";
import {
	allocateImageAnimationReconciliationCapacity,
	type ImageAnimationReconcilerDependencies,
	type ImageAnimationReconciliationCandidate,
} from "../modules/media-generations/application/services/image-animation-reconciler";
import type {
	ImageAnimationAttempt,
	ImageAnimationRunnerDependencies,
	ImageAnimationVideo,
} from "../modules/media-generations/application/services/image-animation-runner";

type TriggerDatabase = ReturnType<typeof createDb>;

const ATTEMPT_COLUMNS = {
	aspect: mediaGenerationAttempts.aspect,
	completedAt: mediaGenerationAttempts.completedAt,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	motion: mediaGenerationAttempts.motion,
	projectDeletedAt: projects.deletedAt,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	triggerRunId: mediaGenerationAttempts.triggerRunId,
	userId: projects.userId,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
} as const;

export type ImageAnimationRuntime = {
	reconciler: ImageAnimationReconcilerDependencies;
	runner: ImageAnimationRunnerDependencies;
};

/**
 * Concrete Trigger runtime adapter. The orchestration stays in pure injected
 * functions; this file is the only place that knows about Drizzle, R2, the AI
 * provider helper, and the existing credit/subscription services.
 */
export function createImageAnimationRuntime(
	db: TriggerDatabase,
	analytics: AnalyticsCapture,
): ImageAnimationRuntime {
	const billing = createBilling(db);
	const persistence = createPersistence(db, analytics);
	const recoverStoredVideo = createStoredVideoRecovery();

	return {
		reconciler: {
			failFromStatus: persistence.failFromStatus,
			listCandidates: persistence.listReconciliationCandidates,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo,
			refund: billing.refund,
		},
		runner: {
			claimQueued: persistence.claimQueued,
			fail: persistence.failFromStatus,
			generate: (attempt, signal) =>
				generateBuildVideo({
					abortSignal: signal,
					aspect: attempt.aspect,
					attemptId: attempt.id,
					imageUrl: attempt.sourceImageUrl,
					index: 1,
					motion: attempt.motion,
					motionPrompt: attempt.prompt,
					profile: "image-animation",
					projectId: attempt.projectId,
				}),
			loadAttempt: persistence.loadAttempt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo,
			refund: billing.refund,
			reserve: billing.reserve,
		},
	};
}

function createBilling(db: TriggerDatabase): ImageAnimationBilling {
	const creditsService = new CreditsService(new CreditsRepository(db));
	const subscriptionsRepository = new SubscriptionsRepository(db);

	return createImageAnimationBilling({
		consumeCredits: (userId, amount, options) =>
			creditsService.consume(userId, amount, options),
		hasActiveSubscription: async (userId) => {
			const subscription =
				await subscriptionsRepository.findActiveByUserId(userId);

			return (
				subscription !== null &&
				(ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]).includes(
					subscription.status,
				)
			);
		},
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		refundCredits: (userId, consumeIdempotencyKey, meta) =>
			creditsService.refundConsume(userId, consumeIdempotencyKey, meta),
	});
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
	const loadAttempt = async (
		attemptId: string,
	): Promise<ImageAnimationAttempt | null> => {
		const [row] = await db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(eq(mediaGenerationAttempts.id, attemptId))
			.limit(1);

		return row ?? null;
	};

	const claimQueued = async (
		attempt: ImageAnimationAttempt,
		input: { runId: string; startedAt: Date },
	): Promise<ImageAnimationAttempt | null> => {
		const [claimed] = await db
			.update(mediaGenerationAttempts)
			.set({
				error: null,
				startedAt: input.startedAt,
				status: "generating",
				triggerRunId: input.runId,
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attempt.id),
					eq(mediaGenerationAttempts.projectId, attempt.projectId),
					eq(mediaGenerationAttempts.status, "queued"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		return claimed ? loadAttempt(claimed.id) : null;
	};

	const markSucceeded = async (
		attempt: ImageAnimationAttempt,
		video: ImageAnimationVideo,
		completedAt: Date,
	): Promise<boolean> => {
		const [updated] = await db
			.update(mediaGenerationAttempts)
			.set({
				completedAt,
				error: null,
				status: "succeeded",
				videoMediaType: video.mediaType,
				videoUrl: video.url,
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attempt.id),
					eq(mediaGenerationAttempts.projectId, attempt.projectId),
					eq(mediaGenerationAttempts.status, "generating"),
					sql`exists (
						select 1
						from ${projects}
						where ${projects.id} = ${mediaGenerationAttempts.projectId}
							and ${projects.userId} = ${attempt.userId}
							and ${projects.deletedAt} is null
					)`,
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		if (updated) {
			captureGenerationCompleted(
				analytics,
				attempt.userId,
				"animation",
				attempt.projectId,
				attempt.id,
			);
		}

		return Boolean(updated);
	};

	const failFromStatus = async (
		attempt: ImageAnimationAttempt,
		input: {
			completedAt: Date;
			error: string;
			expectedStatus: "queued" | "generating";
			reason: string;
		},
	): Promise<boolean> => {
		const [updated] = await db
			.update(mediaGenerationAttempts)
			.set({
				completedAt: input.completedAt,
				error: input.error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attempt.id),
					eq(mediaGenerationAttempts.projectId, attempt.projectId),
					eq(mediaGenerationAttempts.status, input.expectedStatus),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		if (updated) {
			captureGenerationFailed(
				analytics,
				attempt.userId,
				"animation",
				attempt.projectId,
				attempt.id,
				input.reason,
			);
		}

		return Boolean(updated);
	};

	const listReconciliationCandidates = async (input: {
		generatingBefore: Date;
		limit: number;
		queuedBefore: Date;
	}): Promise<ImageAnimationReconciliationCandidate[]> => {
		const capacity = allocateImageAnimationReconciliationCapacity(input.limit);
		const failed =
			capacity.failedRefund === 0
				? []
				: await db
						.select(ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "failed"),
								missingImageAnimationRefund(),
							),
						)
						.orderBy(asc(mediaGenerationAttempts.completedAt))
						.limit(capacity.failedRefund);
		const generating =
			capacity.staleGenerating === 0
				? []
				: await db
						.select(ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "generating"),
								lt(mediaGenerationAttempts.startedAt, input.generatingBefore),
							),
						)
						.orderBy(asc(mediaGenerationAttempts.startedAt))
						.limit(capacity.staleGenerating);
		const queued =
			capacity.staleQueued === 0
				? []
				: await db
						.select(ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "queued"),
								lt(mediaGenerationAttempts.createdAt, input.queuedBefore),
							),
						)
						.orderBy(asc(mediaGenerationAttempts.createdAt))
						.limit(capacity.staleQueued);

		return [
			...failed.map((attempt) => ({
				...attempt,
				reconciliationReason: "failed_refund" as const,
			})),
			...generating.map((attempt) => ({
				...attempt,
				reconciliationReason: "stale_generating" as const,
			})),
			...queued.map((attempt) => ({
				...attempt,
				reconciliationReason: "stale_queued" as const,
			})),
		];
	};

	return {
		claimQueued,
		failFromStatus,
		listReconciliationCandidates,
		loadAttempt,
		markSucceeded,
	};
}

/**
 * A failed row is a settlement candidate only when a reservation ledger row
 * exists without its matching refund. This avoids rescanning the same
 * terminal rows forever while still recovering refunds missed by crashes.
 */
function missingImageAnimationRefund() {
	const baseKey = sql`(${mediaGenerationReservationKey("")} || ${mediaGenerationAttempts.id}::text)`;

	return sql<boolean>`exists (
		select 1
		from ${creditLedger} as consumed
		where consumed.user_id = ${projects.userId}
			and consumed.idempotency_key in (
				${baseKey} || ':plan',
				${baseKey} || ':topup'
			)
			and not exists (
				select 1
				from ${creditLedger} as refunded
				where refunded.user_id = consumed.user_id
					and refunded.idempotency_key = ('refund:' || consumed.idempotency_key)
			)
	)`;
}

function createStoredVideoRecovery() {
	return async (
		attempt: Pick<ImageAnimationAttempt, "id" | "projectId">,
	): Promise<ImageAnimationVideo | null> => {
		for (const candidate of [
			{ extension: "mp4", mediaType: "video/mp4" },
			{ extension: "webm", mediaType: "video/webm" },
		] as const) {
			const key = siteVideoKey(
				attempt.projectId,
				attempt.id,
				1,
				candidate.extension,
			);
			const storedMediaType = await getObjectContentType(key);

			if (!storedMediaType) {
				continue;
			}

			return {
				mediaType: storedMediaType.startsWith("video/")
					? storedMediaType
					: candidate.mediaType,
				url: publicAssetUrl(key),
			};
		}

		return null;
	};
}

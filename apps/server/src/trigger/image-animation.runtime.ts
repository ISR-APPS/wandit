// This runtime is imported only by Trigger tasks, so the SDK logger is safe.
import { logger } from "@trigger.dev/sdk";
import { and, asc, type createDb, eq, inArray, lt, or, sql } from "@wandit/db";
import {
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";
import { mediaGenerationAttempts } from "@wandit/db/schema/media-generation-attempts";
import { mediaGenerationLegs } from "@wandit/db/schema/media-generation-legs";
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
import {
	generateBuildVideo,
	generateTextToVideo,
	VIDEO_NEGATIVE_PROMPT,
} from "../modules/ai-chat/agent/site-builder/generate-video";
import {
	createImageAnimationBilling,
	type ImageAnimationBilling,
} from "../modules/media-generations/application/services/image-animation-billing";
import {
	allocateImageAnimationReconciliationCapacity,
	type ImageAnimationReconcilerDependencies,
	type ImageAnimationReconciliationCandidate,
	type MediaGenerationReconciliationAttempt,
} from "../modules/media-generations/application/services/image-animation-reconciler";
import type {
	ImageAnimationAttempt,
	ImageAnimationRunnerDependencies,
	ImageAnimationVideo,
} from "../modules/media-generations/application/services/image-animation-runner";
import type { MediaGenerationGeneratingCutoffs } from "../modules/media-generations/application/services/media-generation-staleness";
import {
	createVideoBilling,
	type VideoDeliveredUnits,
	type VideoReservationUnits,
} from "../modules/media-generations/application/services/video-billing";
import { resolveVideoGenerationPlan } from "../modules/media-generations/domain/video-quality-models";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

const MEDIA_GENERATION_RECONCILIATION_KINDS = [
	"image-animation",
	"text-to-video",
	"video-edit",
	"video-extension",
] as const;

const ATTEMPT_COLUMNS = {
	aspect: mediaGenerationAttempts.aspect,
	completedAt: mediaGenerationAttempts.completedAt,
	durationSeconds: mediaGenerationAttempts.durationSeconds,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	kind: mediaGenerationAttempts.kind,
	model: mediaGenerationAttempts.model,
	motion: mediaGenerationAttempts.motion,
	organizationId: projects.organizationId,
	projectDeletedAt: projects.deletedAt,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	quality: mediaGenerationAttempts.quality,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	talking: mediaGenerationAttempts.talking,
	triggerRunId: mediaGenerationAttempts.triggerRunId,
	userId: projects.userId,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
	voiceover: mediaGenerationAttempts.voiceover,
} as const;

const RECONCILIATION_ATTEMPT_COLUMNS = {
	...ATTEMPT_COLUMNS,
	deliveredUnits: sql<number>`greatest(
		case
			when ${mediaGenerationAttempts.kind} = 'video-extension' then (
				select count(*)::integer
				from ${mediaGenerationLegs}
				where ${mediaGenerationLegs.attemptId} = ${mediaGenerationAttempts.id}
					and ${mediaGenerationLegs.status} = 'succeeded'
			)
			else 0
		end,
		coalesce((
			select sum(
				case
					when jsonb_typeof(${aiUsageGenerationRefs.stepUsage} -> 'metering' -> 'fixedUnits') = 'number'
					then (${aiUsageGenerationRefs.stepUsage} -> 'metering' ->> 'fixedUnits')::integer
					else 0
				end
			)::integer
			from ${aiUsageGenerationRefs}
			inner join ${aiUsageEvents}
				on ${aiUsageEvents.id} = ${aiUsageGenerationRefs.usageEventId}
			where ${aiUsageEvents.idempotencyKey} = ('video:' || ${mediaGenerationAttempts.id}::text)
		), 0)
	)`,
	plannedUnits: sql<number>`case
		when ${mediaGenerationAttempts.kind} = 'video-extension' then (
			select count(*)::integer
			from ${mediaGenerationLegs}
			where ${mediaGenerationLegs.attemptId} = ${mediaGenerationAttempts.id}
		)
		else 1
	end`,
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
	const reconciliationBilling = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
	});
	const persistence = createPersistence(db, analytics);
	const recoverStoredVideo = createStoredVideoRecovery();

	return {
		reconciler: {
			failFromStatus: persistence.failFromStatus,
			listCandidates: persistence.listReconciliationCandidates,
			latestLegActivityAt: persistence.latestLegActivityAt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo,
			refund: reconciliationBilling.refund,
			settleExisting: reconciliationBilling.settleExisting,
		},
		runner: {
			capture: billing.capture,
			claimQueued: persistence.claimQueued,
			fail: persistence.failFromStatus,
			generate: (attempt, subject, signal, onProviderGeneration) => {
				// Metering identity comes from the queue-time subject: the acting
				// member (not the project creator) with the paying entity.
				const metering = {
					operation: "video" as const,
					organizationId: subject.organizationId ?? null,
					userId: subject.actorUserId,
				};
				const durationSeconds = normalizeVideoDuration(attempt.durationSeconds);
				// Rows created before model snapshots landed are still renderable. Resolve
				// the standard tier by kind (and let the cap resolver defend duration)
				// instead of consulting the now-retired environment model switches.
				const modelId =
					attempt.model ??
					resolveVideoGenerationPlan({
						durationSeconds,
						kind: attempt.kind === "text-to-video" ? "t2v" : "i2v",
						multiShot: false,
						narration: false,
						quality: "standard",
						talking: false,
					}).modelId;
				const voiceControl =
					(attempt.talking ?? false) || Boolean(attempt.voiceover?.script);

				if (attempt.kind === "text-to-video") {
					return generateTextToVideo({
						abortSignal: signal,
						aspect: attempt.aspect,
						attemptId: attempt.id,
						durationSeconds,
						index: 1,
						metering,
						modelId,
						negativePrompt: VIDEO_NEGATIVE_PROMPT,
						...(onProviderGeneration ? { onProviderGeneration } : {}),
						prompt: attempt.prompt,
						projectId: attempt.projectId,
						voiceControl,
					}).then((result) => {
						if (result.status === "generated" && result.warnings?.length) {
							logger.warn(
								`Text-to-video ${attempt.id}: provider ignored settings`,
								{ warnings: result.warnings },
							);
						}
						return result;
					});
				}

				if (attempt.sourceImageUrl === null) {
					// The DB kind CHECK makes this unreachable; guard anyway so a
					// broken row fails cleanly instead of hitting the provider.
					return Promise.resolve({
						message: "image animation row is missing its source image",
						status: "failed" as const,
					});
				}

				return generateBuildVideo({
					abortSignal: signal,
					aspect: attempt.aspect,
					attemptId: attempt.id,
					imageUrl: attempt.sourceImageUrl,
					index: 1,
					metering,
					modelId,
					motion: attempt.motion ?? "balanced",
					motionPrompt: attempt.prompt,
					...(onProviderGeneration ? { onProviderGeneration } : {}),
					profile: "image-animation",
					projectId: attempt.projectId,
					voiceControl,
				});
			},
			loadAttempt: persistence.loadAttempt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo,
			refund: billing.refund,
			reserve: billing.reserve,
			settle: billing.settle,
			settleExisting: billing.settleExisting,
		},
	};
}

function normalizeVideoDuration(durationSeconds: number): 5 | 10 | 15 {
	if (durationSeconds === 10 || durationSeconds === 15) {
		return durationSeconds;
	}

	return 5;
}

function createBilling(db: TriggerDatabase): ImageAnimationBilling {
	return createImageAnimationBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
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

		if (!row) {
			return null;
		}

		if (!isImageAnimationAttempt(row)) {
			throw new Error(
				`Legacy image-animation runtime cannot process ${row.kind} attempt ${row.id}`,
			);
		}

		return row;
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
		attempt: ImageAnimationAttempt | MediaGenerationReconciliationAttempt,
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
				attempt.kind === "image-animation" ? "animation" : "video",
				attempt.projectId,
				attempt.id,
			);
		}

		return Boolean(updated);
	};

	const failFromStatus = async (
		attempt: ImageAnimationAttempt | MediaGenerationReconciliationAttempt,
		input: {
			activityBefore?: Date;
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
					input.activityBefore === undefined
						? undefined
						: lt(mediaGenerationAttempts.startedAt, input.activityBefore),
					input.activityBefore === undefined
						? undefined
						: noLegActivityAtOrAfter(input.activityBefore),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });

		if (updated) {
			captureGenerationFailed(
				analytics,
				attempt.userId,
				attempt.kind === "image-animation" ? "animation" : "video",
				attempt.projectId,
				attempt.id,
				input.reason,
			);
		}

		return Boolean(updated);
	};

	const latestLegActivityAt = async (
		attemptId: string,
	): Promise<Date | null> => {
		const [row] = await db
			.select({
				activityAt:
					sql<Date | null>`max(greatest(${mediaGenerationLegs.startedAt}, ${mediaGenerationLegs.completedAt}))`.mapWith(
						mediaGenerationLegs.startedAt,
					),
			})
			.from(mediaGenerationLegs)
			.where(eq(mediaGenerationLegs.attemptId, attemptId));

		return row?.activityAt ?? null;
	};

	const listReconciliationCandidates = async (input: {
		generatingBefore: MediaGenerationGeneratingCutoffs;
		limit: number;
		queuedBefore: Date;
	}): Promise<ImageAnimationReconciliationCandidate[]> => {
		const capacity = allocateImageAnimationReconciliationCapacity(input.limit);
		const failed =
			capacity.failedRefund === 0
				? []
				: await db
						.select(RECONCILIATION_ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "failed"),
								inArray(
									mediaGenerationAttempts.kind,
									MEDIA_GENERATION_RECONCILIATION_KINDS,
								),
								missingImageAnimationRefund(),
							),
						)
						.orderBy(asc(mediaGenerationAttempts.completedAt))
						.limit(capacity.failedRefund);
		const generating =
			capacity.staleGenerating === 0
				? []
				: await db
						.select(RECONCILIATION_ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "generating"),
								inArray(
									mediaGenerationAttempts.kind,
									MEDIA_GENERATION_RECONCILIATION_KINDS,
								),
								or(
									and(
										eq(mediaGenerationAttempts.kind, "image-animation"),
										lt(
											mediaGenerationAttempts.startedAt,
											input.generatingBefore["image-animation"],
										),
									),
									and(
										eq(mediaGenerationAttempts.kind, "text-to-video"),
										lt(
											mediaGenerationAttempts.startedAt,
											input.generatingBefore["text-to-video"],
										),
									),
									and(
										eq(mediaGenerationAttempts.kind, "video-edit"),
										lt(
											mediaGenerationAttempts.startedAt,
											input.generatingBefore["video-edit"],
										),
										noLegActivityAtOrAfter(
											input.generatingBefore["video-edit"],
										),
									),
									and(
										eq(mediaGenerationAttempts.kind, "video-extension"),
										lt(
											mediaGenerationAttempts.startedAt,
											input.generatingBefore["video-extension"],
										),
										noLegActivityAtOrAfter(
											input.generatingBefore["video-extension"],
										),
									),
								),
							),
						)
						.orderBy(asc(mediaGenerationAttempts.startedAt))
						.limit(capacity.staleGenerating);
		const queued =
			capacity.staleQueued === 0
				? []
				: await db
						.select(RECONCILIATION_ATTEMPT_COLUMNS)
						.from(mediaGenerationAttempts)
						.innerJoin(
							projects,
							eq(projects.id, mediaGenerationAttempts.projectId),
						)
						.where(
							and(
								eq(mediaGenerationAttempts.status, "queued"),
								inArray(
									mediaGenerationAttempts.kind,
									MEDIA_GENERATION_RECONCILIATION_KINDS,
								),
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
		].map(toImageAnimationReconciliationCandidate);
	};

	return {
		claimQueued,
		failFromStatus,
		latestLegActivityAt,
		listReconciliationCandidates,
		loadAttempt,
		markSucceeded,
	};
}

function noLegActivityAtOrAfter(cutoff: Date) {
	return sql<boolean>`not exists (
		select 1
		from ${mediaGenerationLegs}
		where ${mediaGenerationLegs.attemptId} = ${mediaGenerationAttempts.id}
			and (
				${mediaGenerationLegs.startedAt} >= ${cutoff}
				or ${mediaGenerationLegs.completedAt} >= ${cutoff}
			)
	)`;
}

function isImageAnimationAttempt<T extends { kind: string }>(
	attempt: T,
): attempt is T & { kind: ImageAnimationAttempt["kind"] } {
	return attempt.kind === "image-animation" || attempt.kind === "text-to-video";
}

function toImageAnimationReconciliationCandidate(
	attempt: {
		deliveredUnits: number;
		kind: string;
		plannedUnits: number;
		reconciliationReason: string;
	} & Record<string, unknown>,
): ImageAnimationReconciliationCandidate {
	if (!isMediaGenerationReconciliationKind(attempt.kind)) {
		throw new Error(`Unsupported reconciliation kind ${attempt.kind}`);
	}

	const plannedUnits = videoReservationUnits(attempt.plannedUnits);
	const deliveredUnits = videoDeliveredUnits(
		attempt.deliveredUnits,
		plannedUnits,
	);

	return {
		...attempt,
		deliveredUnits,
		kind: attempt.kind,
		plannedUnits,
	} as ImageAnimationReconciliationCandidate;
}

function isMediaGenerationReconciliationKind(
	kind: string,
): kind is (typeof MEDIA_GENERATION_RECONCILIATION_KINDS)[number] {
	return MEDIA_GENERATION_RECONCILIATION_KINDS.some(
		(candidate) => candidate === kind,
	);
}

function videoReservationUnits(units: number): VideoReservationUnits {
	if (!Number.isSafeInteger(units) || units < 1 || units > 3) {
		throw new Error(
			"Reconciled video must reserve between one and three units",
		);
	}

	return units as VideoReservationUnits;
}

function videoDeliveredUnits(
	units: number,
	plannedUnits: VideoReservationUnits,
): VideoDeliveredUnits {
	if (!Number.isSafeInteger(units) || units < 0 || units > plannedUnits) {
		throw new Error("Reconciled delivered units exceed the video plan");
	}

	return units as VideoDeliveredUnits;
}

/**
 * A failed row is a settlement candidate only when a reservation ledger row
 * exists without its matching refund. This avoids rescanning the same
 * terminal rows forever while still recovering refunds missed by crashes.
 */
function missingImageAnimationRefund() {
	// Payer-aware: org attempts match the org pool's event (the reserving
	// member may differ from the project creator); personal attempts keep the
	// strict user match.
	return sql<boolean>`exists (
		select 1
		from ${aiUsageEvents} as usage_event
		where usage_event.idempotency_key = ('video:' || ${mediaGenerationAttempts.id}::text)
			and usage_event.status = 'reserved'
			and (
				(${projects.organizationId} is not null
					and usage_event.organization_id = ${projects.organizationId})
				or (${projects.organizationId} is null
					and usage_event.organization_id is null
					and usage_event.user_id = ${projects.userId})
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

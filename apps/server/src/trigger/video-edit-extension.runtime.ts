// This runtime is imported only by Trigger tasks, so SDK logging is safe.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { logger } from "@trigger.dev/sdk";
import { and, asc, type createDb, eq, isNull, sql } from "@wandit/db";
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
	deleteObject,
	downloadObjectToFile,
	getObjectContentType,
	IMMUTABLE_ASSET_CACHE_CONTROL,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	putSiteFile,
	siteVideoFrameKey,
	siteVideoKey,
	siteVideoSegmentKey,
	siteVideoSoundtrackKey,
} from "../infrastructure/storage/r2";
import { editVideo } from "../modules/ai-chat/agent/site-builder/edit-video";
import { generateBuildVideo } from "../modules/ai-chat/agent/site-builder/generate-video";
import type { MeteringSubject } from "../modules/credits/domain/credit-owner";
import { SpeechService } from "../modules/generation/application/services/speech.service";
import { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import { LifecycleEventsRepository } from "../modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import {
	createVideoBilling,
	type VideoReservation,
	type VideoReservationUnits,
} from "../modules/media-generations/application/services/video-billing";
import {
	type VideoWorkflowAttempt,
	type VideoWorkflowExecutionResult,
	type VideoWorkflowProgress,
	type VideoWorkflowRunnerDependencies,
	VideoWorkflowSettlementPendingError,
	type VideoWorkflowVideo,
} from "../modules/media-generations/application/services/video-edit-extension-runner";
import {
	concatSegments,
	extractLastFrame,
	isMp4VideoProbe,
	muxSoundtrack,
	normalizeSegment,
	probeVideo,
	withVideoProcessingTempDir,
} from "../modules/media-generations/application/services/video-processing";
import {
	fixedGenerationStepUsage,
	hasGatewayGenerationMetadata,
} from "../modules/metering/domain/gateway-metering";
import { helperStepUsage } from "../modules/metering/domain/metering";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

const ATTEMPT_COLUMNS = {
	actualDurationMs: mediaGenerationAttempts.actualDurationMs,
	aspect: mediaGenerationAttempts.aspect,
	chainDepth: mediaGenerationAttempts.chainDepth,
	completedAt: mediaGenerationAttempts.completedAt,
	createdAt: mediaGenerationAttempts.createdAt,
	durationSeconds: mediaGenerationAttempts.durationSeconds,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	kind: mediaGenerationAttempts.kind,
	model: mediaGenerationAttempts.model,
	organizationId: projects.organizationId,
	projectDeletedAt: projects.deletedAt,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	quality: mediaGenerationAttempts.quality,
	sourceAttemptId: mediaGenerationAttempts.sourceAttemptId,
	sourceDurationMs: mediaGenerationAttempts.sourceDurationMs,
	sourceVideoMediaType: mediaGenerationAttempts.sourceVideoMediaType,
	sourceVideoUrl: mediaGenerationAttempts.sourceVideoUrl,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	talking: mediaGenerationAttempts.talking,
	triggerRunId: mediaGenerationAttempts.triggerRunId,
	userId: projects.userId,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
	voiceover: mediaGenerationAttempts.voiceover,
} as const;

const VOICEOVER_TTS_TIMEOUT_MS = 2 * 60_000;

const LEG_COLUMNS = {
	attemptId: mediaGenerationLegs.attemptId,
	completedAt: mediaGenerationLegs.completedAt,
	durationSeconds: mediaGenerationLegs.durationSeconds,
	error: mediaGenerationLegs.error,
	id: mediaGenerationLegs.id,
	model: mediaGenerationLegs.model,
	segmentKey: mediaGenerationLegs.segmentKey,
	seq: mediaGenerationLegs.seq,
	sourceFrameKey: mediaGenerationLegs.sourceFrameKey,
	startedAt: mediaGenerationLegs.startedAt,
	status: mediaGenerationLegs.status,
} as const;

type VideoWorkflowLeg = {
	attemptId: string;
	completedAt: Date | null;
	durationSeconds: 5 | 10;
	error: string | null;
	id: string;
	model: string;
	segmentKey: string | null;
	seq: number;
	sourceFrameKey: string | null;
	startedAt: Date | null;
	status: "queued" | "generating" | "succeeded" | "failed";
};

export type VideoWorkflowRuntime = {
	runner: VideoWorkflowRunnerDependencies;
};

export function createVideoWorkflowRuntime(
	db: TriggerDatabase,
	analytics: AnalyticsCapture,
): VideoWorkflowRuntime {
	const billing = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
	});
	const persistence = createPersistence(db, analytics);
	const speech = new SpeechService();

	return {
		runner: {
			claimQueued: persistence.claimQueued,
			completedUnitsForAttempt: async (attempt) => {
				const storedUnits =
					attempt.kind === "video-edit"
						? 0
						: (await persistence.listLegs(attempt.id)).filter(
								(leg) => leg.status === "succeeded",
							).length;
				const evidenceUnits = await persistence.providerEvidenceUnits(
					attempt.id,
				);
				return asDeliveredUnits(Math.max(storedUnits, evidenceUnits));
			},
			execute: (attempt, input) =>
				executeAttempt(attempt, input, {
					billing,
					persistence,
					speech,
				}),
			fail: persistence.fail,
			loadAttempt: persistence.loadAttempt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo: createStoredFinalRecovery(),
			refund: billing.refund,
			reserve: billing.reserve,
			settle: billing.settle,
			settleExisting: billing.settleExisting,
			unitsForAttempt: async (attempt) => {
				if (attempt.kind === "video-edit") {
					return 1;
				}
				return asReservationUnits(
					(await persistence.listLegs(attempt.id)).length,
				);
			},
		},
	};
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
	const lifecycleEvents = new LifecycleEventsService(
		new LifecycleEventsRepository(db),
	);

	const loadAttempt = async (
		attemptId: string,
	): Promise<VideoWorkflowAttempt | null> => {
		const [row] = await db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(eq(mediaGenerationAttempts.id, attemptId))
			.limit(1);

		if (!row) {
			return null;
		}
		if (row.kind !== "video-edit" && row.kind !== "video-extension") {
			throw new Error(
				`Video workflow runtime cannot process ${row.kind} attempt ${row.id}`,
			);
		}
		return row as VideoWorkflowAttempt;
	};

	const claimQueued = async (
		attempt: VideoWorkflowAttempt,
		input: { runId: string; startedAt: Date },
	): Promise<VideoWorkflowAttempt | null> => {
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

	const fail = async (
		attempt: VideoWorkflowAttempt,
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
				"video",
				attempt.projectId,
				attempt.id,
				input.reason,
			);
		}
		return Boolean(updated);
	};

	const markSucceeded = async (
		attempt: VideoWorkflowAttempt,
		video: VideoWorkflowVideo,
		completedAt: Date,
		actorUserId: string,
	): Promise<boolean> => {
		const updated = await db.transaction(async (transaction) => {
			const [succeeded] = await transaction
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
							select 1 from ${projects}
							where ${projects.id} = ${mediaGenerationAttempts.projectId}
								and ${projects.deletedAt} is null
						)`,
					),
				)
				.returning({ id: mediaGenerationAttempts.id });

			if (succeeded) {
				await lifecycleEvents.enqueue(
					{
						event: "video_generated",
						idempotencyKey: `video_generated:${actorUserId}`,
						userId: actorUserId,
					},
					transaction,
				);
			}

			return succeeded;
		});

		if (updated) {
			captureGenerationCompleted(
				analytics,
				actorUserId,
				"video",
				attempt.projectId,
				attempt.id,
			);
		}
		return Boolean(updated);
	};

	const persistSourceDuration = async (
		attemptId: string,
		durationMs: number,
	): Promise<boolean> => {
		const [row] = await db
			.update(mediaGenerationAttempts)
			.set({ sourceDurationMs: durationMs })
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });
		return Boolean(row);
	};

	const persistActualDuration = async (
		attemptId: string,
		durationMs: number,
	): Promise<boolean> => {
		const [row] = await db
			.update(mediaGenerationAttempts)
			.set({ actualDurationMs: durationMs })
			.where(
				and(
					eq(mediaGenerationAttempts.id, attemptId),
					eq(mediaGenerationAttempts.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });
		return Boolean(row);
	};

	const persistVoiceoverDeliveryStatus = async (
		attempt: Pick<VideoWorkflowAttempt, "id" | "voiceover">,
		deliveryStatus: "delivered" | "failed",
	): Promise<boolean> => {
		if (!attempt.voiceover) {
			return false;
		}

		const [row] = await db
			.update(mediaGenerationAttempts)
			.set({
				voiceover: { ...attempt.voiceover, deliveryStatus },
			})
			.where(
				and(
					eq(mediaGenerationAttempts.id, attempt.id),
					eq(mediaGenerationAttempts.status, "generating"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });
		return Boolean(row);
	};

	const listLegs = async (attemptId: string): Promise<VideoWorkflowLeg[]> => {
		const rows = await db
			.select(LEG_COLUMNS)
			.from(mediaGenerationLegs)
			.where(eq(mediaGenerationLegs.attemptId, attemptId))
			.orderBy(asc(mediaGenerationLegs.seq));
		return rows as VideoWorkflowLeg[];
	};

	const providerEvidenceUnits = async (attemptId: string): Promise<number> => {
		const [row] = await db
			.select({
				units: sql<number>`coalesce(sum(
					case
						when jsonb_typeof(${aiUsageGenerationRefs.stepUsage} -> 'metering' -> 'fixedUnits') = 'number'
						then (${aiUsageGenerationRefs.stepUsage} -> 'metering' ->> 'fixedUnits')::integer
						else 0
					end
				), 0)::integer`,
			})
			.from(aiUsageGenerationRefs)
			.innerJoin(
				aiUsageEvents,
				eq(aiUsageEvents.id, aiUsageGenerationRefs.usageEventId),
			)
			.where(eq(aiUsageEvents.idempotencyKey, `video:${attemptId}`));
		return Number(row?.units ?? 0);
	};

	const claimLeg = async (
		attemptId: string,
		seq: number,
	): Promise<VideoWorkflowLeg | null> => {
		const [row] = await db
			.update(mediaGenerationLegs)
			.set({ startedAt: new Date(), status: "generating" })
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "queued"),
					sql`exists (
						select 1 from ${mediaGenerationAttempts}
						where ${mediaGenerationAttempts.id} = ${attemptId}
							and ${mediaGenerationAttempts.status} = 'generating'
					)`,
				),
			)
			.returning(LEG_COLUMNS);
		return (row as VideoWorkflowLeg | undefined) ?? null;
	};

	const resetLegForRetry = async (
		attemptId: string,
		seq: number,
		expectedSourceFrameKey: string | null,
	): Promise<boolean> => {
		const [row] = await db
			.update(mediaGenerationLegs)
			.set({
				completedAt: null,
				error: null,
				sourceFrameKey: null,
				startedAt: null,
				status: "queued",
			})
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
					isNull(mediaGenerationLegs.segmentKey),
					expectedSourceFrameKey === null
						? isNull(mediaGenerationLegs.sourceFrameKey)
						: eq(mediaGenerationLegs.sourceFrameKey, expectedSourceFrameKey),
					sql`exists (
						select 1 from ${mediaGenerationAttempts}
						where ${mediaGenerationAttempts.id} = ${attemptId}
							and ${mediaGenerationAttempts.status} = 'generating'
					)`,
				),
			)
			.returning({ id: mediaGenerationLegs.id });
		return Boolean(row);
	};

	const recordLegFrame = async (
		attemptId: string,
		seq: number,
		key: string,
	): Promise<boolean> => {
		const [row] = await db
			.update(mediaGenerationLegs)
			.set({ sourceFrameKey: key })
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
					isNull(mediaGenerationLegs.sourceFrameKey),
					sql`exists (
						select 1 from ${mediaGenerationAttempts}
						where ${mediaGenerationAttempts.id} = ${attemptId}
							and ${mediaGenerationAttempts.status} = 'generating'
					)`,
				),
			)
			.returning({ id: mediaGenerationLegs.id });
		return Boolean(row);
	};

	const succeedLeg = async (
		attemptId: string,
		seq: number,
		segmentKey: string,
	): Promise<boolean> => {
		const [row] = await db
			.update(mediaGenerationLegs)
			.set({
				completedAt: new Date(),
				error: null,
				segmentKey,
				status: "succeeded",
			})
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
					sql`exists (
						select 1 from ${mediaGenerationAttempts}
						where ${mediaGenerationAttempts.id} = ${attemptId}
							and ${mediaGenerationAttempts.status} = 'generating'
					)`,
				),
			)
			.returning({ id: mediaGenerationLegs.id });
		return Boolean(row);
	};

	const failLeg = async (
		attemptId: string,
		seq: number,
		error: string,
	): Promise<void> => {
		await db
			.update(mediaGenerationLegs)
			.set({
				completedAt: new Date(),
				error: error.slice(0, 2_000),
				status: "failed",
			})
			.where(
				and(
					eq(mediaGenerationLegs.attemptId, attemptId),
					eq(mediaGenerationLegs.seq, seq),
					eq(mediaGenerationLegs.status, "generating"),
				),
			);
	};

	return {
		claimLeg,
		claimQueued,
		fail,
		failLeg,
		listLegs,
		loadAttempt,
		markSucceeded,
		persistActualDuration,
		persistSourceDuration,
		persistVoiceoverDeliveryStatus,
		providerEvidenceUnits,
		recordLegFrame,
		resetLegForRetry,
		succeedLeg,
	};
}

type WorkflowPersistence = ReturnType<typeof createPersistence>;

export async function executeAttempt(
	attempt: VideoWorkflowAttempt,
	input: {
		progress?: VideoWorkflowProgress;
		reservation: VideoReservation;
		signal?: AbortSignal;
		subject: MeteringSubject;
	},
	dependencies: {
		billing: ReturnType<typeof createVideoBilling>;
		persistence: WorkflowPersistence;
		speech: SpeechService;
	},
): Promise<VideoWorkflowExecutionResult> {
	return withVideoProcessingTempDir(async (directory) => {
		const sourcePath = join(directory, "source.mp4");
		if (
			attempt.sourceVideoMediaType !== "video/mp4" ||
			!attempt.sourceVideoUrl ||
			!(await downloadHostedVideo(attempt.sourceVideoUrl, sourcePath))
		) {
			return failedExecution(
				"source_unavailable",
				"This clip's stored MP4 source is no longer available.",
			);
		}

		const sourceProbe = await probeVideo(sourcePath);
		if (!isMp4VideoProbe(sourceProbe)) {
			return failedExecution(
				"source_format_invalid",
				"This clip's actual format cannot be processed yet; it must be MP4.",
			);
		}
		const sourceDurationPersisted =
			await dependencies.persistence.persistSourceDuration(
				attempt.id,
				sourceProbe.durationMs,
			);
		if (!sourceDurationPersisted) {
			throw new VideoWorkflowSettlementPendingError(attempt.id);
		}

		if (attempt.kind === "video-edit") {
			if (sourceProbe.durationMs < 4_000 || sourceProbe.durationMs > 30_000) {
				return failedExecution(
					"source_duration_invalid",
					"This clip's real duration is outside the supported 4–30 second edit window.",
				);
			}
			return executeEdit(
				attempt,
				sourceProbe.durationMs,
				directory,
				input,
				dependencies,
			);
		}

		if (sourceProbe.durationMs < 1_000 || sourceProbe.durationMs > 120_000) {
			return failedExecution(
				"source_duration_invalid",
				"This clip's real duration cannot be extended safely.",
			);
		}
		return executeExtension(
			attempt,
			sourcePath,
			sourceProbe,
			directory,
			input,
			dependencies,
		);
	});
}

async function executeEdit(
	attempt: VideoWorkflowAttempt,
	sourceDurationMs: number,
	directory: string,
	input: {
		progress?: VideoWorkflowProgress;
		reservation: VideoReservation;
		signal?: AbortSignal;
		subject: MeteringSubject;
	},
	dependencies: {
		billing: ReturnType<typeof createVideoBilling>;
		persistence: WorkflowPersistence;
	},
): Promise<VideoWorkflowExecutionResult> {
	if (!attempt.model) {
		return failedExecution("missing_model");
	}

	input.progress?.report({
		headline: "Rendering the surgical edit…",
		percent: 18,
		stage: "rendering",
	});
	let evidenceCaptured = false;
	const outputPath = join(directory, "edited-output");
	const generated = await editVideo({
		...(input.signal ? { abortSignal: input.signal } : {}),
		attemptId: attempt.id,
		metering: gatewayMetering(input.subject),
		modelId: attempt.model,
		onProviderGeneration: async (generation) => {
			await dependencies.billing.capture(input.reservation, {
				providerMetadata: generation.providerMetadata,
				stepUsage: fixedGenerationStepUsage(generation.usage, 1),
			});
			evidenceCaptured = true;
		},
		outputPath,
		projectId: attempt.projectId,
		prompt: attempt.prompt,
		sourceDurationSeconds: sourceDurationMs / 1_000,
		sourceVideoUrl: attempt.sourceVideoUrl as string,
	});

	if (generated.status !== "generated") {
		const providerUnits =
			"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;
		if (hasGatewayGenerationMetadata(generated) && !evidenceCaptured) {
			await dependencies.billing.capture(input.reservation, {
				providerMetadata: generated.providerMetadata,
				stepUsage: fixedGenerationStepUsage(generated.usage, providerUnits),
			});
		}
		return {
			deliveredUnits: providerUnits,
			refundable: !hasGatewayGenerationMetadata(generated),
			reason: "edit_provider_failed",
			status: "failed",
		};
	}

	const outputProbe = await probeVideo(outputPath);
	const actualDurationPersisted =
		await dependencies.persistence.persistActualDuration(
			attempt.id,
			outputProbe.durationMs,
		);
	if (!actualDurationPersisted) {
		throw new VideoWorkflowSettlementPendingError(attempt.id);
	}
	input.progress?.report({
		headline: "Publishing the edited clip…",
		percent: 94,
		stage: "publishing",
	});
	return {
		deliveredUnits: 1,
		status: "generated",
		video: { mediaType: generated.mediaType, url: generated.url },
	};
}

export async function executeExtension(
	attempt: VideoWorkflowAttempt,
	sourcePath: string,
	sourceProbe: Awaited<ReturnType<typeof probeVideo>>,
	directory: string,
	input: {
		progress?: VideoWorkflowProgress;
		reservation: VideoReservation;
		signal?: AbortSignal;
		subject: MeteringSubject;
	},
	dependencies: {
		billing: ReturnType<typeof createVideoBilling>;
		persistence: WorkflowPersistence;
		speech: SpeechService;
	},
): Promise<VideoWorkflowExecutionResult> {
	const legs = await dependencies.persistence.listLegs(attempt.id);
	const totalUnits = asReservationUnits(legs.length);
	const canonical = {
		fps: sourceProbe.fps,
		height: sourceProbe.height,
		width: sourceProbe.width,
	};
	const segmentPaths: string[] = [];
	let accountedUnits = 0;

	for (const plannedLeg of legs) {
		const segmentPath = join(directory, `segment-${plannedLeg.seq}.mp4`);
		const segmentKey = siteVideoSegmentKey(
			attempt.projectId,
			attempt.id,
			plannedLeg.seq,
			"mp4",
		);

		if (plannedLeg.status === "succeeded" && plannedLeg.segmentKey) {
			if (!(await downloadKey(plannedLeg.segmentKey, segmentPath))) {
				return nonRefundableFailure(accountedUnits, "stored_segment_missing");
			}
			segmentPaths.push(segmentPath);
			accountedUnits += 1;
			continue;
		}

		if (plannedLeg.status === "failed") {
			return accountedUnits > 0
				? nonRefundableFailure(accountedUnits, "leg_already_failed")
				: failedExecution("leg_already_failed");
		}

		const wasAlreadyGenerating = plannedLeg.status === "generating";
		let leg = plannedLeg;
		if (leg.status === "queued") {
			const claimed = await dependencies.persistence.claimLeg(
				attempt.id,
				leg.seq,
			);
			if (!claimed) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}
			leg = claimed;
		}

		// A normalized segment is stronger recovery evidence than the row CAS.
		if (await getObjectContentType(segmentKey)) {
			const recovered = await dependencies.persistence.succeedLeg(
				attempt.id,
				leg.seq,
				segmentKey,
			);
			if (!recovered) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}
			if (!(await downloadKey(segmentKey, segmentPath))) {
				return nonRefundableFailure(accountedUnits, "stored_segment_missing");
			}
			segmentPaths.push(segmentPath);
			accountedUnits += 1;
			continue;
		}

		const recoveredRaw = await recoverRawLeg(attempt, leg.seq, directory);
		if (recoveredRaw) {
			await normalizeSegment(recoveredRaw.path, segmentPath, canonical);
			await putSiteFile(
				segmentKey,
				await readFile(segmentPath),
				"video/mp4",
				IMMUTABLE_ASSET_CACHE_CONTROL,
			);
			const recovered = await dependencies.persistence.succeedLeg(
				attempt.id,
				leg.seq,
				segmentKey,
			);
			if (!recovered) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}
			await deleteObject(recoveredRaw.key).catch(() => undefined);
			segmentPaths.push(segmentPath);
			accountedUnits += 1;
			continue;
		}

		if (wasAlreadyGenerating) {
			// Stored legs form a strict prefix, so any additional provider unit is
			// evidence for this in-flight leg. Only that capture-to-upload gap is
			// ambiguous; a generating leg with no output and no evidence is safe to
			// return to queued and render again after a worker crash.
			const providerEvidenceUnits =
				await dependencies.persistence.providerEvidenceUnits(attempt.id);
			if (providerEvidenceUnits > accountedUnits) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}

			const reset = await dependencies.persistence.resetLegForRetry(
				attempt.id,
				leg.seq,
				leg.sourceFrameKey,
			);
			if (!reset) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}
			const reclaimed = await dependencies.persistence.claimLeg(
				attempt.id,
				leg.seq,
			);
			if (!reclaimed) {
				throw new VideoWorkflowSettlementPendingError(attempt.id);
			}
			leg = reclaimed;
		}

		const priorPath =
			leg.seq === 1 ? sourcePath : segmentPaths[segmentPaths.length - 1];
		if (!priorPath) {
			return nonRefundableFailure(accountedUnits, "previous_segment_missing");
		}

		input.progress?.report({
			headline: `Extracting the join frame for piece ${leg.seq} of ${legs.length}…`,
			percent: legProgress(leg.seq, legs.length, 15),
			stage: "extracting-frame",
		});
		const framePath = join(directory, `frame-${leg.seq}.jpg`);
		const frameKey = siteVideoFrameKey(
			attempt.projectId,
			attempt.id,
			leg.seq,
			"jpg",
		);
		await extractLastFrame(priorPath, framePath);
		await putSiteFile(
			frameKey,
			await readFile(framePath),
			"image/jpeg",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		const framePersisted = await dependencies.persistence.recordLegFrame(
			attempt.id,
			leg.seq,
			frameKey,
		);
		if (!framePersisted) {
			throw new VideoWorkflowSettlementPendingError(attempt.id);
		}

		input.progress?.report({
			headline: `Rendering continuation piece ${leg.seq} of ${legs.length}…`,
			percent: legProgress(leg.seq, legs.length, 25),
			stage: "rendering-leg",
		});
		let evidenceCaptured = false;
		const generated = await generateBuildVideo({
			...(input.signal ? { abortSignal: input.signal } : {}),
			aspect: attempt.aspect,
			attemptId: attempt.id,
			durationSeconds: leg.durationSeconds,
			imageUrl: publicAssetUrl(frameKey),
			index: leg.seq + 1,
			metering: gatewayMetering(input.subject),
			modelId: leg.model,
			motion: "balanced",
			motionPrompt: attempt.prompt,
			onProviderGeneration: async (generation) => {
				await dependencies.billing.capture(input.reservation, {
					providerMetadata: generation.providerMetadata,
					stepUsage: fixedGenerationStepUsage(generation.usage, 1),
				});
				evidenceCaptured = true;
			},
			profile: "image-animation",
			projectId: attempt.projectId,
			voiceControl: false,
		});

		if (generated.status !== "generated") {
			const providerUnits =
				"providerUnits" in generated && generated.providerUnits === 1 ? 1 : 0;
			if (hasGatewayGenerationMetadata(generated) && !evidenceCaptured) {
				await dependencies.billing.capture(input.reservation, {
					providerMetadata: generated.providerMetadata,
					stepUsage: fixedGenerationStepUsage(generated.usage, providerUnits),
				});
			}
			await dependencies.persistence.failLeg(
				attempt.id,
				leg.seq,
				"This continuation piece could not be rendered.",
			);
			const chargedUnits = accountedUnits + providerUnits;
			return hasGatewayGenerationMetadata(generated) || chargedUnits > 0
				? nonRefundableFailure(chargedUnits, "leg_provider_failed")
				: failedExecution("leg_provider_failed");
		}

		const rawKey = publicAssetKeyFromUrl(generated.url);
		const rawPath = join(directory, `raw-leg-${leg.seq}`);
		if (!rawKey || !(await downloadKey(rawKey, rawPath))) {
			await dependencies.persistence.failLeg(
				attempt.id,
				leg.seq,
				"This continuation piece could not be stored.",
			);
			return nonRefundableFailure(accountedUnits + 1, "leg_output_missing");
		}

		await normalizeSegment(rawPath, segmentPath, canonical);
		await putSiteFile(
			segmentKey,
			await readFile(segmentPath),
			"video/mp4",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		const succeeded = await dependencies.persistence.succeedLeg(
			attempt.id,
			leg.seq,
			segmentKey,
		);
		if (!succeeded) {
			throw new VideoWorkflowSettlementPendingError(attempt.id);
		}
		await deleteObject(rawKey).catch(() => undefined);
		segmentPaths.push(segmentPath);
		accountedUnits += 1;
	}

	input.progress?.report({
		headline: "Joining the source and continuation pieces…",
		percent: 82,
		stage: "joining",
	});
	const normalizedSourcePath = join(directory, "normalized-source.mp4");
	await normalizeSegment(sourcePath, normalizedSourcePath, canonical);
	const joinedPath = join(directory, "joined.mp4");
	await concatSegments([normalizedSourcePath, ...segmentPaths], joinedPath);

	let finalPath = joinedPath;
	let warning: string | undefined;
	if (attempt.voiceover?.script) {
		input.progress?.report({
			headline: "Laying the narration over the full video…",
			percent: 88,
			stage: "soundtrack",
		});
		let deliveryStatus: "delivered" | "failed";
		try {
			const soundtrackPath = join(directory, "soundtrack.mp3");
			const soundtrackKey = siteVideoSoundtrackKey(
				attempt.projectId,
				attempt.id,
				"mp3",
			);
			const recoveredSoundtrack =
				(await getObjectContentType(soundtrackKey)) &&
				(await downloadKey(soundtrackKey, soundtrackPath));
			if (!recoveredSoundtrack) {
				const soundtrack = await dependencies.speech.synthesizeVoiceover({
					abortSignal: AbortSignal.timeout(VOICEOVER_TTS_TIMEOUT_MS),
					language: attempt.voiceover.language,
					metering: gatewayMetering(input.subject),
					script: attempt.voiceover.script,
				});
				// The narration TTS bills inside this video event (helper_billable);
				// a missing gateway id only loses attribution, never the soundtrack.
				try {
					await dependencies.billing.capture(input.reservation, {
						providerMetadata: soundtrack.providerMetadata,
						stepUsage: helperStepUsage("voiceover_tts", null),
					});
				} catch (captureError) {
					logger.warn(
						`Extension ${attempt.id}: narration TTS cost capture failed`,
						{
							error:
								captureError instanceof Error
									? captureError.message
									: String(captureError),
						},
					);
				}
				await writeFile(soundtrackPath, soundtrack.bytes);
				await putSiteFile(
					soundtrackKey,
					soundtrack.bytes,
					soundtrack.mediaType,
					IMMUTABLE_ASSET_CACHE_CONTROL,
				);
			}
			const muxedPath = join(directory, "final-with-soundtrack.mp4");
			await muxSoundtrack(joinedPath, soundtrackPath, muxedPath);
			finalPath = muxedPath;
			deliveryStatus = "delivered";
		} catch (error) {
			deliveryStatus = "failed";
			warning =
				"The continuation video was delivered, but narration could not be added; the result is silent.";
			logger.warn(`Extension ${attempt.id}: ${warning}`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		const deliveryStatusPersisted =
			await dependencies.persistence.persistVoiceoverDeliveryStatus(
				attempt,
				deliveryStatus,
			);
		if (!deliveryStatusPersisted) {
			throw new VideoWorkflowSettlementPendingError(attempt.id);
		}
	} else if (attempt.voiceover) {
		warning =
			"The continuation video was delivered silently because no narration script was available.";
	}

	const finalProbe = await probeVideo(finalPath);
	const actualDurationPersisted =
		await dependencies.persistence.persistActualDuration(
			attempt.id,
			finalProbe.durationMs,
		);
	if (!actualDurationPersisted) {
		throw new VideoWorkflowSettlementPendingError(attempt.id);
	}
	input.progress?.report({
		headline: "Publishing the longer video…",
		percent: 95,
		stage: "publishing",
	});
	const finalKey = siteVideoKey(attempt.projectId, attempt.id, 1, "mp4");
	await putSiteFile(
		finalKey,
		await readFile(finalPath),
		"video/mp4",
		IMMUTABLE_ASSET_CACHE_CONTROL,
	);

	return {
		deliveredUnits: totalUnits,
		status: "generated",
		video: { mediaType: "video/mp4", url: publicAssetUrl(finalKey) },
		...(warning ? { warning } : {}),
	};
}

export function createStoredFinalRecovery() {
	return async (
		attempt: Pick<VideoWorkflowAttempt, "id" | "projectId">,
	): Promise<VideoWorkflowVideo | null> => {
		for (const candidate of [
			{ extension: "mp4", mediaType: "video/mp4" },
			{ extension: "webm", mediaType: "video/webm" },
		] as const) {
			// Recovery is deliberately final-only: frames, normalized segments,
			// soundtracks, and raw vid-2+ provider outputs never prove completion.
			const key = siteVideoKey(
				attempt.projectId,
				attempt.id,
				1,
				candidate.extension,
			);
			const mediaType = await getObjectContentType(key);
			if (mediaType) {
				return {
					mediaType: mediaType.startsWith("video/")
						? mediaType
						: candidate.mediaType,
					url: publicAssetUrl(key),
				};
			}
		}
		return null;
	};
}

async function recoverRawLeg(
	attempt: VideoWorkflowAttempt,
	seq: number,
	directory: string,
): Promise<{ key: string; path: string } | null> {
	for (const extension of ["mp4", "webm"] as const) {
		const key = siteVideoKey(attempt.projectId, attempt.id, seq + 1, extension);
		if (!(await getObjectContentType(key))) {
			continue;
		}
		const path = join(directory, `recovered-raw-${seq}.${extension}`);
		if (await downloadKey(key, path)) {
			return { key, path };
		}
	}
	return null;
}

async function downloadHostedVideo(
	url: string,
	path: string,
): Promise<boolean> {
	const key = publicAssetKeyFromUrl(url);
	return key ? downloadKey(key, path) : false;
}

async function downloadKey(key: string, path: string): Promise<boolean> {
	return downloadObjectToFile(key, path);
}

function gatewayMetering(subject: MeteringSubject) {
	return {
		operation: "video" as const,
		organizationId: subject.organizationId ?? null,
		userId: subject.actorUserId,
	};
}

function asReservationUnits(value: number): VideoReservationUnits {
	if (value === 1 || value === 2 || value === 3) {
		return value;
	}
	throw new Error("A video extension must have one to three durable legs");
}

function asDeliveredUnits(value: number): 0 | 1 | 2 | 3 {
	if (value === 0 || value === 1 || value === 2 || value === 3) {
		return value;
	}
	throw new Error("Delivered video units must be between zero and three");
}

function failedExecution(
	reason: string,
	userMessage?: string,
): VideoWorkflowExecutionResult {
	return {
		deliveredUnits: 0,
		refundable: true,
		reason,
		status: "failed",
		...(userMessage ? { userMessage } : {}),
	};
}

function nonRefundableFailure(
	deliveredUnits: number,
	reason: string,
): VideoWorkflowExecutionResult {
	return {
		deliveredUnits: asDeliveredUnits(deliveredUnits),
		refundable: false,
		reason,
		status: "failed",
	};
}

function legProgress(seq: number, total: number, base: number): number {
	return Math.min(78, base + Math.round(((seq - 1) / total) * 55));
}

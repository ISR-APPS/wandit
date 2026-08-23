// This runtime is imported only by Trigger tasks, so SDK logging is safe.
import { join } from "node:path";

import { logger } from "@trigger.dev/sdk";
import { and, type createDb, eq, sql } from "@wandit/db";
import {
	aiUsageEvents,
	aiUsageGenerationRefs,
} from "@wandit/db/schema/credits";
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
import { productVideo } from "../modules/ai-chat/agent/site-builder/product-video";
import type {
	ProductVideo,
	ProductVideoAttempt,
	ProductVideoRunnerDependencies,
} from "../modules/media-generations/application/services/product-video-runner";
import { createVideoBilling } from "../modules/media-generations/application/services/video-billing";
import { withVideoProcessingTempDir } from "../modules/media-generations/application/services/video-processing";
import { VIDEO_PRODUCT_ENGINE_MODEL } from "../modules/media-generations/domain/video-quality-models";
import { createTriggerMetering } from "./metering.runtime";

type TriggerDatabase = ReturnType<typeof createDb>;

const ATTEMPT_COLUMNS = {
	aspect: mediaGenerationAttempts.aspect,
	completedAt: mediaGenerationAttempts.completedAt,
	durationSeconds: mediaGenerationAttempts.durationSeconds,
	error: mediaGenerationAttempts.error,
	id: mediaGenerationAttempts.id,
	kind: mediaGenerationAttempts.kind,
	model: mediaGenerationAttempts.model,
	organizationId: projects.organizationId,
	projectDeletedAt: projects.deletedAt,
	projectId: mediaGenerationAttempts.projectId,
	prompt: mediaGenerationAttempts.prompt,
	sourceImageUrl: mediaGenerationAttempts.sourceImageUrl,
	sourceMediaType: mediaGenerationAttempts.sourceMediaType,
	startedAt: mediaGenerationAttempts.startedAt,
	status: mediaGenerationAttempts.status,
	triggerRunId: mediaGenerationAttempts.triggerRunId,
	userId: projects.userId,
	videoMediaType: mediaGenerationAttempts.videoMediaType,
	videoUrl: mediaGenerationAttempts.videoUrl,
} as const;

export type ProductVideoRuntime = {
	runner: ProductVideoRunnerDependencies;
};

/** Dedicated runtime: neither legacy image/video runtime accepts this kind. */
export function createProductVideoRuntime(
	db: TriggerDatabase,
	analytics: AnalyticsCapture,
): ProductVideoRuntime {
	const billing = createVideoBilling({
		isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
		meteringService: createTriggerMetering(db),
	});
	const persistence = createPersistence(db, analytics);

	return {
		runner: {
			capture: billing.capture,
			claimQueued: persistence.claimQueued,
			deliveredUnitsForAttempt: persistence.deliveredUnitsForAttempt,
			fail: persistence.fail,
			generate: (attempt, subject, input) =>
				withVideoProcessingTempDir(async (directory) => {
					const generated = await productVideo({
						...(input.signal ? { abortSignal: input.signal } : {}),
						attemptId: attempt.id,
						imageUrl: attempt.sourceImageUrl,
						mediaType: attempt.sourceMediaType,
						metering: {
							operation: "video",
							organizationId: subject.organizationId ?? null,
							userId: subject.actorUserId,
						},
						onProviderGeneration: input.onProviderGeneration,
						onPublishing: input.onPublishing,
						outputPath: join(directory, "product-video-output"),
						projectId: attempt.projectId,
						prompt: attempt.prompt,
					});
					if (generated.status === "generated" && generated.warnings?.length) {
						logger.warn(
							`Product video ${attempt.id}: provider ignored settings`,
							{ warnings: generated.warnings },
						);
					}
					return generated;
				}),
			loadAttempt: persistence.loadAttempt,
			markSucceeded: persistence.markSucceeded,
			now: () => new Date(),
			recoverStoredVideo: createStoredVideoRecovery(),
			refund: billing.refund,
			reserve: billing.reserve,
			settle: billing.settle,
			settleExisting: billing.settleExisting,
		},
	};
}

function createPersistence(db: TriggerDatabase, analytics: AnalyticsCapture) {
	const loadAttempt = async (
		attemptId: string,
	): Promise<ProductVideoAttempt | null> => {
		const [row] = await db
			.select(ATTEMPT_COLUMNS)
			.from(mediaGenerationAttempts)
			.innerJoin(projects, eq(projects.id, mediaGenerationAttempts.projectId))
			.where(eq(mediaGenerationAttempts.id, attemptId))
			.limit(1);

		if (!row) {
			return null;
		}
		if (row.kind !== "video-product") {
			throw new Error(
				`Product video runtime cannot process ${row.kind} attempt ${row.id}`,
			);
		}
		if (
			row.model !== VIDEO_PRODUCT_ENGINE_MODEL ||
			row.durationSeconds !== 5 ||
			!row.sourceImageUrl ||
			(row.sourceMediaType !== "image/jpeg" &&
				row.sourceMediaType !== "image/png")
		) {
			throw new Error(
				`Product video attempt ${row.id} has an invalid snapshot`,
			);
		}

		return row as ProductVideoAttempt;
	};

	const claimQueued = async (
		attempt: ProductVideoAttempt,
		input: { runId: string; startedAt: Date },
	): Promise<ProductVideoAttempt | null> => {
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
					eq(mediaGenerationAttempts.kind, "video-product"),
					eq(mediaGenerationAttempts.status, "queued"),
				),
			)
			.returning({ id: mediaGenerationAttempts.id });
		return claimed ? loadAttempt(claimed.id) : null;
	};

	const fail = async (
		attempt: ProductVideoAttempt,
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
					eq(mediaGenerationAttempts.kind, "video-product"),
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
		attempt: ProductVideoAttempt,
		video: ProductVideo,
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
					eq(mediaGenerationAttempts.kind, "video-product"),
					eq(mediaGenerationAttempts.status, "generating"),
					sql`exists (
						select 1 from ${projects}
						where ${projects.id} = ${mediaGenerationAttempts.projectId}
							and ${projects.deletedAt} is null
					)`,
				),
			)
			.returning({ id: mediaGenerationAttempts.id });
		if (updated) {
			captureGenerationCompleted(
				analytics,
				attempt.userId,
				"video",
				attempt.projectId,
				attempt.id,
			);
		}
		return Boolean(updated);
	};

	const deliveredUnitsForAttempt = async (
		attemptId: string,
	): Promise<0 | 1> => {
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
		const units = Number(row?.units ?? 0);
		if (units !== 0 && units !== 1) {
			throw new Error(`Product video ${attemptId} has invalid delivered units`);
		}
		return units;
	};

	return {
		claimQueued,
		deliveredUnitsForAttempt,
		fail,
		loadAttempt,
		markSucceeded,
	};
}

function createStoredVideoRecovery() {
	return async (
		attempt: Pick<ProductVideoAttempt, "id" | "projectId">,
	): Promise<ProductVideo | null> => {
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

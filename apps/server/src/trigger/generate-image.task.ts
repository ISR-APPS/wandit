// FIRST import on purpose: raises process-wide fetch idle timeouts before the
// AI/storage SDK can issue a long-running image request.
import "./undici-timeouts";

import { logger, metadata, queue, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	parseImageGenerationPayload,
	runImageGeneration,
} from "../modules/image-generations/application/services/image-generation-runner";
import { createImageGenerationRuntime } from "./image-generation.runtime";
import { triggerAnalytics } from "./init";

const imageGenerationQueue = queue({
	concurrencyLimit: 2,
	name: "image-generation",
});

/**
 * The only standalone image-generation execution entrypoint.
 *
 * Same durability contract as image animation: the database claim is the
 * provider-call authority; once a row is generating, retries only recover its
 * deterministic R2 output or settle/refund it.
 */
export const generateImageTask = schemaTask({
	id: "generate-image",
	// Up to MAX_IMAGES_PER_GENERATION (6) calls in waves of
	// IMAGE_GENERATION_CONCURRENCY (2), each bounded by the 2-minute provider
	// timeout: three worst-case waves plus uploads must fit.
	maxDuration: 600,
	queue: imageGenerationQueue,
	// The retry budget must outlast IMAGE_GENERATION_STALE_GENERATING_MS (14
	// min): a run that keeps finding the row "generating" throws a pending
	// settlement error until that window has passed, and only then settles or
	// refunds. 5+10+20+40+80+6x120 s of backoff is about 14.6 min.
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 120_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseImageGenerationPayload,
	// The stale queued guard closes rows at 30 minutes. Expire the Trigger
	// delivery first so a late start can never race a settled attempt.
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();
		const runtime = createImageGenerationRuntime(db, triggerAnalytics);

		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "settling");

			const result = await runImageGeneration(payload, {
				dependencies: runtime.runner,
				runId: ctx.run.id,
				signal,
			});

			metadata.set("stage", result.status);
			logger.info(`Image generation ${payload.attemptId} ${result.status}`, {
				count: result.status === "succeeded" ? result.images.length : undefined,
				reason: result.status === "failed" ? result.reason : undefined,
				recovered: result.status === "succeeded" ? result.recovered : undefined,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			// Deferred renditions are best-effort but must be observed before the
			// Trigger worker exits; the primary URLs are already durable/visible.
			await runtime.flushDeferredWork();
			await db.$client.end();
		}
	},
});

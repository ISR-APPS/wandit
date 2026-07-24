// FIRST import on purpose: raises process-wide fetch idle timeouts before the
// AI/storage SDK can issue a long-running image-to-video request.
import "./undici-timeouts";

import { logger, metadata, queue, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	parseImageAnimationPayload,
	runImageAnimation,
} from "../modules/media-generations/application/services/image-animation-runner";
import { createImageAnimationRuntime } from "./image-animation.runtime";

const imageAnimationQueue = queue({
	concurrencyLimit: 2,
	name: "image-animation-generation",
});

/**
 * The only image-to-video execution entrypoint.
 *
 * Trigger retries are intentionally generous, but the database claim remains
 * the provider-call authority. Once a row is generating, retries only recover
 * its deterministic R2 output or settle/refund it.
 */
export const animateImageTask = schemaTask({
	id: "animate-image",
	maxDuration: 420,
	queue: imageAnimationQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseImageAnimationPayload,
	// The API's stale queued guard closes rows at 30 minutes. Expire the
	// Trigger delivery first; the scheduled reconciler will persist/refund it.
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();

		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "settling");

			const runtime = createImageAnimationRuntime(db);
			const result = await runImageAnimation(payload, {
				dependencies: runtime.runner,
				runId: ctx.run.id,
				signal,
			});

			metadata.set("stage", result.status);
			logger.info(`Image animation ${payload.attemptId} ${result.status}`, {
				reason: result.status === "failed" ? result.reason : undefined,
				recovered: result.status === "succeeded" ? result.recovered : undefined,
				triggerRunId: ctx.run.id,
			});

			return result;
		} finally {
			await db.$client.end();
		}
	},
});

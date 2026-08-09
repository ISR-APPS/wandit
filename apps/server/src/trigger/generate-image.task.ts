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
	maxDuration: 420,
	queue: imageGenerationQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseImageGenerationPayload,
	// The stale queued guard closes rows at 30 minutes. Expire the Trigger
	// delivery first so a late start can never race a settled attempt.
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();

		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "settling");

			const runtime = createImageGenerationRuntime(db, triggerAnalytics);
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
			await db.$client.end();
		}
	},
});

// FIRST import: provider calls need the process-wide long idle timeout seam.
import "./undici-timeouts";

import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	parseProductVideoPayload,
	runProductVideo,
} from "../modules/media-generations/application/services/product-video-runner";
import { triggerAnalytics } from "./init";
import { createProductVideoRuntime } from "./product-video.runtime";
import { videoGenerationQueue } from "./video-generation.queue";
import { createVideoWorkflowProgressTracker } from "./video-workflow-progress";

export const productVideoTask = schemaTask({
	id: "product-video",
	maxDuration: 900,
	queue: videoGenerationQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseProductVideoPayload,
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();
		const progress = createVideoWorkflowProgressTracker({
			durationSeconds: 5,
			headline: "Preparing the product image…",
		});
		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "starting");
			const runtime = createProductVideoRuntime(db, triggerAnalytics);
			const result = await runProductVideo(payload, {
				dependencies: runtime.runner,
				progress,
				runId: ctx.run.id,
				signal,
			});
			if (result.status === "succeeded") {
				progress.finish();
			}
			metadata.set("stage", result.status);
			logger.info(`Product video ${payload.attemptId} ${result.status}`, {
				reason: result.status === "failed" ? result.reason : undefined,
				recovered: result.status === "succeeded" ? result.recovered : undefined,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			progress.stop();
			await db.$client.end();
		}
	},
});

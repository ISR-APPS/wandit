// FIRST import: provider calls need the process-wide long idle timeout seam.
import "./undici-timeouts";

import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";

import {
	parseVideoWorkflowPayload,
	runVideoWorkflow,
} from "../modules/media-generations/application/services/video-edit-extension-runner";
import { triggerAnalytics } from "./init";
import { createVideoWorkflowRuntime } from "./video-edit-extension.runtime";
import { videoGenerationQueue } from "./video-generation.queue";
import { createVideoWorkflowProgressTracker } from "./video-workflow-progress";

export const editVideoTask = schemaTask({
	id: "edit-video",
	maxDuration: 900,
	queue: videoGenerationQueue,
	retry: {
		factor: 2,
		maxAttempts: 12,
		maxTimeoutInMs: 60_000,
		minTimeoutInMs: 5_000,
		randomize: true,
	},
	schema: parseVideoWorkflowPayload,
	ttl: "25m",
	run: async (payload, { ctx, signal }) => {
		const db = createDb();
		const progress = createVideoWorkflowProgressTracker({
			headline: "Preparing the source clip for editing…",
		});
		try {
			metadata
				.set("attemptId", payload.attemptId)
				.set("projectId", payload.projectId)
				.set("stage", "starting");
			const runtime = createVideoWorkflowRuntime(db, triggerAnalytics);
			const result = await runVideoWorkflow(payload, {
				dependencies: runtime.runner,
				expectedKind: "video-edit",
				progress,
				runId: ctx.run.id,
				signal,
			});
			if (result.status === "succeeded") {
				progress.finish(result.warning);
			}
			metadata.set("stage", result.status);
			if (result.status === "succeeded" && result.warning) {
				metadata.set("warning", result.warning);
			}
			logger.info(`Video edit ${payload.attemptId} ${result.status}`, {
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

/**
 * `capture-project-thumbnail` task: one dashboard thumbnail of a V2 app after
 * a committed builder turn. `TriggerThumbnailCaptureScheduler` queues it by
 * task id. The steps live in `capture-project-thumbnail.runtime.ts`; this
 * file checks the storage env and wires the pool. The browser runs inside the
 * sandbox, never on this worker (docs/v2/security.md section 12).
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { commitShaSchema, uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import { isR2Configured } from "../infrastructure/storage/r2";
import { CAPTURE_PROJECT_THUMBNAIL_TASK_ID } from "../modules/app-builder/infrastructure/trigger/trigger-thumbnail-capture-scheduler";

import { createCaptureProjectThumbnailRuntime } from "./capture-project-thumbnail.runtime";
import { projectThumbnailQueue } from "./sandbox-task-queues";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the caller type.
const captureProjectThumbnailPayloadSchema = z.object({
	commitSha: commitShaSchema,
	projectId: uuidSchema,
});

/** One screenshot per committed turn, on the default machine: the worker only waits on the sandbox exec. */
export const captureProjectThumbnailTask = schemaTask({
	id: CAPTURE_PROJECT_THUMBNAIL_TASK_ID,
	// 180 s: the sandbox exec of up to 120 s, plus the row reads, the file
	// read, the upload, and the row write.
	maxDuration: 180,
	queue: projectThumbnailQueue,
	// One attempt: the next committed turn captures again.
	retry: { maxAttempts: 1 },
	schema: captureProjectThumbnailPayloadSchema,
	run: async (payload) => {
		// Without the bucket or its public URL, the dashboard cannot show a thumbnail.
		if (!isR2Configured() || !env.R2_PUBLIC_BASE_URL) {
			logger.warn("project-thumbnail.storage-unconfigured", {
				projectId: payload.projectId,
			});
			return { outcome: "skipped", reason: "storage_unconfigured" } as const;
		}
		// Each run makes its own pool and ends it in `finally`, so a reused
		// worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			return await createCaptureProjectThumbnailRuntime(db).run(payload);
		} catch (error) {
			Sentry.captureException(error, {
				tags: { commitSha: payload.commitSha, projectId: payload.projectId },
			});
			throw error;
		} finally {
			await db.$client.end();
		}
	},
});

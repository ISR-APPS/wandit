/**
 * `delete-app-project` task: removes the external resources of one
 * soft-deleted `v2_app` project. `ProjectsService.delete` queues it through
 * `TriggerDeleteAppProjectTaskStarter` with the project id as the global
 * idempotency anchor; the work lives in `delete-app-project.runtime.ts` so
 * a spec can run it on fakes.
 */
import "./undici-timeouts";
import { logger, schemaTask } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { createDeleteAppProjectRuntime } from "./delete-app-project.runtime";
import { triggerAnalytics } from "./init";
import { appProjectCleanupQueue } from "./sandbox-task-queues";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const deleteAppProjectPayloadSchema = z.object({
	actorUserId: z.string().min(1),
	organizationId: z.string().min(1).nullable(),
	projectId: uuidSchema,
});

/**
 * One cleanup run per deleted project, one attempt. The runtime records
 * each step's outcome in the audit row, so a failed vendor call never
 * hides behind a retry.
 */
export const deleteAppProjectTask = schemaTask({
	id: "delete-app-project",
	// 600 s: two R2 drains, two vendor deletes, one code.storage call. The
	// Worker delete takes at most 165 s (5 timeouts of 30 s plus the backoff).
	maxDuration: 600,
	queue: appProjectCleanupQueue,
	// One attempt, like the idle sweep: every step reports its own outcome;
	// a retry would re-run steps that already succeeded.
	retry: { maxAttempts: 1 },
	schema: deleteAppProjectPayloadSchema,
	run: async (payload, { ctx }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const runtime = createDeleteAppProjectRuntime(
				db,
				triggerAnalytics.capture,
			);
			const result = await runtime.run(payload);
			logger.info("App project cleanup completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});

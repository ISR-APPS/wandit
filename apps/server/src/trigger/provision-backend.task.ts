/**
 * `provision-backend` task: one run per `requestKey` creates the hidden
 * Supabase project of one V2 app (WANDIT-183, D18). The API starter sets
 * `idempotencyKey = provision-backend:<requestKey>` in the global scope,
 * so a retried create never starts a second run. The steps live in
 * `provision-backend.runtime.ts` so a spec runs them on fakes.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { z } from "zod";

import { backendProvisioningQueue } from "./backend-task-queues";
import { createProvisionBackendRuntime } from "./provision-backend.runtime";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const provisionBackendPayloadSchema = z.object({
	projectId: uuidSchema,
	requestKey: z.string().min(1),
});

/**
 * One provisioning run per backend row, one attempt. The runtime is a
 * resumable state machine on the `app_backends` row, so a second run would
 * race the first.
 */
export const provisionBackendTask = schemaTask({
	id: "provision-backend",
	// 900 s: the 10 minute poll plus the create, key, sql, and auth calls.
	maxDuration: 900,
	queue: backendProvisioningQueue,
	retry: { maxAttempts: 1 },
	schema: provisionBackendPayloadSchema,
	run: async (payload, { ctx }) => {
		// Fresh pool per run; ended in `finally` so the worker process can be
		// reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const runtime = createProvisionBackendRuntime(db);
		try {
			const result = await runtime.run(payload);
			logger.info("Backend provisioning completed", {
				...result,
				projectId: payload.projectId,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await runtime.close();
			await db.$client.end();
		}
	},
});

/**
 * `PublishAppTaskStarter` on the Trigger.dev management API (WANDIT-178).
 * `PublishService` calls it in the API process after it writes the
 * `queued` row. The task id string "publish-app" is the only coupling.
 * The task value is never imported here: it would pull the worker code into
 * the Nest bundle.
 */
import { setTimeout as delay } from "node:timers/promises";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";

import type {
	PublishAppTaskInput,
	PublishAppTaskStarter,
} from "../../domain/ports/publish-app-task-starter";
import { isDefinitiveTriggerRejection } from "./trigger-turn-task-starter";

// The task slug that `publish-app.task.ts` registers.
const PUBLISH_APP_TASK_ID = "publish-app";

// Same handoff rule as the other starters: three short attempts, and a
// definitive rejection stops early.
const TRIGGER_HANDOFF_ATTEMPTS = 3;

// One hour covers a real client retry window. A later replay finds the row
// out of `queued` in the task and does nothing.
const TRIGGER_IDEMPOTENCY_TTL = "1h";

/** Queues the `publish-app` task with the build id as the idempotency key. */
@Injectable()
export class TriggerPublishAppTaskStarter implements PublishAppTaskStarter {
	/**
	 * Queues one run per build. The global key `publish-app:<buildId>` makes
	 * a retried call answer the same run, so one build never uploads twice.
	 */
	async start(input: PublishAppTaskInput): Promise<{ runId: string }> {
		if (!env.TRIGGER_SECRET_KEY) {
			// A missing key is a config bug, not a user error, so the 503 code
			// stays V2_ENV_MISSING like the other starters.
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			});
		}

		const idempotencyKey = await idempotencyKeys.create(
			`publish-app:${input.buildId}`,
			{ scope: "global" },
		);

		let lastError: unknown;
		for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
			try {
				const handle = await tasks.trigger(
					PUBLISH_APP_TASK_ID,
					{ buildId: input.buildId, projectId: input.projectId },
					{
						// The queue has a limit of 1 per key, so one project runs one publish at a time.
						concurrencyKey: input.projectId,
						idempotencyKey,
						idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
						tags: [`project:${input.projectId}`, `app-build:${input.buildId}`],
					},
				);

				return { runId: handle.id };
			} catch (error) {
				lastError = error;

				if (isDefinitiveTriggerRejection(error)) {
					break;
				}

				if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
					// 100 ms then 200 ms: the publish request waits on this call, so the backoff stays short.
					await delay(100 * 2 ** attempt);
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Trigger.dev handoff failed");
	}
}

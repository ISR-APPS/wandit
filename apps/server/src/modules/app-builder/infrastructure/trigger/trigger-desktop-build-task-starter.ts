/**
 * `DesktopBuildTaskStarter` on the Trigger.dev management API
 * (docs/v2/desktop-apps.md section 9). `DesktopBuildsService.create` calls
 * it in the API process after it writes the `queued` row. The task id
 * string "desktop-build" is the only coupling: the task value is never
 * imported here, because it would pull the worker code into the Nest bundle.
 */
import { setTimeout as delay } from "node:timers/promises";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";

import type {
	DesktopBuildTaskInput,
	DesktopBuildTaskStarter,
} from "../../domain/ports/desktop-build-task-starter";
import { isDefinitiveTriggerRejection } from "./trigger-turn-task-starter";

// The task slug that `desktop-build.task.ts` registers.
const DESKTOP_BUILD_TASK_ID = "desktop-build";

// Same handoff rule as the other starters: three short attempts, and a
// definitive rejection stops early.
const TRIGGER_HANDOFF_ATTEMPTS = 3;

// One hour covers a real client retry window. A later replay finds the row
// out of `queued` in the task and does nothing.
const TRIGGER_IDEMPOTENCY_TTL = "1h";

/** Queues the `desktop-build` task with the build id as the idempotency key. */
@Injectable()
export class TriggerDesktopBuildTaskStarter implements DesktopBuildTaskStarter {
	/**
	 * Queues one run per build. The global key `desktop-build:<buildId>`
	 * makes a retried call answer the same run, so CI never gets a second build.
	 */
	async start(input: DesktopBuildTaskInput): Promise<{ runId: string }> {
		this.assertTriggerConfigured();

		const idempotencyKey = await idempotencyKeys.create(
			`desktop-build:${input.buildId}`,
			{ scope: "global" },
		);

		let lastError: unknown;
		for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
			try {
				const handle = await tasks.trigger(
					DESKTOP_BUILD_TASK_ID,
					{
						actorIsLimitExempt: input.actorIsLimitExempt,
						buildId: input.buildId,
						projectId: input.projectId,
					},
					{
						// With the limit of 1 on the task queue, one project runs one build at a time.
						concurrencyKey: input.projectId,
						idempotencyKey,
						idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
						tags: [
							`project:${input.projectId}`,
							`desktop-build:${input.buildId}`,
						],
					},
				);

				return { runId: handle.id };
			} catch (error) {
				lastError = error;

				if (isDefinitiveTriggerRejection(error)) {
					break;
				}

				if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
					// 100 ms then 200 ms: the create request waits on this call, so the backoff stays short.
					await delay(100 * 2 ** attempt);
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Trigger.dev handoff failed");
	}

	private assertTriggerConfigured(): void {
		if (!env.TRIGGER_SECRET_KEY) {
			// A missing key is a config bug, not a user error, so the 503 code
			// stays V2_ENV_MISSING like the other starters.
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			});
		}
	}
}

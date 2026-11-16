/**
 * Queues the `apply-starter-template` task on the Trigger.dev management API.
 * `AppProjectsService.createFromStarterTemplate` calls it in the API process
 * after the project rows exist. It queues the task by its id string. The task
 * value is never imported here: it would pull the worker code into the Nest bundle.
 */
import { setTimeout as delay } from "node:timers/promises";
import { Injectable } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";

import { isDefinitiveTriggerRejection } from "./trigger-turn-task-starter";

/** The task slug that `apply-starter-template.task.ts` registers. */
export const APPLY_STARTER_TEMPLATE_TASK_ID = "apply-starter-template";

// Same handoff rule as the other starters: three short attempts, and a
// definitive rejection stops early.
const TRIGGER_HANDOFF_ATTEMPTS = 3;

// One hour is longer than the retries of one create request. A project id is
// never used for a second create.
const TRIGGER_IDEMPOTENCY_TTL = "1h";

/** The task payload. The task parses it again with its zod schema. */
export type ApplyStarterTemplateTaskInput = {
	/** The new `projects` row. Also the idempotency key and the concurrency key of the run. */
	projectId: string;
	/** The first chat of the project. The task stores its note there. */
	chatId: string;
	/** Id of the first user message. The task writes it in the commit trailer. */
	messageId: string;
	/** Catalog id; the task reads the archive `starter-<id>.tar.gz`. */
	starterTemplateId: string;
};

/** Queues one `apply-starter-template` run per project. */
@Injectable()
export class TriggerApplyStarterTemplateTaskStarter {
	/**
	 * Queues the run. The global key `apply-starter-template:<projectId>` makes
	 * a repeated call answer the same run, so one project gets one apply.
	 * Throws when the Trigger.dev key is missing or the handoff fails; the caller
	 * then marks the project as failed.
	 */
	async start(input: ApplyStarterTemplateTaskInput): Promise<void> {
		if (!env.TRIGGER_SECRET_KEY) {
			throw new Error("TRIGGER_SECRET_KEY is not set");
		}

		const idempotencyKey = await idempotencyKeys.create(
			`${APPLY_STARTER_TEMPLATE_TASK_ID}:${input.projectId}`,
			{ scope: "global" },
		);

		let lastError: unknown;
		for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
			try {
				await tasks.trigger(APPLY_STARTER_TEMPLATE_TASK_ID, input, {
					// The queue has a limit of 1 per key, so one project runs one apply at a time.
					concurrencyKey: input.projectId,
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [`project:${input.projectId}`],
				});
				return;
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
}

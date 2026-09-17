/**
 * `ProvisionBackendTaskStarter` on the Trigger.dev management API.
 * `BackendsService.provisionBackend` calls it from the API process after
 * the `app_backends` row is written. The task id string
 * "provision-backend" is the only coupling — the task value is never
 * imported here (it would pull the worker code and its database pool
 * into the Nest bundle).
 */
import { setTimeout as delay } from "node:timers/promises";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { idempotencyKeys, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";

import type {
	ProvisionBackendTaskInput,
	ProvisionBackendTaskStarter,
} from "../../domain/ports/provision-backend-task-starter";
import { isDefinitiveTriggerRejection } from "./trigger-turn-task-starter";

// The task slug `provision-backend.task.ts` registers.
const PROVISION_BACKEND_TASK_ID = "provision-backend";

// Same handoff discipline as the turn starter: three bounded attempts,
// definitive rejections stop early.
const TRIGGER_HANDOFF_ATTEMPTS = 3;

// One hour covers a real client retry window; a later replay hits the
// runtime's status check on the row and becomes a no-op.
const TRIGGER_IDEMPOTENCY_TTL = "1h";

@Injectable()
export class TriggerProvisionBackendTaskStarter
	implements ProvisionBackendTaskStarter
{
	/**
	 * Queues `provision-backend` with `requestKey` in the global
	 * idempotency key: a retried project create can never start a twin
	 * provisioning run.
	 */
	async start(input: ProvisionBackendTaskInput): Promise<{ runId: string }> {
		this.assertTriggerConfigured();

		const idempotencyKey = await idempotencyKeys.create(
			`provision-backend:${input.requestKey}`,
			{ scope: "global" },
		);

		let lastError: unknown;
		for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
			try {
				const handle = await tasks.trigger(
					PROVISION_BACKEND_TASK_ID,
					{
						projectId: input.projectId,
						requestKey: input.requestKey,
					},
					{
						idempotencyKey,
						idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
						tags: [`project:${input.projectId}`],
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
			// Same config-bug signal as the turn starter: a missing key is not a
			// user error, so the 503 code stays V2_ENV_MISSING on purpose.
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			});
		}
	}
}

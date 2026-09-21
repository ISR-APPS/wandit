/**
 * `TurnTaskStarter` on the Trigger.dev management API.
 * Called by `turns.service.ts` and `turn-promotion.ts` in the API process.
 * The task id string "builder-turn" is the only coupling to WANDIT-166 —
 * the task value is never imported here (it would pull the worker code and
 * its database pool into the Nest bundle).
 */
import { setTimeout as delay } from "node:timers/promises";
import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";
import { env } from "@wandit/env/server";

import type {
	TurnTaskStarter,
	TurnTaskStartInput,
} from "../../domain/ports/turn-task-starter";

// The task slug WANDIT-166 registers in trigger.config.ts.
const BUILDER_TURN_TASK_ID = "builder-turn";

// Same handoff discipline as the page-build queue: three bounded attempts,
// definitive rejections stop early.
const TRIGGER_HANDOFF_ATTEMPTS = 3;

// One hour covers a real client retry window; a longer TTL would let a
// much-later replay silently adopt a dead run.
const TRIGGER_IDEMPOTENCY_TTL = "1h";

@Injectable()
export class TriggerTurnTaskStarter implements TurnTaskStarter {
	private readonly logger = new Logger(TriggerTurnTaskStarter.name);

	/**
	 * Queues `builder-turn` with `turnId` as the global idempotency key: a
	 * retried `create` or a promoted requeue can never start a twin run.
	 * `concurrencyKey` keeps one project's runs ordered server-side too.
	 */
	async start(input: TurnTaskStartInput): Promise<{ runId: string }> {
		this.assertTriggerConfigured();

		const idempotencyKey = await idempotencyKeys.create(
			`builder-turn:${input.turnId}`,
			{ scope: "global" },
		);

		let lastError: unknown;
		for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
			try {
				const handle = await tasks.trigger(
					BUILDER_TURN_TASK_ID,
					{
						actorUserId: input.actorUserId,
						organizationId: input.organizationId,
						projectId: input.projectId,
						turnId: input.turnId,
					},
					{
						concurrencyKey: input.projectId,
						idempotencyKey,
						idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
						tags: [
							`builder-turn:${input.turnId}`,
							`project:${input.projectId}`,
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
					await delay(100 * 2 ** attempt);
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Trigger.dev handoff failed");
	}

	/**
	 * Best-effort remote cancel. The durable row is the truth: callers
	 * already flipped it to `cancelling`, so a failed remote cancel only
	 * means the run burns until its own abort/ttl catches up — logged, not
	 * thrown.
	 */
	async cancel(runId: string): Promise<void> {
		this.assertTriggerConfigured();

		try {
			await runs.cancel(runId);
		} catch (error) {
			this.logger.warn(
				`Trigger cancel for run ${runId} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private assertTriggerConfigured(): void {
		if (!env.TRIGGER_SECRET_KEY) {
			// The V1 Trigger paths need the same key; a missing key is a config
			// bug, so the 503 code stays V2_ENV_MISSING on purpose.
			throw new ServiceUnavailableException({
				code: "V2_ENV_MISSING",
				message: "TRIGGER_SECRET_KEY is not set",
			});
		}
	}
}

// A 4xx from the Trigger API can never succeed on retry. The turn starter
// and the delete-app-project starter share this taxonomy.
export function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	// SAFETY: the object check above leaves a non-null object; the cast only
	// names the two optional fields the comparisons below read.
	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

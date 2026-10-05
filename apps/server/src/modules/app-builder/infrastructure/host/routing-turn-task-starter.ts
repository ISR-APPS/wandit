/**
 * `TurnTaskStarter` that routes each turn: to the harness host when it is
 * configured and healthy, else to the `builder-turn` Trigger.dev task.
 * `TurnsService.create` and `TurnPromoter.promoteNext` call it in the API,
 * the task, and the host. The row CAS on `runner` decides the owner, so
 * only one path can claim a turn.
 */
import { env } from "@wandit/env/server";

import type {
	TurnRunHandle,
	TurnTaskStarter,
	TurnTaskStartInput,
} from "../../domain/ports/turn-task-starter";
import type { BuilderTurnsRepository } from "../persistence/builder-turns.repository";
import {
	type HarnessHostCalls,
	HarnessHostClient,
} from "./harness-host.client";

// 30 s without host calls after a failed start: the next turns go to
// Trigger.dev at once instead of waiting for a host timeout each.
const HOST_DOWN_PAUSE_MS = 30_000;

/** Log sink: `Sentry.logger` in the API and the host, the Trigger logger in the task. */
export type RoutingLogger = Pick<Console, "info" | "warn">;

/**
 * The starter of each process: the API module, the `builder-turn` task, and
 * the host. Without `HARNESS_HOST_URL` and `HARNESS_HOST_SECRET`, every turn
 * runs on Trigger.dev, as before the host existed.
 */
export function createTurnTaskStarter(
	trigger: TurnTaskStarter,
	turns: Pick<BuilderTurnsRepository, "assignRunner">,
	logger: RoutingLogger,
	hostEnv: Pick<typeof env, "HARNESS_HOST_SECRET" | "HARNESS_HOST_URL"> = env,
): RoutingTurnTaskStarter {
	const host =
		hostEnv.HARNESS_HOST_URL === undefined ||
		hostEnv.HARNESS_HOST_SECRET === undefined
			? null
			: new HarnessHostClient(
					hostEnv.HARNESS_HOST_URL,
					hostEnv.HARNESS_HOST_SECRET,
				);
	return new RoutingTurnTaskStarter(trigger, host, turns, logger);
}

/** Keeps the 30 s host pause in memory, so each process has its own. */
export class RoutingTurnTaskStarter implements TurnTaskStarter {
	private hostDownUntil = 0;

	constructor(
		private readonly trigger: TurnTaskStarter,
		/** Null when `HARNESS_HOST_URL` or `HARNESS_HOST_SECRET` is unset. */
		private readonly host: HarnessHostCalls | null,
		private readonly turns: Pick<BuilderTurnsRepository, "assignRunner">,
		private readonly logger: RoutingLogger,
		private readonly now: () => number = Date.now,
	) {}

	async start(input: TurnTaskStartInput): Promise<TurnRunHandle> {
		const reason = await this.tryHost(input);
		if (reason === null) {
			this.logger.info("builder-turn.path", {
				path: "host",
				turnId: input.turnId,
			});
			return { runner: "host" };
		}
		this.logger.info("builder-turn.path", {
			path: "trigger",
			reason,
			turnId: input.turnId,
		});
		return this.trigger.start(input);
	}

	async cancel(turnId: string, handle: TurnRunHandle): Promise<void> {
		if (handle.runner === "trigger") {
			await this.trigger.cancel(turnId, handle);
			return;
		}
		if (this.host === null) {
			this.logger.warn("builder-turn.host-cancel-skipped", { turnId });
			return;
		}
		try {
			await this.host.cancelTurn(turnId);
		} catch (error) {
			// Best-effort like the Trigger cancel: the API flips the row, revokes
			// the run token, and the host recovery fails a turn it lost.
			this.logger.warn("builder-turn.host-cancel-failed", {
				message: error instanceof Error ? error.message : String(error),
				turnId,
			});
		}
	}

	/**
	 * Gives the turn to the host. Answers null when the host owns it, else the
	 * reason the turn goes to Trigger.dev.
	 */
	private async tryHost(input: TurnTaskStartInput): Promise<string | null> {
		if (this.host === null) {
			return "host_not_configured";
		}
		if (this.now() < this.hostDownUntil) {
			return "host_down";
		}
		// The row says `host` before the call: a host claim needs it, and a
		// stray Trigger run cannot claim the row then.
		if (!(await this.turns.assignRunner(input.turnId, "trigger", "host"))) {
			return "row_not_assignable";
		}
		try {
			await this.host.startTurn(input);
			return null;
		} catch (error) {
			this.hostDownUntil = this.now() + HOST_DOWN_PAUSE_MS;
			this.logger.warn("builder-turn.host-start-failed", {
				message: error instanceof Error ? error.message : String(error),
				turnId: input.turnId,
			});
		}
		// The host may have claimed the row before its answer was lost. Then
		// the move back fails and the host keeps the turn.
		if (!(await this.turns.assignRunner(input.turnId, "host", "trigger"))) {
			return null;
		}
		return "host_start_failed";
	}
}

/**
 * Entry of the harness host process (Phase 2, design A0). It runs the builder
 * turns the API routes here and keeps their Claude Code sessions attached
 * between turns. Start it with `pnpm -F server dev:host`. It calls
 * `runBuilderTurn` with the task deps, a Redis Stream writer, and one harness.
 */
import "../trigger/undici-timeouts";

import { setTimeout as delay } from "node:timers/promises";
import { env } from "@wandit/env/server";
import Redis from "ioredis";

import { createRedisConnectionOptions } from "../infrastructure/redis/redis-connection";
import { ClaudeCodeHarness } from "../modules/app-builder/application/harness/claude-code.harness";
import type { TurnStreamEventInput } from "../modules/app-builder/domain/ports/turn-events";
import { hostRunIdOf } from "../modules/app-builder/domain/turn-queue";
import {
	RedisTurnEventWriter,
	turnEventsKey,
} from "../modules/app-builder/infrastructure/redis/redis-turn-events";
import { createBuilderTurnDeps } from "../trigger/builder-turn.deps";
import {
	builderTurnCancelFinalizer,
	runBuilderTurn,
} from "../trigger/builder-turn.runtime";
import { createHarnessHostServer, HostTurnRunner } from "./harness-host.server";
import { recoverHostTurns } from "./recover-host-turns";

// 30 s between recovery sweeps. A dead turn blocks its project for about
// 2 min at most: its run mark expires, then one sweep ends it.
const RECOVERY_INTERVAL_MS = 30_000;
// The runner refreshes the run mark of a live turn every 30 s. The mark
// lives 90 s, so two failed refreshes do not expose a live turn.
const RUN_MARK_REFRESH_MS = 30_000;
const RUN_MARK_TTL_MS = 90_000;
// 1 s between checks of the live turns while a stopping host drains.
const DRAIN_POLL_MS = 1_000;
// Railway sends SIGKILL at drainMs. The margin lets the log and the close run first.
const DRAIN_MARGIN_MS = 5_000;
// 60 s between idle checks of the kept sessions; the idle window is 20 min.
const IDLE_CHECK_INTERVAL_MS = 60_000;
// Same grace as the task's onCancel: a run stuck in an await the abort
// cannot reach gets the cancel finalizer after it.
const CANCEL_RUN_SETTLE_GRACE_MS = 15_000;
// Postgres connections for all host turns; each turn holds one for short reads.
const POOL_SIZE = 10;

const logger = console;

const port = env.HARNESS_HOST_PORT;
const secret = env.HARNESS_HOST_SECRET;
if (port === undefined || secret === undefined) {
	throw new Error(
		"The harness host needs HARNESS_HOST_PORT and HARNESS_HOST_SECRET",
	);
}
// The keep-alive mode exists only for Claude Code (D17).
if (env.V2_HARNESS !== "claude-code") {
	throw new Error(`The harness host does not run V2_HARNESS=${env.V2_HARNESS}`);
}

const harness = new ClaudeCodeHarness({ keepAlive: true });
const resources = await createBuilderTurnDeps(logger, {
	harness,
	poolSize: POOL_SIZE,
});
const redis = new Redis(createRedisConnectionOptions(env.REDIS_URL));

/**
 * Redis key that exists while a host instance runs the turn. The recovery
 * of every instance reads it, so a new deploy skips the turns of the old one.
 */
function runMarkKey(turnId: string): string {
	return `builder:turn:${turnId}:host-run`;
}

const runner = new HostTurnRunner(async (input, signal) => {
	const runId = hostRunIdOf(input.turnId);
	let ended = false;
	signal.addEventListener(
		"abort",
		() => {
			setTimeout(() => {
				const finalize = builderTurnCancelFinalizer(runId);
				if (ended || finalize === undefined) {
					return;
				}
				finalize().catch((error: unknown) => {
					logger.error("harness-host.cancel-finalize-failed", runId, error);
				});
			}, CANCEL_RUN_SETTLE_GRACE_MS).unref();
		},
		{ once: true },
	);
	const writer = new RedisTurnEventWriter(redis);
	// The run does not delete its mark at the end: a duplicate start on
	// another instance must not remove the mark of the run that owns the row.
	const markRun = async () => {
		try {
			await redis.set(runMarkKey(input.turnId), runId, "PX", RUN_MARK_TTL_MS);
		} catch (error) {
			// The next refresh tries again; the mark outlives two failures.
			logger.warn("harness-host.run-mark-failed", input.turnId, error);
		}
	};
	// The mark exists before the run claims the row, so no sweep sees the
	// claimed row without it.
	await markRun();
	const markTimer = setInterval(() => void markRun(), RUN_MARK_REFRESH_MS);
	try {
		await runBuilderTurn(
			{ ...resources.deps, writer },
			{ ...input, runId, runner: "host" },
			signal,
		);
	} finally {
		ended = true;
		clearInterval(markTimer);
		await writer.close();
	}
}, logger);

const recoveryDeps = {
	appendEvents: async (turnId: string, events: TurnStreamEventInput[]) => {
		const writer = new RedisTurnEventWriter(
			redis,
			Date.now,
			await redis.xlen(turnEventsKey(turnId)),
		);
		for (const event of events) {
			await writer.write(turnId, event);
		}
		await writer.close();
	},
	counters: resources.deps.counters,
	isRunningOnAnyHost: async (turnId: string) =>
		(await redis.exists(runMarkKey(turnId))) === 1,
	insertAssistantMessage: resources.deps.insertAssistantMessage,
	lock: resources.deps.lock,
	logger,
	metering: resources.deps.metering,
	promoteNext: resources.deps.promoteNext,
	turns: resources.turns,
};
let queuedSeen: ReadonlySet<string> = new Set();
const sweep = async () => {
	try {
		queuedSeen = await recoverHostTurns(
			recoveryDeps,
			runner.liveTurnIds(),
			queuedSeen,
		);
	} catch (error) {
		// The next sweep tries again; a dead turn waits one more interval.
		logger.error("harness-host.recovery-failed", error);
	}
};
await sweep();
setInterval(() => void sweep(), RECOVERY_INTERVAL_MS);
setInterval(() => void harness.dropIdleKept(), IDLE_CHECK_INTERVAL_MS);

const server = createHarnessHostServer(secret, runner, logger);
server.listen(port, () => {
	logger.info(`harness-host listening on ${port}`);
});

// Seconds to ms. Railway sends SIGKILL this long after SIGTERM. Unset (local
// dev): no drain, the host exits at once.
const drainMs = (env.RAILWAY_DEPLOYMENT_DRAINING_SECONDS ?? 0) * 1000;

/**
 * Stops the host on SIGTERM or SIGINT. It takes no new turns, lets the live
 * turns finish until 5 s before Railway's SIGKILL, then closes and exits.
 */
const shutdown = async () => {
	// The API sends the next turns to the new instance or to Trigger.dev.
	server.close();
	const deadline = Date.now() + Math.max(0, drainMs - DRAIN_MARGIN_MS);
	logger.info("harness-host.draining", {
		drainMs,
		liveTurns: runner.liveTurnIds().size,
	});
	while (runner.liveTurnIds().size > 0 && Date.now() < deadline) {
		await delay(DRAIN_POLL_MS);
	}
	// A turn still live dies with the process. Its run mark expires, and the
	// recovery of the next instance ends it.
	logger.info("harness-host.drained", {
		liveTurnIds: [...runner.liveTurnIds()],
	});
	await resources.close().catch((error: unknown) => {
		// The process exits next anyway; the log keeps the reason.
		logger.error("harness-host.close-failed", error);
	});
	process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

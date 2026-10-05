/**
 * Entry of the harness host process (Phase 2, design A0). It runs the builder
 * turns the API routes here and keeps their Claude Code sessions attached
 * between turns. Start it with `pnpm -F server dev:host`. It calls
 * `runBuilderTurn` with the task deps, a Redis Stream writer, and one harness.
 */
import "../trigger/undici-timeouts";

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

// 30 s between recovery sweeps: a dead turn blocks its project at most about a minute.
const RECOVERY_INTERVAL_MS = 30_000;
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
	try {
		await runBuilderTurn(
			{ ...resources.deps, writer },
			{ ...input, runId, runner: "host" },
			signal,
		);
	} finally {
		ended = true;
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

const shutdown = () => {
	// Live turns die with the process; the next start's recovery ends them.
	server.close();
	void resources.close().finally(() => process.exit(0));
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

/**
 * Idle-sweep runtime: stops running sandboxes with no activity for
 * `SANDBOX_IDLE_STOP_MINUTES` and records the outcome on each row.
 * `sandbox-idle-sweep.task.ts` calls it through `createSandboxIdleSweepRuntime`;
 * the spec calls `runSandboxIdleSweep` with fakes. No Nest here — Trigger
 * workers compose dependencies by hand.
 */
import type { createDb } from "@wandit/db";
import { Sentry } from "@wandit/observability/node";

import type {
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import { LoggingRepoRestorer } from "../modules/app-builder/infrastructure/git/logging-repo-restorer";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { RedisTurnLock } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";

type TriggerDatabase = ReturnType<typeof createDb>;

/**
 * 20 minutes of silence marks a sandbox idle: `lastActiveAt` moves on turn
 * start/end and on preview heartbeats, so an old value means no turn and
 * no preview traffic.
 */
export const SANDBOX_IDLE_STOP_MINUTES = 20;
const SANDBOX_IDLE_STOP_MS = SANDBOX_IDLE_STOP_MINUTES * 60_000;

/** The slice of the sweep the spec fakes. */
export type SandboxIdleSweepDeps = {
	/** Provider stop; the real one also marks the row itself. */
	provider: Pick<SandboxProvider, "stop">;
	/** The `sandbox_sessions` queries the sweep runs. */
	sessions: Pick<
		SandboxSessionsRepository,
		"listIdleSince" | "markError" | "markStopped"
	>;
	/** The per-project turn lock; a held lock means a live turn. */
	turnLock: Pick<TurnLock, "holder">;
	logger: SandboxLogger;
	/** Clock injection for specs; production reads `new Date()`. */
	now?: () => Date;
};

/**
 * Stops every idle running sandbox. A row whose project holds the turn
 * lock is skipped and counted in `skipped`. One failure marks its row
 * `error` and the sweep continues — a single bad row must not keep the
 * others alive.
 */
export async function runSandboxIdleSweep(deps: SandboxIdleSweepDeps): Promise<{
	failed: number;
	skipped: number;
	stopped: number;
	total: number;
}> {
	const now = deps.now?.() ?? new Date();
	const cutoff = new Date(now.getTime() - SANDBOX_IDLE_STOP_MS);
	const idle = await deps.sessions.listIdleSince(cutoff);
	let stopped = 0;
	let failed = 0;
	let skipped = 0;
	for (const row of idle) {
		const fields = {
			projectId: row.projectId,
			sandboxId: row.providerSandboxId ?? "",
		};
		// A turn can run 60 minutes without touching `lastActiveAt`; the
		// lock says a turn is live. A failed lock read fails the run, not
		// the row — stopping blind could kill a live turn.
		if ((await deps.turnLock.holder(row.projectId)) !== null) {
			skipped += 1;
			deps.logger.info("sandbox.idle-sweep.skipped-live-turn", fields);
			continue;
		}
		try {
			await deps.provider.stop(row.projectId);
			// The real provider marks the row too; this write covers a
			// provider that does not persist and is a no-op on a row
			// already stopped.
			await deps.sessions.markStopped(row.id, now);
			deps.logger.info("sandbox.idle-sweep.stopped", fields);
			stopped += 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await deps.sessions.markError(row.id, message);
			deps.logger.warn("sandbox.idle-sweep.stop-failed", {
				...fields,
				error: message,
			});
			failed += 1;
		}
	}
	return { failed, skipped, stopped, total: idle.length };
}

/**
 * Composes the real repository, provider, and turn lock for the Trigger
 * worker. The sweep only stops; the template init and restorer arguments
 * exist because `stop` shares the provider with the start path. The
 * caller closes `turnLock` (`onModuleDestroy`) in its `finally` — the
 * lock owns a Redis client.
 */
export function createSandboxIdleSweepRuntime(db: TriggerDatabase) {
	const sessions = new SandboxSessionsRepository(db);
	const provider = new VercelSandboxProvider(
		sessions,
		new LoggingRepoRestorer(),
		new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
	);
	const turnLock = new RedisTurnLock();
	return {
		sweep: () =>
			runSandboxIdleSweep({
				logger: Sentry.logger,
				provider,
				sessions,
				turnLock,
			}),
		turnLock,
	};
}

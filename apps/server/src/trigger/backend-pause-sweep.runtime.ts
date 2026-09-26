/**
 * Backend pause sweep runtime (WANDIT-184, D3): pauses idle Supabase
 * projects, ends stale restores, and deletes the projects of deleted apps
 * after the grace window. `backend-pause-sweep.task.ts` calls it through
 * `createBackendPauseSweepRuntime`; the spec calls `runBackendPauseSweep`
 * on fakes. It calls the `app_backends` and `project_secrets` repositories,
 * `SupabaseManagementClient`, and `AuditEventsRepository`.
 */
import type { SupabaseProjectStatus } from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import {
	BACKEND_DEFAULTS,
	type BackendLifecycleWindows,
	selectBackendsToDelete,
	selectBackendsToPause,
	selectOrphanedBackends,
} from "../modules/app-builder/domain/backend-lifecycle";
import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import {
	AppBackendsRepository,
	type BackendLifecycleRow,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import {
	type SupabaseManagementClient,
	supabaseWorkerClientFromEnv,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";

type TriggerDatabase = ReturnType<typeof createDb>;

// One day in milliseconds; the idle cutoff of the list query counts days.
const DAY_MS = 86_400_000;

// Only these Trigger environments own their database. A dev worker can read
// a database that holds refs of another environment, and a delete cannot
// be undone.
const SWEEP_ENVIRONMENTS = new Set(["PRODUCTION", "STAGING"]);

/** The slice of the sweep the spec fakes. */
export type BackendPauseSweepDeps = {
	/** Reads the candidates and writes every state change of the row. */
	backends: Pick<
		AppBackendsRepository,
		| "listLifecycleCandidates"
		| "markDeleted"
		| "markDeleting"
		| "markPaused"
		| "markRestoreFailed"
		| "markRestored"
	>;
	/** The worker Management API client; null when a Supabase platform env value is unset. */
	client: Pick<
		SupabaseManagementClient,
		"deleteProject" | "getProject" | "pauseProject"
	> | null;
	/** Deletes the secret values of a deleted project before its Supabase delete. */
	projectSecrets: Pick<ProjectSecretsRepository, "deleteAllForProject">;
	/** Writes the `backend.paused` and `backend.deleted` audit rows. */
	auditEvents: Pick<AuditEventsRepository, "insert">;
	/** `Sentry.logger` in production; every field value is a string. */
	logger: SandboxLogger;
	/** `ctx.environment.type` of the run: PRODUCTION, STAGING, PREVIEW, or DEVELOPMENT. */
	environmentType: string;
	/** The windows of this run: `BACKEND_DEFAULTS` with the env overrides. */
	windows: BackendLifecycleWindows;
	/** The clock of the run; production passes `() => new Date()`. */
	now: () => Date;
};

/** Outcome of one sweep run; flat counters for the completion log line. */
export type BackendPauseSweepResult = {
	/**
	 * Why the run did nothing: "environment" outside PRODUCTION and STAGING,
	 * "unconfigured" without the Supabase platform env values. Null when it ran.
	 */
	skipped: "environment" | "unconfigured" | null;
	/** Rows the candidate query answered. */
	scanned: number;
	/** Backends of deleted projects that this run moved to `deleting`. */
	orphaned: number;
	/** Orphaned backends whose move or pause threw. */
	orphanFailed: number;
	/** `restoring` rows that Supabase reports healthy; the row is `active` again. */
	restored: number;
	/** `restoring` rows that Supabase reports `RESTORE_FAILED` or `REMOVED`; the row is `error`. */
	restoreFailed: number;
	/** `restoring` rows whose status read or row write threw. */
	restoreCheckFailed: number;
	/** Active rows past their idle window. */
	idle: number;
	/** Idle rows that Supabase paused and the row moved to `paused`. */
	paused: number;
	/** Idle rows whose pause or row write threw; the next run tries again. */
	pauseFailed: number;
	/** `deleting` rows past the grace window. */
	expired: number;
	/** Expired rows whose Supabase delete answered; the ref is cleared unless the row moved. */
	deleted: number;
	/** Expired rows whose secrets delete, Supabase delete, or row write threw; the next run tries again. */
	deleteFailed: number;
};

/**
 * One sweep: reads the candidates once, then runs four steps, each capped
 * at `BACKEND_DEFAULTS.sweepBatchCap` rows: orphaned backends, stale
 * restores, idle pauses, grace deletes. A failed list read rejects the
 * run; a failed row logs and the loop continues.
 */
export async function runBackendPauseSweep(
	deps: BackendPauseSweepDeps,
): Promise<BackendPauseSweepResult> {
	const result: BackendPauseSweepResult = {
		deleteFailed: 0,
		deleted: 0,
		expired: 0,
		idle: 0,
		orphanFailed: 0,
		orphaned: 0,
		pauseFailed: 0,
		paused: 0,
		restoreCheckFailed: 0,
		restoreFailed: 0,
		restored: 0,
		scanned: 0,
		skipped: null,
	};
	if (!SWEEP_ENVIRONMENTS.has(deps.environmentType)) {
		deps.logger.info("backend.pause-sweep.environment-skipped", {
			environmentType: deps.environmentType,
		});
		return { ...result, skipped: "environment" };
	}
	if (deps.client === null) {
		deps.logger.warn("backend.pause-sweep.unconfigured", {});
		return { ...result, skipped: "unconfigured" };
	}
	const client = deps.client;

	const now = deps.now();
	// The query uses the shorter window; `selectBackendsToPause` applies the
	// window of each row.
	const shortestIdleDays = Math.min(
		deps.windows.idleDays,
		deps.windows.publishedIdleDays,
	);
	const rows = await deps.backends.listLifecycleCandidates(
		new Date(now.getTime() - shortestIdleDays * DAY_MS),
	);
	result.scanned = rows.length;

	// A deleted project whose delete step failed, or ran before WANDIT-184,
	// still holds its backend. It moves to `deleting` now, like the delete
	// step does, so the grace delete (and its secrets delete) runs later.
	for (const row of capped(
		selectOrphanedBackends(rows, now),
		"orphan",
		deps.logger,
	)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			if (!(await deps.backends.markDeleting(row.projectId))) {
				continue;
			}
			// A running project costs money during the grace window.
			if (row.status === "active") {
				await client.pauseProject(fields);
			}
			result.orphaned += 1;
			deps.logger.info("backend.pause-sweep.orphan-deleting", fields);
		} catch (error) {
			result.orphanFailed += 1;
			deps.logger.warn("backend.pause-sweep.orphan-failed", {
				...fields,
				error: getErrorMessage(error),
			});
		}
	}

	// A restore that nobody finished (a wake timeout, a closed Cloud tab)
	// leaves `restoring` while Supabase runs the project. `markRestored`
	// starts the idle clock again, so a later run can pause it.
	const restoring = rows.filter(
		(row) => row.status === "restoring" && row.projectDeletedAt === null,
	);
	for (const row of capped(restoring, "restore", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			const { status } = await client.getProject(fields);
			if (status === "ACTIVE_HEALTHY") {
				if (await deps.backends.markRestored(row.projectId)) {
					result.restored += 1;
					deps.logger.info("backend.pause-sweep.restored", fields);
				}
			} else if (status === "RESTORE_FAILED" || status === "REMOVED") {
				if (await deps.backends.markRestoreFailed(row.projectId, status)) {
					result.restoreFailed += 1;
					deps.logger.warn("backend.pause-sweep.restore-failed", {
						...fields,
						status,
					});
				}
			}
		} catch (error) {
			result.restoreCheckFailed += 1;
			deps.logger.warn("backend.pause-sweep.restore-check-failed", {
				...fields,
				error: getErrorMessage(error),
			});
		}
	}

	const idle = selectBackendsToPause(rows, now, deps.windows);
	result.idle = idle.length;
	// LIMIT: a turn that runs across 03:00 UTC after the idle window can lose
	// its database mid-turn: `markPaused` checks only the status. Upgrade:
	// skip a project that holds the turn lock.
	for (const row of capped(idle, "pause", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			try {
				await client.pauseProject(fields);
			} catch (error) {
				// Supabase can apply a pause and still fail the answer, and a row
				// write that failed last run leaves an `active` row on a paused
				// project. The status read keeps the row in step.
				let status: SupabaseProjectStatus | null = null;
				try {
					status = (await client.getProject(fields)).status;
				} catch (readError) {
					deps.logger.warn("backend.pause-sweep.pause-check-failed", {
						...fields,
						error: getErrorMessage(readError),
					});
				}
				if (status !== "INACTIVE" && status !== "PAUSING") {
					throw error;
				}
			}
			if (!(await deps.backends.markPaused(row.projectId))) {
				// The row left `active` during the call, for example to `deleting`.
				deps.logger.warn("backend.pause-sweep.row-moved", fields);
				continue;
			}
			result.paused += 1;
			deps.logger.info("backend.pause-sweep.paused", fields);
		} catch (error) {
			result.pauseFailed += 1;
			deps.logger.warn("backend.pause-sweep.pause-failed", {
				...fields,
				error: getErrorMessage(error),
			});
			continue;
		}
		await audit(deps, row, "backend.paused");
	}

	const expired = selectBackendsToDelete(rows, now, deps.windows);
	result.expired = expired.length;
	for (const row of capped(expired, "delete", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			// A second try of the delete step's secrets delete. It runs first:
			// a throw keeps the ref, so the next run tries both again.
			await deps.projectSecrets.deleteAllForProject(row.projectId);
			await client.deleteProject(fields);
			if (!(await deps.backends.markDeleted(row.projectId, row.ref))) {
				// The Supabase project is gone either way; the audit row records it.
				deps.logger.warn("backend.pause-sweep.row-moved", fields);
			}
			result.deleted += 1;
			deps.logger.info("backend.pause-sweep.deleted", fields);
		} catch (error) {
			result.deleteFailed += 1;
			deps.logger.warn("backend.pause-sweep.delete-failed", {
				...fields,
				error: getErrorMessage(error),
			});
			continue;
		}
		await audit(deps, row, "backend.deleted");
	}
	return result;
}

// At most `sweepBatchCap` rows per step and run: the next day continues.
// The warn names the rows left behind.
// LIMIT: the query has no order, so rows that fail every run can keep the
// cap slots of a step. Upgrade: order each step by its last attempt.
function capped(
	rows: BackendLifecycleRow[],
	action: "orphan" | "restore" | "pause" | "delete",
	logger: SandboxLogger,
): BackendLifecycleRow[] {
	const cap = BACKEND_DEFAULTS.sweepBatchCap;
	if (rows.length > cap) {
		logger.warn("backend.pause-sweep.capped", {
			action,
			left: String(rows.length - cap),
		});
	}
	return rows.slice(0, cap);
}

// The audit row keeps the ref after `markDeleted` clears it from the row.
// A failed insert only logs: the Supabase call already happened.
async function audit(
	deps: Pick<BackendPauseSweepDeps, "auditEvents" | "logger">,
	row: BackendLifecycleRow,
	action: "backend.paused" | "backend.deleted",
): Promise<void> {
	try {
		await deps.auditEvents.insert({
			action,
			actorUserId: null,
			metadata: { ref: row.ref },
			organizationId: row.organizationId,
			projectId: row.projectId,
			targetId: row.id,
			targetType: "app_backend",
		});
	} catch (error) {
		deps.logger.error("backend.pause-sweep.audit-failed", {
			action,
			error: getErrorMessage(error),
			projectId: row.projectId,
		});
	}
}

/**
 * Composes the repositories and the worker Management API client for the
 * Trigger worker. `close` quits the rate limiter's Redis client; the task
 * ends the `db` pool in its `finally`.
 */
export function createBackendPauseSweepRuntime(
	db: TriggerDatabase,
	/** `ctx.environment.type` of the run. */
	environmentType: string,
) {
	const backends = new AppBackendsRepository(db);
	const { client, close } = supabaseWorkerClientFromEnv(
		env,
		backends,
		Sentry.logger,
	);
	return {
		sweep: () =>
			runBackendPauseSweep({
				auditEvents: new AuditEventsRepository(db),
				backends,
				client,
				environmentType,
				logger: Sentry.logger,
				now: () => new Date(),
				projectSecrets: new ProjectSecretsRepository(db),
				windows: {
					deleteGraceDays: BACKEND_DEFAULTS.deleteGraceDays,
					idleDays: env.BACKEND_IDLE_DAYS ?? BACKEND_DEFAULTS.idleDays,
					publishedIdleDays:
						env.BACKEND_IDLE_DAYS_PUBLISHED ??
						BACKEND_DEFAULTS.publishedIdleDays,
				},
			}),
		close,
	};
}

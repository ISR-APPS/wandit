/**
 * Backend pause sweep runtime (WANDIT-184, D3): pauses idle Supabase
 * projects, ends stale and stuck restores and stuck creates, stops the
 * running project of a failed (`error`) backend, and deletes the projects
 * of deleted apps after the grace window. `backend-pause-sweep.task.ts` calls it through
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
	errorBackendAction,
	selectBackendsToDelete,
	selectBackendsToPause,
	selectOrphanedBackends,
	stuckCreatingCutoff,
	stuckRestoreCutoff,
} from "../modules/app-builder/domain/backend-lifecycle";
import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import {
	AppBackendsRepository,
	type BackendLifecycleRow,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import {
	projectStatusOrRemoved,
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
		| "findByProjectId"
		| "listLifecycleCandidates"
		| "markCreatingTimedOut"
		| "markDeleted"
		| "markDeleting"
		| "markErrorProjectStopped"
		| "markPaused"
		| "markRestoreFailed"
		| "markRestoreTimedOut"
		| "markRestored"
	>;
	/** The worker Management API client; null when a Supabase platform env value is unset. */
	client: Pick<
		SupabaseManagementClient,
		"deleteProject" | "getProject" | "pauseProject" | "restoreProject"
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
	/** `restoring` rows older than the restore timeout that Supabase never brought up; the row is `error`. */
	restoreTimedOut: number;
	/** `restoring` rows whose status read or row write threw. */
	restoreCheckFailed: number;
	/** `creating` rows with no write for 30 minutes; the row is `error`. */
	creatingTimedOut: number;
	/** `error` rows whose running Supabase project this run paused. */
	errorPaused: number;
	/** `error` rows whose project was already stopped or gone; the row got the mark. */
	errorMarked: number;
	/** `error` and `creating` rows whose read or write threw; the next run tries again. */
	errorCheckFailed: number;
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
 * One sweep: reads the candidates once, then runs six steps, each capped
 * at `BACKEND_DEFAULTS.sweepBatchCap` rows: orphaned backends, stale
 * restores, stuck creates, the projects of `error` rows, idle pauses, grace
 * deletes. A failed list read rejects the run; a failed row logs and the
 * loop continues.
 */
export async function runBackendPauseSweep(
	deps: BackendPauseSweepDeps,
): Promise<BackendPauseSweepResult> {
	const result: BackendPauseSweepResult = {
		deleteFailed: 0,
		deleted: 0,
		creatingTimedOut: 0,
		errorCheckFailed: 0,
		errorMarked: 0,
		errorPaused: 0,
		expired: 0,
		idle: 0,
		orphanFailed: 0,
		orphaned: 0,
		pauseFailed: 0,
		paused: 0,
		restoreCheckFailed: 0,
		restoreFailed: 0,
		restoreTimedOut: 0,
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
	const restoringBefore = stuckRestoreCutoff(now);
	for (const row of capped(restoring, "restore", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			// A project that Supabase deleted answers 404: the same as `REMOVED`.
			const status = await projectStatusOrRemoved(client, fields);
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
			} else if (row.updatedAt < restoringBefore) {
				// A project stuck in `COMING_UP` never ends the wake by itself. The
				// `error` row shows "Try again", and a later run stops the project
				// if it comes up.
				if (
					await deps.backends.markRestoreTimedOut(
						row.projectId,
						restoringBefore,
						status,
					)
				) {
					result.restoreTimedOut += 1;
					deps.logger.warn("backend.pause-sweep.restore-timed-out", {
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

	// A provision run that died after its create call leaves a `creating`
	// row that holds a running project. The timeout moves it to `error`, so
	// the next run stops the project and the Cloud tab offers "Try again".
	const creating = rows.filter(
		(row) => row.status === "creating" && row.projectDeletedAt === null,
	);
	const createdBefore = stuckCreatingCutoff(now);
	for (const row of capped(creating, "creating", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			if (
				await deps.backends.markCreatingTimedOut(row.projectId, createdBefore)
			) {
				result.creatingTimedOut += 1;
				deps.logger.warn("backend.pause-sweep.creating-timed-out", fields);
			}
		} catch (error) {
			result.errorCheckFailed += 1;
			deps.logger.warn("backend.pause-sweep.creating-check-failed", {
				...fields,
				error: getErrorMessage(error),
			});
		}
	}

	// A failed provisioning or wake can leave a project that runs and costs
	// money while nothing serves it. The mark keeps a stopped project out of
	// the next runs, so the cap slots go to rows that still need a check.
	const failed = rows.filter(
		(row) => row.status === "error" && row.projectDeletedAt === null,
	);
	for (const row of capped(failed, "error", deps.logger)) {
		const fields = { projectId: row.projectId, ref: row.ref };
		try {
			// A ref that a retry deleted answers 404: the same as `REMOVED`.
			const status = await projectStatusOrRemoved(client, fields);
			const action = errorBackendAction(status);
			if (action === "wait") {
				deps.logger.info("backend.pause-sweep.error-waiting", {
					...fields,
					status,
				});
				continue;
			}
			if (action === "pause") {
				// The list read can be minutes old. A retry since then owns the
				// project, and a pause now would stop a backend that is active.
				const current = await deps.backends.findByProjectId(row.projectId);
				if (current?.status !== "error" || current.ref !== row.ref) {
					deps.logger.warn("backend.pause-sweep.row-moved", fields);
					continue;
				}
				await client.pauseProject(fields);
			}
			if (!(await deps.backends.markErrorProjectStopped(row.projectId))) {
				// A retry moved the row to `creating` during the pause call; its
				// run owns the project, so the pause is undone.
				if (action === "pause") {
					await client.restoreProject(fields);
				}
				deps.logger.warn("backend.pause-sweep.row-moved", fields);
				continue;
			}
			if (action === "mark") {
				result.errorMarked += 1;
				deps.logger.info("backend.pause-sweep.error-marked", {
					...fields,
					status,
				});
				continue;
			}
			result.errorPaused += 1;
			deps.logger.info("backend.pause-sweep.error-paused", fields);
		} catch (error) {
			result.errorCheckFailed += 1;
			deps.logger.warn("backend.pause-sweep.error-check-failed", {
				...fields,
				error: getErrorMessage(error),
			});
			continue;
		}
		await audit(deps, row, "backend.paused");
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
	action: "orphan" | "restore" | "creating" | "error" | "pause" | "delete",
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

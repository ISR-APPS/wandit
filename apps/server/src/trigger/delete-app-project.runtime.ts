/**
 * Delete-app-project runtime: removes the external resources of one
 * soft-deleted `v2_app` project.
 * Eight steps run in order: turn-run cancel, sandbox destroy, user Worker
 * delete, backend pause and secrets delete (WANDIT-184), R2 drain,
 * repository delete, audit row, analytics event.
 * Every step runs in its own try/catch, so one failed vendor call never
 * blocks the audit row.
 * `delete-app-project.task.ts` calls it through
 * `createDeleteAppProjectRuntime`. The spec runs `runDeleteAppProject`
 * on fakes. No Nest here — Trigger workers compose dependencies by
 * hand.
 */
import { runs } from "@trigger.dev/sdk";
import { appWorkerName } from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import {
	deleteObjectsByPrefix,
	v2ProjectPrefixes,
} from "../infrastructure/storage/r2";
import type { DeleteAppProjectInput } from "../modules/app-builder/domain/ports/delete-app-project-task-starter";
import type { GitStore } from "../modules/app-builder/domain/ports/git-store";
import type {
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import {
	type WorkersForPlatformsApi,
	workersForPlatformsClientFromEnv,
} from "../modules/app-builder/infrastructure/cloudflare/workers-for-platforms.client";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { LoggingRepoRestorer } from "../modules/app-builder/infrastructure/git/logging-repo-restorer";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { BuilderTurnsRepository } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import {
	type SupabaseManagementClient,
	supabaseWorkerClientFromEnv,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";

type TriggerDatabase = ReturnType<typeof createDb>;

/** The slice of the cleanup the spec fakes. */
export type DeleteAppProjectDeps = {
	/** Finds the queued or running turn; its `triggerRunId` is the run to cancel. */
	turns: Pick<BuilderTurnsRepository, "findActiveForProject">;
	/** `runs.cancel` of the Trigger SDK in production; a `vi.fn` in the spec. */
	cancelRun: (runId: string) => Promise<void>;
	/** Vendor sandbox destroy; it marks the `sandbox_sessions` row itself. */
	sandboxes: Pick<SandboxProvider, "destroy">;
	/**
	 * Deletes the published user Worker. Null when a Cloudflare env value is
	 * unset; `workersForPlatformsClientFromEnv` builds it.
	 */
	workers: Pick<WorkersForPlatformsApi, "deleteScript"> | null;
	/** Reads the `app_backends` row and moves it to `deleting`. */
	backends: Pick<AppBackendsRepository, "findByProjectId" | "markDeleting">;
	/**
	 * Pauses the Supabase project of a running backend. Null when a Supabase
	 * platform env value is unset; the row still moves to `deleting`.
	 */
	supabase: Pick<SupabaseManagementClient, "pauseProject"> | null;
	/** Deletes the `project_secrets` rows of the project. */
	projectSecrets: Pick<ProjectSecretsRepository, "deleteAllForProject">;
	/** code.storage repository delete; a 404 or a 409 counts as done. */
	gitStore: Pick<GitStore, "deleteRepository">;
	/** Drains one R2 prefix and answers the number of deleted keys. */
	deleteObjectsByPrefix: (prefix: string) => Promise<number>;
	/** Append-only writer of the `project.deleted` audit row. */
	auditEvents: Pick<AuditEventsRepository, "insert">;
	/** PostHog capture for `v2_project_deleted`; `triggerAnalytics.capture` in production. */
	capture: (
		distinctId: string,
		event: string,
		properties: Record<string, string | number | boolean | null>,
	) => void;
	/** `Sentry.logger` in production; every field value is a string. */
	logger: SandboxLogger;
};

/** Outcome of one run. Every step reports; no step aborts the others. */
export type DeleteAppProjectResult = {
	/** True when an active turn had a run id and the cancel call resolved. */
	turnCanceled: boolean;
	/** "destroyed" when the vendor call resolved; "error" when it threw. */
	sandbox: "destroyed" | "error";
	/**
	 * "deleted" or "missing" (never published) when Cloudflare answered;
	 * "skipped" without the Cloudflare env values; "error" when the call threw.
	 */
	worker: "deleted" | "missing" | "skipped" | "error";
	/**
	 * "paused" when the row moved to `deleting` and Supabase paused the
	 * project; "deleting" when the row moved and no pause ran (the project
	 * was not running, or no client); "skipped" without a row or on a row
	 * already `deleting`; "error" when a call threw.
	 */
	backend: "paused" | "deleting" | "skipped" | "error";
	/** `project_secrets` rows removed; 0 when the delete threw. */
	secretsDeleted: number;
	/** "deleted" when code.storage answered; "error" when the call threw. */
	repository: "deleted" | "error";
	/** Keys removed under the two `v2ProjectPrefixes`. */
	objectsDeleted: number;
	/** False when the audit insert threw; the log line carries the reason. */
	auditWritten: boolean;
};

/**
 * Runs the eight cleanup steps for one soft-deleted `v2_app` project.
 * It never throws: each step logs its own failure and the result reports every outcome.
 * The audit row carries the same outcomes, so a failed vendor call stays visible after the run.
 */
export async function runDeleteAppProject(
	deps: DeleteAppProjectDeps,
	input: DeleteAppProjectInput,
): Promise<DeleteAppProjectResult> {
	const { projectId } = input;
	const fields = { projectId };

	// A running turn keeps the sandbox busy; cancel its Trigger run first.
	let turnCanceled = false;
	try {
		const active = await deps.turns.findActiveForProject(projectId);
		if (active?.triggerRunId) {
			await deps.cancelRun(active.triggerRunId);
			turnCanceled = true;
		}
	} catch (error) {
		deps.logger.error("app-project.delete.turn-cancel-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	// destroy is a silent no-op without a live sandbox_sessions row and never
	// throws SandboxNotFoundError. It marks the row destroyed itself, so this
	// file never touches that table.
	let sandbox: "destroyed" | "error" = "error";
	try {
		await deps.sandboxes.destroy(projectId);
		sandbox = "destroyed";
	} catch (error) {
		deps.logger.error("app-project.delete.sandbox-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	// A live user Worker keeps serving a deleted app, so its delete comes
	// first after the sandbox (WANDIT-178 names it step one of a delete).
	let worker: DeleteAppProjectResult["worker"] = "skipped";
	const scriptName = appWorkerName(projectId);
	if (deps.workers === null) {
		deps.logger.warn("app-project.delete.worker-unconfigured", fields);
	} else {
		try {
			worker = await deps.workers.deleteScript({ projectId, scriptName });
		} catch (error) {
			worker = "error";
			deps.logger.error("app-project.delete.worker-failed", {
				...fields,
				error: getErrorMessage(error),
				scriptName,
			});
		}
	}

	// The row moves to `deleting` before the pause: the pause sweep then
	// deletes the Supabase project after the grace window, also when the
	// pause fails. WANDIT-199 adds the claim flag; until then no backend is
	// claimed, so every backend goes.
	let backend: DeleteAppProjectResult["backend"] = "skipped";
	try {
		const row = await deps.backends.findByProjectId(projectId);
		if (row !== null && (await deps.backends.markDeleting(projectId))) {
			backend = "deleting";
			// A running project costs money during the grace window; a paused
			// one costs nothing.
			// LIMIT: a `creating` or `restoring` project runs until the grace
			// delete. Upgrade: the sweep pauses a `deleting` row that runs.
			if (row.status === "active" && row.ref !== null) {
				if (deps.supabase === null) {
					deps.logger.warn("app-project.delete.backend-unconfigured", fields);
				} else {
					await deps.supabase.pauseProject({ projectId, ref: row.ref });
					backend = "paused";
				}
			}
		}
	} catch (error) {
		backend = "error";
		deps.logger.error("app-project.delete.backend-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	// A soft delete cascades nothing, so the secret values go here, also for
	// a project without a backend.
	let secretsDeleted = 0;
	try {
		secretsDeleted = await deps.projectSecrets.deleteAllForProject(projectId);
	} catch (error) {
		deps.logger.error("app-project.delete.secrets-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	let objectsDeleted = 0;
	for (const prefix of v2ProjectPrefixes(projectId)) {
		try {
			objectsDeleted += await deps.deleteObjectsByPrefix(prefix);
		} catch (error) {
			deps.logger.error("app-project.delete.objects-failed", {
				...fields,
				error: getErrorMessage(error),
				prefix,
			});
		}
	}

	let repository: "deleted" | "error" = "error";
	try {
		await deps.gitStore.deleteRepository(projectId);
		repository = "deleted";
	} catch (error) {
		deps.logger.error("app-project.delete.repository-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	let auditWritten = false;
	try {
		await deps.auditEvents.insert({
			action: "project.deleted",
			actorUserId: input.actorUserId,
			metadata: {
				backend,
				objectsDeleted,
				repository,
				sandbox,
				secretsDeleted,
				turnCanceled,
				worker,
			},
			organizationId: input.organizationId,
			projectId,
			targetId: projectId,
			targetType: "project",
		});
		auditWritten = true;
	} catch (error) {
		deps.logger.error("app-project.delete.audit-failed", {
			...fields,
			error: getErrorMessage(error),
		});
	}

	// capture only enqueues to PostHog; it never throws into the audit row.
	deps.capture(input.actorUserId, "v2_project_deleted", {
		objectsDeleted,
		organizationId: input.organizationId,
		projectId,
		repository,
		sandbox,
		worker,
	});

	deps.logger.info("app-project.delete.completed", {
		...fields,
		backend,
		objectsDeleted: String(objectsDeleted),
		repository,
		sandbox,
		secretsDeleted: String(secretsDeleted),
		worker,
	});

	return {
		auditWritten,
		backend,
		objectsDeleted,
		repository,
		sandbox,
		secretsDeleted,
		turnCanceled,
		worker,
	};
}

/**
 * Composes the real repositories, the provider, the W4P client, the
 * Supabase client, the git store, the R2 drain, the run cancel, and the
 * PostHog capture for the Trigger worker.
 * The provider's template-init and repo-restorer arguments exist because
 * `destroy` shares the provider with the start path. The task closes `db`
 * and calls `close`, which quits the rate limiter's Redis client.
 */
export function createDeleteAppProjectRuntime(
	db: TriggerDatabase,
	capture: DeleteAppProjectDeps["capture"],
) {
	const sessions = new SandboxSessionsRepository(db);
	const backends = new AppBackendsRepository(db);
	const { client: supabase, close } = supabaseWorkerClientFromEnv(
		env,
		backends,
		Sentry.logger,
	);
	return {
		run: (input: DeleteAppProjectInput) =>
			runDeleteAppProject(
				{
					auditEvents: new AuditEventsRepository(db),
					backends,
					cancelRun: async (runId) => {
						await runs.cancel(runId);
					},
					capture,
					deleteObjectsByPrefix: (prefix) => deleteObjectsByPrefix(prefix),
					gitStore: new CodeStorageGitStore(env),
					logger: Sentry.logger,
					projectSecrets: new ProjectSecretsRepository(db),
					sandboxes: new VercelSandboxProvider(
						sessions,
						new LoggingRepoRestorer(),
						new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
					),
					supabase,
					turns: new BuilderTurnsRepository(db),
					workers: workersForPlatformsClientFromEnv(env, Sentry.logger),
				},
				input,
			),
		close,
	};
}

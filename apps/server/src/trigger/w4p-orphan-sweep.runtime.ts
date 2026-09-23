/**
 * W4P orphan sweep runtime: deletes the user Workers whose project row is
 * gone or soft-deleted, so no deleted app keeps serving.
 * `w4p-orphan-sweep.task.ts` calls it through `createW4pOrphanSweepRuntime`;
 * the spec calls `runW4pOrphanSweep` with fakes. No Nest here — Trigger
 * workers compose dependencies by hand.
 */
import {
	APP_WORKER_PROJECT_TAG_PREFIX,
	appWorkerName,
	uuidSchema,
} from "@wandit/contracts";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import { Sentry } from "@wandit/observability/node";

import type { SandboxLogger } from "../modules/app-builder/domain/ports/sandbox-provider";
import {
	type AppWorkerScope,
	type WorkersForPlatformsApi,
	workersForPlatformsClientFromEnv,
} from "../modules/app-builder/infrastructure/cloudflare/workers-for-platforms.client";
import { ProjectLivenessRepository } from "../modules/app-builder/infrastructure/persistence/project-liveness.repository";

type TriggerDatabase = ReturnType<typeof createDb>;

/**
 * At most 50 deletes per run: about 50 of the 1,200 API calls per 5
 * minutes the token allows. It also bounds the damage of a wrong liveness
 * answer. The next day continues with the rest.
 */
export const W4P_ORPHAN_SWEEP_MAX_DELETES = 50;

// Only these Trigger environments own a namespace and its database, and
// each one owns exactly this namespace. A dev run reads a local database,
// so every staging Worker would look orphaned; a staging run on the
// production namespace would delete every live production Worker.
const NAMESPACE_OF_ENVIRONMENT: Record<string, string> = {
	PRODUCTION: "production",
	STAGING: "staging",
};

/** The slice of the sweep the spec fakes. */
export type W4pOrphanSweepDeps = {
	/** The W4P client; null when a Cloudflare env value is unset. */
	workers: Pick<WorkersForPlatformsApi, "listScripts" | "deleteScript"> | null;
	/** Answers which project ids still have a live `projects` row. */
	projects: Pick<ProjectLivenessRepository, "listLiveIds">;
	/** `Sentry.logger` in production; every field value is a string. */
	logger: SandboxLogger;
	/** `ctx.environment.type` of the run: PRODUCTION, STAGING, PREVIEW, or DEVELOPMENT. */
	environmentType: string;
	/** `CLOUDFLARE_W4P_NAMESPACE` of the run; undefined when unset. */
	namespace: string | undefined;
};

/** Outcome of one sweep run. */
export type W4pOrphanSweepResult = {
	/**
	 * Why the run did nothing: "environment" outside PRODUCTION and STAGING,
	 * or when the namespace is not the one of that environment;
	 * "unconfigured" without the Cloudflare env values. Null when it ran.
	 */
	skipped: "environment" | "unconfigured" | null;
	/** Scripts in the namespace. */
	scanned: number;
	/** Scripts the sweep cannot tie to one project; it never deletes them. */
	ignored: number;
	/** Scripts whose project row is gone or soft-deleted. */
	orphans: number;
	/** Orphans Cloudflare deleted in this run. */
	deleted: number;
	/** Orphans that were already gone when the delete ran. */
	missing: number;
	/** Orphans whose delete threw; the next run tries them again. */
	failed: number;
};

/**
 * Lists the namespace, keeps the scripts tied to one project, and deletes
 * at most `W4P_ORPHAN_SWEEP_MAX_DELETES` orphans. It runs only in the
 * PRODUCTION and STAGING environments, and only on the namespace of that
 * environment. A failed list or a
 * failed liveness read rejects the run before any delete. A failed delete
 * logs and the loop continues.
 */
export async function runW4pOrphanSweep(
	deps: W4pOrphanSweepDeps,
): Promise<W4pOrphanSweepResult> {
	const result: W4pOrphanSweepResult = {
		deleted: 0,
		failed: 0,
		ignored: 0,
		missing: 0,
		orphans: 0,
		scanned: 0,
		skipped: null,
	};
	const expectedNamespace = NAMESPACE_OF_ENVIRONMENT[deps.environmentType];
	if (expectedNamespace === undefined) {
		deps.logger.info("w4p.orphan-sweep.environment-skipped", {
			environmentType: deps.environmentType,
		});
		return { ...result, skipped: "environment" };
	}
	// Security check: the token and the account are the same in both
	// environments, so the namespace name is the only wall between them.
	if (deps.namespace !== undefined && deps.namespace !== expectedNamespace) {
		deps.logger.warn("w4p.orphan-sweep.namespace-mismatch", {
			environmentType: deps.environmentType,
			namespace: deps.namespace,
		});
		return { ...result, skipped: "environment" };
	}
	if (deps.workers === null) {
		deps.logger.warn("w4p.orphan-sweep.unconfigured", {});
		return { ...result, skipped: "unconfigured" };
	}

	// One call answers every script: see the LIMIT on `listScripts`.
	const scripts = await deps.workers.listScripts();
	result.scanned = scripts.length;

	// The tags come from the Cloudflare API, a trust boundary. The sweep
	// deletes only a script whose uuid tag and name agree on one project;
	// the uuid check also keeps a bad value out of the Postgres IN list.
	const candidates: AppWorkerScope[] = [];
	for (const script of scripts) {
		const projectId = script.tags
			.find((tag) => tag.startsWith(APP_WORKER_PROJECT_TAG_PREFIX))
			?.slice(APP_WORKER_PROJECT_TAG_PREFIX.length);
		if (
			projectId === undefined ||
			!uuidSchema.safeParse(projectId).success ||
			script.scriptName !== appWorkerName(projectId)
		) {
			result.ignored += 1;
			deps.logger.info("w4p.orphan-sweep.ignored", {
				scriptName: script.scriptName,
			});
			continue;
		}
		candidates.push({ projectId, scriptName: script.scriptName });
	}

	const live = await deps.projects.listLiveIds(
		candidates.map((candidate) => candidate.projectId),
	);
	const orphans = candidates.filter(
		(candidate) => !live.has(candidate.projectId),
	);
	result.orphans = orphans.length;

	for (const orphan of orphans.slice(0, W4P_ORPHAN_SWEEP_MAX_DELETES)) {
		try {
			const outcome = await deps.workers.deleteScript(orphan);
			result[outcome] += 1;
			deps.logger.info("w4p.orphan-sweep.deleted", { ...orphan, outcome });
		} catch (error) {
			result.failed += 1;
			deps.logger.warn("w4p.orphan-sweep.delete-failed", {
				...orphan,
				error: getErrorMessage(error),
			});
		}
	}
	if (orphans.length > W4P_ORPHAN_SWEEP_MAX_DELETES) {
		deps.logger.warn("w4p.orphan-sweep.capped", {
			left: String(orphans.length - W4P_ORPHAN_SWEEP_MAX_DELETES),
		});
	}
	return result;
}

/**
 * Composes the liveness repository and the W4P client for the Trigger
 * worker. The caller ends the `db` pool in its `finally`.
 */
export function createW4pOrphanSweepRuntime(
	db: TriggerDatabase,
	/** `ctx.environment.type` of the run. */
	environmentType: string,
) {
	return {
		sweep: () =>
			runW4pOrphanSweep({
				environmentType,
				logger: Sentry.logger,
				namespace: env.CLOUDFLARE_W4P_NAMESPACE,
				projects: new ProjectLivenessRepository(db),
				workers: workersForPlatformsClientFromEnv(env, Sentry.logger),
			}),
	};
}

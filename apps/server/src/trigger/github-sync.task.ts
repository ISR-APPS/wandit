/**
 * `github-sync` Trigger.dev task: one reconcile run between code.storage
 * `main` and the linked GitHub repo of one V2 project. `TriggerGithubSyncScheduler`
 * queues it after a commit, a link, a pull, a webhook push, and a status check. The steps live
 * in `github-sync.runtime.ts`; this file only wires the real dependencies.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import { hostExec } from "../modules/app-builder/infrastructure/eas/host-exec";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { GithubAppClient } from "../modules/app-builder/infrastructure/github/github-app.client";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { ProjectGithubLinksRepository } from "../modules/app-builder/infrastructure/persistence/project-github-links.repository";
import { GITHUB_SYNC_TASK_ID } from "../modules/app-builder/infrastructure/trigger/trigger-github-sync-scheduler";
// The worker has no Nest container, so it builds the access service on its own pool.
// It imports the files directly, like the other tasks. The projects barrel loads the full Nest service graph.
import { ProjectAccessService } from "../modules/projects/application/services/project-access.service";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";

import { runGithubSync } from "./github-sync.runtime";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const githubSyncPayloadSchema = z.object({
	projectId: uuidSchema,
});

// Each attempt reads the live heads again, so a retry is safe. A push that
// lost a race with GitHub mirrors on the next attempt.
const GITHUB_SYNC_MAX_ATTEMPTS = 3;

/** One reconcile per run: push `main` to GitHub, or mirror GitHub `main` to `github/main`. */
export const githubSyncTask = schemaTask({
	id: GITHUB_SYNC_TASK_ID,
	// 600 s: two fetches and one push of up to 120 s each, plus two GitHub
	// REST calls of up to 30 s. A kill at maxDuration gets no retry and no
	// catch, so the margin is wide.
	maxDuration: 600,
	// One sync at a time per project: the scheduler passes `concurrencyKey:
	// projectId`. Two parallel runs could write the link state out of order.
	queue: { concurrencyLimit: 1 },
	retry: { maxAttempts: GITHUB_SYNC_MAX_ATTEMPTS },
	schema: githubSyncPayloadSchema,
	run: async (payload, { ctx }) => {
		// Each run makes its own pool and ends it in `finally`, so a reused
		// worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const result = await runGithubSync(
				{
					appCommits: new AppCommitsRepository(db),
					exec: hostExec,
					gitStore: new CodeStorageGitStore(env),
					github: new GithubAppClient(env),
					links: new ProjectGithubLinksRepository(db),
					// The process logger: the Trigger Sentry client drops `Sentry.logger` lines.
					logger,
					projectAccess: new ProjectAccessService(new ProjectsRepository(db)),
				},
				{
					isFinalAttempt: ctx.attempt.number >= GITHUB_SYNC_MAX_ATTEMPTS,
					projectId: payload.projectId,
				},
			);
			logger.info("GitHub sync ended", {
				projectId: payload.projectId,
				result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} catch (error) {
			Sentry.captureException(error, {
				tags: { projectId: payload.projectId },
			});
			throw error;
		} finally {
			await db.$client.end();
		}
	},
});

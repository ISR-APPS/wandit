/**
 * `apply-starter-template` Trigger.dev task: one run per project that starts
 * from a starter template. `TriggerApplyStarterTemplateTaskStarter` queues it
 * by task id from `AppProjectsService.createFromStarterTemplate`. The steps
 * live in `apply-starter-template.runtime.ts` so the spec runs them on fakes.
 * This file only wires the real dependencies.
 */
import "./undici-timeouts";

import { readFile } from "node:fs/promises";
import { logger, schemaTask } from "@trigger.dev/sdk";
import { starterTemplateIdSchema, uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { z } from "zod";

import { contentTypeFor, putSiteFile } from "../infrastructure/storage/r2";
import { createBuilderHarness } from "../modules/app-builder/application/harness/builder-harness.factory";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { commitTurn } from "../modules/app-builder/infrastructure/git/commit-turn";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { ProjectGithubLinksRepository } from "../modules/app-builder/infrastructure/persistence/project-github-links.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { RedisTurnLock } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import { startSandboxWithoutTurn } from "../modules/app-builder/infrastructure/sandbox/sandbox-start";
import { starterTemplateArchivePath } from "../modules/app-builder/infrastructure/sandbox/starter-template-archive";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import { APPLY_STARTER_TEMPLATE_TASK_ID } from "../modules/app-builder/infrastructure/trigger/trigger-apply-starter-template-task-starter";
import { TriggerGithubSyncScheduler } from "../modules/app-builder/infrastructure/trigger/trigger-github-sync-scheduler";
import { TriggerThumbnailCaptureScheduler } from "../modules/app-builder/infrastructure/trigger/trigger-thumbnail-capture-scheduler";
import { ChatsRepository } from "../modules/generation/infrastructure/persistence/chats.repository";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";

import {
	type ApplyStarterTemplateDeps,
	failStarterTemplateApply,
	runApplyStarterTemplate,
} from "./apply-starter-template.runtime";
import { starterTemplateQueue } from "./sandbox-task-queues";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const applyStarterTemplatePayloadSchema = z.object({
	chatId: uuidSchema,
	messageId: uuidSchema,
	projectId: uuidSchema,
	starterTemplateId: starterTemplateIdSchema,
});

/** One starter template apply per project: lock, sandbox, archive, commit, note, thumbnail. */
export const applyStarterTemplateTask = schemaTask({
	id: APPLY_STARTER_TEMPLATE_TASK_ID,
	// 600 s: a sandbox boot from the image when no snapshot exists (about
	// 70 s), the archive copy, and one git push with its retry.
	maxDuration: 600,
	queue: starterTemplateQueue,
	// Three attempts cover a short vendor or network failure. A second
	// attempt is safe: the runtime finds the commit of the first one. The
	// waits are 5 s, then 10 s.
	retry: {
		factor: 2,
		maxAttempts: 3,
		maxTimeoutInMs: 30_000,
		minTimeoutInMs: 5_000,
		randomize: false,
	},
	schema: applyStarterTemplatePayloadSchema,
	run: async (payload, { ctx }) => {
		// Each attempt makes its own pool and Redis client and ends them in
		// `finally`, so a reused worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const lock = new RedisTurnLock();
		try {
			const result = await runApplyStarterTemplate(
				composeDeps(db, lock),
				payload,
			);
			logger.info("Starter template apply ended", {
				...result,
				projectId: payload.projectId,
				starterTemplateId: payload.starterTemplateId,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await lock.onModuleDestroy();
			await db.$client.end();
		}
	},
	// Runs one time, after the last failed attempt. The project must not stay
	// in the "template is being set up" state. Trigger.dev does not call it
	// for a crashed or canceled run, and it does not retry a hook that throws.
	// `AppProjectsService.get` then ends the wait: it clears the column of a
	// project that has no code 35 minutes after its create.
	onFailure: async ({ payload }) => {
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			await failStarterTemplateApply(
				{
					appCommits: new AppCommitsRepository(db),
					chats: new ChatsRepository(db),
					logger,
					projects: new ProjectsRepository(db),
				},
				payload,
			);
		} finally {
			await db.$client.end();
		}
	},
});

// The real repositories and clients of one attempt, composed by hand like
// the publish-app task: the Trigger worker runs outside Nest.
function composeDeps(
	db: ReturnType<typeof createDb>,
	lock: RedisTurnLock,
): ApplyStarterTemplateDeps {
	const appCommits = new AppCommitsRepository(db);
	const sandboxSessions = new SandboxSessionsRepository(db);
	const gitStore = new CodeStorageGitStore(env);
	const turnProjects = new TurnProjectRepository(db);
	const backends = new AppBackendsRepository(db);
	const sandboxes = new VercelSandboxProvider(
		sandboxSessions,
		new CodeStorageRepoRestorer(gitStore, appCommits),
		new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
	);
	const harness = createBuilderHarness(env.V2_HARNESS);
	// The process logger: the Trigger Sentry client drops `Sentry.logger` lines.
	const thumbnails = new TriggerThumbnailCaptureScheduler(logger);
	return {
		appCommits,
		chats: new ChatsRepository(db),
		commit: commitTurn,
		commitDeps: {
			appCommits,
			githubSync: new TriggerGithubSyncScheduler(
				new ProjectGithubLinksRepository(db),
				logger,
			),
			gitStore,
			putPatch: (key, text) => putSiteFile(key, text, contentTypeFor(key)),
		},
		lock,
		logger,
		projects: new ProjectsRepository(db),
		readArchive: (starterTemplateId) =>
			readFile(
				starterTemplateArchivePath(TEMPLATE_ARCHIVE_DIR, starterTemplateId),
			),
		sandboxSessions,
		scheduleThumbnail: (projectId, commitSha) =>
			thumbnails.schedule(projectId, commitSha),
		// The harness key makes a new sandbox boot from the template snapshot,
		// in about 4 s. The disk then also holds the browser of the thumbnail.
		startSandbox: async (projectId) =>
			startSandboxWithoutTurn(
				{ backends, logger, projects: turnProjects, sandboxes },
				projectId,
				await harness.bootstrapKey(),
			),
		turnProjects,
	};
}

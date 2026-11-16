/**
 * `desktop-build` Trigger.dev task (docs/v2/desktop-apps.md section 9): one
 * desktop build per run, for Windows or macOS. `trigger-desktop-build-task-starter.ts`
 * queues it by task id with the key `desktop-build:<buildId>`. The steps
 * live in `desktop-build.runtime.ts` so the spec runs them on fakes. This
 * file only wires the real dependencies.
 */
import "./undici-timeouts";

import { resolve } from "node:path";

import { logger, queue, schemaTask, wait } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import {
	deleteObject,
	desktopDownloadHeaders,
	desktopUpdatesUrl,
	isR2Configured,
	presignedGetUrl,
	presignedPutUrl,
	putObject,
	putSiteFile,
} from "../infrastructure/storage/r2";
import { desktopBuildRunnerFromEnv } from "../modules/app-builder/infrastructure/desktop/github-desktop-build-runner";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { DesktopBuildsRepository } from "../modules/app-builder/infrastructure/persistence/desktop-builds.repository";
import { DesktopMigrationsRepository } from "../modules/app-builder/infrastructure/persistence/desktop-migrations.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";

import { runDesktopBuild } from "./desktop-build.runtime";
import { createTriggerMetering } from "./metering.runtime";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const desktopBuildPayloadSchema = z.object({
	buildId: uuidSchema,
	projectId: uuidSchema,
});

// One build per project at a time: the starter sets `concurrencyKey:
// projectId`, so each project gets its own queue with this limit. The live
// index on `desktop_builds` guards the same rule.
// LIMIT: no global cap. Each payer has at most 2 live builds
// (MAX_LIVE_DESKTOP_BUILDS_PER_PAYER), and the GitHub account runs all of
// them in parallel up to its concurrency (at most 5 macOS jobs on Free, Pro,
// and Team). Upgrade: a global queue limit.
const desktopBuildQueue = queue({
	concurrencyLimit: 1,
	name: "desktop-builds",
});

/** One desktop build per `desktop_builds` row: build, gate, CI, sign, upload, settle. */
export const desktopBuildTask = schemaTask({
	id: "desktop-build",
	// 1 vCPU and 2 GB: the run holds the frontend output (up to 100 MB) and
	// its gzip archive in memory. The setup exe and the disk image stream
	// through the disk. A Tauri macOS run re-packs the update archive in memory
	// (see the LIMIT in desktop-build.runtime.ts).
	machine: "medium-1x",
	// 4800 compute seconds (80 min): the 70 min poll ceiling plus the build
	// and the signing. A `wait.for` above 5 s does not count, so this is a
	// safety net, not an estimate.
	maxDuration: 4800,
	queue: desktopBuildQueue,
	// After the claim, a retry finds the row out of `queued` and skips. It
	// cannot recover a half-done build, so one attempt is enough.
	retry: { maxAttempts: 1 },
	schema: desktopBuildPayloadSchema,
	run: async (payload, { ctx }) => {
		// Each run makes its own pool and ends it in `finally`, so a reused
		// worker leaks no connection. The pool closes an idle connection after
		// 10 s. Thus the 70 min CI poll does not keep one connection open.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const result = await runDesktopBuild(
				{
					appSecretsEncryptionKey: env.APP_SECRETS_ENCRYPTION_KEY ?? null,
					backends: new AppBackendsRepository(db),
					billingDisabled: env.GENERATION_BILLING_MODE === "off",
					builds: new DesktopBuildsRepository(db),
					captureException: (error, tags) => {
						Sentry.captureException(error, { tags });
					},
					fetch: globalThis.fetch,
					logger: Sentry.logger,
					metering: createTriggerMetering(db),
					migrations: new DesktopMigrationsRepository(db),
					now: Date.now,
					projects: new TurnProjectRepository(db),
					runner: desktopBuildRunnerFromEnv(env),
					sandboxes: new VercelSandboxProvider(
						new SandboxSessionsRepository(db),
						new CodeStorageRepoRestorer(
							new CodeStorageGitStore(env),
							new AppCommitsRepository(db),
						),
						new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
					),
					shellDirs: {
						electron: resolve(
							TEMPLATE_ARCHIVE_DIR,
							"desktop-shell-electron/shell",
						),
						tauri: resolve(TEMPLATE_ARCHIVE_DIR, "desktop-shell/src-tauri"),
					},
					// A Trigger wait frees the machine during the CI poll.
					sleep: (ms) => wait.for({ seconds: ms / 1000 }),
					storage: isR2Configured()
						? {
								deleteObject,
								presignGet: presignedGetUrl,
								presignPut: presignedPutUrl,
								putInput: (key, bytes, cacheControl) =>
									putSiteFile(key, bytes, "application/gzip", cacheControl),
								putBuildFile: (key, filePath, fileName) =>
									putObject(
										key,
										{ filePath, kind: "file" },
										desktopDownloadHeaders(fileName),
									),
							}
						: null,
					updatesUrl: desktopUpdatesUrl,
				},
				{ ...payload, triggerRunId: ctx.run.id },
			);
			logger.info("Desktop build ended", {
				...result,
				buildId: payload.buildId,
				projectId: payload.projectId,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});

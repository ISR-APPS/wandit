/**
 * Scheduled task: every 10 minutes, build the template snapshot of each
 * platform when the template, the image, or the harness changed. Without
 * the Vercel credentials, the run skips and its log line names them. The
 * Trigger scheduler calls it; the work lives in `template-snapshot.runtime.ts`.
 * The task file only wires real dependencies.
 */
import "./undici-timeouts";
import { logger, schedules } from "@trigger.dev/sdk";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";

import { createBuilderHarness } from "../modules/app-builder/application/harness/builder-harness.factory";
import { LoggingRepoRestorer } from "../modules/app-builder/infrastructure/git/logging-repo-restorer";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import { TemplateVersionService } from "../modules/app-builder/infrastructure/template/template-version.service";

import { runTemplateSnapshotBuild } from "./template-snapshot.runtime";

/** Cron entry; `retry.maxAttempts: 1` — the next tick retries anyway. */
export const templateSnapshotTask = schedules.task({
	id: "template-snapshot",
	cron: { pattern: "*/10 * * * *", timezone: "UTC" },
	// 900 s: two builds of about 1 to 3 minutes each, with a margin for a
	// slow package install.
	maxDuration: 900,
	// One build at a time: two runs must not build the same snapshot.
	queue: { concurrencyLimit: 1 },
	retry: { maxAttempts: 1 },
	// 9 minutes: a stale tick expires before the next one fires.
	ttl: "9m",
	run: async (_payload, { ctx }) => {
		// The provider needs the sessions repository; the build writes no row.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const result = await runTemplateSnapshotBuild({
				envSource: env,
				harness: createBuilderHarness(env.V2_HARNESS),
				logger: Sentry.logger,
				provider: new VercelSandboxProvider(
					new SandboxSessionsRepository(db),
					new LoggingRepoRestorer(),
					new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
				),
				versions: new TemplateVersionService(),
			});
			logger.info("Template snapshot build completed", {
				...result,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});

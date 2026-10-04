/**
 * `publish-app` Trigger.dev task (WANDIT-178): one publish attempt of a V2
 * web app per run. `trigger-publish-app-task-starter.ts` queues it by task
 * id with the key `publish-app:<buildId>`. The steps live in
 * `publish-app.runtime.ts` so the spec runs them on fakes. This file only
 * wires the real dependencies.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import {
	getObjectBytes,
	isR2Configured,
	putSiteFile,
} from "../infrastructure/storage/r2";
import { AuditEventsService } from "../modules/app-builder/application/services/audit-events.service";
import { BackendPublishGate } from "../modules/app-builder/application/services/backend-publish-gate";
import { ProjectSecretsService } from "../modules/app-builder/application/services/project-secrets.service";
import { SecretScanGate } from "../modules/app-builder/domain/publish-gate/secret-scanner";
import { workersForPlatformsClientFromEnv } from "../modules/app-builder/infrastructure/cloudflare/workers-for-platforms.client";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { AppPublishRepository } from "../modules/app-builder/infrastructure/persistence/app-publish.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import {
	type SupabaseManagementClient,
	supabaseWorkerClientFromEnv,
} from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import { TriggerSyncBackendAuthUrlsTaskStarter } from "../modules/app-builder/infrastructure/trigger/trigger-sync-backend-auth-urls-task-starter";
import { DomainRoutingService } from "../modules/domains/infrastructure/cloudflare/domain-routing.service";
import { DomainsRepository } from "../modules/domains/infrastructure/persistence/domains.repository";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";
import { DeploymentsRepository } from "../modules/sites/infrastructure/persistence/deployments.repository";

import { type PublishAppDeps, runPublishApp } from "./publish-app.runtime";
import { publishAppQueue } from "./publish-task-queues";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const publishAppPayloadSchema = z.object({
	buildId: uuidSchema,
	projectId: uuidSchema,
});

/** One publish attempt per `app_builds` row: build, store, gate, upload, point, promote. */
export const publishAppTask = schemaTask({
	id: "publish-app",
	// 1 vCPU and 2 GB: the run holds the whole build output in memory twice
	// (bytes and base64), up to 100 MB each.
	machine: "medium-1x",
	// 900 s (WANDIT-178): a sandbox wake, a 3 min install, a 5 min build,
	// and the upload. The API marks a live row older than 30 min as failed.
	maxDuration: 900,
	queue: publishAppQueue,
	// After the claim, a retry finds the row out of `queued` and skips. It
	// cannot resume a half-done upload, so one attempt is enough.
	retry: { maxAttempts: 1 },
	schema: publishAppPayloadSchema,
	run: async (payload, { ctx }) => {
		// Each run makes its own pool and Supabase client and ends them in
		// `finally`, so a reused worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const supabase = supabaseWorkerClientFromEnv(
			env,
			new AppBackendsRepository(db),
			Sentry.logger,
		);
		try {
			const result = await runPublishApp(composeDeps(db, supabase.client), {
				...payload,
				triggerRunId: ctx.run.id,
			});
			logger.info("App publish ended", {
				...result,
				buildId: payload.buildId,
				projectId: payload.projectId,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await supabase.close();
			await db.$client.end();
		}
	},
});

// The real repositories and clients of one run, composed by hand like the
// builder-turn task: the Trigger worker runs outside Nest.
function composeDeps(
	db: ReturnType<typeof createDb>,
	supabase: SupabaseManagementClient | null,
): PublishAppDeps {
	const secretRows = new ProjectSecretsRepository(db);
	const routing = new DomainRoutingService(new DomainsRepository(db));
	const backends = new AppBackendsRepository(db);
	const auditRows = new AuditEventsRepository(db);
	const captureException: PublishAppDeps["captureException"] = (
		error,
		tags,
	) => {
		Sentry.captureException(error, { tags });
	};
	return {
		audit: new AuditEventsService(auditRows, Sentry.logger),
		authUrlSync: new TriggerSyncBackendAuthUrlsTaskStarter(),
		backends,
		captureException,
		deployments: new DeploymentsRepository(db),
		// WANDIT-190 order: the secret scan of WANDIT-181 first, then the
		// backend checks, both before the upload.
		gates: [
			new SecretScanGate(),
			new BackendPublishGate({
				backends,
				captureException: (error, tags) => {
					Sentry.captureException(error, { tags });
				},
				client: supabase,
				fetch: globalThis.fetch,
				logger: Sentry.logger,
			}),
		],
		logger: Sentry.logger,
		projects: new TurnProjectRepository(db),
		publish: new AppPublishRepository(db),
		// The V1 rule: without KV, only `ALLOW_PUBLISH_WITHOUT_KV` (local
		// development) publishes, and no pointer is written.
		routing: routing.isKvConfigured()
			? routing
			: env.ALLOW_PUBLISH_WITHOUT_KV
				? {
						putHostPointer: async (host) => {
							logger.warn("KV is not configured; no pointer write", { host });
						},
						refreshProjectDomains: async (projectId) => {
							logger.warn("KV is not configured; no domain pointer write", {
								projectId,
							});
						},
					}
				: null,
		sandboxes: new VercelSandboxProvider(
			new SandboxSessionsRepository(db),
			new CodeStorageRepoRestorer(
				new CodeStorageGitStore(env),
				new AppCommitsRepository(db),
			),
			new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		),
		secretRows,
		secretValues: new ProjectSecretsService(
			secretRows,
			new ProjectsRepository(db),
			auditRows,
			env,
		),
		sitesDomain: env.SITES_DOMAIN,
		storage: isR2Configured()
			? {
					get: getObjectBytes,
					put: (key, bytes) => putSiteFile(key, bytes, "application/gzip"),
				}
			: null,
		workers: workersForPlatformsClientFromEnv(env, Sentry.logger),
	};
}

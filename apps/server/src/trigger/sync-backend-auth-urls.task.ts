/**
 * `sync-backend-auth-urls` Trigger.dev task (WANDIT-190): one run writes the
 * login URLs of one V2 app into its Supabase auth config.
 * `TriggerSyncBackendAuthUrlsTaskStarter` queues it after a publish and
 * after a custom domain change. The rules live in `BackendAuthUrlsService`;
 * this file only wires the real repositories and the Management API client.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import { BackendAuthUrlsService } from "../modules/app-builder/application/services/backend-auth-urls.service";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppPublishRepository } from "../modules/app-builder/infrastructure/persistence/app-publish.repository";
import { supabaseWorkerClientFromEnv } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import { SYNC_BACKEND_AUTH_URLS_TASK_ID } from "../modules/app-builder/infrastructure/trigger/trigger-sync-backend-auth-urls-task-starter";
import { DomainsRepository } from "../modules/domains/infrastructure/persistence/domains.repository";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const syncBackendAuthUrlsPayloadSchema = z.object({
	projectId: uuidSchema,
});

/** One sync per run. The sync reads the full state, so a repeated run writes nothing. */
export const syncBackendAuthUrlsTask = schemaTask({
	id: SYNC_BACKEND_AUTH_URLS_TASK_ID,
	// 600 s: two Management API calls of up to 165 s each (5 attempts of
	// 30 s plus backoff), and time for rate-limit waits. A kill at
	// maxDuration gets no retry and no Sentry event, so the margin is wide.
	maxDuration: 600,
	// One run at a time: an older run that writes last would bring back a
	// detached domain.
	// One sync at a time per project: the starter passes `concurrencyKey:
	// projectId`, so an older run never writes last.
	queue: { concurrencyLimit: 1 },
	// A retry reads the state again, so it is safe.
	retry: { maxAttempts: 3 },
	schema: syncBackendAuthUrlsPayloadSchema,
	run: async (payload, { ctx }) => {
		// Each run makes its own pool and ends it in `finally`, so a reused
		// worker leaks no connection.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const backends = new AppBackendsRepository(db);
		const { client, close } = supabaseWorkerClientFromEnv(
			env,
			backends,
			Sentry.logger,
		);
		try {
			const publish = new AppPublishRepository(db);
			const service = new BackendAuthUrlsService({
				backends,
				client,
				domains: new DomainsRepository(db),
				findLiveSlug: async (projectId) =>
					(await publish.findLiveDeployment(projectId))?.slug ?? null,
				logger: Sentry.logger,
				previewDomain: env.PREVIEW_DOMAIN ?? null,
				sitesDomain: env.SITES_DOMAIN,
			});
			const result = await service.sync(payload.projectId);
			logger.info("Backend auth URLs synced", {
				projectId: payload.projectId,
				result,
				triggerRunId: ctx.run.id,
			});
			return { result };
		} catch (error) {
			Sentry.captureException(error, {
				tags: { projectId: payload.projectId },
			});
			throw error;
		} finally {
			await close();
			await db.$client.end();
		}
	},
});

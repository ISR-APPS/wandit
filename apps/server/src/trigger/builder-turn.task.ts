/**
 * `builder-turn` Trigger.dev task (WANDIT-166): one builder turn per run.
 * `trigger-turn-task-starter.ts` queues it by task id and `turn-promotion`
 * requeues it; the run body lives in `builder-turn.runtime.ts` so the spec
 * drives it with fakes. The task file only wires real dependencies.
 */
import "./undici-timeouts";

import { logger, schemaTask } from "@trigger.dev/sdk";
import { appBuilderRoutes } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import { contentTypeFor, putSiteFile } from "../infrastructure/storage/r2";
import { createBuilderHarness } from "../modules/app-builder/application/harness/builder-harness.factory";
import { BuilderHostToolRegistry } from "../modules/app-builder/application/host-tools/builder-host-tool-registry";
import { mintLlmProxyToken } from "../modules/app-builder/application/services/llm-proxy-token.service";
import { ProjectSecretsService } from "../modules/app-builder/application/services/project-secrets.service";
import { TurnPromoter } from "../modules/app-builder/application/services/turn-promotion";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { commitTurn } from "../modules/app-builder/infrastructure/git/commit-turn";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { AuditEventsRepository } from "../modules/app-builder/infrastructure/persistence/audit-events.repository";
import { BuilderSessionsRepository } from "../modules/app-builder/infrastructure/persistence/builder-sessions.repository";
import { BuilderTurnsRepository } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { LlmProxyRequestsRepository } from "../modules/app-builder/infrastructure/persistence/llm-proxy-requests.repository";
import { ProjectCostCapsRepository } from "../modules/app-builder/infrastructure/persistence/project-cost-caps.repository";
import { ProjectNetworkHostsRepository } from "../modules/app-builder/infrastructure/persistence/project-network-hosts.repository";
import { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { LlmSpendCounters } from "../modules/app-builder/infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "../modules/app-builder/infrastructure/redis/redis-turn-lock";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import { SupabaseManagementClient } from "../modules/app-builder/infrastructure/supabase/supabase-management.client";
import { RedisSupabaseRateLimiter } from "../modules/app-builder/infrastructure/supabase/supabase-rate-limiter";
import { TriggerTurnEventWriter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-events";
import { TriggerTurnTaskStarter } from "../modules/app-builder/infrastructure/trigger/trigger-turn-task-starter";
import { resolveBillingPlan } from "../modules/billing/application/services/resolve-billing-plan";
import { SubscriptionsRepository } from "../modules/billing/infrastructure/persistence/subscriptions.repository";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { subjectPayer } from "../modules/credits/domain/credit-owner";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
import { ChatsRepository } from "../modules/generation/infrastructure/persistence/chats.repository";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";
import { ProductSettingsService } from "../modules/settings/application/services/product-settings.service";
import { ProductSettingsRepository } from "../modules/settings/infrastructure/persistence/product-settings.repository";

import { builderTurnQueue } from "./builder-task-queues";
import {
	builderTurnCancelFinalizer,
	runBuilderTurn,
} from "./builder-turn.runtime";
import { createTriggerMetering } from "./metering.runtime";

// Half the SDK's ~30 s kill window; leaves time for the finalizer itself.
const CANCEL_RUN_SETTLE_GRACE_MS = 15_000;

/** One builder turn: sandbox, harness session, stream, commit, settle. */
export const builderTurnTask = schemaTask({
	id: "builder-turn",
	// One turn fits in the small-2x profile: the agent process runs inside
	// the sandbox, so the worker only holds the stream and the DB pool.
	machine: "small-2x",
	// 60 minutes: the proxy token TTL assumes the same ceiling.
	maxDuration: 3600,
	queue: builderTurnQueue,
	// A retried run must not start a second turn: the row CAS and the task
	// idempotency key already dedupe, so one attempt is the whole contract.
	retry: { maxAttempts: 1 },
	schema: z.object({
		actorIsLimitExempt: z.boolean().optional(),
		actorUserId: z.string().min(1),
		organizationId: z.string().min(1).nullable(),
		projectId: z.uuid(),
		turnId: z.uuid(),
	}),
	// onCancel is declared below `run` on purpose: the hook's payload type
	// is inferred from run's annotation, resolved in source order.
	run: async (payload, { ctx, signal }) => {
		// Fresh pool per run; ended in `finally` so the worker process can
		// be reused without leaking Postgres connections.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		const writer = new TriggerTurnEventWriter();
		const turnLock = new RedisTurnLock();
		const counters = new LlmSpendCounters();
		const supabaseToken = env.SUPABASE_PLATFORM_TOKEN;
		const supabaseOrganizationSlug = env.SUPABASE_PLATFORM_ORG_ID;
		// Without the platform env no client exists, and every backend tool
		// answers `failed` "SUPABASE_PLATFORM_TOKEN is not set".
		const supabaseRateLimiter =
			supabaseToken && supabaseOrganizationSlug
				? new RedisSupabaseRateLimiter()
				: null;
		try {
			const turns = new BuilderTurnsRepository(db);
			const sandboxSessions = new SandboxSessionsRepository(db);
			const gitStore = new CodeStorageGitStore(env);
			const sandboxes = new VercelSandboxProvider(
				sandboxSessions,
				new CodeStorageRepoRestorer(gitStore, new AppCommitsRepository(db)),
				new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
			);
			const chats = new ChatsRepository(db);
			const subscriptions = new SubscriptionsRepository(db);
			const metering = createTriggerMetering(db);
			const credits = new CreditsService(new CreditsRepository(db));
			const settings = new ProductSettingsService(
				new ProductSettingsRepository(db),
			);
			const promoter = new TurnPromoter(
				turns,
				turnLock,
				new TriggerTurnTaskStarter(),
			);
			const backends = new AppBackendsRepository(db);
			const audit = new AuditEventsRepository(db);
			const secretsRepo = new ProjectSecretsRepository(db);
			const supabase =
				supabaseToken && supabaseOrganizationSlug && supabaseRateLimiter
					? new SupabaseManagementClient({
							fetch: globalThis.fetch,
							// The agent waits on each tool call: a full bucket answers
							// `rate_limited` at once instead of a wait of up to 5 minutes.
							interactive: true,
							logger: Sentry.logger,
							organizationSlug: supabaseOrganizationSlug,
							// The ownership check reads the same row the tools resolve.
							ownsRef: async (projectId, ref) =>
								(await backends.findByProjectId(projectId))?.ref === ref,
							rateLimiter: supabaseRateLimiter,
							sleep: (ms) =>
								new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
							token: supabaseToken,
						})
					: null;

			await runBuilderTurn(
				{
					backends,
					billingDisabled: env.GENERATION_BILLING_MODE === "off",
					caps: new ProjectCostCapsRepository(db),
					commit: commitTurn,
					commitDeps: {
						appCommits: new AppCommitsRepository(db),
						gitStore,
						putPatch: (key, text) =>
							putSiteFile(key, text, contentTypeFor(key)),
					},
					counters,
					harness: createBuilderHarness(env.V2_HARNESS),
					hostTools: new BuilderHostToolRegistry({
						audit,
						backends,
						client: supabase,
						imageEditModel: env.AI_IMAGE_EDIT_MODEL ?? null,
						imageModel: env.AI_IMAGE_MODEL ?? null,
						logger,
						metering,
						networkHosts: new ProjectNetworkHostsRepository(db),
						now: () => new Date(),
						secrets: new ProjectSecretsService(
							secretsRepo,
							new ProjectsRepository(db),
							audit,
							env,
						),
						secretsRepo,
					}),
					insertAssistantMessage: (input) =>
						chats.insertTurnAssistantMessage(input),
					lock: turnLock,
					logger,
					metering,
					mintToken: (claims) => mintLlmProxyToken(claims, env),
					model: env.V2_DEFAULT_MODEL ?? null,
					now: Date.now,
					project: new TurnProjectRepository(db),
					promoteNext: async (projectId, endedTurnId) => {
						// The row answer is TurnPromoter's own bookkeeping; the
						// runtime only needs the promotion attempted.
						await promoter.promoteNext(projectId, endedTurnId);
					},
					// The sandbox runs in the vendor cloud, so the proxy needs a
					// public URL. Local dev sets a tunnel; deployed APIs are public.
					proxyBaseUrl: new URL(
						appBuilderRoutes.llmProxyBase,
						env.V2_LLM_PROXY_PUBLIC_URL ?? env.BETTER_AUTH_URL,
					).toString(),
					proxyRows: new LlmProxyRequestsRepository(db),
					// Holds are added back and checkpoint debits are not, so the
					// number falls as the turn's checkpoints land (D5).
					readBalance: async (subject) =>
						(await credits.getSettledBalance(subjectPayer(subject)))
							.settledBalance,
					// `ProductSettingsService.get` caches 30 s; the tick reads it.
					readV2Enabled: async () => (await settings.get()).v2BuilderEnabled,
					resolvePlan: (subject) => resolveBillingPlan(subscriptions, subject),
					sandboxSessions,
					sandboxes,
					sessions: new BuilderSessionsRepository(db),
					turns,
					// The service already converts AI_USD_PER_CREDIT at build.
					usdMicrosPerCredit: metering.usdMicrosPerCredit,
					writer,
				},
				{
					actorUserId: payload.actorUserId,
					...(payload.actorIsLimitExempt === undefined
						? {}
						: { actorIsLimitExempt: payload.actorIsLimitExempt }),
					organizationId: payload.organizationId,
					projectId: payload.projectId,
					runId: ctx.run.id,
					turnId: payload.turnId,
				},
				signal,
			);
		} finally {
			// After the last `done` event, before the pool ends.
			await writer.close();
			// Each holds a Redis client; close them next to the pool (A6).
			await counters.onModuleDestroy();
			await turnLock.onModuleDestroy();
			await supabaseRateLimiter?.onModuleDestroy();
			await db.$client.end();
		}
	},
	onCancel: async ({ ctx, runPromise }) => {
		// The aborted signal usually lets the run's own catch do the full
		// cancel cleanup. Wait for that first; the timer guards the run
		// stuck in an await the abort signal cannot reach.
		await Promise.race([
			runPromise.then(
				() => undefined,
				() => undefined,
			),
			new Promise((resolve) =>
				setTimeout(resolve, CANCEL_RUN_SETTLE_GRACE_MS).unref(),
			),
		]);

		// Present only while the run still unwinds — its finally removes
		// the entry. The finalizer is memoized, so a double call is safe.
		const finalize = builderTurnCancelFinalizer(ctx.run.id);
		if (finalize) {
			await finalize();
		}
	},
});

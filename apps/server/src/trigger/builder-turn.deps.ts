/**
 * Builds the real `BuilderTurnDeps`: the repositories on a fresh pool, the
 * sandbox provider, the harness, the host tools, metering, and the Redis
 * clients. The `builder-turn` task imports this file lazily for one turn;
 * the harness host builds it once for all its turns. `close` ends every client.
 */
import { appBuilderRoutes } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";

import {
	contentTypeFor,
	getObjectBytes,
	publicAssetKeyFromUrl,
	putSiteFile,
} from "../infrastructure/storage/r2";
import { createBuilderHarness } from "../modules/app-builder/application/harness/builder-harness.factory";
import { BuilderHostToolRegistry } from "../modules/app-builder/application/host-tools/builder-host-tool-registry";
import { mintLlmProxyToken } from "../modules/app-builder/application/services/llm-proxy-token.service";
import { ProjectSecretsService } from "../modules/app-builder/application/services/project-secrets.service";
import { TurnPromoter } from "../modules/app-builder/application/services/turn-promotion";
import type { BuilderHarness } from "../modules/app-builder/domain/ports/builder-harness";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "../modules/app-builder/infrastructure/git/code-storage-repo-restorer";
import { commitTurnUnlessClean } from "../modules/app-builder/infrastructure/git/commit-turn";
import { createTurnTaskStarter } from "../modules/app-builder/infrastructure/host/routing-turn-task-starter";
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

import type {
	BuilderTurnDeps,
	BuilderTurnLogger,
} from "./builder-turn.runtime";
import { createTriggerMetering } from "./metering.runtime";

/**
 * The deps without the event writer, plus the close of every client they
 * hold. Each turn adds the writer of its own path: the Trigger stream or
 * the Redis Stream of the host.
 */
export type BuilderTurnResources = {
	deps: Omit<BuilderTurnDeps, "writer">;
	/** The full turn repository on the same pool; the host recovery reads it. */
	turns: BuilderTurnsRepository;
	/** Ends the Redis clients and the pool. Call it after `writer.close()`. */
	close: () => Promise<void>;
};

/** What the harness host changes in the deps of the task. */
export type BuilderTurnDepsOptions = {
	/** The one harness of the host, which keeps sessions alive between turns. */
	harness?: BuilderHarness;
	/** Postgres connections in the pool: 1 for one task run, more for the host. */
	poolSize?: number;
};

/** The real dependencies; `logger` is the log sink of the calling process. */
export async function createBuilderTurnDeps(
	logger: BuilderTurnLogger,
	options: BuilderTurnDepsOptions = {},
): Promise<BuilderTurnResources> {
	// Fresh pool per run; `close` ends it, so a reused worker process does
	// not leak Postgres connections.
	const db = createDb({
		idleTimeoutMillis: 10_000,
		max: options.poolSize ?? 1,
	});
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
	const close = async () => {
		// Each holds a Redis client; close them next to the pool (A6).
		await counters.onModuleDestroy();
		await turnLock.onModuleDestroy();
		await supabaseRateLimiter?.onModuleDestroy();
		await db.$client.end();
	};
	try {
		const turns = new BuilderTurnsRepository(db);
		return { close, deps: buildDeps(turns), turns };
	} catch (error) {
		// A constructor that throws on a missing env must not leak the pool.
		await close();
		throw error;
	}

	function buildDeps(
		turns: BuilderTurnsRepository,
	): Omit<BuilderTurnDeps, "writer"> {
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
			createTurnTaskStarter(new TriggerTurnTaskStarter(), turns, logger),
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

		const deps: Omit<BuilderTurnDeps, "writer"> = {
			// The wake uses the same interactive client as the backend tools.
			backendClient: supabase,
			backends,
			billingDisabled: env.GENERATION_BILLING_MODE === "off",
			caps: new ProjectCostCapsRepository(db),
			commit: commitTurnUnlessClean,
			commitDeps: {
				appCommits: new AppCommitsRepository(db),
				gitStore,
				putPatch: (key, text) => putSiteFile(key, text, contentTypeFor(key)),
			},
			counters,
			harness: options.harness ?? createBuilderHarness(env.V2_HARNESS),
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
			recentMessages: (chatId, limit) => chats.listRecentTexts(chatId, limit),
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
				(await credits.getSettledBalance(subjectPayer(subject))).settledBalance,
			// `ProductSettingsService.get` caches 30 s; the tick reads it.
			readV2Enabled: async () => (await settings.get()).v2BuilderEnabled,
			// Any URL under R2_PUBLIC_BASE_URL gives a key. TurnsService.create
			// checks the upload owner first.
			readUpload: async (url) => {
				const key = publicAssetKeyFromUrl(url);
				return key === null ? null : getObjectBytes(key);
			},
			resolvePlan: (subject) => resolveBillingPlan(subscriptions, subject),
			sandboxSessions,
			sandboxes,
			sessions: new BuilderSessionsRepository(db),
			turns,
			// The service already converts AI_USD_PER_CREDIT at build.
			usdMicrosPerCredit: metering.usdMicrosPerCredit,
		};
		return deps;
	}
}

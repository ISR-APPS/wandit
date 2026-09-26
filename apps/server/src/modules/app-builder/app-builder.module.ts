/**
 * The V2 app-builder module (docs/v2).
 * `app.module.ts` imports it only when `V2_BUILDER_ENABLED=true`; nothing
 * in here touches V1 modules. Ports get real providers in the issues that
 * implement them — see README.md.
 */
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/nestjs";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { chatGatewayFetch } from "../ai-chat/agent/gateway-fetch";
import { SubscriptionsRepository } from "../billing/infrastructure/persistence/subscriptions.repository";
import { CreditsModule } from "../credits/credits.module";
import { GenerationModule } from "../generation/generation.module";
import { MeteringModule } from "../metering/metering.module";
import { ProjectsModule } from "../projects/projects.module";
import { SettingsModule } from "../settings";
import { AppProjectsService } from "./application/services/app-projects.service";
import { BackendsService } from "./application/services/backends.service";
import { CloudService } from "./application/services/cloud.service";
import { CodeService } from "./application/services/code.service";
import {
	LLM_PROXY_FETCH,
	LlmProxyService,
} from "./application/services/llm-proxy.service";
import { MobileBuildsService } from "./application/services/mobile-builds.service";
import { PreviewTokenService } from "./application/services/preview-token.service";
import { ProjectSecretsService } from "./application/services/project-secrets.service";
import { TurnStreamRelayService } from "./application/services/turn-stream-relay.service";
import { TurnsService } from "./application/services/turns.service";
import {
	r2VersionObjects,
	VERSION_OBJECTS,
	VersionsService,
} from "./application/services/versions.service";
import { LLM_PROXY_ENV } from "./domain/llm-upstream";
import { EAS_BUILD_RUNNER } from "./domain/ports/eas-build-runner";
import { GIT_STORE, REPO_RESTORER } from "./domain/ports/git-store";
import { MOBILE_BUILD_TASK_STARTER } from "./domain/ports/mobile-build-task-starter";
import { PROVISION_BACKEND_TASK_STARTER } from "./domain/ports/provision-backend-task-starter";
import { SANDBOX_PROVIDER } from "./domain/ports/sandbox-provider";
import { TURN_EVENT_READER } from "./domain/ports/turn-events";
import { TURN_LOCK } from "./domain/ports/turn-lock";
import { TURN_TASK_STARTER } from "./domain/ports/turn-task-starter";
import {
	WORKERS_FOR_PLATFORMS_CLIENT,
	workersForPlatformsClientFromEnv,
} from "./infrastructure/cloudflare/workers-for-platforms.client";
import { easBuildRunnerFromEnv } from "./infrastructure/eas/eas-build-runner";
import { V2_ENV, type V2EnvSource } from "./infrastructure/env/v2-env";
import { CodeStorageGitStore } from "./infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "./infrastructure/git/code-storage-repo-restorer";
import { AppBackendsRepository } from "./infrastructure/persistence/app-backends.repository";
import { AppCommitsRepository } from "./infrastructure/persistence/app-commits.repository";
import { AuditEventsRepository } from "./infrastructure/persistence/audit-events.repository";
import { BuilderSessionsRepository } from "./infrastructure/persistence/builder-sessions.repository";
import { BuilderTurnsRepository } from "./infrastructure/persistence/builder-turns.repository";
import { LlmProxyRequestsRepository } from "./infrastructure/persistence/llm-proxy-requests.repository";
import { MobileBuildsRepository } from "./infrastructure/persistence/mobile-builds.repository";
import { ProjectCostCapsRepository } from "./infrastructure/persistence/project-cost-caps.repository";
import { ProjectSecretsRepository } from "./infrastructure/persistence/project-secrets.repository";
import { SandboxSessionsRepository } from "./infrastructure/persistence/sandbox-sessions.repository";
import { LlmSpendCounters } from "./infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "./infrastructure/redis/redis-turn-lock";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
	TEMPLATE_INIT,
} from "./infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "./infrastructure/sandbox/vercel-sandbox.provider";
import {
	SUPABASE_MANAGEMENT_CLIENT,
	SupabaseManagementClient,
} from "./infrastructure/supabase/supabase-management.client";
import {
	RedisSupabaseRateLimiter,
	type SupabaseRateLimiter,
} from "./infrastructure/supabase/supabase-rate-limiter";
import { TemplateVersionService } from "./infrastructure/template/template-version.service";
import { TriggerMobileBuildTaskStarter } from "./infrastructure/trigger/trigger-mobile-build-task-starter";
import { TriggerProvisionBackendTaskStarter } from "./infrastructure/trigger/trigger-provision-backend-task-starter";
import { TriggerTurnEventReader } from "./infrastructure/trigger/trigger-turn-events";
import { TriggerTurnTaskStarter } from "./infrastructure/trigger/trigger-turn-task-starter";
import { AppProjectsController } from "./presentation/http/controllers/app-projects.controller";
import { CloudController } from "./presentation/http/controllers/cloud.controller";
import { CodeController } from "./presentation/http/controllers/code.controller";
import { CostCapsController } from "./presentation/http/controllers/cost-caps.controller";
import { LlmProxyController } from "./presentation/http/controllers/llm-proxy.controller";
import { MobileBuildsController } from "./presentation/http/controllers/mobile-builds.controller";
import { PreviewTokenController } from "./presentation/http/controllers/preview-token.controller";
import { ProjectSecretsController } from "./presentation/http/controllers/project-secrets.controller";
import { TurnsController } from "./presentation/http/controllers/turns.controller";
import { V2HealthController } from "./presentation/http/controllers/v2-health.controller";
import { VersionsController } from "./presentation/http/controllers/versions.controller";
import {
	RATE_LIMIT_STORE,
	RedisRateLimitGuard,
	RedisRateLimitStore,
} from "./presentation/http/guards/redis-rate-limit.guard";
import { V2BuilderEnabledGuard } from "./presentation/http/guards/v2-builder-enabled.guard";

/**
 * The interactive Management API client of the Cloud routes, composed
 * like the worker does in `createProvisionBackendRuntime`. Null without
 * the platform token: `CloudService` then answers 503 `V2_ENV_MISSING`.
 */
export function createCloudSupabaseClient(
	backends: Pick<AppBackendsRepository, "findByProjectId">,
	rateLimiter: SupabaseRateLimiter,
	/** The validated `env` in production; specs pass a plain object. */
	v2Env: V2EnvSource,
): SupabaseManagementClient | null {
	const token = v2Env.SUPABASE_PLATFORM_TOKEN;
	const organizationSlug = v2Env.SUPABASE_PLATFORM_ORG_ID;
	if (token === undefined || organizationSlug === undefined) {
		return null;
	}
	return new SupabaseManagementClient({
		fetch: globalThis.fetch,
		interactive: true,
		logger: Sentry.logger,
		organizationSlug,
		// The ownership check reads the same row the Cloud routes read.
		ownsRef: async (projectId, ref) =>
			(await backends.findByProjectId(projectId))?.ref === ref,
		rateLimiter,
		sleep: (ms) =>
			new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
		token,
	});
}

@Module({
	controllers: [
		AppProjectsController,
		CloudController,
		CodeController,
		CostCapsController,
		LlmProxyController,
		MobileBuildsController,
		PreviewTokenController,
		ProjectSecretsController,
		TurnsController,
		V2HealthController,
		VersionsController,
	],
	// CreditsModule: CreditsService (the create gate). GenerationModule:
	// ChatsRepository. ProjectsModule: ProjectsRepository + ProjectsService.
	// MeteringModule: MeteringService. SettingsModule is global already;
	// importing it names the dependency the V2 flag guard has.
	imports: [
		CreditsModule,
		DatabaseModule,
		GenerationModule,
		MeteringModule,
		ProjectsModule,
		SettingsModule,
	],
	providers: [
		AppBackendsRepository,
		AppCommitsRepository,
		AppProjectsService,
		AuditEventsRepository,
		BackendsService,
		BuilderSessionsRepository,
		BuilderTurnsRepository,
		CloudService,
		CodeService,
		LlmProxyRequestsRepository,
		LlmProxyService,
		LlmSpendCounters,
		MobileBuildsRepository,
		MobileBuildsService,
		PreviewTokenService,
		ProjectCostCapsRepository,
		ProjectSecretsRepository,
		ProjectSecretsService,
		RedisRateLimitGuard,
		RedisSupabaseRateLimiter,
		SandboxSessionsRepository,
		// BillingModule keeps this private; DATABASE from DatabaseModule is
		// all it needs (the turn model allow-list reads the plan).
		SubscriptionsRepository,
		TemplateVersionService,
		TurnsService,
		TurnStreamRelayService,
		V2BuilderEnabledGuard,
		VersionsService,
		// Null without EXPO_TOKEN or EXPO_ACCOUNT: `MobileBuildsService` then answers 503.
		{
			provide: EAS_BUILD_RUNNER,
			useFactory: easBuildRunnerFromEnv,
			inject: [V2_ENV],
		},
		{ provide: GIT_STORE, useClass: CodeStorageGitStore },
		// The LLM proxy reads a wider env slice than V2_ENV (provider keys).
		{ provide: LLM_PROXY_ENV, useValue: env },
		// The long-timeout undici dispatcher the chat gateway already uses.
		{ provide: LLM_PROXY_FETCH, useValue: chatGatewayFetch },
		{
			provide: MOBILE_BUILD_TASK_STARTER,
			useClass: TriggerMobileBuildTaskStarter,
		},
		{
			provide: PROVISION_BACKEND_TASK_STARTER,
			useClass: TriggerProvisionBackendTaskStarter,
		},
		{ provide: RATE_LIMIT_STORE, useClass: RedisRateLimitStore },
		// WANDIT-171: the code.storage restorer replaces the logging placeholder.
		{ provide: REPO_RESTORER, useClass: CodeStorageRepoRestorer },
		{ provide: SANDBOX_PROVIDER, useClass: VercelSandboxProvider },
		{
			provide: SUPABASE_MANAGEMENT_CLIENT,
			useFactory: createCloudSupabaseClient,
			inject: [AppBackendsRepository, RedisSupabaseRateLimiter, V2_ENV],
		},
		{
			provide: TEMPLATE_INIT,
			// The constructor takes a directory path, not an injectable.
			useFactory: () => new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		},
		{ provide: TURN_EVENT_READER, useClass: TriggerTurnEventReader },
		{ provide: TURN_LOCK, useClass: RedisTurnLock },
		{ provide: TURN_TASK_STARTER, useClass: TriggerTurnTaskStarter },
		{ provide: V2_ENV, useValue: env },
		{ provide: VERSION_OBJECTS, useValue: r2VersionObjects },
		// The W4P client of the API process. Null without the three Cloudflare
		// env values. No class injects it yet; the publish task (WANDIT-178) will.
		{
			provide: WORKERS_FOR_PLATFORMS_CLIENT,
			useFactory: (v2Env: V2EnvSource) =>
				workersForPlatformsClientFromEnv(v2Env, Sentry.logger),
			inject: [V2_ENV],
		},
	],
	// The generation chat history filter resolves BuilderTurnsRepository
	// lazily through ModuleRef. WANDIT-166/175 take the store, the restorer,
	// and the commits repository from here.
	exports: [
		AppCommitsRepository,
		BuilderTurnsRepository,
		GIT_STORE,
		REPO_RESTORER,
		V2BuilderEnabledGuard,
		VersionsService,
	],
})
/** Loaded only with `V2_BUILDER_ENABLED=true`; see `app.module.ts`. */
export class AppBuilderModule {}

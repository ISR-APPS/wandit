import { MODULE_METADATA } from "@nestjs/common/constants";
import { env } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { chatGatewayFetch } from "../ai-chat/agent/gateway-fetch";
import { SubscriptionsRepository } from "../billing/infrastructure/persistence/subscriptions.repository";
import { CreditsModule } from "../credits/credits.module";
import { GenerationModule } from "../generation/generation.module";
import { MeteringModule } from "../metering/metering.module";
import { ProjectsModule } from "../projects/projects.module";
import { SettingsModule } from "../settings";
import { AppBuilderModule } from "./app-builder.module";
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
import { WORKERS_FOR_PLATFORMS_CLIENT } from "./infrastructure/cloudflare/workers-for-platforms.client";
import { easBuildRunnerFromEnv } from "./infrastructure/eas/eas-build-runner";
import { V2_ENV } from "./infrastructure/env/v2-env";
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
import { TEMPLATE_INIT } from "./infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "./infrastructure/sandbox/vercel-sandbox.provider";
import { SUPABASE_MANAGEMENT_CLIENT } from "./infrastructure/supabase/supabase-management.client";
import { RedisSupabaseRateLimiter } from "./infrastructure/supabase/supabase-rate-limiter";
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

describe("AppBuilderModule", () => {
	it("wires controllers, providers, and exports", () => {
		expect(
			Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppBuilderModule),
		).toEqual([
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
		]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppBuilderModule),
		).toEqual([
			CreditsModule,
			DatabaseModule,
			GenerationModule,
			MeteringModule,
			ProjectsModule,
			SettingsModule,
		]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppBuilderModule),
		).toEqual([
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
			SubscriptionsRepository,
			TemplateVersionService,
			TurnsService,
			TurnStreamRelayService,
			V2BuilderEnabledGuard,
			VersionsService,
			{
				provide: EAS_BUILD_RUNNER,
				useFactory: easBuildRunnerFromEnv,
				inject: [V2_ENV],
			},
			{ provide: GIT_STORE, useClass: CodeStorageGitStore },
			{ provide: LLM_PROXY_ENV, useValue: env },
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
			{ provide: REPO_RESTORER, useClass: CodeStorageRepoRestorer },
			{ provide: SANDBOX_PROVIDER, useClass: VercelSandboxProvider },
			expect.objectContaining({ provide: SUPABASE_MANAGEMENT_CLIENT }),
			// The factory identity is not stable; match the token only.
			expect.objectContaining({ provide: TEMPLATE_INIT }),
			{ provide: TURN_EVENT_READER, useClass: TriggerTurnEventReader },
			{ provide: TURN_LOCK, useClass: RedisTurnLock },
			{ provide: TURN_TASK_STARTER, useClass: TriggerTurnTaskStarter },
			{ provide: V2_ENV, useValue: env },
			{ provide: VERSION_OBJECTS, useValue: r2VersionObjects },
			expect.objectContaining({ provide: WORKERS_FOR_PLATFORMS_CLIENT }),
		]);
		expect(
			Reflect.getMetadata(MODULE_METADATA.EXPORTS, AppBuilderModule),
		).toEqual([
			AppCommitsRepository,
			BuilderTurnsRepository,
			GIT_STORE,
			REPO_RESTORER,
			V2BuilderEnabledGuard,
			VersionsService,
		]);
	});
});

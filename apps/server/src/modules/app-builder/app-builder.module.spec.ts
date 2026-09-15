import { MODULE_METADATA } from "@nestjs/common/constants";
import { env } from "@wandit/env/server";
import { describe, expect, it } from "vitest";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { chatGatewayFetch } from "../ai-chat/agent/gateway-fetch";
import { CreditsModule } from "../credits/credits.module";
import { GenerationModule } from "../generation/generation.module";
import { MeteringModule } from "../metering/metering.module";
import { ProjectsModule } from "../projects/projects.module";
import { SettingsModule } from "../settings";
import { AppBuilderModule } from "./app-builder.module";
import { AppProjectsService } from "./application/services/app-projects.service";
import {
	LLM_PROXY_FETCH,
	LlmProxyService,
} from "./application/services/llm-proxy.service";
import { TurnStreamRelayService } from "./application/services/turn-stream-relay.service";
import { TurnsService } from "./application/services/turns.service";
import {
	r2VersionObjects,
	VERSION_OBJECTS,
	VersionsService,
} from "./application/services/versions.service";
import { LLM_PROXY_ENV } from "./domain/llm-upstream";
import { GIT_STORE, REPO_RESTORER } from "./domain/ports/git-store";
import { SANDBOX_PROVIDER } from "./domain/ports/sandbox-provider";
import { TURN_EVENT_READER } from "./domain/ports/turn-events";
import { TURN_LOCK } from "./domain/ports/turn-lock";
import { TURN_TASK_STARTER } from "./domain/ports/turn-task-starter";
import { V2_ENV } from "./infrastructure/env/v2-env";
import { CodeStorageGitStore } from "./infrastructure/git/code-storage.git-store";
import { CodeStorageRepoRestorer } from "./infrastructure/git/code-storage-repo-restorer";
import { AppCommitsRepository } from "./infrastructure/persistence/app-commits.repository";
import { AuditEventsRepository } from "./infrastructure/persistence/audit-events.repository";
import { BuilderSessionsRepository } from "./infrastructure/persistence/builder-sessions.repository";
import { BuilderTurnsRepository } from "./infrastructure/persistence/builder-turns.repository";
import { LlmProxyRequestsRepository } from "./infrastructure/persistence/llm-proxy-requests.repository";
import { SandboxSessionsRepository } from "./infrastructure/persistence/sandbox-sessions.repository";
import { LlmSpendCounters } from "./infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "./infrastructure/redis/redis-turn-lock";
import { TEMPLATE_INIT } from "./infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "./infrastructure/sandbox/vercel-sandbox.provider";
import { TemplateVersionService } from "./infrastructure/template/template-version.service";
import { TriggerTurnEventReader } from "./infrastructure/trigger/trigger-turn-events";
import { TriggerTurnTaskStarter } from "./infrastructure/trigger/trigger-turn-task-starter";
import { AppProjectsController } from "./presentation/http/controllers/app-projects.controller";
import { LlmProxyController } from "./presentation/http/controllers/llm-proxy.controller";
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
			LlmProxyController,
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
			AppCommitsRepository,
			AppProjectsService,
			AuditEventsRepository,
			BuilderSessionsRepository,
			BuilderTurnsRepository,
			LlmProxyRequestsRepository,
			LlmProxyService,
			LlmSpendCounters,
			RedisRateLimitGuard,
			SandboxSessionsRepository,
			TemplateVersionService,
			TurnsService,
			TurnStreamRelayService,
			V2BuilderEnabledGuard,
			VersionsService,
			{ provide: GIT_STORE, useClass: CodeStorageGitStore },
			{ provide: LLM_PROXY_ENV, useValue: env },
			{ provide: LLM_PROXY_FETCH, useValue: chatGatewayFetch },
			{ provide: RATE_LIMIT_STORE, useClass: RedisRateLimitStore },
			{ provide: REPO_RESTORER, useClass: CodeStorageRepoRestorer },
			{ provide: SANDBOX_PROVIDER, useClass: VercelSandboxProvider },
			// The factory identity is not stable; match the token only.
			expect.objectContaining({ provide: TEMPLATE_INIT }),
			{ provide: TURN_EVENT_READER, useClass: TriggerTurnEventReader },
			{ provide: TURN_LOCK, useClass: RedisTurnLock },
			{ provide: TURN_TASK_STARTER, useClass: TriggerTurnTaskStarter },
			{ provide: V2_ENV, useValue: env },
			{ provide: VERSION_OBJECTS, useValue: r2VersionObjects },
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

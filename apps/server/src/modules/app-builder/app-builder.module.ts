/**
 * The V2 app-builder module (docs/v2).
 * `app.module.ts` imports it only when `V2_BUILDER_ENABLED=true`; nothing
 * in here touches V1 modules. Ports get real providers in the issues that
 * implement them — see README.md.
 */
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { chatGatewayFetch } from "../ai-chat/agent/gateway-fetch";
import { SubscriptionsRepository } from "../billing/infrastructure/persistence/subscriptions.repository";
import { CreditsModule } from "../credits/credits.module";
import { GenerationModule } from "../generation/generation.module";
import { MeteringModule } from "../metering/metering.module";
import { ProjectsModule } from "../projects/projects.module";
import { SettingsModule } from "../settings";
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
import { ProjectCostCapsRepository } from "./infrastructure/persistence/project-cost-caps.repository";
import { SandboxSessionsRepository } from "./infrastructure/persistence/sandbox-sessions.repository";
import { LlmSpendCounters } from "./infrastructure/redis/llm-spend-counters";
import { RedisTurnLock } from "./infrastructure/redis/redis-turn-lock";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
	TEMPLATE_INIT,
} from "./infrastructure/sandbox/template-init";
import { VercelSandboxProvider } from "./infrastructure/sandbox/vercel-sandbox.provider";
import { TemplateVersionService } from "./infrastructure/template/template-version.service";
import { TriggerTurnEventReader } from "./infrastructure/trigger/trigger-turn-events";
import { TriggerTurnTaskStarter } from "./infrastructure/trigger/trigger-turn-task-starter";
import { AppProjectsController } from "./presentation/http/controllers/app-projects.controller";
import { CostCapsController } from "./presentation/http/controllers/cost-caps.controller";
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

@Module({
	controllers: [
		AppProjectsController,
		CostCapsController,
		LlmProxyController,
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
		AppCommitsRepository,
		AppProjectsService,
		AuditEventsRepository,
		BuilderSessionsRepository,
		BuilderTurnsRepository,
		LlmProxyRequestsRepository,
		LlmProxyService,
		LlmSpendCounters,
		ProjectCostCapsRepository,
		RedisRateLimitGuard,
		SandboxSessionsRepository,
		// BillingModule keeps this private; DATABASE from DatabaseModule is
		// all it needs (the turn model allow-list reads the plan).
		SubscriptionsRepository,
		TemplateVersionService,
		TurnsService,
		TurnStreamRelayService,
		V2BuilderEnabledGuard,
		VersionsService,
		{ provide: GIT_STORE, useClass: CodeStorageGitStore },
		// The LLM proxy reads a wider env slice than V2_ENV (provider keys).
		{ provide: LLM_PROXY_ENV, useValue: env },
		// The long-timeout undici dispatcher the chat gateway already uses.
		{ provide: LLM_PROXY_FETCH, useValue: chatGatewayFetch },
		{ provide: RATE_LIMIT_STORE, useClass: RedisRateLimitStore },
		// WANDIT-171: the code.storage restorer replaces the logging placeholder.
		{ provide: REPO_RESTORER, useClass: CodeStorageRepoRestorer },
		{ provide: SANDBOX_PROVIDER, useClass: VercelSandboxProvider },
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

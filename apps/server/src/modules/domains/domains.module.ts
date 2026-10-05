/**
 * Feature module for custom domains: the domain routes under `v1`, the KV
 * routing pointers, and the registrar. The orders, admin, sites, and
 * app-builder modules import its exports. The project domain hook is a
 * factory, so a V1 deploy never constructs the V2 sync task starter.
 */
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { TriggerSyncBackendAuthUrlsTaskStarter } from "../app-builder/infrastructure/trigger/trigger-sync-backend-auth-urls-task-starter";
import { DomainDnsDiagnosticsService } from "./application/services/domain-dns-diagnostics.service";
import {
	DOMAINS_LOGGER,
	DomainsService,
} from "./application/services/domains.service";
import { DOMAIN_PROVIDER } from "./domain/ports/domain-provider.port";
import { DOMAIN_TASK_DISPATCHER } from "./domain/ports/domain-task-dispatcher.port";
import { PROJECT_DOMAIN_HOOK } from "./domain/ports/project-domain-hook.port";
import { CustomHostnameService } from "./infrastructure/cloudflare/custom-hostname.service";
import { CustomerZoneService } from "./infrastructure/cloudflare/customer-zone.service";
import { DomainRoutingService } from "./infrastructure/cloudflare/domain-routing.service";
import { DomainRegistrationCheckService } from "./infrastructure/dns/domain-registration-check.service";
import { NamecomProvider } from "./infrastructure/namecom/namecom.provider";
import { DomainsRepository } from "./infrastructure/persistence/domains.repository";
import { TriggerDomainTaskDispatcherService } from "./infrastructure/trigger/trigger-domain-task-dispatcher.service";
import { DomainsController } from "./presentation/http/controllers/domains.controller";
import { DomainRateLimitGuard } from "./presentation/http/guards/rate-limit.guard";

@Module({
	controllers: [DomainsController],
	exports: [
		DOMAIN_TASK_DISPATCHER,
		DomainRoutingService,
		DomainsRepository,
		DomainsService,
	],
	imports: [DatabaseModule],
	providers: [
		CustomerZoneService,
		DomainRegistrationCheckService,
		CustomHostnameService,
		DomainDnsDiagnosticsService,
		DomainRateLimitGuard,
		DomainRoutingService,
		DomainsRepository,
		DomainsService,
		NamecomProvider,
		TriggerDomainTaskDispatcherService,
		{
			provide: DOMAIN_PROVIDER,
			useExisting: NamecomProvider,
		},
		{
			provide: DOMAIN_TASK_DISPATCHER,
			useExisting: TriggerDomainTaskDispatcherService,
		},
		{
			provide: DOMAINS_LOGGER,
			useValue: console,
		},
		{
			provide: PROJECT_DOMAIN_HOOK,
			// The API queues no V2 task while V2 is off.
			useFactory: () =>
				env.V2_BUILDER_ENABLED
					? new TriggerSyncBackendAuthUrlsTaskStarter()
					: null,
		},
	],
})
export class DomainsModule {}

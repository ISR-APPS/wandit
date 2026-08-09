import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import {
	DOMAINS_LOGGER,
	DomainsService,
} from "./application/services/domains.service";
import { DOMAIN_PROVIDER } from "./domain/ports/domain-provider.port";
import { DOMAIN_TASK_DISPATCHER } from "./domain/ports/domain-task-dispatcher.port";
import { CustomHostnameService } from "./infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "./infrastructure/cloudflare/domain-routing.service";
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
		CustomHostnameService,
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
	],
})
export class DomainsModule {}

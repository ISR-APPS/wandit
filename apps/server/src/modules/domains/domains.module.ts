import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import {
	DOMAINS_LOGGER,
	DomainsService,
} from "./application/services/domains.service";
import { DOMAIN_PROVIDER } from "./domain/ports/domain-provider.port";
import { CustomHostnameService } from "./infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "./infrastructure/cloudflare/domain-routing.service";
import { NamecomProvider } from "./infrastructure/namecom/namecom.provider";
import { DomainsRepository } from "./infrastructure/persistence/domains.repository";
import { DomainsController } from "./presentation/http/controllers/domains.controller";
import { DomainRateLimitGuard } from "./presentation/http/guards/rate-limit.guard";

@Module({
	controllers: [DomainsController],
	exports: [DomainRoutingService, DomainsRepository],
	imports: [DatabaseModule, QueuesModule],
	providers: [
		CustomHostnameService,
		DomainRateLimitGuard,
		DomainRoutingService,
		DomainsRepository,
		DomainsService,
		NamecomProvider,
		{
			provide: DOMAIN_PROVIDER,
			useExisting: NamecomProvider,
		},
		{
			provide: DOMAINS_LOGGER,
			useValue: console,
		},
	],
})
export class DomainsModule {}

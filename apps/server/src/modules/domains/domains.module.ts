import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { CreditsService } from "../credits/application/services/credits.service";
import { CreditsModule } from "../credits/credits.module";
import {
	DOMAINS_LOGGER,
	DomainsService,
} from "./application/services/domains.service";
import { CREDITS_PORT } from "./domain/ports/credits.port";
import { DOMAIN_PROVIDER } from "./domain/ports/domain-provider.port";
import { CustomHostnameService } from "./infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "./infrastructure/cloudflare/domain-routing.service";
import { OpenproviderProvider } from "./infrastructure/openprovider/openprovider.provider";
import { DomainsRepository } from "./infrastructure/persistence/domains.repository";
import { DomainsController } from "./presentation/http/controllers/domains.controller";
import { DomainRateLimitGuard } from "./presentation/http/guards/rate-limit.guard";

@Module({
	controllers: [DomainsController],
	exports: [DomainRoutingService, DomainsRepository],
	imports: [DatabaseModule, CreditsModule, QueuesModule],
	providers: [
		CustomHostnameService,
		DomainRateLimitGuard,
		DomainRoutingService,
		DomainsRepository,
		DomainsService,
		OpenproviderProvider,
		{
			provide: DOMAIN_PROVIDER,
			useExisting: OpenproviderProvider,
		},
		{
			provide: CREDITS_PORT,
			useExisting: CreditsService,
		},
		{
			provide: DOMAINS_LOGGER,
			useValue: console,
		},
	],
})
export class DomainsModule {}

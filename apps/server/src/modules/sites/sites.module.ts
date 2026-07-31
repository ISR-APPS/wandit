import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
// DomainsModule exports DomainRoutingService — the KV pointer writer that
// publishing shares with the custom-domains pipeline.
import { DomainsModule } from "../domains/domains.module";
import { SitesService } from "./application/services/sites.service";
import { DeploymentsRepository } from "./infrastructure/persistence/deployments.repository";
import { SitesController } from "./presentation/http/controllers/sites.controller";

@Module({
	controllers: [SitesController],
	// The pages module reads the active deployment to mark the live version.
	exports: [DeploymentsRepository, SitesService],
	imports: [DatabaseModule, DomainsModule],
	providers: [DeploymentsRepository, SitesService],
})
export class SitesModule {}

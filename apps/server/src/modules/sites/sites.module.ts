/**
 * Publishing of V1 pages: the sites routes, the deployments rows, and the live bytes.
 * AppModule imports it; the pages module reads its exports.
 * It calls DomainsModule for the KV pointer and PaidOwnerRepository for the badge gate.
 */
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { PaidOwnerRepository } from "../billing/infrastructure/persistence/paid-owner.repository";
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
	// PaidOwnerRepository decides if the hide-badge toggle counts at publish time.
	providers: [DeploymentsRepository, PaidOwnerRepository, SitesService],
})
export class SitesModule {}

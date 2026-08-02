import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { BillingWebhookEventsRepository } from "../billing/infrastructure/persistence/billing-webhook-events.repository";
import { CreditsModule } from "../credits/credits.module";
import { DomainsModule } from "../domains/domains.module";
import { LeadScrapesModule } from "../lead-scrapes/lead-scrapes.module";
import { LeadsModule } from "../leads/leads.module";
import { MarketingAssetsModule } from "../marketing-assets/marketing-assets.module";
import { PagesModule } from "../pages/pages.module";
import { ProjectAssetsModule } from "../project-assets/project-assets.module";
import { SitesModule } from "../sites/sites.module";
import { AdminSecurityModule } from "./admin-security.module";
import { AdminProjectsService } from "./application/services/admin-projects.service";
import { AdminStatsService } from "./application/services/admin-stats.service";
import { AdminUsersService } from "./application/services/admin-users.service";
import { AdminWebhookReplayService } from "./application/services/admin-webhook-replay.service";
import { BetaAccessService } from "./application/services/beta-access.service";
import { AdminRepository } from "./infrastructure/persistence/admin.repository";
import { AdminProjectsController } from "./presentation/http/controllers/admin-projects.controller";
import { AdminStatsController } from "./presentation/http/controllers/admin-stats.controller";
import { AdminUsersController } from "./presentation/http/controllers/admin-users.controller";
import { AdminWebhooksController } from "./presentation/http/controllers/admin-webhooks.controller";

@Module({
	controllers: [
		AdminProjectsController,
		AdminUsersController,
		AdminStatsController,
		AdminWebhooksController,
	],
	imports: [
		AdminSecurityModule,
		CreditsModule,
		DatabaseModule,
		DomainsModule,
		LeadScrapesModule,
		LeadsModule,
		MarketingAssetsModule,
		PagesModule,
		ProjectAssetsModule,
		QueuesModule,
		SitesModule,
	],
	providers: [
		AdminRepository,
		AdminProjectsService,
		AdminStatsService,
		AdminUsersService,
		AdminWebhookReplayService,
		BetaAccessService,
		BillingWebhookEventsRepository,
	],
})
export class AdminModule {}

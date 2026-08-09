import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { BillingWebhookEventsRepository } from "../billing/infrastructure/persistence/billing-webhook-events.repository";
import { TriggerBillingWebhookDispatcherService } from "../billing/infrastructure/trigger/trigger-billing-webhook-dispatcher.service";
import { CreditsModule } from "../credits/credits.module";
import { DomainsModule } from "../domains/domains.module";
import { LeadScrapesModule } from "../lead-scrapes/lead-scrapes.module";
import { LeadsModule } from "../leads/leads.module";
import { MarketingAssetsModule } from "../marketing-assets/marketing-assets.module";
import { PagesModule } from "../pages/pages.module";
import { ProjectAssetsModule } from "../project-assets/project-assets.module";
import { SitesModule } from "../sites/sites.module";
import { AdminSecurityModule } from "./admin-security.module";
import { AdminOrganizationsService } from "./application/services/admin-organizations.service";
import { AdminPagePreviewService } from "./application/services/admin-page-preview.service";
import { AdminProjectsService } from "./application/services/admin-projects.service";
import { AdminStatsService } from "./application/services/admin-stats.service";
import { AdminUsersService } from "./application/services/admin-users.service";
import { AdminWebhookReplayService } from "./application/services/admin-webhook-replay.service";
import { BetaAccessService } from "./application/services/beta-access.service";
import { AdminRepository } from "./infrastructure/persistence/admin.repository";
import { AdminOrganizationsRepository } from "./infrastructure/persistence/admin-organizations.repository";
import { AdminOverviewRepository } from "./infrastructure/persistence/admin-overview.repository";
import { AdminOrganizationsController } from "./presentation/http/controllers/admin-organizations.controller";
import { AdminProjectsController } from "./presentation/http/controllers/admin-projects.controller";
import { AdminStatsController } from "./presentation/http/controllers/admin-stats.controller";
import { AdminUsersController } from "./presentation/http/controllers/admin-users.controller";
import { AdminWebhooksController } from "./presentation/http/controllers/admin-webhooks.controller";

@Module({
	controllers: [
		AdminOrganizationsController,
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
		SitesModule,
	],
	providers: [
		AdminOrganizationsRepository,
		AdminOrganizationsService,
		AdminOverviewRepository,
		AdminPagePreviewService,
		AdminRepository,
		AdminProjectsService,
		AdminStatsService,
		AdminUsersService,
		AdminWebhookReplayService,
		BetaAccessService,
		BillingWebhookEventsRepository,
		TriggerBillingWebhookDispatcherService,
	],
})
export class AdminModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { SentryModule } from "@wandit/observability/nestjs-setup";

import { appConfig } from "./config/app.config";
import { queueConfig } from "./config/queue.config";
import { AnalyticsModule } from "./infrastructure/analytics/analytics.module";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { ApiExceptionFilter } from "./infrastructure/http/api-exception.filter";
import { ApiResponseEnvelopeInterceptor } from "./infrastructure/http/api-response-envelope.interceptor";
import { QueuesModule } from "./infrastructure/queues/queues.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AiChatModule } from "./modules/ai-chat/ai-chat.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ConnectorGenerationsModule } from "./modules/connector-generations/connector-generations.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { DomainsModule } from "./modules/domains/domains.module";
import { GenerationModule } from "./modules/generation/generation.module";
import { HealthModule } from "./modules/health/health.module";
import { ImageGenerationsModule } from "./modules/image-generations/image-generations.module";
import { LeadScrapesModule } from "./modules/lead-scrapes/lead-scrapes.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { MarketingAssetsModule } from "./modules/marketing-assets/marketing-assets.module";
import { McpConnectorsModule } from "./modules/mcp-connectors/mcp-connectors.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PagesModule } from "./modules/pages/pages.module";
import { ProjectAssetsModule } from "./modules/project-assets/project-assets.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { SitesModule } from "./modules/sites/sites.module";
import { StorageModule } from "./modules/storage/storage.module";
import { UploadsModule } from "./modules/uploads/uploads.module";

@Module({
	imports: [
		// First so Sentry's request-scope wiring wraps everything below.
		// Error capture stays explicit in ApiExceptionFilter (5xx branch) —
		// SentryGlobalFilter is intentionally not registered.
		SentryModule.forRoot(),
		ConfigModule.forRoot({
			cache: true,
			isGlobal: true,
			load: [appConfig, queueConfig],
		}),
		AnalyticsModule,
		DatabaseModule,
		QueuesModule,
		AuthModule,
		AdminModule,
		AiChatModule,
		HealthModule,
		ProjectsModule,
		ProjectAssetsModule,
		PagesModule,
		SitesModule,
		LeadsModule,
		LeadScrapesModule,
		MarketingAssetsModule,
		ConnectorGenerationsModule,
		McpConnectorsModule,
		ImageGenerationsModule,
		CreditsModule,
		BillingModule,
		OrdersModule,
		DomainsModule,
		StorageModule,
		GenerationModule,
		UploadsModule,
	],
	providers: [
		{
			provide: APP_FILTER,
			useClass: ApiExceptionFilter,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ApiResponseEnvelopeInterceptor,
		},
	],
})
export class AppModule {}

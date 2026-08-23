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
import { AcademyModule } from "./modules/academy/academy.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AffiliatesModule } from "./modules/affiliates/affiliates.module";
import { AiChatModule } from "./modules/ai-chat/ai-chat.module";
import { AttributionModule } from "./modules/attribution/attribution.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ConnectorGenerationsModule } from "./modules/connector-generations/connector-generations.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { DomainsModule } from "./modules/domains/domains.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { GenerationModule } from "./modules/generation/generation.module";
import { HealthModule } from "./modules/health/health.module";
import { ImageGenerationsModule } from "./modules/image-generations/image-generations.module";
import { LeadScrapesModule } from "./modules/lead-scrapes/lead-scrapes.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { MarketingAssetsModule } from "./modules/marketing-assets/marketing-assets.module";
import { McpConnectorsModule } from "./modules/mcp-connectors/mcp-connectors.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PagesModule } from "./modules/pages/pages.module";
import { ProductEventsModule } from "./modules/product-events/product-events.module";
import { ProjectAssetsModule } from "./modules/project-assets/project-assets.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PushNotificationsModule } from "./modules/push-notifications/push-notifications.module";
import { SitesModule } from "./modules/sites/sites.module";
import { StorageModule } from "./modules/storage/storage.module";
import { StoryLinksModule } from "./modules/story-links/story-links.module";
import { SupportModule } from "./modules/support/support.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { WorkspacesModule } from "./modules/workspaces/workspaces.module";

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
		AcademyModule,
		AffiliatesModule,
		AttributionModule,
		StoryLinksModule,
		AuthModule,
		// After AuthModule ON PURPOSE: its global WorkspaceContextGuard reads
		// request.user, and Nest runs global guards in registration order.
		WorkspacesModule,
		AdminModule,
		AiChatModule,
		HealthModule,
		ProjectsModule,
		ProductEventsModule,
		ProjectAssetsModule,
		PagesModule,
		SitesModule,
		PushNotificationsModule,
		LeadsModule,
		LeadScrapesModule,
		MarketingAssetsModule,
		ConnectorGenerationsModule,
		McpConnectorsModule,
		ImageGenerationsModule,
		CreditsModule,
		BillingModule,
		OnboardingModule,
		OrdersModule,
		SupportModule,
		DomainsModule,
		FeedbackModule,
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

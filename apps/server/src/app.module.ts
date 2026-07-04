import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { appConfig } from "./config/app.config";
import { queueConfig } from "./config/queue.config";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { ApiExceptionFilter } from "./infrastructure/http/api-exception.filter";
import { ApiResponseEnvelopeInterceptor } from "./infrastructure/http/api-response-envelope.interceptor";
import { QueuesModule } from "./infrastructure/queues/queues.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CreditsModule } from "./modules/credits/credits.module";
import { DomainsModule } from "./modules/domains/domains.module";
import { GenerationModule } from "./modules/generation/generation.module";
import { HealthModule } from "./modules/health/health.module";
import { LeadsModule } from "./modules/leads/leads.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { SitesModule } from "./modules/sites/sites.module";
import { StorageModule } from "./modules/storage/storage.module";

@Module({
	imports: [
		ConfigModule.forRoot({
			cache: true,
			isGlobal: true,
			load: [appConfig, queueConfig],
		}),
		DatabaseModule,
		QueuesModule,
		AuthModule,
		HealthModule,
		ProjectsModule,
		SitesModule,
		LeadsModule,
		CreditsModule,
		BillingModule,
		DomainsModule,
		StorageModule,
		GenerationModule,
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

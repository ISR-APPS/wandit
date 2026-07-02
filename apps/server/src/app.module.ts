import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { appConfig } from "./config/app.config";
import { queueConfig } from "./config/queue.config";
import { DatabaseModule } from "./infrastructure/database/database.module";
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
})
export class AppModule {}

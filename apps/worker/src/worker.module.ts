// Root module for the remaining Redis/BullMQ worker process.
//
// Billing maintenance, domain fulfillment, and order refunds run in
// Trigger.dev. This worker now owns only AI chat generation plus the
// media-generation, lead-processing, and publishing queue contracts.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { createProviderMeteringGateway } from "../../server/src/modules/ai-provider/infrastructure/metering-provider-gateway";
import { CreditsService } from "../../server/src/modules/credits/application/services/credits.service";
import { CreditsRepository } from "../../server/src/modules/credits/infrastructure/persistence/credits.repository";
import { MeteringService } from "../../server/src/modules/metering/application/services/metering.service";
import { ModelPricingService } from "../../server/src/modules/metering/application/services/model-pricing.service";
import { METERING_GATEWAY } from "../../server/src/modules/metering/domain/metering";
import { MeteringRepository } from "../../server/src/modules/metering/infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "../../server/src/modules/metering/infrastructure/persistence/model-prices.repository";
import { OrganizationLimitsRepository } from "../../server/src/modules/workspaces/infrastructure/persistence/organization-limits.repository";
import { queueConfig } from "./config/queue.config";
import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { databaseProvider } from "./infrastructure/database/database-alias.provider";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
import { WorkerQueuesModule } from "./infrastructure/queues/worker-queues.module";
import { ChatEventsPublisher } from "./infrastructure/redis/chat-events.publisher";
import { AiGenerationProcessor } from "./processors/ai-generation.processor";
import { LeadProcessingProcessor } from "./processors/lead-processing.processor";
import { MediaGenerationProcessor } from "./processors/media-generation.processor";
import { PublishProcessor } from "./processors/publish.processor";

@Module({
	imports: [
		ConfigModule.forRoot({
			cache: true,
			isGlobal: true,
			load: [queueConfig],
		}),
		WorkerDatabaseModule,
		WorkerQueuesModule,
	],
	providers: [
		databaseProvider,
		AiGenerationProcessor,
		ChatEventsPublisher,
		CreditsRepository,
		CreditsService,
		LeadProcessingProcessor,
		MediaGenerationProcessor,
		MeteringRepository,
		MeteringService,
		ModelPricesRepository,
		ModelPricingService,
		OrganizationLimitsRepository,
		PublishProcessor,
		WorkerChatRepository,
		{
			provide: METERING_GATEWAY,
			useValue: createProviderMeteringGateway(),
		},
	],
})
export class WorkerModule {}

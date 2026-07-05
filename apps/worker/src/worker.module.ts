import { Module, type Provider } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { createDb } from "@wandit/db";

import { CreditsService } from "../../server/src/modules/credits/application/services/credits.service";
import { CreditsRepository } from "../../server/src/modules/credits/infrastructure/persistence/credits.repository";
import { CustomHostnameService } from "../../server/src/modules/domains/infrastructure/cloudflare/custom-hostname.service";
import { DomainRoutingService } from "../../server/src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import { OpenproviderProvider } from "../../server/src/modules/domains/infrastructure/openprovider/openprovider.provider";
import { DomainsRepository } from "../../server/src/modules/domains/infrastructure/persistence/domains.repository";
import { CREDITS_PORT } from "../../server/src/modules/domains/domain/ports/credits.port";
import { DOMAIN_PROVIDER } from "../../server/src/modules/domains/domain/ports/domain-provider.port";
import {
	DATABASE,
	type Database,
} from "../../server/src/infrastructure/database/database.constants";
import { queueConfig } from "./config/queue.config";
import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
import { WorkerCreditsService } from "./infrastructure/persistence/worker-credits.service";
import { WorkerQueuesModule } from "./infrastructure/queues/worker-queues.module";
import { ChatEventsPublisher } from "./infrastructure/redis/chat-events.publisher";
import { AiGenerationProcessor } from "./processors/ai-generation.processor";
import { DomainsProcessor } from "./processors/domains.processor";
import { LeadProcessingProcessor } from "./processors/lead-processing.processor";
import { MediaGenerationProcessor } from "./processors/media-generation.processor";
import { PublishProcessor } from "./processors/publish.processor";

const databaseProvider: Provider<Database> = {
	provide: DATABASE,
	useFactory: createDb,
};

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
		CustomHostnameService,
		DomainRoutingService,
		DomainsProcessor,
		DomainsRepository,
		MediaGenerationProcessor,
		LeadProcessingProcessor,
		OpenproviderProvider,
		PublishProcessor,
		WorkerChatRepository,
		WorkerCreditsService,
		{
			provide: DOMAIN_PROVIDER,
			useExisting: OpenproviderProvider,
		},
		{
			provide: CREDITS_PORT,
			useExisting: CreditsService,
		},
	],
})
export class WorkerModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { queueConfig } from "./config/queue.config";
import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
import { WorkerCreditsService } from "./infrastructure/persistence/worker-credits.service";
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
		AiGenerationProcessor,
		ChatEventsPublisher,
		MediaGenerationProcessor,
		LeadProcessingProcessor,
		PublishProcessor,
		WorkerChatRepository,
		WorkerCreditsService,
	],
})
export class WorkerModule {}

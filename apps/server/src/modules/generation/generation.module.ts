/**
 * Nest module for chat/generation.
 *
 * In Express you manually register routes and pass services around yourself.
 * In Nest, a module is the place where you list:
 * - controllers: HTTP routes
 * - providers: classes Nest can create and inject
 * - imports: other modules this feature needs
 * - exports: providers other modules may use
 */
// `@Module()` is Nest's wiring object for one feature area.
import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
// BullMQ is the Redis-backed queue used for slow background work.
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { MeteringModule } from "../metering/metering.module";
import { ChatService } from "./application/services/chat.service";
import { ChatStreamRelayService } from "./application/services/chat-stream-relay.service";
import { GenerationActivityService } from "./application/services/generation-activity.service";
import { GenerationQueueService } from "./application/services/generation-queue.service";
import { TranscriptionService } from "./application/services/transcription.service";
import { ChatsRepository } from "./infrastructure/persistence/chats.repository";
import { ChatEventsRepository } from "./infrastructure/redis/chat-events.repository";
import { ChatsController } from "./presentation/http/controllers/chats.controller";
import { TranscriptionsController } from "./presentation/http/controllers/transcriptions.controller";

@Module({
	// Controllers receive HTTP requests.
	controllers: [ChatsController, TranscriptionsController],
	// Exports are the services other modules are allowed to inject.
	exports: [ChatsRepository, GenerationActivityService, GenerationQueueService],
	// Imports make providers from other modules available here.
	imports: [DatabaseModule, QueuesModule, MeteringModule],
	// Providers are classes Nest can create for this module.
	providers: [
		ChatEventsRepository,
		ChatsRepository,
		ChatService,
		ChatStreamRelayService,
		GenerationActivityService,
		GenerationQueueService,
		TranscriptionService,
	],
})
// Empty class: the `@Module()` metadata above is the important part.
export class GenerationModule {}

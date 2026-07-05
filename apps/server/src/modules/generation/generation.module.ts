import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../infrastructure/database/database.module";
import { QueuesModule } from "../../infrastructure/queues/queues.module";
import { BillingModule } from "../billing/billing.module";
import { CreditsModule } from "../credits/credits.module";
import { ChatService } from "./application/services/chat.service";
import { ChatStreamRelayService } from "./application/services/chat-stream-relay.service";
import { GenerationActivityService } from "./application/services/generation-activity.service";
import { GenerationPolicyService } from "./application/services/generation-policy.service";
import { GenerationQueueService } from "./application/services/generation-queue.service";
import { TranscriptionService } from "./application/services/transcription.service";
import { ChatsRepository } from "./infrastructure/persistence/chats.repository";
import { ChatEventsRepository } from "./infrastructure/redis/chat-events.repository";
import { ChatsController } from "./presentation/http/controllers/chats.controller";
import { TranscriptionsController } from "./presentation/http/controllers/transcriptions.controller";

@Module({
	controllers: [ChatsController, TranscriptionsController],
	exports: [
		GenerationActivityService,
		GenerationPolicyService,
		GenerationQueueService,
	],
	imports: [DatabaseModule, QueuesModule, BillingModule, CreditsModule],
	providers: [
		ChatEventsRepository,
		ChatsRepository,
		ChatService,
		ChatStreamRelayService,
		GenerationActivityService,
		GenerationPolicyService,
		GenerationQueueService,
		TranscriptionService,
	],
})
export class GenerationModule {}

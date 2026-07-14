/**
 * Small service for "is this chat busy right now?"
 *
 * The real data is in Redis. This class just gives the rest of the app simple
 * method names instead of making every service know Redis keys.
 */
import { Inject, Injectable } from "@nestjs/common";

import { ChatEventsRepository } from "../../infrastructure/redis/chat-events.repository";

// `@Injectable()` lets Nest create and inject this service.
@Injectable()
export class GenerationActivityService {
	constructor(
		// ChatEventsRepository knows the actual Redis keys/scripts.
		@Inject(ChatEventsRepository)
		private readonly chatEventsRepository: ChatEventsRepository,
	) {}

	// Return the current job id, or null if the chat is not busy.
	getActiveJobId(chatId: string): Promise<string | null> {
		return this.chatEventsRepository.getActiveJobId(chatId);
	}

	// Try to mark the chat as busy for this job.
	reserveActive(chatId: string, jobId: string): Promise<boolean> {
		return this.chatEventsRepository.reserveActive(chatId, jobId);
	}

	// Clear the busy flag only if it still belongs to this same job.
	releaseActive(chatId: string, jobId: string): Promise<boolean> {
		return this.chatEventsRepository.releaseActive(chatId, jobId);
	}
}

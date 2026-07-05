import { Inject, Injectable } from "@nestjs/common";

import { ChatEventsRepository } from "../../infrastructure/redis/chat-events.repository";

@Injectable()
export class GenerationActivityService {
	constructor(
		@Inject(ChatEventsRepository)
		private readonly chatEventsRepository: ChatEventsRepository,
	) {}

	getActiveJobId(chatId: string): Promise<string | null> {
		return this.chatEventsRepository.getActiveJobId(chatId);
	}

	reserveActive(chatId: string, jobId: string): Promise<boolean> {
		return this.chatEventsRepository.reserveActive(chatId, jobId);
	}

	releaseActive(chatId: string, jobId: string): Promise<boolean> {
		return this.chatEventsRepository.releaseActive(chatId, jobId);
	}
}

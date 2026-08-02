import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

vi.mock("@wandit/env/server", () => ({
	env: {
		QUEUE_PREFIX: "test-worker",
		REDIS_URL: "redis://127.0.0.1:6379",
	},
}));

import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
import { WorkerCreditsService } from "./infrastructure/persistence/worker-credits.service";
import { WorkerQueuesModule } from "./infrastructure/queues/worker-queues.module";
import { ChatEventsPublisher } from "./infrastructure/redis/chat-events.publisher";
import { AiGenerationProcessor } from "./processors/ai-generation.processor";
import { LeadProcessingProcessor } from "./processors/lead-processing.processor";
import { MediaGenerationProcessor } from "./processors/media-generation.processor";
import { PublishProcessor } from "./processors/publish.processor";
import { WorkerModule } from "./worker.module";

describe("WorkerModule", () => {
	it("wires only the remaining queue processors and their worker-local support", () => {
		const providers = Reflect.getMetadata(
			MODULE_METADATA.PROVIDERS,
			WorkerModule,
		);

		expect(providers).toEqual([
			AiGenerationProcessor,
			ChatEventsPublisher,
			MediaGenerationProcessor,
			LeadProcessingProcessor,
			PublishProcessor,
			WorkerChatRepository,
			WorkerCreditsService,
		]);
	});

	it("retains the worker database and Redis-backed queue modules", () => {
		const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule);

		expect(imports).toEqual(
			expect.arrayContaining([WorkerDatabaseModule, WorkerQueuesModule]),
		);
	});
});

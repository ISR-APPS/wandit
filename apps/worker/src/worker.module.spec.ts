import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { CreditsService } from "../../server/src/modules/credits/application/services/credits.service";
import { CreditsRepository } from "../../server/src/modules/credits/infrastructure/persistence/credits.repository";
import { LifecycleEventsService } from "../../server/src/modules/lifecycle-events/application/services/lifecycle-events.service";
import { LifecycleEventsRepository } from "../../server/src/modules/lifecycle-events/infrastructure/persistence/lifecycle-events.repository";
import { MeteringService } from "../../server/src/modules/metering/application/services/metering.service";
import { ModelPricingService } from "../../server/src/modules/metering/application/services/model-pricing.service";
import { METERING_GATEWAY } from "../../server/src/modules/metering/domain/metering";
import { MeteringRepository } from "../../server/src/modules/metering/infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "../../server/src/modules/metering/infrastructure/persistence/model-prices.repository";
import { OrganizationLimitsRepository } from "../../server/src/modules/workspaces/infrastructure/persistence/organization-limits.repository";

vi.mock("@wandit/env/server", () => ({
	env: {
		QUEUE_PREFIX: "test-worker",
		REDIS_URL: "redis://127.0.0.1:6379",
	},
}));

import { WorkerDatabaseModule } from "./infrastructure/database/database.module";
import { databaseProvider } from "./infrastructure/database/database-alias.provider";
import { WorkerChatRepository } from "./infrastructure/persistence/worker-chat.repository";
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
			databaseProvider,
			AiGenerationProcessor,
			ChatEventsPublisher,
			CreditsRepository,
			CreditsService,
			LeadProcessingProcessor,
			LifecycleEventsRepository,
			LifecycleEventsService,
			MediaGenerationProcessor,
			MeteringRepository,
			MeteringService,
			ModelPricesRepository,
			ModelPricingService,
			OrganizationLimitsRepository,
			PublishProcessor,
			WorkerChatRepository,
			expect.objectContaining({ provide: METERING_GATEWAY }),
		]);
	});

	it("retains the worker database and Redis-backed queue modules", () => {
		const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule);

		expect(imports).toEqual(
			expect.arrayContaining([WorkerDatabaseModule, WorkerQueuesModule]),
		);
	});
});

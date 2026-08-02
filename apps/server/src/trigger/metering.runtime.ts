import { gateway } from "@ai-sdk/gateway";
import type { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import {
	METERING_QUEUE,
	type MeteringJobData,
	type MeteringJobName,
} from "@wandit/jobs";
import { Queue } from "bullmq";

import { createRedisConnectionOptions } from "../infrastructure/redis/redis-connection";
import { CreditsService } from "../modules/credits/application/services/credits.service";
import { CreditsRepository } from "../modules/credits/infrastructure/persistence/credits.repository";
import { MeteringService } from "../modules/metering/application/services/metering.service";
import {
	type ModelPricingCache,
	ModelPricingService,
} from "../modules/metering/application/services/model-pricing.service";
import { MeteringRepository } from "../modules/metering/infrastructure/persistence/metering.repository";
import { ModelPricesRepository } from "../modules/metering/infrastructure/persistence/model-prices.repository";
import { enqueueMeteringReconciliation } from "../modules/metering/infrastructure/queues/bullmq-metering-reconciliation.scheduler";

type TriggerDatabase = ReturnType<typeof createDb>;
const triggerModelPricingCache: ModelPricingCache = new Map();

/** Hand-wires the same metering graph for Trigger.dev's non-Nest runtime. */
export function createTriggerMetering(db: TriggerDatabase): MeteringService {
	const credits = new CreditsService(new CreditsRepository(db));
	const pricing = new ModelPricingService(new ModelPricesRepository(db), {
		cache: triggerModelPricingCache,
	});
	const reconciliationScheduler = env.QUEUE_ENABLED
		? {
				schedule: async (eventId: string) => {
					const queue = new Queue<MeteringJobData, unknown, MeteringJobName>(
						METERING_QUEUE,
						{
							connection: createRedisConnectionOptions(env.REDIS_URL),
							prefix: env.QUEUE_PREFIX,
						},
					);

					try {
						await enqueueMeteringReconciliation(queue, eventId);
					} finally {
						await queue.close();
					}
				},
			}
		: undefined;

	return new MeteringService(
		new MeteringRepository(db),
		credits,
		pricing,
		gateway,
		reconciliationScheduler,
	);
}

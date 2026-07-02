import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { queueNames } from "@wandit/jobs";

import { createRedisConnectionOptions } from "../redis/redis-connection";

const queueImports = env.QUEUE_ENABLED
	? [
			BullModule.forRoot({
				connection: createRedisConnectionOptions(env.REDIS_URL, {
					lazyConnect: true,
				}),
				defaultJobOptions: {
					attempts: 3,
					backoff: {
						delay: 1000,
						type: "exponential",
					},
					removeOnComplete: 1000,
					removeOnFail: 5000,
				},
				prefix: env.QUEUE_PREFIX,
			}),
			BullModule.registerQueue(...queueNames.map((name) => ({ name }))),
		]
	: [];

@Module({
	exports: env.QUEUE_ENABLED ? [BullModule] : [],
	imports: queueImports,
})
export class QueuesModule {}

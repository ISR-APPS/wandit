// Queue module for the worker.
//
// The API adds jobs to Redis. This worker listens to the same queue names and
// processes those jobs in the background.
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { queueNames } from "@wandit/jobs";

import { createRedisConnectionOptions } from "../redis/redis-connection";

// `@Module()` groups the BullMQ setup so WorkerModule can import it once.
@Module({
	imports: [
		// Shared BullMQ Redis connection for this worker process.
		BullModule.forRoot({
			connection: createRedisConnectionOptions(env.REDIS_URL),
			// Default retry and cleanup behavior for jobs.
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
		// Register all shared queue names so processors can attach to them.
		BullModule.registerQueue(...queueNames.map((name) => ({ name }))),
	],
	exports: [BullModule],
})
// Empty class: the @Module metadata above is the important part.
export class WorkerQueuesModule {}

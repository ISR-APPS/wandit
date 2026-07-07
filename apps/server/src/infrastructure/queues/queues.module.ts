/**
 * Registers BullMQ queues for the API.
 *
 * The API only adds jobs. The worker process does the slow work later.
 * This keeps HTTP requests fast, like putting work into a background queue
 * instead of doing it inside an Express route.
 */
// BullMQ stores jobs in Redis. API writes jobs, worker reads jobs.
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { env } from "@wandit/env/server";
import { queueNames } from "@wandit/jobs";

import { createRedisConnectionOptions } from "../redis/redis-connection";

// If `QUEUE_ENABLED=false`, do not register BullMQ providers. The app can still
// start, but generation requests will fail with a clear 503 later.
const queueImports = env.QUEUE_ENABLED
	? [
			// `forRoot` is BullMQ setup shared by all queues in this API process.
			BullModule.forRoot({
				// The API and worker must use the same Redis URL and prefix.
				connection: createRedisConnectionOptions(env.REDIS_URL, {
					lazyConnect: true,
				}),
				// Default retry/cleanup rules for queued jobs.
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
			// Create one injectable queue object for each queue name.
			BullModule.registerQueue(...queueNames.map((name) => ({ name }))),
		]
	: [];

// A Nest module groups setup. Exporting BullModule lets services receive queues
// from Nest.
@Module({
	exports: env.QUEUE_ENABLED ? [BullModule] : [],
	imports: queueImports,
})
export class QueuesModule {}

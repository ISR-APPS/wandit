// Queue config for the worker.
//
// The API and worker must use the same Redis URL and queue prefix. Otherwise
// the API will add jobs in one place and the worker will listen in another.
import { registerAs } from "@nestjs/config";
import { env } from "@wandit/env/server";

// `registerAs("queue", ...)` gives this config a name inside Nest.
export const queueConfig = registerAs("queue", () => ({
	prefix: env.QUEUE_PREFIX,
	redisUrl: env.REDIS_URL,
}));

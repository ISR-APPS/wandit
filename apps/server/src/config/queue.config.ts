/**
 * Queue config for the API server.
 *
 * Think of this like a small config object in Express. It does not create the
 * queue. It only gives Nest the values from `.env`: is the queue enabled, where
 * is Redis, and what prefix should BullMQ use.
 */
import { registerAs } from "@nestjs/config";
import { env } from "@wandit/env/server";

// `registerAs("queue", ...)` gives this config a name. Other Nest code can ask
// for the "queue" config instead of reading `process.env` everywhere.
export const queueConfig = registerAs("queue", () => ({
	enabled: env.QUEUE_ENABLED,
	prefix: env.QUEUE_PREFIX,
	redisUrl: env.REDIS_URL,
}));

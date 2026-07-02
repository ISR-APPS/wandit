import { registerAs } from "@nestjs/config";
import { env } from "@wandit/env/server";

export const queueConfig = registerAs("queue", () => ({
	prefix: env.QUEUE_PREFIX,
	redisUrl: env.REDIS_URL,
}));

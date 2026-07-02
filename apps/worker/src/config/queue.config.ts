import { env } from "@my-better-t-app/env/server";
import { registerAs } from "@nestjs/config";

export const queueConfig = registerAs("queue", () => ({
  prefix: env.QUEUE_PREFIX,
  redisUrl: env.REDIS_URL,
}));

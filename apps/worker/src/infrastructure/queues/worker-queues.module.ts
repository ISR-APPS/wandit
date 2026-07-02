import { queueNames } from "@my-better-t-app/jobs";
import { env } from "@my-better-t-app/env/server";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { createRedisConnectionOptions } from "../redis/redis-connection";

@Module({
  imports: [
    BullModule.forRoot({
      connection: createRedisConnectionOptions(env.REDIS_URL),
      prefix: env.QUEUE_PREFIX,
    }),
    BullModule.registerQueue(...queueNames.map((name) => ({ name }))),
  ],
})
export class WorkerQueuesModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { queueConfig } from "./config/queue.config";
import { WorkerQueuesModule } from "./infrastructure/queues/worker-queues.module";
import { AiGenerationProcessor } from "./processors/ai-generation.processor";
import { LeadProcessingProcessor } from "./processors/lead-processing.processor";
import { MediaGenerationProcessor } from "./processors/media-generation.processor";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [queueConfig],
    }),
    WorkerQueuesModule,
  ],
  providers: [AiGenerationProcessor, MediaGenerationProcessor, LeadProcessingProcessor],
})
export class WorkerModule {}

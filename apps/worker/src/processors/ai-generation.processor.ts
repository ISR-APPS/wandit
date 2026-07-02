import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { AI_GENERATION_QUEUE, type AiGenerationJobData } from "@wandit/jobs";
import type { Job } from "bullmq";

@Processor(AI_GENERATION_QUEUE)
export class AiGenerationProcessor extends WorkerHost {
	private readonly logger = new Logger(AiGenerationProcessor.name);

	async process(job: Job<AiGenerationJobData>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		return {
			processed: false,
			reason: "Processor scaffold only",
		};
	}
}

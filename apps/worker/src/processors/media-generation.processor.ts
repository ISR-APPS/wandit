import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import {
	MEDIA_GENERATION_QUEUE,
	type MediaGenerationJobData,
} from "@wandit/jobs";
import type { Job } from "bullmq";

@Processor(MEDIA_GENERATION_QUEUE)
export class MediaGenerationProcessor extends WorkerHost {
	private readonly logger = new Logger(MediaGenerationProcessor.name);

	async process(job: Job<MediaGenerationJobData>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		return {
			processed: false,
			reason: "Processor scaffold only",
		};
	}
}

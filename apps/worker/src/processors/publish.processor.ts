import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { PUBLISH_QUEUE, type PublishJobData } from "@wandit/jobs";
import type { Job } from "bullmq";

@Processor(PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
	private readonly logger = new Logger(PublishProcessor.name);

	async process(job: Job<PublishJobData>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		return {
			processed: false,
			reason: "Processor scaffold only",
		};
	}
}

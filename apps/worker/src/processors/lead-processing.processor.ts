import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import {
	LEAD_PROCESSING_QUEUE,
	type LeadProcessingJobData,
} from "@wandit/jobs";
import type { Job } from "bullmq";

@Processor(LEAD_PROCESSING_QUEUE)
export class LeadProcessingProcessor extends WorkerHost {
	private readonly logger = new Logger(LeadProcessingProcessor.name);

	async process(job: Job<LeadProcessingJobData>) {
		this.logger.log(`Received ${job.name} job ${job.id}`);

		return {
			processed: false,
			reason: "Processor scaffold only",
		};
	}
}

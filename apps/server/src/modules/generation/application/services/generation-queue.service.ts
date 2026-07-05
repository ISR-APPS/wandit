import { getQueueToken } from "@nestjs/bullmq";
import {
	Inject,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { env } from "@wandit/env/server";
import {
	AI_GENERATION_QUEUE,
	type AiGenerationJobData,
	type AiGenerationJobName,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

type EnqueueInput = AiGenerationJobData;

@Injectable()
export class GenerationQueueService {
	constructor(
		@Inject(ModuleRef)
		private readonly moduleRef: ModuleRef,
	) {}

	async enqueueGenerateCopy(input: EnqueueInput): Promise<{ jobId: string }> {
		const queue = this.getQueue();
		const data = input satisfies AiGenerationJobData;
		const job = await queue.add("generate-copy", data, {
			attempts: 1,
			jobId: input.jobId,
			removeOnComplete: 1000,
			removeOnFail: 5000,
		});

		return { jobId: String(job.id ?? input.jobId) };
	}

	private getQueue(): Queue<AiGenerationJobData, unknown, AiGenerationJobName> {
		if (!env.QUEUE_ENABLED) {
			throw new ServiceUnavailableException({
				code: "QUEUE_DISABLED",
				message: "Generation queue is disabled",
			});
		}

		return this.moduleRef.get<
			Queue<AiGenerationJobData, unknown, AiGenerationJobName>
		>(getQueueToken(AI_GENERATION_QUEUE), { strict: false });
	}
}

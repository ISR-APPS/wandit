/**
 * Adds AI generation jobs to BullMQ.
 *
 * API side: put a job in the queue.
 * Worker side: read the job and call the AI model.
 */
import { getQueueToken } from "@nestjs/bullmq";
import {
	Inject,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
// ModuleRef lets us ask Nest for a provider at runtime.
import { ModuleRef } from "@nestjs/core";
// Typed environment values.
import { env } from "@wandit/env/server";
// Shared queue names and payload types. API and worker must agree on these.
import {
	AI_GENERATION_QUEUE,
	type AiGenerationJobData,
	type AiGenerationJobName,
} from "@wandit/jobs";
import type { Queue } from "bullmq";

type EnqueueInput = AiGenerationJobData;

// `@Injectable()` lets services inject this queue helper.
@Injectable()
export class GenerationQueueService {
	constructor(
		// We do not inject Queue directly because queues may be disabled in `.env`.
		@Inject(ModuleRef)
		private readonly moduleRef: ModuleRef,
	) {}

	// Add a "generate-copy" job for the worker.
	async enqueueGenerateCopy(input: EnqueueInput): Promise<{ jobId: string }> {
		const queue = this.getQueue();
		// `satisfies` is only a TypeScript check. It changes nothing at runtime.
		const data = input satisfies AiGenerationJobData;
		// Use our jobId so Redis, BullMQ, and stream events all refer to the same job.
		const job = await queue.add("generate-copy", data, {
			attempts: 1,
			jobId: input.jobId,
			removeOnComplete: 1000,
			removeOnFail: 5000,
		});

		return { jobId: String(job.id ?? input.jobId) };
	}

	// Get the BullMQ Queue object from Nest only when we need it.
	private getQueue(): Queue<AiGenerationJobData, unknown, AiGenerationJobName> {
		// If queues are disabled, fail with a clear 503 instead of a Nest DI error.
		if (!env.QUEUE_ENABLED) {
			throw new ServiceUnavailableException({
				code: "QUEUE_DISABLED",
				message: "Generation queue is disabled",
			});
		}

		// `getQueueToken` builds the provider token for this named BullMQ queue.
		return this.moduleRef.get<
			Queue<AiGenerationJobData, unknown, AiGenerationJobName>
		>(getQueueToken(AI_GENERATION_QUEUE), { strict: false });
	}
}

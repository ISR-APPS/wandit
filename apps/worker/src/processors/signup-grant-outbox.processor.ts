import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	SIGNUP_GRANT_SWEEP_JOB,
	SIGNUP_GRANTS_QUEUE,
	type SignupGrantJobName,
	type SignupGrantSweepJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { SignupGrantOutboxService } from "../../../server/src/modules/auth/application/services/signup-grant-outbox.service";

@Processor(SIGNUP_GRANTS_QUEUE)
export class SignupGrantOutboxProcessor
	extends WorkerHost
	implements OnModuleInit
{
	private readonly logger = new Logger(SignupGrantOutboxProcessor.name);

	constructor(
		@Inject(SignupGrantOutboxService)
		private readonly outboxService: SignupGrantOutboxService,
		@InjectQueue(SIGNUP_GRANTS_QUEUE)
		private readonly queue: Queue<
			SignupGrantSweepJobData,
			unknown,
			SignupGrantJobName
		>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			SIGNUP_GRANT_SWEEP_JOB,
			{ every: 60_000 },
			{
				data: {},
				name: SIGNUP_GRANT_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("Signup grant outbox scheduler registered");
	}

	async process(
		job: Job<SignupGrantSweepJobData, unknown, SignupGrantJobName>,
	): Promise<{ done: number }> {
		if (job.name !== SIGNUP_GRANT_SWEEP_JOB) {
			throw new Error(`Unknown signup grant job ${job.name satisfies never}`);
		}

		const result = await this.outboxService.sweep(job.data.userId);

		if (result.failed > 0) {
			throw new Error(
				`Signup grant outbox sweep left ${result.failed} row(s) pending`,
			);
		}

		return { done: result.done };
	}
}

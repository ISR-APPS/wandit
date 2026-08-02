import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger, type OnModuleInit } from "@nestjs/common";
import {
	MODEL_PRICING_QUEUE,
	MODEL_PRICING_REFRESH_JOB,
	type ModelPricingJobName,
	type ModelPricingRefreshJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";

import { ModelPricingService } from "../../../server/src/modules/metering/application/services/model-pricing.service";

const MODEL_PRICING_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

@Processor(MODEL_PRICING_QUEUE)
export class ModelPricingProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(ModelPricingProcessor.name);

	constructor(
		@Inject(ModelPricingService)
		private readonly modelPricingService: ModelPricingService,
		@InjectQueue(MODEL_PRICING_QUEUE)
		private readonly queue: Queue<
			ModelPricingRefreshJobData,
			unknown,
			ModelPricingJobName
		>,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		await this.queue.upsertJobScheduler(
			MODEL_PRICING_REFRESH_JOB,
			{ every: MODEL_PRICING_REFRESH_INTERVAL_MS },
			{
				data: {},
				name: MODEL_PRICING_REFRESH_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
		this.logger.log("Model pricing refresh scheduler registered");
	}

	process(job: Job<ModelPricingRefreshJobData, unknown, ModelPricingJobName>) {
		if (job.name !== MODEL_PRICING_REFRESH_JOB) {
			throw new Error(`Unknown model pricing job ${job.name satisfies never}`);
		}

		return this.modelPricingService.refreshFromGateway();
	}
}

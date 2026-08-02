import {
	MODEL_PRICING_QUEUE,
	MODEL_PRICING_REFRESH_JOB,
	type ModelPricingJobName,
	type ModelPricingRefreshJobData,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { ModelPricingService } from "../../../server/src/modules/metering/application/services/model-pricing.service";
import { ModelPricingProcessor } from "./model-pricing.processor";

describe("ModelPricingProcessor", () => {
	it("registers an hourly repeatable refresh", async () => {
		const service = { refreshFromGateway: vi.fn() };
		const queue = { upsertJobScheduler: vi.fn(async () => undefined) };
		const processor = new ModelPricingProcessor(
			service as unknown as ModelPricingService,
			queue as unknown as Queue<
				ModelPricingRefreshJobData,
				unknown,
				ModelPricingJobName
			>,
		);

		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			MODEL_PRICING_REFRESH_JOB,
			{ every: 60 * 60 * 1000 },
			{
				data: {},
				name: MODEL_PRICING_REFRESH_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
	});

	it("refreshes model prices for the shared queue job", async () => {
		const result = {
			fetched: 312,
			persisted: 312,
			refreshedAt: new Date("2026-08-01T12:00:00.000Z"),
		};
		const service = { refreshFromGateway: vi.fn(async () => result) };
		const queue = { upsertJobScheduler: vi.fn() };
		const processor = new ModelPricingProcessor(
			service as unknown as ModelPricingService,
			queue as unknown as Queue<
				ModelPricingRefreshJobData,
				unknown,
				ModelPricingJobName
			>,
		);

		await expect(
			processor.process({
				data: {},
				name: MODEL_PRICING_REFRESH_JOB,
				queueName: MODEL_PRICING_QUEUE,
			} as Job<ModelPricingRefreshJobData, unknown, ModelPricingJobName>),
		).resolves.toEqual(result);
	});
});

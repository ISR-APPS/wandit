import {
	BILLING_WEBHOOK_RETRY_EVENT_JOB,
	BILLING_WEBHOOK_RETRY_SWEEP_JOB,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { BillingWebhookRetryService } from "../../../server/src/modules/billing/application/services/billing-webhook-retry.service";
import { BillingWebhookProcessor } from "./billing-webhook.processor";

function setup() {
	const retryService = {
		retryEvent: vi.fn(async (eventId: string) => ({ eventId, retried: true })),
		sweep: vi.fn(async () => ({ deadLettered: 1, processed: 2 })),
	};
	const queue = {
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const processor = new BillingWebhookProcessor(
		retryService as unknown as BillingWebhookRetryService,
		queue as unknown as Queue,
	);

	return { processor, queue, retryService };
}

function job(name: string, data: Record<string, unknown> = {}) {
	return { data, name } as unknown as Job;
}

describe("BillingWebhookProcessor", () => {
	it("upserts the failed-event sweep scheduler with bounded history", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();
		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"billing-webhook-retry-sweep-scheduler",
			{ every: 60_000 },
			{
				data: {},
				name: BILLING_WEBHOOK_RETRY_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
	});

	it("delegates scheduled sweeps", async () => {
		const { processor, retryService } = setup();

		await expect(
			processor.process(job(BILLING_WEBHOOK_RETRY_SWEEP_JOB) as never),
		).resolves.toEqual({ deadLettered: 1, processed: 2 });
		expect(retryService.sweep).toHaveBeenCalledOnce();
		expect(retryService.retryEvent).not.toHaveBeenCalled();
	});

	it("delegates one-event replay with its durable event id", async () => {
		const { processor, retryService } = setup();

		await expect(
			processor.process(
				job(BILLING_WEBHOOK_RETRY_EVENT_JOB, { eventId: "evt_123" }) as never,
			),
		).resolves.toEqual({ eventId: "evt_123", retried: true });
		expect(retryService.retryEvent).toHaveBeenCalledWith("evt_123");
		expect(retryService.sweep).not.toHaveBeenCalled();
	});

	it("rejects a one-event replay without an event id", () => {
		const { processor, retryService } = setup();

		expect(() =>
			processor.process(job(BILLING_WEBHOOK_RETRY_EVENT_JOB) as never),
		).toThrow("Billing webhook retry job requires an eventId");
		expect(retryService.retryEvent).not.toHaveBeenCalled();
	});

	it("rejects unknown job names", () => {
		const { processor, retryService } = setup();

		expect(() => processor.process(job("unexpected") as never)).toThrow(
			"Unknown billing webhook job unexpected",
		);
		expect(retryService.sweep).not.toHaveBeenCalled();
		expect(retryService.retryEvent).not.toHaveBeenCalled();
	});
});

import {
	ConflictException,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { BILLING_WEBHOOK_RETRY_EVENT_JOB } from "@wandit/jobs";
import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	BillingWebhookEventRow,
	BillingWebhookEventsRepository,
} from "../../../billing/infrastructure/persistence/billing-webhook-events.repository";
import { AdminWebhookReplayService } from "./admin-webhook-replay.service";

function event(
	overrides: Partial<BillingWebhookEventRow> = {},
): BillingWebhookEventRow {
	return {
		attemptCount: 8,
		claimedAt: null,
		createdAt: new Date(0),
		deadLetteredAt: null,
		error: "failed",
		eventCreatedAt: new Date(0),
		id: "evt_123",
		payload: {},
		processedAt: new Date(0),
		provider: "stripe",
		status: "failed",
		type: "invoice.paid",
		...overrides,
	};
}

function setup(row: BillingWebhookEventRow | null, queueEnabled = true) {
	const repository = {
		findById: vi.fn(async () => row),
	};
	const queue = {
		add: vi.fn(async () => ({ id: "job_1" })),
	};
	const service = new AdminWebhookReplayService(
		repository as unknown as BillingWebhookEventsRepository,
		queueEnabled ? (queue as unknown as Queue) : undefined,
	);

	return { queue, repository, service };
}

describe("AdminWebhookReplayService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("queues one failed event with an attempt-scoped deduplication key and audit log", async () => {
		const { queue, service } = setup(event());
		const auditLog = vi
			.spyOn(Logger.prototype, "log")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.enqueue("admin_1", "evt_123")).resolves.toEqual({
			accepted: true,
			eventId: "evt_123",
		});
		expect(queue.add).toHaveBeenCalledWith(
			BILLING_WEBHOOK_RETRY_EVENT_JOB,
			{ eventId: "evt_123" },
			{
				attempts: 1,
				jobId: "billing-webhook-replay-evt_123-8",
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
		expect(auditLog).toHaveBeenCalledWith(
			"admin_webhook_replay_queued admin=admin_1 event=evt_123 attempt=8",
		);
	});

	it("does not enqueue an unknown or non-failed event", async () => {
		const missing = setup(null);
		const processed = setup(event({ status: "processed" }));

		await expect(
			missing.service.enqueue("admin_1", "evt_123"),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			processed.service.enqueue("admin_1", "evt_123"),
		).rejects.toBeInstanceOf(ConflictException);
		expect(missing.queue.add).not.toHaveBeenCalled();
		expect(processed.queue.add).not.toHaveBeenCalled();
	});

	it("fails clearly when queues are disabled", async () => {
		const { service } = setup(event(), false);

		await expect(service.enqueue("admin_1", "evt_123")).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
	});

	it("audits enqueue failures and preserves the queue error", async () => {
		const { queue, service } = setup(event());
		const failure = new Error("redis unavailable");
		queue.add.mockRejectedValueOnce(failure);
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.enqueue("admin_1", "evt_123")).rejects.toBe(failure);
		expect(errorLog.mock.calls[0]?.[0]).toBe(
			"admin_webhook_replay_enqueue_failed admin=admin_1 event=evt_123",
		);
	});
});

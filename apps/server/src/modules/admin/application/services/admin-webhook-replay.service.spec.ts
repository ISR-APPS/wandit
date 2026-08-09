import {
	ConflictException,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	BillingWebhookEventRow,
	BillingWebhookEventsRepository,
} from "../../../billing/infrastructure/persistence/billing-webhook-events.repository";
import type { TriggerBillingWebhookDispatcherService } from "../../../billing/infrastructure/trigger/trigger-billing-webhook-dispatcher.service";
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

function setup(row: BillingWebhookEventRow | null, dispatcherEnabled = true) {
	const repository = {
		findById: vi.fn(async () => row),
	};
	const dispatcher = {
		triggerRetry: vi.fn(async () => undefined),
	};
	const service = new AdminWebhookReplayService(
		repository as unknown as BillingWebhookEventsRepository,
		dispatcherEnabled
			? (dispatcher as unknown as TriggerBillingWebhookDispatcherService)
			: undefined,
	);

	return { dispatcher, repository, service };
}

describe("AdminWebhookReplayService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("triggers one failed event with its current attempt and an audit log", async () => {
		const { dispatcher, service } = setup(event());
		const auditLog = vi
			.spyOn(Logger.prototype, "log")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.enqueue("admin_1", "evt_123")).resolves.toEqual({
			accepted: true,
			eventId: "evt_123",
		});
		expect(dispatcher.triggerRetry).toHaveBeenCalledWith("evt_123", 8);
		expect(auditLog).toHaveBeenCalledWith(
			"admin_webhook_replay_triggered admin=admin_1 event=evt_123 attempt=8",
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
		expect(missing.dispatcher.triggerRetry).not.toHaveBeenCalled();
		expect(processed.dispatcher.triggerRetry).not.toHaveBeenCalled();
	});

	it("fails clearly when the Trigger dispatcher is unavailable", async () => {
		const { service } = setup(event(), false);

		await expect(service.enqueue("admin_1", "evt_123")).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
	});

	it("audits enqueue failures and preserves the queue error", async () => {
		const { dispatcher, service } = setup(event());
		const failure = new Error("trigger unavailable");
		dispatcher.triggerRetry.mockRejectedValueOnce(failure);
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.enqueue("admin_1", "evt_123")).rejects.toBe(failure);
		expect(errorLog.mock.calls[0]?.[0]).toBe(
			"admin_webhook_replay_trigger_failed admin=admin_1 event=evt_123",
		);
	});
});

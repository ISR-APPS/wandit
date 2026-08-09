import { Logger } from "@nestjs/common";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	BillingWebhookEventRow,
	BillingWebhookEventsRepository,
} from "../../infrastructure/persistence/billing-webhook-events.repository";
import {
	BILLING_WEBHOOK_MAX_ATTEMPTS,
	BillingWebhookRetryService,
} from "./billing-webhook-retry.service";
import type { StripeWebhookProcessor } from "./stripe-webhook-processor.service";

const NOW = new Date("2026-08-01T12:00:00.000Z");

function webhookRow(
	id: string,
	overrides: Partial<BillingWebhookEventRow> = {},
): BillingWebhookEventRow {
	const type = overrides.type ?? "invoice.paid";

	return {
		attemptCount: 1,
		claimedAt: null,
		createdAt: new Date(NOW.getTime() - 10 * 60_000),
		deadLetteredAt: null,
		error: "temporary failure",
		eventCreatedAt: new Date(NOW.getTime() - 20 * 60_000),
		id,
		payload: {
			created: Math.floor(NOW.getTime() / 1000),
			data: { object: {} },
			id,
			object: "event",
			type,
		},
		processedAt: new Date(NOW.getTime() - 2 * 60_000),
		provider: "stripe",
		status: "failed",
		type,
		...overrides,
	};
}

function setup(rows: BillingWebhookEventRow[]) {
	const stored = new Map(rows.map((row) => [row.id, row]));
	const repository = {
		findById: vi.fn(async (id: string) => stored.get(id) ?? null),
		listDeadLetterCandidates: vi.fn(async () =>
			[...stored.values()].filter(
				(row) =>
					(row.status === "failed" ||
						(row.status === "processing" &&
							row.claimedAt !== null &&
							row.claimedAt.getTime() <= NOW.getTime() - 5 * 60_000)) &&
					row.attemptCount >= BILLING_WEBHOOK_MAX_ATTEMPTS &&
					row.deadLetteredAt === null,
			),
		),
		listRetryableBelowAttemptLimit: vi.fn(async () =>
			[...stored.values()].filter(
				(row) =>
					(row.status === "failed" ||
						row.status === "received" ||
						(row.status === "processing" &&
							row.claimedAt !== null &&
							row.claimedAt.getTime() <= NOW.getTime() - 5 * 60_000)) &&
					row.attemptCount < BILLING_WEBHOOK_MAX_ATTEMPTS,
			),
		),
		markDeadLettered: vi.fn(async (eventId: string, maxAttempts: number) => {
			const current = stored.get(eventId);
			const staleProcessing =
				current?.status === "processing" &&
				current.claimedAt !== null &&
				current.claimedAt.getTime() <= NOW.getTime() - 5 * 60_000;

			if (
				!current ||
				(current.status !== "failed" && !staleProcessing) ||
				current.attemptCount < maxAttempts ||
				current.deadLetteredAt !== null
			) {
				return null;
			}

			const updated = { ...current, deadLetteredAt: NOW };
			stored.set(eventId, updated);

			return updated;
		}),
		recordRetryFailure: vi.fn(
			async (input: {
				error: string;
				eventId: string;
				expectedAttemptCount: number;
			}) => {
				const current = stored.get(input.eventId);

				if (
					!current ||
					(current.status !== "failed" && current.status !== "received") ||
					current.attemptCount !== input.expectedAttemptCount
				) {
					return null;
				}

				const updated = {
					...current,
					attemptCount: current.attemptCount + 1,
					error: input.error,
					processedAt: NOW,
					status: "failed" as const,
				};
				stored.set(input.eventId, updated);

				return updated;
			},
		),
	};
	const processor = {
		process: vi.fn(async (event: Stripe.Event, _options?: unknown) => {
			const current = stored.get(event.id);

			if (current) {
				stored.set(event.id, {
					...current,
					attemptCount: current.attemptCount + 1,
					error: null,
					status: "processed",
				});
			}

			return { received: true as const };
		}),
	};
	const service = new BillingWebhookRetryService(
		repository as unknown as BillingWebhookEventsRepository,
		processor as unknown as StripeWebhookProcessor,
	);

	return { processor, repository, service, stored };
}

describe("BillingWebhookRetryService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("retries only failed events whose exponential backoff has elapsed", async () => {
		const due = webhookRow("evt_due");
		const notDue = webhookRow("evt_not_due", {
			processedAt: new Date(NOW.getTime() - 59_999),
		});
		const { processor, service } = setup([due, notDue]);

		await expect(service.sweep(NOW)).resolves.toEqual({
			deadLettered: 0,
			failed: 0,
			retried: 1,
			skipped: 1,
		});
		expect(processor.process).toHaveBeenCalledTimes(1);
		expect(processor.process.mock.calls[0]?.[0].id).toBe("evt_due");
		expect(processor.process.mock.calls[0]?.[1]).toEqual({
			maxAttempts: BILLING_WEBHOOK_MAX_ATTEMPTS,
		});
	});

	it("caps exponential backoff at one hour", async () => {
		const row = webhookRow("evt_capped", {
			attemptCount: 7,
			processedAt: new Date(NOW.getTime() - 60 * 60_000 + 1),
		});
		const { processor, service } = setup([row]);

		await expect(service.sweep(NOW)).resolves.toMatchObject({
			retried: 0,
			skipped: 1,
		});
		expect(processor.process).not.toHaveBeenCalled();
	});

	it("recovers received events and expired processing leases", async () => {
		const received = webhookRow("evt_received", {
			attemptCount: 0,
			processedAt: null,
			status: "received",
		});
		const leaseExpired = webhookRow("evt_stale_processing", {
			claimedAt: new Date(NOW.getTime() - 6 * 60_000),
			processedAt: null,
			status: "processing",
		});
		const { service, stored } = setup([received, leaseExpired]);

		await expect(service.sweep(NOW)).resolves.toMatchObject({
			retried: 2,
		});
		expect(stored.get(received.id)?.status).toBe("processed");
		expect(stored.get(leaseExpired.id)?.status).toBe("processed");
	});

	it("isolates failures and emits one dead-letter alert when the cap is reached", async () => {
		const lastAttempt = webhookRow("evt_dead", {
			attemptCount: BILLING_WEBHOOK_MAX_ATTEMPTS - 1,
			processedAt: new Date(NOW.getTime() - 60 * 60_000),
		});
		const healthy = webhookRow("evt_healthy");
		const { processor, service, stored } = setup([lastAttempt, healthy]);
		processor.process.mockImplementation(async (event: Stripe.Event) => {
			const current = stored.get(event.id);

			if (!current) {
				throw new Error("missing fake row");
			}

			if (event.id === "evt_dead") {
				stored.set(event.id, {
					...current,
					attemptCount: current.attemptCount + 1,
					error: "still broken",
					status: "failed",
				});
				throw new Error("still broken");
			}

			stored.set(event.id, {
				...current,
				attemptCount: current.attemptCount + 1,
				error: null,
				status: "processed",
			});

			return { received: true as const };
		});
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.sweep(NOW)).resolves.toEqual({
			deadLettered: 1,
			failed: 1,
			retried: 2,
			skipped: 0,
		});
		expect(stored.get("evt_healthy")?.status).toBe("processed");
		expect(errorLog).toHaveBeenCalledTimes(1);
		expect(errorLog.mock.calls[0]?.[0]).toContain(
			"BILLING_WEBHOOK_DEAD_LETTER event=evt_dead",
		);
	});

	it("discovers a capped external failure and persists exactly one alert transition", async () => {
		const capped = webhookRow("evt_external_cap", {
			attemptCount: BILLING_WEBHOOK_MAX_ATTEMPTS,
		});
		const { repository, service, stored } = setup([capped]);
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.sweep(NOW)).resolves.toMatchObject({
			deadLettered: 1,
			retried: 0,
		});
		await expect(service.sweep(NOW)).resolves.toMatchObject({
			deadLettered: 0,
			retried: 0,
		});
		expect(repository.markDeadLettered).toHaveBeenCalledTimes(1);
		expect(stored.get(capped.id)?.deadLetteredAt).toEqual(NOW);
		expect(errorLog).toHaveBeenCalledTimes(1);
	});

	it("dead-letters a capped processing attempt only after its lease expires", async () => {
		const active = webhookRow("evt_active_last_attempt", {
			attemptCount: BILLING_WEBHOOK_MAX_ATTEMPTS,
			claimedAt: new Date(NOW.getTime() - 4 * 60_000),
			processedAt: null,
			status: "processing",
		});
		const crashed = webhookRow("evt_crashed_last_attempt", {
			attemptCount: BILLING_WEBHOOK_MAX_ATTEMPTS,
			claimedAt: new Date(NOW.getTime() - 6 * 60_000),
			processedAt: null,
			status: "processing",
		});
		const { service, stored } = setup([active, crashed]);
		const errorLog = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation((_message: unknown) => undefined);

		await expect(service.sweep(NOW)).resolves.toMatchObject({
			deadLettered: 1,
			retried: 0,
		});
		expect(stored.get(active.id)?.deadLetteredAt).toBeNull();
		expect(stored.get(crashed.id)?.deadLetteredAt).toEqual(NOW);
		expect(errorLog).toHaveBeenCalledOnce();
	});

	it("returns terminal events without routing them again", async () => {
		const terminal = webhookRow("evt_done", {
			error: null,
			status: "processed",
		});
		const { processor, service } = setup([terminal]);

		await expect(service.retryEvent(terminal.id)).resolves.toEqual({
			attemptCount: 1,
			eventId: terminal.id,
			status: "processed",
		});
		expect(processor.process).not.toHaveBeenCalled();
	});

	it("fails closed for a corrupt persisted event payload", async () => {
		const corrupt = webhookRow("evt_corrupt", {
			payload: { data: {}, id: "evt_other", type: "invoice.paid" },
		});
		const { processor, repository, service, stored } = setup([corrupt]);

		await expect(service.retryEvent(corrupt.id)).rejects.toThrow(
			"invalid persisted payload",
		);
		expect(processor.process).not.toHaveBeenCalled();
		expect(repository.recordRetryFailure).toHaveBeenCalledWith({
			error:
				"Billing webhook event evt_corrupt has an invalid persisted payload",
			eventId: "evt_corrupt",
			expectedAttemptCount: 1,
		});
		expect(stored.get(corrupt.id)?.attemptCount).toBe(2);
	});
});

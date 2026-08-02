import {
	METERING_QUEUE,
	METERING_RECONCILE_EVENT_JOB,
	METERING_RECOVERY_SWEEP_JOB,
	type MeteringJobData,
	type MeteringJobName,
} from "@wandit/jobs";
import type { Job, Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConnectorGenerationRecoveryService } from "../../../server/src/modules/connector-generations/application/services/connector-generation-recovery.service";
import type { MeteringService } from "../../../server/src/modules/metering/application/services/metering.service";
import { GatewayUsagePendingError } from "../../../server/src/modules/metering/domain/metering";
import { MeteringProcessor } from "./metering.processor";

function setup() {
	const service = {
		reconcile: vi.fn(async (eventId: string) => ({ eventId })),
		recoverStaleReservations: vi.fn(async () => ({ scanned: 0 })),
		recoverUnreconciledSettled: vi.fn(async () => ({ scanned: 0 })),
		terminalizeReconciliationFailure: vi.fn(async (eventId: string) => ({
			id: eventId,
			status: "reconcile_failed" as const,
		})),
	};
	const queue = {
		upsertJobScheduler: vi.fn(async () => undefined),
	};
	const connectorRecovery = {
		recoverCompletionCheckpoints: vi.fn(async () => ({
			failed: 0,
			recovered: 0,
			scanned: 0,
		})),
	};
	const processor = new MeteringProcessor(
		service as unknown as MeteringService,
		connectorRecovery as unknown as ConnectorGenerationRecoveryService,
		queue as unknown as Queue<MeteringJobData, unknown, MeteringJobName>,
	);

	return { connectorRecovery, processor, queue, service };
}

function job(
	name: MeteringJobName,
	data: MeteringJobData,
	options: { attempts?: number; attemptsMade?: number } = {},
) {
	return {
		attemptsMade: options.attemptsMade ?? 0,
		data,
		name,
		opts: { attempts: options.attempts ?? 8 },
		queueName: METERING_QUEUE,
	} as Job<MeteringJobData, unknown, MeteringJobName>;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("MeteringProcessor", () => {
	it("registers a five-minute stale-reservation sweep", async () => {
		const { processor, queue } = setup();

		await processor.onModuleInit();

		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			METERING_RECOVERY_SWEEP_JOB,
			{ every: 5 * 60 * 1000 },
			{
				data: {},
				name: METERING_RECOVERY_SWEEP_JOB,
				opts: { removeOnComplete: 10, removeOnFail: 50 },
			},
		);
	});

	it("waits forty minutes before recovering reservations and keeps the settled fallback prompt", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
		const { connectorRecovery, processor, service } = setup();

		await processor.process(job(METERING_RECOVERY_SWEEP_JOB, {}));

		expect(service.recoverStaleReservations).toHaveBeenCalledWith(
			new Date("2026-08-01T11:20:00.000Z"),
		);
		expect(service.recoverUnreconciledSettled).toHaveBeenCalledWith(
			new Date("2026-08-01T11:59:00.000Z"),
		);
		expect(
			connectorRecovery.recoverCompletionCheckpoints.mock
				.invocationCallOrder[0],
		).toBeLessThan(
			service.recoverStaleReservations.mock.invocationCallOrder[0] ??
				Number.MAX_SAFE_INTEGER,
		);
	});

	it("delegates per-event reconciliation", async () => {
		const { processor, service } = setup();

		await expect(
			processor.process(
				job(METERING_RECONCILE_EVENT_JOB, { eventId: "event_1" }),
			),
		).resolves.toEqual({ eventId: "event_1" });
		expect(service.reconcile).toHaveBeenCalledWith("event_1");
	});

	it("rethrows pending gateway usage so BullMQ retries", async () => {
		const { processor, service } = setup();
		const pending = new GatewayUsagePendingError("event_1", ["gen_1"]);
		service.reconcile.mockRejectedValueOnce(pending);

		await expect(
			processor.process(
				job(METERING_RECONCILE_EVENT_JOB, { eventId: "event_1" }),
			),
		).rejects.toBe(pending);
		expect(service.terminalizeReconciliationFailure).not.toHaveBeenCalled();
	});

	it("terminalizes pending gateway usage on the final BullMQ attempt", async () => {
		const { processor, service } = setup();
		const pending = new GatewayUsagePendingError("event_1", ["gen_1"]);
		service.reconcile.mockRejectedValueOnce(pending);

		await expect(
			processor.process(
				job(
					METERING_RECONCILE_EVENT_JOB,
					{ eventId: "event_1" },
					{ attempts: 8, attemptsMade: 7 },
				),
			),
		).resolves.toEqual({ eventId: "event_1", status: "reconcile_failed" });
		expect(service.terminalizeReconciliationFailure).toHaveBeenCalledWith(
			"event_1",
		);
	});

	it("durably terminalizes a non-pending reconciliation failure", async () => {
		const { processor, service } = setup();
		service.reconcile.mockRejectedValueOnce(new Error("bad provider payload"));

		await expect(
			processor.process(
				job(METERING_RECONCILE_EVENT_JOB, { eventId: "event_1" }),
			),
		).resolves.toEqual({ eventId: "event_1", status: "reconcile_failed" });
		expect(service.terminalizeReconciliationFailure).toHaveBeenCalledWith(
			"event_1",
		);
	});
});

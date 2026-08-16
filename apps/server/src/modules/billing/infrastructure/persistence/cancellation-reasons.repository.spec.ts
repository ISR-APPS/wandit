import { cancellationReasons } from "@wandit/db/schema/cancellation-reasons";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	type CancellationReasonRow,
	CancellationReasonsRepository,
} from "./cancellation-reasons.repository";

const REASON_ID = "55555555-5555-4555-8555-555555555555";

function cancellationReasonRow(
	overrides: Partial<CancellationReasonRow> = {},
): CancellationReasonRow {
	return {
		createdAt: new Date("2026-08-16T10:00:00.000Z"),
		details: null,
		endedStateEventId: null,
		id: REASON_ID,
		organizationId: null,
		reason: "too_expensive",
		status: "pending",
		stripeSubscriptionId: "sub_1",
		submittedByUserId: "user_1",
		subscriptionId: "22222222-2222-4222-8222-222222222222",
		subscriptionUserId: "user_1",
		updatedAt: new Date("2026-08-16T10:00:00.000Z"),
		...overrides,
	};
}

describe("CancellationReasonsRepository", () => {
	it("inserts a pending cancellation cycle and returns its generated row", async () => {
		const row = cancellationReasonRow();
		const returning = vi.fn(async () => [row]);
		const values = vi.fn(() => ({ returning }));
		const insert = vi.fn(() => ({ values }));
		const repository = new CancellationReasonsRepository({
			insert,
		} as unknown as Database);
		const input = {
			details: null,
			organizationId: null,
			reason: "too_expensive" as const,
			stripeSubscriptionId: "sub_1",
			submittedByUserId: "user_1",
			subscriptionId: "22222222-2222-4222-8222-222222222222",
			subscriptionUserId: "user_1",
		};

		await expect(repository.createPending(input)).resolves.toEqual(row);
		expect(insert).toHaveBeenCalledWith(cancellationReasons);
		expect(values).toHaveBeenCalledWith({ ...input, status: "pending" });
	});

	it("only transitions the identified pending cycle to a provider outcome", async () => {
		const returning = vi.fn(async () => [{ id: REASON_ID }]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const repository = new CancellationReasonsRepository({
			update,
		} as unknown as Database);

		await expect(
			repository.markPendingOutcome(REASON_ID, "provider_failed"),
		).resolves.toBe(true);
		expect(update).toHaveBeenCalledWith(cancellationReasons);
		expect(set).toHaveBeenCalledWith({
			status: "provider_failed",
			updatedAt: expect.any(Date),
		});
		expect(where).toHaveBeenCalledOnce();
	});

	it("locks the subscription and resumes only its newest scheduled cycle", async () => {
		const harness = transitionHarness([{ id: REASON_ID }]);
		const repository = new CancellationReasonsRepository(
			harness.db as unknown as Database,
		);

		await expect(repository.markNewestScheduledResumed("sub_1")).resolves.toBe(
			true,
		);
		expect(harness.execute).toHaveBeenCalledOnce();
		expect(harness.from).toHaveBeenCalledWith(cancellationReasons);
		expect(harness.orderBy).toHaveBeenCalledOnce();
		expect(harness.orderBy.mock.calls[0]).toHaveLength(2);
		expect(harness.limit).toHaveBeenCalledWith(1);
		expect(harness.forUpdate).toHaveBeenCalledWith("update");
		expect(harness.set).toHaveBeenCalledWith({
			endedStateEventId: null,
			status: "resumed",
			updatedAt: expect.any(Date),
		});
	});

	it("links the newest scheduled or pending cycle to the exact ended event", async () => {
		const harness = transitionHarness([{ id: REASON_ID }]);
		const repository = new CancellationReasonsRepository(
			harness.db as unknown as Database,
		);
		const endedStateEventId = "66666666-6666-4666-8666-666666666666";

		await expect(
			repository.linkNewestOpenToEnded("sub_1", endedStateEventId),
		).resolves.toBe(true);
		expect(harness.set).toHaveBeenCalledWith({
			endedStateEventId,
			status: "ended",
			updatedAt: expect.any(Date),
		});
	});

	it("leaves history unchanged when there is no open cycle", async () => {
		const harness = transitionHarness([]);
		const repository = new CancellationReasonsRepository(
			harness.db as unknown as Database,
		);

		await expect(
			repository.linkNewestOpenToEnded(
				"sub_without_cycle",
				"66666666-6666-4666-8666-666666666666",
			),
		).resolves.toBe(false);
		expect(harness.update).not.toHaveBeenCalled();
	});
});

function transitionHarness(candidates: Array<{ id: string }>) {
	const execute = vi.fn(async () => undefined);
	const forUpdate = vi.fn(async () => candidates);
	const limit = vi.fn(() => ({ for: forUpdate }));
	const orderBy = vi.fn(() => ({ limit }));
	const selectWhere = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where: selectWhere }));
	const select = vi.fn(() => ({ from }));
	const returning = vi.fn(async () => [{ id: REASON_ID }]);
	const updateWhere = vi.fn(() => ({ returning }));
	const set = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set }));
	const tx = { execute, select, update };
	const transaction = vi.fn(
		async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
	);

	return {
		db: { transaction },
		execute,
		forUpdate,
		from,
		limit,
		orderBy,
		set,
		update,
	};
}

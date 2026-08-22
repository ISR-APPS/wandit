import { describe, expect, it, vi } from "vitest";

import type {
	FinancialReconciliationOutboxRepository,
	FinancialReconciliationOutboxRow,
} from "../../infrastructure/persistence/financial-reconciliation-outbox.repository";
import { FinancialReconciliationService } from "./financial-reconciliation.service";
import type { PaymentRefundsService } from "./payment-refunds.service";

class InMemoryOutboxRepository {
	readonly rows: FinancialReconciliationOutboxRow[] = [];

	async enqueue(input: { chargeId: string; triggerRef: string }) {
		const duplicate = this.rows.find(
			(row) =>
				row.chargeId === input.chargeId && row.triggerRef === input.triggerRef,
		);

		if (duplicate) {
			return null;
		}

		const row: FinancialReconciliationOutboxRow = {
			attempts: 0,
			chargeId: input.chargeId,
			createdAt: new Date(this.rows.length * 1000),
			doneAt: null,
			id: `outbox_${this.rows.length + 1}`,
			lastError: null,
			status: "pending",
			triggerRef: input.triggerRef,
		};
		this.rows.push(row);

		return row;
	}

	async listPending(limit: number) {
		return this.rows
			.filter((row) => row.status === "pending")
			.sort((left, right) => left.attempts - right.attempts)
			.slice(0, limit);
	}

	async markDoneForCharge(chargeId: string) {
		let count = 0;

		for (const row of this.rows) {
			if (row.chargeId === chargeId && row.status === "pending") {
				row.attempts += 1;
				row.doneAt = new Date();
				row.lastError = null;
				row.status = "done";
				count += 1;
			}
		}

		return count;
	}

	async markFailed(id: string, error: string) {
		const row = this.rows.find((candidate) => candidate.id === id);

		if (row?.status === "pending") {
			row.attempts += 1;
			row.lastError = error;
		}
	}
}

function setup() {
	const repository = new InMemoryOutboxRepository();
	const reconcileChargeAfterGrant = vi.fn(async (_chargeId: string) => {});
	const service = new FinancialReconciliationService(
		repository as unknown as FinancialReconciliationOutboxRepository,
		{ reconcileChargeAfterGrant } as unknown as PaymentRefundsService,
	);

	return { reconcileChargeAfterGrant, repository, service };
}

describe("FinancialReconciliationService", () => {
	it("dedupes (chargeId, triggerRef) and drains every pending row of a charge through one recheck", async () => {
		const { reconcileChargeAfterGrant, repository, service } = setup();
		await repository.enqueue({ chargeId: "ch_1", triggerRef: "inv:in_1" });
		await repository.enqueue({ chargeId: "ch_1", triggerRef: "inv:in_1" });
		await repository.enqueue({ chargeId: "ch_1", triggerRef: "slot:slot_1" });
		await repository.enqueue({ chargeId: "ch_2", triggerRef: "topup:cs_1" });
		expect(repository.rows).toHaveLength(3);

		await expect(service.sweep()).resolves.toEqual({ done: 3, failed: 0 });

		expect(reconcileChargeAfterGrant).toHaveBeenCalledTimes(2);
		expect(reconcileChargeAfterGrant).toHaveBeenCalledWith("ch_1");
		expect(reconcileChargeAfterGrant).toHaveBeenCalledWith("ch_2");
		expect(repository.rows.every((row) => row.status === "done")).toBe(true);
	});

	it("keeps a failed row pending with its error and attempt count, then succeeds on retry", async () => {
		const { reconcileChargeAfterGrant, repository, service } = setup();
		await repository.enqueue({ chargeId: "ch_flaky", triggerRef: "inv:in_2" });
		reconcileChargeAfterGrant.mockRejectedValueOnce(new Error("stripe down"));

		await expect(service.sweep()).resolves.toEqual({ done: 0, failed: 1 });
		expect(repository.rows[0]).toMatchObject({
			attempts: 1,
			lastError: "stripe down",
			status: "pending",
		});

		await expect(service.sweep()).resolves.toEqual({ done: 1, failed: 0 });
		expect(repository.rows[0]).toMatchObject({
			attempts: 2,
			lastError: null,
			status: "done",
		});
	});
});

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "@wandit/db";
import { billingFinancialReconciliationOutbox } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type FinancialReconciliationOutboxRow =
	typeof billingFinancialReconciliationOutbox.$inferSelect;

type FinancialReconciliationOutboxClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

@Injectable()
export class FinancialReconciliationOutboxRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Idempotent on (chargeId, triggerRef): a replayed grant re-enqueues the
	 * same row, and a row already marked done stays done.
	 */
	async enqueue(
		input: { chargeId: string; triggerRef: string },
		client: FinancialReconciliationOutboxClient = this.db,
	): Promise<FinancialReconciliationOutboxRow | null> {
		const [row] = await client
			.insert(billingFinancialReconciliationOutbox)
			.values({ chargeId: input.chargeId, triggerRef: input.triggerRef })
			.onConflictDoNothing({
				target: [
					billingFinancialReconciliationOutbox.chargeId,
					billingFinancialReconciliationOutbox.triggerRef,
				],
			})
			.returning();

		return row ?? null;
	}

	listPending(
		limit: number,
		client: FinancialReconciliationOutboxClient = this.db,
	): Promise<FinancialReconciliationOutboxRow[]> {
		return client
			.select()
			.from(billingFinancialReconciliationOutbox)
			.where(eq(billingFinancialReconciliationOutbox.status, "pending"))
			.orderBy(
				asc(billingFinancialReconciliationOutbox.attempts),
				asc(billingFinancialReconciliationOutbox.createdAt),
			)
			.limit(limit);
	}

	async markDoneForCharge(
		chargeId: string,
		client: FinancialReconciliationOutboxClient = this.db,
	): Promise<number> {
		const rows = await client
			.update(billingFinancialReconciliationOutbox)
			.set({
				attempts: sql`${billingFinancialReconciliationOutbox.attempts} + 1`,
				doneAt: new Date(),
				lastError: null,
				status: "done",
			})
			.where(
				and(
					eq(billingFinancialReconciliationOutbox.chargeId, chargeId),
					eq(billingFinancialReconciliationOutbox.status, "pending"),
				),
			)
			.returning({ id: billingFinancialReconciliationOutbox.id });

		return rows.length;
	}

	async markFailed(
		id: string,
		error: string,
		client: FinancialReconciliationOutboxClient = this.db,
	): Promise<void> {
		await client
			.update(billingFinancialReconciliationOutbox)
			.set({
				attempts: sql`${billingFinancialReconciliationOutbox.attempts} + 1`,
				lastError: error,
			})
			.where(
				and(
					eq(billingFinancialReconciliationOutbox.id, id),
					eq(billingFinancialReconciliationOutbox.status, "pending"),
				),
			);
	}
}

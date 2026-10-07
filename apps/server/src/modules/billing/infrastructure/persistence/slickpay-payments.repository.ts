/**
 * Reads and writes `slickpay_payments`, one row per SlickPay checkout.
 * SlickpayPaymentsService calls it from the checkout, the confirm route, and the sweep.
 * A status change is a compare-and-set on the current status, so two parallel refreshes cannot both win.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { SlickpayPaymentStatus } from "@wandit/contracts";
import { and, asc, eq, gte, inArray, lt, sql } from "@wandit/db";
import { slickpayPayments } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

/** One `slickpay_payments` row. amountDzd is whole DZD, and dzdPerUsdRate is centi-DZD per 1 USD. */
export type SlickpayPaymentRow = typeof slickpayPayments.$inferSelect;

/** Columns of a new row. The status starts at "created". */
export type InsertSlickpayPaymentInput = Pick<
	SlickpayPaymentRow,
	| "amountDzd"
	| "dzdPerUsdRate"
	| "interval"
	| "organizationId"
	| "plan"
	| "tierCredits"
	| "userId"
>;

/** Columns that a checkout or a refresh can write. updateIfStatus always adds updated_at. */
export type SlickpayPaymentChanges = Partial<
	Pick<
		SlickpayPaymentRow,
		| "fulfilledAt"
		| "invoiceId"
		| "lastError"
		| "paidAt"
		| "paymentUrl"
		| "status"
		| "subscriptionId"
	>
>;

type SlickpayPaymentsClient = Pick<Database, "insert" | "select" | "update">;

// The statuses that the sweep still refreshes. fulfilled and failed are final. Only confirm checks an expired row again.
const OPEN_STATUSES: SlickpayPaymentStatus[] = ["created", "pending", "paid"];

/** Drizzle access to `slickpay_payments`. Every method takes an optional transaction client. */
@Injectable()
export class SlickpayPaymentsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(
		input: InsertSlickpayPaymentInput,
		client: SlickpayPaymentsClient = this.db,
	): Promise<SlickpayPaymentRow> {
		const [row] = await client
			.insert(slickpayPayments)
			.values(input)
			.returning();

		if (!row) {
			throw new Error("SlickPay payment insert returned no row");
		}

		return row;
	}

	async findById(
		id: string,
		client: SlickpayPaymentsClient = this.db,
	): Promise<SlickpayPaymentRow | null> {
		const [row] = await client
			.select()
			.from(slickpayPayments)
			.where(eq(slickpayPayments.id, id))
			.limit(1);

		return row ?? null;
	}

	/** Checkouts that `userId` started at or after `since`, in all workspaces. The per-user limit reads it. */
	async countByUserSince(
		userId: string,
		since: Date,
		client: SlickpayPaymentsClient = this.db,
	): Promise<number> {
		const [row] = await client
			.select({ total: sql<number>`count(*)::int` })
			.from(slickpayPayments)
			.where(
				and(
					eq(slickpayPayments.userId, userId),
					gte(slickpayPayments.createdAt, since),
				),
			);

		return row?.total ?? 0;
	}

	/**
	 * Open rows (created, pending, paid), least recently written first.
	 * A refresh of a pending or paid row always writes it, so a row that fails again moves to the back.
	 * A broken row therefore cannot block newer rows.
	 */
	async listOpen(
		limit: number,
		client: SlickpayPaymentsClient = this.db,
	): Promise<SlickpayPaymentRow[]> {
		return client
			.select()
			.from(slickpayPayments)
			.where(inArray(slickpayPayments.status, OPEN_STATUSES))
			.orderBy(asc(slickpayPayments.updatedAt))
			.limit(limit);
	}

	/**
	 * Sets updated_at of a pending or expired row only when its last write is older than `writtenBefore`.
	 * Returns null when another request wrote the row later. The confirm route throttles SlickPay calls with it.
	 * One statement, so only one of many parallel requests gets the row.
	 */
	async claimInvoiceCheck(
		id: string,
		writtenBefore: Date,
		client: SlickpayPaymentsClient = this.db,
	): Promise<SlickpayPaymentRow | null> {
		const [row] = await client
			.update(slickpayPayments)
			.set({ updatedAt: new Date() })
			.where(
				and(
					eq(slickpayPayments.id, id),
					// The buyer can pay after the expiry, so confirm also asks SlickPay about an expired row.
					inArray(slickpayPayments.status, ["pending", "expired"]),
					lt(slickpayPayments.updatedAt, writtenBefore),
				),
			)
			.returning();

		return row ?? null;
	}

	/**
	 * Writes `changes` only while the row has status `from`, and always sets updated_at.
	 * Returns null when the row has another status: a parallel refresh moved it first.
	 */
	async updateIfStatus(
		id: string,
		from: SlickpayPaymentStatus,
		changes: SlickpayPaymentChanges,
		client: SlickpayPaymentsClient = this.db,
	): Promise<SlickpayPaymentRow | null> {
		const [row] = await client
			.update(slickpayPayments)
			.set({ ...changes, updatedAt: new Date() })
			.where(
				and(eq(slickpayPayments.id, id), eq(slickpayPayments.status, from)),
			)
			.returning();

		return row ?? null;
	}
}

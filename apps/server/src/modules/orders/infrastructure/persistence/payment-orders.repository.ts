import { Inject, Injectable } from "@nestjs/common";
import type { PaymentOrderKind, PaymentOrderStatus } from "@wandit/contracts";
import { and, eq, inArray, sql } from "@wandit/db";
import { paymentOrders } from "@wandit/db/schema/orders";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { OrderNotFoundError } from "../../domain/errors/payment-order.errors";
import type { PaymentOrderRow } from "../../domain/payment-order.types";

export type PaymentOrderTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type OrderDatabase = Database | PaymentOrderTransaction;

type InsertPaymentOrderInput = {
	amountCents: number;
	currency: string;
	kind: PaymentOrderKind;
	metadata: unknown;
	userId: string;
};

type PaymentStateInput = {
	paymentIntentId: string | null;
	paymentStatus: string;
	sessionId: string;
};

type PendingTerminalPaymentStateInput = {
	fulfillmentError: string | null;
	paymentIntentId: string | null;
	paymentStatus: string;
	sessionId?: string;
};

@Injectable()
export class PaymentOrdersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(input: InsertPaymentOrderInput): Promise<PaymentOrderRow> {
		const [row] = await this.db
			.insert(paymentOrders)
			.values({
				...input,
				provider: "stripe",
				status: "pending",
			})
			.returning();

		return this.expectWrite(row);
	}

	async findById(id: string): Promise<PaymentOrderRow | null> {
		const [row] = await this.db
			.select()
			.from(paymentOrders)
			.where(eq(paymentOrders.id, id))
			.limit(1);

		return row ?? null;
	}

	async findByIdForUser(id: string, userId: string): Promise<PaymentOrderRow> {
		const [row] = await this.db
			.select()
			.from(paymentOrders)
			.where(and(eq(paymentOrders.id, id), eq(paymentOrders.userId, userId)))
			.limit(1);

		return this.expectFound(row);
	}

	async findBySessionId(sessionId: string): Promise<PaymentOrderRow | null> {
		const [row] = await this.db
			.select()
			.from(paymentOrders)
			.where(eq(paymentOrders.providerCheckoutSessionId, sessionId))
			.limit(1);

		return row ?? null;
	}

	async findBySessionIdForUser(
		sessionId: string,
		userId: string,
	): Promise<PaymentOrderRow> {
		const [row] = await this.db
			.select()
			.from(paymentOrders)
			.where(
				and(
					eq(paymentOrders.providerCheckoutSessionId, sessionId),
					eq(paymentOrders.userId, userId),
				),
			)
			.limit(1);

		return this.expectFound(row);
	}

	async findByPaymentIntentId(
		paymentIntentId: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.select()
			.from(paymentOrders)
			.where(eq(paymentOrders.providerPaymentIntentId, paymentIntentId))
			.limit(1);

		return row ?? null;
	}

	async findByProviderRefundId(
		providerRefundId: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.select()
			.from(paymentOrders)
			.where(eq(paymentOrders.providerRefundId, providerRefundId))
			.limit(1);

		return row ?? null;
	}

	async withLockedById<T>(
		id: string,
		operation: (
			order: PaymentOrderRow,
			tx: PaymentOrderTransaction,
		) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			const [row] = await tx
				.select()
				.from(paymentOrders)
				.where(eq(paymentOrders.id, id))
				.limit(1)
				.for("update");

			return operation(this.expectFound(row), tx);
		});
	}

	async withOrderFulfillmentFence<T>(
		orderId: string,
		operation: (
			order: PaymentOrderRow,
			tx: PaymentOrderTransaction,
		) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('domain-order:' || ${orderId}::text))`,
			);
			const [row] = await tx
				.select()
				.from(paymentOrders)
				.where(eq(paymentOrders.id, orderId))
				.limit(1)
				.for("update");

			return operation(this.expectFound(row), tx);
		});
	}

	async withLockedByPaymentIntent<T>(
		paymentIntentId: string,
		operation: (
			order: PaymentOrderRow,
			tx: PaymentOrderTransaction,
		) => Promise<T>,
	): Promise<T | null> {
		return this.db.transaction(async (tx) => {
			const [candidate] = await tx
				.select({ id: paymentOrders.id })
				.from(paymentOrders)
				.where(eq(paymentOrders.providerPaymentIntentId, paymentIntentId))
				.limit(1);

			if (!candidate) {
				return null;
			}

			/*
			 * Match domain creation's lock order: domain-order advisory lock first,
			 * then the payment-order row. This makes refund-vs-fulfillment races
			 * deterministic without an order-row/advisory-lock deadlock.
			 */
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('domain-order:' || ${candidate.id}::text))`,
			);
			const [row] = await tx
				.select()
				.from(paymentOrders)
				.where(eq(paymentOrders.id, candidate.id))
				.limit(1)
				.for("update");

			return row ? operation(row, tx) : null;
		});
	}

	async withLockedByRefundReference<T>(
		input: {
			paymentIntentId: string | null;
			providerRefundId: string;
		},
		operation: (
			order: PaymentOrderRow,
			tx: PaymentOrderTransaction,
		) => Promise<T>,
	): Promise<T | null> {
		return this.db.transaction(async (tx) => {
			const refundOrder = await this.findByProviderRefundId(
				input.providerRefundId,
				tx,
			);
			const paymentIntentOrder = input.paymentIntentId
				? await this.findByPaymentIntentId(input.paymentIntentId, tx)
				: null;

			if (
				refundOrder &&
				paymentIntentOrder &&
				refundOrder.id !== paymentIntentOrder.id
			) {
				throw new Error(
					`Stripe refund ${input.providerRefundId} and payment intent ${input.paymentIntentId} resolve to different payment orders`,
				);
			}

			const candidate = refundOrder ?? paymentIntentOrder;

			if (!candidate) {
				return null;
			}

			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('domain-order:' || ${candidate.id}::text))`,
			);
			const [row] = await tx
				.select()
				.from(paymentOrders)
				.where(eq(paymentOrders.id, candidate.id))
				.limit(1)
				.for("update");

			return row ? operation(row, tx) : null;
		});
	}

	async attachCheckoutSession(
		orderId: string,
		sessionId: string,
	): Promise<PaymentOrderRow | null> {
		const [row] = await this.db
			.update(paymentOrders)
			.set({ providerCheckoutSessionId: sessionId })
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.status, "pending"),
					sql`(${paymentOrders.providerCheckoutSessionId} IS NULL OR ${paymentOrders.providerCheckoutSessionId} = ${sessionId})`,
				),
			)
			.returning();

		return row ?? null;
	}

	async recordPaymentState(
		orderId: string,
		input: PaymentStateInput,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				...(input.paymentIntentId
					? { providerPaymentIntentId: input.paymentIntentId }
					: {}),
				providerCheckoutSessionId: input.sessionId,
				providerPaymentStatus: input.paymentStatus,
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					inArray(paymentOrders.status, [
						"pending",
						"paid",
						"fulfilling",
						"fulfilled",
						"failed",
					]),
				),
			)
			.returning();

		return row ?? null;
	}

	async markPendingTerminal(
		orderId: string,
		status: Extract<PaymentOrderStatus, "canceled" | "failed">,
		input: PendingTerminalPaymentStateInput,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				fulfillmentError: input.fulfillmentError,
				...(input.paymentIntentId
					? { providerPaymentIntentId: input.paymentIntentId }
					: {}),
				providerPaymentStatus: input.paymentStatus,
				...(input.sessionId
					? { providerCheckoutSessionId: input.sessionId }
					: {}),
				status,
			})
			.where(
				and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "pending")),
			)
			.returning();

		return row ?? null;
	}

	async markPaid(
		orderId: string,
		input: PaymentStateInput & { paymentIntentId: string },
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				paidAt: new Date(),
				providerCheckoutSessionId: input.sessionId,
				providerPaymentIntentId: input.paymentIntentId,
				providerPaymentStatus: input.paymentStatus,
				status: "paid",
			})
			.where(
				and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "pending")),
			)
			.returning();

		return row ?? null;
	}

	markFulfilling(orderId: string): Promise<PaymentOrderRow | null> {
		return this.transition(orderId, ["paid"], "fulfilling");
	}

	async markFulfilled(orderId: string): Promise<PaymentOrderRow | null> {
		const [row] = await this.db
			.update(paymentOrders)
			.set({
				fulfilledAt: new Date(),
				fulfillmentError: sql`CASE WHEN ${paymentOrders.refundStatus} = 'partial' THEN ${paymentOrders.fulfillmentError} ELSE NULL END`,
				status: "fulfilled",
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.status, "fulfilling"),
				),
			)
			.returning();

		return row ?? null;
	}

	async markFailed(
		orderId: string,
		error: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				fulfillmentError: error,
				status: "failed",
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					inArray(paymentOrders.status, ["paid", "fulfilling"]),
				),
			)
			.returning();

		return row ?? null;
	}

	markRefunded(
		orderId: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		return this.transition(
			orderId,
			["pending", "paid", "fulfilling", "fulfilled", "failed"],
			"refunded",
			db,
		);
	}

	markChargeRefunded(
		orderId: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		return this.transition(
			orderId,
			["pending", "paid", "fulfilling", "fulfilled", "failed"],
			"refunded",
			db,
		);
	}

	async recordPartialRefund(
		orderId: string,
		manualReviewNote: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				fulfillmentError: sql`CASE
					WHEN coalesce(${paymentOrders.fulfillmentError}, '') = '' THEN ${manualReviewNote}
					WHEN position(${manualReviewNote} in ${paymentOrders.fulfillmentError}) > 0 THEN ${paymentOrders.fulfillmentError}
					ELSE ${paymentOrders.fulfillmentError} || ' ' || ${manualReviewNote}
				END`,
				refundStatus: "partial",
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					sql`${paymentOrders.status} <> 'refunded'`,
					sql`coalesce(${paymentOrders.refundStatus}, '') <> 'succeeded'`,
				),
			)
			.returning();

		return row ?? null;
	}

	async recordRefundState(
		orderId: string,
		input: {
			providerRefundId: string;
			refundStatus: string | null;
		},
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set(input)
			.where(
				and(
					eq(paymentOrders.id, orderId),
					sql`(${paymentOrders.providerRefundId} IS NULL OR ${paymentOrders.providerRefundId} = ${input.providerRefundId})`,
					input.refundStatus === "succeeded"
						? undefined
						: sql`coalesce(${paymentOrders.refundStatus}, '') <> 'succeeded'`,
				),
			)
			.returning();

		return row ?? null;
	}

	async replaceRefundReferenceForFullCoverage(
		orderId: string,
		input: {
			expectedProviderRefundId: string;
			expectedRefundStatus: string;
			providerRefundId: string;
			refundStatus: "pending" | "succeeded";
		},
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				providerRefundId: input.providerRefundId,
				refundStatus: input.refundStatus,
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.providerRefundId, input.expectedProviderRefundId),
					eq(paymentOrders.refundStatus, input.expectedRefundStatus),
				),
			)
			.returning();

		return row ?? null;
	}

	async recordSucceededRefundFailure(
		orderId: string,
		input: {
			manualReviewNote: string;
			providerRefundId: string;
		},
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				fulfillmentError: sql`CASE
					WHEN coalesce(${paymentOrders.fulfillmentError}, '') = '' THEN ${input.manualReviewNote}
					WHEN position(${input.manualReviewNote} in ${paymentOrders.fulfillmentError}) > 0 THEN ${paymentOrders.fulfillmentError}
					ELSE ${paymentOrders.fulfillmentError} || ' ' || ${input.manualReviewNote}
				END`,
				refundStatus: "failed",
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.providerRefundId, input.providerRefundId),
					eq(paymentOrders.refundStatus, "succeeded"),
				),
			)
			.returning();

		return row ?? null;
	}

	async markFailedRefundSucceeded(
		orderId: string,
		providerRefundId: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				providerRefundId,
				refundStatus: "succeeded",
				status: "refunded",
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.status, "failed"),
					sql`(${paymentOrders.providerRefundId} IS NULL OR ${paymentOrders.providerRefundId} = ${providerRefundId})`,
				),
			)
			.returning();

		return row ?? null;
	}

	async recordRefundManualReview(
		orderId: string,
		input: {
			manualReviewNote: string;
			providerRefundId: string;
			refundStatus: string;
		},
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({
				fulfillmentError: input.manualReviewNote,
				providerRefundId: input.providerRefundId,
				refundStatus: input.refundStatus,
			})
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.status, "failed"),
					sql`(${paymentOrders.providerRefundId} IS NULL OR ${paymentOrders.providerRefundId} = ${input.providerRefundId})`,
					sql`coalesce(${paymentOrders.refundStatus}, '') <> 'succeeded'`,
				),
			)
			.returning();

		return row ?? null;
	}

	async recordRefundReferenceConflict(
		orderId: string,
		manualReviewNote: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({ fulfillmentError: manualReviewNote })
			.where(eq(paymentOrders.id, orderId))
			.returning();

		return row ?? null;
	}

	async recordFulfillmentError(
		orderId: string,
		error: string,
		db: OrderDatabase = this.db,
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({ fulfillmentError: error })
			.where(
				and(
					eq(paymentOrders.id, orderId),
					eq(paymentOrders.status, "refunded"),
				),
			)
			.returning();

		return row ?? null;
	}

	async recordFinancialRaceNote(
		orderId: string,
		note: string,
	): Promise<PaymentOrderRow | null> {
		const [row] = await this.db
			.update(paymentOrders)
			.set({ fulfillmentError: note })
			.where(
				and(
					eq(paymentOrders.id, orderId),
					inArray(paymentOrders.status, ["failed", "refunded"]),
				),
			)
			.returning();

		return row ?? null;
	}

	private async transition(
		orderId: string,
		from: PaymentOrderStatus[],
		to: PaymentOrderStatus,
		db: OrderDatabase = this.db,
		patch: Partial<Pick<PaymentOrderRow, "refundStatus">> = {},
	): Promise<PaymentOrderRow | null> {
		const [row] = await db
			.update(paymentOrders)
			.set({ ...patch, status: to })
			.where(
				and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, from)),
			)
			.returning();

		return row ?? null;
	}

	private expectFound(
		row: PaymentOrderRow | null | undefined,
	): PaymentOrderRow {
		if (!row) {
			throw new OrderNotFoundError();
		}

		return row;
	}

	private expectWrite(row: PaymentOrderRow | undefined): PaymentOrderRow {
		if (!row) {
			throw new Error("Payment order write did not return a row");
		}

		return row;
	}
}

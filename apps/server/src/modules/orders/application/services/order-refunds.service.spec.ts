import { describe, expect, it, vi } from "vitest";

import type {
	DomainRow,
	DomainsRepository,
} from "../../../domains/infrastructure/persistence/domains.repository";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import type { PaymentOrdersRepository } from "../../infrastructure/persistence/payment-orders.repository";
import { OrderRefundsService } from "./order-refunds.service";

const orderId = "11111111-1111-4111-8111-111111111111";
const domainId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const userId = "user_1";
const paymentIntentId = "pi_order_refund";
const chargeId = "ch_order_refund";
const now = new Date("2026-07-24T12:00:00.000Z");

class FakePaymentOrdersRepository {
	readonly rows = new Map<string, PaymentOrderRow>();
	readonly transactionClient = { kind: "order-refund-transaction" };

	readonly withLockedByPaymentIntent = vi.fn(
		async <T>(
			providerPaymentIntentId: string,
			operation: (order: PaymentOrderRow, tx: never) => Promise<T>,
		): Promise<T | null> => {
			const row = [...this.rows.values()].find(
				(candidate) =>
					candidate.providerPaymentIntentId === providerPaymentIntentId,
			);

			return row
				? operation(row, this.transactionClient as never)
				: Promise.resolve(null);
		},
	);

	readonly withLockedByRefundReference = vi.fn(
		async <T>(
			input: {
				paymentIntentId: string | null;
				providerRefundId: string;
			},
			operation: (order: PaymentOrderRow, tx: never) => Promise<T>,
		): Promise<T | null> => {
			const refundOrder = [...this.rows.values()].find(
				(candidate) => candidate.providerRefundId === input.providerRefundId,
			);
			const paymentIntentOrder = input.paymentIntentId
				? [...this.rows.values()].find(
						(candidate) =>
							candidate.providerPaymentIntentId === input.paymentIntentId,
					)
				: null;
			const row = refundOrder ?? paymentIntentOrder;

			return row
				? operation(row, this.transactionClient as never)
				: Promise.resolve(null);
		},
	);

	readonly markRefunded = vi.fn(async (id: string, _client?: unknown) => {
		const row = this.rows.get(id);

		if (
			!row ||
			!["pending", "paid", "fulfilling", "fulfilled", "failed"].includes(
				row.status,
			)
		) {
			return null;
		}

		const refunded = { ...row, status: "refunded" as const };
		this.rows.set(id, refunded);

		return refunded;
	});

	readonly markChargeRefunded = vi.fn(async (id: string, _client?: unknown) => {
		const row = this.rows.get(id);

		if (
			!row ||
			!["pending", "paid", "fulfilling", "fulfilled", "failed"].includes(
				row.status,
			)
		) {
			return null;
		}

		const refunded = {
			...row,
			status: "refunded" as const,
		};
		this.rows.set(id, refunded);

		return refunded;
	});

	readonly recordPartialRefund = vi.fn(
		async (id: string, manualReviewNote: string, _client?: unknown) => {
			const row = this.rows.get(id);

			if (
				!row ||
				row.status === "refunded" ||
				row.refundStatus === "succeeded"
			) {
				return null;
			}

			const noted = {
				...row,
				fulfillmentError: row.fulfillmentError?.includes(manualReviewNote)
					? row.fulfillmentError
					: [row.fulfillmentError, manualReviewNote]
							.filter((note): note is string => !!note)
							.join(" "),
				refundStatus: "partial",
			};
			this.rows.set(id, noted);

			return noted;
		},
	);

	readonly recordSucceededRefundFailure = vi.fn(
		async (
			id: string,
			input: {
				manualReviewNote: string;
				providerRefundId: string;
			},
			_client?: unknown,
		) => {
			const row = this.rows.get(id);

			if (
				row?.providerRefundId !== input.providerRefundId ||
				row.refundStatus !== "succeeded"
			) {
				return null;
			}

			const noted = {
				...row,
				fulfillmentError: row.fulfillmentError?.includes(input.manualReviewNote)
					? row.fulfillmentError
					: [row.fulfillmentError, input.manualReviewNote]
							.filter((note): note is string => !!note)
							.join(" "),
				refundStatus: "failed",
			};
			this.rows.set(id, noted);

			return noted;
		},
	);

	readonly recordRefundState = vi.fn(
		async (
			id: string,
			input: { providerRefundId: string; refundStatus: string | null },
			_client?: unknown,
		) => {
			const row = this.rows.get(id);

			if (
				!row ||
				(row.providerRefundId !== null &&
					row.providerRefundId !== input.providerRefundId) ||
				(row.refundStatus === "succeeded" && input.refundStatus !== "succeeded")
			) {
				return null;
			}

			const recorded = { ...row, ...input };
			this.rows.set(id, recorded);

			return recorded;
		},
	);

	readonly replaceRefundReferenceForFullCoverage = vi.fn(
		async (
			id: string,
			input: {
				expectedProviderRefundId: string;
				expectedRefundStatus: string;
				providerRefundId: string;
				refundStatus: "pending" | "succeeded";
			},
			_client?: unknown,
		) => {
			const row = this.rows.get(id);

			if (
				row?.providerRefundId !== input.expectedProviderRefundId ||
				row.refundStatus !== input.expectedRefundStatus
			) {
				return null;
			}

			const replaced = {
				...row,
				providerRefundId: input.providerRefundId,
				refundStatus: input.refundStatus,
			};
			this.rows.set(id, replaced);

			return replaced;
		},
	);

	readonly markFailedRefundSucceeded = vi.fn(
		async (id: string, providerRefundId: string, _client?: unknown) => {
			const row = this.rows.get(id);

			if (
				row?.status !== "failed" ||
				(row.providerRefundId !== null &&
					row.providerRefundId !== providerRefundId)
			) {
				return null;
			}

			const refunded = {
				...row,
				providerRefundId,
				refundStatus: "succeeded",
				status: "refunded" as const,
			};
			this.rows.set(id, refunded);

			return refunded;
		},
	);

	readonly recordRefundManualReview = vi.fn(
		async (
			id: string,
			input: {
				manualReviewNote: string;
				providerRefundId: string;
				refundStatus: string;
			},
			_client?: unknown,
		) => {
			const row = this.rows.get(id);

			if (
				row?.status !== "failed" ||
				(row.providerRefundId !== null &&
					row.providerRefundId !== input.providerRefundId) ||
				row.refundStatus === "succeeded"
			) {
				return null;
			}

			const noted = {
				...row,
				fulfillmentError: input.manualReviewNote,
				providerRefundId: input.providerRefundId,
				refundStatus: input.refundStatus,
			};
			this.rows.set(id, noted);

			return noted;
		},
	);

	readonly recordRefundReferenceConflict = vi.fn(
		async (id: string, manualReviewNote: string, _client?: unknown) => {
			const row = this.rows.get(id);

			if (!row) {
				return null;
			}

			const noted = {
				...row,
				fulfillmentError: manualReviewNote,
			};
			this.rows.set(id, noted);

			return noted;
		},
	);

	readonly recordFulfillmentError = vi.fn(
		async (id: string, error: string, _client?: unknown) => {
			const row = this.rows.get(id);

			if (row?.status !== "refunded") {
				return null;
			}

			const noted = { ...row, fulfillmentError: error };
			this.rows.set(id, noted);

			return noted;
		},
	);

	seed(overrides: Partial<PaymentOrderRow> = {}) {
		const row = paymentOrderRow(overrides);
		this.rows.set(row.id, row);

		return row;
	}
}

class FakeDomainsRepository {
	readonly rowsByOrderId = new Map<string, DomainRow>();

	readonly findByPaymentOrderIdForUpdate = vi.fn(
		async (linkedOrderId: string, _client: unknown) =>
			this.rowsByOrderId.get(linkedOrderId) ?? null,
	);

	readonly updateIfStatusOrNull = vi.fn(
		async (
			id: string,
			statuses: DomainRow["status"][],
			patch: Partial<DomainRow>,
			_client?: unknown,
		) => {
			const entry = [...this.rowsByOrderId.entries()].find(
				([, candidate]) => candidate.id === id,
			);

			if (!entry || !statuses.includes(entry[1].status)) {
				return null;
			}

			const updated = { ...entry[1], ...patch } as DomainRow;
			this.rowsByOrderId.set(entry[0], updated);

			return updated;
		},
	);

	seed(linkedOrderId: string, overrides: Partial<DomainRow> = {}) {
		const row = domainRow({
			paymentOrderId: linkedOrderId,
			...overrides,
		});
		this.rowsByOrderId.set(linkedOrderId, row);

		return row;
	}
}

function setup() {
	const orders = new FakePaymentOrdersRepository();
	const domains = new FakeDomainsRepository();
	const service = new OrderRefundsService(
		orders as unknown as PaymentOrdersRepository,
		domains as unknown as DomainsRepository,
	);

	return {
		domains,
		orders,
		service,
		transactionClient: orders.transactionClient,
	};
}

function paymentOrderRow(
	overrides: Partial<PaymentOrderRow> = {},
): PaymentOrderRow {
	return {
		amountCents: 3_000,
		createdAt: now,
		currency: "usd",
		fulfilledAt: null,
		fulfillmentError: null,
		id: orderId,
		kind: "domain_registration",
		metadata: {},
		paidAt: now,
		provider: "stripe",
		providerCheckoutSessionId: "cs_order_refund",
		providerPaymentIntentId: paymentIntentId,
		providerPaymentStatus: "paid",
		providerRefundId: null,
		refundStatus: null,
		status: "paid",
		updatedAt: now,
		userId,
		...overrides,
	};
}

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
	return {
		autoRenew: true,
		cfCustomHostnameId: "cf_order_refund",
		createdAt: now,
		dns: null,
		error: null,
		expiresAt: null,
		id: domainId,
		isPrimary: true,
		name: "refund-example.com",
		paymentOrderId: orderId,
		priceSnapshot: null,
		projectId,
		provider: "openprovider",
		providerDomainId: null,
		registrant: null,
		source: "purchased",
		status: "registering",
		tld: "com",
		updatedAt: now,
		userId,
		whoisPrivacy: true,
		...overrides,
	};
}

describe("OrderRefundsService", () => {
	it("returns false when no payment order matches the payment intent", async () => {
		const { domains, orders, service } = setup();

		await expect(
			service.markRefundedByPaymentIntent({
				chargeId,
				paymentIntentId: "pi_unmatched",
			}),
		).resolves.toBe(false);

		expect(orders.withLockedByPaymentIntent).toHaveBeenCalledWith(
			"pi_unmatched",
			expect.any(Function),
		);
		expect(domains.findByPaymentOrderIdForUpdate).not.toHaveBeenCalled();
		expect(orders.markRefunded).not.toHaveBeenCalled();
		expect(orders.markChargeRefunded).not.toHaveBeenCalled();
	});

	it("marks a matched order refunded when fulfillment has not created a domain", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ refundStatus: "succeeded", status: "paid" });

		await expect(
			service.markRefundedByPaymentIntent({ chargeId, paymentIntentId }),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.markChargeRefunded).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			refundStatus: "succeeded",
			status: "refunded",
		});
		expect(orders.recordFulfillmentError).not.toHaveBeenCalled();
	});

	it("terminally refunds a matched pending order when webhooks arrive out of order", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({
			paidAt: null,
			refundStatus: "succeeded",
			status: "pending",
		});

		await expect(
			service.markRefundedByPaymentIntent({ chargeId, paymentIntentId }),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.markChargeRefunded).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
	});

	it.each([
		"registering",
		"configuring",
	] as const)("fences a %s domain in the same transaction before acknowledging the refund", async (status) => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ refundStatus: "succeeded", status: "fulfilling" });
		domains.seed(orderId, { status });

		await expect(
			service.markRefundedByPaymentIntent({ chargeId, paymentIntentId }),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(domains.updateIfStatusOrNull).toHaveBeenCalledWith(
			domainId,
			["registering", "configuring"],
			{
				error: "Payment was refunded before domain fulfillment completed",
				isPrimary: false,
				status: "failed",
			},
			transactionClient,
		);
		expect(domains.rowsByOrderId.get(orderId)).toMatchObject({
			error: "Payment was refunded before domain fulfillment completed",
			isPrimary: false,
			status: "failed",
		});
		expect(orders.markChargeRefunded).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
	});

	it("records a dispute-specific fence note for a non-active domain", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ status: "fulfilling" });
		domains.seed(orderId, { status: "configuring" });

		await expect(
			service.markRefundedByPaymentIntent({
				chargeId,
				cause: "dispute",
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(domains.updateIfStatusOrNull).toHaveBeenCalledWith(
			domainId,
			["registering", "configuring"],
			{
				error: "Payment was disputed before domain fulfillment completed",
				isPrimary: false,
				status: "failed",
			},
			transactionClient,
		);
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
	});

	it("records a partial order refund for manual review without fencing or terminalizing fulfillment", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ status: "fulfilling" });
		const registeringDomain = domains.seed(orderId, { status: "registering" });
		const domainSnapshot = { ...registeringDomain };
		const loggerError = vi
			.spyOn(
				(
					service as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 1,
				chargeId,
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).not.toHaveBeenCalled();
		expect(domains.updateIfStatusOrNull).not.toHaveBeenCalled();
		expect(domains.rowsByOrderId.get(orderId)).toEqual(domainSnapshot);
		expect(orders.markRefunded).not.toHaveBeenCalled();
		expect(orders.markChargeRefunded).not.toHaveBeenCalled();
		expect(orders.recordPartialRefund).toHaveBeenCalledWith(
			orderId,
			expect.stringContaining("partial refund"),
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringContaining("Manual review required"),
			refundStatus: "partial",
			status: "fulfilling",
		});
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining("partially refunded"),
			expect.stringContaining('"amountRefunded":1'),
		);
		loggerError.mockRestore();
	});

	it("appends the partial-refund note to an existing registrar diagnostic", async () => {
		const { orders, service } = setup();
		orders.seed({
			fulfillmentError: "Registrar rejected contact handle OP-409",
			status: "failed",
		});

		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 500,
				chargeId,
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringMatching(
				/Registrar rejected contact handle OP-409.*partial refund/,
			),
			refundStatus: "partial",
			status: "failed",
		});
	});

	it("records a full charge refund as succeeded and applies the terminal fence", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ refundStatus: "succeeded", status: "fulfilling" });
		domains.seed(orderId, { status: "registering" });

		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 3_000,
				chargeId,
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.markChargeRefunded).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			refundStatus: "succeeded",
			status: "refunded",
		});
	});

	it("refuses to terminalize a full charge while its recorded refund is pending", async () => {
		const { domains, orders, service } = setup();
		orders.seed({
			providerRefundId: "re_pending_full",
			refundStatus: "pending",
			status: "fulfilling",
		});

		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 3_000,
				chargeId,
				paymentIntentId,
			}),
		).rejects.toThrow("with refund status pending");

		expect(domains.findByPaymentOrderIdForUpdate).not.toHaveBeenCalled();
		expect(orders.markChargeRefunded).not.toHaveBeenCalled();
		expect(orders.rows.get(orderId)).toMatchObject({
			refundStatus: "pending",
			status: "fulfilling",
		});
	});

	it("alarms and records failed when a matching refund fails after recorded success", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({
			fulfillmentError: "Registration failed",
			status: "failed",
		});
		domains.seed(orderId, { status: "registering" });

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_pending",
				refundStatus: "requires_action",
			}),
		).resolves.toBe(true);

		expect(orders.recordRefundState).toHaveBeenCalledWith(
			orderId,
			{
				providerRefundId: "re_pending",
				refundStatus: "requires_action",
			},
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_pending",
			refundStatus: "requires_action",
			status: "failed",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_pending",
				refundStatus: "succeeded",
			}),
		).resolves.toBe(true);

		expect(orders.markFailedRefundSucceeded).toHaveBeenCalledWith(
			orderId,
			"re_pending",
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_pending",
			refundStatus: "succeeded",
			status: "refunded",
		});
		expect(domains.rowsByOrderId.get(orderId)).toMatchObject({
			error: "Payment was refunded before domain fulfillment completed",
			status: "failed",
		});
		const loggerError = vi
			.spyOn(
				(
					service as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_pending",
				refundStatus: "failed",
			}),
		).resolves.toBe(true);
		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringMatching(
				/Registration failed.*Manual review required/,
			),
			providerRefundId: "re_pending",
			refundStatus: "failed",
			status: "refunded",
		});
		expect(orders.recordSucceededRefundFailure).toHaveBeenCalledWith(
			orderId,
			{
				manualReviewNote: expect.stringContaining(
					"recorded as succeeded and later reported failed",
				),
				providerRefundId: "re_pending",
			},
			transactionClient,
		);
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining("later reported failed"),
			expect.stringContaining('"refundStatus":"failed"'),
		);
		loggerError.mockRestore();
	});

	it("normalizes a matching succeeded-to-canceled refund reversal to failed without reopening the order", async () => {
		const { orders, service, transactionClient } = setup();
		orders.seed({
			fulfillmentError: "Original registrar diagnostic",
			providerRefundId: "re_canceled_late",
			refundStatus: "succeeded",
			status: "refunded",
		});
		const loggerError = vi
			.spyOn(
				(
					service as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_canceled_late",
				refundStatus: "canceled",
			}),
		).resolves.toBe(true);
		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_canceled_late",
				refundStatus: "canceled",
			}),
		).resolves.toBe(true);

		expect(orders.recordSucceededRefundFailure).toHaveBeenCalledWith(
			orderId,
			{
				manualReviewNote: expect.stringContaining(
					"recorded as succeeded and later reported canceled",
				),
				providerRefundId: "re_canceled_late",
			},
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringMatching(
				/Original registrar diagnostic.*Manual review required/,
			),
			refundStatus: "failed",
			status: "refunded",
		});
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining("later reported canceled"),
			expect.stringContaining('"refundStatus":"canceled"'),
		);
		loggerError.mockRestore();
	});

	it("retains succeeded against a stale nonterminal refund downgrade", async () => {
		const { orders, service } = setup();
		orders.seed({
			providerRefundId: "re_succeeded",
			refundStatus: "succeeded",
			status: "refunded",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_succeeded",
				refundStatus: "pending",
			}),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_succeeded",
			refundStatus: "succeeded",
			status: "refunded",
		});
		expect(orders.recordRefundState).not.toHaveBeenCalled();
		expect(orders.recordSucceededRefundFailure).not.toHaveBeenCalled();
	});

	it("keeps a manual-review refund failure latched against stale succeeded signals", async () => {
		const { domains, orders, service } = setup();
		orders.seed({
			fulfillmentError: "Manual review required: refund failed after success",
			providerRefundId: "re_failed_after_success",
			refundStatus: "failed",
			status: "refunded",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_failed_after_success",
				refundStatus: "succeeded",
			}),
		).resolves.toBe(true);
		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_stale_different_refund",
				refundStatus: "succeeded",
			}),
		).resolves.toBe(true);
		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 3_000,
				chargeId,
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringMatching(
				/Manual review required: refund failed after success.*re_stale_different_refund/,
			),
			providerRefundId: "re_failed_after_success",
			refundStatus: "failed",
			status: "refunded",
		});
		expect(orders.recordRefundState).not.toHaveBeenCalled();
		expect(orders.recordRefundReferenceConflict).toHaveBeenCalled();
		expect(orders.markChargeRefunded).not.toHaveBeenCalled();
		expect(domains.findByPaymentOrderIdForUpdate).not.toHaveBeenCalled();
	});

	it("acknowledges additional partial refund ids without overwriting the tracked refund", async () => {
		const { orders, service } = setup();
		orders.seed({ status: "fulfilling" });

		await service.handleChargeRefundedByPaymentIntent({
			amountCaptured: 3_000,
			amountRefunded: 500,
			chargeId,
			paymentIntentId,
		});
		await service.updateRefundStatus({
			paymentIntentId,
			providerRefundId: "re_partial_1",
			refundStatus: "partial",
		});
		await service.handleChargeRefundedByPaymentIntent({
			amountCaptured: 3_000,
			amountRefunded: 1_000,
			chargeId,
			paymentIntentId,
		});
		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_partial_2",
				refundStatus: "partial",
			}),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringContaining("re_partial_2"),
			providerRefundId: "re_partial_1",
			refundStatus: "partial",
			status: "fulfilling",
		});
		expect(orders.recordRefundReferenceConflict).toHaveBeenCalled();
	});

	it("hands a succeeded partial refund reference to the unresolved refund that completes full coverage", async () => {
		const { orders, service, transactionClient } = setup();
		orders.seed({ status: "fulfilling" });

		await service.handleChargeRefundedByPaymentIntent({
			amountCaptured: 3_000,
			amountRefunded: 1_000,
			chargeId,
			paymentIntentId,
		});
		await service.updateRefundStatus({
			paymentIntentId,
			providerRefundId: "re_succeeded_partial",
			refundStatus: "partial",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_pending_remainder",
				refundStatus: "pending",
			}),
		).resolves.toBe(true);

		expect(orders.replaceRefundReferenceForFullCoverage).toHaveBeenCalledWith(
			orderId,
			{
				expectedProviderRefundId: "re_succeeded_partial",
				expectedRefundStatus: "partial",
				providerRefundId: "re_pending_remainder",
				refundStatus: "pending",
			},
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_pending_remainder",
			refundStatus: "pending",
			status: "fulfilling",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId: null,
				providerRefundId: "re_pending_remainder",
				refundStatus: "requires_action",
			}),
		).resolves.toBe(true);
		expect(orders.recordRefundReferenceConflict).not.toHaveBeenCalled();
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_pending_remainder",
			refundStatus: "requires_action",
		});
	});

	it.each([
		"pending",
		"failed",
	] as const)("replaces a %s tracked refund with the actual succeeded covering refund before terminalizing", async (trackedRefundStatus) => {
		const { orders, service, transactionClient } = setup();
		orders.seed({
			fulfillmentError: `Refund re_old was ${trackedRefundStatus}`,
			providerRefundId: "re_old",
			refundStatus: trackedRefundStatus,
			status: "failed",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_covering_succeeded",
				refundStatus: "succeeded",
			}),
		).resolves.toBe(true);

		expect(orders.replaceRefundReferenceForFullCoverage).toHaveBeenCalledWith(
			orderId,
			{
				expectedProviderRefundId: "re_old",
				expectedRefundStatus: trackedRefundStatus,
				providerRefundId: "re_covering_succeeded",
				refundStatus: "succeeded",
			},
			transactionClient,
		);
		expect(orders.markFailedRefundSucceeded).toHaveBeenCalledWith(
			orderId,
			"re_covering_succeeded",
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_covering_succeeded",
			refundStatus: "succeeded",
			status: "refunded",
		});

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_old",
				refundStatus: "failed",
			}),
		).resolves.toBe(true);
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_covering_succeeded",
			refundStatus: "succeeded",
			status: "refunded",
		});
	});

	it.each([
		"failed",
		"canceled",
	] as const)("keeps an order failed and records a loud manual-review note when a refund is %s", async (refundStatus) => {
		const { orders, service } = setup();
		orders.seed({ status: "failed" });
		const loggerError = vi
			.spyOn(
				(
					service as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: `re_${refundStatus}`,
				refundStatus,
			}),
		).resolves.toBe(true);

		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringContaining("Manual review required"),
			providerRefundId: `re_${refundStatus}`,
			refundStatus,
			status: "failed",
		});
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining(`reached ${refundStatus}`),
			expect.stringContaining(`"refundStatus":"${refundStatus}"`),
		);
		loggerError.mockRestore();
	});

	it("records a succeeded Refund object without auto-transitioning a non-failed order", async () => {
		const { orders, service } = setup();
		orders.seed({ status: "fulfilling" });

		await expect(
			service.updateRefundStatus({
				paymentIntentId,
				providerRefundId: "re_unexpected",
				refundStatus: "succeeded",
			}),
		).resolves.toBe(true);

		expect(orders.markFailedRefundSucceeded).not.toHaveBeenCalled();
		expect(orders.rows.get(orderId)).toMatchObject({
			providerRefundId: "re_unexpected",
			refundStatus: "succeeded",
			status: "fulfilling",
		});
	});

	it("still applies the full-charge fence after a succeeded Refund event arrived first", async () => {
		const { domains, orders, service } = setup();
		orders.seed({ status: "fulfilling" });
		domains.seed(orderId, { status: "registering" });
		vi.spyOn(
			(
				service as unknown as {
					logger: { error: (...args: unknown[]) => void };
				}
			).logger,
			"error",
		).mockImplementation(() => undefined);

		await service.updateRefundStatus({
			paymentIntentId,
			providerRefundId: "re_full_first",
			refundStatus: "succeeded",
		});
		await expect(
			service.handleChargeRefundedByPaymentIntent({
				amountCaptured: 3_000,
				amountRefunded: 3_000,
				chargeId,
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(domains.rowsByOrderId.get(orderId)).toMatchObject({
			status: "failed",
		});
		expect(orders.rows.get(orderId)).toMatchObject({
			refundStatus: "succeeded",
			status: "refunded",
		});
	});

	it.each([
		{ cause: undefined, reversal: "refunded" },
		{ cause: "dispute" as const, reversal: "disputed" },
	])("leaves an active domain untouched after it is $reversal and records a loud manual-review note", async ({
		cause,
		reversal,
	}) => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({
			fulfilledAt: now,
			...(cause ? {} : { refundStatus: "succeeded" }),
			status: "fulfilled",
		});
		const activeDomain = domains.seed(orderId, {
			error: null,
			providerDomainId: "op_active_domain",
			status: "active",
		});
		const activeSnapshot = { ...activeDomain };
		const loggerError = vi
			.spyOn(
				(
					service as unknown as {
						logger: { error: (...args: unknown[]) => void };
					}
				).logger,
				"error",
			)
			.mockImplementation(() => undefined);

		await expect(
			service.markRefundedByPaymentIntent({
				chargeId,
				...(cause ? { cause } : {}),
				paymentIntentId,
			}),
		).resolves.toBe(true);

		expect(domains.rowsByOrderId.get(orderId)).toEqual(activeSnapshot);
		expect(domains.updateIfStatusOrNull).not.toHaveBeenCalled();
		if (cause) {
			expect(orders.markRefunded).toHaveBeenCalledWith(
				orderId,
				transactionClient,
			);
		} else {
			expect(orders.markChargeRefunded).toHaveBeenCalledWith(
				orderId,
				transactionClient,
			);
		}
		expect(orders.recordFulfillmentError).toHaveBeenCalledWith(
			orderId,
			expect.stringContaining(`was ${reversal}`),
			transactionClient,
		);
		expect(orders.rows.get(orderId)).toMatchObject({
			fulfillmentError: expect.stringContaining(chargeId),
			status: "refunded",
		});
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining(`was ${reversal}`),
			expect.stringContaining(`"domainId":"${domainId}"`),
		);
		loggerError.mockRestore();
	});

	it("replays an already-refunded order while still fencing its non-active domain", async () => {
		const { domains, orders, service, transactionClient } = setup();
		orders.seed({ refundStatus: "succeeded", status: "refunded" });
		domains.seed(orderId, { status: "configuring" });

		await expect(
			service.markRefundedByPaymentIntent({ chargeId, paymentIntentId }),
		).resolves.toBe(true);

		expect(domains.findByPaymentOrderIdForUpdate).toHaveBeenCalledWith(
			orderId,
			transactionClient,
		);
		expect(domains.updateIfStatusOrNull).toHaveBeenCalledWith(
			domainId,
			["registering", "configuring"],
			expect.objectContaining({ status: "failed" }),
			transactionClient,
		);
		expect(domains.rowsByOrderId.get(orderId)?.status).toBe("failed");
		expect(orders.markRefunded).not.toHaveBeenCalled();
		expect(orders.markChargeRefunded).not.toHaveBeenCalled();
		expect(orders.recordFulfillmentError).not.toHaveBeenCalled();
		expect(orders.rows.get(orderId)?.status).toBe("refunded");
	});
});

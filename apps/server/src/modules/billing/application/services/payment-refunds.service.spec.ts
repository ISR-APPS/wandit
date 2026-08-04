import type { CreditBucket } from "@wandit/contracts";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import {
	type CreditOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import type { WebhookOrderRefundHandler } from "../../domain/ports/webhook-order-refund-handler.port";
import type {
	BillingCreditLedgerRepository,
	BillingCreditLedgerRow,
} from "../../infrastructure/persistence/billing-credit-ledger.repository";
import type { StripeProvider } from "../../infrastructure/stripe/stripe.provider";
import { PaymentRefundsService } from "./payment-refunds.service";

type CreditMeta = Record<string, unknown>;

type RevokeOptions = {
	bucket?: CreditBucket;
	idempotencyKey?: string;
	meta?: CreditMeta;
};

type GrantOptions = {
	bucket: CreditBucket;
	idempotencyKey?: string;
	meta?: CreditMeta;
};

type SeedRow = {
	bucket: CreditBucket;
	chargeId?: string;
	delta: number;
	idempotencyKey?: string;
	kind: "grant" | "revoke" | "topup";
	meta?: CreditMeta;
	paymentIntentId?: string;
	userId?: string;
};

class InMemoryBillingCreditLedgerRepository {
	readonly rows: BillingCreditLedgerRow[] = [];
	readonly positiveQueries: Array<{
		chargeId: string;
		paymentIntentId: string | null;
	}> = [];
	readonly revocationQueries: Array<{
		chargeId: string;
		paymentIntentId: string | null;
	}> = [];
	readonly lockCalls: string[] = [];
	readonly canceledSlotCalls: Array<{
		chargeId: string;
		transaction: unknown;
	}> = [];
	readonly ownerLockCalls: CreditOwner[] = [];
	readonly transactionClient = { kind: "charge-lock-transaction" };
	private readonly pendingSlotsByCharge = new Map<string, number>();

	private lock: Promise<void> = Promise.resolve();
	private nextId = 1;

	async withChargeLock<T>(
		chargeId: string,
		fn: (tx: object) => Promise<T>,
	): Promise<T> {
		this.lockCalls.push(chargeId);
		const previousLock = this.lock;
		let releaseLock!: () => void;

		this.lock = new Promise((resolve) => {
			releaseLock = resolve;
		});

		await previousLock;

		try {
			return await fn(this.transactionClient);
		} finally {
			releaseLock();
		}
	}

	async findPositiveRowsForPayment(input: {
		chargeId: string;
		paymentIntentId: string | null;
	}) {
		this.positiveQueries.push(input);

		return this.rows.filter(
			(row) =>
				(row.kind === "grant" || row.kind === "topup") &&
				row.delta > 0 &&
				(row.meta as CreditMeta).billingAdjustment !== "clawback_restore" &&
				this.matchesPayment(row, input),
		);
	}

	async findRevocationRowsForPayment(input: {
		chargeId: string;
		paymentIntentId: string | null;
	}) {
		this.revocationQueries.push(input);

		return this.rows.filter(
			(row) =>
				row.kind === "revoke" &&
				row.delta < 0 &&
				this.matchesPayment(row, input),
		);
	}

	async findRestorationRowsForPayment(input: {
		chargeId: string;
		paymentIntentId: string | null;
	}) {
		return this.rows.filter(
			(row) =>
				row.kind === "grant" &&
				row.delta > 0 &&
				(row.meta as CreditMeta).billingAdjustment === "clawback_restore" &&
				this.matchesPayment(row, input),
		);
	}

	async acquireOwnerLock(owner: CreditOwner, _client: unknown) {
		this.ownerLockCalls.push(owner);
	}

	async findPendingRefillSlotOwnersForCharge(
		chargeId: string,
	): Promise<CreditOwner[]> {
		return (this.pendingSlotsByCharge.get(chargeId) ?? 0) > 0
			? [userOwner("user_1")]
			: [];
	}

	async cancelPendingRefillSlotsForCharge(
		chargeId: string,
		transaction: unknown,
	) {
		this.canceledSlotCalls.push({ chargeId, transaction });
		const count = this.pendingSlotsByCharge.get(chargeId) ?? 0;
		this.pendingSlotsByCharge.set(chargeId, 0);

		return count;
	}

	seedPendingSlots(chargeId: string, count: number) {
		this.pendingSlotsByCharge.set(chargeId, count);
	}

	seed(input: SeedRow): BillingCreditLedgerRow {
		const meta = {
			...(input.meta ?? {}),
			...(input.chargeId ? { chargeId: input.chargeId } : {}),
			...(input.paymentIntentId
				? { paymentIntentId: input.paymentIntentId }
				: {}),
		};
		const row = {
			bucket: input.bucket,
			createdAt: new Date(this.nextId * 1000),
			delta: input.delta,
			id: `ledger_${this.nextId}`,
			idempotencyKey: input.idempotencyKey ?? null,
			kind: input.kind,
			meta,
			organizationId: null,
			userId: input.userId ?? "user_1",
		} as BillingCreditLedgerRow;

		this.nextId += 1;
		this.rows.push(row);

		return row;
	}

	private matchesPayment(
		row: BillingCreditLedgerRow,
		input: { chargeId: string; paymentIntentId: string | null },
	) {
		const meta = row.meta as CreditMeta;

		if (meta.chargeId === input.chargeId) {
			return true;
		}

		return (
			meta.chargeId === undefined &&
			input.paymentIntentId !== null &&
			meta.paymentIntentId === input.paymentIntentId
		);
	}
}

class InMemoryCreditsService {
	readonly grant = vi.fn(
		async (
			owner: CreditOwner,
			amount: number,
			options: GrantOptions,
			_transaction?: object,
		): Promise<BillingCreditLedgerRow> => {
			const existing = options.idempotencyKey
				? this.repository.rows.find(
						(row) => row.idempotencyKey === options.idempotencyKey,
					)
				: undefined;

			if (existing) {
				return existing;
			}

			return this.repository.seed({
				bucket: options.bucket,
				delta: amount,
				idempotencyKey: options.idempotencyKey,
				kind: "grant",
				meta: options.meta,
				userId: ownerUserId(owner),
			});
		},
	);

	readonly revoke = vi.fn(
		async (
			owner: CreditOwner,
			amount: number,
			options: RevokeOptions = {},
			_transaction?: object,
		): Promise<BillingCreditLedgerRow> => {
			const existing = options.idempotencyKey
				? this.repository.rows.find(
						(row) => row.idempotencyKey === options.idempotencyKey,
					)
				: undefined;

			if (existing) {
				return existing;
			}

			return this.repository.seed({
				bucket: options.bucket ?? "topup",
				delta: -amount,
				idempotencyKey: options.idempotencyKey,
				kind: "revoke",
				meta: options.meta,
				userId: ownerUserId(owner),
			});
		},
	);

	constructor(
		private readonly repository: InMemoryBillingCreditLedgerRepository,
	) {}
}

class FakeStripeProvider {
	private readonly charges = new Map<string, Stripe.Charge>();
	private readonly disputes = new Map<string, Stripe.Dispute[]>();
	private readonly paymentIntents = new Map<string, Stripe.PaymentIntent>();

	readonly listDisputesForCharge = vi.fn(async (chargeId: string) => {
		return this.disputes.get(chargeId) ?? [];
	});

	readonly retrieveCharge = vi.fn(async (chargeId: string) => {
		return (
			this.charges.get(chargeId) ??
			charge({
				amountCaptured: 1_000,
				amountRefunded: 0,
				id: chargeId,
				paymentIntent: `pi_${chargeId}`,
			})
		);
	});

	readonly retrievePaymentIntent = vi.fn(async (paymentIntentId: string) => {
		return (
			this.paymentIntents.get(paymentIntentId) ??
			({
				id: paymentIntentId,
				latest_charge: null,
				metadata: {},
				object: "payment_intent",
			} as Stripe.PaymentIntent)
		);
	});

	seedCharge(value: Stripe.Charge) {
		this.charges.set(value.id, value);
	}

	seedDisputes(chargeId: string, values: Stripe.Dispute[]) {
		this.disputes.set(chargeId, values);
	}

	seedPaymentIntent(value: Stripe.PaymentIntent) {
		this.paymentIntents.set(value.id, value);
	}
}

function ownerUserId(owner: CreditOwner): string {
	if (owner.type !== "user") {
		throw new Error("test expects a personal credit owner");
	}

	return owner.userId;
}

function setup(input: { orderHandled?: boolean } = {}) {
	const repository = new InMemoryBillingCreditLedgerRepository();
	const credits = new InMemoryCreditsService(repository);
	const stripe = new FakeStripeProvider();
	const orderRefundHandler: WebhookOrderRefundHandler = {
		handleChargeRefundedByPaymentIntent: vi.fn(
			async () => input.orderHandled ?? false,
		),
		markRefundedByPaymentIntent: vi.fn(async () => input.orderHandled ?? false),
		updateRefundStatus: vi.fn(async () => input.orderHandled ?? false),
	};

	const service = new PaymentRefundsService(
		repository as unknown as BillingCreditLedgerRepository,
		credits as unknown as CreditsService,
		orderRefundHandler,
		stripe as unknown as StripeProvider,
	);

	return {
		credits,
		orderRefundHandler,
		repository,
		service,
		stripe,
	};
}

function charge(input: {
	amountCaptured?: number;
	amountRefunded?: number;
	customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
	currency?: string;
	disputed?: boolean;
	id?: string;
	metadata?: Stripe.Metadata;
	paymentIntent?: string | Stripe.PaymentIntent | null;
	refunds?: Stripe.Refund[] | null;
	refundsHasMore?: boolean;
}) {
	return {
		amount_captured: input.amountCaptured ?? 2_000,
		amount_refunded: input.amountRefunded ?? 0,
		customer: input.customer ?? null,
		currency: input.currency ?? "usd",
		disputed: input.disputed ?? false,
		id: input.id ?? "ch_1",
		metadata: input.metadata ?? {},
		payment_intent:
			input.paymentIntent === undefined ? "pi_1" : input.paymentIntent,
		...(input.refunds === undefined
			? {}
			: {
					refunds:
						input.refunds === null
							? null
							: {
									data: input.refunds,
									has_more: input.refundsHasMore ?? false,
									object: "list",
									url: `/v1/charges/${input.id ?? "ch_1"}/refunds`,
								},
				}),
	} as Stripe.Charge;
}

function refund(input: {
	amount: number;
	created?: number;
	id: string;
	status: Stripe.Refund["status"];
}) {
	return {
		amount: input.amount,
		created: input.created ?? 1_700_000_000,
		id: input.id,
		object: "refund",
		status: input.status,
	} as Stripe.Refund;
}

function dispute(input: {
	amount?: number;
	charge?: string | Stripe.Charge | null;
	currency?: string;
	id?: string;
	paymentIntent?: string | Stripe.PaymentIntent | null;
	status?: string;
}) {
	return {
		amount: input.amount ?? 2_000,
		charge: input.charge === undefined ? "ch_1" : input.charge,
		currency: input.currency ?? "usd",
		id: input.id ?? "dp_1",
		payment_intent:
			input.paymentIntent === undefined ? "pi_1" : input.paymentIntent,
		status: input.status ?? "needs_response",
	} as Stripe.Dispute;
}

describe("PaymentRefundsService", () => {
	it("reconciles refund lifecycle events by refund id and payment intent", async () => {
		const { orderRefundHandler, service } = setup({ orderHandled: true });

		await expect(
			service.handleRefundUpdated({
				id: "re_pending",
				payment_intent: { id: "pi_order" } as Stripe.PaymentIntent,
				status: "requires_action",
			} as Stripe.Refund),
		).resolves.toBe(true);
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order",
			providerRefundId: "re_pending",
			refundStatus: "requires_action",
		});
	});

	it("can reconcile a non-succeeded refund event without a payment intent by its persisted refund id", async () => {
		const { orderRefundHandler, service } = setup({ orderHandled: true });

		await expect(
			service.handleRefundUpdated({
				id: "re_persisted",
				payment_intent: null,
				status: "failed",
			} as Stripe.Refund),
		).resolves.toBe(true);
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: null,
			providerRefundId: "re_persisted",
			refundStatus: "failed",
		});
	});

	it("uses the cumulative charge to keep a succeeded partial refund nonterminal", async () => {
		const { orderRefundHandler, service, stripe } = setup({
			orderHandled: true,
		});
		stripe.seedCharge(
			charge({
				amountCaptured: 2_000,
				amountRefunded: 1,
				id: "ch_partial_refund_update",
				paymentIntent: "pi_order",
			}),
		);

		await expect(
			service.handleRefundUpdated({
				charge: "ch_partial_refund_update",
				id: "re_partial",
				payment_intent: "pi_order",
				status: "succeeded",
			} as Stripe.Refund),
		).resolves.toBe(true);
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledWith({
			amountCaptured: 2_000,
			amountRefunded: 1,
			chargeId: "ch_partial_refund_update",
			paymentIntentId: "pi_order",
		});
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order",
			providerRefundId: "re_partial",
			refundStatus: "partial",
		});
	});

	it("persists succeeded only after the cumulative charge is fully refunded", async () => {
		const { orderRefundHandler, service, stripe } = setup({
			orderHandled: true,
		});
		stripe.seedCharge(
			charge({
				amountCaptured: 2_000,
				amountRefunded: 2_000,
				id: "ch_full_refund_update",
				paymentIntent: "pi_order",
			}),
		);

		await expect(
			service.handleRefundUpdated({
				amount: 2_000,
				charge: "ch_full_refund_update",
				id: "re_full",
				payment_intent: "pi_order",
				status: "succeeded",
			} as Stripe.Refund),
		).resolves.toBe(true);
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order",
			providerRefundId: "re_full",
			refundStatus: "succeeded",
		});
		expect(
			vi.mocked(orderRefundHandler.updateRefundStatus).mock
				.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(orderRefundHandler.handleChargeRefundedByPaymentIntent).mock
				.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("prefers a fresh Charge refund state over a stale succeeded Refund event for the same id", async () => {
		const { orderRefundHandler, service, stripe } = setup({
			orderHandled: true,
		});
		stripe.seedCharge(
			charge({
				amountCaptured: 2_000,
				amountRefunded: 2_000,
				id: "ch_stale_refund_event",
				paymentIntent: "pi_order",
				refunds: [
					refund({
						amount: 2_000,
						id: "re_stale_succeeded",
						status: "failed",
					}),
				],
			}),
		);

		await expect(
			service.handleRefundUpdated({
				amount: 2_000,
				charge: "ch_stale_refund_event",
				id: "re_stale_succeeded",
				payment_intent: "pi_order",
				status: "succeeded",
			} as Stripe.Refund),
		).resolves.toBe(false);

		expect(stripe.retrieveCharge).toHaveBeenCalledWith("ch_stale_refund_event");
		expect(orderRefundHandler.updateRefundStatus).not.toHaveBeenCalled();
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
	});

	it.each([
		{ providerStatus: "pending" },
		{ providerStatus: "requires_action" },
	] as const)("persists a full $providerStatus charge refund as pending without terminalizing the order", async ({
		providerStatus,
	}) => {
		const { credits, orderRefundHandler, repository, service } = setup({
			orderHandled: true,
		});

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: `ch_${providerStatus}`,
					paymentIntent: `pi_${providerStatus}`,
					refunds: [
						refund({
							amount: 1_000,
							id: `re_${providerStatus}`,
							status: providerStatus,
						}),
					],
				}),
			),
		).resolves.toBe(true);

		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: `pi_${providerStatus}`,
			providerRefundId: `re_${providerStatus}`,
			refundStatus: "pending",
		});
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
		expect(repository.lockCalls).toEqual([]);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("does not terminalize when unresolved refunds are needed to cover the captured amount", async () => {
		const { orderRefundHandler, service } = setup({ orderHandled: true });

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: "ch_mixed_refund_states",
					paymentIntent: "pi_mixed_refund_states",
					refunds: [
						refund({
							amount: 600,
							created: 10,
							id: "re_succeeded_partial",
							status: "succeeded",
						}),
						refund({
							amount: 400,
							created: 20,
							id: "re_pending_remainder",
							status: "pending",
						}),
					],
				}),
			),
		).resolves.toBe(true);

		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_mixed_refund_states",
			providerRefundId: "re_pending_remainder",
			refundStatus: "pending",
		});
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
	});

	it("refreshes an incomplete event refund list before terminalizing a full succeeded refund", async () => {
		const { orderRefundHandler, service, stripe } = setup({
			orderHandled: true,
		});
		stripe.seedCharge(
			charge({
				amountCaptured: 1_000,
				amountRefunded: 1_000,
				id: "ch_refresh_refunds",
				paymentIntent: "pi_refresh_refunds",
				refunds: [
					refund({
						amount: 1_000,
						created: 20,
						id: "re_refreshed_full",
						status: "succeeded",
					}),
				],
			}),
		);

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: "ch_refresh_refunds",
					paymentIntent: "pi_refresh_refunds",
					refunds: [
						refund({
							amount: 400,
							created: 10,
							id: "re_event_partial",
							status: "succeeded",
						}),
					],
					refundsHasMore: true,
				}),
			),
		).resolves.toBe(true);

		expect(stripe.retrieveCharge).toHaveBeenCalledWith("ch_refresh_refunds");
		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_refresh_refunds",
			providerRefundId: "re_refreshed_full",
			refundStatus: "succeeded",
		});
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledOnce();
	});

	it("keeps a full cumulative order refund retryable when refreshed succeeded amounts remain short", async () => {
		const { orderRefundHandler, service, stripe } = setup({
			orderHandled: true,
		});
		const incompleteCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 1_000,
			id: "ch_short_succeeded_refunds",
			metadata: { purpose: "order" },
			paymentIntent: "pi_short_succeeded_refunds",
			refunds: [
				refund({
					amount: 400,
					id: "re_short_succeeded",
					status: "succeeded",
				}),
			],
		});
		stripe.seedCharge(incompleteCharge);

		await expect(
			service.handleChargeRefunded(incompleteCharge),
		).rejects.toThrow(
			"Stripe order charge ch_short_succeeded_refunds has no payment order or credit grant yet",
		);

		expect(stripe.retrieveCharge).toHaveBeenCalledWith(
			"ch_short_succeeded_refunds",
		);
		expect(orderRefundHandler.updateRefundStatus).not.toHaveBeenCalled();
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
	});

	it("claws back cumulative partial refunds by delta and ignores replays or stale totals", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "topup",
			chargeId: "ch_1",
			delta: 500,
			kind: "topup",
			paymentIntentId: "pi_1",
		});

		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 2_000, amountRefunded: 500 }),
			),
		).resolves.toBe(true);
		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 2_000, amountRefunded: 1_200 }),
			),
		).resolves.toBe(true);
		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 2_000, amountRefunded: 1_200 }),
			),
		).resolves.toBe(true);
		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 2_000, amountRefunded: 500 }),
			),
		).resolves.toBe(true);

		expect(credits.revoke).toHaveBeenCalledTimes(2);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			1,
			userOwner("user_1"),
			125,
			{
				bucket: "topup",
				idempotencyKey: "refund:ch_1:500",
				meta: {
					chargeId: "ch_1",
					paymentIntentId: "pi_1",
					reason: "charge_refunded",
				},
			},
			repository.transactionClient,
		);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			2,
			userOwner("user_1"),
			175,
			{
				bucket: "topup",
				idempotencyKey: "refund:ch_1:1200",
				meta: {
					chargeId: "ch_1",
					paymentIntentId: "pi_1",
					reason: "charge_refunded",
				},
			},
			repository.transactionClient,
		);
		expect(
			repository.rows
				.filter((row) => row.kind === "revoke")
				.reduce((sum, row) => sum + Math.abs(row.delta), 0),
		).toBe(300);
	});

	it("preserves pending refill slots on a PARTIAL refund while still acking the webhook", async () => {
		// Pending slots are prepaid future months: a partial (e.g. goodwill)
		// refund must never destroy them (money-review finding). The webhook is
		// still acked because the charge is recognized via its slots.
		const { repository, service } = setup();
		repository.seedPendingSlots("ch_slots_refund", 2);

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 500,
					id: "ch_slots_refund",
					paymentIntent: "pi_slots_refund",
				}),
			),
		).resolves.toBe(true);

		expect(repository.canceledSlotCalls).toEqual([]);
	});

	it("cancels pending refill slots inside the charge lock on a FULL refund", async () => {
		const { repository, service } = setup();
		repository.seedPendingSlots("ch_slots_refund", 2);

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: "ch_slots_refund",
					paymentIntent: "pi_slots_refund",
				}),
			),
		).resolves.toBe(true);

		expect(repository.canceledSlotCalls).toEqual([
			{
				chargeId: "ch_slots_refund",
				transaction: repository.transactionClient,
			},
		]);
	});

	it("uses integer floor math and revokes from the original plan bucket", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: "ch_plan",
			delta: 333,
			kind: "grant",
			paymentIntentId: "pi_plan",
		});

		await service.handleChargeRefunded(
			charge({
				amountCaptured: 1_000,
				amountRefunded: 500,
				id: "ch_plan",
				paymentIntent: "pi_plan",
			}),
		);

		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			166,
			{
				bucket: "plan",
				idempotencyKey: "refund:ch_plan:500",
				meta: {
					chargeId: "ch_plan",
					paymentIntentId: "pi_plan",
					reason: "charge_refunded",
				},
			},
			repository.transactionClient,
		);
	});

	it("allocates rounding deterministically across anomalous mixed buckets", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: "ch_mixed",
			delta: 1,
			kind: "grant",
			paymentIntentId: "pi_mixed",
		});
		repository.seed({
			bucket: "topup",
			chargeId: "ch_mixed",
			delta: 1,
			kind: "topup",
			paymentIntentId: "pi_mixed",
		});

		await service.handleChargeRefunded(
			charge({
				amountCaptured: 2,
				amountRefunded: 1,
				id: "ch_mixed",
				paymentIntent: "pi_mixed",
			}),
		);
		await service.handleChargeRefunded(
			charge({
				amountCaptured: 2,
				amountRefunded: 2,
				id: "ch_mixed",
				paymentIntent: "pi_mixed",
			}),
		);

		expect(credits.revoke).toHaveBeenNthCalledWith(
			1,
			userOwner("user_1"),
			1,
			{
				bucket: "plan",
				idempotencyKey: "refund:ch_mixed:1:plan",
				meta: {
					chargeId: "ch_mixed",
					paymentIntentId: "pi_mixed",
					reason: "charge_refunded",
				},
			},
			repository.transactionClient,
		);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			2,
			userOwner("user_1"),
			1,
			{
				bucket: "topup",
				idempotencyKey: "refund:ch_mixed:2:topup",
				meta: {
					chargeId: "ch_mixed",
					paymentIntentId: "pi_mixed",
					reason: "charge_refunded",
				},
			},
			repository.transactionClient,
		);
	});

	it("fails loudly when a payment reference is attached to promo credits", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "promo",
			chargeId: "ch_promo_invariant",
			delta: 20,
			kind: "grant",
			paymentIntentId: "pi_promo_invariant",
		});

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 2_000,
					amountRefunded: 2_000,
					id: "ch_promo_invariant",
					paymentIntent: "pi_promo_invariant",
				}),
			),
		).rejects.toThrow("Payment-linked promo credit row");
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("falls back to legacy payment-intent rows without matching modern rows for another charge", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "topup",
			delta: 400,
			kind: "topup",
			paymentIntentId: "pi_legacy",
		});
		repository.seed({
			bucket: "topup",
			chargeId: "ch_other",
			delta: 900,
			kind: "topup",
			paymentIntentId: "pi_legacy",
		});

		await service.handleChargeRefunded(
			charge({
				amountCaptured: 1_000,
				amountRefunded: 500,
				id: "ch_legacy",
				paymentIntent: "pi_legacy",
			}),
		);

		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			200,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "refund:ch_legacy:500",
			}),
			repository.transactionClient,
		);
	});

	it("subtracts a partial refund from a later dispute and never exceeds the original grant", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "topup",
			chargeId: "ch_1",
			delta: 500,
			kind: "topup",
			paymentIntentId: "pi_1",
		});

		await service.handleChargeRefunded(
			charge({ amountCaptured: 2_000, amountRefunded: 500 }),
		);
		await service.handleChargeDisputeCreated(dispute({}));
		await service.handleChargeRefunded(
			charge({ amountCaptured: 2_000, amountRefunded: 2_000 }),
		);

		expect(credits.revoke).toHaveBeenCalledTimes(2);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			2,
			userOwner("user_1"),
			375,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "dispute:dp_1",
			}),
			repository.transactionClient,
		);
		expect(
			repository.rows
				.filter((row) => row.kind === "revoke")
				.reduce((sum, row) => sum + Math.abs(row.delta), 0),
		).toBe(500);
	});

	it("claws back a partial dispute proportionally to the captured amount", async () => {
		const { credits, repository, service } = setup();
		const disputedCharge = charge({
			amountCaptured: 1_000,
			id: "ch_partial_dispute",
			paymentIntent: "pi_partial_dispute",
		});
		repository.seed({
			bucket: "topup",
			chargeId: disputedCharge.id,
			delta: 400,
			kind: "topup",
			paymentIntentId: "pi_partial_dispute",
		});

		await expect(
			service.handleChargeDisputeCreated(
				dispute({
					amount: 250,
					charge: disputedCharge,
					id: "dp_partial",
					paymentIntent: "pi_partial_dispute",
				}),
			),
		).resolves.toBe(true);

		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			100,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "dispute:dp_partial",
			}),
			repository.transactionClient,
		);
	});

	it("cancels pending refill slots inside the charge lock for a dispute", async () => {
		const { repository, service } = setup();
		const disputedCharge = charge({
			amountCaptured: 1_000,
			id: "ch_slots_dispute",
			paymentIntent: "pi_slots_dispute",
		});
		repository.seedPendingSlots(disputedCharge.id, 3);

		await expect(
			service.handleChargeDisputeCreated(
				dispute({
					charge: disputedCharge,
					id: "dp_slots",
					paymentIntent: "pi_slots_dispute",
				}),
			),
		).resolves.toBe(true);

		expect(repository.canceledSlotCalls).toEqual([
			{
				chargeId: disputedCharge.id,
				transaction: repository.transactionClient,
			},
		]);
	});

	it("adds multiple partial disputes while capping cumulative clawback at the original grant", async () => {
		const { credits, repository, service } = setup();
		const disputedCharge = charge({
			amountCaptured: 1_000,
			id: "ch_multiple_disputes",
			paymentIntent: "pi_multiple_disputes",
		});
		repository.seed({
			bucket: "plan",
			chargeId: disputedCharge.id,
			delta: 400,
			kind: "grant",
			paymentIntentId: "pi_multiple_disputes",
		});

		for (const disputeId of ["dp_partial_1", "dp_partial_2"]) {
			await service.handleChargeDisputeCreated(
				dispute({
					amount: 750,
					charge: disputedCharge,
					id: disputeId,
					paymentIntent: "pi_multiple_disputes",
				}),
			);
		}

		expect(credits.revoke).toHaveBeenCalledTimes(2);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			1,
			userOwner("user_1"),
			300,
			expect.objectContaining({ idempotencyKey: "dispute:dp_partial_1" }),
			repository.transactionClient,
		);
		expect(credits.revoke).toHaveBeenNthCalledWith(
			2,
			userOwner("user_1"),
			100,
			expect.objectContaining({ idempotencyKey: "dispute:dp_partial_2" }),
			repository.transactionClient,
		);
		expect(
			repository.rows
				.filter((row) => row.kind === "revoke")
				.reduce((sum, row) => sum + Math.abs(row.delta), 0),
		).toBe(400);
	});

	it("restores only the excess over valid refunds when a dispute is won, idempotently", async () => {
		const { credits, repository, service, stripe } = setup();
		const freshCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 250,
			id: "ch_dispute_won",
			paymentIntent: "pi_dispute_won",
		});
		repository.seed({
			bucket: "plan",
			chargeId: freshCharge.id,
			delta: 400,
			kind: "grant",
			paymentIntentId: "pi_dispute_won",
		});
		repository.seed({
			bucket: "plan",
			chargeId: freshCharge.id,
			delta: -400,
			kind: "revoke",
			paymentIntentId: "pi_dispute_won",
		});
		stripe.seedCharge(freshCharge);
		stripe.seedDisputes(freshCharge.id, [
			dispute({
				charge: freshCharge.id,
				id: "dp_won_restore",
				paymentIntent: "pi_dispute_won",
				status: "won",
			}),
		]);
		const closed = dispute({
			charge: freshCharge.id,
			id: "dp_won_restore",
			paymentIntent: "pi_dispute_won",
			status: "won",
		});

		await expect(service.handleChargeDisputeClosed(closed)).resolves.toBe(true);
		await expect(service.handleChargeDisputeClosed(closed)).resolves.toBe(true);

		expect(credits.grant).toHaveBeenCalledOnce();
		expect(credits.grant).toHaveBeenCalledWith(
			userOwner("user_1"),
			300,
			{
				bucket: "plan",
				idempotencyKey: "dispute-restore:dp_won_restore",
				meta: {
					billingAdjustment: "clawback_restore",
					chargeId: freshCharge.id,
					disputeId: "dp_won_restore",
					paymentIntentId: "pi_dispute_won",
					reason: "charge_dispute_closed_restore",
				},
			},
			repository.transactionClient,
		);
		await expect(
			repository.findPositiveRowsForPayment({
				chargeId: freshCharge.id,
				paymentIntentId: "pi_dispute_won",
			}),
		).resolves.toHaveLength(1);
	});

	it("preserves refunds and another adverse dispute when a warning closes", async () => {
		const { credits, repository, service, stripe } = setup();
		const freshCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 250,
			id: "ch_warning_closed",
			paymentIntent: "pi_warning_closed",
		});
		repository.seed({
			bucket: "topup",
			chargeId: freshCharge.id,
			delta: 400,
			kind: "topup",
			paymentIntentId: "pi_warning_closed",
		});
		repository.seed({
			bucket: "topup",
			chargeId: freshCharge.id,
			delta: -400,
			kind: "revoke",
			paymentIntentId: "pi_warning_closed",
		});
		stripe.seedCharge(freshCharge);
		stripe.seedDisputes(freshCharge.id, [
			dispute({
				amount: 1_000,
				charge: freshCharge.id,
				id: "dp_prevented_non_adverse",
				paymentIntent: "pi_warning_closed",
				status: "prevented",
			}),
			dispute({
				amount: 500,
				charge: freshCharge.id,
				id: "dp_still_under_review",
				paymentIntent: "pi_warning_closed",
				status: "under_review",
			}),
		]);

		await expect(
			service.handleChargeDisputeClosed(
				dispute({
					charge: freshCharge.id,
					id: "dp_warning_closed",
					paymentIntent: "pi_warning_closed",
					status: "warning_closed",
				}),
			),
		).resolves.toBe(true);

		expect(credits.grant).toHaveBeenCalledWith(
			userOwner("user_1"),
			100,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "dispute-restore:dp_warning_closed",
			}),
			repository.transactionClient,
		);
	});

	it("restores a prevented dispute as a terminal non-adverse outcome", async () => {
		const { credits, repository, service, stripe } = setup();
		const freshCharge = charge({
			amountCaptured: 1_000,
			id: "ch_dispute_prevented",
			paymentIntent: "pi_dispute_prevented",
		});
		repository.seed({
			bucket: "topup",
			chargeId: freshCharge.id,
			delta: 500,
			kind: "topup",
			paymentIntentId: "pi_dispute_prevented",
		});
		repository.seed({
			bucket: "topup",
			chargeId: freshCharge.id,
			delta: -500,
			kind: "revoke",
			paymentIntentId: "pi_dispute_prevented",
		});
		stripe.seedCharge(freshCharge);
		stripe.seedDisputes(freshCharge.id, []);
		const prevented = dispute({
			charge: freshCharge.id,
			id: "dp_prevented_restore",
			paymentIntent: "pi_dispute_prevented",
			status: "prevented",
		});

		await expect(service.handleChargeDisputeClosed(prevented)).resolves.toBe(
			true,
		);
		expect(credits.grant).toHaveBeenCalledWith(
			userOwner("user_1"),
			500,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "dispute-restore:dp_prevented_restore",
			}),
			repository.transactionClient,
		);
	});

	it("uses prior restorations when a later refund raises the cumulative target", async () => {
		const { credits, repository, service, stripe } = setup();
		const freshCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 250,
			id: "ch_restore_then_refund",
			paymentIntent: "pi_restore_then_refund",
		});
		repository.seed({
			bucket: "plan",
			chargeId: freshCharge.id,
			delta: 400,
			kind: "grant",
			paymentIntentId: "pi_restore_then_refund",
		});
		repository.seed({
			bucket: "plan",
			chargeId: freshCharge.id,
			delta: -400,
			kind: "revoke",
			paymentIntentId: "pi_restore_then_refund",
		});
		stripe.seedCharge(freshCharge);

		await service.handleChargeDisputeClosed(
			dispute({
				charge: freshCharge.id,
				id: "dp_restore_then_refund",
				paymentIntent: "pi_restore_then_refund",
				status: "won",
			}),
		);
		await service.handleChargeRefunded(
			charge({
				amountCaptured: 1_000,
				amountRefunded: 500,
				id: freshCharge.id,
				paymentIntent: "pi_restore_then_refund",
			}),
		);

		expect(credits.grant).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			100,
			expect.objectContaining({
				idempotencyKey: `refund:${freshCharge.id}:500`,
			}),
			repository.transactionClient,
		);
	});

	it.each([
		{
			charge: charge({
				amountCaptured: 1_000,
				currency: "usd",
				id: "ch_currency_mismatch",
				paymentIntent: "pi_fallback",
			}),
			disputeCurrency: "eur",
			title: "currency mismatch",
		},
		{
			charge: charge({
				amountCaptured: 0,
				currency: "usd",
				id: "ch_zero_capture_dispute",
				paymentIntent: "pi_fallback",
			}),
			disputeCurrency: "usd",
			title: "zero captured amount",
		},
	])("falls back to a full clawback with a loud log for $title", async ({
		charge: disputedCharge,
		disputeCurrency,
	}) => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: disputedCharge.id,
			delta: 120,
			kind: "grant",
			paymentIntentId: "pi_fallback",
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

		await service.handleChargeDisputeCreated(
			dispute({
				amount: 100,
				charge: disputedCharge,
				currency: disputeCurrency,
				id: "dp_fallback",
				paymentIntent: "pi_fallback",
			}),
		);

		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			120,
			expect.objectContaining({ idempotencyKey: "dispute:dp_fallback" }),
			repository.transactionClient,
		);
		expect(loggerError).toHaveBeenCalledWith(
			expect.stringContaining("falling back to a full credit clawback"),
			expect.stringContaining(`"chargeId":"${disputedCharge.id}"`),
		);
		loggerError.mockRestore();
	});

	it("does not revoke again when a refund follows a full dispute", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: "ch_1",
			delta: 500,
			kind: "grant",
			paymentIntentId: "pi_1",
		});

		await service.handleChargeDisputeCreated(dispute({}));
		await service.handleChargeRefunded(
			charge({ amountCaptured: 2_000, amountRefunded: 2_000 }),
		);

		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			500,
			expect.objectContaining({
				bucket: "plan",
				idempotencyKey: "dispute:dp_1",
			}),
			repository.transactionClient,
		);
	});

	it("uses global prior revocations as a double-count guard but writes the delta to the grant bucket", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: "ch_legacy_bucket",
			delta: 500,
			kind: "grant",
			paymentIntentId: "pi_legacy_bucket",
		});
		repository.seed({
			bucket: "topup",
			chargeId: "ch_legacy_bucket",
			delta: -100,
			idempotencyKey: "legacy:revoke",
			kind: "revoke",
			paymentIntentId: "pi_legacy_bucket",
		});

		await service.handleChargeRefunded(
			charge({
				amountCaptured: 1_000,
				amountRefunded: 500,
				id: "ch_legacy_bucket",
				paymentIntent: "pi_legacy_bucket",
			}),
		);

		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			150,
			expect.objectContaining({
				bucket: "plan",
				idempotencyKey: "refund:ch_legacy_bucket:500",
			}),
			repository.transactionClient,
		);
	});

	it.each([
		{ amountCaptured: 1_000, amountRefunded: -1 },
		{ amountCaptured: 1_000, amountRefunded: 1_001 },
		{ amountCaptured: 1_000.5, amountRefunded: 500 },
		{ amountCaptured: Number.MAX_SAFE_INTEGER + 1, amountRefunded: 500 },
	])("rejects invalid Stripe charge amounts %#", async ({
		amountCaptured,
		amountRefunded,
	}) => {
		const { credits, service } = setup();

		await expect(
			service.handleChargeRefunded(charge({ amountCaptured, amountRefunded })),
		).rejects.toThrow(
			"Stripe charge ch_1 has invalid captured/refunded amounts",
		);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("skips a zero-capture charge.refunded event with no-match semantics", async () => {
		const { credits, orderRefundHandler, repository, service } = setup({
			orderHandled: true,
		});

		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 0, amountRefunded: 777 }),
			),
		).resolves.toBe(false);

		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
		expect(repository.lockCalls).toEqual([]);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("returns false when no purchased-credit grant matches the payment", async () => {
		const { credits, service } = setup();

		await expect(
			service.handleChargeRefunded(
				charge({ amountCaptured: 1_000, amountRefunded: 500 }),
			),
		).resolves.toBe(false);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("keeps an unmatched top-up refund retryable until its grant exists", async () => {
		const { credits, service } = setup();

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 500,
					metadata: { purpose: "topup" },
				}),
			),
		).rejects.toThrow(
			"Stripe topup charge ch_1 has no payment order or credit grant yet",
		);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("does not indefinitely defer an unmatched subscription invoice charge", async () => {
		const { credits, service } = setup();

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 500,
					metadata: { purpose: "subscription" },
				}),
			),
		).resolves.toBe(false);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("recovers checkout purpose from payment-intent metadata", async () => {
		const { credits, service, stripe } = setup();
		stripe.seedPaymentIntent({
			id: "pi_order_pending",
			latest_charge: "ch_order_pending",
			metadata: { purpose: "order" },
			object: "payment_intent",
		} as unknown as Stripe.PaymentIntent);

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: "ch_order_pending",
					paymentIntent: "pi_order_pending",
				}),
			),
		).rejects.toThrow(
			"Stripe order charge ch_order_pending has no payment order or credit grant yet",
		);
		expect(stripe.retrievePaymentIntent).toHaveBeenCalledWith(
			"pi_order_pending",
		);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("reconciles a refunded charge immediately after its grant without double-revoking", async () => {
		const { credits, repository, service, stripe } = setup();
		const refundedCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 500,
			id: "ch_after_grant",
			paymentIntent: "pi_after_grant",
		});
		stripe.seedCharge(refundedCharge);
		repository.seed({
			bucket: "topup",
			chargeId: "ch_after_grant",
			delta: 400,
			kind: "topup",
			paymentIntentId: "pi_after_grant",
		});

		await service.reconcileChargeAfterGrant("ch_after_grant");
		await service.reconcileChargeAfterGrant("ch_after_grant");

		expect(stripe.retrieveCharge).toHaveBeenCalledTimes(2);
		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			200,
			expect.objectContaining({
				bucket: "topup",
				idempotencyKey: "refund:ch_after_grant:500",
			}),
			repository.transactionClient,
		);
	});

	it("reconciles a pre-existing dispute immediately after its grant", async () => {
		const { credits, repository, service, stripe } = setup();
		const disputedCharge = charge({
			amountCaptured: 1_000,
			disputed: true,
			id: "ch_disputed_before_grant",
			paymentIntent: "pi_disputed_before_grant",
		});
		const existingDispute = dispute({
			charge: "ch_disputed_before_grant",
			id: "dp_before_grant",
			paymentIntent: "pi_disputed_before_grant",
		});
		stripe.seedCharge(disputedCharge);
		stripe.seedDisputes(disputedCharge.id, [existingDispute]);
		repository.seed({
			bucket: "plan",
			chargeId: disputedCharge.id,
			delta: 300,
			kind: "grant",
			paymentIntentId: "pi_disputed_before_grant",
		});

		await service.reconcileChargeAfterGrant(disputedCharge.id);

		expect(stripe.listDisputesForCharge).toHaveBeenCalledWith(
			disputedCharge.id,
		);
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			300,
			expect.objectContaining({
				bucket: "plan",
				idempotencyKey: "dispute:dp_before_grant",
			}),
			repository.transactionClient,
		);
	});

	it("does not replay any terminal non-adverse dispute during post-grant reconciliation", async () => {
		const { credits, repository, service, stripe } = setup();
		const disputedCharge = charge({
			amountCaptured: 1_000,
			disputed: true,
			id: "ch_resolved_disputes",
			paymentIntent: "pi_resolved_disputes",
		});
		stripe.seedCharge(disputedCharge);
		stripe.seedDisputes(disputedCharge.id, [
			dispute({
				amount: 500,
				charge: disputedCharge.id,
				id: "dp_won",
				status: "won",
			}),
			dispute({
				amount: 500,
				charge: disputedCharge.id,
				id: "dp_warning_closed",
				status: "warning_closed",
			}),
			dispute({
				amount: 500,
				charge: disputedCharge.id,
				id: "dp_prevented",
				status: "prevented",
			}),
			dispute({
				amount: 500,
				charge: disputedCharge.id,
				id: "dp_open",
				status: "needs_response",
			}),
		]);
		repository.seed({
			bucket: "plan",
			chargeId: disputedCharge.id,
			delta: 200,
			kind: "grant",
			paymentIntentId: "pi_resolved_disputes",
		});

		await service.reconcileChargeAfterGrant(disputedCharge.id);

		expect(credits.revoke).toHaveBeenCalledOnce();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			100,
			expect.objectContaining({ idempotencyKey: "dispute:dp_open" }),
			repository.transactionClient,
		);
	});

	it("acknowledges a matched refund whose floored target is zero", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "topup",
			chargeId: "ch_tiny",
			delta: 1,
			kind: "topup",
			paymentIntentId: "pi_tiny",
		});

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 100,
					amountRefunded: 1,
					id: "ch_tiny",
					paymentIntent: "pi_tiny",
				}),
			),
		).resolves.toBe(true);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("delegates payment-order refunds and does not touch the credit ledger when handled", async () => {
		const { credits, orderRefundHandler, repository, service } = setup({
			orderHandled: true,
		});

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 1_000,
					id: "ch_order",
					paymentIntent: "pi_order",
					refunds: [
						refund({
							amount: 1_000,
							id: "re_order",
							status: "succeeded",
						}),
					],
				}),
			),
		).resolves.toBe(true);

		expect(orderRefundHandler.updateRefundStatus).toHaveBeenCalledWith({
			paymentIntentId: "pi_order",
			providerRefundId: "re_order",
			refundStatus: "succeeded",
		});
		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).toHaveBeenCalledWith({
			amountCaptured: 1_000,
			amountRefunded: 1_000,
			chargeId: "ch_order",
			paymentIntentId: "pi_order",
		});
		expect(repository.lockCalls).toEqual([]);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("delegates payment-order disputes to the same terminal fulfillment fence", async () => {
		const { credits, orderRefundHandler, repository, service } = setup({
			orderHandled: true,
		});
		const orderCharge = charge({
			id: "ch_order_dispute",
			metadata: { purpose: "order" },
			paymentIntent: "pi_order_dispute",
		});

		await expect(
			service.handleChargeDisputeCreated(
				dispute({
					charge: orderCharge,
					id: "dp_order",
					paymentIntent: "pi_order_dispute",
				}),
			),
		).resolves.toBe(true);

		expect(orderRefundHandler.markRefundedByPaymentIntent).toHaveBeenCalledWith(
			{
				chargeId: "ch_order_dispute",
				cause: "dispute",
				paymentIntentId: "pi_order_dispute",
			},
		);
		expect(repository.lockCalls).toEqual([]);
		expect(credits.revoke).not.toHaveBeenCalled();
	});

	it("matches a modern charge-linked grant even when the charge has no payment intent", async () => {
		const { credits, orderRefundHandler, repository, service } = setup();
		repository.seed({
			bucket: "plan",
			chargeId: "ch_direct",
			delta: 200,
			kind: "grant",
		});

		await expect(
			service.handleChargeRefunded(
				charge({
					amountCaptured: 1_000,
					amountRefunded: 500,
					id: "ch_direct",
					paymentIntent: null,
				}),
			),
		).resolves.toBe(true);

		expect(
			orderRefundHandler.handleChargeRefundedByPaymentIntent,
		).not.toHaveBeenCalled();
		expect(credits.revoke).toHaveBeenCalledWith(
			userOwner("user_1"),
			100,
			expect.objectContaining({
				bucket: "plan",
				idempotencyKey: "refund:ch_direct:500",
			}),
			repository.transactionClient,
		);
	});

	it("serializes concurrent deliveries for the same charge", async () => {
		const { credits, repository, service } = setup();
		repository.seed({
			bucket: "topup",
			chargeId: "ch_concurrent",
			delta: 500,
			kind: "topup",
			paymentIntentId: "pi_concurrent",
		});
		const eventCharge = charge({
			amountCaptured: 1_000,
			amountRefunded: 500,
			id: "ch_concurrent",
			paymentIntent: "pi_concurrent",
		});

		await Promise.all([
			service.handleChargeRefunded(eventCharge),
			service.handleChargeRefunded(eventCharge),
		]);

		expect(repository.lockCalls).toEqual(["ch_concurrent", "ch_concurrent"]);
		expect(credits.revoke).toHaveBeenCalledOnce();
	});

	it("rejects grants or prior revocations spanning multiple users", async () => {
		const first = setup();
		first.repository.seed({
			bucket: "topup",
			chargeId: "ch_owners",
			delta: 100,
			kind: "topup",
			userId: "user_1",
		});
		first.repository.seed({
			bucket: "topup",
			chargeId: "ch_owners",
			delta: 100,
			kind: "topup",
			userId: "user_2",
		});

		await expect(
			first.service.handleChargeRefunded(
				charge({
					amountCaptured: 100,
					amountRefunded: 100,
					id: "ch_owners",
					paymentIntent: null,
				}),
			),
		).rejects.toThrow(
			"Purchased credit grants for Stripe charge ch_owners span multiple owners",
		);

		const second = setup();
		second.repository.seed({
			bucket: "topup",
			chargeId: "ch_revocation_owner",
			delta: 100,
			kind: "topup",
			userId: "user_1",
		});
		second.repository.seed({
			bucket: "topup",
			chargeId: "ch_revocation_owner",
			delta: -10,
			kind: "revoke",
			userId: "user_2",
		});

		await expect(
			second.service.handleChargeRefunded(
				charge({
					amountCaptured: 100,
					amountRefunded: 100,
					id: "ch_revocation_owner",
					paymentIntent: null,
				}),
			),
		).rejects.toThrow(
			"Credit revocations for Stripe charge ch_revocation_owner span multiple owners",
		);
	});

	it("returns false for a dispute without a charge id", async () => {
		const { credits, repository, service } = setup();

		await expect(
			service.handleChargeDisputeCreated(dispute({ charge: null })),
		).resolves.toBe(false);
		expect(repository.lockCalls).toEqual([]);
		expect(credits.revoke).not.toHaveBeenCalled();
	});
});

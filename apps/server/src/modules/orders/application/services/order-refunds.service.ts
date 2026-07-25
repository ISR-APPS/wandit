import { Inject, Injectable, Logger } from "@nestjs/common";

import type { WebhookOrderRefundHandler } from "../../../billing/domain/ports/webhook-order-refund-handler.port";
import {
	type DomainRow,
	DomainsRepository,
} from "../../../domains/infrastructure/persistence/domains.repository";
import type { PaymentOrderRow } from "../../domain/payment-order.types";
import {
	PaymentOrdersRepository,
	type PaymentOrderTransaction,
} from "../../infrastructure/persistence/payment-orders.repository";

const REFUNDED_DOMAIN_STOP_NOTE =
	"Payment was refunded before domain fulfillment completed";
const DISPUTED_DOMAIN_STOP_NOTE =
	"Payment was disputed before domain fulfillment completed";
const PARTIAL_REFUND_MANUAL_REVIEW_NOTE =
	"Manual review required: Stripe reported a partial refund for this domain order; fulfillment was intentionally left unchanged.";

type RefundResult = {
	activeDomain: DomainRow | null;
	order: PaymentOrderRow;
};

type RefundStatusResult = {
	manualReviewNote: string | null;
	order: PaymentOrderRow;
};

@Injectable()
export class OrderRefundsService implements WebhookOrderRefundHandler {
	private readonly logger = new Logger(OrderRefundsService.name);

	constructor(
		@Inject(PaymentOrdersRepository)
		private readonly paymentOrdersRepository: PaymentOrdersRepository,
		@Inject(DomainsRepository)
		private readonly domainsRepository: DomainsRepository,
	) {}

	async handleChargeRefundedByPaymentIntent(input: {
		amountCaptured: number;
		amountRefunded: number;
		chargeId: string;
		paymentIntentId: string;
	}): Promise<boolean> {
		this.assertRefundAmounts(input);

		if (input.amountRefunded >= input.amountCaptured) {
			return this.markRefundedByPaymentIntent(input);
		}

		const partialOrder =
			await this.paymentOrdersRepository.withLockedByPaymentIntent(
				input.paymentIntentId,
				async (order, tx) => {
					if (order.status === "refunded") {
						return order;
					}

					const noted = await this.paymentOrdersRepository.recordPartialRefund(
						order.id,
						PARTIAL_REFUND_MANUAL_REVIEW_NOTE,
						tx,
					);

					if (!noted) {
						throw new Error(
							`Payment order ${order.id} could not record its partial-refund manual-review state`,
						);
					}

					return noted;
				},
			);

		if (!partialOrder) {
			return false;
		}

		this.logger.error(
			`MANUAL REVIEW REQUIRED: Stripe charge ${input.chargeId} was partially refunded; payment order ${partialOrder.id} and its linked domain were intentionally left unchanged`,
			JSON.stringify({
				amountCaptured: input.amountCaptured,
				amountRefunded: input.amountRefunded,
				chargeId: input.chargeId,
				orderId: partialOrder.id,
				paymentIntentId: input.paymentIntentId,
			}),
		);

		return true;
	}

	async markRefundedByPaymentIntent(input: {
		chargeId: string;
		cause?: "dispute";
		paymentIntentId: string;
	}): Promise<boolean> {
		const result = await this.paymentOrdersRepository.withLockedByPaymentIntent(
			input.paymentIntentId,
			(order, tx) =>
				this.refundLockedOrder(order, input.chargeId, input.cause, tx),
		);

		if (!result) {
			return false;
		}

		if (result.activeDomain) {
			const reversal = input.cause === "dispute" ? "disputed" : "refunded";
			this.logger.error(
				`MANUAL REVIEW REQUIRED: Stripe charge ${input.chargeId} was ${reversal} after domain ${result.activeDomain.name} became active; the domain was intentionally left active`,
				JSON.stringify({
					chargeId: input.chargeId,
					cause: input.cause ?? "refund",
					domainId: result.activeDomain.id,
					domainName: result.activeDomain.name,
					orderId: result.order.id,
					paymentIntentId: input.paymentIntentId,
				}),
			);
		}

		return true;
	}

	async updateRefundStatus(input: {
		paymentIntentId: string | null;
		providerRefundId: string;
		refundStatus: string | null;
	}): Promise<boolean> {
		const refundState = {
			providerRefundId: input.providerRefundId,
			refundStatus: input.refundStatus,
		};
		const result =
			await this.paymentOrdersRepository.withLockedByRefundReference(
				input,
				async (order, tx): Promise<RefundStatusResult> => {
					if (
						order.providerRefundId &&
						order.providerRefundId !== input.providerRefundId
					) {
						const replacePartialWithPending =
							order.refundStatus === "partial" &&
							input.refundStatus === "pending";
						const replaceNonterminalWithSucceeded =
							input.refundStatus === "succeeded" &&
							[
								"partial",
								"pending",
								"requires_action",
								"failed",
								"canceled",
							].includes(order.refundStatus ?? "") &&
							!(order.status === "refunded" && order.refundStatus === "failed");

						if (replacePartialWithPending || replaceNonterminalWithSucceeded) {
							const replaced =
								await this.paymentOrdersRepository.replaceRefundReferenceForFullCoverage(
									order.id,
									{
										expectedProviderRefundId: order.providerRefundId,
										expectedRefundStatus: order.refundStatus ?? "",
										providerRefundId: input.providerRefundId,
										refundStatus:
											input.refundStatus === "succeeded"
												? "succeeded"
												: "pending",
									},
									tx,
								);

							if (!replaced) {
								throw new Error(
									`Payment order ${order.id} could not replace Stripe refund ${order.providerRefundId} with authoritative covering refund ${input.providerRefundId}`,
								);
							}

							if (
								input.refundStatus === "succeeded" &&
								replaced.status === "failed"
							) {
								const succeeded = await this.succeedFailedRefund(
									replaced,
									input.providerRefundId,
									tx,
								);

								if (!succeeded) {
									throw new Error(
										`Failed payment order ${order.id} could not complete replacement Stripe refund ${input.providerRefundId}`,
									);
								}

								return succeeded;
							}

							return { manualReviewNote: null, order: replaced };
						}

						let conflictOrder = order;

						if (
							input.refundStatus === "succeeded" &&
							!(order.status === "refunded" && order.refundStatus === "failed")
						) {
							let succeeded: RefundStatusResult | null;

							if (order.status === "failed") {
								succeeded = await this.succeedFailedRefund(
									order,
									order.providerRefundId,
									tx,
								);
							} else {
								const recorded =
									await this.paymentOrdersRepository.recordRefundState(
										order.id,
										{
											providerRefundId: order.providerRefundId,
											refundStatus: "succeeded",
										},
										tx,
									);
								succeeded = recorded
									? { manualReviewNote: null, order: recorded }
									: null;
							}

							if (!succeeded) {
								throw new Error(
									`Payment order ${order.id} could not complete its succeeded conflicting Stripe refund ${input.providerRefundId}`,
								);
							}

							conflictOrder = succeeded.order;
						}

						const conflictNote = `Manual review required: payment order ${order.id} already tracks Stripe refund ${order.providerRefundId}; additional refund ${input.providerRefundId} reported ${input.refundStatus ?? "unknown"}. The original refund reference was preserved.`;
						const manualReviewNote = conflictOrder.fulfillmentError?.includes(
							input.providerRefundId,
						)
							? conflictOrder.fulfillmentError
							: [conflictOrder.fulfillmentError, conflictNote]
									.filter((note): note is string => !!note)
									.join(" ");
						const noted =
							await this.paymentOrdersRepository.recordRefundReferenceConflict(
								order.id,
								manualReviewNote,
								tx,
							);

						if (!noted) {
							throw new Error(
								`Payment order ${order.id} could not record conflicting Stripe refund ${input.providerRefundId}`,
							);
						}

						return { manualReviewNote: conflictNote, order: noted };
					}

					if (
						order.refundStatus === "succeeded" &&
						(input.refundStatus === "failed" ||
							input.refundStatus === "canceled")
					) {
						const manualReviewNote = `Manual review required: Stripe refund ${input.providerRefundId} was recorded as succeeded and later reported ${input.refundStatus}; payment order ${order.id} remains ${order.status} and requires financial reconciliation.`;
						const noted =
							await this.paymentOrdersRepository.recordSucceededRefundFailure(
								order.id,
								{
									manualReviewNote,
									providerRefundId: input.providerRefundId,
								},
								tx,
							);

						if (!noted) {
							throw new Error(
								`Payment order ${order.id} could not record the failed lifecycle reversal of Stripe refund ${input.providerRefundId}`,
							);
						}

						return { manualReviewNote, order: noted };
					}

					if (
						order.refundStatus === "succeeded" &&
						input.refundStatus !== "succeeded"
					) {
						return { manualReviewNote: null, order };
					}

					if (order.status === "refunded" && order.refundStatus === "failed") {
						return { manualReviewNote: null, order };
					}

					if (input.refundStatus === "succeeded") {
						if (order.status === "refunded") {
							const recorded =
								await this.paymentOrdersRepository.recordRefundState(
									order.id,
									refundState,
									tx,
								);

							if (!recorded) {
								throw new Error(
									`Refunded payment order ${order.id} could not attach Stripe refund ${input.providerRefundId}`,
								);
							}

							return { manualReviewNote: null, order: recorded };
						}

						const refunded = await this.succeedFailedRefund(
							order,
							input.providerRefundId,
							tx,
						);

						if (refunded) {
							return refunded;
						}

						const recorded =
							await this.paymentOrdersRepository.recordRefundState(
								order.id,
								refundState,
								tx,
							);

						if (!recorded) {
							throw new Error(
								`Payment order ${order.id} could not record succeeded Stripe refund ${input.providerRefundId}`,
							);
						}

						return { manualReviewNote: null, order: recorded };
					}

					if (
						input.refundStatus === "failed" ||
						input.refundStatus === "canceled"
					) {
						const manualReviewNote = `Manual review required: Stripe refund ${input.providerRefundId} reached ${input.refundStatus}; payment order remains failed.`;
						const noted =
							await this.paymentOrdersRepository.recordRefundManualReview(
								order.id,
								{
									manualReviewNote,
									providerRefundId: input.providerRefundId,
									refundStatus: input.refundStatus,
								},
								tx,
							);

						if (noted) {
							return { manualReviewNote, order: noted };
						}

						const recorded =
							await this.paymentOrdersRepository.recordRefundState(
								order.id,
								refundState,
								tx,
							);

						if (!recorded) {
							throw new Error(
								`Payment order ${order.id} could not record ${input.refundStatus} Stripe refund ${input.providerRefundId}`,
							);
						}

						return { manualReviewNote, order: recorded };
					}

					const recorded = await this.paymentOrdersRepository.recordRefundState(
						order.id,
						refundState,
						tx,
					);

					if (!recorded) {
						throw new Error(
							`Payment order ${order.id} could not record Stripe refund ${input.providerRefundId} status ${input.refundStatus ?? "unknown"}`,
						);
					}

					return { manualReviewNote: null, order: recorded };
				},
			);

		if (!result) {
			return false;
		}

		if (result.manualReviewNote) {
			this.logger.error(
				result.manualReviewNote,
				JSON.stringify({
					orderId: result.order.id,
					paymentIntentId: input.paymentIntentId,
					providerRefundId: input.providerRefundId,
					refundStatus: input.refundStatus,
				}),
			);
		}

		return true;
	}

	private async succeedFailedRefund(
		order: PaymentOrderRow,
		providerRefundId: string,
		tx: PaymentOrderTransaction,
	): Promise<RefundStatusResult | null> {
		if (order.status !== "failed") {
			return null;
		}

		const domain = await this.domainsRepository.findByPaymentOrderIdForUpdate(
			order.id,
			tx,
		);

		if (domain && ["registering", "configuring"].includes(domain.status)) {
			const stopped = await this.domainsRepository.updateIfStatusOrNull(
				domain.id,
				["registering", "configuring"],
				{
					error: REFUNDED_DOMAIN_STOP_NOTE,
					isPrimary: false,
					status: "failed",
				},
				tx,
			);

			if (!stopped) {
				throw new Error(
					`Linked domain ${domain.id} could not be fenced before completing Stripe refund ${providerRefundId} for payment order ${order.id}`,
				);
			}
		}

		const refunded =
			await this.paymentOrdersRepository.markFailedRefundSucceeded(
				order.id,
				providerRefundId,
				tx,
			);

		if (!refunded) {
			return null;
		}

		if (domain?.status !== "active") {
			return { manualReviewNote: null, order: refunded };
		}

		const manualReviewNote = `Manual review required: Stripe refund ${providerRefundId} succeeded after linked domain ${domain.name} became active; domain intentionally left active.`;
		const noted = await this.paymentOrdersRepository.recordFulfillmentError(
			order.id,
			manualReviewNote,
			tx,
		);

		if (!noted) {
			throw new Error(
				`Refunded payment order ${order.id} could not record its active-domain manual-review note`,
			);
		}

		return { manualReviewNote, order: noted };
	}

	private async refundLockedOrder(
		order: PaymentOrderRow,
		chargeId: string,
		cause: "dispute" | undefined,
		tx: PaymentOrderTransaction,
	): Promise<RefundResult> {
		if (
			!cause &&
			order.status === "refunded" &&
			order.refundStatus === "failed"
		) {
			return { activeDomain: null, order };
		}

		if (!cause && order.refundStatus !== "succeeded") {
			throw new Error(
				`Payment order ${order.id} cannot be terminalized from Stripe charge ${chargeId} with refund status ${order.refundStatus ?? "unknown"}`,
			);
		}

		const domain = await this.domainsRepository.findByPaymentOrderIdForUpdate(
			order.id,
			tx,
		);

		if (domain && ["registering", "configuring"].includes(domain.status)) {
			const stopped = await this.domainsRepository.updateIfStatusOrNull(
				domain.id,
				["registering", "configuring"],
				{
					error:
						cause === "dispute"
							? DISPUTED_DOMAIN_STOP_NOTE
							: REFUNDED_DOMAIN_STOP_NOTE,
					isPrimary: false,
					status: "failed",
				},
				tx,
			);

			if (!stopped) {
				throw new Error(
					`Linked domain ${domain.id} could not be fenced before financially reversing payment order ${order.id}`,
				);
			}
		}

		const refunded =
			order.status === "refunded"
				? order
				: cause === "dispute"
					? await this.paymentOrdersRepository.markRefunded(order.id, tx)
					: await this.paymentOrdersRepository.markChargeRefunded(order.id, tx);

		if (!refunded) {
			throw new Error(
				`Payment order ${order.id} could not be marked refunded from ${order.status}`,
			);
		}

		if (domain?.status !== "active") {
			return { activeDomain: null, order: refunded };
		}

		/*
		 * Policy: the payment was refunded or disputed, but an active registered
		 * domain is an external asset. Never disable, delete, or detach it
		 * automatically; preserve service and flag the order for manual review.
		 */
		const reversal = cause === "dispute" ? "disputed" : "refunded";
		const manualReviewNote = `Manual review required: Stripe charge ${chargeId} was ${reversal} after linked domain ${domain.name} became active; domain intentionally left active.`;
		const noted = await this.paymentOrdersRepository.recordFulfillmentError(
			order.id,
			manualReviewNote,
			tx,
		);

		if (!noted) {
			throw new Error(
				`Financially reversed payment order ${order.id} could not record its manual-review note`,
			);
		}

		return { activeDomain: domain, order: noted };
	}

	private assertRefundAmounts(input: {
		amountCaptured: number;
		amountRefunded: number;
		chargeId: string;
	}) {
		if (
			!Number.isSafeInteger(input.amountCaptured) ||
			input.amountCaptured <= 0 ||
			!Number.isSafeInteger(input.amountRefunded) ||
			input.amountRefunded < 0 ||
			input.amountRefunded > input.amountCaptured
		) {
			throw new Error(
				`Stripe charge ${input.chargeId} has invalid captured/refunded amounts`,
			);
		}
	}
}

export const WEBHOOK_ORDER_REFUND_HANDLER = Symbol(
	"WEBHOOK_ORDER_REFUND_HANDLER",
);

export interface WebhookOrderRefundHandler {
	handleChargeRefundedByPaymentIntent(input: {
		amountCaptured: number;
		amountRefunded: number;
		chargeId: string;
		paymentIntentId: string;
	}): Promise<boolean>;

	markRefundedByPaymentIntent(input: {
		chargeId: string;
		/**
		 * Disputes use the same terminal financial-reversal fence as refunds so a
		 * disputed purchase cannot enter fulfillment. Omitted means refund for
		 * backwards-compatible callers.
		 */
		cause?: "dispute";
		paymentIntentId: string;
	}): Promise<boolean>;

	updateRefundStatus(input: {
		paymentIntentId: string | null;
		providerRefundId: string;
		refundStatus: string | null;
	}): Promise<boolean>;
}

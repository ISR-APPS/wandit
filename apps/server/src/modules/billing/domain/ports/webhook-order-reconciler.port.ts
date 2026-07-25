export const WEBHOOK_ORDER_RECONCILER = Symbol("WEBHOOK_ORDER_RECONCILER");

export type CheckoutSessionOrderOutcome =
	| "async_payment_failed"
	| "async_payment_succeeded"
	| "completed"
	| "expired";

export type PaymentIntentOrderOutcome = "canceled" | "failed" | "succeeded";

export interface WebhookOrderReconciler {
	reconcileByPaymentIntent(
		paymentIntentId: string,
		outcome?: PaymentIntentOrderOutcome,
		providerPaymentStatus?: string,
	): Promise<boolean>;
	reconcileBySession(
		sessionId: string,
		outcome?: CheckoutSessionOrderOutcome,
	): Promise<void>;
}

/**
 * HTTP error of a checkout start when another checkout of the pool is still open or in flight.
 * BillingService (Stripe) and SlickpayPaymentsService throw it. The web shows the translated code.
 */
import { ConflictException } from "@nestjs/common";

/** 409 BILLING_CHECKOUT_PENDING: a paid payment waits for its grant, or a provider call is in flight. */
export class BillingCheckoutPendingError extends ConflictException {
	constructor() {
		super({
			code: "BILLING_CHECKOUT_PENDING",
			message: "A billing checkout is already pending",
		});
	}
}

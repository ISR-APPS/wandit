import { HttpException, HttpStatus } from "@nestjs/common";

export const BILLING_NOT_CONFIGURED_ERROR_CODE = "BILLING_NOT_CONFIGURED";

export class BillingNotConfiguredError extends HttpException {
	constructor(missingKey: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET") {
		super(
			{
				code: BILLING_NOT_CONFIGURED_ERROR_CODE,
				message: `Billing is not configured: ${missingKey} is missing`,
				missingKey,
			},
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}
}

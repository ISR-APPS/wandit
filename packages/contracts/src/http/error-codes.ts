import { z } from "zod";

export const apiErrorCodes = [
	"AUTH_FAILURE",
	"NETWORK_ERROR",
	"CLIENT_ERROR",
	"VALIDATION_ERROR",
	"NOT_FOUND",
	"FORBIDDEN",
	"PAYMENT_PAST_DUE",
	"INSUFFICIENT_CREDITS",
	"GENERATION_PAYMENT_REQUIRED",
	"SUBSCRIPTIONS_DISABLED",
	"TOPUPS_DISABLED",
	"ORGANIZATIONS_DISABLED",
	"MEMBER_CREDIT_LIMIT_REACHED",
	"WORKSPACE_PERMISSION_DENIED",
	"WORKSPACE_NOT_SUPPORTED",
	"EMAIL_AUTH_DISABLED",
	"EMAIL_DOMAIN_BLOCKED",
	"EMAIL_SEND_RATE_LIMITED",
	"BILLING_CHECKOUT_PENDING",
	"SUBSCRIPTION_CHANGE_PENDING",
	"BILLING_CHANGE_INTENT_EXPIRED",
	"BILLING_CHANGE_INTENT_INVALID",
	"YEARLY_TO_MONTHLY_UNSUPPORTED",
	"ALREADY_SUBSCRIBED",
	"NO_ACTIVE_SUBSCRIPTION",
	"MANUAL_PAYMENTS_DISABLED",
	"MANUAL_REQUEST_PENDING",
	"MANUAL_SUBSCRIPTION_UNSUPPORTED",
	"RATE_LIMITED",
	"INTERNAL_ERROR",
	"HTTP_400",
	"HTTP_401",
	"HTTP_403",
	"HTTP_404",
	"HTTP_429",
	"HTTP_500",
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

// Decimal credits: the smallest charge is 0.01 and balances can be fractional
// (or negative after accepted overage), so both fields carry decimals.
export const paymentRequiredDetailsSchema = z.object({
	requiredCredits: z.number().positive(),
	availableCredits: z.number(),
});

export type PaymentRequiredDetails = z.infer<
	typeof paymentRequiredDetailsSchema
>;

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
	"BILLING_CHECKOUT_PENDING",
	"SUBSCRIPTION_CHANGE_PENDING",
	"BILLING_CHANGE_INTENT_EXPIRED",
	"BILLING_CHANGE_INTENT_INVALID",
	"YEARLY_TO_MONTHLY_UNSUPPORTED",
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

export const paymentRequiredDetailsSchema = z.object({
	requiredCredits: z.int().positive(),
	availableCredits: z.int(),
});

export type PaymentRequiredDetails = z.infer<
	typeof paymentRequiredDetailsSchema
>;

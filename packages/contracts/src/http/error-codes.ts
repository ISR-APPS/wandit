/**
 * Error codes the API sends in the `error.code` field of a failed reply.
 * The server exception filter and the domain errors produce them. The web app
 * maps each code to a translated message in the `errors.codes` dictionary.
 */
import { z } from "zod";

export const apiErrorCodes = [
	"AUTH_FAILURE",
	"NETWORK_ERROR",
	"CLIENT_ERROR",
	"VALIDATION_ERROR",
	"NOT_FOUND",
	"EXTERNAL_DOMAIN_UNREGISTERED",
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
	"PHONE_ALREADY_TAKEN",
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
	"V2_BUILDER_DISABLED",
	"V2_ENV_MISSING",
	"V2_MODEL_UNPRICED",
	"V2_MODEL_DENIED",
	"MOBILE_TEMPLATE_UNAVAILABLE",
	"BUILDER_APPROVAL_PENDING",
	"BUILDER_TURN_ACTIVE",
	"SANDBOX_NOT_RUNNING",
	"BUILDER_TURN_STALE",
	"PROJECT_CREDIT_CAP_REACHED",
	"TOO_MANY_ACTIVE_TURNS",
	"VERSION_CONFLICT",
	"CODE_PATH_INVALID",
	"CODE_FILE_NOT_FOUND",
	"CODE_FILE_TOO_LARGE",
	"BACKEND_NOT_READY",
	"BACKEND_PAUSED",
	"BACKEND_LIMIT_REACHED",
	"WRITE_NEEDS_CONFIRM",
	"INVALID_IDENTIFIER",
	"QUERY_FAILED",
	"WINDOW_TOO_LARGE",
	"UPSTREAM_UNAVAILABLE",
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
// availableCredits is the SETTLED balance — the same number the header pill
// shows — so the paywall never prints a hold-dipped negative the user has
// never seen. heldCredits is the slice temporarily reserved by running
// generations (optional: older servers omit it).
export const paymentRequiredDetailsSchema = z.object({
	requiredCredits: z.number().positive(),
	availableCredits: z.number(),
	heldCredits: z.number().nonnegative().optional(),
});

export type PaymentRequiredDetails = z.infer<
	typeof paymentRequiredDetailsSchema
>;

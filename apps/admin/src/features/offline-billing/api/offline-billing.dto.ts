// The offline billing feature consumes the shared API contract directly.
// Keep all feature-facing aliases here so @wandit/contracts stays the source
// of truth for requests, subscriptions, payments, and mutation payloads.
import {
	type AdminEndManualSubscriptionInput,
	type AdminGrantManualSubscriptionInput,
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminManualBillingOrganization,
	type AdminManualBillingStats,
	type AdminManualBillingUser,
	type AdminManualPayment,
	type AdminManualPaymentInput,
	type AdminManualRequest,
	type AdminManualRequestStatusFilter,
	type AdminManualSubscription,
	type AdminManualSubscriptionDetail,
	type AdminManualSubscriptionStatusFilter,
	type AdminRenewManualSubscriptionInput,
	type AdminUpdateManualRequestBody,
	adminListManualRequestsResponseSchema,
	adminListManualSubscriptionsResponseSchema,
	adminManualBillingStatsSchema,
	adminManualRequestSchema,
	adminManualSubscriptionDetailSchema,
	adminManualSubscriptionSchema,
} from "@wandit/contracts";

export type {
	AdminEndManualSubscriptionInput,
	AdminGrantManualSubscriptionInput,
	AdminListManualRequestsResponse,
	AdminListManualSubscriptionsResponse,
	AdminManualBillingOrganization,
	AdminManualBillingUser,
	AdminManualPayment,
	AdminManualPaymentInput,
	AdminManualRequest,
	AdminManualRequestStatusFilter,
	AdminManualSubscription,
	AdminManualSubscriptionDetail,
	AdminManualSubscriptionStatusFilter,
	AdminRenewManualSubscriptionInput,
	AdminUpdateManualRequestBody,
};

export type ListManualRequestsParams = AdminListManualRequestsQuery;
export type ListManualSubscriptionsParams = AdminListManualSubscriptionsQuery;

export type UpdateManualRequestInput = {
	requestId: string;
	body: AdminUpdateManualRequestBody;
};

export type RenewManualSubscriptionInput = {
	subscriptionId: string;
	body: AdminRenewManualSubscriptionInput;
};

export type EndManualSubscriptionInput = {
	subscriptionId: string;
	body: AdminEndManualSubscriptionInput;
};

/** A selectable billing contact; detail pages may only know the user ID. */
export type ManualBillingUserReference = {
	id: string;
	name?: string;
	email?: string;
};

/** Validate one request at the admin feature boundary. */
export function mapManualRequestDto(input: unknown): AdminManualRequest {
	return adminManualRequestSchema.parse(input);
}

/** Validate the server-paginated requests result. */
export function mapManualRequestsDto(
	input: unknown,
): AdminListManualRequestsResponse {
	return adminListManualRequestsResponseSchema.parse(input);
}

/** Validate one subscription list row at the admin feature boundary. */
export function mapManualSubscriptionDto(
	input: unknown,
): AdminManualSubscription {
	return adminManualSubscriptionSchema.parse(input);
}

/** Validate one subscription detail result. */
export function mapManualSubscriptionDetailDto(
	input: unknown,
): AdminManualSubscriptionDetail {
	return adminManualSubscriptionDetailSchema.parse(input);
}

/** Validate the server-paginated subscriptions result. */
export function mapManualSubscriptionsDto(
	input: unknown,
): AdminListManualSubscriptionsResponse {
	return adminListManualSubscriptionsResponseSchema.parse(input);
}

export type { AdminManualBillingStats };

export function mapManualBillingStatsDto(
	input: unknown,
): AdminManualBillingStats {
	return adminManualBillingStatsSchema.parse(input);
}

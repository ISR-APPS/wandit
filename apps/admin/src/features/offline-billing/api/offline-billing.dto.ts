/**
 * Types and boundary parsers of the offline billing feature.
 * The services call the parsers on every API answer. @wandit/contracts holds the schemas.
 * Covers requests, top-up receipts, old manual subscriptions, and the page stats.
 */
import {
	type AdminListManualRequestsQuery,
	type AdminListManualRequestsResponse,
	type AdminListManualSubscriptionsQuery,
	type AdminListManualSubscriptionsResponse,
	type AdminListTopupReceiptsQuery,
	type AdminListTopupReceiptsResponse,
	type AdminManualBillingOrganization,
	type AdminManualBillingReceiptConfig,
	type AdminManualBillingStats,
	type AdminManualBillingUser,
	type AdminManualPayment,
	type AdminManualRequest,
	type AdminManualRequestStatusFilter,
	type AdminManualSubscription,
	type AdminManualSubscriptionDetail,
	type AdminManualSubscriptionStatusFilter,
	type AdminRecordTopupInput,
	type AdminTopupReceipt,
	type AdminUpdateManualRequestBody,
	adminListManualRequestsResponseSchema,
	adminListManualSubscriptionsResponseSchema,
	adminListTopupReceiptsResponseSchema,
	adminManualBillingReceiptConfigSchema,
	adminManualBillingStatsSchema,
	adminManualRequestSchema,
	adminManualSubscriptionDetailSchema,
	adminManualSubscriptionSchema,
	adminTopupReceiptSchema,
} from "@wandit/contracts";

export type {
	AdminListManualRequestsResponse,
	AdminListManualSubscriptionsResponse,
	AdminListTopupReceiptsResponse,
	AdminManualBillingOrganization,
	AdminManualBillingReceiptConfig,
	AdminManualBillingUser,
	AdminManualPayment,
	AdminManualRequest,
	AdminManualRequestStatusFilter,
	AdminManualSubscription,
	AdminManualSubscriptionDetail,
	AdminManualSubscriptionStatusFilter,
	AdminRecordTopupInput,
	AdminTopupReceipt,
	AdminUpdateManualRequestBody,
};

export type ListManualRequestsParams = AdminListManualRequestsQuery;
export type ListManualSubscriptionsParams = AdminListManualSubscriptionsQuery;
export type ListTopupReceiptsParams = AdminListTopupReceiptsQuery;

export type UpdateManualRequestInput = {
	requestId: string;
	body: AdminUpdateManualRequestBody;
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

/** Validate the answer of "Record top-up" and "Reverse top-up". */
export function mapTopupReceiptDto(input: unknown): AdminTopupReceipt {
	return adminTopupReceiptSchema.parse(input);
}

/** Validate one page of top-up receipts. */
export function mapTopupReceiptsDto(
	input: unknown,
): AdminListTopupReceiptsResponse {
	return adminListTopupReceiptsResponseSchema.parse(input);
}

export type { AdminManualBillingStats };

export function mapManualBillingStatsDto(
	input: unknown,
): AdminManualBillingStats {
	return adminManualBillingStatsSchema.parse(input);
}

export function mapManualBillingReceiptConfigDto(
	input: unknown,
): AdminManualBillingReceiptConfig {
	return adminManualBillingReceiptConfigSchema.parse(input);
}

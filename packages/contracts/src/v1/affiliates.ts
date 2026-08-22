import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

/** API-origin cookie written by the public referral click endpoint. */
export const AFFILIATE_ATTRIBUTION_COOKIE_NAME = "wandit_affiliate_attribution";

/** Better Auth email-signup body field used for the signed-token fallback. */
export const AFFILIATE_SIGNUP_TOKEN_FIELD = "affiliateToken";

const maxPgInteger = 2_147_483_647;

export const affiliateCodeSchema = z
	.string()
	.trim()
	.min(6)
	.max(128)
	.regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

export const affiliateCurrencySchema = z.string().regex(/^[a-z]{3}$/);

export const affiliateCommissionRateBpsSchema = z.int().min(0).max(10_000);

export const affiliatePositiveCentsSchema = z
	.int()
	.positive()
	.max(maxPgInteger);

export const affiliateProgramKinds = [
	"percentage_recurring",
	"fixed_one_time",
] as const;

export const affiliateProgramKindSchema = z.enum(affiliateProgramKinds);

export type AffiliateProgramKind = z.infer<typeof affiliateProgramKindSchema>;

export const affiliateProgramStatuses = ["active", "archived"] as const;

export const affiliateProgramStatusSchema = z.enum(affiliateProgramStatuses);

export type AffiliateProgramStatus = z.infer<
	typeof affiliateProgramStatusSchema
>;

export const affiliateStatuses = ["active", "paused"] as const;

export const affiliateStatusSchema = z.enum(affiliateStatuses);

export type AffiliateStatus = z.infer<typeof affiliateStatusSchema>;

export const affiliatePayoutMethods = ["manual", "paypal", "wise"] as const;

export const affiliatePayoutMethodSchema = z.enum(affiliatePayoutMethods);

export type AffiliatePayoutMethod = z.infer<typeof affiliatePayoutMethodSchema>;

export const affiliateAttributionSources = [
	"signup_cookie",
	"signup_body",
	"manual",
] as const;

export const affiliateAttributionSourceSchema = z.enum(
	affiliateAttributionSources,
);

export type AffiliateAttributionSource = z.infer<
	typeof affiliateAttributionSourceSchema
>;

export const affiliateAttributionStatuses = ["active", "voided"] as const;

export const affiliateAttributionStatusSchema = z.enum(
	affiliateAttributionStatuses,
);

export type AffiliateAttributionStatus = z.infer<
	typeof affiliateAttributionStatusSchema
>;

export const affiliateLinkStatuses = ["active", "paused", "expired"] as const;

export const affiliateLinkStatusSchema = z.enum(affiliateLinkStatuses);

export type AffiliateLinkStatus = z.infer<typeof affiliateLinkStatusSchema>;

export const affiliateCommissionEntryTypes = ["earning", "adjustment"] as const;

export const affiliateCommissionEntryTypeSchema = z.enum(
	affiliateCommissionEntryTypes,
);

export type AffiliateCommissionEntryType = z.infer<
	typeof affiliateCommissionEntryTypeSchema
>;

export const affiliateCommissionStatuses = [
	"pending",
	"approved",
	"paid",
	"reversed",
] as const;

export const affiliateCommissionStatusSchema = z.enum(
	affiliateCommissionStatuses,
);

export type AffiliateCommissionStatus = z.infer<
	typeof affiliateCommissionStatusSchema
>;

export const affiliatePayoutStatuses = [
	"draft",
	"processing",
	"paid",
	"failed",
] as const;

export const affiliatePayoutStatusSchema = z.enum(affiliatePayoutStatuses);

export type AffiliatePayoutStatus = z.infer<typeof affiliatePayoutStatusSchema>;

export const affiliateFraudFlagCodes = [
	"self_referral_user_id",
	"self_referral_email",
] as const;

export const affiliateFraudFlagCodeSchema = z.enum(affiliateFraudFlagCodes);

export type AffiliateFraudFlagCode = z.infer<
	typeof affiliateFraudFlagCodeSchema
>;

export const affiliateFraudFlagSchema = z
	.object({
		code: affiliateFraudFlagCodeSchema,
		detectedAt: isoDateTimeSchema,
		resolvedAt: isoDateTimeSchema.nullable(),
		resolvedByUserId: z.string().nullable(),
	})
	.strict();

export type AffiliateFraudFlag = z.infer<typeof affiliateFraudFlagSchema>;

export const affiliateCurrencyAggregateSchema = z
	.object({
		currency: affiliateCurrencySchema,
		attributedRevenueCents: z.int().nonnegative(),
		pendingCommissionCents: z.int(),
		approvedCommissionCents: z.int(),
		paidCommissionCents: z.int(),
		balanceCents: z.int(),
	})
	.strict();

export type AffiliateCurrencyAggregate = z.infer<
	typeof affiliateCurrencyAggregateSchema
>;

const affiliateProgramRecordShape = {
	id: uuidSchema,
	name: z.string().min(1),
	commissionDurationMonths: z.int().positive().nullable(),
	holdDays: z.int().nonnegative(),
	cookieWindowDays: z.int().positive(),
	status: affiliateProgramStatusSchema,
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
};

export const affiliateProgramSchema = z.discriminatedUnion("kind", [
	z
		.object({
			...affiliateProgramRecordShape,
			kind: z.literal("percentage_recurring"),
			commissionRateBps: affiliateCommissionRateBpsSchema,
			fixedAmountCents: z.null(),
			fixedCurrency: z.null(),
		})
		.strict(),
	z
		.object({
			...affiliateProgramRecordShape,
			kind: z.literal("fixed_one_time"),
			commissionRateBps: z.null(),
			fixedAmountCents: affiliatePositiveCentsSchema,
			fixedCurrency: affiliateCurrencySchema,
		})
		.strict(),
]);

export type AffiliateProgram = z.infer<typeof affiliateProgramSchema>;

export const affiliateProgramAggregateSchema = z
	.object({
		affiliateCount: z.int().nonnegative(),
		linkCount: z.int().nonnegative(),
		activeLinkCount: z.int().nonnegative(),
		attributedUserCount: z.int().nonnegative(),
		paidCustomerCount: z.int().nonnegative(),
		paidInvoiceCount: z.int().nonnegative(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliateProgramAggregate = z.infer<
	typeof affiliateProgramAggregateSchema
>;

const affiliateProgramInputShape = {
	name: z.string().trim().min(1).max(200),
	commissionDurationMonths: z.int().positive().max(1_200).nullable().optional(),
	holdDays: z.int().nonnegative().max(3_650).optional(),
	cookieWindowDays: z.int().positive().max(3_650).optional(),
	status: affiliateProgramStatusSchema.optional(),
};

export const createAffiliateProgramInputSchema = z.discriminatedUnion("kind", [
	z
		.object({
			...affiliateProgramInputShape,
			kind: z.literal("percentage_recurring"),
			commissionRateBps: affiliateCommissionRateBpsSchema,
		})
		.strict(),
	z
		.object({
			...affiliateProgramInputShape,
			kind: z.literal("fixed_one_time"),
			fixedAmountCents: affiliatePositiveCentsSchema,
			fixedCurrency: affiliateCurrencySchema,
		})
		.strict(),
]);

export type CreateAffiliateProgramInput = z.infer<
	typeof createAffiliateProgramInputSchema
>;

const affiliateProgramPatchShape = {
	name: z.string().trim().min(1).max(200).optional(),
	commissionDurationMonths: z.int().positive().max(1_200).nullable().optional(),
	holdDays: z.int().nonnegative().max(3_650).optional(),
	cookieWindowDays: z.int().positive().max(3_650).optional(),
	status: affiliateProgramStatusSchema.optional(),
};

export const updateAffiliateProgramInputSchema = z
	.union([
		z.object(affiliateProgramPatchShape).strict(),
		z
			.object({
				...affiliateProgramPatchShape,
				kind: z.literal("percentage_recurring"),
				commissionRateBps: affiliateCommissionRateBpsSchema,
			})
			.strict(),
		z
			.object({
				...affiliateProgramPatchShape,
				kind: z.literal("fixed_one_time"),
				fixedAmountCents: affiliatePositiveCentsSchema,
				fixedCurrency: affiliateCurrencySchema,
			})
			.strict(),
	])
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one program field must be provided",
	});

export type UpdateAffiliateProgramInput = z.infer<
	typeof updateAffiliateProgramInputSchema
>;

export const affiliateProgramListItemSchema = z
	.object({
		program: affiliateProgramSchema,
		aggregates: affiliateProgramAggregateSchema,
	})
	.strict();

export type AffiliateProgramListItem = z.infer<
	typeof affiliateProgramListItemSchema
>;

export const listAffiliateProgramsQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		kind: affiliateProgramKindSchema.optional(),
		status: affiliateProgramStatusSchema.optional(),
	})
	.strict();

export type ListAffiliateProgramsQuery = z.infer<
	typeof listAffiliateProgramsQuerySchema
>;

export const affiliateProgramsResponseSchema = paginatedResultSchema(
	affiliateProgramListItemSchema,
).strict();

export type AffiliateProgramsResponse = z.infer<
	typeof affiliateProgramsResponseSchema
>;

export const affiliateProgramDetailSchema = affiliateProgramListItemSchema;

export type AffiliateProgramDetail = z.infer<
	typeof affiliateProgramDetailSchema
>;

export const affiliateIdentitySchema = z
	.object({
		id: uuidSchema,
		name: z.string().min(1),
		email: z.email(),
	})
	.strict();

export type AffiliateIdentity = z.infer<typeof affiliateIdentitySchema>;

export const affiliateSchema = z
	.object({
		id: uuidSchema,
		userId: z.string().nullable(),
		name: z.string().min(1),
		email: z.email(),
		company: z.string().nullable(),
		channel: z.string().nullable(),
		country: z.string().nullable(),
		payoutMethod: affiliatePayoutMethodSchema,
		status: affiliateStatusSchema,
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	})
	.strict();

export type Affiliate = z.infer<typeof affiliateSchema>;

export const affiliateAggregateSchema = z
	.object({
		linkCount: z.int().nonnegative(),
		activeLinkCount: z.int().nonnegative(),
		clickCount: z.int().nonnegative(),
		uniqueVisitorCount: z.int().nonnegative(),
		attributedUserCount: z.int().nonnegative(),
		paidCustomerCount: z.int().nonnegative(),
		healthyTrials: z.int().nonnegative(),
		churnedCustomers: z.int().nonnegative(),
		referredMrrCents: z.int().nonnegative(),
		referredLtvCents: z.int().nonnegative().nullable(),
		paidInvoiceCount: z.int().nonnegative(),
		lastConversionAt: isoDateTimeSchema.nullable(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliateAggregate = z.infer<typeof affiliateAggregateSchema>;

export const affiliateListItemSchema = z
	.object({
		affiliate: affiliateSchema,
		aggregates: affiliateAggregateSchema,
	})
	.strict();

export type AffiliateListItem = z.infer<typeof affiliateListItemSchema>;

export const affiliatesSummarySchema = z
	.object({
		affiliateCount: z.int().nonnegative(),
		activeAffiliateCount: z.int().nonnegative(),
		linkCount: z.int().nonnegative(),
		activeLinkCount: z.int().nonnegative(),
		clickCount: z.int().nonnegative(),
		uniqueVisitorCount: z.int().nonnegative(),
		attributedUserCount: z.int().nonnegative(),
		paidCustomerCount: z.int().nonnegative(),
		paidInvoiceCount: z.int().nonnegative(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliatesSummary = z.infer<typeof affiliatesSummarySchema>;

export const affiliateListSorts = [
	"newest",
	"oldest",
	"name",
	"email",
] as const;

export const affiliateListSortSchema = z.enum(affiliateListSorts);

export const listAffiliatesQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		programId: uuidSchema.optional(),
		status: affiliateStatusSchema.optional(),
		sort: affiliateListSortSchema.default("newest"),
	})
	.strict();

export type ListAffiliatesQuery = z.infer<typeof listAffiliatesQuerySchema>;

export const affiliatesResponseSchema = paginatedResultSchema(
	affiliateListItemSchema,
)
	.extend({ summary: affiliatesSummarySchema })
	.strict();

export type AffiliatesResponse = z.infer<typeof affiliatesResponseSchema>;

const nullableTrimmedText = (max: number) =>
	z.string().trim().min(1).max(max).nullable();

export const createAffiliateInputSchema = z
	.object({
		userId: z.string().min(1).nullable().optional(),
		name: z.string().trim().min(1).max(200),
		email: z.email().max(320),
		company: nullableTrimmedText(200).optional(),
		channel: nullableTrimmedText(100).optional(),
		country: nullableTrimmedText(100).optional(),
		payoutMethod: affiliatePayoutMethodSchema.optional(),
		payoutDetails: z.record(z.string(), z.unknown()).nullable().optional(),
		status: affiliateStatusSchema.optional(),
		notes: nullableTrimmedText(5_000).optional(),
	})
	.strict();

export type CreateAffiliateInput = z.infer<typeof createAffiliateInputSchema>;

export const updateAffiliateInputSchema = z
	.object({
		userId: z.string().min(1).nullable().optional(),
		name: z.string().trim().min(1).max(200).optional(),
		email: z.email().max(320).optional(),
		company: nullableTrimmedText(200).optional(),
		channel: nullableTrimmedText(100).optional(),
		country: nullableTrimmedText(100).optional(),
		payoutMethod: affiliatePayoutMethodSchema.optional(),
		payoutDetails: z.record(z.string(), z.unknown()).nullable().optional(),
		status: affiliateStatusSchema.optional(),
		notes: nullableTrimmedText(5_000).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one affiliate field must be provided",
	});

export type UpdateAffiliateInput = z.infer<typeof updateAffiliateInputSchema>;

export const affiliateProgramIdentitySchema = z
	.object({
		id: uuidSchema,
		name: z.string().min(1),
		kind: affiliateProgramKindSchema,
		status: affiliateProgramStatusSchema,
	})
	.strict();

export type AffiliateProgramIdentity = z.infer<
	typeof affiliateProgramIdentitySchema
>;

export const affiliateLinkSchema = z
	.object({
		id: uuidSchema,
		programId: uuidSchema,
		affiliateId: uuidSchema,
		code: affiliateCodeSchema,
		label: z.string().nullable(),
		landingPath: z.string().min(1),
		expiresAt: isoDateTimeSchema.nullable(),
		active: z.boolean(),
		status: affiliateLinkStatusSchema,
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	})
	.strict();

export type AffiliateLink = z.infer<typeof affiliateLinkSchema>;

export const affiliateLinkAggregateSchema = z
	.object({
		clickCount: z.int().nonnegative(),
		uniqueVisitorCount: z.int().nonnegative(),
		attributedUserCount: z.int().nonnegative(),
		paidCustomerCount: z.int().nonnegative(),
		paidInvoiceCount: z.int().nonnegative(),
		lastConversionAt: isoDateTimeSchema.nullable(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliateLinkAggregate = z.infer<
	typeof affiliateLinkAggregateSchema
>;

export const affiliateLinkListItemSchema = z
	.object({
		link: affiliateLinkSchema,
		program: affiliateProgramIdentitySchema,
		aggregates: affiliateLinkAggregateSchema,
	})
	.strict();

export type AffiliateLinkListItem = z.infer<typeof affiliateLinkListItemSchema>;

const affiliateLandingPathSchema = z
	.string()
	.trim()
	.min(1)
	.max(2_048)
	.regex(/^\/(?!\/)/);

export const createAffiliateLinkInputSchema = z
	.object({
		programId: uuidSchema,
		code: affiliateCodeSchema,
		label: nullableTrimmedText(200).optional(),
		landingPath: affiliateLandingPathSchema,
		expiresAt: isoDateTimeSchema.nullable().optional(),
		active: z.boolean().optional(),
	})
	.strict();

export type CreateAffiliateLinkInput = z.infer<
	typeof createAffiliateLinkInputSchema
>;

export const updateAffiliateLinkInputSchema = z
	.object({
		programId: uuidSchema.optional(),
		code: affiliateCodeSchema.optional(),
		label: nullableTrimmedText(200).optional(),
		landingPath: affiliateLandingPathSchema.optional(),
		expiresAt: isoDateTimeSchema.nullable().optional(),
		active: z.boolean().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one link field must be provided",
	});

export type UpdateAffiliateLinkInput = z.infer<
	typeof updateAffiliateLinkInputSchema
>;

export const listAffiliateLinksQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		programId: uuidSchema.optional(),
		status: affiliateLinkStatusSchema.optional(),
	})
	.strict();

export type ListAffiliateLinksQuery = z.infer<
	typeof listAffiliateLinksQuerySchema
>;

export const affiliateLinksResponseSchema = paginatedResultSchema(
	affiliateLinkListItemSchema,
).strict();

export type AffiliateLinksResponse = z.infer<
	typeof affiliateLinksResponseSchema
>;

export const affiliateClickBodySchema = z
	.object({
		code: affiliateCodeSchema,
		landingUrl: z.url().max(2_048),
	})
	.strict();

export type AffiliateClickBody = z.infer<typeof affiliateClickBodySchema>;

export const affiliateClickResponseSchema = z
	.object({
		attributionToken: z.string().min(1).max(4_096),
		expiresAt: isoDateTimeSchema,
	})
	.strict();

export type AffiliateClickResponse = z.infer<
	typeof affiliateClickResponseSchema
>;

export const affiliateUserIdentitySchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		email: z.email(),
	})
	.strict();

export type AffiliateUserIdentity = z.infer<typeof affiliateUserIdentitySchema>;

export const affiliateLinkIdentitySchema = z
	.object({
		id: uuidSchema,
		code: affiliateCodeSchema,
		label: z.string().nullable(),
	})
	.strict();

export type AffiliateLinkIdentity = z.infer<typeof affiliateLinkIdentitySchema>;

export const affiliateDetailSchema = z
	.object({
		affiliate: affiliateSchema,
		aggregates: affiliateAggregateSchema,
		payoutDetails: z.record(z.string(), z.unknown()).nullable(),
		notes: z.string().nullable(),
		// The web-app account this partner profile is linked to (affiliates.userId),
		// resolved to an identity so the admin can see who gets portal access.
		linkedUser: affiliateUserIdentitySchema.nullable(),
		links: z.array(affiliateLinkListItemSchema),
	})
	.strict();

export type AffiliateDetail = z.infer<typeof affiliateDetailSchema>;

const affiliateAttributionRecordShape = {
	id: uuidSchema,
	userId: z.string().min(1),
	linkId: uuidSchema,
	affiliateId: uuidSchema,
	programId: uuidSchema,
	commissionDurationMonths: z.int().positive().nullable(),
	clickedAt: isoDateTimeSchema,
	lockedAt: isoDateTimeSchema,
	source: affiliateAttributionSourceSchema,
	status: affiliateAttributionStatusSchema,
	fraudFlags: z.array(affiliateFraudFlagSchema),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
};

export const affiliateAttributionSchema = z.discriminatedUnion("programKind", [
	z
		.object({
			...affiliateAttributionRecordShape,
			programKind: z.literal("percentage_recurring"),
			commissionRateBps: affiliateCommissionRateBpsSchema,
			fixedAmountCents: z.null(),
			fixedCurrency: z.null(),
		})
		.strict(),
	z
		.object({
			...affiliateAttributionRecordShape,
			programKind: z.literal("fixed_one_time"),
			commissionRateBps: z.null(),
			fixedAmountCents: affiliatePositiveCentsSchema,
			fixedCurrency: affiliateCurrencySchema,
		})
		.strict(),
]);

export type AffiliateAttribution = z.infer<typeof affiliateAttributionSchema>;

const affiliateAttributedUserJoinShape = {
	user: affiliateUserIdentitySchema,
	link: affiliateLinkIdentitySchema,
	program: affiliateProgramIdentitySchema,
	paidInvoiceCount: z.int().nonnegative(),
	firstPaidAt: isoDateTimeSchema.nullable(),
	lastPaidAt: isoDateTimeSchema.nullable(),
	currencies: z.array(affiliateCurrencyAggregateSchema),
};

export const affiliateAttributedUserSchema = z.discriminatedUnion(
	"programKind",
	[
		z
			.object({
				...affiliateAttributionRecordShape,
				...affiliateAttributedUserJoinShape,
				programKind: z.literal("percentage_recurring"),
				commissionRateBps: affiliateCommissionRateBpsSchema,
				fixedAmountCents: z.null(),
				fixedCurrency: z.null(),
			})
			.strict(),
		z
			.object({
				...affiliateAttributionRecordShape,
				...affiliateAttributedUserJoinShape,
				programKind: z.literal("fixed_one_time"),
				commissionRateBps: z.null(),
				fixedAmountCents: affiliatePositiveCentsSchema,
				fixedCurrency: affiliateCurrencySchema,
			})
			.strict(),
	],
);

export type AffiliateAttributedUser = z.infer<
	typeof affiliateAttributedUserSchema
>;

export const affiliateFraudFilters = ["all", "flagged", "clear"] as const;

export const affiliateFraudFilterSchema = z.enum(affiliateFraudFilters);

export const listAffiliateAttributionsQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		status: affiliateAttributionStatusSchema.optional(),
		fraud: affiliateFraudFilterSchema.default("all"),
	})
	.strict();

export type ListAffiliateAttributionsQuery = z.infer<
	typeof listAffiliateAttributionsQuerySchema
>;

export const affiliateAttributionsResponseSchema = paginatedResultSchema(
	affiliateAttributedUserSchema,
).strict();

export type AffiliateAttributionsResponse = z.infer<
	typeof affiliateAttributionsResponseSchema
>;

const affiliateCommissionRecordShape = {
	id: uuidSchema,
	attributionId: uuidSchema,
	affiliateId: uuidSchema,
	stripeInvoiceId: z.string().min(1),
	stripeRefundId: z.string().min(1).nullable(),
	stripeDisputeId: z.string().min(1).nullable(),
	stripeChargeId: z.string().min(1),
	currency: affiliateCurrencySchema,
	baseAmountCents: z.int().nonnegative(),
	rateBps: affiliateCommissionRateBpsSchema.nullable(),
	status: affiliateCommissionStatusSchema,
	holdUntil: isoDateTimeSchema,
	payoutId: uuidSchema.nullable(),
	reversalReason: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
};

export const affiliateCommissionSchema = z.discriminatedUnion("entryType", [
	z
		.object({
			...affiliateCommissionRecordShape,
			entryType: z.literal("earning"),
			originalCommissionId: z.null(),
			amountCents: affiliatePositiveCentsSchema,
		})
		.strict(),
	z
		.object({
			...affiliateCommissionRecordShape,
			entryType: z.literal("adjustment"),
			originalCommissionId: uuidSchema,
			amountCents: z.int(),
		})
		.strict(),
]);

export type AffiliateCommission = z.infer<typeof affiliateCommissionSchema>;

const affiliateCommissionJoinShape = {
	affiliate: affiliateIdentitySchema,
	attributedUser: affiliateUserIdentitySchema,
	link: affiliateLinkIdentitySchema,
};

export const affiliateCommissionLedgerEntrySchema = z.discriminatedUnion(
	"entryType",
	[
		z
			.object({
				...affiliateCommissionRecordShape,
				...affiliateCommissionJoinShape,
				entryType: z.literal("earning"),
				originalCommissionId: z.null(),
				amountCents: affiliatePositiveCentsSchema,
			})
			.strict(),
		z
			.object({
				...affiliateCommissionRecordShape,
				...affiliateCommissionJoinShape,
				entryType: z.literal("adjustment"),
				originalCommissionId: uuidSchema,
				amountCents: z.int(),
			})
			.strict(),
	],
);

export type AffiliateCommissionLedgerEntry = z.infer<
	typeof affiliateCommissionLedgerEntrySchema
>;

export const affiliateCommissionListSorts = ["newest", "oldest"] as const;

export const affiliateCommissionListSortSchema = z.enum(
	affiliateCommissionListSorts,
);

export const listAffiliateCommissionsQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		affiliateId: uuidSchema.optional(),
		entryType: affiliateCommissionEntryTypeSchema.optional(),
		status: affiliateCommissionStatusSchema.optional(),
		currency: affiliateCurrencySchema.optional(),
		from: isoDateTimeSchema.optional(),
		to: isoDateTimeSchema.optional(),
		sort: affiliateCommissionListSortSchema.default("newest"),
	})
	.strict();

export type ListAffiliateCommissionsQuery = z.infer<
	typeof listAffiliateCommissionsQuerySchema
>;

export const affiliateCommissionsResponseSchema = paginatedResultSchema(
	affiliateCommissionLedgerEntrySchema,
).strict();

export type AffiliateCommissionsResponse = z.infer<
	typeof affiliateCommissionsResponseSchema
>;

export const affiliatePayoutSchema = z
	.object({
		id: uuidSchema,
		affiliateId: uuidSchema,
		totalCents: affiliatePositiveCentsSchema,
		currency: affiliateCurrencySchema,
		method: affiliatePayoutMethodSchema,
		externalRef: z.string().nullable(),
		requestId: uuidSchema,
		status: affiliatePayoutStatusSchema,
		periodStart: isoDateTimeSchema,
		periodEnd: isoDateTimeSchema,
		paidAt: isoDateTimeSchema.nullable(),
		createdByUserId: z.string().min(1),
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	})
	.strict();

export type AffiliatePayout = z.infer<typeof affiliatePayoutSchema>;

export const affiliatePayoutListItemSchema = z
	.object({
		payout: affiliatePayoutSchema,
		affiliate: affiliateIdentitySchema,
		entryCount: z.int().nonnegative(),
	})
	.strict();

export type AffiliatePayoutListItem = z.infer<
	typeof affiliatePayoutListItemSchema
>;

export const affiliatePayoutDetailSchema = z
	.object({
		payout: affiliatePayoutSchema,
		affiliate: affiliateIdentitySchema,
		entries: z.array(affiliateCommissionLedgerEntrySchema),
	})
	.strict();

export type AffiliatePayoutDetail = z.infer<typeof affiliatePayoutDetailSchema>;

export const buildAffiliatePayoutInputSchema = z
	.object({
		affiliateId: uuidSchema,
		currency: affiliateCurrencySchema,
		requestId: uuidSchema,
	})
	.strict();

export type BuildAffiliatePayoutInput = z.infer<
	typeof buildAffiliatePayoutInputSchema
>;

export const markAffiliatePayoutPaidInputSchema = z
	.object({
		externalRef: z.string().trim().min(1).max(500),
	})
	.strict();

export type MarkAffiliatePayoutPaidInput = z.infer<
	typeof markAffiliatePayoutPaidInputSchema
>;

export const markAffiliatePayoutFailedInputSchema = z
	.object({
		reason: z.string().trim().min(1).max(500).optional(),
	})
	.strict();

export type MarkAffiliatePayoutFailedInput = z.infer<
	typeof markAffiliatePayoutFailedInputSchema
>;

export const listAffiliatePayoutsQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		affiliateId: uuidSchema.optional(),
		status: affiliatePayoutStatusSchema.optional(),
		currency: affiliateCurrencySchema.optional(),
	})
	.strict();

export type ListAffiliatePayoutsQuery = z.infer<
	typeof listAffiliatePayoutsQuerySchema
>;

export const affiliatePayoutsResponseSchema = paginatedResultSchema(
	affiliatePayoutListItemSchema,
).strict();

export type AffiliatePayoutsResponse = z.infer<
	typeof affiliatePayoutsResponseSchema
>;

export const affiliateCsvExportQuerySchema = z
	.object({
		q: z.string().trim().min(1).max(200).optional(),
		programId: uuidSchema.optional(),
		status: affiliateStatusSchema.optional(),
	})
	.strict();

export type AffiliateCsvExportQuery = z.infer<
	typeof affiliateCsvExportQuerySchema
>;

export const deleteAffiliateResourceResponseSchema = z
	.object({ deleted: z.literal(true) })
	.strict();

export type DeleteAffiliateResourceResponse = z.infer<
	typeof deleteAffiliateResourceResponseSchema
>;

// ---------------------------------------------------------------------------
// Affiliate portal — the self-serve view a partner gets inside the web app.
//
// User-scoped: the API resolves the caller's affiliate row through
// affiliates.userId (UNIQUE) and never accepts an affiliateId from the client.
// Referred users are PII-masked (maskedEmail only) and Stripe/internal ids,
// admin notes and fraud details are deliberately absent from every schema.
// ---------------------------------------------------------------------------

export const affiliatePortalProfileSchema = z
	.object({
		id: uuidSchema,
		name: z.string().min(1),
		email: z.email(),
		status: affiliateStatusSchema,
		payoutMethod: affiliatePayoutMethodSchema,
		createdAt: isoDateTimeSchema,
	})
	.strict();

export type AffiliatePortalProfile = z.infer<
	typeof affiliatePortalProfileSchema
>;

/**
 * `affiliate` is null when the signed-in user is not linked to any partner
 * profile. 200 + null (not 404) so clients can cache "not an affiliate" as
 * data and gate navigation without treating it as an error.
 */
export const affiliatePortalMeResponseSchema = z
	.object({
		affiliate: affiliatePortalProfileSchema.nullable(),
	})
	.strict();

export type AffiliatePortalMeResponse = z.infer<
	typeof affiliatePortalMeResponseSchema
>;

export const affiliatePortalAggregateSchema = z
	.object({
		linkCount: z.int().nonnegative(),
		activeLinkCount: z.int().nonnegative(),
		clickCount: z.int().nonnegative(),
		uniqueVisitorCount: z.int().nonnegative(),
		attributedUserCount: z.int().nonnegative(),
		paidCustomerCount: z.int().nonnegative(),
		paidInvoiceCount: z.int().nonnegative(),
		lastConversionAt: isoDateTimeSchema.nullable(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliatePortalAggregate = z.infer<
	typeof affiliatePortalAggregateSchema
>;

/** One of the partner's links with the full program terms it pays under. */
export const affiliatePortalLinkSchema = z
	.object({
		link: affiliateLinkSchema,
		program: affiliateProgramSchema,
		aggregates: affiliateLinkAggregateSchema,
	})
	.strict();

export type AffiliatePortalLink = z.infer<typeof affiliatePortalLinkSchema>;

export const affiliatePortalOverviewSchema = z
	.object({
		affiliate: affiliatePortalProfileSchema,
		aggregates: affiliatePortalAggregateSchema,
		links: z.array(affiliatePortalLinkSchema),
	})
	.strict();

export type AffiliatePortalOverview = z.infer<
	typeof affiliatePortalOverviewSchema
>;

/** A referred signup, identity-masked. `signedUpAt` is the attribution lock. */
export const affiliatePortalReferralSchema = z
	.object({
		id: uuidSchema,
		maskedEmail: z.string().min(1),
		signedUpAt: isoDateTimeSchema,
		status: affiliateAttributionStatusSchema,
		link: affiliateLinkIdentitySchema,
		program: affiliateProgramIdentitySchema,
		programKind: affiliateProgramKindSchema,
		commissionRateBps: affiliateCommissionRateBpsSchema.nullable(),
		fixedAmountCents: affiliatePositiveCentsSchema.nullable(),
		fixedCurrency: affiliateCurrencySchema.nullable(),
		commissionDurationMonths: z.int().positive().nullable(),
		paidInvoiceCount: z.int().nonnegative(),
		firstPaidAt: isoDateTimeSchema.nullable(),
		lastPaidAt: isoDateTimeSchema.nullable(),
		currencies: z.array(affiliateCurrencyAggregateSchema),
	})
	.strict();

export type AffiliatePortalReferral = z.infer<
	typeof affiliatePortalReferralSchema
>;

export const listAffiliatePortalReferralsQuerySchema = paginationQuerySchema
	.extend({
		status: affiliateAttributionStatusSchema.optional(),
	})
	.strict();

export type ListAffiliatePortalReferralsQuery = z.infer<
	typeof listAffiliatePortalReferralsQuerySchema
>;

export const affiliatePortalReferralsResponseSchema = paginatedResultSchema(
	affiliatePortalReferralSchema,
).strict();

export type AffiliatePortalReferralsResponse = z.infer<
	typeof affiliatePortalReferralsResponseSchema
>;

/**
 * Closed set of adjustment reasons shown to partners. The ledger column is
 * free text and may carry Stripe object ids (e.g. `dispute_won:dp_…`); the
 * portal mapper reduces it to one of these codes so no Stripe id leaks.
 */
export const affiliatePortalReversalReasons = [
	"charge_refunded",
	"charge_dispute_created",
	"dispute_won",
	"dispute_closed",
] as const;

export const affiliatePortalReversalReasonSchema = z.enum(
	affiliatePortalReversalReasons,
);

export type AffiliatePortalReversalReason = z.infer<
	typeof affiliatePortalReversalReasonSchema
>;

export const affiliatePortalCommissionSchema = z
	.object({
		id: uuidSchema,
		entryType: affiliateCommissionEntryTypeSchema,
		status: affiliateCommissionStatusSchema,
		currency: affiliateCurrencySchema,
		baseAmountCents: z.int().nonnegative(),
		rateBps: affiliateCommissionRateBpsSchema.nullable(),
		// Positive for earnings, negative (or compensating positive) for adjustments.
		amountCents: z.int(),
		holdUntil: isoDateTimeSchema,
		payoutId: uuidSchema.nullable(),
		reversalReason: affiliatePortalReversalReasonSchema.nullable(),
		createdAt: isoDateTimeSchema,
		referral: z
			.object({
				id: uuidSchema,
				maskedEmail: z.string().min(1),
			})
			.strict(),
		link: affiliateLinkIdentitySchema,
	})
	.strict();

export type AffiliatePortalCommission = z.infer<
	typeof affiliatePortalCommissionSchema
>;

export const listAffiliatePortalCommissionsQuerySchema = paginationQuerySchema
	.extend({
		entryType: affiliateCommissionEntryTypeSchema.optional(),
		status: affiliateCommissionStatusSchema.optional(),
		currency: affiliateCurrencySchema.optional(),
	})
	.strict();

export type ListAffiliatePortalCommissionsQuery = z.infer<
	typeof listAffiliatePortalCommissionsQuerySchema
>;

export const affiliatePortalCommissionsResponseSchema = paginatedResultSchema(
	affiliatePortalCommissionSchema,
).strict();

export type AffiliatePortalCommissionsResponse = z.infer<
	typeof affiliatePortalCommissionsResponseSchema
>;

export const affiliatePortalPayoutSchema = z
	.object({
		id: uuidSchema,
		totalCents: affiliatePositiveCentsSchema,
		currency: affiliateCurrencySchema,
		method: affiliatePayoutMethodSchema,
		externalRef: z.string().nullable(),
		status: affiliatePayoutStatusSchema,
		periodStart: isoDateTimeSchema,
		periodEnd: isoDateTimeSchema,
		paidAt: isoDateTimeSchema.nullable(),
		entryCount: z.int().nonnegative(),
		createdAt: isoDateTimeSchema,
	})
	.strict();

export type AffiliatePortalPayout = z.infer<typeof affiliatePortalPayoutSchema>;

export const listAffiliatePortalPayoutsQuerySchema = paginationQuerySchema
	.extend({
		status: affiliatePayoutStatusSchema.optional(),
	})
	.strict();

export type ListAffiliatePortalPayoutsQuery = z.infer<
	typeof listAffiliatePortalPayoutsQuerySchema
>;

export const affiliatePortalPayoutsResponseSchema = paginatedResultSchema(
	affiliatePortalPayoutSchema,
).strict();

export type AffiliatePortalPayoutsResponse = z.infer<
	typeof affiliatePortalPayoutsResponseSchema
>;

const adminAffiliatesRoot = "/api/v1/admin/affiliates";
const affiliatePortalRoot = "/api/v1/affiliates/me";

export const affiliatesRoutes = {
	click: "/api/v1/affiliates/click",
	// Self-serve portal (user-scoped; the caller's affiliate row is resolved
	// from the session, never from a client-supplied id).
	portalMe: affiliatePortalRoot,
	portalOverview: `${affiliatePortalRoot}/overview`,
	portalReferrals: `${affiliatePortalRoot}/referrals`,
	portalCommissions: `${affiliatePortalRoot}/commissions`,
	portalPayouts: `${affiliatePortalRoot}/payouts`,
	adminAffiliates: adminAffiliatesRoot,
	adminAffiliate: (affiliateId: string) =>
		`${adminAffiliatesRoot}/${encodeURIComponent(affiliateId)}`,
	adminAffiliateLinks: (affiliateId: string) =>
		`${adminAffiliatesRoot}/${encodeURIComponent(affiliateId)}/links`,
	adminAffiliateLink: (affiliateId: string, linkId: string) =>
		`${adminAffiliatesRoot}/${encodeURIComponent(affiliateId)}/links/${encodeURIComponent(linkId)}`,
	adminAffiliateAttributions: (affiliateId: string) =>
		`${adminAffiliatesRoot}/${encodeURIComponent(affiliateId)}/attributions`,
	adminPrograms: `${adminAffiliatesRoot}/programs`,
	adminProgram: (programId: string) =>
		`${adminAffiliatesRoot}/programs/${encodeURIComponent(programId)}`,
	adminCommissions: `${adminAffiliatesRoot}/commissions`,
	adminPayouts: `${adminAffiliatesRoot}/payouts`,
	adminPayout: (payoutId: string) =>
		`${adminAffiliatesRoot}/payouts/${encodeURIComponent(payoutId)}`,
	adminPayoutMarkPaid: (payoutId: string) =>
		`${adminAffiliatesRoot}/payouts/${encodeURIComponent(payoutId)}/mark-paid`,
	adminPayoutMarkFailed: (payoutId: string) =>
		`${adminAffiliatesRoot}/payouts/${encodeURIComponent(payoutId)}/mark-failed`,
	adminExport: `${adminAffiliatesRoot}/export`,
} as const;

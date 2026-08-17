import { z } from "zod";
import {
	paginatedResultSchema,
	paginationQuerySchema,
} from "../http/pagination";
import { billingPlanIdSchema } from "./billing";
import {
	creditBalanceResponseSchema,
	creditBucketSchema,
	creditKindSchema,
} from "./credits";
import {
	deploymentSlugSchema,
	deploymentStatusSchema,
	deploymentUiStateSchema,
} from "./deployments";
import { domainStatusSchema } from "./domains";
import { leadScrapeAttemptSchema } from "./lead-scrapes";
import { leadSchema } from "./leads";
import {
	marketingAssetStatusSchema,
	marketingAssetTypeSchema,
} from "./marketing-assets";
import { pageAttemptStatusSchema, pageVersionListItemSchema } from "./pages";
import { projectAssetSourceSchema } from "./project-assets";
import { isoDateTimeSchema, uuidSchema } from "./shared/primitives";

// Admin contracts (consumed by apps/admin only). Every route below sits behind
// the AdminGuard: non-admin sessions get 404 (not 403) per docs/api-security.md.

function optionalCsvEnum<const Values extends readonly [string, ...string[]]>(
	values: Values,
) {
	return z
		.string()
		.optional()
		.transform((value) => {
			if (value === undefined) {
				return undefined;
			}

			const uniqueValues = [
				...new Set(
					value
						.split(",")
						.map((item) => item.trim())
						.filter((item) => item.length > 0),
				),
			];

			return uniqueValues.length > 0 ? uniqueValues : undefined;
		})
		.pipe(z.array(z.enum(values)).nonempty().optional());
}

export const adminUserRoles = ["user", "admin"] as const;

export const adminUserRoleSchema = z.enum(adminUserRoles);

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;

/**
 * Admin check for the stored `user.role` string.
 *
 * Better Auth persists multiple roles comma-joined ("user,admin"), so an exact
 * `role === "admin"` comparison would silently miss a real admin.
 */
export function isAdminRole(role: string | null | undefined): boolean {
	return (role ?? "")
		.split(",")
		.some((value) => value.trim().toLowerCase() === "admin");
}

// "free" is derived (no entitled subscription row), not stored.
export const adminUserPlans = ["free", "pro", "business"] as const;

export const adminUserPlanSchema = z.enum(adminUserPlans);

export type AdminUserPlan = z.infer<typeof adminUserPlanSchema>;

export const adminUserSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.email(),
	emailVerified: z.boolean(),
	image: z.string().nullable(),
	role: adminUserRoleSchema,
	banned: z.boolean(),
	createdAt: isoDateTimeSchema,
	// Last authenticated request, refreshed at most every few minutes; null when
	// the user has never been seen since the column was introduced.
	lastSeenAt: isoDateTimeSchema.nullable(),
	plan: adminUserPlanSchema,
	// Decimal credits (server divides internal centi-credits by 100).
	creditsBalance: z.number(),
	creditsConsumed: z.number().nonnegative(),
	projectsCount: z.int(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminListUsersSorts = [
	"newest",
	"oldest",
	"name",
	"email",
	"most_projects",
	"most_credits",
	"most_consumed",
	"recently_seen",
] as const;

export const adminListUsersSortSchema = z.enum(adminListUsersSorts);

export type AdminListUsersSort = z.infer<typeof adminListUsersSortSchema>;

export const adminUserStatuses = ["active", "banned"] as const;

export const adminUserStatusSchema = z.enum(adminUserStatuses);

export type AdminUserStatus = z.infer<typeof adminUserStatusSchema>;

export const adminUserVerificationStatuses = [
	"verified",
	"unverified",
] as const;

export const adminUserVerificationStatusSchema = z.enum(
	adminUserVerificationStatuses,
);

export type AdminUserVerificationStatus = z.infer<
	typeof adminUserVerificationStatusSchema
>;

export const adminListUsersQuerySchema = paginationQuerySchema
	.extend({
		q: z.string().trim().min(1).max(200).optional(),
		sort: adminListUsersSortSchema.default("newest"),
		plan: optionalCsvEnum(adminUserPlans),
		role: optionalCsvEnum(adminUserRoles),
		status: optionalCsvEnum(adminUserStatuses),
		verified: optionalCsvEnum(adminUserVerificationStatuses),
		// Net credits-consumed range in decimal credits (the server compares
		// x100 against centi-credit sums). Both bounds are inclusive; an
		// omitted max means unbounded. Query params arrive as strings — coerce.
		creditsUsedMin: z.coerce.number().nonnegative().optional(),
		creditsUsedMax: z.coerce.number().nonnegative().optional(),
	})
	.refine(
		(query) =>
			query.creditsUsedMin === undefined ||
			query.creditsUsedMax === undefined ||
			query.creditsUsedMin <= query.creditsUsedMax,
		{
			message: "creditsUsedMin must be less than or equal to creditsUsedMax",
			path: ["creditsUsedMin"],
		},
	);

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

export const adminListUsersResponseSchema = paginatedResultSchema(
	adminUserSummarySchema,
);

export type AdminListUsersResponse = z.infer<
	typeof adminListUsersResponseSchema
>;

export const adminUserSubscriptionSchema = z.object({
	plan: billingPlanIdSchema,
	status: z.string(),
	interval: z.enum(["month", "year"]),
	// Purchased credit tier of the current price (credits refilled per month).
	// Plain positive int rather than creditTierSchema so legacy or hand-migrated
	// prices outside the current catalog still render in the admin.
	tierCredits: z.int().positive(),
	// Scheduled period-end downgrade target, when one is pending.
	pendingTierCredits: z.int().positive().nullable(),
	currentPeriodEnd: isoDateTimeSchema.nullable(),
	cancelAtPeriodEnd: z.boolean(),
});

export type AdminUserSubscription = z.infer<typeof adminUserSubscriptionSchema>;

export const adminUserProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: isoDateTimeSchema,
});

export type AdminUserProject = z.infer<typeof adminUserProjectSchema>;

export const adminUserProjectsSorts = ["newest", "oldest"] as const;

export const adminUserProjectsSortSchema = z.enum(adminUserProjectsSorts);

export type AdminUserProjectsSort = z.infer<typeof adminUserProjectsSortSchema>;

export const adminUserProjectsQuerySchema = paginationQuerySchema.extend({
	sort: adminUserProjectsSortSchema.default("newest"),
});

export type AdminUserProjectsQuery = z.infer<
	typeof adminUserProjectsQuerySchema
>;

export const adminUserProjectsResponseSchema = paginatedResultSchema(
	adminUserProjectSchema,
);

export type AdminUserProjectsResponse = z.infer<
	typeof adminUserProjectsResponseSchema
>;

export const adminCreditLedgerEntrySchema = z.object({
	id: uuidSchema,
	// Decimal credits; settle deltas can be fractional (e.g. -0.37).
	delta: z.number(),
	kind: creditKindSchema,
	bucket: creditBucketSchema,
	meta: z.record(z.string(), z.unknown()).nullable(),
	createdAt: isoDateTimeSchema,
	// AI-cost enrichment, joined from the ai_usage_events row the ledger entry's
	// meta.usageEventId points to. Null on rows with no metered operation
	// (grants, top-ups) — and the cost is the OPERATION's actual provider cost
	// (reconciled when available, else estimated), so reserve + settle rows of
	// the same operation display the same figure.
	aiModel: z.string().nullable(),
	aiProvider: z.string().nullable(),
	aiCostUsdMicros: z.int().nullable(),
});

export type AdminCreditLedgerEntry = z.infer<
	typeof adminCreditLedgerEntrySchema
>;

// Team workspaces the user belongs to (teams-workspaces.md §10).
export const adminUserWorkspaceSchema = z.object({
	organizationId: z.string(),
	name: z.string(),
	slug: z.string(),
	// Comma-joined multi-role string as Better Auth stores it.
	role: z.string(),
	joinedAt: isoDateTimeSchema,
});

export type AdminUserWorkspace = z.infer<typeof adminUserWorkspaceSchema>;

// Actual AI-provider spend for an owner pool (personal or org), summed over
// ai_usage_events with reconciled cost preferred over the settle estimate.
export const adminAiSpendSchema = z.object({
	totalCostUsdMicros: z.int(),
	meteredOperations: z.int(),
});

export type AdminAiSpend = z.infer<typeof adminAiSpendSchema>;

export const adminUserDetailSchema = adminUserSummarySchema.extend({
	updatedAt: isoDateTimeSchema,
	banReason: z.string().nullable(),
	subscription: adminUserSubscriptionSchema.nullable(),
	projects: z.array(adminUserProjectSchema),
	creditLedger: z.array(adminCreditLedgerEntrySchema),
	workspaces: z.array(adminUserWorkspaceSchema),
	aiSpend: adminAiSpendSchema,
});

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminUserPagesSorts = [
	"newest",
	"oldest",
	"recently_updated",
] as const;

export const adminUserPagesSortSchema = z.enum(adminUserPagesSorts);

export type AdminUserPagesSort = z.infer<typeof adminUserPagesSortSchema>;

export const adminUserPagesQuerySchema = paginationQuerySchema.extend({
	sort: adminUserPagesSortSchema.default("recently_updated"),
});

export type AdminUserPagesQuery = z.infer<typeof adminUserPagesQuerySchema>;

export const adminUserPageSchema = z.object({
	project: z.object({
		id: uuidSchema,
		name: z.string(),
		organizationId: z.string().nullable(),
		previewImageUrl: z.string().nullable(),
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
	}),
	page: z.object({
		activeVersion: z
			.object({
				id: uuidSchema,
				number: z.int(),
				createdAt: isoDateTimeSchema,
			})
			.nullable(),
		latestGeneration: z
			.object({
				status: pageAttemptStatusSchema,
				createdAt: isoDateTimeSchema,
				completedAt: isoDateTimeSchema.nullable(),
			})
			.nullable(),
	}),
	deployment: z.object({
		published: z.boolean(),
		latestStatus: deploymentStatusSchema.nullable(),
		slug: z.string().nullable(),
		liveUrl: z.url().nullable(),
		publicUrl: z.url().nullable(),
		publishedAt: isoDateTimeSchema.nullable(),
	}),
	primaryDomain: z
		.object({
			name: z.string(),
			status: domainStatusSchema,
		})
		.nullable(),
});

export type AdminUserPage = z.infer<typeof adminUserPageSchema>;

export const adminUserPagesResponseSchema =
	paginatedResultSchema(adminUserPageSchema);

export type AdminUserPagesResponse = z.infer<
	typeof adminUserPagesResponseSchema
>;

export const adminProjectVersionHtmlResponseSchema = z.object({
	html: z.string(),
});

export type AdminProjectVersionHtmlResponse = z.infer<
	typeof adminProjectVersionHtmlResponseSchema
>;

export const adminProjectVersionsQuerySchema = paginationQuerySchema.extend({
	pageSize: z.coerce.number().int().min(1).max(24).default(8),
});

export type AdminProjectVersionsQuery = z.infer<
	typeof adminProjectVersionsQuerySchema
>;

export const adminProjectVersionListItemSchema =
	pageVersionListItemSchema.extend({
		isActive: z.boolean(),
	});

export type AdminProjectVersionListItem = z.infer<
	typeof adminProjectVersionListItemSchema
>;

export const adminProjectVersionsResponseSchema = paginatedResultSchema(
	adminProjectVersionListItemSchema,
);

export type AdminProjectVersionsResponse = z.infer<
	typeof adminProjectVersionsResponseSchema
>;

export const adminProjectMetadataSchema = z.object({
	id: uuidSchema,
	name: z.string(),
	createdAt: isoDateTimeSchema,
	updatedAt: isoDateTimeSchema,
});

export type AdminProjectMetadata = z.infer<typeof adminProjectMetadataSchema>;

export const adminProjectOwnerSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.email(),
});

export type AdminProjectOwner = z.infer<typeof adminProjectOwnerSchema>;

export const adminProjectAssetKinds = ["image", "video", "build-file"] as const;

export const adminProjectAssetKindSchema = z.enum(adminProjectAssetKinds);

export type AdminProjectAssetKind = z.infer<typeof adminProjectAssetKindSchema>;

export const adminProjectAssetSchema = z.object({
	id: z.string().min(1),
	kind: adminProjectAssetKindSchema,
	name: z.string().min(1),
	url: z.url(),
	mediaType: z.string().min(1),
	source: projectAssetSourceSchema,
	createdAt: isoDateTimeSchema.nullable(),
});

export type AdminProjectAsset = z.infer<typeof adminProjectAssetSchema>;

export const adminProjectWebsiteSchema = z.object({
	activeVersionNumber: z.int().positive().nullable(),
	versionsCount: z.int().nonnegative(),
	latestAttemptStatus: pageAttemptStatusSchema.nullable(),
	currentDeployment: z.object({
		status: deploymentUiStateSchema,
		slug: deploymentSlugSchema.nullable(),
		liveUrl: z.url().nullable(),
	}),
	deploymentHistoryCount: z.int().nonnegative(),
});

export type AdminProjectWebsite = z.infer<typeof adminProjectWebsiteSchema>;

export const adminProjectMarketingAssetSchema = z.object({
	id: uuidSchema,
	name: z.string().min(1),
	type: marketingAssetTypeSchema,
	status: marketingAssetStatusSchema,
	createdAt: isoDateTimeSchema,
});

export type AdminProjectMarketingAsset = z.infer<
	typeof adminProjectMarketingAssetSchema
>;

export const adminProjectLeadsSchema = z.object({
	recent: z.array(leadSchema),
	total: z.int().nonnegative(),
});

export type AdminProjectLeads = z.infer<typeof adminProjectLeadsSchema>;

export const adminProjectLeadScrapeExportsSchema = z.object({
	recent: z.array(leadScrapeAttemptSchema),
	total: z.int().nonnegative(),
});

export type AdminProjectLeadScrapeExports = z.infer<
	typeof adminProjectLeadScrapeExportsSchema
>;

export const adminProjectDomainSchema = z.object({
	id: uuidSchema,
	name: z.string().min(1),
	status: domainStatusSchema,
	primary: z.boolean(),
});

export type AdminProjectDomain = z.infer<typeof adminProjectDomainSchema>;

export const adminProjectSheetsIntegrationSchema = z.object({
	connected: z.boolean(),
	spreadsheetUrl: z.url().nullable(),
	lastSyncAt: isoDateTimeSchema.nullable(),
});

export type AdminProjectSheetsIntegration = z.infer<
	typeof adminProjectSheetsIntegrationSchema
>;

export const adminProjectDetailSchema = z.object({
	project: adminProjectMetadataSchema,
	owner: adminProjectOwnerSchema,
	assets: z.array(adminProjectAssetSchema),
	website: adminProjectWebsiteSchema,
	marketingAssets: z.array(adminProjectMarketingAssetSchema),
	leads: adminProjectLeadsSchema,
	leadScrapeExports: adminProjectLeadScrapeExportsSchema,
	domains: z.array(adminProjectDomainSchema),
	integrations: z.object({
		sheets: adminProjectSheetsIntegrationSchema,
	}),
});

export type AdminProjectDetail = z.infer<typeof adminProjectDetailSchema>;

export const adminGrantCreditsInputSchema = z.object({
	// Decimal credits in 0.01 steps; the server multiplies x100 (Math.round)
	// exactly once before writing centi-credits to the ledger.
	amount: z.number().positive().multipleOf(0.01).max(1_000_000),
	reason: z.string().trim().min(1).max(500).optional(),
	// Client-minted per-submission id. Required, not optional: it becomes the
	// credit ledger idempotency key, so a retried or double-submitted grant
	// must not credit twice.
	requestId: uuidSchema,
});

export type AdminGrantCreditsInput = z.infer<
	typeof adminGrantCreditsInputSchema
>;

export const adminSetRoleInputSchema = z.object({
	role: adminUserRoleSchema,
});

export type AdminSetRoleInput = z.infer<typeof adminSetRoleInputSchema>;

export const adminSetBannedInputSchema = z.object({
	banned: z.boolean(),
	reason: z.string().trim().min(1).max(500).optional(),
});

export type AdminSetBannedInput = z.infer<typeof adminSetBannedInputSchema>;

// --- Organizations (teams/workspaces, teams-workspaces.md §10) ---

export const adminWorkspaceRoles = ["owner", "admin", "member"] as const;

export const adminWorkspaceRoleSchema = z.enum(adminWorkspaceRoles);

export type AdminWorkspaceRole = z.infer<typeof adminWorkspaceRoleSchema>;

export const adminOrganizationSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable(),
	createdAt: isoDateTimeSchema,
	membersCount: z.int(),
	projectsCount: z.int(),
	plan: adminUserPlanSchema,
	// Decimal credits (server divides internal centi-credits by 100).
	creditsBalance: z.number(),
});

export type AdminOrganizationSummary = z.infer<
	typeof adminOrganizationSummarySchema
>;

export const adminListOrganizationsSorts = [
	"newest",
	"oldest",
	"name",
] as const;

export const adminListOrganizationsQuerySchema = paginationQuerySchema.extend({
	q: z.string().trim().min(1).max(200).optional(),
	sort: z.enum(adminListOrganizationsSorts).default("newest"),
});

export type AdminListOrganizationsQuery = z.infer<
	typeof adminListOrganizationsQuerySchema
>;

export const adminListOrganizationsResponseSchema = paginatedResultSchema(
	adminOrganizationSummarySchema,
);

export type AdminListOrganizationsResponse = z.infer<
	typeof adminListOrganizationsResponseSchema
>;

export const adminOrganizationMemberSchema = z.object({
	userId: z.string(),
	name: z.string(),
	email: z.email(),
	image: z.string().nullable(),
	// Comma-joined multi-role string as Better Auth stores it; check membership
	// with the role helpers, never string equality.
	role: z.string(),
	joinedAt: isoDateTimeSchema,
	// Whole credits (limits are configured whole; stored x100 internally).
	monthlyCreditLimit: z.int().nullable(),
	// Decimal credits — member consumption is fractional under pricing v4.
	spentThisMonth: z.number(),
});

export type AdminOrganizationMember = z.infer<
	typeof adminOrganizationMemberSchema
>;

export const adminOrganizationSubscriptionSchema =
	adminUserSubscriptionSchema.extend({
		tierCredits: z.int(),
		// Purchase provenance: the owner whose checkout created the subscription.
		purchasedByUserId: z.string().nullable(),
	});

export type AdminOrganizationSubscription = z.infer<
	typeof adminOrganizationSubscriptionSchema
>;

export const adminOrganizationLedgerEntrySchema =
	adminCreditLedgerEntrySchema.extend({
		// Acting member on consumption rows; null on pool-owned rows (grants,
		// plan holds) — the pool paid, no single member acted.
		actorUserId: z.string().nullable(),
		actorName: z.string().nullable(),
	});

export type AdminOrganizationLedgerEntry = z.infer<
	typeof adminOrganizationLedgerEntrySchema
>;

export const adminOrganizationDetailSchema =
	adminOrganizationSummarySchema.extend({
		members: z.array(adminOrganizationMemberSchema),
		pendingInvitationsCount: z.int(),
		subscription: adminOrganizationSubscriptionSchema.nullable(),
		balance: creditBalanceResponseSchema,
		creditLedger: z.array(adminOrganizationLedgerEntrySchema),
		aiSpend: adminAiSpendSchema,
		// Whole credits (configured whole; stored x100 internally).
		defaultMemberMonthlyCreditLimit: z.int().nullable(),
		// Affiliate policy snapshot from the org's Stripe customer; null until
		// the first checkout creates that customer.
		attributionUserId: z.string().nullable(),
	});

export type AdminOrganizationDetail = z.infer<
	typeof adminOrganizationDetailSchema
>;

// Direct member-row write — the zero-owner repair tool (§1.1/§10). Deliberately
// unguarded against demoting the last owner: repairing broken states needs the
// unrestricted write; the service logs a warning when an org ends up ownerless.
export const adminSetMemberRoleInputSchema = z.object({
	role: adminWorkspaceRoleSchema,
});

export type AdminSetMemberRoleInput = z.infer<
	typeof adminSetMemberRoleInputSchema
>;

export const adminSignupStatsRanges = ["7d", "30d", "90d"] as const;

export const adminSignupStatsQuerySchema = z.object({
	range: z.enum(adminSignupStatsRanges).default("30d"),
});

export type AdminSignupStatsQuery = z.infer<typeof adminSignupStatsQuerySchema>;

// One point per UTC day, zero-filled so empty days still chart.
export const adminSignupPointSchema = z.object({
	date: z.iso.date(),
	count: z.int(),
});

export type AdminSignupPoint = z.infer<typeof adminSignupPointSchema>;

export const adminSignupStatsSchema = z.object({
	range: z.enum(adminSignupStatsRanges),
	total: z.int(),
	totalUsers: z.int(),
	points: z.array(adminSignupPointSchema),
});

export type AdminSignupStats = z.infer<typeof adminSignupStatsSchema>;

// --- Dashboard overview ---

export const adminOverviewRanges = [
	"7d",
	"30d",
	"90d",
	"180d",
	"365d",
	"custom",
] as const;

export const adminOverviewRangeSchema = z.enum(adminOverviewRanges);

export type AdminOverviewRange = z.infer<typeof adminOverviewRangeSchema>;

const ADMIN_OVERVIEW_MAX_INCLUSIVE_DATES = 731;
const MILLISECONDS_PER_DAY = 86_400_000;

export const adminOverviewQuerySchema = z
	.object({
		range: adminOverviewRangeSchema.default("30d"),
		from: z.iso.date().optional(),
		to: z.iso.date().optional(),
	})
	.superRefine((query, context) => {
		// Presets can include dates left over from a prior custom selection. The
		// server ignores those dates and resolves the preset from the snapshot time.
		if (query.range !== "custom") return;

		if (!query.from) {
			context.addIssue({
				code: "custom",
				message: "from is required when range is custom",
				path: ["from"],
			});
		}

		if (!query.to) {
			context.addIssue({
				code: "custom",
				message: "to is required when range is custom",
				path: ["to"],
			});
		}

		if (!query.from || !query.to) return;

		if (query.from > query.to) {
			context.addIssue({
				code: "custom",
				message: "to must be on or after from",
				path: ["to"],
			});
			return;
		}

		const todayUtc = new Date().toISOString().slice(0, 10);
		if (query.to > todayUtc) {
			context.addIssue({
				code: "custom",
				message: "to must not be after today",
				path: ["to"],
			});
		}

		const inclusiveDates =
			(Date.parse(`${query.to}T00:00:00.000Z`) -
				Date.parse(`${query.from}T00:00:00.000Z`)) /
				MILLISECONDS_PER_DAY +
			1;

		if (inclusiveDates > ADMIN_OVERVIEW_MAX_INCLUSIVE_DATES) {
			context.addIssue({
				code: "custom",
				message: `custom range must not exceed ${ADMIN_OVERVIEW_MAX_INCLUSIVE_DATES} dates`,
				path: ["to"],
			});
		}
	});

export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

export const adminOverviewRevenueSummarySchema = z.object({
	reportingCurrency: z.literal("USD"),
	totalUsdMinor: z.int().nonnegative(),
	changePercent: z.number(),
});

export type AdminOverviewRevenueSummary = z.infer<
	typeof adminOverviewRevenueSummarySchema
>;

export const adminOverviewTotalsSchema = z.object({
	tokensUsed: z.int().nonnegative(),
	tokensChangePercent: z.number(),
	tokenCostUsdMinor: z.int().nonnegative(),
	websitesGenerated: z.int().nonnegative(),
	websitesChangePercent: z.number(),
	assetsGenerated: z.int().nonnegative(),
	imagesGenerated: z.int().nonnegative(),
	imagesChangePercent: z.number(),
	totalUsers: z.int().nonnegative(),
	signups: z.int().nonnegative(),
	signupsChangePercent: z.number(),
	activeUsers: z.int().nonnegative(),
	activationPercent: z.number().min(0).max(100),
});

export type AdminOverviewTotals = z.infer<typeof adminOverviewTotalsSchema>;

export const adminOverviewGenerationSummarySchema = z.object({
	attempts: z.int().nonnegative(),
	successful: z.int().nonnegative(),
	failed: z.int().nonnegative(),
	successRatePercent: z.number().min(0).max(100),
	successRateChangePoints: z.number(),
	averageLatencyMs: z.int().nonnegative(),
	latencyChangePercent: z.number(),
});

export type AdminOverviewGenerationSummary = z.infer<
	typeof adminOverviewGenerationSummarySchema
>;

export const adminOverviewRevenuePointSchema = z.object({
	date: z.iso.date(),
	label: z.string(),
	totalUsdMinor: z.int().nonnegative(),
});

export type AdminOverviewRevenuePoint = z.infer<
	typeof adminOverviewRevenuePointSchema
>;

export const adminOverviewGrowthPointSchema = z.object({
	date: z.iso.date(),
	label: z.string(),
	signups: z.int().nonnegative(),
	websitesGenerated: z.int().nonnegative(),
});

export type AdminOverviewGrowthPoint = z.infer<
	typeof adminOverviewGrowthPointSchema
>;

export const adminOverviewGenerationPointSchema = z.object({
	date: z.iso.date(),
	label: z.string(),
	successful: z.int().nonnegative(),
	failed: z.int().nonnegative(),
});

export type AdminOverviewGenerationPoint = z.infer<
	typeof adminOverviewGenerationPointSchema
>;

export const adminOverviewModelUsageSchema = z.object({
	modelId: z.string().min(1),
	modelName: z.string().min(1),
	provider: z.string().min(1),
	tokensUsed: z.int().nonnegative(),
	usageSharePercent: z.number().min(0).max(100),
	costUsdMinor: z.int().nonnegative(),
});

export type AdminOverviewModelUsage = z.infer<
	typeof adminOverviewModelUsageSchema
>;

export const adminOverviewSignalKindSchema = z.enum([
	"payment",
	"page_generation_succeeded",
	"page_generation_failed",
	"lead",
]);

export type AdminOverviewSignalKind = z.infer<
	typeof adminOverviewSignalKindSchema
>;

export const adminOverviewSignalSchema = z.object({
	id: z.string().min(1),
	kind: adminOverviewSignalKindSchema,
	title: z.string().min(1),
	detail: z.string().min(1),
	occurredAt: isoDateTimeSchema,
});

export type AdminOverviewSignal = z.infer<typeof adminOverviewSignalSchema>;

export const adminOverviewHealthyTrialsSchema = z.object({
	count: z.int().nonnegative(),
});

export type AdminOverviewHealthyTrials = z.infer<
	typeof adminOverviewHealthyTrialsSchema
>;

export const adminOverviewSnapshotSchema = z.object({
	range: adminOverviewRangeSchema,
	rangeLabel: z.string().min(1),
	generatedAt: isoDateTimeSchema,
	periodStart: z.iso.date(),
	periodEnd: z.iso.date(),
	mrrMinor: z.int().nonnegative(),
	healthyTrials: adminOverviewHealthyTrialsSchema,
	revenue: adminOverviewRevenueSummarySchema,
	totals: adminOverviewTotalsSchema,
	generation: adminOverviewGenerationSummarySchema,
	revenueSeries: z.array(adminOverviewRevenuePointSchema),
	growthSeries: z.array(adminOverviewGrowthPointSchema),
	generationSeries: z.array(adminOverviewGenerationPointSchema),
	modelUsage: z.array(adminOverviewModelUsageSchema),
	recentSignals: z.array(adminOverviewSignalSchema).max(5),
});

export type AdminOverviewSnapshot = z.infer<typeof adminOverviewSnapshotSchema>;

export const adminWebhookReplayResponseSchema = z.object({
	accepted: z.literal(true),
	eventId: z.string().min(1),
});

export type AdminWebhookReplayResponse = z.infer<
	typeof adminWebhookReplayResponseSchema
>;

export const adminRoutes = {
	users: "/api/v1/admin/users",
	user: (userId: string) => `/api/v1/admin/users/${userId}`,
	userProjects: (userId: string) => `/api/v1/admin/users/${userId}/projects`,
	userPages: (userId: string) => `/api/v1/admin/users/${userId}/pages`,
	organizations: "/api/v1/admin/organizations",
	organization: (organizationId: string) =>
		`/api/v1/admin/organizations/${organizationId}`,
	organizationGrantCredits: (organizationId: string) =>
		`/api/v1/admin/organizations/${organizationId}/credits`,
	organizationSetMemberRole: (organizationId: string, userId: string) =>
		`/api/v1/admin/organizations/${organizationId}/members/${userId}/role`,
	project: (projectId: string) => `/api/v1/admin/projects/${projectId}`,
	projectVersions: (projectId: string) =>
		`/api/v1/admin/projects/${projectId}/versions`,
	projectVersionHtml: (projectId: string, versionId: string) =>
		`/api/v1/admin/projects/${projectId}/versions/${versionId}/html`,
	projectVersionPreview: (projectId: string, versionId: string) =>
		`/api/v1/admin/projects/${projectId}/versions/${versionId}/preview`,
	grantCredits: (userId: string) => `/api/v1/admin/users/${userId}/credits`,
	setRole: (userId: string) => `/api/v1/admin/users/${userId}/role`,
	setBanned: (userId: string) => `/api/v1/admin/users/${userId}/banned`,
	overviewStats: "/api/v1/admin/stats/overview",
	signupStats: "/api/v1/admin/stats/signups",
	webhookReplay: (eventId: string) =>
		`/api/v1/admin/webhooks/${encodeURIComponent(eventId)}/replay`,
} as const;

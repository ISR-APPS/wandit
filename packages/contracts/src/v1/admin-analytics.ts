import { z } from "zod";
import { paginationQuerySchema } from "../http/pagination";
import { adminOverviewQuerySchema, adminOverviewRangeSchema } from "./admin";
import {
	billingIntervalSchema,
	billingPlanIdSchema,
	cancellationReasonCodeSchema,
} from "./billing";
import { isoDateTimeSchema } from "./shared/primitives";

export const adminAnalyticsRangeSchema = adminOverviewRangeSchema;

export type AdminAnalyticsRange = z.infer<typeof adminAnalyticsRangeSchema>;

export const adminAnalyticsDevices = ["desktop", "mobile", "tablet"] as const;

export const adminAnalyticsDeviceSchema = z.enum(adminAnalyticsDevices);

export type AdminAnalyticsDevice = z.infer<typeof adminAnalyticsDeviceSchema>;

export const adminAnalyticsQuerySchema = z
	.object({
		...adminOverviewQuerySchema.shape,
		source: z.string().trim().min(1).max(200).optional(),
		country: z
			.string()
			.trim()
			.regex(/^[A-Za-z]{2}$/)
			.toUpperCase()
			.optional(),
		device: adminAnalyticsDeviceSchema.optional(),
		cohortOnly: z.coerce.boolean().default(false),
	})
	.superRefine((query, context) => {
		const overviewResult = adminOverviewQuerySchema.safeParse(query);
		if (overviewResult.success) return;

		for (const issue of overviewResult.error.issues) {
			if (issue.code !== "custom") continue;
			context.addIssue({
				code: "custom",
				message: issue.message,
				path: issue.path,
			});
		}
	});

export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsQuerySchema>;

export const adminAnalyticsHealthyTrialsSchema = z.object({
	count: z.int().nonnegative(),
	pctOfTrials: z.number().min(0).max(100),
	healthyToPaidPct: z.number().min(0).max(100),
	nonHealthyToPaidPct: z.number().min(0).max(100),
});

export type AdminAnalyticsHealthyTrials = z.infer<
	typeof adminAnalyticsHealthyTrialsSchema
>;

export const adminAnalyticsRevenueTilesSchema = z.object({
	mrrMinor: z.int().nonnegative(),
	arpuMinor: z.int().nonnegative(),
	activePaidUsers: z.int().nonnegative(),
	newPaidUsersInRange: z.int().nonnegative(),
	trialToPaidPctAllTime: z.number().min(0).max(100),
	healthyTrials: adminAnalyticsHealthyTrialsSchema,
});

export type AdminAnalyticsRevenueTiles = z.infer<
	typeof adminAnalyticsRevenueTilesSchema
>;

export const adminAnalyticsMrrByPlanSchema = z.object({
	plan: billingPlanIdSchema,
	interval: billingIntervalSchema,
	subscribers: z.int().nonnegative(),
	mrrMinor: z.int().nonnegative(),
});

export type AdminAnalyticsMrrByPlan = z.infer<
	typeof adminAnalyticsMrrByPlanSchema
>;

export const adminAnalyticsCollectedRevenuePointSchema = z.object({
	date: z.iso.date(),
	subscriptionsMinor: z.int().nonnegative(),
	ordersMinor: z.int().nonnegative(),
	topupsMinor: z.int().nonnegative(),
});

export type AdminAnalyticsCollectedRevenuePoint = z.infer<
	typeof adminAnalyticsCollectedRevenuePointSchema
>;

export const adminAnalyticsNewPaidPointSchema = z.object({
	date: z.iso.date(),
	count: z.int().nonnegative(),
});

export type AdminAnalyticsNewPaidPoint = z.infer<
	typeof adminAnalyticsNewPaidPointSchema
>;

export const adminAnalyticsDaysToConvertBuckets = [
	"0",
	"1",
	"2",
	"3",
	"4-5",
	"6-7",
	"8-14",
	"15+",
] as const;

export const adminAnalyticsDaysToConvertBucketSchema = z.enum(
	adminAnalyticsDaysToConvertBuckets,
);

export type AdminAnalyticsDaysToConvertBucket = z.infer<
	typeof adminAnalyticsDaysToConvertBucketSchema
>;

export const adminAnalyticsDaysToConvertPointSchema = z.object({
	bucket: adminAnalyticsDaysToConvertBucketSchema,
	count: z.int().nonnegative(),
});

export type AdminAnalyticsDaysToConvertPoint = z.infer<
	typeof adminAnalyticsDaysToConvertPointSchema
>;

export const adminAnalyticsCheckoutFunnelSchema = z.object({
	started: z.int().nonnegative(),
	completed: z.int().nonnegative(),
	completionPct: z.number().min(0).max(100),
});

export type AdminAnalyticsCheckoutFunnel = z.infer<
	typeof adminAnalyticsCheckoutFunnelSchema
>;

export const adminAnalyticsChurnSchema = z.object({
	customerChurnPct: z.number().min(0).max(100).nullable(),
	mrrChurnPct: z.number().min(0).max(100).nullable(),
	churnedMrrCents: z.int().nonnegative(),
	netNewMrrCents: z.int(),
	upgrades: z.int().nonnegative(),
	downgrades: z.int().nonnegative(),
	ltvCents: z.int().nonnegative().nullable(),
});

export type AdminAnalyticsChurn = z.infer<typeof adminAnalyticsChurnSchema>;

export const adminAnalyticsNetRevenueSchema = z.object({
	grossCents: z.int().nonnegative(),
	refundsCents: z.int().nonnegative(),
	netCents: z.int(),
	failedPayments: z.int().nonnegative(),
	failedPaymentsCents: z.int().nonnegative(),
});

export type AdminAnalyticsNetRevenue = z.infer<
	typeof adminAnalyticsNetRevenueSchema
>;

// Cash collected in the range split by source (subscription invoices vs domain
// purchase orders), plus domain resale economics. Domain wholesale cost is the
// registrar's actual charge when recorded, else the checkout-time wholesale
// quote; orders with neither are counted in domainCostUnknownOrders and
// contribute zero cost, so the margin can only overstate on those.
export const adminAnalyticsRevenueBySourceSchema = z.object({
	subscriptionsCents: z.int().nonnegative(),
	// Top-up packs (billing_topup_receipts). Receipts were backfilled from the
	// ledger with catalog prices; the oldest rows without a pack id are
	// missing, so this can only understate for them.
	topupsCents: z.int().nonnegative(),
	domainsCents: z.int().nonnegative(),
	domainOrders: z.int().nonnegative(),
	domainCostCents: z.int().nonnegative(),
	domainMarginCents: z.int(),
	domainMarginPct: z.number().nullable(),
	domainCostUnknownOrders: z.int().nonnegative(),
});

export type AdminAnalyticsRevenueBySource = z.infer<
	typeof adminAnalyticsRevenueBySourceSchema
>;

export const adminAnalyticsArpuByPlanSchema = z.object({
	plan: billingPlanIdSchema,
	arpuCents: z.int().nonnegative(),
});

export type AdminAnalyticsArpuByPlan = z.infer<
	typeof adminAnalyticsArpuByPlanSchema
>;

// Margin after AI, per plan — measured numbers only ("option 2"): collected
// subscription cash minus the metered AI-provider cost of that plan's owners.
// Shared infrastructure bills are deliberately NOT allocated here (they stay
// in the blended unitEconomics gross margin). "free" is not a billing plan:
// it is every owner without a live subscription — zero revenue, real AI cost.
// Owners are attributed to their CURRENT plan (subscriptions store no
// history). Owners with overlapping live plans are assigned business, then
// pro, then starter.
export const adminAnalyticsMarginAfterAiPlans = [
	"starter",
	"pro",
	"business",
	"free",
] as const;

export const adminAnalyticsMarginAfterAiPlanSchema = z.enum(
	adminAnalyticsMarginAfterAiPlans,
);

export type AdminAnalyticsMarginAfterAiPlan = z.infer<
	typeof adminAnalyticsMarginAfterAiPlanSchema
>;

export const adminAnalyticsMarginAfterAiRowSchema = z.object({
	plan: adminAnalyticsMarginAfterAiPlanSchema,
	// Collected subscription cash in range (USD cents); always 0 for "free".
	revenueCents: z.int().nonnegative(),
	// Metered AI-provider cost of this plan's owners in range (USD cents).
	aiCostCents: z.int().nonnegative(),
	marginCents: z.int(),
	// null when the plan collected no revenue in range (free always).
	marginPct: z.number().nullable(),
});

export type AdminAnalyticsMarginAfterAiRow = z.infer<
	typeof adminAnalyticsMarginAfterAiRowSchema
>;

export const adminAnalyticsFeatureKeys = [
	"websites",
	"landingPages",
	"images",
	"marketing",
	"connectors",
	"leadScraping",
	"chat",
	"publishing",
	"domains",
] as const;

export const adminAnalyticsFeatureKeySchema = z.enum(adminAnalyticsFeatureKeys);

export type AdminAnalyticsFeatureKey = z.infer<
	typeof adminAnalyticsFeatureKeySchema
>;

export const adminAnalyticsRetentionPointSchema = z.object({
	paidPct: z.number().min(0).max(100),
	revenuePct: z.number().min(0).nullable(),
});

export type AdminAnalyticsRetentionPoint = z.infer<
	typeof adminAnalyticsRetentionPointSchema
>;

export const adminAnalyticsRetentionCohortSchema = z.object({
	cohortMonth: z.iso.date(),
	owners: z.int().nonnegative(),
	m0MrrCents: z.int().nonnegative(),
	points: z.array(adminAnalyticsRetentionPointSchema),
});

export type AdminAnalyticsRetentionCohort = z.infer<
	typeof adminAnalyticsRetentionCohortSchema
>;

export const adminAnalyticsRetentionSchema = z.object({
	cohorts: z.array(adminAnalyticsRetentionCohortSchema),
});

export type AdminAnalyticsRetention = z.infer<
	typeof adminAnalyticsRetentionSchema
>;

export const adminAnalyticsChurnPlanSchema = z.object({
	plan: z.string().min(1),
	churned: z.int().nonnegative(),
	churnedMrrCents: z.int().nonnegative(),
});

export type AdminAnalyticsChurnPlan = z.infer<
	typeof adminAnalyticsChurnPlanSchema
>;

export const adminAnalyticsChurnSourceSchema = z.object({
	source: z.string().min(1),
	churned: z.int().nonnegative(),
});

export type AdminAnalyticsChurnSource = z.infer<
	typeof adminAnalyticsChurnSourceSchema
>;

export const adminAnalyticsChurnReasonSchema = z.object({
	reason: z.union([cancellationReasonCodeSchema, z.literal("unknown")]),
	churned: z.int().nonnegative(),
});

export type AdminAnalyticsChurnReason = z.infer<
	typeof adminAnalyticsChurnReasonSchema
>;

export const adminAnalyticsChurnCountrySchema = z.object({
	country: z.string().min(1),
	churned: z.int().nonnegative(),
});

export type AdminAnalyticsChurnCountry = z.infer<
	typeof adminAnalyticsChurnCountrySchema
>;

export const adminAnalyticsChurnFeatureSchema = z.object({
	feature: adminAnalyticsFeatureKeySchema,
	churned: z.int().nonnegative(),
});

export type AdminAnalyticsChurnFeature = z.infer<
	typeof adminAnalyticsChurnFeatureSchema
>;

export const adminAnalyticsChurnBreakdownSchema = z.object({
	byPlan: z.array(adminAnalyticsChurnPlanSchema),
	bySource: z.array(adminAnalyticsChurnSourceSchema),
	byReason: z.array(adminAnalyticsChurnReasonSchema),
	byCountry: z.array(adminAnalyticsChurnCountrySchema),
	byFeature: z.array(adminAnalyticsChurnFeatureSchema),
});

export type AdminAnalyticsChurnBreakdown = z.infer<
	typeof adminAnalyticsChurnBreakdownSchema
>;

export const adminAnalyticsUnitEconomicsSchema = z.object({
	adSpendCents: z.int().nonnegative().nullable(),
	infrastructureCostCents: z.int().nonnegative().nullable(),
	otherCostCents: z.int().nonnegative().nullable(),
	totalCostCents: z.int().nonnegative().nullable(),
	cacCents: z.int().nonnegative().nullable(),
	ltvCacRatio: z.number().nonnegative().nullable(),
	grossMarginPct: z.number().min(0).max(100).nullable(),
	cacPaybackMonths: z.number().nonnegative().nullable(),
	costPerFreeActiveUserCents: z.int().nonnegative().nullable(),
	costPerHealthyTrialCents: z.int().nonnegative().nullable(),
	costPerActivePaidUserCents: z.int().nonnegative().nullable(),
	costCoverageComplete: z.boolean(),
});

export type AdminAnalyticsUnitEconomics = z.infer<
	typeof adminAnalyticsUnitEconomicsSchema
>;

export const adminAnalyticsRevenueResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	tiles: adminAnalyticsRevenueTilesSchema,
	mrrByPlan: z.array(adminAnalyticsMrrByPlanSchema),
	collectedRevenueByDay: z.array(adminAnalyticsCollectedRevenuePointSchema),
	newPaidByDay: z.array(adminAnalyticsNewPaidPointSchema),
	daysToConvert: z.array(adminAnalyticsDaysToConvertPointSchema),
	checkoutFunnel: adminAnalyticsCheckoutFunnelSchema,
	churn: adminAnalyticsChurnSchema,
	netRevenue: adminAnalyticsNetRevenueSchema,
	revenueBySource: adminAnalyticsRevenueBySourceSchema,
	arpuByPlan: z.array(adminAnalyticsArpuByPlanSchema),
	retention: adminAnalyticsRetentionSchema,
	churnBreakdown: adminAnalyticsChurnBreakdownSchema,
	unitEconomics: adminAnalyticsUnitEconomicsSchema,
	// Fixed order: starter, pro, business, free.
	marginAfterAi: z.array(adminAnalyticsMarginAfterAiRowSchema),
});

export type AdminAnalyticsRevenueResponse = z.infer<
	typeof adminAnalyticsRevenueResponseSchema
>;

export const adminAnalyticsAcquisitionSourceSchema = z.object({
	source: z.string().min(1),
	signups: z.int().nonnegative(),
	activated: z.int().nonnegative(),
	paid: z.int().nonnegative(),
	signupToPaidPct: z.number().min(0).max(100),
	mrrCents: z.int().nonnegative(),
	adSpendCents: z.int().nonnegative().nullable(),
	cacCents: z.int().nonnegative().nullable(),
});

export type AdminAnalyticsAcquisitionSource = z.infer<
	typeof adminAnalyticsAcquisitionSourceSchema
>;

export const adminAnalyticsAcquisitionCampaignSchema = z.object({
	campaign: z.string().min(1),
	source: z.string().min(1),
	signups: z.int().nonnegative(),
	paid: z.int().nonnegative(),
	mrrCents: z.int().nonnegative(),
});

export type AdminAnalyticsAcquisitionCampaign = z.infer<
	typeof adminAnalyticsAcquisitionCampaignSchema
>;

export const adminAnalyticsAcquisitionCountrySchema = z.object({
	country: z.string().min(1),
	signups: z.int().nonnegative(),
	paid: z.int().nonnegative(),
});

export type AdminAnalyticsAcquisitionCountry = z.infer<
	typeof adminAnalyticsAcquisitionCountrySchema
>;

export const adminAnalyticsAcquisitionUnattributedSchema = z.object({
	signups: z.int().nonnegative(),
});

export type AdminAnalyticsAcquisitionUnattributed = z.infer<
	typeof adminAnalyticsAcquisitionUnattributedSchema
>;

export const adminAnalyticsAcquisitionResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	adSpendCents: z.int().nonnegative().nullable(),
	cacCents: z.int().nonnegative().nullable(),
	costCoverageComplete: z.boolean(),
	sources: z.array(adminAnalyticsAcquisitionSourceSchema),
	campaigns: z.array(adminAnalyticsAcquisitionCampaignSchema),
	countries: z.array(adminAnalyticsAcquisitionCountrySchema),
	unattributed: adminAnalyticsAcquisitionUnattributedSchema,
});

export type AdminAnalyticsAcquisitionResponse = z.infer<
	typeof adminAnalyticsAcquisitionResponseSchema
>;

export const adminAnalyticsFunnelStepKeys = [
	"visitor",
	"signup",
	"firstAction",
	"activated",
	"healthyTrial",
	"pricingViewed",
	"upgradeClicked",
	"checkoutStarted",
	"paid",
] as const;

export const adminAnalyticsFunnelStepKeySchema = z.enum(
	adminAnalyticsFunnelStepKeys,
);

export type AdminAnalyticsFunnelStepKey = z.infer<
	typeof adminAnalyticsFunnelStepKeySchema
>;

export const adminAnalyticsFunnelUserStepKeys = [
	"pricingViewed",
	"upgradeClicked",
	"checkoutStarted",
] as const;

export const adminAnalyticsFunnelUserStepSchema = z.enum(
	adminAnalyticsFunnelUserStepKeys,
);

export type AdminAnalyticsFunnelUserStep = z.infer<
	typeof adminAnalyticsFunnelUserStepSchema
>;

export const adminAnalyticsFunnelStepSchema = z.object({
	key: adminAnalyticsFunnelStepKeySchema,
	count: z.int().nonnegative().nullable(),
	pctOfPrevious: z.number().min(0).max(100).nullable(),
});

export type AdminAnalyticsFunnelStep = z.infer<
	typeof adminAnalyticsFunnelStepSchema
>;

export const adminAnalyticsDurationSchema = z.object({
	medianHours: z.number().nonnegative().nullable(),
	avgHours: z.number().nonnegative().nullable(),
	users: z.int().nonnegative(),
});

export type AdminAnalyticsDuration = z.infer<
	typeof adminAnalyticsDurationSchema
>;

export const adminAnalyticsFunnelDurationsSchema = z.object({
	signupToFirstAction: adminAnalyticsDurationSchema,
	signupToFirstGeneration: adminAnalyticsDurationSchema,
});

export type AdminAnalyticsFunnelDurations = z.infer<
	typeof adminAnalyticsFunnelDurationsSchema
>;

export const adminAnalyticsFunnelResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	steps: z.array(adminAnalyticsFunnelStepSchema),
	durations: adminAnalyticsFunnelDurationsSchema,
});

export type AdminAnalyticsFunnelResponse = z.infer<
	typeof adminAnalyticsFunnelResponseSchema
>;

export const adminAnalyticsFunnelContactSchema = z.object({
	contactedAt: isoDateTimeSchema,
	contactedBy: z.object({
		id: z.string(),
		name: z.string(),
	}),
});

export type AdminAnalyticsFunnelContact = z.infer<
	typeof adminAnalyticsFunnelContactSchema
>;

export const adminAnalyticsFunnelStepUserSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
	signedUpAt: isoDateTimeSchema,
	firstEventAt: isoDateTimeSchema,
	lastEventAt: isoDateTimeSchema,
	eventCount: z.int().positive(),
	converted: z.boolean(),
	contact: adminAnalyticsFunnelContactSchema.nullable(),
});

export type AdminAnalyticsFunnelStepUser = z.infer<
	typeof adminAnalyticsFunnelStepUserSchema
>;

export const adminAnalyticsFunnelStepUsersContactedSchema = z
	.enum(["all", "contacted", "notContacted"])
	.default("all");

export type AdminAnalyticsFunnelStepUsersContacted = z.infer<
	typeof adminAnalyticsFunnelStepUsersContactedSchema
>;

export const adminAnalyticsFunnelStepUsersQuerySchema =
	adminAnalyticsQuerySchema.safeExtend({
		...paginationQuerySchema.shape,
		contacted: adminAnalyticsFunnelStepUsersContactedSchema,
	});

export type AdminAnalyticsFunnelStepUsersQuery = z.infer<
	typeof adminAnalyticsFunnelStepUsersQuerySchema
>;

export const adminAnalyticsFunnelStepUsersExportQuerySchema =
	adminAnalyticsQuerySchema.safeExtend({
		contacted: adminAnalyticsFunnelStepUsersContactedSchema,
	});

export type AdminAnalyticsFunnelStepUsersExportQuery = z.infer<
	typeof adminAnalyticsFunnelStepUsersExportQuerySchema
>;

export const adminAnalyticsFunnelStepUsersResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	step: adminAnalyticsFunnelUserStepSchema,
	page: z.int().min(1),
	pageSize: z.int().min(1),
	total: z.int().nonnegative(),
	counts: z.object({
		all: z.int().nonnegative(),
		contacted: z.int().nonnegative(),
		converted: z.int().nonnegative(),
	}),
	items: z.array(adminAnalyticsFunnelStepUserSchema),
});

export type AdminAnalyticsFunnelStepUsersResponse = z.infer<
	typeof adminAnalyticsFunnelStepUsersResponseSchema
>;

export const adminAnalyticsFunnelContactInputSchema = z.object({
	contacted: z.boolean(),
});

export type AdminAnalyticsFunnelContactInput = z.infer<
	typeof adminAnalyticsFunnelContactInputSchema
>;

export const adminAnalyticsFunnelContactResponseSchema = z.object({
	userId: z.string(),
	contact: adminAnalyticsFunnelContactSchema.nullable(),
});

export type AdminAnalyticsFunnelContactResponse = z.infer<
	typeof adminAnalyticsFunnelContactResponseSchema
>;

export const adminAnalyticsActivitySchema = z.object({
	dau: z.int().nonnegative(),
	wau: z.int().nonnegative(),
	mau: z.int().nonnegative(),
	dauMauPct: z.number().min(0).max(100),
	avgActiveDaysPerUser: z.number().nonnegative(),
	avgActionsPerUser: z.number().nonnegative(),
	activeFreeTrialUsers: z.int().nonnegative(),
});

export type AdminAnalyticsActivity = z.infer<
	typeof adminAnalyticsActivitySchema
>;

export const adminAnalyticsActivityByDayPointSchema = z.object({
	date: z.iso.date(),
	activeUsers: z.int().nonnegative(),
});

export type AdminAnalyticsActivityByDayPoint = z.infer<
	typeof adminAnalyticsActivityByDayPointSchema
>;

export const adminAnalyticsReturningSchema = z.object({
	d1Pct: z.number().min(0).max(100),
	d3Pct: z.number().min(0).max(100),
	d7Pct: z.number().min(0).max(100),
	d14Pct: z.number().min(0).max(100),
	d30Pct: z.number().min(0).max(100),
});

export type AdminAnalyticsReturning = z.infer<
	typeof adminAnalyticsReturningSchema
>;

export const adminAnalyticsEngagementCohortSchema = z.object({
	cohortWeekStart: z.iso.date(),
	size: z.int().nonnegative(),
	weeks: z.array(z.number().min(0).max(100)),
});

export type AdminAnalyticsEngagementCohort = z.infer<
	typeof adminAnalyticsEngagementCohortSchema
>;

export const adminAnalyticsHealthyTrialsByDayPointSchema = z.object({
	date: z.iso.date(),
	count: z.int().nonnegative(),
});

export type AdminAnalyticsHealthyTrialsByDayPoint = z.infer<
	typeof adminAnalyticsHealthyTrialsByDayPointSchema
>;

export const adminAnalyticsEngagementResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	activity: adminAnalyticsActivitySchema,
	activityByDay: z.array(adminAnalyticsActivityByDayPointSchema),
	returning: adminAnalyticsReturningSchema,
	cohorts: z.array(adminAnalyticsEngagementCohortSchema),
	healthyTrialsByDay: z.array(adminAnalyticsHealthyTrialsByDayPointSchema),
});

export type AdminAnalyticsEngagementResponse = z.infer<
	typeof adminAnalyticsEngagementResponseSchema
>;

export const adminAnalyticsFeatureSchema = z.object({
	key: adminAnalyticsFeatureKeySchema,
	users: z.int().nonnegative(),
	pctOfActiveUsers: z.number().min(0).max(100),
	uses: z.int().nonnegative(),
	avgUsesPerUser: z.number().nonnegative(),
	usersToPaidPct: z.number().min(0).max(100),
	convertedAfterUsePct: z.number().min(0).max(100).nullable(),
});

export type AdminAnalyticsFeature = z.infer<typeof adminAnalyticsFeatureSchema>;

/**
 * Free-user consumption after flooring usage to whole credits. The final
 * bucket starts at the 20-credit signup grant.
 */
export const adminAnalyticsConsumptionBuckets = [
	"0",
	"1-4",
	"5-9",
	"10-19",
	"20+",
] as const;

export const adminAnalyticsConsumptionBucketSchema = z.enum(
	adminAnalyticsConsumptionBuckets,
);

export type AdminAnalyticsConsumptionBucket = z.infer<
	typeof adminAnalyticsConsumptionBucketSchema
>;

export const adminAnalyticsConsumptionBucketPointSchema = z.object({
	bucket: adminAnalyticsConsumptionBucketSchema,
	users: z.int().nonnegative(),
});

export type AdminAnalyticsConsumptionBucketPoint = z.infer<
	typeof adminAnalyticsConsumptionBucketPointSchema
>;

export const adminAnalyticsCreditsSchema = z.object({
	// Decimal credits (server divides centi-credit ledger sums by 100).
	grantedInRange: z.number().nonnegative(),
	consumedInRange: z.number().nonnegative(),
	avgConsumedPerFreeUser: z.number().nonnegative(),
	avgConsumedPerPaidUser: z.number().nonnegative(),
	consumptionBuckets: z.array(adminAnalyticsConsumptionBucketPointSchema),
	usersAtZeroBalance: z.int().nonnegative(),
	avgCreditsBeforeUpgrade: z.number().nonnegative(),
	// Billable provider spend per debited credit.
	providerCostPerCreditMicros: z.number().nonnegative(),
	// All best-known provider spend in range (reconciled, else settle-time
	// snapshot, else estimate) vs the part the customer was debited for —
	// historical bundled helper calls cost money against zero charge.
	totalProviderCostMicros: z.number().nonnegative(),
	billableProviderCostMicros: z.number().nonnegative(),
	// How much of totalProviderCostMicros is measured (gateway-reconciled),
	// contract (settle-time catalog snapshot) or still an estimate.
	providerCostByProvenanceMicros: z.object({
		measured: z.number().nonnegative(),
		contract: z.number().nonnegative(),
		estimate: z.number().nonnegative(),
	}),
});

export type AdminAnalyticsCredits = z.infer<typeof adminAnalyticsCreditsSchema>;

export const adminAnalyticsFreeCreditsSchema = z.object({
	avgDaysToConsume: z.number().nonnegative().nullable(),
	medianDaysToConsume: z.number().nonnegative().nullable(),
	measuredUsers: z.int().nonnegative(),
});

export type AdminAnalyticsFreeCredits = z.infer<
	typeof adminAnalyticsFreeCreditsSchema
>;

export const adminAnalyticsConversionByCreditsPointSchema = z.object({
	bucket: adminAnalyticsConsumptionBucketSchema,
	owners: z.int().nonnegative(),
	paidOwners: z.int().nonnegative(),
	paidPct: z.number().min(0).max(100).nullable(),
});

export type AdminAnalyticsConversionByCreditsPoint = z.infer<
	typeof adminAnalyticsConversionByCreditsPointSchema
>;

export const adminAnalyticsAdsOperationSchema = z.object({
	events: z.int().nonnegative(),
	users: z.int().nonnegative(),
	errorRatePct: z.number().min(0).max(100).nullable(),
});

export type AdminAnalyticsAdsOperation = z.infer<
	typeof adminAnalyticsAdsOperationSchema
>;

export const adminAnalyticsAdsSchema = z.object({
	analysis: adminAnalyticsAdsOperationSchema,
	launch: adminAnalyticsAdsOperationSchema,
	connectedUsers: z.int().nonnegative(),
	totalUsers: z.int().nonnegative(),
	connectedPct: z.number().min(0).max(100).nullable(),
});

export type AdminAnalyticsAds = z.infer<typeof adminAnalyticsAdsSchema>;

export const adminAnalyticsFeaturesResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	activeUsersInRange: z.int().nonnegative(),
	features: z.array(adminAnalyticsFeatureSchema),
	ads: adminAnalyticsAdsSchema,
	credits: adminAnalyticsCreditsSchema,
	freeCredits: adminAnalyticsFreeCreditsSchema,
	conversionByCredits: z.array(adminAnalyticsConversionByCreditsPointSchema),
});

export type AdminAnalyticsFeaturesResponse = z.infer<
	typeof adminAnalyticsFeaturesResponseSchema
>;

export const adminAnalyticsGenerationKeys = [
	"pages",
	"images",
	"marketing",
	"connectors",
	"leadScraping",
] as const;

export const adminAnalyticsGenerationKeySchema = z.enum(
	adminAnalyticsGenerationKeys,
);

export type AdminAnalyticsGenerationKey = z.infer<
	typeof adminAnalyticsGenerationKeySchema
>;

export const adminAnalyticsTopFailureSchema = z.object({
	code: z.string().min(1),
	count: z.int().nonnegative(),
});

export type AdminAnalyticsTopFailure = z.infer<
	typeof adminAnalyticsTopFailureSchema
>;

export const adminAnalyticsGenerationHealthSchema = z.object({
	key: adminAnalyticsGenerationKeySchema,
	attempts: z.int().nonnegative(),
	successPct: z.number().min(0).max(100),
	failurePct: z.number().min(0).max(100),
	p50Ms: z.number().nonnegative(),
	p95Ms: z.number().nonnegative(),
	latencyIncludesQueue: z.boolean(),
	topFailures: z.array(adminAnalyticsTopFailureSchema),
});

export type AdminAnalyticsGenerationHealth = z.infer<
	typeof adminAnalyticsGenerationHealthSchema
>;

export const adminAnalyticsWebhookHealthSchema = z.object({
	received: z.int().nonnegative(),
	processed: z.int().nonnegative(),
	skipped: z.int().nonnegative(),
	failed: z.int().nonnegative(),
	deadLettered: z.int().nonnegative(),
});

export type AdminAnalyticsWebhookHealth = z.infer<
	typeof adminAnalyticsWebhookHealthSchema
>;

export const adminAnalyticsHealthResponseSchema = z.object({
	updatedAt: isoDateTimeSchema,
	generation: z.array(adminAnalyticsGenerationHealthSchema),
	// Decimal credits (server divides the centi-credit refund sum by 100).
	creditsRefundedInRange: z.number().nonnegative(),
	webhooks: adminAnalyticsWebhookHealthSchema,
});

export type AdminAnalyticsHealthResponse = z.infer<
	typeof adminAnalyticsHealthResponseSchema
>;

const adminAnalyticsRoot = "/api/v1/admin/analytics";

export const adminAnalyticsRoutes = {
	revenue: `${adminAnalyticsRoot}/revenue`,
	acquisition: `${adminAnalyticsRoot}/acquisition`,
	funnel: `${adminAnalyticsRoot}/funnel`,
	funnelStepUsers: (step: string) =>
		`${adminAnalyticsRoot}/funnel/steps/${step}/users`,
	funnelStepUsersExport: (step: string) =>
		`${adminAnalyticsRoot}/funnel/steps/${step}/users/export`,
	funnelContact: (userId: string) =>
		`${adminAnalyticsRoot}/funnel/contacts/${userId}`,
	engagement: `${adminAnalyticsRoot}/engagement`,
	features: `${adminAnalyticsRoot}/features`,
	health: `${adminAnalyticsRoot}/health`,
} as const;

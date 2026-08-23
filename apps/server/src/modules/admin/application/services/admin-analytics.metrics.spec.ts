import {
	adminAnalyticsAcquisitionResponseSchema,
	adminAnalyticsConsumptionBuckets,
	adminAnalyticsDaysToConvertBuckets,
	adminAnalyticsEngagementResponseSchema,
	adminAnalyticsFeatureKeys,
	adminAnalyticsFeaturesResponseSchema,
	adminAnalyticsFunnelResponseSchema,
	adminAnalyticsFunnelStepKeys,
	adminAnalyticsFunnelStepUsersResponseSchema,
	adminAnalyticsGenerationKeys,
	adminAnalyticsHealthResponseSchema,
	adminAnalyticsRevenueResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type {
	AdminAnalyticsAcquisitionSnapshot,
	AdminAnalyticsEngagementSnapshot,
	AdminAnalyticsFeaturesSnapshot,
	AdminAnalyticsFunnelSnapshot,
	AdminAnalyticsFunnelStepUsersRepositorySnapshot,
	AdminAnalyticsHealthSnapshot,
	AdminAnalyticsRevenueSnapshot,
} from "../../infrastructure/persistence/admin-analytics.repository";
import {
	assembleAcquisitionResponse,
	assembleEngagementResponse,
	assembleFeaturesResponse,
	assembleFunnelResponse,
	assembleFunnelStepUsersResponse,
	assembleHealthResponse,
	assembleRevenueResponse,
	consumptionBucket,
	daysToConvertBucket,
	HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS,
	HEALTHY_TRIAL_MIN_CREDITS,
	isHealthyTrialActivity,
	LIVE_SUBSCRIPTION_STATUSES,
	MRR_PRICE_MAP,
	safePercentage,
} from "./admin-analytics.metrics";

const NOW = new Date("2026-08-13T10:20:30.000Z");

function acquisitionSnapshot(
	overrides: Partial<AdminAnalyticsAcquisitionSnapshot> = {},
): AdminAnalyticsAcquisitionSnapshot {
	return {
		costs: {
			adSpendBySourceCents: {},
			adSpendCents: 0,
			costCoverageComplete: false,
			infrastructureCostCents: 0,
			otherCostCents: 0,
			totalCostCents: 0,
		},
		costsAttributionFiltered: false,
		sources: [],
		campaigns: [],
		countries: [],
		unattributedSignups: 0,
		...overrides,
	};
}

function funnelSnapshot(
	overrides: Partial<AdminAnalyticsFunnelSnapshot> = {},
): AdminAnalyticsFunnelSnapshot {
	return {
		visitors: 0,
		signups: 0,
		firstActions: 0,
		activated: 0,
		healthyTrials: 0,
		pricingViewed: 0,
		upgradeClicked: 0,
		checkoutStarted: 0,
		paid: 0,
		durations: {
			signupToFirstAction: {
				medianSeconds: null,
				avgSeconds: null,
				users: 0,
			},
			signupToFirstGeneration: {
				medianSeconds: null,
				avgSeconds: null,
				users: 0,
			},
		},
		...overrides,
	};
}

type FunnelStepUserSnapshotItem =
	AdminAnalyticsFunnelStepUsersRepositorySnapshot["items"][number];

function funnelStepUserSnapshotItem(
	overrides: Partial<FunnelStepUserSnapshotItem> = {},
): FunnelStepUserSnapshotItem {
	return {
		userId: "user_1",
		name: "Ada Lovelace",
		email: "ada@example.com",
		image: null,
		signedUpAt: new Date("2026-08-01T09:00:00.000Z"),
		firstEventAt: new Date("2026-08-02T10:00:00.000Z"),
		lastEventAt: new Date("2026-08-03T11:00:00.000Z"),
		eventCount: 2,
		converted: false,
		contact: null,
		...overrides,
	};
}

function funnelStepUsersSnapshot(
	overrides: Partial<AdminAnalyticsFunnelStepUsersRepositorySnapshot> = {},
): AdminAnalyticsFunnelStepUsersRepositorySnapshot {
	return {
		page: 1,
		pageSize: 20,
		total: 1,
		counts: { all: 1, contacted: 0, converted: 0 },
		items: [funnelStepUserSnapshotItem()],
		...overrides,
	};
}

function engagementSnapshot(
	overrides: Partial<AdminAnalyticsEngagementSnapshot> = {},
): AdminAnalyticsEngagementSnapshot {
	return {
		activity: {
			dau: 0,
			wau: 0,
			mau: 0,
			activeDays: 0,
			activeUsers: 0,
			actions: 0,
			actingUsers: 0,
			activeFreeTrialUsers: 0,
		},
		activityByDay: [],
		returning: [],
		cohorts: [],
		healthyTrialsByDay: [],
		...overrides,
	};
}

function revenueSnapshot(
	overrides: Partial<AdminAnalyticsRevenueSnapshot> = {},
): AdminAnalyticsRevenueSnapshot {
	return {
		activePaidUsers: 0,
		mrrSubscriptions: [],
		mrrPlanOwners: [],
		newPaidUsersInRange: 0,
		cohortPaidUsers: 0,
		costs: {
			adSpendBySourceCents: {},
			adSpendCents: 0,
			costCoverageComplete: false,
			infrastructureCostCents: 0,
			otherCostCents: 0,
			totalCostCents: 0,
		},
		freeOwnersInRange: 0,
		healthyTrialsInRange: 0,
		paidOwnersInRange: 0,
		daysInRange: 30,
		trialCohort: {
			matureUsers: 0,
			paidUsers: 0,
			trials: 0,
			healthyTrials: 0,
			healthyUsers: 0,
			healthyPaidUsers: 0,
			nonHealthyUsers: 0,
			nonHealthyPaidUsers: 0,
		},
		collectedRevenueByDay: [],
		revenueBySource: {
			subscriptionsCents: 0,
			topupsCents: 0,
			domainsCents: 0,
			domainOrders: 0,
			domainCostCents: 0,
			domainCostUnknownOrders: 0,
		},
		marginAfterAi: [],
		newPaidByDay: [],
		daysToConvert: [],
		checkoutFunnel: { completed: 0, started: 0 },
		lifecycle: {
			activePaidOwnersAtStart: 0,
			churnedOwners: 0,
			mrrAtStartSubscriptions: [],
			churnedSubscriptions: [],
			createdSubscriptions: [],
			planChanges: [],
		},
		paymentAdjustments: {
			refundsCents: 0,
			failedPayments: 0,
			failedPaymentsCents: 0,
		},
		retention: { cohorts: [] },
		churnBreakdown: {
			byPlan: [],
			bySource: [],
			byReason: [],
			byCountry: [],
			byFeature: [],
		},
		...overrides,
	};
}

function featuresSnapshot(
	overrides: Partial<AdminAnalyticsFeaturesSnapshot> = {},
): AdminAnalyticsFeaturesSnapshot {
	return {
		activeUsersInRange: 0,
		features: [],
		ads: {
			analysis: { events: 0, failed: 0, users: 0 },
			launch: { events: 0, failed: 0, users: 0 },
			connectedUsers: 0,
			totalUsers: 0,
		},
		credits: {
			grantedInRange: 0,
			consumedInRange: 0,
			freeConsumedInRange: 0,
			freeOwnersInRange: 0,
			paidConsumedInRange: 0,
			paidOwnersInRange: 0,
			freeConsumptionTotals: [],
			usersAtZeroBalance: 0,
			creditsBeforeUpgradeTotal: 0,
			convertedUsers: 0,
			providerCostMicros: 0,
			billableProviderCostMicros: 0,
			providerCostByProvenanceMicros: { measured: 0, contract: 0, estimate: 0 },
		},
		freeCredits: {
			avgSecondsToConsume: null,
			medianSecondsToConsume: null,
			measuredUsers: 0,
		},
		conversionByCredits: [],
		...overrides,
	};
}

function healthSnapshot(
	overrides: Partial<AdminAnalyticsHealthSnapshot> = {},
): AdminAnalyticsHealthSnapshot {
	return {
		generation: [],
		creditsRefundedInRange: 0,
		webhooks: {
			received: 0,
			processed: 0,
			skipped: 0,
			failed: 0,
			deadLettered: 0,
		},
		...overrides,
	};
}

describe("admin analytics metric policy", () => {
	it("keeps live-subscription and healthy-trial policy in shared constants", () => {
		expect(LIVE_SUBSCRIPTION_STATUSES).toEqual([
			"active",
			"trialing",
			"past_due",
		]);
		expect(HEALTHY_TRIAL_MIN_CREDITS).toBe(20);
		expect(HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS).toBe(2);
	});

	it.each([
		[20, 2, true],
		[19, 2, false],
		[20, 1, false],
		[100, 0, false],
	] as const)("classifies %i credits and %i completed generations", (credits, generations, expected) => {
		expect(isHealthyTrialActivity(credits, generations)).toBe(expected);
	});

	it("returns bounded percentages and zero for missing denominators", () => {
		expect(safePercentage(1, 3)).toBe(33.3);
		expect(safePercentage(0, 0)).toBe(0);
		expect(safePercentage(10, 0)).toBe(0);
		expect(safePercentage(12, 10)).toBe(100);
		expect(safePercentage(-1, 10)).toBe(0);
	});
});

describe("admin analytics acquisition and funnel", () => {
	it("assembles acquisition rates and catalog MRR with zero-safe conversion", () => {
		const response = assembleAcquisitionResponse(
			acquisitionSnapshot({
				sources: [
					{
						source: "organic_search",
						signups: 5,
						activated: 3,
						paid: 2,
						mrrSubscriptions: [
							{ priceLookupKey: "pro_250_year", subscribers: 2 },
						],
					},
					{
						source: "direct",
						signups: 0,
						activated: 0,
						paid: 0,
						mrrSubscriptions: [],
					},
				],
				campaigns: [
					{
						campaign: "launch",
						source: "email",
						signups: 4,
						paid: 1,
						mrrSubscriptions: [
							{ priceLookupKey: "business_250_month", subscribers: 1 },
						],
					},
				],
				countries: [{ country: "DZ", signups: 3, paid: 1 }],
				unattributedSignups: 2,
			}),
			NOW,
		);

		expect(adminAnalyticsAcquisitionResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.sources).toEqual([
			{
				source: "organic_search",
				signups: 5,
				activated: 3,
				paid: 2,
				signupToPaidPct: 40,
				mrrCents: 4_167,
				adSpendCents: null,
				cacCents: null,
			},
			{
				source: "direct",
				signups: 0,
				activated: 0,
				paid: 0,
				signupToPaidPct: 0,
				mrrCents: 0,
				adSpendCents: null,
				cacCents: null,
			},
		]);
		expect(response.campaigns[0]?.mrrCents).toBe(5_000);
		expect(response.unattributed).toEqual({ signups: 2 });
	});

	it("allocates complete acquisition spend, includes unmatched sources in total CAC, and nulls filtered costs", () => {
		const snapshot = acquisitionSnapshot({
			costs: {
				adSpendBySourceCents: { organic_search: 6_000, meta: 4_000 },
				adSpendCents: 10_000,
				costCoverageComplete: true,
				infrastructureCostCents: 2_000,
				otherCostCents: 1_000,
				totalCostCents: 13_000,
			},
			sources: [
				{
					source: "organic_search",
					signups: 5,
					activated: 3,
					paid: 2,
					mrrSubscriptions: [],
				},
				{
					source: "direct",
					signups: 2,
					activated: 1,
					paid: 0,
					mrrSubscriptions: [],
				},
			],
		});
		const unfiltered = assembleAcquisitionResponse(snapshot, NOW);
		const filtered = assembleAcquisitionResponse(
			{ ...snapshot, costsAttributionFiltered: true },
			NOW,
		);

		expect(unfiltered).toMatchObject({
			adSpendCents: 10_000,
			cacCents: 5_000,
			costCoverageComplete: true,
		});
		expect(unfiltered.sources).toEqual([
			expect.objectContaining({
				source: "organic_search",
				adSpendCents: 6_000,
				cacCents: 3_000,
			}),
			expect.objectContaining({
				source: "direct",
				adSpendCents: 0,
				cacCents: null,
			}),
		]);
		expect(filtered.adSpendCents).toBeNull();
		expect(filtered.cacCents).toBeNull();
		expect(filtered.costCoverageComplete).toBe(true);
		expect(
			filtered.sources.every((source) => source.adSpendCents === null),
		).toBe(true);
	});

	it("merges case-variant sources before allocating normalized spend", () => {
		const response = assembleAcquisitionResponse(
			acquisitionSnapshot({
				costs: {
					adSpendBySourceCents: { meta: 1_000 },
					adSpendCents: 1_000,
					costCoverageComplete: true,
					infrastructureCostCents: 0,
					otherCostCents: 0,
					totalCostCents: 1_000,
				},
				sources: [
					{
						source: "Meta",
						signups: 1,
						activated: 1,
						paid: 1,
						mrrSubscriptions: [],
					},
					{
						source: "meta",
						signups: 1,
						activated: 0,
						paid: 1,
						mrrSubscriptions: [],
					},
				],
			}),
			NOW,
		);

		expect(response.cacCents).toBe(500);
		expect(response.sources).toEqual([
			expect.objectContaining({
				source: "meta",
				signups: 2,
				activated: 1,
				paid: 2,
				adSpendCents: 1_000,
				cacCents: 500,
			}),
		]);
	});

	it("assembles fixed funnel order with null and zero-safe percentages", () => {
		const response = assembleFunnelResponse(
			funnelSnapshot({ checkoutStarted: 3, paid: 1 }),
			NOW,
		);

		expect(adminAnalyticsFunnelResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.steps.map(({ key }) => key)).toEqual(
			adminAnalyticsFunnelStepKeys,
		);
		expect(response.steps).toEqual([
			{ key: "visitor", count: 0, pctOfPrevious: null },
			{ key: "signup", count: 0, pctOfPrevious: 0 },
			{ key: "firstAction", count: 0, pctOfPrevious: 0 },
			{ key: "activated", count: 0, pctOfPrevious: 0 },
			{ key: "healthyTrial", count: 0, pctOfPrevious: 0 },
			{ key: "pricingViewed", count: 0, pctOfPrevious: 0 },
			{ key: "upgradeClicked", count: 0, pctOfPrevious: 0 },
			{ key: "checkoutStarted", count: 3, pctOfPrevious: 0 },
			{ key: "paid", count: 1, pctOfPrevious: 33.3 },
		]);
	});

	it("converts funnel duration seconds to hours and preserves null aggregates", () => {
		const response = assembleFunnelResponse(
			funnelSnapshot({
				durations: {
					signupToFirstAction: {
						medianSeconds: 5_400,
						avgSeconds: 7_200,
						users: 4,
					},
					signupToFirstGeneration: {
						medianSeconds: null,
						avgSeconds: null,
						users: 0,
					},
				},
			}),
			NOW,
		);

		expect(adminAnalyticsFunnelResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.durations).toEqual({
			signupToFirstAction: {
				medianHours: 1.5,
				avgHours: 2,
				users: 4,
			},
			signupToFirstGeneration: {
				medianHours: null,
				avgHours: null,
				users: 0,
			},
		});
	});

	it("chains real pricing-viewed and upgrade-clicked cohort counts", () => {
		const response = assembleFunnelResponse(
			funnelSnapshot({
				visitors: 100,
				signups: 50,
				firstActions: 40,
				activated: 30,
				healthyTrials: 20,
				pricingViewed: 15,
				upgradeClicked: 12,
				checkoutStarted: 10,
				paid: 5,
			}),
			NOW,
		);

		expect(response.steps.slice(5)).toEqual([
			{ key: "pricingViewed", count: 15, pctOfPrevious: 75 },
			{ key: "upgradeClicked", count: 12, pctOfPrevious: 80 },
			{ key: "checkoutStarted", count: 10, pctOfPrevious: 83.3 },
			{ key: "paid", count: 5, pctOfPrevious: 50 },
		]);
	});

	it("assembles funnel-step users with ISO dates and contact metadata", () => {
		const response = assembleFunnelStepUsersResponse(
			funnelStepUsersSnapshot({
				page: 2,
				pageSize: 2,
				total: 2,
				counts: { all: 5, contacted: 1, converted: 1 },
				items: [
					funnelStepUserSnapshotItem({
						converted: true,
						contact: {
							contactedAt: new Date("2026-08-04T12:00:00.000Z"),
							contactedBy: { id: "admin_1", name: "Grace Hopper" },
						},
					}),
					funnelStepUserSnapshotItem({
						userId: "user_2",
						name: "Lin Chen",
						email: "lin@example.com",
						signedUpAt: "2026-08-05T08:00:00+01:00",
						firstEventAt: "2026-08-05T09:00:00+01:00",
						lastEventAt: "2026-08-05T10:00:00+01:00",
						eventCount: 1,
					}),
				],
			}),
			"pricingViewed",
			NOW,
		);

		expect(adminAnalyticsFunnelStepUsersResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response).toEqual({
			updatedAt: NOW.toISOString(),
			step: "pricingViewed",
			page: 2,
			pageSize: 2,
			total: 2,
			counts: { all: 5, contacted: 1, converted: 1 },
			items: [
				{
					id: "user_1",
					name: "Ada Lovelace",
					email: "ada@example.com",
					image: null,
					signedUpAt: "2026-08-01T09:00:00.000Z",
					firstEventAt: "2026-08-02T10:00:00.000Z",
					lastEventAt: "2026-08-03T11:00:00.000Z",
					eventCount: 2,
					converted: true,
					contact: {
						contactedAt: "2026-08-04T12:00:00.000Z",
						contactedBy: { id: "admin_1", name: "Grace Hopper" },
					},
				},
				{
					id: "user_2",
					name: "Lin Chen",
					email: "lin@example.com",
					image: null,
					signedUpAt: "2026-08-05T07:00:00.000Z",
					firstEventAt: "2026-08-05T08:00:00.000Z",
					lastEventAt: "2026-08-05T09:00:00.000Z",
					eventCount: 1,
					converted: false,
					contact: null,
				},
			],
		});
	});
});

describe("admin analytics engagement", () => {
	it("computes exact day-X retention and fills weekly cohort gaps", () => {
		const response = assembleEngagementResponse(
			engagementSnapshot({
				activity: {
					dau: 5,
					wau: 10,
					mau: 20,
					activeDays: 7,
					activeUsers: 3,
					actions: 11,
					actingUsers: 4,
					activeFreeTrialUsers: 4,
				},
				activityByDay: [{ date: "2026-08-13", activeUsers: 5 }],
				returning: [
					{ day: 1, eligibleUsers: 4, returningUsers: 3 },
					{ day: 3, eligibleUsers: 2, returningUsers: 1 },
					{ day: 7, eligibleUsers: 0, returningUsers: 0 },
				],
				cohorts: [
					{
						cohortWeekStart: "2026-08-10",
						size: 4,
						weekIndex: 2,
						activeUsers: 1,
					},
					{
						cohortWeekStart: "2026-08-03",
						size: 2,
						weekIndex: 1,
						activeUsers: 1,
					},
					{
						cohortWeekStart: "2026-08-10",
						size: 4,
						weekIndex: 0,
						activeUsers: 4,
					},
				],
				healthyTrialsByDay: [{ date: "2026-08-13", count: 2 }],
			}),
			NOW,
		);

		expect(adminAnalyticsEngagementResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.activity).toEqual({
			dau: 5,
			wau: 10,
			mau: 20,
			dauMauPct: 25,
			avgActiveDaysPerUser: 2.3,
			avgActionsPerUser: 2.75,
			activeFreeTrialUsers: 4,
		});
		expect(response.returning).toEqual({
			d1Pct: 75,
			d3Pct: 50,
			d7Pct: 0,
			d14Pct: 0,
			d30Pct: 0,
		});
		expect(response.cohorts).toEqual([
			{ cohortWeekStart: "2026-08-03", size: 2, weeks: [0, 50] },
			{ cohortWeekStart: "2026-08-10", size: 4, weeks: [100, 0, 25] },
		]);
	});

	it("returns zero average actions when no users performed metered actions", () => {
		const response = assembleEngagementResponse(
			engagementSnapshot({
				activity: {
					...engagementSnapshot().activity,
					actions: 12,
					actingUsers: 0,
				},
			}),
			NOW,
		);

		expect(response.activity.avgActionsPerUser).toBe(0);
		expect(adminAnalyticsEngagementResponseSchema.parse(response)).toEqual(
			response,
		);
	});
});

describe("admin analytics MRR", () => {
	it("builds an exact catalog map and aggregates annual fractional cents before rounding", () => {
		expect(MRR_PRICE_MAP.size).toBe(36);
		expect(MRR_PRICE_MAP.get("pro_250_month")).toMatchObject({
			interval: "month",
			mrrMinorExact: 2_500,
			plan: "pro",
		});
		expect(MRR_PRICE_MAP.get("pro_250_year")?.mrrMinorExact).toBeCloseTo(
			25_000 / 12,
		);

		const response = assembleRevenueResponse(
			revenueSnapshot({
				activePaidUsers: 2,
				mrrSubscriptions: [
					{ priceLookupKey: "pro_250_year", subscribers: 2 },
					{ priceLookupKey: "unknown_price", subscribers: 99 },
				],
			}),
			NOW,
		);

		expect(response.tiles).toMatchObject({
			activePaidUsers: 2,
			arpuMinor: 2_083,
			mrrMinor: 4_167,
		});
		expect(response.mrrByPlan).toEqual([
			{ interval: "month", mrrMinor: 0, plan: "pro", subscribers: 0 },
			{
				interval: "year",
				mrrMinor: 4_167,
				plan: "pro",
				subscribers: 2,
			},
			{
				interval: "month",
				mrrMinor: 0,
				plan: "business",
				subscribers: 0,
			},
			{
				interval: "year",
				mrrMinor: 0,
				plan: "business",
				subscribers: 0,
			},
		]);
	});
});

describe("admin analytics revenue extensions", () => {
	it("splits revenue by source and derives domain margin", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				revenueBySource: {
					subscriptionsCents: 10_000,
					topupsCents: 0,
					domainsCents: 1_499,
					domainOrders: 1,
					domainCostCents: 1_299,
					domainCostUnknownOrders: 0,
				},
			}),
			NOW,
		);

		expect(response.revenueBySource).toEqual({
			subscriptionsCents: 10_000,
			topupsCents: 0,
			domainsCents: 1_499,
			domainOrders: 1,
			domainCostCents: 1_299,
			domainMarginCents: 200,
			domainMarginPct: (200 / 1_499) * 100,
			domainCostUnknownOrders: 0,
		});
	});

	it("nulls the domain margin percent when no domain cash was collected", () => {
		const response = assembleRevenueResponse(revenueSnapshot(), NOW);

		expect(response.revenueBySource.domainMarginCents).toBe(0);
		expect(response.revenueBySource.domainMarginPct).toBeNull();
	});

	it("emits margin after AI in contract order and rounds each margin percent", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				marginAfterAi: [
					{ plan: "free", revenueCents: 0, aiCostCents: 4_200 },
					{ plan: "business", revenueCents: 30_000, aiCostCents: 9_000 },
					{ plan: "pro", revenueCents: 10_000, aiCostCents: 3_333 },
				],
			}),
			NOW,
		);

		expect(adminAnalyticsRevenueResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.marginAfterAi).toEqual([
			{
				plan: "pro",
				revenueCents: 10_000,
				aiCostCents: 3_333,
				marginCents: 6_667,
				marginPct: 66.7,
			},
			{
				plan: "business",
				revenueCents: 30_000,
				aiCostCents: 9_000,
				marginCents: 21_000,
				marginPct: 70,
			},
			{
				plan: "free",
				revenueCents: 0,
				aiCostCents: 4_200,
				marginCents: -4_200,
				marginPct: null,
			},
		]);
	});

	it("keeps three zero margin rows when the range measured no cash and no AI cost", () => {
		const response = assembleRevenueResponse(revenueSnapshot(), NOW);

		expect(response.marginAfterAi).toEqual([
			{
				plan: "pro",
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
			{
				plan: "business",
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
			{
				plan: "free",
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
		]);
	});

	it("reports free AI cost as a negative margin and drops plans outside the contract", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				marginAfterAi: [
					{ plan: "free", revenueCents: 0, aiCostCents: 1_250 },
					{ plan: "enterprise", revenueCents: 90_000, aiCostCents: 100 },
				],
			}),
			NOW,
		);

		expect(response.marginAfterAi).toEqual([
			{
				plan: "pro",
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
			{
				plan: "business",
				revenueCents: 0,
				aiCostCents: 0,
				marginCents: 0,
				marginPct: null,
			},
			{
				plan: "free",
				revenueCents: 0,
				aiCostCents: 1_250,
				marginCents: -1_250,
				marginPct: null,
			},
		]);
	});

	it("computes churn, LTV, net-new MRR, net revenue, and plan ARPU", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				activePaidUsers: 3,
				mrrSubscriptions: [
					{ priceLookupKey: "pro_250_month", subscribers: 2 },
					{ priceLookupKey: "business_250_month", subscribers: 1 },
				],
				mrrPlanOwners: [
					{ plan: "pro", owners: 2 },
					{ plan: "business", owners: 1 },
				],
				daysInRange: 30,
				collectedRevenueByDay: [
					{
						date: "2026-08-12",
						subscriptionsMinor: 2_500,
						ordersMinor: 1_000,
						topupsMinor: 0,
					},
					{
						date: "2026-08-13",
						subscriptionsMinor: 500,
						ordersMinor: 0,
						topupsMinor: 0,
					},
				],
				lifecycle: {
					activePaidOwnersAtStart: 10,
					churnedOwners: 2,
					mrrAtStartSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 4 },
						{ priceLookupKey: "business_250_month", subscriptions: 2 },
					],
					churnedSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 1 },
						{ priceLookupKey: "business_250_month", subscriptions: 1 },
					],
					createdSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 2 },
					],
					planChanges: [
						{
							fromLookupKey: "pro_250_month",
							toLookupKey: "pro_500_month",
							count: 1,
						},
						{
							fromLookupKey: "business_250_month",
							toLookupKey: "pro_250_month",
							count: 1,
						},
						{
							fromLookupKey: null,
							toLookupKey: "pro_250_month",
							count: 5,
						},
					],
				},
				paymentAdjustments: {
					refundsCents: 500,
					failedPayments: 2,
					failedPaymentsCents: 1_200,
				},
			}),
			NOW,
		);

		expect(adminAnalyticsRevenueResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.churn).toEqual({
			customerChurnPct: 20,
			mrrChurnPct: 37.5,
			churnedMrrCents: 7_500,
			netNewMrrCents: -2_500,
			upgrades: 1,
			downgrades: 1,
			ltvCents: 16_424,
		});
		expect(response.netRevenue).toEqual({
			grossCents: 4_000,
			refundsCents: 500,
			netCents: 3_500,
			failedPayments: 2,
			failedPaymentsCents: 1_200,
		});
		expect(response.arpuByPlan).toEqual([
			{ plan: "pro", arpuCents: 2_500 },
			{ plan: "business", arpuCents: 5_000 },
		]);
	});

	it("counts top-up cash in gross revenue symmetrically with refunds and exposes it by source", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				collectedRevenueByDay: [
					{
						date: "2026-08-13",
						subscriptionsMinor: 2_500,
						ordersMinor: 1_000,
						topupsMinor: 2_500,
					},
				],
				paymentAdjustments: {
					refundsCents: 2_500,
					failedPayments: 0,
					failedPaymentsCents: 0,
				},
				revenueBySource: {
					subscriptionsCents: 2_500,
					topupsCents: 2_500,
					domainsCents: 1_000,
					domainOrders: 1,
					domainCostCents: 800,
					domainCostUnknownOrders: 0,
				},
			}),
			NOW,
		);

		// A refunded top-up nets to zero instead of eating subscription cash.
		expect(response.netRevenue).toMatchObject({
			grossCents: 6_000,
			refundsCents: 2_500,
			netCents: 3_500,
		});
		expect(response.revenueBySource.topupsCents).toBe(2_500);
	});

	it("returns null churn ratios and LTV for unavailable denominators", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				daysInRange: 0,
				paymentAdjustments: {
					refundsCents: 500,
					failedPayments: 0,
					failedPaymentsCents: 0,
				},
			}),
			NOW,
		);

		expect(response.churn).toMatchObject({
			customerChurnPct: null,
			mrrChurnPct: null,
			ltvCents: null,
		});
		expect(response.netRevenue.netCents).toBe(-500);
		expect(response.arpuByPlan).toEqual([
			{ plan: "pro", arpuCents: 0 },
			{ plan: "business", arpuCents: 0 },
		]);
	});

	it("computes every unit-economics formula from covered costs and binding denominators", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				activePaidUsers: 2,
				mrrSubscriptions: [{ priceLookupKey: "pro_250_month", subscribers: 2 }],
				cohortPaidUsers: 2,
				freeOwnersInRange: 4,
				healthyTrialsInRange: 2,
				paidOwnersInRange: 5,
				costs: {
					adSpendBySourceCents: { direct: 1_000 },
					adSpendCents: 1_000,
					costCoverageComplete: true,
					infrastructureCostCents: 1_000,
					otherCostCents: 2_000,
					totalCostCents: 4_000,
				},
				collectedRevenueByDay: [
					{
						date: "2026-08-13",
						subscriptionsMinor: 5_000,
						ordersMinor: 0,
						topupsMinor: 0,
					},
				],
				lifecycle: {
					...revenueSnapshot().lifecycle,
					activePaidOwnersAtStart: 10,
					churnedOwners: 1,
					mrrAtStartSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 10 },
					],
					churnedSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 1 },
					],
				},
			}),
			NOW,
		);

		expect(response.unitEconomics).toEqual({
			adSpendCents: 1_000,
			infrastructureCostCents: 1_000,
			otherCostCents: 2_000,
			totalCostCents: 4_000,
			cacCents: 500,
			ltvCacRatio:
				Math.round(((response.churn.ltvCents ?? 0) / 500) * 100) / 100,
			grossMarginPct: 80,
			cacPaybackMonths: 0.3,
			costPerFreeActiveUserCents: 1_000,
			costPerHealthyTrialCents: 2_000,
			costPerActivePaidUserCents: 800,
			costCoverageComplete: true,
		});
	});

	it("nulls every cost-derived unit metric when monthly coverage is incomplete", () => {
		const unitEconomics = assembleRevenueResponse(
			revenueSnapshot(),
			NOW,
		).unitEconomics;

		expect(unitEconomics.costCoverageComplete).toBe(false);
		expect(
			Object.entries(unitEconomics)
				.filter(([key]) => key !== "costCoverageComplete")
				.every(([, value]) => value === null),
		).toBe(true);
	});

	it("keeps zero churn measurable, clamps ratios, and leaves zero-churn LTV unavailable", () => {
		const zeroChurn = assembleRevenueResponse(
			revenueSnapshot({
				lifecycle: {
					...revenueSnapshot().lifecycle,
					activePaidOwnersAtStart: 10,
					mrrAtStartSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 1 },
					],
				},
			}),
			NOW,
		);
		const clamped = assembleRevenueResponse(
			revenueSnapshot({
				lifecycle: {
					...revenueSnapshot().lifecycle,
					activePaidOwnersAtStart: 1,
					churnedOwners: 2,
					mrrAtStartSubscriptions: [
						{ priceLookupKey: "pro_250_month", subscriptions: 1 },
					],
					churnedSubscriptions: [
						{ priceLookupKey: "business_250_month", subscriptions: 1 },
					],
				},
			}),
			NOW,
		);

		expect(zeroChurn.churn).toMatchObject({
			customerChurnPct: 0,
			mrrChurnPct: 0,
			ltvCents: null,
		});
		expect(clamped.churn).toMatchObject({
			customerChurnPct: 100,
			mrrChurnPct: 100,
		});
	});

	it("computes retention points with uncapped expansion revenue and null M0 denominators", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				retention: {
					cohorts: [
						{
							cohortMonth: "2026-07-01",
							owners: 2,
							points: [
								{
									monthIndex: 1,
									paidOwners: 1,
									mrrSubscriptions: [
										{
											priceLookupKey: "pro_500_month",
											subscriptions: 1,
										},
									],
								},
								{
									monthIndex: 0,
									paidOwners: 3,
									mrrSubscriptions: [
										{
											priceLookupKey: "pro_250_year",
											subscriptions: 1,
										},
									],
								},
							],
						},
						{
							cohortMonth: "2026-08-01",
							owners: 1,
							points: [
								{
									monthIndex: 0,
									paidOwners: 0,
									mrrSubscriptions: [
										{
											priceLookupKey: "unknown_price",
											subscriptions: 1,
										},
									],
								},
							],
						},
					],
				},
			}),
			NOW,
		);

		expect(adminAnalyticsRevenueResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.retention.cohorts).toEqual([
			{
				cohortMonth: "2026-07-01",
				owners: 2,
				m0MrrCents: 2_083,
				points: [
					{ paidPct: 100, revenuePct: 100 },
					{ paidPct: 50, revenuePct: 240 },
				],
			},
			{
				cohortMonth: "2026-08-01",
				owners: 1,
				m0MrrCents: 0,
				points: [{ paidPct: 0, revenuePct: null }],
			},
		]);
	});

	it("assembles catalog MRR and preserves unknown churn breakdown rows", () => {
		const response = assembleRevenueResponse(
			revenueSnapshot({
				churnBreakdown: {
					byPlan: [
						{
							plan: "unknown",
							churned: 1,
							mrrSubscriptions: [
								{
									priceLookupKey: "unknown_price",
									subscriptions: 3,
								},
							],
						},
						{
							plan: "pro",
							churned: 3,
							mrrSubscriptions: [
								{
									priceLookupKey: "pro_250_year",
									subscriptions: 2,
								},
							],
						},
					],
					bySource: [
						{ source: "direct", churned: 1 },
						{ source: "unknown", churned: 4 },
					],
					byReason: [
						{ reason: "too_expensive", churned: 2 },
						{ reason: "unknown", churned: 1 },
					],
					byCountry: [
						{ country: "DZ", churned: 1 },
						{ country: "unknown", churned: 2 },
					],
					byFeature: [
						{ feature: "chat", churned: 1 },
						{ feature: "images", churned: 2 },
					],
				},
			}),
			NOW,
		);

		expect(adminAnalyticsRevenueResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.churnBreakdown).toEqual({
			byPlan: [
				{ plan: "pro", churned: 3, churnedMrrCents: 4_167 },
				{ plan: "unknown", churned: 1, churnedMrrCents: 0 },
			],
			bySource: [
				{ source: "unknown", churned: 4 },
				{ source: "direct", churned: 1 },
			],
			byReason: [
				{ reason: "too_expensive", churned: 2 },
				{ reason: "unknown", churned: 1 },
			],
			byCountry: [
				{ country: "unknown", churned: 2 },
				{ country: "DZ", churned: 1 },
			],
			byFeature: [
				{ feature: "images", churned: 2 },
				{ feature: "chat", churned: 1 },
			],
		});
	});
});

describe("admin analytics buckets", () => {
	it.each([
		[0, "0"],
		[1, "1"],
		[2, "2"],
		[3, "3"],
		[4, "4-5"],
		[5, "4-5"],
		[6, "6-7"],
		[7, "6-7"],
		[8, "8-14"],
		[14, "8-14"],
		[15, "15+"],
	] as const)("puts conversion day %i in %s", (days, bucket) => {
		expect(daysToConvertBucket(days)).toBe(bucket);
	});

	it.each([
		[0, "0"],
		[1, "1-9"],
		[9, "1-9"],
		[10, "10-24"],
		[24, "10-24"],
		[25, "25-39"],
		[39, "25-39"],
		[40, "40-49"],
		[49, "40-49"],
		[50, "50+"],
	] as const)("puts %i consumed credits in %s", (credits, bucket) => {
		expect(consumptionBucket(credits)).toBe(bucket);
	});

	it("emits every conversion and consumption bucket in contract order", () => {
		const revenue = assembleRevenueResponse(
			revenueSnapshot({
				daysToConvert: [
					{ count: 2, days: 4 },
					{ count: 3, days: 5 },
				],
			}),
			NOW,
		);
		const features = assembleFeaturesResponse(
			featuresSnapshot({
				credits: {
					...featuresSnapshot().credits,
					// Snapshot sums are centi-credits (5_000 = 50 credits).
					freeConsumptionTotals: [
						{ consumed: 0, users: 2 },
						{ consumed: 5_000, users: 3 },
					],
				},
			}),
			NOW,
		);

		expect(revenue.daysToConvert.map(({ bucket }) => bucket)).toEqual(
			adminAnalyticsDaysToConvertBuckets,
		);
		expect(
			revenue.daysToConvert.find(({ bucket }) => bucket === "4-5")?.count,
		).toBe(5);
		expect(
			features.credits.consumptionBuckets.map(({ bucket }) => bucket),
		).toEqual(adminAnalyticsConsumptionBuckets);
	});

	it("prices credits from billable spend and exposes total spend with its provenance split", () => {
		const response = assembleFeaturesResponse(
			featuresSnapshot({
				credits: {
					...featuresSnapshot().credits,
					// 50 credits consumed; $0.12 billable of $0.20 total spend.
					consumedInRange: 5_000,
					providerCostMicros: 200_000,
					billableProviderCostMicros: 120_000,
					providerCostByProvenanceMicros: {
						measured: 150_000,
						contract: 30_000,
						estimate: 20_000,
					},
				},
			}),
			NOW,
		);

		expect(response.credits).toMatchObject({
			providerCostPerCreditMicros: 2_400,
			totalProviderCostMicros: 200_000,
			billableProviderCostMicros: 120_000,
			providerCostByProvenanceMicros: {
				measured: 150_000,
				contract: 30_000,
				estimate: 20_000,
			},
		});
	});

	it("assembles free-credit timing and zero-safe paid conversion buckets", () => {
		const response = assembleFeaturesResponse(
			featuresSnapshot({
				activeUsersInRange: 2,
				features: [
					{
						key: "chat",
						users: 2,
						uses: 4,
						paidUsers: 1,
						convertedAfterUseUsers: 3,
					},
					{
						key: "images",
						users: 0,
						uses: 0,
						paidUsers: 0,
						convertedAfterUseUsers: 0,
					},
				],
				freeCredits: {
					avgSecondsToConsume: null,
					medianSecondsToConsume: 129_600,
					measuredUsers: 2,
				},
				// Snapshot sums are centi-credits; buckets stay whole credits
				// (100 cc = 1 credit lands in "1-9").
				conversionByCredits: [
					{ consumed: 100, owners: 1, paidOwners: 1 },
					{ consumed: 900, owners: 2, paidOwners: 1 },
					{ consumed: 1_000, owners: 2, paidOwners: 3 },
				],
			}),
			NOW,
		);

		expect(adminAnalyticsFeaturesResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.freeCredits).toEqual({
			avgDaysToConsume: null,
			medianDaysToConsume: 1.5,
			measuredUsers: 2,
		});
		expect(
			response.features.find(({ key }) => key === "chat")?.convertedAfterUsePct,
		).toBe(100);
		expect(
			response.features.find(({ key }) => key === "images")
				?.convertedAfterUsePct,
		).toBeNull();
		expect(response.conversionByCredits).toEqual([
			{ bucket: "0", owners: 0, paidOwners: 0, paidPct: null },
			{ bucket: "1-9", owners: 3, paidOwners: 2, paidPct: 66.7 },
			{ bucket: "10-24", owners: 2, paidOwners: 3, paidPct: 100 },
			{ bucket: "25-39", owners: 0, paidOwners: 0, paidPct: null },
			{ bucket: "40-49", owners: 0, paidOwners: 0, paidPct: null },
			{ bucket: "50+", owners: 0, paidOwners: 0, paidPct: null },
		]);
	});
});

describe("admin analytics response assembly", () => {
	it("returns null ads rates when there are no provider operations or users", () => {
		const response = assembleFeaturesResponse(featuresSnapshot(), NOW);

		expect(response.ads).toEqual({
			analysis: { events: 0, users: 0, errorRatePct: null },
			launch: { events: 0, users: 0, errorRatePct: null },
			connectedUsers: 0,
			totalUsers: 0,
			connectedPct: null,
		});
	});

	it("derives ads success usage, error rates, and point-in-time connectivity", () => {
		const response = assembleFeaturesResponse(
			featuresSnapshot({
				ads: {
					analysis: { events: 8, failed: 2, users: 4 },
					launch: { events: 0, failed: 1, users: 0 },
					connectedUsers: 3,
					totalUsers: 10,
				},
			}),
			NOW,
		);

		expect(response.ads).toEqual({
			analysis: { events: 8, users: 4, errorRatePct: 20 },
			launch: { events: 0, users: 0, errorRatePct: 100 },
			connectedUsers: 3,
			totalUsers: 10,
			connectedPct: 30,
		});
		expect(adminAnalyticsFeaturesResponseSchema.parse(response)).toEqual(
			response,
		);
	});

	it("assembles contract-valid responses with fixed feature and generation order", () => {
		const revenue = assembleRevenueResponse(
			revenueSnapshot({
				trialCohort: {
					matureUsers: 10,
					paidUsers: 4,
					trials: 6,
					healthyTrials: 2,
					healthyUsers: 4,
					healthyPaidUsers: 2,
					nonHealthyUsers: 6,
					nonHealthyPaidUsers: 2,
				},
				checkoutFunnel: { completed: 3, started: 4 },
			}),
			NOW,
		);
		const features = assembleFeaturesResponse(
			featuresSnapshot({
				activeUsersInRange: 4,
				features: [
					{
						key: "chat",
						paidUsers: 1,
						convertedAfterUseUsers: 1,
						users: 2,
						uses: 5,
					},
				],
			}),
			NOW,
		);
		const health = assembleHealthResponse(
			healthSnapshot({
				generation: [
					{
						key: "connectors",
						attempts: 4,
						successful: 3,
						failed: 1,
						p50Ms: 500,
						p95Ms: 900,
						topFailures: [],
					},
				],
			}),
			NOW,
		);

		expect(adminAnalyticsRevenueResponseSchema.parse(revenue)).toEqual(revenue);
		expect(adminAnalyticsFeaturesResponseSchema.parse(features)).toEqual(
			features,
		);
		expect(adminAnalyticsHealthResponseSchema.parse(health)).toEqual(health);
		expect(features.features.map(({ key }) => key)).toEqual(
			adminAnalyticsFeatureKeys,
		);
		expect(health.generation.map(({ key }) => key)).toEqual(
			adminAnalyticsGenerationKeys,
		);
		expect(
			health.generation
				.filter(({ latencyIncludesQueue }) => latencyIncludesQueue)
				.map(({ key }) => key),
		).toEqual(["pages", "connectors", "leadScraping"]);
	});
});

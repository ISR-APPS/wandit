import {
	adminAnalyticsAcquisitionResponseSchema,
	adminAnalyticsEngagementResponseSchema,
	adminAnalyticsFeaturesResponseSchema,
	adminAnalyticsFunnelResponseSchema,
	adminAnalyticsHealthResponseSchema,
	adminAnalyticsRevenueResponseSchema,
} from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AdminAnalyticsAcquisitionSnapshot,
	AdminAnalyticsEngagementSnapshot,
	AdminAnalyticsFeaturesSnapshot,
	AdminAnalyticsFunnelSnapshot,
	AdminAnalyticsHealthSnapshot,
	AdminAnalyticsRepository,
	AdminAnalyticsRevenueSnapshot,
} from "../../infrastructure/persistence/admin-analytics.repository";
import { AdminAnalyticsService } from "./admin-analytics.service";

const NOW = new Date("2026-08-13T10:20:30.000Z");

const REVENUE_SNAPSHOT = {
	activePaidUsers: 3,
	mrrSubscriptions: [
		{ priceLookupKey: "pro_250_month", subscribers: 2 },
		{ priceLookupKey: "business_500_year", subscribers: 1 },
	],
	mrrPlanOwners: [
		{ plan: "pro", owners: 2 },
		{ plan: "business", owners: 1 },
	],
	newPaidUsersInRange: 2,
	cohortPaidUsers: 2,
	costs: {
		adSpendBySourceCents: { organic_search: 1_000 },
		adSpendCents: 1_000,
		costCoverageComplete: true,
		infrastructureCostCents: 500,
		otherCostCents: 250,
		totalCostCents: 1_750,
	},
	freeOwnersInRange: 5,
	healthyTrialsInRange: 2,
	paidOwnersInRange: 3,
	daysInRange: 7,
	trialCohort: {
		matureUsers: 20,
		paidUsers: 8,
		trials: 12,
		healthyTrials: 3,
		healthyUsers: 7,
		healthyPaidUsers: 4,
		nonHealthyUsers: 13,
		nonHealthyPaidUsers: 4,
	},
	collectedRevenueByDay: [
		{ date: "2026-08-13", subscriptionsMinor: 2_500, ordersMinor: 1_000 },
	],
	revenueBySource: {
		subscriptionsCents: 2_500,
		domainsCents: 1_000,
		domainOrders: 1,
		domainCostCents: 800,
		domainCostUnknownOrders: 0,
	},
	newPaidByDay: [{ date: "2026-08-13", count: 2 }],
	daysToConvert: [
		{ days: 0, count: 1 },
		{ days: 6, count: 1 },
	],
	checkoutFunnel: { started: 5, completed: 4 },
	lifecycle: {
		activePaidOwnersAtStart: 3,
		churnedOwners: 1,
		mrrAtStartSubscriptions: [
			{ priceLookupKey: "pro_250_month", subscriptions: 2 },
		],
		churnedSubscriptions: [
			{ priceLookupKey: "pro_250_month", subscriptions: 1 },
		],
		createdSubscriptions: [
			{ priceLookupKey: "pro_250_month", subscriptions: 1 },
		],
		planChanges: [],
	},
	paymentAdjustments: {
		refundsCents: 100,
		failedPayments: 1,
		failedPaymentsCents: 2_500,
	},
	retention: {
		cohorts: [
			{
				cohortMonth: "2026-07-01",
				owners: 2,
				points: [
					{
						monthIndex: 0,
						paidOwners: 2,
						mrrSubscriptions: [
							{ priceLookupKey: "pro_250_month", subscriptions: 2 },
						],
					},
					{
						monthIndex: 1,
						paidOwners: 1,
						mrrSubscriptions: [
							{ priceLookupKey: "business_250_month", subscriptions: 1 },
						],
					},
				],
			},
		],
	},
	churnBreakdown: {
		byPlan: [
			{
				plan: "pro",
				churned: 1,
				mrrSubscriptions: [
					{ priceLookupKey: "pro_250_month", subscriptions: 1 },
				],
			},
		],
		bySource: [{ source: "unknown", churned: 1 }],
		byReason: [{ reason: "too_expensive", churned: 1 }],
		byCountry: [{ country: "unknown", churned: 1 }],
		byFeature: [{ feature: "websites", churned: 1 }],
	},
} satisfies AdminAnalyticsRevenueSnapshot;

const ACQUISITION_SNAPSHOT = {
	costs: {
		adSpendBySourceCents: { organic_search: 1_000 },
		adSpendCents: 1_000,
		costCoverageComplete: true,
		infrastructureCostCents: 500,
		otherCostCents: 250,
		totalCostCents: 1_750,
	},
	costsAttributionFiltered: false,
	sources: [
		{
			source: "organic_search",
			signups: 5,
			activated: 3,
			paid: 2,
			mrrSubscriptions: [{ priceLookupKey: "pro_250_month", subscribers: 2 }],
		},
	],
	campaigns: [],
	countries: [{ country: "DZ", signups: 3, paid: 1 }],
	unattributedSignups: 1,
} satisfies AdminAnalyticsAcquisitionSnapshot;

const FUNNEL_SNAPSHOT = {
	visitors: 100,
	signups: 50,
	firstActions: 40,
	activated: 30,
	healthyTrials: 20,
	pricingViewed: 15,
	upgradeClicked: 12,
	checkoutStarted: 10,
	paid: 5,
	durations: {
		signupToFirstAction: {
			medianSeconds: 3_600,
			avgSeconds: 7_200,
			users: 40,
		},
		signupToFirstGeneration: {
			medianSeconds: 5_400,
			avgSeconds: 10_800,
			users: 30,
		},
	},
} satisfies AdminAnalyticsFunnelSnapshot;

const ENGAGEMENT_SNAPSHOT = {
	activity: {
		dau: 5,
		wau: 10,
		mau: 20,
		activeDays: 30,
		activeUsers: 12,
		activeFreeTrialUsers: 4,
		actions: 36,
		actingUsers: 12,
	},
	activityByDay: [{ date: "2026-08-13", activeUsers: 5 }],
	returning: [
		{ day: 1, eligibleUsers: 10, returningUsers: 5 },
		{ day: 3, eligibleUsers: 8, returningUsers: 2 },
	],
	cohorts: [
		{
			cohortWeekStart: "2026-08-10",
			size: 4,
			weekIndex: 0,
			activeUsers: 4,
		},
	],
	healthyTrialsByDay: [{ date: "2026-08-13", count: 2 }],
} satisfies AdminAnalyticsEngagementSnapshot;

const FEATURES_SNAPSHOT = {
	activeUsersInRange: 5,
	ads: {
		analysis: { events: 8, failed: 2, users: 4 },
		launch: { events: 3, failed: 1, users: 2 },
		connectedUsers: 3,
		totalUsers: 10,
	},
	features: [
		{
			key: "websites",
			users: 3,
			uses: 6,
			paidUsers: 2,
			convertedAfterUseUsers: 1,
		},
		{
			key: "landingPages",
			users: 1,
			uses: 2,
			paidUsers: 0,
			convertedAfterUseUsers: 0,
		},
		{
			key: "chat",
			users: 3,
			uses: 12,
			paidUsers: 1,
			convertedAfterUseUsers: 2,
		},
	],
	// Snapshot credit sums are integer centi-credits (10_000 = 100 credits);
	// the assembled response divides by 100.
	credits: {
		grantedInRange: 10_000,
		consumedInRange: 5_000,
		freeConsumedInRange: 1_200,
		freeOwnersInRange: 3,
		paidConsumedInRange: 3_800,
		paidOwnersInRange: 2,
		freeConsumptionTotals: [
			{ consumed: 0, users: 2 },
			{ consumed: 1_200, users: 1 },
		],
		usersAtZeroBalance: 2,
		creditsBeforeUpgradeTotal: 3_000,
		convertedUsers: 2,
		providerCostMicros: 125,
	},
	freeCredits: {
		avgSecondsToConsume: 172_800,
		medianSecondsToConsume: 86_400,
		measuredUsers: 3,
	},
	conversionByCredits: [
		{ consumed: 0, owners: 2, paidOwners: 0 },
		// 1_200 centi-credits = 12 credits -> the "10-24" bucket.
		{ consumed: 1_200, owners: 3, paidOwners: 2 },
	],
} satisfies AdminAnalyticsFeaturesSnapshot;

const HEALTH_SNAPSHOT = {
	generation: [
		{
			key: "pages",
			attempts: 10,
			successful: 8,
			failed: 2,
			p50Ms: 1_200,
			p95Ms: 4_500,
			topFailures: [{ code: "provider_error", count: 2 }],
		},
	],
	// 1_000 centi-credits = 10 credits at the API.
	creditsRefundedInRange: 1_000,
	webhooks: {
		received: 8,
		processed: 5,
		skipped: 1,
		failed: 2,
		deadLettered: 1,
	},
} satisfies AdminAnalyticsHealthSnapshot;

function setup() {
	const repository = {
		getRevenue: vi.fn().mockResolvedValue(REVENUE_SNAPSHOT),
		getAcquisition: vi.fn().mockResolvedValue(ACQUISITION_SNAPSHOT),
		getFunnel: vi.fn().mockResolvedValue(FUNNEL_SNAPSHOT),
		getEngagement: vi.fn().mockResolvedValue(ENGAGEMENT_SNAPSHOT),
		getFeatures: vi.fn().mockResolvedValue(FEATURES_SNAPSHOT),
		getHealth: vi.fn().mockResolvedValue(HEALTH_SNAPSHOT),
	};
	const service = new AdminAnalyticsService(
		repository as unknown as AdminAnalyticsRepository,
	);

	return { repository, service };
}

describe("AdminAnalyticsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("assembles a contract-valid revenue response from a 7-day snapshot", async () => {
		const { repository, service } = setup();

		const response = await service.getRevenue({
			range: "7d",
			cohortOnly: false,
		});

		expect(repository.getRevenue).toHaveBeenCalledWith({
			rangeStart: new Date("2026-08-07T00:00:00.000Z"),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
		expect(adminAnalyticsRevenueResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.tiles).toMatchObject({
			activePaidUsers: 3,
			newPaidUsersInRange: 2,
		});
		expect(response.retention.cohorts[0]).toMatchObject({
			cohortMonth: "2026-07-01",
			owners: 2,
			m0MrrCents: 5_000,
		});
		expect(response.churnBreakdown.bySource).toEqual([
			{ source: "unknown", churned: 1 },
		]);
	});

	it("assembles a contract-valid acquisition response from a 7-day snapshot", async () => {
		const { repository, service } = setup();

		const response = await service.getAcquisition({
			range: "7d",
			cohortOnly: false,
		});

		expect(repository.getAcquisition).toHaveBeenCalledWith(
			{
				rangeStart: new Date("2026-08-07T00:00:00.000Z"),
				rangeEnd: NOW,
				seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
				snapshotEnd: NOW,
			},
			{},
		);
		expect(adminAnalyticsAcquisitionResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.sources[0]).toMatchObject({
			source: "organic_search",
			signupToPaidPct: 40,
			mrrCents: 5_000,
		});
	});

	it("assembles a contract-valid funnel response from a 30-day snapshot", async () => {
		const { repository, service } = setup();

		const response = await service.getFunnel({
			range: "30d",
			cohortOnly: false,
		});

		expect(repository.getFunnel).toHaveBeenCalledWith(
			{
				rangeStart: new Date("2026-07-15T00:00:00.000Z"),
				rangeEnd: NOW,
				seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
				snapshotEnd: NOW,
			},
			{},
		);
		expect(adminAnalyticsFunnelResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.steps.find(({ key }) => key === "pricingViewed")).toEqual({
			key: "pricingViewed",
			count: 15,
			pctOfPrevious: 75,
		});
		expect(response.steps.find(({ key }) => key === "upgradeClicked")).toEqual({
			key: "upgradeClicked",
			count: 12,
			pctOfPrevious: 80,
		});
		expect(response.durations).toEqual({
			signupToFirstAction: {
				medianHours: 1,
				avgHours: 2,
				users: 40,
			},
			signupToFirstGeneration: {
				medianHours: 1.5,
				avgHours: 3,
				users: 30,
			},
		});
	});

	it("assembles a contract-valid engagement response from historical custom bounds", async () => {
		const { repository, service } = setup();

		const response = await service.getEngagement({
			range: "custom",
			from: "2026-06-01",
			to: "2026-06-03",
			cohortOnly: false,
		});

		expect(repository.getEngagement).toHaveBeenCalledWith(
			{
				rangeStart: new Date("2026-06-01T00:00:00.000Z"),
				rangeEnd: new Date("2026-06-04T00:00:00.000Z"),
				seriesEnd: new Date("2026-06-03T00:00:00.000Z"),
				snapshotEnd: NOW,
			},
			{ cohortOnly: false },
		);
		expect(adminAnalyticsEngagementResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.returning).toMatchObject({ d1Pct: 50, d3Pct: 25 });
		expect(response.activity.avgActionsPerUser).toBe(3);
	});

	it("assembles a contract-valid features response from a 30-day snapshot", async () => {
		const { repository, service } = setup();

		const response = await service.getFeatures({
			range: "30d",
			cohortOnly: false,
		});

		expect(repository.getFeatures).toHaveBeenCalledWith({
			rangeStart: new Date("2026-07-15T00:00:00.000Z"),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
		expect(adminAnalyticsFeaturesResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.activeUsersInRange).toBe(5);
		expect(response.features.slice(0, 2)).toEqual([
			{
				key: "websites",
				users: 3,
				pctOfActiveUsers: 60,
				uses: 6,
				avgUsesPerUser: 2,
				usersToPaidPct: 66.7,
				convertedAfterUsePct: 33.3,
			},
			{
				key: "landingPages",
				users: 1,
				pctOfActiveUsers: 20,
				uses: 2,
				avgUsesPerUser: 2,
				usersToPaidPct: 0,
				convertedAfterUsePct: 0,
			},
		]);
		expect(response.freeCredits).toEqual({
			avgDaysToConsume: 2,
			medianDaysToConsume: 1,
			measuredUsers: 3,
		});
		expect(
			response.conversionByCredits.find(({ bucket }) => bucket === "10-24"),
		).toEqual({
			bucket: "10-24",
			owners: 3,
			paidOwners: 2,
			paidPct: 66.7,
		});
	});

	it("assembles a contract-valid health response from a 90-day snapshot", async () => {
		const { repository, service } = setup();

		const response = await service.getHealth({
			range: "90d",
			cohortOnly: false,
		});

		expect(repository.getHealth).toHaveBeenCalledWith({
			rangeStart: new Date("2026-05-16T00:00:00.000Z"),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
		expect(adminAnalyticsHealthResponseSchema.parse(response)).toEqual(
			response,
		);
		expect(response.updatedAt).toBe(NOW.toISOString());
		expect(response.creditsRefundedInRange).toBe(10);
	});

	it("forwards attribution filters only where supported and keeps cohortOnly engagement-only", async () => {
		const { repository, service } = setup();
		const query = {
			range: "7d" as const,
			source: "newsletter",
			country: "DZ",
			device: "mobile" as const,
			cohortOnly: true,
		};
		const bounds = {
			rangeStart: new Date("2026-08-07T00:00:00.000Z"),
			rangeEnd: NOW,
			seriesEnd: new Date("2026-08-13T00:00:00.000Z"),
			snapshotEnd: NOW,
		};
		const attributionFilters = {
			source: "newsletter",
			country: "DZ",
			device: "mobile",
		};

		await service.getAcquisition(query);
		await service.getFunnel(query);
		await service.getEngagement(query);
		await service.getRevenue(query);
		await service.getFeatures(query);
		await service.getHealth(query);

		expect(repository.getAcquisition).toHaveBeenCalledWith(
			bounds,
			attributionFilters,
		);
		expect(repository.getFunnel).toHaveBeenCalledWith(
			bounds,
			attributionFilters,
		);
		expect(repository.getEngagement).toHaveBeenCalledWith(bounds, {
			...attributionFilters,
			cohortOnly: true,
		});
		expect(repository.getRevenue.mock.calls[0]).toEqual([bounds]);
		expect(repository.getFeatures.mock.calls[0]).toEqual([bounds]);
		expect(repository.getHealth.mock.calls[0]).toEqual([bounds]);
	});

	it("forwards historical custom bounds without changing snapshot-time values", async () => {
		const { repository, service } = setup();

		await service.getRevenue({
			range: "custom",
			from: "2026-06-01",
			to: "2026-06-03",
			cohortOnly: false,
		});

		expect(repository.getRevenue).toHaveBeenCalledWith({
			rangeStart: new Date("2026-06-01T00:00:00.000Z"),
			rangeEnd: new Date("2026-06-04T00:00:00.000Z"),
			seriesEnd: new Date("2026-06-03T00:00:00.000Z"),
			snapshotEnd: NOW,
		});
	});
});

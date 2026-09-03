import { adminAnalyticsRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiGetRaw, apiPost } from "@/lib/api-client";

import {
	downloadFunnelStepUsersCsv,
	getAdminAnalyticsAcquisition,
	getAdminAnalyticsEngagement,
	getAdminAnalyticsFeatures,
	getAdminAnalyticsFunnel,
	getAdminAnalyticsFunnelStepUsers,
	getAdminAnalyticsRevenue,
	setAdminFunnelContact,
} from "./analytics.services";

vi.mock("@/lib/api-client", () => ({
	apiGet: vi.fn(),
	apiGetRaw: vi.fn(),
	apiPost: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);
const apiGetRawMock = vi.mocked(apiGetRaw);
const apiPostMock = vi.mocked(apiPost);
const updatedAt = "2026-08-15T12:00:00.000Z";

const funnelStepUsersResponse = {
	updatedAt,
	step: "pricingViewed" as const,
	page: 2,
	pageSize: 40,
	total: 1,
	counts: {
		all: 7,
		contacted: 3,
		converted: 2,
	},
	items: [
		{
			id: "user-1",
			name: "Nadia Founder",
			email: "nadia@example.com",
			image: null,
			signedUpAt: "2026-08-01T08:00:00.000Z",
			firstEventAt: "2026-08-02T09:00:00.000Z",
			lastEventAt: "2026-08-03T10:00:00.000Z",
			eventCount: 2,
			converted: true,
			contact: {
				contactedAt: "2026-08-15T11:00:00.000Z",
				contactedBy: { id: "admin-1", name: "Admin User" },
			},
		},
	],
};

function mockCsvDownload(contentDisposition: string | null) {
	const anchor = {
		href: "",
		download: "",
		hidden: false,
		click: vi.fn(),
		remove: vi.fn(),
	};
	const append = vi.fn();
	const createObjectURL = vi.fn(() => "blob:funnel-users");
	const revokeObjectURL = vi.fn();
	const headers = new Headers();

	if (contentDisposition !== null) {
		headers.set("Content-Disposition", contentDisposition);
	}

	vi.stubGlobal("document", {
		createElement: vi.fn(() => anchor),
		body: { append },
	});
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
	apiGetRawMock.mockResolvedValueOnce(
		new Response("name,email\nNadia,nadia@example.com", { headers }),
	);

	return { anchor, append, createObjectURL, revokeObjectURL };
}

afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("admin analytics services", () => {
	it("builds funnel-user and contact routes, canonicalizes requests, and parses responses", async () => {
		apiGetMock.mockResolvedValueOnce(funnelStepUsersResponse);
		apiPostMock.mockResolvedValueOnce({
			userId: "user-1",
			contact: funnelStepUsersResponse.items[0]?.contact,
		});

		await expect(
			getAdminAnalyticsFunnelStepUsers("pricingViewed", {
				range: "custom",
				from: "2026-08-01",
				to: "2026-08-15",
				source: " newsletter ",
				country: "dz",
				device: "mobile",
				cohortOnly: true,
				page: 2,
				pageSize: 40,
				contacted: "contacted",
			}),
		).resolves.toEqual(funnelStepUsersResponse);

		expect(apiGetMock).toHaveBeenCalledWith(
			adminAnalyticsRoutes.funnelStepUsers("pricingViewed"),
			{
				range: "custom",
				from: "2026-08-01",
				to: "2026-08-15",
				source: "newsletter",
				country: "DZ",
				device: "mobile",
				cohortOnly: true,
				page: 2,
				pageSize: 40,
				contacted: "contacted",
			},
		);

		await expect(
			setAdminFunnelContact({ userId: "user-1", contacted: true }),
		).resolves.toMatchObject({
			userId: "user-1",
			contact: { contactedBy: { name: "Admin User" } },
		});
		expect(apiPostMock).toHaveBeenCalledWith(
			adminAnalyticsRoutes.funnelContact("user-1"),
			{ contacted: true },
		);
	});

	it("applies the funnel-user list defaults at the service boundary", async () => {
		apiGetMock.mockResolvedValueOnce({
			...funnelStepUsersResponse,
			page: 1,
			pageSize: 20,
		});

		await getAdminAnalyticsFunnelStepUsers("pricingViewed", {
			range: "7d",
			cohortOnly: false,
		});

		expect(apiGetMock).toHaveBeenCalledWith(
			adminAnalyticsRoutes.funnelStepUsers("pricingViewed"),
			{
				range: "7d",
				cohortOnly: false,
				page: 1,
				pageSize: 20,
				contacted: "all",
			},
		);
	});

	it("sends only export filters and downloads the server filename", async () => {
		const { anchor, append, createObjectURL, revokeObjectURL } =
			mockCsvDownload(
				'attachment; filename="funnel-checkout-started-users-not-contacted-2026-08-15.csv"',
			);
		const query = {
			range: "30d" as const,
			source: " referral ",
			country: "fr",
			cohortOnly: false,
			page: 3,
			pageSize: 50,
			contacted: "notContacted" as const,
		};

		await expect(
			downloadFunnelStepUsersCsv("checkoutStarted", query),
		).resolves.toBe(
			"funnel-checkout-started-users-not-contacted-2026-08-15.csv",
		);

		expect(apiGetRawMock).toHaveBeenCalledWith(
			adminAnalyticsRoutes.funnelStepUsersExport("checkoutStarted"),
			{
				range: "30d",
				source: "referral",
				country: "FR",
				cohortOnly: false,
				contacted: "notContacted",
			},
			"text/csv",
		);
		expect(anchor.download).toBe(
			"funnel-checkout-started-users-not-contacted-2026-08-15.csv",
		);
		expect(anchor.click).toHaveBeenCalledOnce();
		expect(anchor.remove).toHaveBeenCalledOnce();
		expect(append).toHaveBeenCalledWith(anchor);
		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:funnel-users");
	});

	it.each([
		[
			"missing",
			null,
			"notContacted",
			"funnel-upgrade-clicked-users-not-contacted-2026-08-22.csv",
		],
		[
			"malformed",
			"attachment; filename=",
			"all",
			"funnel-upgrade-clicked-users-2026-08-22.csv",
		],
	] as const)("uses the local-date filename fallback when Content-Disposition is %s", async (_case, contentDisposition, contacted, expectedFileName) => {
		vi.stubEnv("TZ", "Africa/Algiers");
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-21T23:30:00.000Z"));
		const { anchor } = mockCsvDownload(contentDisposition);

		await expect(
			downloadFunnelStepUsersCsv("upgradeClicked", {
				range: "7d",
				cohortOnly: false,
				contacted,
			}),
		).resolves.toBe(expectedFileName);
		expect(anchor.download).toBe(expectedFileName);
	});

	it("rejects malformed funnel-user and contact responses", async () => {
		apiGetMock.mockResolvedValueOnce({
			...funnelStepUsersResponse,
			items: [{ ...funnelStepUsersResponse.items[0], eventCount: 0 }],
		});
		apiPostMock.mockResolvedValueOnce({ userId: "user-1", contact: {} });

		await expect(
			getAdminAnalyticsFunnelStepUsers("pricingViewed", {
				range: "7d",
				cohortOnly: false,
			}),
		).rejects.toThrow();
		await expect(
			setAdminFunnelContact({ userId: "user-1", contacted: true }),
		).rejects.toThrow();
	});

	it("parses new fields and forwards canonical analytics filters", async () => {
		apiGetMock
			.mockResolvedValueOnce({
				updatedAt,
				adSpendCents: null,
				cacCents: null,
				costCoverageComplete: true,
				sources: [
					{
						source: "direct",
						signups: 12,
						activated: 7,
						paid: 3,
						signupToPaidPct: 25,
						mrrCents: 8_700,
						adSpendCents: null,
						cacCents: null,
					},
				],
				campaigns: [],
				countries: [],
				unattributed: { signups: 2 },
			})
			.mockResolvedValueOnce({
				updatedAt,
				steps: [
					{ key: "visitor", count: 42, pctOfPrevious: null },
					{ key: "upgradeClicked", count: 5, pctOfPrevious: 62.5 },
				],
				durations: {
					signupToFirstAction: {
						medianHours: 3.2,
						avgHours: 5.1,
						users: 18,
					},
					signupToFirstGeneration: {
						medianHours: null,
						avgHours: null,
						users: 0,
					},
				},
			})
			.mockResolvedValueOnce({
				updatedAt,
				activity: {
					dau: 4,
					wau: 11,
					mau: 20,
					dauMauPct: 20,
					avgActiveDaysPerUser: 2.4,
					avgActionsPerUser: 7.5,
					activeFreeTrialUsers: 5,
				},
				activityByDay: [{ date: "2026-08-15", activeUsers: 4 }],
				returning: {
					d1Pct: 32,
					d3Pct: 24,
					d7Pct: 18,
					d14Pct: 11,
					d30Pct: 7,
				},
				cohorts: [],
				healthyTrialsByDay: [{ date: "2026-08-15", count: 1 }],
			});

		await expect(
			getAdminAnalyticsAcquisition({
				range: "30d",
				source: " newsletter ",
				country: "dz",
				device: "mobile",
				cohortOnly: false,
			}),
		).resolves.toMatchObject({
			adSpendCents: null,
			cacCents: null,
			costCoverageComplete: true,
			unattributed: { signups: 2 },
		});
		await expect(
			getAdminAnalyticsFunnel({ range: "30d", cohortOnly: false }),
		).resolves.toMatchObject({
			steps: [
				{ key: "visitor", count: 42 },
				{ key: "upgradeClicked", count: 5, pctOfPrevious: 62.5 },
			],
			durations: {
				signupToFirstAction: { medianHours: 3.2, users: 18 },
			},
		});
		await expect(
			getAdminAnalyticsEngagement({ range: "30d", cohortOnly: true }),
		).resolves.toMatchObject({
			activity: { dau: 4, mau: 20, avgActionsPerUser: 7.5 },
		});

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			adminAnalyticsRoutes.acquisition,
			{
				range: "30d",
				source: "newsletter",
				country: "DZ",
				device: "mobile",
				cohortOnly: false,
			},
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(2, adminAnalyticsRoutes.funnel, {
			range: "30d",
			cohortOnly: false,
		});
		expect(apiGetMock).toHaveBeenNthCalledWith(
			3,
			adminAnalyticsRoutes.engagement,
			{ range: "30d", cohortOnly: true },
		);
	});

	it("parses Phase 3 ads, churn-reason, and unit-economics fields", async () => {
		apiGetMock
			.mockResolvedValueOnce({
				updatedAt,
				activeUsersInRange: 8,
				features: [
					{
						key: "websites",
						users: 4,
						pctOfActiveUsers: 50,
						uses: 7,
						avgUsesPerUser: 1.75,
						usersToPaidPct: 25,
						convertedAfterUsePct: 12.5,
					},
				],
				ads: {
					analysis: { events: 12, users: 5, errorRatePct: 7.5 },
					launch: { events: 4, users: 2, errorRatePct: null },
					connectedUsers: 9,
					totalUsers: 40,
					connectedPct: 22.5,
				},
				// Credit amounts are decimal credits at the API boundary (v4).
				credits: {
					grantedInRange: 100.5,
					consumedInRange: 64.37,
					avgConsumedPerFreeUser: 8.04,
					avgConsumedPerPaidUser: 16.5,
					consumptionBuckets: [{ bucket: "3-4", users: 3 }],
					usersAtZeroBalance: 2,
					avgCreditsBeforeUpgrade: 22.75,
					providerCostPerCreditMicros: 410,
					totalProviderCostMicros: 205_000,
					billableProviderCostMicros: 180_000,
					providerCostByProvenanceMicros: {
						measured: 150_000,
						contract: 40_000,
						estimate: 15_000,
					},
				},
				freeCredits: {
					avgDaysToConsume: 8.4,
					medianDaysToConsume: 6.2,
					measuredUsers: 5,
				},
				conversionByCredits: [
					{
						bucket: "3-4",
						owners: 7,
						paidOwners: 2,
						paidPct: 28.6,
					},
				],
			})
			.mockResolvedValueOnce({
				updatedAt,
				tiles: {
					mrrMinor: 12_000,
					arpuMinor: 4_000,
					activePaidUsers: 3,
					newPaidUsersInRange: 1,
					trialToPaidPctAllTime: 18,
					healthyTrials: {
						count: 2,
						pctOfTrials: 20,
						healthyToPaidPct: 40,
						nonHealthyToPaidPct: 8,
					},
				},
				mrrByPlan: [],
				collectedRevenueByDay: [],
				newPaidByDay: [],
				daysToConvert: [],
				checkoutFunnel: {
					started: 3,
					completed: 2,
					completionPct: 66.7,
				},
				churn: {
					customerChurnPct: 5,
					mrrChurnPct: 4,
					churnedMrrCents: 900,
					netNewMrrCents: 2_100,
					upgrades: 1,
					downgrades: 0,
					ltvCents: 80_000,
				},
				netRevenue: {
					grossCents: 14_000,
					refundsCents: 500,
					netCents: 13_500,
					failedPayments: 1,
					failedPaymentsCents: 1_000,
				},
				revenueBySource: {
					subscriptionsCents: 12_501,
					topupsCents: 2_500,
					domainsCents: 1_499,
					domainOrders: 1,
					domainCostCents: 1_299,
					domainMarginCents: 200,
					domainMarginPct: 13.3,
					domainCostUnknownOrders: 0,
				},
				arpuByPlan: [],
				retention: {
					cohorts: [
						{
							cohortMonth: "2026-07-01",
							owners: 6,
							m0MrrCents: 18_000,
							points: [
								{ paidPct: 100, revenuePct: 100 },
								{ paidPct: 83.3, revenuePct: 92.4 },
							],
						},
					],
				},
				churnBreakdown: {
					byPlan: [{ plan: "pro", churned: 2, churnedMrrCents: 6_000 }],
					bySource: [{ source: "referral", churned: 1 }],
					byReason: [
						{ reason: "too_expensive", churned: 1 },
						{ reason: "unknown", churned: 1 },
					],
					byCountry: [{ country: "DZ", churned: 1 }],
					byFeature: [{ feature: "websites", churned: 2 }],
				},
				unitEconomics: {
					adSpendCents: 3_000,
					infrastructureCostCents: 2_000,
					otherCostCents: 500,
					totalCostCents: 5_500,
					cacCents: 1_500,
					ltvCacRatio: 53.33,
					grossMarginPct: 85.19,
					cacPaybackMonths: 0.4,
					costPerFreeActiveUserCents: 688,
					costPerHealthyTrialCents: 2_750,
					costPerActivePaidUserCents: 1_833,
					costCoverageComplete: true,
				},
				// Fixed order: starter, pro, business, free. Free never collects revenue.
				marginAfterAi: [
					{
						plan: "starter",
						revenueCents: 800,
						aiCostCents: 200,
						marginCents: 600,
						marginPct: 75,
					},
					{
						plan: "pro",
						revenueCents: 9_900,
						aiCostCents: 3_150,
						marginCents: 6_750,
						marginPct: 68.2,
					},
					{
						plan: "business",
						revenueCents: 2_601,
						aiCostCents: 4_100,
						marginCents: -1_499,
						marginPct: -57.6,
					},
					{
						plan: "free",
						revenueCents: 0,
						aiCostCents: 1_875,
						marginCents: -1_875,
						marginPct: null,
					},
				],
			});

		await expect(
			getAdminAnalyticsFeatures({ range: "30d", cohortOnly: false }),
		).resolves.toMatchObject({
			ads: {
				analysis: { events: 12, users: 5, errorRatePct: 7.5 },
				connectedPct: 22.5,
			},
			credits: { grantedInRange: 100.5, consumedInRange: 64.37 },
			freeCredits: { medianDaysToConsume: 6.2, measuredUsers: 5 },
			conversionByCredits: [{ bucket: "3-4", paidPct: 28.6 }],
			features: [{ key: "websites", convertedAfterUsePct: 12.5 }],
		});
		await expect(
			getAdminAnalyticsRevenue({ range: "30d", cohortOnly: false }),
		).resolves.toMatchObject({
			retention: {
				cohorts: [
					{
						cohortMonth: "2026-07-01",
						points: [
							{ paidPct: 100, revenuePct: 100 },
							{ paidPct: 83.3, revenuePct: 92.4 },
						],
					},
				],
			},
			churnBreakdown: {
				byPlan: [{ plan: "pro", churnedMrrCents: 6_000 }],
				byReason: [
					{ reason: "too_expensive", churned: 1 },
					{ reason: "unknown", churned: 1 },
				],
				byFeature: [{ feature: "websites", churned: 2 }],
			},
			unitEconomics: {
				totalCostCents: 5_500,
				ltvCacRatio: 53.33,
				costCoverageComplete: true,
			},
			marginAfterAi: [
				{ plan: "starter", marginCents: 600, marginPct: 75 },
				{ plan: "pro", marginCents: 6_750, marginPct: 68.2 },
				{ plan: "business", marginCents: -1_499, marginPct: -57.6 },
				{ plan: "free", revenueCents: 0, marginCents: -1_875, marginPct: null },
			],
		});
	});

	it("rejects malformed analytics responses at the service boundary", async () => {
		apiGetMock.mockResolvedValueOnce({
			updatedAt,
			sources: [{ source: "direct", signups: -1 }],
			campaigns: [],
			countries: [],
			unattributed: { signups: 0 },
		});

		await expect(
			getAdminAnalyticsAcquisition({ range: "7d", cohortOnly: false }),
		).rejects.toThrow();
	});
});

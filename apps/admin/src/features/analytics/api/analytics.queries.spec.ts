import { describe, expect, it } from "vitest";

import type {
	AnalyticsFunnelStepUsersQueryInput,
	AnalyticsQuery,
} from "./analytics.dto";
import { adminAnalyticsKeys } from "./analytics.queries";

describe("admin analytics query keys", () => {
	it("builds stable endpoint keys with empty filter dimensions", () => {
		const query: AnalyticsQuery = { range: "30d", cohortOnly: false };
		const dimensions = ["30d", null, null, null, null, null, false];

		expect(adminAnalyticsKeys.acquisition(query)).toEqual([
			"admin-analytics",
			"acquisition",
			...dimensions,
		]);
		expect(adminAnalyticsKeys.funnel(query)).toEqual([
			"admin-analytics",
			"funnel",
			...dimensions,
		]);
		expect(adminAnalyticsKeys.funnelStepUsersAll()).toEqual([
			"admin-analytics",
			"funnel-step-users",
		]);
		expect(adminAnalyticsKeys.funnelStepUsers("pricingViewed", query)).toEqual([
			"admin-analytics",
			"funnel-step-users",
			"pricingViewed",
			...dimensions,
			1,
			20,
			"all",
		]);
		expect(adminAnalyticsKeys.engagement(query)).toEqual([
			"admin-analytics",
			"engagement",
			...dimensions,
		]);
		expect(adminAnalyticsKeys.revenue(query)).toEqual([
			"admin-analytics",
			"revenue",
			...dimensions,
		]);
		expect(adminAnalyticsKeys.features(query)).toEqual([
			"admin-analytics",
			"features",
			...dimensions,
		]);
		expect(adminAnalyticsKeys.health(query)).toEqual([
			"admin-analytics",
			"health",
			...dimensions,
		]);
	});

	it("keeps custom bounds and filters in a stable order", () => {
		const query: AnalyticsQuery = {
			range: "custom",
			from: "2026-08-01",
			to: "2026-08-15",
			source: "newsletter",
			country: "DZ",
			device: "mobile",
			cohortOnly: true,
		};

		expect(adminAnalyticsKeys.engagement(query)).toEqual([
			"admin-analytics",
			"engagement",
			"custom",
			"2026-08-01",
			"2026-08-15",
			"newsletter",
			"DZ",
			"mobile",
			true,
		]);
		expect(
			adminAnalyticsKeys.funnelStepUsers("checkoutStarted", query),
		).toEqual([
			"admin-analytics",
			"funnel-step-users",
			"checkoutStarted",
			"custom",
			"2026-08-01",
			"2026-08-15",
			"newsletter",
			"DZ",
			"mobile",
			true,
			1,
			20,
			"all",
		]);
	});

	it("canonicalizes funnel-user dimensions before building the key", () => {
		const implicitDefaults: AnalyticsFunnelStepUsersQueryInput = {
			range: "30d",
			source: " newsletter ",
			country: "dz",
			cohortOnly: false,
		};
		const explicitDefaults: AnalyticsFunnelStepUsersQueryInput = {
			range: "30d",
			source: "newsletter",
			country: "DZ",
			cohortOnly: false,
			page: 1,
			pageSize: 20,
			contacted: "all",
		};

		expect(
			adminAnalyticsKeys.funnelStepUsers("pricingViewed", implicitDefaults),
		).toEqual(
			adminAnalyticsKeys.funnelStepUsers("pricingViewed", explicitDefaults),
		);
	});

	it.each([
		["page", { page: 2 }],
		["page size", { pageSize: 50 }],
		["contacted filter", { contacted: "contacted" as const }],
	] as const)("changes the funnel-user key when the %s changes", (_name, change) => {
		const base: AnalyticsFunnelStepUsersQueryInput = {
			range: "90d",
			cohortOnly: false,
		};
		const changed: AnalyticsFunnelStepUsersQueryInput = { ...base, ...change };

		expect(
			adminAnalyticsKeys.funnelStepUsers("upgradeClicked", changed),
		).not.toEqual(adminAnalyticsKeys.funnelStepUsers("upgradeClicked", base));
	});

	it.each([
		["source", { source: "referral" }],
		["country", { country: "FR" }],
		["device", { device: "tablet" }],
		["cohort", { cohortOnly: true }],
	] as const)("changes the key when the %s filter changes", (_name, change) => {
		const base: AnalyticsQuery = { range: "90d", cohortOnly: false };
		const changed = { ...base, ...change } as AnalyticsQuery;

		expect(adminAnalyticsKeys.acquisition(changed)).not.toEqual(
			adminAnalyticsKeys.acquisition(base),
		);
	});
});

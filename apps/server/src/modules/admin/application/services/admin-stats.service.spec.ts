import { adminOverviewSnapshotSchema } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../../../infrastructure/database/database.constants";
import type { AdminRepository } from "../../infrastructure/persistence/admin.repository";
import {
	AdminOverviewRepository,
	type AdminOverviewRepositorySnapshot,
} from "../../infrastructure/persistence/admin-overview.repository";
import { AdminStatsService } from "./admin-stats.service";

const NOW = new Date("2026-08-07T12:34:56.000Z");

const RANGE_CASES = [
	["7d", 7, "Last 7 days"],
	["30d", 30, "Last 30 days"],
	["90d", 90, "Last 90 days"],
] as const;

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { sql: string };
};

function compileQuery(query: unknown): string {
	if (
		typeof query !== "object" ||
		query === null ||
		!("toQuery" in query) ||
		typeof query.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL query");
	}

	const { sql } = (query as SqlQuery).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return sql.replaceAll(/\s+/g, " ").trim();
}

async function compileOverviewQueries(): Promise<string[]> {
	const execute = vi.fn().mockResolvedValue({ rows: [] });
	const transaction = vi.fn(
		(callback: (client: { execute: typeof execute }) => Promise<unknown>) =>
			callback({ execute }),
	);
	const repository = new AdminOverviewRepository({
		transaction,
	} as unknown as Database);

	await repository.getOverview({
		days: 7,
		dzdPerUsd: 135.42,
		generatedAt: NOW,
	});

	return execute.mock.calls.map(([query]) => compileQuery(query));
}

const OVERVIEW_SNAPSHOT = {
	periodStart: "2026-08-01",
	periodEnd: "2026-08-07",
	revenue: {
		totalReportingUsdMinor: 14_800,
		changePercent: 12.5,
		stripe: {
			nativeTotalMinor: 10_000,
			reportingUsdTotalMinor: 10_000,
			changePercent: 10,
		},
		chargily: {
			nativeTotalMinor: 650_000,
			reportingUsdTotalMinor: 4_800,
			changePercent: 18.25,
		},
	},
	totals: {
		tokensUsed: 12_345,
		tokensChangePercent: 9.5,
		tokenCostUsdMinor: 321,
		websitesGenerated: 8,
		websitesChangePercent: -2.5,
		assetsGenerated: 13,
		imagesGenerated: 11,
		imagesChangePercent: 4.25,
		totalUsers: 100,
		signups: 7,
		signupsChangePercent: 16.7,
		activeUsers: 42,
		activationPercent: 42,
	},
	generation: {
		attempts: 10,
		successful: 8,
		failed: 2,
		successRatePercent: 80,
		successRateChangePoints: 5,
		averageLatencyMs: 42_400,
		latencyChangePercent: -8.5,
	},
	revenueSeries: [
		{
			date: "2026-08-05",
			stripeUsdMinor: 2_500,
			chargilyUsdEquivalentMinor: 1_200,
			totalUsdEquivalentMinor: 3_700,
		},
	],
	growthSeries: [
		{
			date: "2026-08-06",
			signups: 3,
			websitesGenerated: 4,
		},
	],
	generationSeries: [
		{
			date: "2026-08-07",
			successful: 5,
			failed: 1,
		},
	],
	modelUsage: [
		{
			modelId: "anthropic/claude-sonnet-5",
			rawModel: "anthropic/claude-sonnet-5",
			provider: "anthropic",
			tokensUsed: 10_000,
			usageSharePercent: 81,
			costUsdMinor: 280,
		},
		{
			modelId: "labs/custom_model-v2",
			rawModel: "labs/custom_model-v2",
			provider: "openrouter",
			tokensUsed: 2_345,
			usageSharePercent: 19,
			costUsdMinor: 41,
		},
	],
	recentSignals: [
		{
			id: "payment-1",
			kind: "payment",
			occurredAt: "2026-08-07T12:30:00.000Z",
			userName: "Ada Lovelace",
			projectName: null,
			leadName: null,
			provider: "chargily",
			amountMinor: 650_000,
			currency: "dzd",
			durationMs: null,
		},
		{
			id: "generation-success-1",
			kind: "page_generation_succeeded",
			occurredAt: "2026-08-07T12:20:00.000Z",
			userName: "Grace Hopper",
			projectName: "Portfolio launch",
			leadName: null,
			provider: null,
			amountMinor: null,
			currency: null,
			durationMs: 42_400,
		},
		{
			id: "generation-failed-1",
			kind: "page_generation_failed",
			occurredAt: "2026-08-07T12:10:00.000Z",
			userName: "Linus Torvalds",
			projectName: null,
			leadName: null,
			provider: null,
			amountMinor: null,
			currency: null,
			durationMs: null,
		},
		{
			id: "lead-1",
			kind: "lead",
			occurredAt: "2026-08-07T12:00:00.000Z",
			userName: "Project owner",
			projectName: "Storefront",
			leadName: null,
			provider: null,
			amountMinor: null,
			currency: null,
			durationMs: null,
		},
	],
} satisfies AdminOverviewRepositorySnapshot;

function setup() {
	const adminRepository = {
		countUsers: vi.fn().mockResolvedValue(250),
		getSignupSeries: vi.fn().mockResolvedValue([
			{ date: "2026-08-05", count: 2 },
			{ date: "2026-08-06", count: 0 },
			{ date: "2026-08-07", count: 3 },
		]),
	};
	const adminOverviewRepository = {
		getOverview: vi.fn().mockResolvedValue(OVERVIEW_SNAPSHOT),
	};
	const service = new AdminStatsService(
		adminRepository as unknown as AdminRepository,
		adminOverviewRepository as unknown as AdminOverviewRepository,
	);

	return { adminOverviewRepository, adminRepository, service };
}

describe("AdminStatsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it.each(
		RANGE_CASES,
	)("forwards %s as %i days with the reporting FX rate", async (range, days, rangeLabel) => {
		const { adminOverviewRepository, service } = setup();

		const result = await service.getOverviewStats({ range });

		expect(adminOverviewRepository.getOverview).toHaveBeenCalledWith({
			days,
			dzdPerUsd: 135.42,
			generatedAt: NOW,
		});
		expect(result).toMatchObject({
			range,
			rangeLabel,
			generatedAt: NOW.toISOString(),
			revenue: {
				fx: {
					asOf: "2026-08-07",
					isMock: true,
					quotePerBase: 135.42,
				},
			},
		});
	});

	it("returns a contract-valid snapshot with presentation labels and mapped models and signals", async () => {
		const { service } = setup();

		const result = await service.getOverviewStats({ range: "7d" });

		expect(adminOverviewSnapshotSchema.parse(result)).toEqual(result);
		expect(result.revenueSeries[0]?.label).toBe("Aug 5");
		expect(result.growthSeries[0]?.label).toBe("Aug 6");
		expect(result.generationSeries[0]?.label).toBe("Aug 7");
		expect(result.modelUsage).toEqual([
			{
				modelId: "anthropic/claude-sonnet-5",
				modelName: "Claude Sonnet 5",
				provider: "Anthropic",
				tokensUsed: 10_000,
				usageSharePercent: 81,
				costUsdMinor: 280,
			},
			{
				modelId: "labs/custom_model-v2",
				modelName: "Custom Model V2",
				provider: "OpenRouter",
				tokensUsed: 2_345,
				usageSharePercent: 19,
				costUsdMinor: 41,
			},
		]);
		expect(result.recentSignals).toEqual([
			expect.objectContaining({
				id: "payment-1",
				kind: "payment",
				title: "Chargily payment captured",
			}),
			{
				id: "generation-success-1",
				kind: "page_generation_succeeded",
				title: "Website generated in 42s",
				detail: "Grace Hopper · Portfolio launch",
				occurredAt: "2026-08-07T12:20:00.000Z",
			},
			{
				id: "generation-failed-1",
				kind: "page_generation_failed",
				title: "Website generation failed",
				detail: "Linus Torvalds · Untitled project",
				occurredAt: "2026-08-07T12:10:00.000Z",
			},
			{
				id: "lead-1",
				kind: "lead",
				title: "New lead captured",
				detail: "Unnamed lead · Storefront",
				occurredAt: "2026-08-07T12:00:00.000Z",
			},
		]);
		expect(result.recentSignals[0]?.detail).toContain("Ada Lovelace ·");
		expect(result.recentSignals[0]?.detail).toContain("DZD");
		expect(result.recentSignals[0]?.detail).toContain("6,500");
	});

	it("keeps the existing zero-filled signup aggregation behavior", async () => {
		const { adminOverviewRepository, adminRepository, service } = setup();

		const result = await service.getSignupStats({ range: "30d" });

		expect(adminRepository.getSignupSeries).toHaveBeenCalledWith(30);
		expect(adminRepository.countUsers).toHaveBeenCalledOnce();
		expect(adminOverviewRepository.getOverview).not.toHaveBeenCalled();
		expect(result).toEqual({
			range: "30d",
			total: 5,
			totalUsers: 250,
			points: [
				{ date: "2026-08-05", count: 2 },
				{ date: "2026-08-06", count: 0 },
				{ date: "2026-08-07", count: 3 },
			],
		});
	});
});

describe("AdminOverviewRepository overview SQL", () => {
	it("prefers the settled pricing snapshot cost over the reservation estimate", async () => {
		const queries = await compileOverviewQueries();
		const usageQueries = queries.filter(
			(query) =>
				query.includes("from ai_usage_events e") &&
				(query.includes("usage_totals as") || query.includes("grouped as")),
		);

		expect(usageQueries).toHaveLength(2);
		for (const query of usageQueries) {
			const reconciledCost = query.indexOf("e.reconciled_cost_usd_micros");
			const settledCost = query.indexOf(
				"e.pricing_snapshot ->> 'costUsdMicros'",
			);
			const estimatedCost = query.indexOf("e.estimated_cost_usd_micros");

			expect(reconciledCost).toBeGreaterThanOrEqual(0);
			expect(settledCost).toBeGreaterThan(reconciledCost);
			expect(estimatedCost).toBeGreaterThan(settledCost);
			expect(query).toMatch(
				/jsonb_typeof\(\s*e\.pricing_snapshot -> 'costUsdMicros'\s*\) = 'number'/,
			);
		}
	});

	it("includes paid fulfilling orders and excludes non-collected terminal states", async () => {
		const queries = await compileOverviewQueries();
		const revenueQuery =
			queries.find((query) => query.includes("eligible_orders as")) ?? "";
		const signalsQuery =
			queries.find((query) => query.includes("signals.occurred_at")) ?? "";

		for (const query of [revenueQuery, signalsQuery]) {
			expect(query).toContain(
				"o.status not in ('failed', 'canceled', 'refunded')",
			);
			expect(query).not.toContain("o.status in ('paid', 'fulfilled')");
		}
		expect(signalsQuery).toContain("o.paid_at is not null");
	});

	it("bounds each recent-signal source before merging the final five rows", async () => {
		const queries = await compileOverviewQueries();
		const signalsQuery =
			queries.find((query) => query.includes("signals.occurred_at")) ?? "";

		expect(signalsQuery.match(/limit 5/g)).toHaveLength(4);
		expect(signalsQuery).toContain(
			"o.paid_at < $1 order by o.paid_at desc, ('payment:' || o.id::text) desc limit 5",
		);
		expect(signalsQuery).toContain(
			"p.completed_at < $2 order by p.completed_at desc, ('page:' || p.id::text) desc limit 5",
		);
		expect(signalsQuery).toContain(
			"l.created_at < $3 order by l.created_at desc, ('lead:' || l.id::text) desc limit 5",
		);
		expect(signalsQuery).toContain(
			"order by signals.occurred_at desc, signals.id desc limit 5",
		);
	});
});

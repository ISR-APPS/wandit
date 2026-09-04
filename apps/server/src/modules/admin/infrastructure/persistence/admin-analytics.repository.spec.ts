import type { AdminAnalyticsFunnelUserStep } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	HEALTHY_TRIAL_MIN_CENTI_CREDITS,
	HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS,
	LIVE_SUBSCRIPTION_STATUSES,
} from "../../application/services/admin-analytics.metrics";
import {
	type AdminAnalyticsFilters,
	type AdminAnalyticsFunnelStepUsersRepositoryOptions,
	AdminAnalyticsRepository,
	type FunnelStepUserRow,
} from "./admin-analytics.repository";
import { AI_SPEND_STATUSES } from "./ai-usage-cost.sql";

const NOW = new Date("2026-08-13T10:20:30.000Z");
const RANGE_BOUNDS = {
	rangeStart: new Date("2026-06-01T00:00:00.000Z"),
	rangeEnd: new Date("2026-06-04T00:00:00.000Z"),
	seriesEnd: new Date("2026-06-03T00:00:00.000Z"),
	snapshotEnd: NOW,
};

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

type CompiledQuery = {
	params: unknown[];
	sql: string;
};

type Endpoint =
	| "acquisition"
	| "engagement"
	| "features"
	| "funnel"
	| "health"
	| "revenue";

// Consumption amounts are net of the refund grants that reverse reserves
// ('settle-refund:%' / 'reconcile-refund:%' / 'refund:%' idempotency keys).
function refundGrantSql(alias: string) {
	return `(${alias}.kind = 'grant' and (${alias}.idempotency_key like 'settle-refund:%' or ${alias}.idempotency_key like 'reconcile-refund:%' or ${alias}.idempotency_key like 'refund:%'))`;
}

function netConsumptionSql(alias: string) {
	return `(${alias}.kind = 'consume' or ${refundGrantSql(alias)})`;
}

// Refund grants are attributed to their consume's day via the usage event.
function effectiveAtSql(alias: string) {
	return `(case when ${refundGrantSql(alias)} then coalesce( (select e.created_at from ai_usage_events e where e.id = (case when (${alias}.meta ->> 'usageEventId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (${alias}.meta ->> 'usageEventId')::uuid end)), ${alias}.created_at ) else ${alias}.created_at end)`;
}

function compileQuery(query: unknown): CompiledQuery {
	if (
		typeof query !== "object" ||
		query === null ||
		!("toQuery" in query) ||
		typeof query.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL query");
	}

	const { params, sql } = (query as SqlQuery).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function setup(rows: unknown[] = []) {
	// A stable result exercises every SQL construction path without a database
	// dependency.
	const execute = vi.fn(async (_query: unknown) => ({ rows }));
	const snapshot = databaseWithSnapshotTransactions(execute);
	const repository = new AdminAnalyticsRepository(snapshot.database);

	return { execute, repository, ...snapshot };
}

function databaseWithSnapshotTransactions(
	execute: (query: unknown) => Promise<{ rows: unknown[] }>,
) {
	const controlQueries: CompiledQuery[] = [];
	const transactionExecute = vi.fn(async (query: unknown) => {
		const compiled = compileQuery(query);
		if (compiled.sql === "select pg_export_snapshot() as snapshot_id") {
			controlQueries.push(compiled);
			return { rows: [{ snapshot_id: "00000003-0000001B-1" }] };
		}
		if (compiled.sql.startsWith("set transaction snapshot")) {
			controlQueries.push(compiled);
			return { rows: [] };
		}
		return execute(query);
	});
	const transaction = vi.fn(
		(
			callback: (client: {
				execute: typeof transactionExecute;
			}) => Promise<unknown>,
			_options: unknown,
		) => callback({ execute: transactionExecute }),
	);
	const database = {
		execute,
		transaction,
	} as unknown as Database;

	return { controlQueries, database, transaction, transactionExecute };
}

async function collectQueries(
	endpoint: Endpoint,
	filters: AdminAnalyticsFilters = {},
) {
	const { controlQueries, execute, repository, transaction } = setup();

	if (endpoint === "revenue") await repository.getRevenue(RANGE_BOUNDS);
	if (endpoint === "acquisition") {
		await repository.getAcquisition(RANGE_BOUNDS, filters);
	}
	if (endpoint === "funnel") {
		await repository.getFunnel(RANGE_BOUNDS, filters);
	}
	if (endpoint === "engagement") {
		await repository.getEngagement(RANGE_BOUNDS, filters);
	}
	if (endpoint === "features") await repository.getFeatures(RANGE_BOUNDS);
	if (endpoint === "health") await repository.getHealth(RANGE_BOUNDS);

	return {
		controlQueries,
		queries: execute.mock.calls.map(([query]) => compileQuery(query)),
		transaction,
	};
}

async function collectFunnelStepUserQueries(
	step: AdminAnalyticsFunnelUserStep,
	filters: AdminAnalyticsFilters = {},
	options: AdminAnalyticsFunnelStepUsersRepositoryOptions = {
		contacted: "all",
		pagination: { page: 1, pageSize: 20 },
	},
) {
	const { controlQueries, execute, repository, transaction } = setup();

	await repository.getFunnelStepUsers(RANGE_BOUNDS, step, filters, options);

	return {
		controlQueries,
		queries: execute.mock.calls.map(([query]) => compileQuery(query)),
		transaction,
	};
}

function queryContaining(
	queries: readonly CompiledQuery[],
	marker: string,
): CompiledQuery {
	const matches = queries.filter(({ sql }) => sql.includes(marker));
	expect(matches, `query containing ${marker}`).toHaveLength(1);

	const match = matches[0];
	if (!match) throw new Error(`Missing query containing ${marker}`);

	return match;
}

function expectRange(
	query: CompiledQuery,
	column: string,
	start = "b.range_start",
	end = "b.range_end",
) {
	expect(query.sql).toContain(`${column} >= ${start}`);
	expect(query.sql).toContain(`${column} < ${end}`);
}

function expectInOrder(value: string, markers: readonly string[]) {
	let previousIndex = -1;

	for (const marker of markers) {
		const index = value.indexOf(marker);
		expect(index, `marker ${marker}`).toBeGreaterThan(previousIndex);
		previousIndex = index;
	}
}

function expectSucceededGenerationSources(query: CompiledQuery) {
	const start = query.sql.indexOf("activated_attempt_users as");
	const end = query.sql.indexOf("activated_users as", start);
	expect(start).toBeGreaterThanOrEqual(0);
	expect(end).toBeGreaterThan(start);
	const activationSql = query.sql.slice(start, end);

	for (const table of [
		"page_generation_attempts",
		"image_generation_attempts",
		"media_generation_attempts",
		"marketing_assets",
		"lead_scrape_attempts",
	]) {
		expect(activationSql).toMatch(
			new RegExp(
				`from ${table} a inner join projects p on p\\.id = a\\.project_id inner join [a-z_]+ c on c\\.user_id = p\\.user_id`,
			),
		);
	}

	expect(activationSql).toMatch(
		/from connector_generation_attempts a inner join [a-z_]+ c on c\.user_id = a\.user_id/,
	);
	expect(activationSql.match(/a\.status = 'succeeded'/g)).toHaveLength(6);
	expect(
		activationSql.match(/inner join projects p on p\.id = a\.project_id/g),
	).toHaveLength(5);
}

describe("AdminAnalyticsRepository snapshot queries", () => {
	it.each([
		["revenue", 16, 17],
		["acquisition", 4, 5],
		["funnel", 1, 0],
		["engagement", 5, 6],
		["features", 7, 8],
		["health", 4, 5],
	] as const)("runs %s with one page snapshot and compiles all %i queries", async (endpoint, queryCount, transactionCount) => {
		const { controlQueries, queries, transaction } =
			await collectQueries(endpoint);

		expect(transaction).toHaveBeenCalledTimes(transactionCount);
		for (const [, options] of transaction.mock.calls) {
			expect(options).toEqual({
				accessMode: "read only",
				isolationLevel: "repeatable read",
			});
		}
		if (transactionCount === 0) {
			expect(controlQueries).toEqual([]);
		} else {
			expect(controlQueries).toHaveLength(queryCount + 1);
			expect(controlQueries[0]?.sql).toBe(
				"select pg_export_snapshot() as snapshot_id",
			);
			expect(
				controlQueries
					.slice(1)
					.every(({ sql }) =>
						sql.startsWith("set transaction snapshot '00000003-0000001B-1'"),
					),
			).toBe(true);
		}
		expect(queries).toHaveLength(queryCount);
		for (const query of queries) {
			expect(query.sql).toContain("with bounds as");
			expect(query.sql).toContain("as range_start");
			expect(query.sql).toContain("as range_end");
			expect(query.sql).toContain("as series_end");
			expect(query.sql).toContain("as snapshot_end");
			expect(query.params.slice(0, 4)).toEqual([
				RANGE_BOUNDS.rangeStart,
				RANGE_BOUNDS.rangeEnd,
				RANGE_BOUNDS.seriesEnd,
				RANGE_BOUNDS.snapshotEnd,
			]);
			expect(query.sql.length).toBeGreaterThan(0);
		}
	});

	it.each([
		["revenue", 16],
		["acquisition", 4],
		["engagement", 5],
		["features", 7],
		["health", 4],
	] as const)("starts all %s queries before any of the %i queries resolves", async (endpoint, queryCount) => {
		const resolvers: Array<(result: { rows: unknown[] }) => void> = [];
		const execute = vi.fn(
			(_query: unknown) =>
				new Promise<{ rows: unknown[] }>((resolve) => {
					resolvers.push(resolve);
				}),
		);
		const { database } = databaseWithSnapshotTransactions(execute);
		const repository = new AdminAnalyticsRepository(database);

		const request =
			endpoint === "revenue"
				? repository.getRevenue(RANGE_BOUNDS)
				: endpoint === "acquisition"
					? repository.getAcquisition(RANGE_BOUNDS)
					: endpoint === "engagement"
						? repository.getEngagement(RANGE_BOUNDS)
						: endpoint === "features"
							? repository.getFeatures(RANGE_BOUNDS)
							: repository.getHealth(RANGE_BOUNDS);

		await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(queryCount));
		for (const resolve of resolvers) resolve({ rows: [] });
		await request;
	});

	it.each([
		[
			"pricingViewed",
			"inner join product_events e on e.user_id = c.user_id and e.kind = 'pricing_viewed'",
		],
		[
			"upgradeClicked",
			"inner join product_events e on e.user_id = c.user_id and e.kind = 'upgrade_clicked'",
		],
		[
			"checkoutStarted",
			"inner join billing_checkout_attempts a on a.user_id = c.user_id and a.purpose = 'subscription'",
		],
	] as const)("runs the %s user list as one bounded pool query", async (step, membershipJoin) => {
		const { queries, transaction } = await collectFunnelStepUserQueries(step);

		expect(transaction).not.toHaveBeenCalled();
		expect(queries).toHaveLength(1);

		const query = queries[0];
		if (!query) throw new Error("Missing funnel-step user query");

		expect(query.params.slice(0, 4)).toEqual([
			RANGE_BOUNDS.rangeStart,
			RANGE_BOUNDS.rangeEnd,
			RANGE_BOUNDS.seriesEnd,
			RANGE_BOUNDS.snapshotEnd,
		]);
		expect(query.sql).toContain("signup_cohort as");
		expect(query.sql).toContain(
			'from "user" u inner join filtered_users f on f.user_id = u.id cross join bounds b where u.created_at >= b.range_start and u.created_at < b.range_end',
		);
		expect(query.sql).toContain(membershipJoin);
		expect(query.sql).toMatch(/[ea]\.created_at < b\.snapshot_end/);
		expect(query.sql).toContain("left join admin_funnel_contacts");
		expect(query.sql).toContain(
			'left join "user" contacted_by on contacted_by.id = c.contacted_by_user_id',
		);
		expect(query.sql).toContain("counts as");
		expect(query.sql).toContain("count(*)::bigint as all_count");
		expect(query.sql).toContain(
			"count(*) filter (where contact_user_id is not null)::bigint as contacted_count",
		);
		expect(query.sql).toContain(
			"count(*) filter (where converted)::bigint as converted_count",
		);
		expect(query.sql).toContain("filtered_step_users as");
		expect(query.sql).toContain(
			"select count(*)::bigint as total from filtered_step_users",
		);
		expect(query.sql).toContain("order by last_event_at desc, user_id asc");
		expect(query.sql).toMatch(/limit \$\d+ offset \$\d+/);
		expect(query.params.slice(-2)).toEqual([20, 0]);
		expect(query.sql).toContain("from subscriptions s");
		expect(query.sql).toContain("s.created_at < b.snapshot_end");
		expect(query.sql).not.toContain("s.status");
	});

	it.each([
		["contacted", "where contact_user_id is not null"],
		["notContacted", "where contact_user_id is null"],
	] as const)("applies the %s filter after computing unfiltered counts", async (contacted, predicate) => {
		const { queries } = await collectFunnelStepUserQueries(
			"pricingViewed",
			{},
			{ contacted, pagination: { page: 3, pageSize: 25 } },
		);
		const query = queries[0];
		if (!query) throw new Error("Missing funnel-step user query");

		const countsStart = query.sql.indexOf("counts as");
		const filteredStart = query.sql.indexOf("filtered_step_users as");
		expect(countsStart).toBeGreaterThanOrEqual(0);
		expect(filteredStart).toBeGreaterThan(countsStart);
		expect(query.sql.slice(countsStart, filteredStart)).toContain(
			"from step_users",
		);
		expect(query.sql.slice(filteredStart)).toContain(predicate);
		expect(query.params.slice(-2)).toEqual([25, 50]);
	});

	it("omits limit and offset in the funnel-step CSV mode", async () => {
		const { execute, repository } = setup();

		await repository.getFunnelStepUsers(
			RANGE_BOUNDS,
			"pricingViewed",
			{},
			{ contacted: "notContacted", pagination: null },
		);

		const query = compileQuery(execute.mock.calls[0]?.[0]);
		expect(query.sql).not.toMatch(/\blimit\b/);
		expect(query.sql).not.toMatch(/\boffset\b/);
		expect(query.sql).toContain("where contact_user_id is null");
	});

	it("maps a funnel-step page with authoritative counts and pagination", async () => {
		const row = {
			all_count: "7",
			contacted_at: new Date("2026-08-04T12:00:00.000Z"),
			contacted_by_name: "Grace Hopper",
			contacted_by_user_id: "admin_1",
			contacted_count: "2",
			converted: true,
			converted_count: 1n,
			email: "ada@example.com",
			event_count: "4",
			first_event_at: new Date("2026-08-02T10:00:00.000Z"),
			image: "https://example.com/ada.png",
			last_event_at: new Date("2026-08-03T11:00:00.000Z"),
			name: "Ada Lovelace",
			signed_up_at: new Date("2026-08-01T09:00:00.000Z"),
			total: "3",
			user_id: "user_1",
		} satisfies FunnelStepUserRow;
		const { repository } = setup([row]);

		const snapshot = await repository.getFunnelStepUsers(
			RANGE_BOUNDS,
			"pricingViewed",
			{},
			{ contacted: "contacted", pagination: { page: 2, pageSize: 2 } },
		);

		expect(snapshot).toEqual({
			page: 2,
			pageSize: 2,
			total: 3,
			counts: { all: 7, contacted: 2, converted: 1 },
			items: [
				{
					userId: "user_1",
					name: "Ada Lovelace",
					email: "ada@example.com",
					image: "https://example.com/ada.png",
					signedUpAt: new Date("2026-08-01T09:00:00.000Z"),
					firstEventAt: new Date("2026-08-02T10:00:00.000Z"),
					lastEventAt: new Date("2026-08-03T11:00:00.000Z"),
					eventCount: 4,
					converted: true,
					contact: {
						contactedAt: new Date("2026-08-04T12:00:00.000Z"),
						contactedBy: {
							id: "admin_1",
							name: "Grace Hopper",
						},
					},
				},
			],
		});

		const partialContact = {
			...row,
			contacted_by_name: null,
		} satisfies FunnelStepUserRow;
		const { repository: partialContactRepository } = setup([partialContact]);
		const partialContactSnapshot =
			await partialContactRepository.getFunnelStepUsers(
				RANGE_BOUNDS,
				"pricingViewed",
			);

		expect(partialContactSnapshot.items[0]?.contact).toBeNull();
	});

	it("returns zero funnel-step totals when the query has no rows", async () => {
		const { repository } = setup();

		const snapshot = await repository.getFunnelStepUsers(
			RANGE_BOUNDS,
			"checkoutStarted",
		);

		expect(snapshot).toEqual({
			page: 1,
			pageSize: 20,
			total: 0,
			counts: { all: 0, contacted: 0, converted: 0 },
			items: [],
		});
	});

	it("preserves counts and filtered total on an empty out-of-range page", async () => {
		const metadataOnlyRow = {
			all_count: "7",
			contacted_at: null,
			contacted_by_name: null,
			contacted_by_user_id: null,
			contacted_count: "3",
			converted: null,
			converted_count: "2",
			email: null,
			event_count: null,
			first_event_at: null,
			image: null,
			last_event_at: null,
			name: null,
			signed_up_at: null,
			total: "3",
			user_id: null,
		} satisfies FunnelStepUserRow;
		const { repository } = setup([metadataOnlyRow]);

		const snapshot = await repository.getFunnelStepUsers(
			RANGE_BOUNDS,
			"pricingViewed",
			{},
			{ contacted: "contacted", pagination: { page: 3, pageSize: 2 } },
		);

		expect(snapshot).toEqual({
			page: 3,
			pageSize: 2,
			total: 3,
			counts: { all: 7, contacted: 3, converted: 2 },
			items: [],
		});
	});

	it("totals revenue by source and prices domain wholesale from actual then quote", async () => {
		const { queries } = await collectQueries("revenue");
		const bySource = queryContaining(queries, "domain_orders as");

		expect(bySource.sql).toContain("from billing_invoice_applications a");
		expect(bySource.sql).toContain("a.amount_paid_minor > 0");
		expect(bySource.sql).toContain("lower(a.currency) = 'usd'");
		expect(bySource.sql).toContain("o.kind = 'domain_registration'");
		expect(bySource.sql).toContain(
			"o.status in ('paid', 'fulfilling', 'fulfilled')",
		);
		expect(bySource.sql).toContain("round(d.provider_total_paid_usd * 100)");
		expect(bySource.sql).toContain(
			"round((o.metadata -> 'priceSnapshot' ->> 'quotedWholesaleUsd')::numeric * 100)",
		);
		expect(bySource.sql).toContain("where reg.payment_order_id = o.id");
		expect(bySource.sql).toContain(
			"where d.wholesale_cents is null), 0)::bigint as domain_cost_unknown_orders",
		);
		expectRange(bySource, "o.paid_at");
		expectRange(bySource, "a.paid_at");
	});

	it("ends daily series on the selected series date", async () => {
		const { queries } = await collectQueries("revenue");
		const seriesQueries = queries.filter(({ sql }) =>
			sql.includes("generate_series"),
		);

		expect(seriesQueries).toHaveLength(2);
		for (const query of seriesQueries) {
			expect(query.sql).toContain(
				"generate_series( b.range_start, b.series_end, interval '1 day' )",
			);
			expect(query.sql).not.toContain("(b.range_end at time zone 'UTC')::date");
		}
	});
});

describe("AdminAnalyticsRepository overview metrics SQL", () => {
	it("compiles only MRR and healthy-trial queries against the caller client", async () => {
		const { execute, repository, transaction } = setup();

		const result = await repository.getOverviewMetrics(
			{ execute } as unknown as Pick<Database, "execute">,
			RANGE_BOUNDS,
		);
		const queries = execute.mock.calls.map(([query]) => compileQuery(query));

		expect(transaction).not.toHaveBeenCalled();
		expect(queries).toHaveLength(2);
		expect(queryContaining(queries, "live_subscriptions as").sql).toContain(
			"count(distinct l.owner_id)",
		);
		expect(queryContaining(queries, "completed_generations as").sql).toContain(
			"count(*) filter (where not c.paid and c.healthy)",
		);
		expect(result).toEqual({
			activePaidUsers: 0,
			mrrSubscriptions: [],
			healthyTrials: 0,
		});
	});
});

describe("AdminAnalyticsRepository analytics filters", () => {
	it("AND-combines attribution filters while matching source by classifier or raw UTM", async () => {
		const { queries } = await collectQueries("acquisition", {
			country: "dz",
			device: "mobile",
			source: " Unknown ",
		});
		const filteredQueries = queries.filter(
			(query) => !query.sql.includes("from monthly_costs c"),
		);
		expect(filteredQueries).toHaveLength(3);

		for (const query of filteredQueries) {
			expect(query.sql).toMatch(
				/lower\(case .*when ua\.user_id is null then 'unknown'.*end\) = \$\d+ or lower\(btrim\(ua\.utm_source\)\) = \$\d+/,
			);
			expect(query.sql).toMatch(/upper\(btrim\(ua\.country\)\) = \$\d+/);
			expect(query.sql).toMatch(/ua\.device = \$\d+/);
			expect(query.sql).toMatch(
				/or lower\(btrim\(ua\.utm_source\)\) = \$\d+ \) and upper\(btrim\(ua\.country\)\) = \$\d+ and ua\.device = \$\d+/,
			);
			expect(query.params).toContain("unknown");
			expect(query.params).toContain("DZ");
			expect(query.params).toContain("mobile");
		}
	});

	it("honors cohortOnly in every engagement user cohort and nowhere else", async () => {
		const engagement = await collectQueries("engagement", { cohortOnly: true });
		const acquisition = await collectQueries("acquisition", {
			cohortOnly: true,
		});
		const funnel = await collectQueries("funnel", { cohortOnly: true });
		const funnelStepUsers = await collectFunnelStepUserQueries(
			"pricingViewed",
			{ cohortOnly: true },
		);
		const cohortClause =
			"where u.created_at < b.snapshot_end and u.created_at >= b.range_start and u.created_at < b.range_end";

		for (const query of engagement.queries) {
			expect(query.sql).toContain(cohortClause);
		}
		for (const query of [
			...acquisition.queries,
			...funnel.queries,
			...funnelStepUsers.queries,
		]) {
			expect(query.sql).not.toContain(cohortClause);
		}
	});

	it("nulls filtered anonymous visitors but ignores cohortOnly for visitors", async () => {
		const filteredSetup = setup();
		const filtered = await filteredSetup.repository.getFunnel(RANGE_BOUNDS, {
			device: "tablet",
		});
		const filteredQuery = compileQuery(
			filteredSetup.execute.mock.calls[0]?.[0],
		);

		expect(filtered.visitors).toBeNull();
		expect(filteredQuery.sql).toContain("null::bigint as visitors");

		const cohortSetup = setup();
		const cohortOnly = await cohortSetup.repository.getFunnel(RANGE_BOUNDS, {
			cohortOnly: true,
		});
		const cohortQuery = compileQuery(cohortSetup.execute.mock.calls[0]?.[0]);

		expect(cohortOnly.visitors).toBe(0);
		expect(cohortQuery.sql).toContain(
			"(select count(*) from tracked_clicks)::bigint as visitors",
		);
	});
});

describe("AdminAnalyticsRepository acquisition SQL", () => {
	it("loads every intersecting monthly-cost row for the acquisition snapshot", async () => {
		const { queries } = await collectQueries("acquisition");
		const costs = queryContaining(queries, "from monthly_costs c");

		expect(costs.sql).toContain("c.month::text as month");
		expect(costs.sql).toContain("b.range_end - interval '1 microsecond'");
		expect(costs.sql).toContain(
			"c.month + interval '1 month' > (b.range_start at time zone 'UTC')::date",
		);
		expect(costs.sql).toContain("order by c.month");
	});

	it("classifies sources in binding precedence order", async () => {
		const { queries } = await collectQueries("acquisition");
		const source = queryContaining(queries, "classified_users as");

		expectInOrder(source.sql, [
			"when aa.user_id is not null then 'affiliate'",
			"when ua.user_id is null then 'unknown'",
			"when nullif(btrim(ua.utm_source), '') is not null",
			"then lower(btrim(ua.utm_source))",
			"'organic_search'",
			"when nullif(btrim(ua.referrer), '') is not null then 'referral'",
			"else 'direct'",
		]);
		const searchPattern = source.params.find(
			(value) => typeof value === "string" && value.includes("duckduckgo"),
		);
		expect(searchPattern).toEqual(expect.stringContaining("google"));
		expect(searchPattern).toEqual(expect.stringContaining("bing"));
		expect(searchPattern).toEqual(expect.stringContaining("yahoo"));
	});

	it("bounds cohort signups but values current MRR for all attributed users", async () => {
		const { queries } = await collectQueries("acquisition");
		const source = queryContaining(queries, "source_cohort_totals as");

		expectRange(source, "c.created_at");
		expect(source.sql).toContain("s.created_at < b.snapshot_end");
		expect(source.sql).toContain("organization_billing_customers");
		expect(source.sql).toContain("obc.attribution_user_id");
		expect(
			source.params.filter((value) =>
				(LIVE_SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value),
			),
		).toEqual([...LIVE_SUBSCRIPTION_STATUSES]);
	});

	it("uses all six succeeded generation sources with user provenance", async () => {
		const { queries } = await collectQueries("acquisition");
		const source = queryContaining(queries, "source_cohort_totals as");

		expectSucceededGenerationSources(source);
	});

	it("groups campaigns and countries without manufacturing attribution", async () => {
		const { queries } = await collectQueries("acquisition");
		const source = queryContaining(queries, "source_cohort_totals as");
		const campaign = queryContaining(queries, "campaign_users as");
		const country = queryContaining(queries, "country_totals as");

		expect(campaign.sql).toContain(
			"coalesce(nullif(lower(btrim(a.utm_source)), ''), 'unknown')",
		);
		expect(campaign.sql).toContain("nullif(btrim(a.utm_campaign), '')");
		expect(country.sql).toMatch(
			/(?:nullif\(btrim\(a\.country\), ''\) is not null|btrim\(a\.country\) <> '')/,
		);
		expect(source.sql).toContain("coalesce(c.source, m.source) as source");
	});

	it("uses the unknown source cohort as the unattributed total", async () => {
		const execute = vi
			.fn()
			.mockResolvedValueOnce({
				rows: [
					{
						activated: 0,
						live_subscriptions: 0,
						paid: 0,
						price_lookup_key: null,
						signups: "4",
						source: "unknown",
					},
				],
			})
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] });
		const { database } = databaseWithSnapshotTransactions(execute);
		const repository = new AdminAnalyticsRepository(database);

		const snapshot = await repository.getAcquisition(RANGE_BOUNDS);

		expect(snapshot.unattributedSignups).toBe(4);
	});
});

describe("AdminAnalyticsRepository funnel SQL", () => {
	it("counts both tracked click sources and bounds the signup cohort", async () => {
		const { queries } = await collectQueries("funnel");
		const funnel = queryContaining(queries, "tracked_clicks as");

		expect(funnel.sql).toContain("from story_link_clicks");
		expect(funnel.sql).toContain("from affiliate_clicks");
		expect(funnel.sql).toContain("signup_cohort as");
		expectRange(funnel, "u.created_at");
		expect(
			funnel.sql.match(/created_at >= b\.range_start/g)?.length,
		).toBeGreaterThanOrEqual(3);
		expect(
			funnel.sql.match(/created_at < b\.range_end/g)?.length,
		).toBeGreaterThanOrEqual(3);
	});

	it("defines first action and activation from the binding sources", async () => {
		const { queries } = await collectQueries("funnel");
		const funnel = queryContaining(queries, "signup_cohort as");

		expect(funnel.sql).toContain("ai_usage_events e");
		expect(funnel.sql).toContain("e.operation = 'chat'");
		expect(funnel.sql).toContain("projects p on p.user_id = c.user_id");
		expectSucceededGenerationSources(funnel);
	});

	it("uses earliest binding events and discards negative funnel durations", async () => {
		const { queries } = await collectQueries("funnel");
		const funnel = queryContaining(queries, "first_action_durations as");

		expect(funnel.sql).toContain("select c.user_id, e.created_at as action_at");
		expect(funnel.sql).toContain("select c.user_id, p.created_at as action_at");
		expect(funnel.sql).toContain(
			"select a.user_id, min(a.action_at) as first_action_at",
		);
		expect(funnel.sql).toContain("where a.first_action_at >= c.created_at");
		expect(funnel.sql.match(/a\.completed_at as generation_at/g)).toHaveLength(
			6,
		);
		expect(funnel.sql).toContain("a.generation_at is not null");
		expect(funnel.sql).toContain("a.generation_at < b.snapshot_end");
		expect(funnel.sql).toContain("where g.first_generation_at >= c.created_at");
		expect(funnel.sql.match(/percentile_cont\(0\.5\)/g)).toHaveLength(2);
		expect(funnel.sql.match(/select avg\(d\.seconds\)/g)).toHaveLength(2);
	});

	it("counts pricing and upgrade events from the filtered signup cohort using the checkout window", async () => {
		const { queries } = await collectQueries("funnel", {
			source: "meta",
		});
		const funnel = queryContaining(queries, "pricing_viewed_users as");
		const productSteps = funnel.sql.slice(
			funnel.sql.indexOf("pricing_viewed_users as"),
			funnel.sql.indexOf("checkout_users as"),
		);

		expect(funnel.sql).toContain(
			"inner join product_events e on e.user_id = c.user_id and e.kind = 'pricing_viewed'",
		);
		expect(funnel.sql).toContain(
			"inner join product_events e on e.user_id = c.user_id and e.kind = 'upgrade_clicked'",
		);
		expect(
			productSteps.match(/where e\.created_at < b\.snapshot_end/g),
		).toHaveLength(2);
		expect(funnel.sql).toContain(
			"inner join billing_checkout_attempts a on a.user_id = c.user_id and a.purpose = 'subscription'",
		);
		expect(funnel.sql).toContain(
			"(select count(*) from pricing_viewed_users)::bigint as pricing_viewed_users",
		);
		expect(funnel.sql).toContain(
			"(select count(*) from upgrade_clicked_users)::bigint as upgrade_clicked_users",
		);
	});

	it("preserves null duration aggregates for right-censored cohorts", async () => {
		const execute = vi.fn(async () => ({
			rows: [
				{
					avg_first_action_seconds: null,
					avg_first_generation_seconds: null,
					first_action_duration_users: "0",
					first_generation_duration_users: "0",
					median_first_action_seconds: null,
					median_first_generation_seconds: null,
					visitors: "5",
				},
			],
		}));
		const { database } = databaseWithSnapshotTransactions(execute);
		const repository = new AdminAnalyticsRepository(database);

		const snapshot = await repository.getFunnel(RANGE_BOUNDS);

		expect(snapshot.durations).toEqual({
			signupToFirstAction: {
				avgSeconds: null,
				medianSeconds: null,
				users: 0,
			},
			signupToFirstGeneration: {
				avgSeconds: null,
				medianSeconds: null,
				users: 0,
			},
		});
		expect(snapshot.visitors).toBe(5);
	});

	it("applies first-seven-day healthy thresholds to the signup cohort", async () => {
		const { queries } = await collectQueries("funnel");
		const funnel = queryContaining(queries, "signup_cohort as");

		expect(funnel.params).toContain(HEALTHY_TRIAL_MIN_CENTI_CREDITS);
		expect(funnel.params).toContain(HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS);
		expect(funnel.sql).toContain("credit_ledger l");
		expect(funnel.sql).toContain("interval '7 days'");
		expect(funnel.sql).toMatch(
			/coalesce\([^)]*credits_consumed[^)]*, 0\) >= \$\d+.*coalesce\([^)]*completed_generations[^)]*, 0\) >= \$\d+/,
		);
	});

	it("treats checkout and payment as ever-after signup events at the snapshot", async () => {
		const { queries } = await collectQueries("funnel");
		const funnel = queryContaining(queries, "signup_cohort as");

		expect(funnel.sql).toContain("billing_checkout_attempts a");
		expect(funnel.sql).toMatch(/\.purpose = 'subscription'/);
		expect(funnel.sql).toContain("a.created_at < b.snapshot_end");
		expect(funnel.sql).toContain("s.created_at < b.snapshot_end");
		expect(funnel.sql).toContain("e.created_at < b.snapshot_end");
		expect(funnel.sql).toContain("p.created_at < b.snapshot_end");
	});
});

describe("AdminAnalyticsRepository engagement SQL", () => {
	it("computes last-full-day DAU and 7/30-day activity windows", async () => {
		const { queries } = await collectQueries("engagement");
		const activity = queryContaining(queries, "activity_windows as");

		expect(activity.sql).toContain(
			"b.range_end < b.series_end + interval '1 day'",
		);
		expect(activity.sql).toContain(
			"then (b.series_end at time zone 'UTC')::date - 1",
		);
		expect(activity.sql).toContain("a.activity_date >= d.data_end_date - 6");
		expect(activity.sql).toContain("a.activity_date >= d.data_end_date - 29");
		expect(activity.sql).toMatch(
			/count\(distinct .*user_id.*\) filter \( .*activity_date/,
		);
	});

	it("counts metered actions and distinct acting users inside the range", async () => {
		const { queries } = await collectQueries("engagement");
		const activity = queryContaining(queries, "metered_actions as");

		expect(activity.sql).toContain("count(*)::bigint as actions");
		expect(activity.sql).toContain(
			"count(distinct e.user_id)::bigint as acting_users",
		);
		expect(activity.sql).toContain(
			"inner join filtered_users f on f.user_id = e.user_id",
		);
		expectRange(activity, "e.created_at");
		expect(activity.sql).toContain("e.operation <> 'topup_adjust'");
	});

	it("zero-fills the selected activity-day series", async () => {
		const { queries } = await collectQueries("engagement");
		const activityByDay = queryContaining(queries, "daily_activity as");

		expect(activityByDay.sql).toContain(
			"generate_series( b.range_start, b.series_end, interval '1 day' )",
		);
		expect(activityByDay.sql).toContain("left join daily_activity");
		expect(activityByDay.sql).toMatch(/coalesce\([^)]*active_users[^)]*, 0\)/);
	});

	it("uses exact UTC signup-day offsets for returning retention", async () => {
		const { queries } = await collectQueries("engagement");
		const retention = queryContaining(queries, "signup_retention as");

		for (const day of [1, 3, 7, 14, 30]) {
			expect(retention.sql).toContain(`(${day})`);
		}
		expect(retention.sql).toMatch(
			/\.activity_date = [a-z]+\.signup_date \+ [a-z]+\.day_offset/,
		);
		expect(retention.sql).toMatch(
			/[a-z]+\.signup_date \+ [a-z]+\.day_offset <= [a-z]+\.data_end_date/,
		);
	});

	it("builds weekly cohort cells only through the data horizon", async () => {
		const { queries } = await collectQueries("engagement");
		const cohorts = queryContaining(queries, "cohort_grid as");

		expect(cohorts.sql).toContain("date_trunc('week'");
		expect(cohorts.sql).toContain("generate_series");
		expect(cohorts.sql).toContain("cohort_week_start");
		expect(cohorts.sql).toContain("b.series_end");
		expect(cohorts.sql).toContain("week_index");
	});

	it("evaluates healthy trials on signup day plus seven", async () => {
		const { queries } = await collectQueries("engagement");
		const healthy = queryContaining(queries, "evaluation_users as");

		expect(healthy.params).toContain(HEALTHY_TRIAL_MIN_CENTI_CREDITS);
		expect(healthy.params).toContain(HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS);
		expect(healthy.sql).toContain("::date + 7 as evaluation_date");
		expect(healthy.sql).toContain("interval '7 days'");
		expect(healthy.sql).toMatch(
			/coalesce\([^)]*credits_consumed[^)]*, 0\) >= \$\d+.*coalesce\([^)]*completed_generations[^)]*, 0\) >= \$\d+/,
		);
	});
});

describe("AdminAnalyticsRepository revenue SQL", () => {
	it("uses the shared live statuses and owner identity for current MRR", async () => {
		const { queries } = await collectQueries("revenue");
		const mrr = queryContaining(queries, "live_subscriptions as");

		expect(LIVE_SUBSCRIPTION_STATUSES).toEqual([
			"active",
			"trialing",
			"past_due",
		]);
		expect(
			mrr.params.filter((value) =>
				(LIVE_SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value),
			),
		).toEqual([...LIVE_SUBSCRIPTION_STATUSES]);
		expect(mrr.sql).toContain(
			"coalesce(s.organization_id, s.user_id) as owner_id",
		);
		expect(mrr.sql).toContain("s.created_at < b.snapshot_end");
		expect(mrr.sql).toContain("count(distinct l.owner_id)");
		expect(mrr.sql).toMatch(/plan_owners?(?:_totals)? as/);
	});

	it("keeps manual paid existence while limiting catalog MRR to Stripe", async () => {
		const { queries: revenueQueries } = await collectQueries("revenue");
		const mrr = queryContaining(revenueQueries, "live_subscriptions as");
		const liveStart = mrr.sql.indexOf("live_subscriptions as (");
		const pricedStart = mrr.sql.indexOf("stripe_priced_subscriptions as (");
		const groupedStart = mrr.sql.indexOf("grouped as (");
		const planOwnersStart = mrr.sql.indexOf("plan_owner_totals as (");
		const ownerTotalsStart = mrr.sql.indexOf(
			"owner_totals as (",
			planOwnersStart + "plan_owner_totals as (".length,
		);

		expect(liveStart).toBeGreaterThanOrEqual(0);
		expect(pricedStart).toBeGreaterThan(liveStart);
		expect(groupedStart).toBeGreaterThan(pricedStart);
		expect(planOwnersStart).toBeGreaterThan(groupedStart);
		expect(ownerTotalsStart).toBeGreaterThan(planOwnersStart);

		const liveSubscriptions = mrr.sql.slice(liveStart, pricedStart);
		const stripePricedSubscriptions = mrr.sql.slice(pricedStart, groupedStart);
		const groupedMrr = mrr.sql.slice(groupedStart, planOwnersStart);
		const planOwners = mrr.sql.slice(planOwnersStart, ownerTotalsStart);
		const activePaidUsers = mrr.sql.slice(ownerTotalsStart);

		expect(liveSubscriptions).toContain("s.provider");
		expect(liveSubscriptions).not.toContain("s.provider = 'stripe'");
		expect(stripePricedSubscriptions).toContain("from live_subscriptions l");
		expect(stripePricedSubscriptions).toContain("l.provider = 'stripe'");
		expect(groupedMrr).toContain("from stripe_priced_subscriptions l");
		expect(planOwners).toContain("from stripe_priced_subscriptions l");
		expect(activePaidUsers).toContain("as active_paid_users");
		expect(activePaidUsers).toContain("from live_subscriptions l");

		const { queries: funnelQueries } = await collectQueries("funnel");
		const funnel = queryContaining(funnelQueries, "signup_cohort as");
		const paidUsersStart = funnel.sql.indexOf("paid_users as (");
		const matureCohortStart = funnel.sql.indexOf("mature_signup_cohort as (");

		expect(paidUsersStart).toBeGreaterThanOrEqual(0);
		expect(matureCohortStart).toBeGreaterThan(paidUsersStart);

		const signupToPaid = funnel.sql.slice(paidUsersStart, matureCohortStart);
		expect(signupToPaid).toContain(
			"inner join subscriptions s on s.user_id = c.user_id",
		);
		expect(signupToPaid).not.toContain("s.provider");
	});

	it("derives owner churn and range-start exposure from lifecycle history", async () => {
		const { queries } = await collectQueries("revenue");
		const lifecycle = queryContaining(queries, "lifecycle_rows as");

		expect(lifecycle.sql).toContain("from subscription_state_events e");
		expectRange(lifecycle, "e.occurred_at");
		expect(lifecycle.sql).toContain("e.kind = 'ended'");
		expect(lifecycle.sql).toContain("live_at_range_end_subscriptions as");
		expect(lifecycle.sql).toContain(
			"left join live_at_range_end_subscriptions l",
		);
		expect(lifecycle.sql).toMatch(/\.owner_id is null/);
		expect(lifecycle.sql).toContain("s.created_at < b.range_start");
		expect(lifecycle.sql).toMatch(
			/coalesce\(\s*e\.organization_id, s\.organization_id, e\.user_id, s\.user_id\s*\)/,
		);
		expect(lifecycle.sql).toContain(
			"s.provider_subscription_id = e.stripe_subscription_id",
		);
	});

	it("returns created and plan-change rows for catalog MRR math", async () => {
		const { queries } = await collectQueries("revenue");
		const lifecycle = queryContaining(queries, "lifecycle_rows as");

		expect(lifecycle.sql).toContain("kind = 'created'");
		expect(lifecycle.sql).toContain("kind = 'plan_changed'");
		expect(lifecycle.sql).toContain("from_lookup_key");
		expect(lifecycle.sql).toContain("to_lookup_key");
		expect(lifecycle.sql).toContain("count(*)::bigint");
	});

	it("builds at most twelve UTC retention observations starting after the cohort month", async () => {
		const { queries } = await collectQueries("revenue");
		const retention = queryContaining(queries, "resolved_retention_events as");

		expect(retention.sql).toContain(
			"values (0), (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11)",
		);
		expect(retention.sql).toMatch(
			/coalesce\( e\.organization_id, s\.organization_id, e\.user_id, s\.user_id \) as owner_id/,
		);
		expect(retention.sql).toContain(
			"date_trunc('month', o.first_created_at at time zone 'UTC')::date",
		);
		expect(retention.sql).toContain(">= date '2026-07-01'");
		expect(retention.sql).toContain(
			"c.cohort_month::timestamp + (o.month_index + 1) * interval '1 month'",
		);
		expect(retention.sql).toContain("at time zone 'UTC' <= b.snapshot_end");
		expect(retention.sql).toContain(
			"coalesce(s.created_at, s.subscription_created_at) <= b.boundary_at",
		);
		expect(retention.sql).toContain("retention_subscription_ids as");
		expect(retention.sql).toContain(
			"select s.provider_subscription_id as stripe_subscription_id",
		);
		expect(retention.sql).toContain("retention_subscriptions as");
		expect(retention.sql).toContain(
			"coalesce(o.owner_id, s.organization_id, s.user_id) as owner_id",
		);
	});

	it("resolves terminal status and lookup keys at each retention boundary with the documented fallback", async () => {
		const { queries } = await collectQueries("revenue");
		const retention = queryContaining(
			queries,
			"boundary_subscription_history as",
		);

		expect(retention.sql).toContain("subscription_first_boundaries as");
		expect(retention.sql).toContain("min(s.boundary_at) as first_boundary_at");
		expect(retention.sql).toContain(
			"bool_or(e.kind = 'ended') over event_order as has_ended",
		);
		expect(retention.sql).toContain("order by e.occurred_at, e.id");
		expect(retention.sql).toContain(
			"rows between unbounded preceding and current row",
		);
		expect(retention.sql).toContain(
			"count(e.to_status) over event_order as status_version",
		);
		expect(retention.sql).toContain(
			"count(e.to_lookup_key) over event_order as lookup_version",
		);
		expect(retention.sql).toContain("max(e.to_status) over");
		expect(retention.sql).toContain("max(e.to_lookup_key) over");
		expect(retention.sql).toContain(
			"select distinct on (e.stripe_subscription_id, e.occurred_at)",
		);
		expect(retention.sql).toContain(
			"order by e.stripe_subscription_id, e.occurred_at, e.id desc",
		);
		expect(retention.sql).toContain("retention_state_intervals as");
		expect(retention.sql).toContain("lead(e.occurred_at) over");
		expect(retention.sql).toContain("e.next_occurred_at > f.first_boundary_at");
		expect(retention.sql).toContain(
			"when coalesce(e.has_ended, false) then 'ended'",
		);
		expect(retention.sql).toContain(
			"else coalesce(e.history_status, s.current_status)",
		);
		expect(retention.sql).toMatch(
			/coalesce\( e\.history_lookup, s\.created_lookup_key, case when e\.history_status is null then s\.current_lookup_key end \) as effective_lookup_key/,
		);
		expect(retention.sql).toContain("e.occurred_at <= s.boundary_at");
		expect(retention.sql).toContain("e.next_occurred_at > s.boundary_at");
		expect(retention.sql).not.toContain("left join lateral");
		expect(retention.sql).toContain("count(distinct h.owner_id) filter");
		expect(retention.sql).toContain("left join retention_lookup_totals l");
	});

	it("uses the churn owner set for shared attribution and all-time pre-churn feature usage", async () => {
		const { queries } = await collectQueries("revenue");
		const churn = queryContaining(queries, "breakdown_rows as");

		expect(churn.sql).toContain("churned_ended_subscriptions as");
		expect(churn.sql).toContain("left join live_at_range_end_subscriptions l");
		expect(churn.sql).toContain("where l.owner_id is null");
		expect(churn.sql).toContain(
			"case when c.organization_id is null then c.user_id else obc.attribution_user_id end as attribution_user_id",
		);
		expectInOrder(churn.sql, [
			"when aa.user_id is not null then 'affiliate'",
			"when ua.user_id is null then 'unknown'",
			"when nullif(btrim(ua.utm_source), '') is not null",
			"'organic_search'",
			"when nullif(btrim(ua.referrer), '') is not null then 'referral'",
			"else 'direct'",
		]);
		expect(churn.sql).toContain(
			"coalesce(nullif(upper(btrim(ua.country)), ''), 'unknown') as country",
		);
		expect(churn.sql).toContain("then 'starter'");
		expect(churn.sql).toContain("else 'unknown' end as plan");
		expect(churn.params).toContain("starter_50_month");
		expect(churn.params).toContain("pro_250_month");
		expect(churn.params).toContain("business_12500_year");
		expect(churn.params).not.toContain("starter_250_month");
		expect(churn.sql).toContain("churned_projects as");
		expect(churn.sql).toContain(
			"c.owner_id = coalesce(p.organization_id, p.user_id)",
		);
		expect(churn.sql).toContain("a.completed_at < c.churned_at");
		expect(churn.sql).toContain("a.created_at < c.churned_at");
		expect(churn.sql).toContain("e.created_at < c.churned_at");
		expect(churn.sql).toContain("d.created_at < c.churned_at");
		expect(churn.sql).toContain("connector_usage_events as materialized");
		expect(churn.sql).toContain("domain_usage_events as materialized");
		expect(churn.sql).toContain(
			"left join cancellation_reasons r on r.ended_state_event_id = e.id",
		);
		expect(churn.sql).toContain("e.id as ended_state_event_id");
		expect(churn.sql).toContain(
			"coalesce(r.reason::text, 'unknown') as reason",
		);
		expect(churn.sql).toContain(
			"select 'reason', r.reason, r.churned, null::text, 0::bigint",
		);

		const usageStart = churn.sql.indexOf("churned_projects as");
		const usageEnd = churn.sql.indexOf("churn_feature_owners as", usageStart);
		const featureUsage = churn.sql.slice(usageStart, usageEnd);
		expect(usageStart).toBeGreaterThanOrEqual(0);
		expect(usageEnd).toBeGreaterThan(usageStart);
		expect(featureUsage).not.toContain("b.range_start");
		expect(featureUsage.match(/created_at < b\.range_end/g)).toHaveLength(9);
		expect(featureUsage).toContain("a.completed_at < b.range_end");
		for (const feature of [
			"websites",
			"landingPages",
			"images",
			"videos",
			"marketing",
			"connectors",
			"leadScraping",
			"chat",
			"publishing",
			"domains",
		]) {
			expect(featureUsage).toContain(`'${feature}'`);
		}
	});

	it("maps missing churn source and country dimensions to unknown rows", async () => {
		const rowsByCall: Array<Array<Record<string, unknown>>> = Array.from(
			{ length: 16 },
			() => [],
		);
		// getRevenue call order: churn breakdown is the 12th query (0-indexed 11).
		rowsByCall[11] = [
			{
				churned: "1",
				dimension: "too_expensive",
				price_lookup_key: null,
				row_kind: "reason",
				subscriptions: "0",
			},
			{
				churned: "2",
				dimension: "unknown",
				price_lookup_key: null,
				row_kind: "plan",
				subscriptions: "1",
			},
			{
				churned: "2",
				dimension: "",
				price_lookup_key: null,
				row_kind: "source",
				subscriptions: "0",
			},
			{
				churned: "2",
				dimension: "",
				price_lookup_key: null,
				row_kind: "country",
				subscriptions: "0",
			},
			{
				churned: "1",
				dimension: "websites",
				price_lookup_key: null,
				row_kind: "feature",
				subscriptions: "0",
			},
		];
		let callIndex = 0;
		const execute = vi.fn(async () => ({
			rows: rowsByCall[callIndex++] ?? [],
		}));
		const { database } = databaseWithSnapshotTransactions(execute);
		const repository = new AdminAnalyticsRepository(database);

		const snapshot = await repository.getRevenue(RANGE_BOUNDS);

		expect(snapshot.churnBreakdown).toEqual({
			byCountry: [{ churned: 2, country: "unknown" }],
			byFeature: [{ churned: 1, feature: "websites" }],
			byPlan: [
				{
					churned: 2,
					mrrSubscriptions: [],
					plan: "unknown",
				},
			],
			byReason: [{ churned: 1, reason: "too_expensive" }],
			bySource: [{ churned: 2, source: "unknown" }],
		});
	});

	it("sums refund increments and reports failed payments separately", async () => {
		const { queries } = await collectQueries("revenue");
		const adjustments = queryContaining(queries, "adjustment_totals as");

		expectRange(adjustments, "a.occurred_at");
		expect(adjustments.sql).toContain("lower(a.currency) = 'usd'");
		expect(adjustments.sql).toMatch(
			/sum\(a\.amount_cents\) filter \(\s*where a\.kind = 'refund' and lower\(a\.currency\) = 'usd'/,
		);
		expect(adjustments.sql).toMatch(
			/count\(\*\) filter \(\s*where a\.kind = 'failed_payment' and lower\(a\.currency\) = 'usd'/,
		);
		expect(adjustments.sql).toMatch(
			/sum\(a\.amount_cents\) filter \(\s*where a\.kind = 'failed_payment' and lower\(a\.currency\) = 'usd'/,
		);
		expect(adjustments.sql).not.toContain("cumulative_refunded_cents");
	});

	it("requires both healthy thresholds inside each user's completed first-seven-day window", async () => {
		const { queries } = await collectQueries("revenue");
		const cohort = queryContaining(queries, "mature_users as");

		expect(cohort.params).toContain(HEALTHY_TRIAL_MIN_CENTI_CREDITS);
		expect(cohort.params).toContain(HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS);
		expect(cohort.sql).toMatch(
			/coalesce\(c\.credits_consumed, 0\) >= \$\d+ and coalesce\(g\.completed_generations, 0\) >= \$\d+/,
		);
		expect(cohort.sql).toContain(
			"u.created_at <= b.snapshot_end - interval '7 days'",
		);
		expect(cohort.sql).not.toContain("< b.range_end");
		expect(cohort.sql).toContain("c.created_at >= u.created_at");
		// Refund grants count on their consume's day; org-pool rows never
		// count toward a personal trial.
		expect(cohort.sql).toContain(
			"coalesce(refund_event.created_at, c.created_at) < u.created_at + interval '7 days'",
		);
		expect(cohort.sql).toContain(
			"coalesce(refund_event.created_at, c.created_at) < b.snapshot_end",
		);
		expect(cohort.sql).toContain("left join ai_usage_events refund_event");
		expect(cohort.sql).toMatch(
			/refund_event\.id = case when .*c\.meta ->> 'usageEventId'.* then \(c\.meta ->> 'usageEventId'\)::uuid end/,
		);
		expect(cohort.sql).not.toContain(
			"select e.created_at from ai_usage_events e where e.id::text = c.meta ->> 'usageEventId'",
		);
		expect(cohort.sql).toContain("c.organization_id is null");
		expect(cohort.sql).toContain(
			"greatest(0, sum(-c.delta))::bigint as credits_consumed",
		);
		expect(cohort.sql.match(/a\.status = 'succeeded'/g)).toHaveLength(6);
		expect(cohort.sql.match(/a\.completed_at >= u\.created_at/g)).toHaveLength(
			6,
		);
		expect(
			cohort.sql.match(/a\.completed_at < u\.created_at \+ interval '7 days'/g),
		).toHaveLength(6);
		expect(cohort.sql.match(/p\.deleted_at is null/g)).toHaveLength(5);
		expect(cohort.sql.match(/left join lateral \(/g)).toHaveLength(5);
		expect(cohort.sql.match(/e\.attempt_ref = a\.id::text/g)).toHaveLength(5);
		expect(cohort.sql.match(/usage_actor\.user_id/g)).toHaveLength(10);
		expect(
			cohort.sql.match(
				/case when p\.organization_id is null then p\.user_id end/g,
			),
		).toHaveLength(10);
		expect(cohort.sql).not.toContain(
			"coalesce(usage_actor.user_id, p.user_id)",
		);
		expect(cohort.sql).toContain(
			"count(*) filter (where not c.paid and c.healthy)",
		);
	});

	it("splits collected cash and metered AI cost per plan using the paid-plan precedence", async () => {
		const { queries } = await collectQueries("revenue");
		const margin = queryContaining(queries, "plan_revenue as");

		expect(margin.params.slice(0, 4)).toEqual([
			RANGE_BOUNDS.rangeStart,
			RANGE_BOUNDS.rangeEnd,
			RANGE_BOUNDS.seriesEnd,
			RANGE_BOUNDS.snapshotEnd,
		]);
		expectRange(margin, "a.paid_at");
		expectRange(margin, "ai_usage_events.created_at");
		expect(margin.sql).toContain("a.amount_paid_minor > 0");
		expect(margin.sql).toContain("lower(a.currency) = 'usd'");
		expect(margin.sql).toContain(
			"left join subscriptions s on s.id = a.subscription_id",
		);
		expect(margin.sql).toContain("and s.plan is not null");
		expect(
			margin.params.filter((value) =>
				(LIVE_SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value),
			),
		).toEqual([...LIVE_SUBSCRIPTION_STATUSES]);
		expect(
			margin.params.filter((value) =>
				(AI_SPEND_STATUSES as readonly unknown[]).includes(value),
			),
		).toEqual([...AI_SPEND_STATUSES]);
		expect(margin.sql).toContain("s.created_at < b.snapshot_end");
		expect(margin.sql).toContain(
			"max(case when s.plan = 'business' then 3 when s.plan = 'pro' then 2 when s.plan = 'starter' then 1 else 0 end) as plan_rank",
		);
		expect(margin.sql).toContain(
			"when o.plan_rank = 3 then 'business' when o.plan_rank = 2 then 'pro' when o.plan_rank = 1 then 'starter' else 'free' end",
		);
		expect(margin.sql).toContain(
			"round(sum(c.cost_micros)::numeric / 10000)::bigint as ai_cost_cents",
		);
	});

	it("ranges revenue on settlement timestamps and accepts only captured USD orders", async () => {
		const { queries } = await collectQueries("revenue");
		const collected = queryContaining(queries, "subscription_revenue as");

		expectRange(collected, "a.paid_at");
		expectRange(collected, "o.paid_at");
		expect(collected.sql).toContain("a.amount_paid_minor > 0");
		expect(collected.sql).toContain("lower(a.currency) = 'usd'");
		expect(collected.sql).toContain(
			"o.status in ('paid', 'fulfilling', 'fulfilled')",
		);
		expect(collected.sql).toContain("lower(o.currency) = 'usd'");
	});

	it("bounds subscription conversion and checkout sources on their leading timestamps", async () => {
		const { queries } = await collectQueries("revenue");
		const newPaid = queryContaining(queries, "daily as (");
		expect(newPaid.sql).toContain("s.status in (");
		expect(
			newPaid.params.filter((value) =>
				(LIVE_SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value),
			),
		).toEqual([...LIVE_SUBSCRIPTION_STATUSES]);
		const conversion = queryContaining(queries, "conversion_days as");
		const checkout = queryContaining(
			queries,
			"from billing_checkout_attempts a",
		);

		for (const query of [newPaid, conversion]) {
			expect(query.sql).toContain("s.created_at < b.range_end");
			expectRange(query, "f.first_subscription_at");
		}
		expectRange(checkout, "a.created_at");
		expect(checkout.sql).toContain(
			"count(*) filter (where a.status = 'completed')",
		);
	});
});

describe("AdminAnalyticsRepository feature and credit SQL", () => {
	it("measures ads operations over the range and connectivity at snapshot end", async () => {
		const { queries } = await collectQueries("features");
		const ads = queryContaining(queries, "operation_totals as");

		expectRange(ads, "e.created_at");
		expect(ads.sql).toContain(
			"e.feature = 'ads_analysis' and e.status = 'succeeded'",
		);
		expect(ads.sql).toContain(
			"e.feature = 'ads_launch' and e.status = 'failed'",
		);
		expect(ads.sql).toContain("count(distinct e.user_id) filter");
		expect(ads.sql).toContain("c.enabled = true");
		expect(ads.sql).toContain("c.slug in ('meta-ads', 'tiktok-ads')");
		expect(ads.sql).toContain("mc.access_token is not null");
		expect(ads.sql).toContain("mc.access_token_expires_at >= b.snapshot_end");
		expect(ads.sql).toContain("or mc.refresh_token is not null");
		expect(ads.sql).toContain("u.created_at < b.snapshot_end");
	});

	it("uses owner coalescing, non-deleted projects, and range-leading event timestamps", async () => {
		const { queries } = await collectQueries("features");
		const adoption = queryContaining(queries, "feature_events as");

		expect(adoption.sql).toContain(
			"coalesce(s.organization_id, s.user_id) as owner_id",
		);
		expect(adoption.sql).toContain(
			"count(distinct coalesce(e.organization_id, e.user_id))",
		);
		expect(adoption.sql).toContain(
			"coalesce(p.organization_id, p.user_id) as owner_id",
		);
		expect(adoption.sql).toMatch(
			/select 'websites'::text as key.*\(a\.spec ->> 'pageKind'\) is distinct from 'cod'/,
		);
		expect(adoption.sql).toMatch(
			/select 'landingPages'::text as key.*\(a\.spec ->> 'pageKind'\) = 'cod'/,
		);
		expect(adoption.sql).toContain(
			"select 'connectors', coalesce(a.organization_id, a.user_id)",
		);
		expect(adoption.sql).toContain(
			"select 'domains', coalesce(p.organization_id, d.user_id)",
		);
		expect(adoption.sql.match(/p\.deleted_at is null/g)).toHaveLength(8);
		expectRange(adoption, "a.completed_at");
		expect(adoption.sql.match(/a\.created_at >= b\.range_start/g)).toHaveLength(
			5,
		);
		expectRange(adoption, "e.created_at");
		expectRange(adoption, "d.created_at");
		expect(adoption.sql).toContain("s.created_at < b.snapshot_end");
	});

	it("reuses live-owner policy and bounds credit/cost scans", async () => {
		const { queries } = await collectQueries("features");
		const creditRange = queryContaining(queries, "ledger_range as");
		const freeConsumption = queryContaining(queries, "free_owners as (");
		const beforeUpgrade = queryContaining(
			queries,
			"credits_before_upgrade_total",
		);

		for (const query of [creditRange, freeConsumption]) {
			expect(
				query.params.filter((value) =>
					(LIVE_SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value),
				),
			).toEqual([...LIVE_SUBSCRIPTION_STATUSES]);
			expect(query.sql).toContain(
				"coalesce(s.organization_id, s.user_id) as owner_id",
			);
			expect(query.sql).toContain("s.created_at < b.snapshot_end");
		}

		expect(creditRange.sql).toContain("c.created_at >= b.range_start");
		expect(creditRange.sql).toContain("ledger_effective as materialized");
		expect(creditRange.sql).toContain(`${effectiveAtSql("c")} as effective_at`);
		expect(
			creditRange.sql.match(
				/where e\.id = \(case when \(c\.meta ->> 'usageEventId'\)/g,
			),
		).toHaveLength(1);
		expectRange(creditRange, "l.effective_at");
		expectRange(creditRange, "e.created_at");
		expect(creditRange.sql).toContain(
			"coalesce(c.organization_id, c.user_id) as owner_id",
		);
		expect(creditRange.sql).toContain("range_owners as");
		expect(creditRange.sql).toContain(
			"select distinct coalesce(e.organization_id, e.user_id) as owner_id",
		);
		expect(creditRange.sql).toContain(
			"left join owner_consumption c on c.owner_id = o.owner_id",
		);
		// Provider cost is the shared best-known expression over spend statuses
		// (a settled-but-unreconciled event contributes its snapshot cost), split
		// into total vs billable and by provenance.
		expect(creditRange.sql).not.toContain("sum(e.reconciled_cost_usd_micros)");
		expect(creditRange.sql).toContain(
			`"ai_usage_events"."pricing_snapshot" ->> 'costUsdMicros')::bigint`,
		);
		expect(creditRange.sql).toContain(
			`"ai_usage_events"."estimated_cost_usd_micros"`,
		);
		expect(creditRange.sql).toMatch(
			/ai_usage_events\.status in \(\$\d+, \$\d+, \$\d+(, \$\d+)?\)/,
		);
		expect(creditRange.params).toEqual(
			expect.arrayContaining(["settled", "reconciled", "reconcile_failed"]),
		);
		expect(creditRange.sql).toContain(
			"sum(s.cost_micros) filter (where s.billable)",
		);
		expect(creditRange.sql).toContain(
			`'$.gatewayReconciliation.generations[*] ? (@.customerBilling like_regex "^bundled_unmetered")'`,
		);
		expect(creditRange.sql).toContain(
			"coalesce(ai_usage_events.final_credits, 0) > 0",
		);
		for (const provenance of ["measured", "contract", "estimate"]) {
			expect(creditRange.sql).toContain(
				`sum(s.cost_micros) filter (where s.provenance = '${provenance}')`,
			);
		}
		expect(creditRange.sql).toContain(
			`sum(l.delta) filter (where (l.kind = 'grant' and not ${refundGrantSql("l")}))`,
		);
		expect(creditRange.sql).toContain(
			`greatest(0, coalesce(sum(-l.delta) filter (where ${netConsumptionSql("l")}), 0))::bigint as consumed`,
		);
		expect(beforeUpgrade.sql).toContain(netConsumptionSql("c"));
		expect(freeConsumption.sql).toContain("c.created_at < b.snapshot_end");
		expect(freeConsumption.sql).toContain("u.created_at < b.snapshot_end");
		expect(beforeUpgrade.sql).toContain("s.created_at < b.snapshot_end");
		expect(beforeUpgrade.sql).toContain(
			"f.first_subscription_at < b.snapshot_end",
		);
		expect(beforeUpgrade.sql).toContain("u.created_at < b.snapshot_end");
		expect(beforeUpgrade.sql).toContain("c.created_at >= u.created_at");
		expect(beforeUpgrade.sql).toContain(
			`${effectiveAtSql("c")} < u.first_subscription_at`,
		);
		expect(beforeUpgrade.sql).toContain("c.organization_id is null");
	});

	it("counts conversion only when the first owner subscription follows first in-range feature use", async () => {
		const { queries } = await collectQueries("features");
		const adoption = queryContaining(queries, "converted_after_use_totals as");

		expect(adoption.sql).toContain(
			"select e.key, e.owner_id, min(e.event_at) as first_use_at",
		);
		expect(adoption.sql).toContain(
			"coalesce(s.organization_id, s.user_id) as owner_id",
		);
		expect(adoption.sql).toContain(
			"min(s.created_at) as first_subscription_at",
		);
		expect(adoption.sql).toContain("s.first_subscription_at >= f.first_use_at");
		expect(adoption.sql).toContain("s.first_subscription_at < b.snapshot_end");
		expect(adoption.sql).toContain(
			"coalesce(c.converted_users, 0)::bigint as converted_after_use_users",
		);
	});

	it("measures signup-credit crossings while excluding ambiguous grants and earlier upgrades", async () => {
		const { queries } = await collectQueries("features");
		const freeCredits = queryContaining(queries, "signup_grants as");

		expect(freeCredits.sql).toContain("l.kind = 'grant'");
		expect(freeCredits.sql).toContain("l.bucket = 'promo'");
		expect(freeCredits.sql).toContain("l.organization_id is null");
		expect(freeCredits.sql).toContain(
			"l.idempotency_key = 'signup:' || l.user_id",
		);
		expect(freeCredits.sql).toContain(
			"partition by g.user_id order by c.created_at, c.id rows between unbounded preceding and current row",
		);
		expect(freeCredits.sql).toContain(
			"c.cumulative_consumed >= c.grant_credits",
		);
		expect(freeCredits.sql).toContain(
			"s.first_subscription_at >= c.crossing_at",
		);
		expect(freeCredits.sql).toContain("not exists ( select 1");
		expect(freeCredits.sql).toContain("other_grant.id <> c.grant_id");
		expect(freeCredits.sql).toContain("other_grant.delta > 0");
		expect(freeCredits.sql).toContain("other_grant.created_at < c.crossing_at");
		expect(freeCredits.sql).toContain("from crossings c");
		expect(freeCredits.sql).toContain("percentile_cont(0.5)");
	});

	it("buckets every owner by net consumption and uses ever-paid conversion", async () => {
		const { queries } = await collectQueries("features");
		const conversion = queryContaining(queries, "ever_paid_owners as");

		expect(conversion.sql).toContain("select u.id as owner_id");
		expect(conversion.sql).toContain("select c.organization_id");
		expect(conversion.sql).toContain("c.organization_id is not null");
		expect(conversion.sql).toContain(
			`sum(-c.delta) filter (where ${netConsumptionSql("c")})`,
		);
		expect(conversion.sql).toContain(
			"select distinct coalesce(s.organization_id, s.user_id) as owner_id",
		);
		expect(conversion.sql).toContain("s.created_at < b.snapshot_end");
		expect(conversion.sql).not.toContain("s.status in");
		expect(conversion.sql).toContain(
			"left join owner_consumption c on c.owner_id = u.owner_id",
		);
		expect(conversion.sql).toContain(
			"count(*) filter (where o.paid)::bigint as paid_owners",
		);
	});
});

describe("AdminAnalyticsRepository health SQL", () => {
	it("uses terminal attempts, correct latency starts, and p50/p95 percentiles", async () => {
		const { queries } = await collectQueries("health");
		const generation = queryContaining(queries, "terminal_attempts as");

		expect(generation.sql).toContain("percentile_cont(0.5)");
		expect(generation.sql).toContain("percentile_cont(0.95)");
		expect(generation.sql).toContain("a.status in ('succeeded', 'failed')");
		expect(generation.sql).toMatch(
			/'pages'::text as key.*a\.completed_at >= coalesce\(a\.started_at, a\.created_at\).*a\.completed_at - coalesce\(a\.started_at, a\.created_at\).*from page_generation_attempts/,
		);
		expect(generation.sql).toMatch(
			/select 'images'.*a\.completed_at - a\.started_at.*from image_generation_attempts/,
		);
		expect(generation.sql).toMatch(
			/select 'videos'.*a\.completed_at - a\.started_at.*from media_generation_attempts/,
		);
		expect(generation.sql).toMatch(
			/select 'marketing'.*a\.completed_at - a\.started_at.*from marketing_assets/,
		);
		expect(generation.sql).toMatch(
			/select 'connectors'.*a\.completed_at >= coalesce\(a\.started_at, a\.created_at\).*a\.completed_at - coalesce\(a\.started_at, a\.created_at\).*from connector_generation_attempts/,
		);
		expect(generation.sql).toMatch(
			/select 'leadScraping'.*a\.completed_at >= coalesce\(a\.started_at, a\.created_at\).*a\.completed_at - coalesce\(a\.started_at, a\.created_at\).*from lead_scrape_attempts/,
		);
		expect(generation.sql.match(/p\.deleted_at is null/g)).toHaveLength(5);
		expectRange(generation, "a.completed_at");
		expect(
			generation.sql.match(/a\.created_at >= b\.range_start/g),
		).toHaveLength(5);
		expect(
			generation.sql.match(/a\.completed_at < b\.range_end/g),
		).toHaveLength(6);
	});

	it("limits page failure codes to failed, non-empty, completed attempts", async () => {
		const { queries } = await collectQueries("health");
		const failures = queryContaining(queries, "trim(a.failure_code) as code");

		expect(failures.sql).toContain("p.deleted_at is null");
		expect(failures.sql).toContain("a.status = 'failed'");
		expect(failures.sql).toContain("a.failure_code is not null");
		expect(failures.sql).toContain("trim(a.failure_code) <> ''");
		expectRange(failures, "a.completed_at");
		expect(failures.sql).toContain("order by count(*) desc");
		expect(failures.sql).toContain("limit 5");
	});

	it("counts only grants joined to fully refunded usage events", async () => {
		const { queries } = await collectQueries("health");
		const refunds = queryContaining(queries, "credits_refunded");

		expect(refunds.sql).toContain(
			"inner join ai_usage_events e on e.id::text = (c.meta ->> 'usageEventId')",
		);
		expect(refunds.sql).toContain("c.kind = 'grant'");
		expect(refunds.sql).toContain("c.delta > 0");
		expect(refunds.sql).toContain("e.status = 'refunded'");
		expectRange(refunds, "c.created_at");
	});

	it("counts webhook intake, current outcomes, and independent dead letters", async () => {
		const { queries } = await collectQueries("health");
		const webhooks = queryContaining(queries, "from billing_webhook_events e");

		expect(webhooks.sql).toContain("count(*)::bigint as received");
		expect(webhooks.sql).toContain(
			"count(*) filter (where e.status = 'processed')",
		);
		expect(webhooks.sql).toContain(
			"count(*) filter (where e.status = 'skipped')",
		);
		expect(webhooks.sql).toContain(
			"count(*) filter (where e.status = 'failed')",
		);
		expect(webhooks.sql).toContain(
			"count(*) filter (where e.dead_lettered_at is not null)",
		);
		expectRange(webhooks, "e.created_at");
	});
});

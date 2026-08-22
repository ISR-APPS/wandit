import { db, PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";

import {
	buildLeadFunnelCountsQuery,
	type LeadFunnelGroupBy,
	type LeadRow,
	LeadsRepository,
} from "./leads.repository";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SCOPE = { kind: "personal", userId: "user-1" } as const;
const FROM = new Date("2026-07-19T23:00:00.000Z");
const TO = new Date("2026-08-19T10:30:00.000Z");

type LeadPageTestRow = LeadRow & {
	cursorCreatedAt: string;
};

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

function normalizeSqlParams(value: string): string {
	return normalizeSql(value).replaceAll(/\$\d+/g, "$?");
}

function compileSqlExpression(
	expression: Parameters<PgDialect["sqlToQuery"]>[0],
) {
	const { params, sql } = new PgDialect().sqlToQuery(expression);

	return { params, sql: normalizeSql(sql) };
}

function leadPageRow(id: string, cursorCreatedAt: string): LeadPageTestRow {
	return {
		archivedAt: null,
		attribution: null,
		commune: null,
		createdAt: new Date(cursorCreatedAt),
		cursorCreatedAt,
		extras: null,
		id,
		name: id,
		phone: "+213550000000",
		productSku: null,
		status: "to_confirm",
		wilaya: null,
	};
}

function selectBuilder(result: LeadPageTestRow[]) {
	const builder = {
		from: vi.fn(),
		innerJoin: vi.fn(),
		limit: vi.fn(async () => result),
		orderBy: vi.fn(),
		where: vi.fn(),
	};
	builder.from.mockReturnValue(builder);
	builder.innerJoin.mockReturnValue(builder);
	builder.orderBy.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);

	return builder;
}

function repositoryWithPages(pages: LeadPageTestRow[][]) {
	const builders = pages.map((page) => selectBuilder(page));
	const select = vi.fn();
	for (const builder of builders) {
		select.mockReturnValueOnce(builder);
	}

	return {
		builders,
		repository: new LeadsRepository({ select } as unknown as Database),
		select,
	};
}

/**
 * Renders the funnel query without touching Postgres: the builder is a
 * drizzle thenable, so reading `.toSQL()` before any await never opens a
 * connection (the @wandit/db singleton only lazily connects on a query).
 */
function renderFunnelQuery(groupBy: LeadFunnelGroupBy, limit?: number) {
	const rendered = buildLeadFunnelCountsQuery(db, PROJECT_ID, {
		from: FROM,
		groupBy,
		limit,
		to: TO,
	}).toSQL();

	return { params: rendered.params, sql: normalizeSql(rendered.sql) };
}

// node-postgres binds Date params as ISO strings.
const WHERE_PARAMS = [PROJECT_ID, FROM.toISOString(), TO.toISOString()];

describe("buildLeadFunnelCountsQuery (LeadsRepository.getFunnelCountsForProject)", () => {
	it.each([
		"source",
		"campaign",
		"status",
	] as const)("groups and orders on the output alias for groupBy %s", (groupBy) => {
		const { params, sql } = renderFunnelQuery(groupBy, 51);

		// The key expression must render exactly once (in the select
		// list); GROUP BY / ORDER BY reuse its alias. Re-rendering the
		// parameterised expression would give GROUP BY fresh bind ids
		// after the where-clause ones, and Postgres would reject the
		// select list (42803).
		expect(sql).toMatch(
			/ group by lead_funnel_key order by count\(\*\)::int desc, lead_funnel_key nulls last limit \$\d+$/,
		);
		expect(sql).not.toMatch(/group by (?!lead_funnel_key)/);
		// Where binds + limit are the LAST params: nothing binds after them.
		expect(params.slice(-4)).toEqual([...WHERE_PARAMS, 51]);
	});

	it("binds no key params for source and status, two for campaign", () => {
		// source = CASE over click ids / utm_source (its own literal binds);
		// the count of binds before the where clause is the key's own.
		const source = renderFunnelQuery("source", 51).params;
		const campaign = renderFunnelQuery("campaign", 51).params;
		const status = renderFunnelQuery("status", 51).params;

		expect(status).toEqual([...WHERE_PARAMS, 51]);
		// trim-chars + max-length, then the where clause and the limit.
		expect(campaign).toHaveLength(WHERE_PARAMS.length + 3);
		expect(campaign[1]).toBe(200);
		expect(source.length).toBeGreaterThan(WHERE_PARAMS.length + 1);
	});

	it("honours a caller limit above 50 and clamps at the sanity cap", () => {
		expect(renderFunnelQuery("status", 51).params.at(-1)).toBe(51);
		expect(renderFunnelQuery("status", 101).params.at(-1)).toBe(101);
		expect(renderFunnelQuery("status", 5_000).params.at(-1)).toBe(200);
		expect(renderFunnelQuery("status", 0).params.at(-1)).toBe(1);
		expect(renderFunnelQuery("status").params.at(-1)).toBe(200);
	});

	it("skips GROUP BY, ORDER BY, and LIMIT for groupBy none", () => {
		const { params, sql } = renderFunnelQuery("none", 51);

		expect(sql).not.toContain("group by");
		expect(sql).not.toContain("order by");
		expect(sql).not.toContain("limit");
		expect(sql).toContain('null::text as "lead_funnel_key"');
		expect(params).toEqual(WHERE_PARAMS);
	});

	it("scopes to the project, excludes archived leads, and uses [from, to)", () => {
		const { sql } = renderFunnelQuery("none");

		expect(sql).toContain('"leads"."project_id" = $1');
		expect(sql).toContain('"leads"."archived_at" is null');
		expect(sql).toContain('"leads"."created_at" >= $2');
		expect(sql).toContain('"leads"."created_at" < $3');
	});
});

describe("LeadsRepository sheet sync pagination", () => {
	it("lists every lead oldest-first across ascending cursor pages", async () => {
		const rows = [
			leadPageRow(
				"00000000-0000-4000-8000-000000000001",
				"2026-08-01T09:00:00.000000Z",
			),
			leadPageRow(
				"00000000-0000-4000-8000-000000000002",
				"2026-08-01T10:00:00.123456Z",
			),
			leadPageRow(
				"00000000-0000-4000-8000-000000000003",
				"2026-08-01T10:00:00.123456Z",
			),
			leadPageRow(
				"00000000-0000-4000-8000-000000000004",
				"2026-08-01T11:00:00.000000Z",
			),
			leadPageRow(
				"00000000-0000-4000-8000-000000000005",
				"2026-08-01T12:00:00.000000Z",
			),
		];
		const { builders, repository, select } = repositoryWithPages([
			rows.slice(0, 3),
			rows.slice(2, 5),
			rows.slice(4),
		]);
		const listed: LeadRow[] = [];
		let cursor: string | undefined;

		do {
			const page = await repository.listForProjectSync(SCOPE, PROJECT_ID, {
				cursor,
				pageSize: 2,
			});
			listed.push(...page.rows);
			cursor = page.nextCursor ?? undefined;
		} while (cursor);

		const listedIds = listed.map((row) => row.id);
		expect(listedIds).toEqual(rows.map((row) => row.id));
		expect(new Set(listedIds)).toHaveLength(rows.length);
		expect(listed.every((row) => !("cursorCreatedAt" in row))).toBe(true);
		expect(select).toHaveBeenCalledTimes(3);

		for (const builder of builders) {
			const orderBy = builder.orderBy.mock.calls[0] ?? [];
			expect(
				orderBy.map((expression) => compileSqlExpression(expression).sql),
			).toEqual(['"leads"."created_at" asc', '"leads"."id" asc']);
			expect(builder.limit).toHaveBeenCalledWith(3);
		}

		const secondPageWhere = compileSqlExpression(
			builders[1]?.where.mock.calls[0]?.[0],
		);
		expect(normalizeSqlParams(secondPageWhere.sql)).toContain(
			'("leads"."created_at" > $?::timestamptz or ("leads"."created_at" = $?::timestamptz and "leads"."id" > $?))',
		);
		expect(secondPageWhere.params.slice(-3)).toEqual([
			rows[1]?.cursorCreatedAt,
			rows[1]?.cursorCreatedAt,
			rows[1]?.id,
		]);
	});

	it("keeps the normal lead list newest-first with a descending cursor", async () => {
		const cursorCreatedAt = "2026-08-01T10:00:00.123456Z";
		const cursorId = "00000000-0000-4000-8000-000000000003";
		const cursor = Buffer.from(
			JSON.stringify({ createdAt: cursorCreatedAt, id: cursorId, v: 1 }),
			"utf8",
		).toString("base64url");
		const { builders, repository } = repositoryWithPages([[]]);

		await repository.listForProjectPage(SCOPE, PROJECT_ID, {
			archived: "exclude",
			cursor,
			pageSize: 2,
		});

		const builder = builders[0];
		const orderBy = builder?.orderBy.mock.calls[0] ?? [];
		expect(
			orderBy.map((expression) => compileSqlExpression(expression).sql),
		).toEqual(['"leads"."created_at" desc', '"leads"."id" desc']);

		const where = compileSqlExpression(builder?.where.mock.calls[0]?.[0]);
		expect(normalizeSqlParams(where.sql)).toContain(
			'("leads"."created_at" < $?::timestamptz or ("leads"."created_at" = $?::timestamptz and "leads"."id" < $?))',
		);
		expect(where.params.slice(-3)).toEqual([
			cursorCreatedAt,
			cursorCreatedAt,
			cursorId,
		]);
	});
});

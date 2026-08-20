import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";

import {
	buildLeadFunnelCountsQuery,
	type LeadFunnelGroupBy,
} from "./leads.repository";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FROM = new Date("2026-07-19T23:00:00.000Z");
const TO = new Date("2026-08-19T10:30:00.000Z");

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
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

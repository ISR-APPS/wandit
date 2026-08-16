import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import {
	AffiliateAdminRepository,
	calculateAffiliateReferredLtvCents,
} from "./affiliate-admin.repository";

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

type QualityRepository = {
	qualityByAffiliateIds(ids: string[]): Promise<Map<string, unknown>>;
};

function compileQuery(query: unknown) {
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

async function collectQualityQuery() {
	const execute = vi.fn(async (_query: unknown) => ({ rows: [] }));
	const repository = new AffiliateAdminRepository({
		execute,
	} as unknown as Database);

	await (repository as unknown as QualityRepository).qualityByAffiliateIds([
		"11111111-1111-4111-8111-111111111111",
	]);

	expect(execute).toHaveBeenCalledOnce();
	return compileQuery(execute.mock.calls[0]?.[0]);
}

describe("AffiliateAdminRepository referred quality SQL", () => {
	it("uses all-status attributed users and first-seven-day healthy thresholds", async () => {
		const query = await collectQualityQuery();

		expect(query.sql).toContain(
			"from affiliate_attributions aa inner join selected_affiliates selected",
		);
		expect(query.sql).not.toContain("aa.status");
		expect(query.sql).toContain(
			"au.created_at <= b.snapshot_end - interval '7 days'",
		);
		expect(query.sql).toContain("c.kind = 'consume'");
		expect(query.sql).toContain(
			"c.created_at < m.created_at + interval '7 days'",
		);
		expect(query.sql).toContain("f.first_subscription_at is null");
		expect(query.params).toContain(20);
		expect(query.params).toContain(2);

		for (const table of [
			"page_generation_attempts",
			"image_generation_attempts",
			"media_generation_attempts",
			"marketing_assets",
			"connector_generation_attempts",
			"lead_scrape_attempts",
		]) {
			expect(query.sql).toContain(`from ${table} a`);
		}
		expect(query.sql.match(/a\.status = 'succeeded'/g)).toHaveLength(6);
		expect(query.sql.match(/left join lateral/g)).toHaveLength(5);
		expect(query.sql).toContain(
			"case when p.organization_id is null then p.user_id end",
		);
		expect(query.sql).toContain(
			"from connector_generation_attempts a inner join mature_users m on m.user_id = a.user_id",
		);
	});

	it("resolves typed personal and organization owners before counting churn", async () => {
		const { sql } = await collectQualityQuery();

		expect(sql).toContain(
			"on s.organization_id is null and s.user_id = au.user_id",
		);
		expect(sql).toContain(
			"inner join organization_billing_customers obc on obc.attribution_user_id = au.user_id",
		);
		expect(sql).toContain("on s.organization_id = obc.organization_id");
		expect(sql).toContain("'user'::text as owner_kind");
		expect(sql).toContain("'organization'::text as owner_kind");
		expect(sql).toContain("where e.kind = 'ended'");
		expect(sql).toContain(
			"count(distinct states.attribution_user_id) filter ( where states.has_ended and not states.live_at_snapshot )",
		);
		expect(sql).toContain(
			"where states.ended_in_churn_window and not states.live_at_snapshot",
		);
		expect(sql).toContain("count(distinct (rs.owner_kind, rs.owner_id))::int");
	});

	it("uses the 90-day live-owner approximation and catalog monthly MRR", async () => {
		const query = await collectQualityQuery();

		expect(query.sql).toContain("now() - interval '90 days'");
		expect(query.sql).toContain("rs.created_at < b.churn_window_start");
		expect(query.sql).toContain(
			"or coalesce(ended.ended_in_churn_window, false)",
		);
		expect(query.sql).toContain("round(coalesce(sum(case rs.price_lookup_key");
		expect(query.sql).toContain("else 0::numeric end), 0))::bigint");
		expect(query.params).toContain("pro_250_month");
		expect(query.params).toContain(2_500);
		expect(query.params).toContain("pro_250_year");
		expect(query.params).toContain(25_000 / 12);
	});
});

describe("calculateAffiliateReferredLtvCents", () => {
	it.each([
		{
			baselineLivePaidOwners: 10,
			livePaidOwners: 0,
			referredMrrCents: 10_000,
			trailingChurnedOwners: 1,
		},
		{
			baselineLivePaidOwners: 0,
			livePaidOwners: 5,
			referredMrrCents: 10_000,
			trailingChurnedOwners: 1,
		},
		{
			baselineLivePaidOwners: 10,
			livePaidOwners: 5,
			referredMrrCents: 10_000,
			trailingChurnedOwners: 0,
		},
	])("returns null when an LTV denominator is zero", (input) => {
		expect(calculateAffiliateReferredLtvCents(input)).toBeNull();
	});

	it("annualizes trailing 90-day churn and permits zero catalog MRR", () => {
		const input = {
			baselineLivePaidOwners: 10,
			livePaidOwners: 2,
			referredMrrCents: 10_000,
			trailingChurnedOwners: 1,
		};
		const expected = Math.round(
			input.referredMrrCents /
				input.livePaidOwners /
				((input.trailingChurnedOwners / input.baselineLivePaidOwners) *
					(30.44 / 90)),
		);

		expect(calculateAffiliateReferredLtvCents(input)).toBe(expected);
		expect(
			calculateAffiliateReferredLtvCents({ ...input, referredMrrCents: 0 }),
		).toBe(0);
	});
});

import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminCostsRepository } from "./admin-costs.repository";

type SqlQuery = {
	toQuery: (config: {
		casing: { getColumnCasing: (column: { name: string }) => string };
		escapeName: (name: string) => string;
		escapeParam: (index: number) => string;
		escapeString: (value: string) => string;
	}) => { params: unknown[]; sql: string };
};

function compileQuery(query: unknown) {
	const compiled = (query as SqlQuery).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return {
		params: compiled.params,
		sql: compiled.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

function setup(rows: unknown[] = []) {
	const execute = vi.fn(async (_query: unknown) => ({ rows }));
	const repository = new AdminCostsRepository({
		execute,
	} as unknown as Database);

	return { execute, repository };
}

const DB_ROW = {
	month: "2026-08-01",
	currency: "usd",
	ad_spend_by_source_cents: { meta: 1_000 },
	infrastructure_cost_cents: 2_000,
	other_cost_cents: 300,
	notes: "August",
	version: 2,
	created_by_user_id: "admin-1",
	updated_by_user_id: "admin-2",
	created_at: new Date("2026-08-01T00:00:00.000Z"),
	updated_at: new Date("2026-08-16T10:00:00.000Z"),
};

describe("AdminCostsRepository", () => {
	it("lists the requested date-PK range in descending month order", async () => {
		const { execute, repository } = setup([DB_ROW]);

		const rows = await repository.list("2025-09-01", "2026-08-01");
		const query = compileQuery(execute.mock.calls[0]?.[0]);

		expect(query.sql).toContain("from monthly_costs c");
		expect(query.sql).toContain("c.month::text as month");
		expect(query.sql).toContain("c.month >= $1::date");
		expect(query.sql).toContain("c.month <= $2::date");
		expect(query.sql).toContain("order by c.month desc");
		expect(query.params).toEqual(["2025-09-01", "2026-08-01"]);
		expect(rows[0]).toMatchObject({
			month: "2026-08-01",
			adSpendBySourceCents: { meta: 1_000 },
			version: 2,
		});
	});

	it("creates idempotently at the month PK and exposes duplicate conflicts as null", async () => {
		const first = setup([DB_ROW]);
		const created = await first.repository.create({
			month: "2026-08-01",
			currency: "usd",
			adSpendBySourceCents: { meta: 1_000 },
			infrastructureCostCents: 2_000,
			otherCostCents: 300,
			notes: null,
			adminUserId: "admin-1",
		});
		const query = compileQuery(first.execute.mock.calls[0]?.[0]);

		expect(query.sql).toContain("insert into monthly_costs as c");
		expect(query.sql).toContain("on conflict (month) do nothing");
		expect(query.params).toContain("2026-08-01");
		expect(query.params).toContain('{"meta":1000}');
		expect(created?.month).toBe("2026-08-01");

		const duplicate = setup();
		expect(
			await duplicate.repository.create({
				month: "2026-08-01",
				currency: "usd",
				adSpendBySourceCents: {},
				infrastructureCostCents: 0,
				otherCostCents: 0,
				notes: null,
				adminUserId: "admin-1",
			}),
		).toBeNull();
	});

	it("updates only at the expected version and increments atomically", async () => {
		const { execute, repository } = setup([DB_ROW]);

		await repository.updateIfVersion({
			month: "2026-08-01",
			expectedVersion: 1,
			updatedByUserId: "admin-2",
			changes: { infrastructureCostCents: 2_000, notes: null },
		});
		const query = compileQuery(execute.mock.calls[0]?.[0]);

		expect(query.sql).toContain("update monthly_costs as c");
		expect(query.sql).toContain("infrastructure_cost_cents = $1");
		expect(query.sql).toContain("notes = $2");
		expect(query.sql).toContain("version = version + 1");
		expect(query.sql).toContain("c.month = $4::date and c.version = $5");
	});

	it("deletes by the first-day date PK without requiring the new table live", async () => {
		const { execute, repository } = setup();

		await repository.delete("2026-08-01");
		const query = compileQuery(execute.mock.calls[0]?.[0]);

		expect(query.sql).toContain("delete from monthly_costs");
		expect(query.sql).toContain("where month = $1::date");
		expect(query.params).toEqual(["2026-08-01"]);
	});
});

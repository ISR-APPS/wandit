import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";

import { AdminCreditGrantsRepository } from "./admin-credit-grants.repository";

// The predicate text of credit_ledger_adminGrant_createdAt_idx (migration 0079).
const ADMIN_GRANT_PREDICATE = `("credit_ledger"."meta" ->> 'reason') = 'admin_grant'`;

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

function buildQueries(page: number, pageSize: number) {
	const repository = new AdminCreditGrantsRepository(db);

	// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
	const { countQuery, listQuery } = repository["buildListCreditGrantsQueries"]({
		page,
		pageSize,
	});

	return { count: countQuery.toSQL(), list: listQuery.toSQL() };
}

describe("AdminCreditGrantsRepository", () => {
	it("filters both queries with the literal partial-index predicate", () => {
		const { count, list } = buildQueries(1, 20);

		expect(normalizeSql(count.sql)).toContain(`where ${ADMIN_GRANT_PREDICATE}`);
		expect(normalizeSql(list.sql)).toContain(`where ${ADMIN_GRANT_PREDICATE}`);
		expect(count.params).toEqual([]);
		expect(list.params).not.toContain("admin_grant");
	});

	it("counts ledger rows only, without the joins", () => {
		const { count } = buildQueries(1, 20);

		expect(normalizeSql(count.sql)).not.toContain(" join ");
	});

	it("joins the granter by meta.grantedBy and orders newest first", () => {
		const listSql = normalizeSql(buildQueries(1, 20).list.sql);

		expect(listSql).toContain(
			`left join "user" "granter" on "granter"."id" = "credit_ledger"."meta" ->> 'grantedBy'`,
		);
		expect(listSql).toContain(
			`left join "user" on "user"."id" = "credit_ledger"."user_id"`,
		);
		expect(listSql).toContain(
			`left join "organization" on "organization"."id" = "credit_ledger"."organization_id"`,
		);
		expect(listSql).toContain(
			`order by "credit_ledger"."created_at" desc, "credit_ledger"."id" desc`,
		);
	});

	it("turns the page number into an offset", () => {
		const { list } = buildQueries(3, 25);

		expect(list.params).toEqual([25, 50]);
	});
});

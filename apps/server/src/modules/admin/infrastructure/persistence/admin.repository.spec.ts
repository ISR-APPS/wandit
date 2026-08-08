import type { AdminUserPagesQuery } from "@wandit/contracts";
import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";
import type { Database } from "../../../../infrastructure/database/database.constants";
import { AdminRepository, type AdminUserPageRow } from "./admin.repository";

const QUERY = {
	page: 2,
	pageSize: 10,
	sort: "recently_updated",
} satisfies AdminUserPagesQuery;

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

describe("AdminRepository user landing-page queries", () => {
	it("allows the driver string shape for the raw activity timestamp", () => {
		const repository = new AdminRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildUserPagesQueries"]("user-1", QUERY);
		type ListQueryRow = Awaited<typeof listQuery>[number];
		const rawRow = {
			projectUpdatedAt: "2026-08-07 12:00:00+00",
		} satisfies Pick<AdminUserPageRow, "projectUpdatedAt"> &
			Pick<ListQueryRow, "projectUpdatedAt">;

		expect(rawRow.projectUpdatedAt).toBe("2026-08-07 12:00:00+00");
	});

	it("compiles one count and one set-oriented lateral list query", () => {
		const repository = new AdminRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery, listQuery } = repository["buildUserPagesQueries"](
			"user-1",
			QUERY,
		);
		const count = countQuery.toSQL();
		const list = listQuery.toSQL();
		const countSql = normalizeSql(count.sql);
		const listSql = normalizeSql(list.sql);

		expect(countSql).toContain('from "projects" inner join "artifacts"');
		expect(countSql).toContain('"artifacts"."kind" =');
		expect(countSql).not.toContain("lateral");
		expect(count.params).toEqual(["user-1", "landing_page"]);

		expect(listSql.match(/left join lateral/g)).toHaveLength(5);
		expect(listSql).toContain('from "versions"');
		expect(listSql).toContain('from "page_generation_attempts"');
		expect(listSql).toContain('from "deployments"');
		expect(listSql).toContain('from "domains"');
		expect(listSql).toContain('"domains"."is_primary" =');
		expect(listSql).toContain('"domains"."status" =');
		const activityTimestamp =
			'greatest("projects"."updated_at", "artifacts"."updated_at")';
		expect(listSql.split(activityTimestamp)).toHaveLength(3);
		expect(listSql).toContain(`order by ${activityTimestamp} desc`);
		expect(list.params).toContain("user-1");
		expect(list.params).toContain("landing_page");
		expect(list.params).toContain("active");
		expect(list.params).toContain(10);
	});
});

describe("AdminRepository user project queries", () => {
	it("compiles the shared non-deleted project count", () => {
		const repository = new AdminRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const countQuery = repository["buildUserProjectsCountQuery"]("user-1");
		const count = countQuery.toSQL();
		const countSql = normalizeSql(count.sql);

		expect(countSql).toContain('select count(*)::int from "projects"');
		expect(countSql).toContain('"projects"."user_id" =');
		expect(countSql).toContain('"projects"."deleted_at" is null');
		expect(count.params).toEqual(["user-1"]);
	});

	it("compiles newest pagination with matching descending tie-breakers", () => {
		const repository = new AdminRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const listQuery = repository["buildUserProjectsListQuery"]("user-1", {
			limit: 10,
			offset: 20,
			order: "desc",
		});
		const list = listQuery.toSQL();
		const listSql = normalizeSql(list.sql);

		expect(listSql).toContain('"projects"."user_id" =');
		expect(listSql).toContain('"projects"."deleted_at" is null');
		expect(listSql).toContain(
			'order by "projects"."created_at" desc, "projects"."id" desc',
		);
		expect(listSql).toContain("limit");
		expect(listSql).toContain("offset");
		expect(list.params).toEqual(["user-1", 10, 20]);
	});

	it("compiles oldest pagination with matching ascending tie-breakers", () => {
		const repository = new AdminRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const listQuery = repository["buildUserProjectsListQuery"]("user-1", {
			limit: 25,
			offset: 25,
			order: "asc",
		});
		const list = listQuery.toSQL();
		const listSql = normalizeSql(list.sql);

		expect(listSql).toContain(
			'order by "projects"."created_at" asc, "projects"."id" asc',
		);
		expect(list.params).toEqual(["user-1", 25, 25]);
	});
});

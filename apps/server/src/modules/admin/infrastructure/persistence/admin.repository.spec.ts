import {
	type AdminListUsersQuery,
	type AdminUserPagesQuery,
	adminListUsersQuerySchema,
} from "@wandit/contracts";
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

function normalizeSqlParams(value: string): string {
	return normalizeSql(value).replaceAll(/\$\d+/g, "$?");
}

function outerUserWhere(value: string): string | undefined {
	return normalizeSqlParams(value)
		.split(' from "user" where ')[1]
		?.split(" order by ")[0];
}

describe("adminListUsersQuerySchema", () => {
	it("splits, trims, removes empty values, and deduplicates CSV filters", () => {
		const query = adminListUsersQuerySchema.parse({
			plan: " free,pro,,free ",
			role: "admin, user,admin",
			status: " banned,active ",
			verified: "verified, unverified,verified",
			creditsUsedMin: "100",
			creditsUsedMax: "999",
		});

		expect(query).toMatchObject({
			plan: ["free", "pro"],
			role: ["admin", "user"],
			status: ["banned", "active"],
			verified: ["verified", "unverified"],
			creditsUsedMin: 100,
			creditsUsedMax: 999,
		});
	});

	it("maps a CSV filter containing only empty tokens to undefined", () => {
		const query = adminListUsersQuerySchema.parse({ plan: " , , " });

		expect(query.plan).toBeUndefined();
	});

	it.each([
		["plan", "free,enterprise"],
		["role", "user,owner"],
		["status", "active,suspended"],
		["verified", "verified,pending"],
		["creditsUsedMin", "-1"],
		["creditsUsedMax", "abc"],
	] as const)("rejects an invalid %s token", (filter, value) => {
		expect(
			adminListUsersQuerySchema.safeParse({ [filter]: value }).success,
		).toBe(false);
	});

	// Pricing v4: bounds are decimal credits, so fractional filters are valid.
	it("accepts decimal credits-used bounds", () => {
		const query = adminListUsersQuerySchema.parse({
			creditsUsedMin: "0.5",
			creditsUsedMax: "12.34",
		});

		expect(query).toMatchObject({
			creditsUsedMin: 0.5,
			creditsUsedMax: 12.34,
		});
	});

	it("rejects an inverted credits-used range", () => {
		expect(
			adminListUsersQuerySchema.safeParse({
				creditsUsedMin: "500",
				creditsUsedMax: "100",
			}).success,
		).toBe(false);
	});
});

describe("AdminRepository user-list queries", () => {
	it("applies the same combined search, plan, role, status, verification, and credits filters to count and list", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 2,
			pageSize: 10,
			sort: "newest",
			q: "100%",
			plan: ["pro", "business"],
			role: ["admin"],
			status: ["banned"],
			verified: ["unverified"],
			creditsUsedMin: 100,
			creditsUsedMax: 999,
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const list = listQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);
		const listSql = normalizeSqlParams(list.sql);
		const entitledPredicate =
			'"subscriptions"."user_id" = "user"."id" and "subscriptions"."organization_id" is null and "subscriptions"."status" in ($?, $?)';

		expect(outerUserWhere(list.sql)).toBe(outerUserWhere(count.sql));
		expect(countSql).toContain(
			'("user"."name" ilike $? or "user"."email" ilike $?)',
		);
		expect(countSql).toContain(
			`exists (select 1 from "subscriptions" where ${entitledPredicate} and "subscriptions"."plan" in ($?, $?))`,
		);
		expect(countSql).toContain(
			"from unnest(string_to_array(coalesce(\"user\".\"role\", ''), ',')) as role_part(value)",
		);
		expect(countSql).toContain("where lower(trim(role_part.value)) = 'admin'");
		expect(countSql).toContain('"user"."banned" is true');
		expect(countSql).toContain('"user"."email_verified" is not true');
		expect(countSql).toContain(
			'coalesce(( select -sum("credit_ledger"."delta") from "credit_ledger"',
		);
		expect(countSql).toContain("between $? and $?");
		expect(listSql.split(entitledPredicate)).toHaveLength(3);
		// Credits bounds are decimal credits scaled x100 to centi-credits.
		expect(count.params).toEqual([
			"%100\\%%",
			"%100\\%%",
			"active",
			"trialing",
			"pro",
			"business",
			10_000,
			99_900,
		]);
		expect(list.params.slice(-2)).toEqual([10, 10]);
	});

	it("uses NOT EXISTS for free and inverse predicates for regular active verified users", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			plan: ["free"],
			role: ["user"],
			status: ["active"],
			verified: ["verified"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			'not exists (select 1 from "subscriptions" where "subscriptions"."user_id" = "user"."id"',
		);
		expect(countSql).toContain(
			"not exists ( select 1 from unnest(string_to_array(coalesce(\"user\".\"role\", ''), ','))",
		);
		expect(countSql).toContain('"user"."banned" is not true');
		expect(countSql).toContain('"user"."email_verified" is true');
	});

	it("ORs free with a selected paid plan inside the plan dimension", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			plan: ["free", "pro"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(countSql).toContain(
			'not exists (select 1 from "subscriptions" where "subscriptions"."user_id" = "user"."id"',
		);
		expect(countSql).toContain(
			'or exists (select 1 from "subscriptions" where "subscriptions"."user_id" = "user"."id"',
		);
		expect(countSql).toContain('"subscriptions"."plan" in ($?))');
		expect(count.params).toEqual([
			"active",
			"trialing",
			"active",
			"trialing",
			"pro",
		]);
	});

	it("treats all values selected in each dimension as no filter", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			plan: ["free", "pro", "business"],
			role: ["user", "admin"],
			status: ["active", "banned"],
			verified: ["verified", "unverified"],
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);

		expect(outerUserWhere(countQuery.toSQL().sql)).toBeUndefined();
		expect(outerUserWhere(listQuery.toSQL().sql)).toBeUndefined();
	});

	// Net consumption: reserve rows minus the refund grants that reverse them.
	const netConsumedExpression =
		'coalesce(( select -sum("credit_ledger"."delta") from "credit_ledger" where "credit_ledger"."user_id" = "user"."id" and "credit_ledger"."organization_id" is null and ("credit_ledger"."kind" = \'consume\' or ("credit_ledger"."kind" = \'grant\' and ("credit_ledger"."idempotency_key" like \'settle-refund:%\' or "credit_ledger"."idempotency_key" like \'reconcile-refund:%\' or "credit_ledger"."idempotency_key" like \'refund:%\'))) ), 0)::int';

	// Bounds arrive in decimal credits and are scaled x100 to the integer
	// centi-credit unit of the ledger sums before hitting SQL.
	it.each([
		[
			"a closed",
			{ creditsUsedMin: 100, creditsUsedMax: 999 },
			"between $? and $?",
			[10_000, 99_900],
		],
		[
			"a single-value",
			{ creditsUsedMin: 0, creditsUsedMax: 0 },
			"between $? and $?",
			[0, 0],
		],
		[
			"a fractional",
			{ creditsUsedMin: 0.5, creditsUsedMax: 12.34 },
			"between $? and $?",
			[50, 1_234],
		],
		["a min-only", { creditsUsedMin: 1000 }, ">= $?", [100_000]],
		["a max-only", { creditsUsedMax: 99 }, "<= $?", [9_900]],
	] as const)("applies %s credits-used range", (_label, range, operator, params) => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			...range,
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(countSql).toContain(netConsumedExpression);
		expect(countSql).toContain(operator);
		expect(count.params).toEqual(params);
	});

	it.each([
		["most_projects", "projectsCount"],
		["most_credits", "creditsBalance"],
		["most_consumed", "creditsConsumed"],
	] as const)("reuses the selected %s aggregate expression for ordering", (sort, aggregate) => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 10,
			sort,
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildListUsersQueries"](query);
		const listSql = normalizeSqlParams(listQuery.toSQL().sql);
		const aggregateExpressions = {
			projectsCount:
				'( select count(*) from "projects" where "projects"."user_id" = "user"."id" and "projects"."deleted_at" is null )::int',
			creditsBalance:
				'coalesce(( select sum("credit_ledger"."delta") from "credit_ledger" where "credit_ledger"."user_id" = "user"."id" and "credit_ledger"."organization_id" is null ), 0)::int',
			creditsConsumed: netConsumedExpression,
		};
		const aggregateExpression = aggregateExpressions[aggregate];

		expect(listSql.split(aggregateExpression)).toHaveLength(3);
		expect(listSql).toContain(
			`order by ${aggregateExpression} desc, "user"."id" desc`,
		);
	});

	it("sorts recent activity descending with nulls last and a stable id tie-breaker", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 10,
			sort: "recently_seen",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildListUsersQueries"](query);
		const listSql = normalizeSql(listQuery.toSQL().sql);

		expect(listSql).toContain(
			'order by "user"."last_seen_at" desc nulls last, "user"."id" desc',
		);
	});
});

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

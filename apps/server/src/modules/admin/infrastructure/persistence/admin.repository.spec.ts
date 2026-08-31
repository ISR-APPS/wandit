import {
	type AdminListUsersQuery,
	type AdminUserPagesQuery,
	adminListUsersQuerySchema,
	countryCodeFromE164,
	dialCountries,
	preferredCountryIsoByDial,
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

function storedRoleExistsSql(role: "admin" | "support"): string {
	return normalizeSql(`
		exists (
			select 1
			from unnest(string_to_array(coalesce("user"."role", ''), ',')) as role_part(value)
			where lower(trim(role_part.value)) = '${role}'
		)
	`);
}

const adminRoleExistsSql = storedRoleExistsSql("admin");
const supportRoleExistsSql = storedRoleExistsSql("support");

describe("shared country dial helpers", () => {
	it.each([
		["+213661223344", "DZ"],
		["+12025550123", "US"],
		["+212612345678", "MA"],
		["213661223344", null],
		["+213123", null],
		["+99912345678", null],
	] as const)("maps E.164 %s to %s", (phone, expected) => {
		expect(countryCodeFromE164(phone)).toBe(expected);
	});

	it("defines a valid preferred owner for every duplicated dial", () => {
		const countriesByDial = new Map<string, string[]>();
		for (const country of dialCountries) {
			const countryCodes = countriesByDial.get(country.dial) ?? [];
			countryCodes.push(country.iso);
			countriesByDial.set(country.dial, countryCodes);
		}

		const duplicateDials = [...countriesByDial]
			.filter(([, countryCodes]) => countryCodes.length > 1)
			.map(([dial]) => dial)
			.sort();
		expect(duplicateDials).toEqual(
			Object.keys(preferredCountryIsoByDial).sort(),
		);

		for (const [dial, preferredCountryCode] of Object.entries(
			preferredCountryIsoByDial,
		)) {
			expect(countriesByDial.get(dial)).toContain(preferredCountryCode);
			const nationalDigits = "1".repeat(8 - dial.length);
			expect(countryCodeFromE164(`+${dial}${nationalDigits}`)).toBe(
				preferredCountryCode,
			);
		}
	});
});

describe("adminListUsersQuerySchema", () => {
	it("splits, trims, removes empty values, and deduplicates CSV filters", () => {
		const query = adminListUsersQuerySchema.parse({
			plan: " free,pro,,free ",
			freeCredits: " consumed, available,consumed ",
			country: " DZ, unknown,US,DZ ",
			role: "admin, support, user,admin",
			status: " banned,active ",
			verified: "verified, unverified,verified",
			creditsUsedMin: "100",
			creditsUsedMax: "999",
		});

		expect(query).toMatchObject({
			plan: ["free", "pro"],
			freeCredits: ["consumed", "available"],
			country: ["DZ", "unknown", "US"],
			role: ["admin", "support", "user"],
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
		["freeCredits", "consumed,pending"],
		["country", "DZ,FRANCE"],
		["country", "dz"],
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
	it("projects phone through a correlated scalar subquery without joining onboarding rows", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildListUsersQueries"](query);
		const listSql = normalizeSql(listQuery.toSQL().sql);
		const phoneSubquery =
			'( select "user_onboarding"."answers" ->> \'phone\' from "user_onboarding" where "user_onboarding"."user_id" = "user"."id" limit 1 )';

		expect(listSql).toContain(phoneSubquery);
		expect(listSql).not.toContain('join "user_onboarding"');
	});

	it("derives country with matching picker, E.164, then dial-list attribution precedence", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildListUsersQueries"](query);
		const listSql = normalizeSql(listQuery.toSQL().sql);
		const pickerIndex = listSql.indexOf(
			`case when upper(btrim("user_onboarding"."answers" ->> 'phone_country'))`,
		);
		const inferredIndex = listSql.indexOf(
			'select "dial_country"."country_code"',
		);
		const attributionIndex = listSql.indexOf(
			'select upper(btrim("user_attributions"."country"))',
		);

		expect(pickerIndex).toBeGreaterThan(-1);
		expect(inferredIndex).toBeGreaterThan(pickerIndex);
		expect(attributionIndex).toBeGreaterThan(inferredIndex);
		// Both picker metadata and attribution must come from the same dial-list
		// vocabulary exposed by the country filter.
		expect(listSql.split("in ('AD', 'AE'")).toHaveLength(3);
		expect(listSql.slice(attributionIndex)).toContain(
			`upper(btrim("user_attributions"."country")) in ('AD', 'AE'`,
		);
		expect(listSql.slice(attributionIndex)).not.toContain(`~ '^[A-Z]{2}$'`);
		expect(listSql).toContain(`from (values ('AD', '376'), ('AE', '971')`);
		expect(listSql).toContain(
			`"picker_country"."country_code" = upper(btrim("user_onboarding"."answers" ->> 'phone_country'))`,
		);
		expect(listSql).toContain(
			`"user_onboarding"."answers" ->> 'phone' like '+' || "picker_country"."dial_code" || '%'`,
		);
		// The picker lookup retains every ISO owner for shared dials.
		expect(listSql).toContain("('CA', '1')");
		expect(listSql).toContain("('FR', '33')");
		expect(listSql).toContain(
			`"user_onboarding"."answers" ->> 'phone' like '+' || "dial_country"."dial_code" || '%'`,
		);
		expect(listSql).toContain(
			`"user_onboarding"."answers" ->> 'phone' ~ '^\\+[1-9][0-9]{7,14}$'`,
		);
		expect(listSql).toContain(
			'order by length("dial_country"."dial_code") desc limit 1',
		);
		// Shared dials use the same conventional owners as countryCodeFromE164.
		expect(listSql).toContain("('1', 'US')");
		expect(listSql).toContain("('212', 'MA')");
		expect(listSql).not.toContain("('1', 'AG')");
		expect(listSql).not.toContain("('212', 'EH')");
		expect(listSql).not.toContain('join "user_onboarding"');
		expect(listSql).not.toContain('join "user_attributions"');

		const afterOuterUser = listSql.split(' from "user"')[1];
		expect(afterOuterUser).not.toContain(" join ");
	});

	it("matches the search term against the onboarding phone with separators stripped", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			q: "+213 661-23",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { listQuery } = repository["buildListUsersQueries"](query);
		const list = listQuery.toSQL();

		expect(normalizeSqlParams(list.sql)).toContain(
			'"user_onboarding"."answers" ->> \'phone\' ilike $?',
		);
		expect(list.params).toContain("%+213 661-23%");
		expect(list.params).toContain("%+21366123%");
	});

	it("ORs selected country codes with unknown and shares the WHERE between count and list", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			country: ["DZ", "US", "unknown"],
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const list = listQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(outerUserWhere(list.sql)).toBe(outerUserWhere(count.sql));
		expect(countSql).toMatch(/\) in \(\$\?, \$\?\) or coalesce\(/);
		expect(countSql).toContain('from "user_attributions"');
		expect(countSql).toContain("is null)");
		expect(count.params).toEqual(["DZ", "US"]);
		const listCountryParamIndex = list.params.indexOf("DZ");
		expect(listCountryParamIndex).toBeGreaterThan(-1);
		expect(
			list.params.slice(listCountryParamIndex, listCountryParamIndex + 2),
		).toEqual(["DZ", "US"]);
	});

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
			'("user"."name" ilike $? or "user"."email" ilike $? or exists (select 1 from "user_onboarding" where "user_onboarding"."user_id" = "user"."id" and "user_onboarding"."answers" ->> \'phone\' ilike $?))',
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
		expect(countSql).toContain(
			"where lower(trim(role_part.value)) = 'support'",
		);
		expect(countSql).toContain('"user"."banned" is not true');
		expect(countSql).toContain('"user"."email_verified" is true');
	});

	it("filters support as a support component without a higher admin component", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			role: ["support"],
			sort: "newest",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			`(${supportRoleExistsSql} and not ${adminRoleExistsSql})`,
		);
	});

	it("filters user as neither an admin nor support stored-role component", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			role: ["user"],
			sort: "newest",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			`(not ${adminRoleExistsSql} and not ${supportRoleExistsSql})`,
		);
	});

	it("ORs admin and support role filters while excluding plain users", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			role: ["admin", "support"],
			sort: "newest",
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			`(${adminRoleExistsSql} or (${supportRoleExistsSql} and not ${adminRoleExistsSql}))`,
		);
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

	const freePlanPredicate =
		'not exists (select 1 from "subscriptions" where "subscriptions"."user_id" = "user"."id" and "subscriptions"."organization_id" is null and "subscriptions"."status" in ($?, $?))';
	const signupFreeCreditsGrantPredicate =
		'exists (select 1 from "credit_ledger" where "credit_ledger"."user_id" = "user"."id" and "credit_ledger"."organization_id" is null and "credit_ledger"."kind" = \'grant\' and "credit_ledger"."bucket" = \'promo\' and "credit_ledger"."idempotency_key" = \'signup:\' || "user"."id")';
	const personalCreditsBalanceExpression =
		'coalesce(( select sum("credit_ledger"."delta") from "credit_ledger" where "credit_ledger"."user_id" = "user"."id" and "credit_ledger"."organization_id" is null ), 0)::int';

	it.each([
		["consumed", "<= 0"],
		["available", "> 0"],
	] as const)("filters standalone for free users with a signup grant whose credits are %s", (state, balanceComparison) => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			freeCredits: [state],
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(outerUserWhere(listQuery.toSQL().sql)).toBe(
			outerUserWhere(count.sql),
		);
		expect(countSql).toContain(freePlanPredicate);
		expect(countSql).toContain(signupFreeCreditsGrantPredicate);
		expect(countSql).toContain(
			`${personalCreditsBalanceExpression} ${balanceComparison}`,
		);
		expect(count.params).toEqual(["active", "trialing"]);
	});

	it("ORs consumed and available balances while retaining free-plan and signup-grant requirements", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			freeCredits: ["consumed", "available"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(countSql).toContain(freePlanPredicate);
		expect(countSql).toContain(signupFreeCreditsGrantPredicate);
		expect(countSql).toContain(
			`(${personalCreditsBalanceExpression} <= 0 or ${personalCreditsBalanceExpression} > 0)`,
		);
		expect(count.params).toEqual(["active", "trialing"]);
	});

	it("treats all values selected in each dimension as no filter", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			plan: ["free", "pro", "business"],
			role: ["user", "support", "admin"],
			status: ["active", "banned"],
			verified: ["verified", "unverified"],
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);
		const listSql = normalizeSqlParams(listQuery.toSQL().sql);

		expect(outerUserWhere(countQuery.toSQL().sql)).toBeUndefined();
		expect(outerUserWhere(listQuery.toSQL().sql)).toBeUndefined();
		expect(countSql).not.toContain(adminRoleExistsSql);
		expect(countSql).not.toContain(supportRoleExistsSql);
		expect(listSql).not.toContain(adminRoleExistsSql);
		expect(listSql).not.toContain(supportRoleExistsSql);
	});

	// Live-site predicates for the publication filter: an active deployment on
	// a non-deleted owned project, plus an active domain for the custom tier.
	const liveDeploymentSubquery =
		'select 1 from "projects" inner join "deployments" on "deployments"."project_id" = "projects"."id" where "projects"."user_id" = "user"."id" and "projects"."deleted_at" is null and "deployments"."status" = \'active\'';
	const liveCustomDomainSubquery =
		'select 1 from "domains" inner join "projects" on "projects"."id" = "domains"."project_id" inner join "deployments" on "deployments"."project_id" = "projects"."id" where "domains"."user_id" = "user"."id" and "domains"."status" = \'active\' and "projects"."deleted_at" is null and "deployments"."status" = \'active\'';

	it("filters unpublished users with NOT EXISTS over live deployments AND live custom domains", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			published: ["unpublished"],
		} satisfies AdminListUsersQuery;
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListUsersQueries"](query);
		const count = countQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);

		expect(outerUserWhere(listQuery.toSQL().sql)).toBe(
			outerUserWhere(count.sql),
		);
		// Both fragments excluded: a user whose only live site is an org
		// project serving THEIR custom domain must not read as unpublished.
		expect(countSql).toContain(
			`(not exists (${liveDeploymentSubquery}) and not exists (${liveCustomDomainSubquery}))`,
		);
	});

	it("filters subdomain users as live sites minus custom domains", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			published: ["subdomain"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			`(exists (${liveDeploymentSubquery}) and not exists (${liveCustomDomainSubquery}))`,
		);
	});

	it("filters custom-domain users with EXISTS over active domains", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			published: ["custom_domain"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(`exists (${liveCustomDomainSubquery})`);
		expect(countSql).not.toContain("not exists");
	});

	it("keeps the three publication states mutually exclusive and exhaustive", () => {
		// unpublished = !LD && !LCD; subdomain = LD && !LCD; custom_domain =
		// LCD. Every (LD, LCD) combination lands in exactly one state.
		const states = (ld: boolean, lcd: boolean) => ({
			unpublished: !ld && !lcd,
			subdomain: ld && !lcd,
			custom_domain: lcd,
		});

		for (const ld of [true, false]) {
			for (const lcd of [true, false]) {
				const matched = Object.values(states(ld, lcd)).filter(Boolean);
				expect(matched).toHaveLength(1);
			}
		}
	});

	it("ORs unpublished with custom_domain inside the publication dimension", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			published: ["unpublished", "custom_domain"],
		} satisfies AdminListUsersQuery;
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const { countQuery } = repository["buildListUsersQueries"](query);
		const countSql = normalizeSqlParams(countQuery.toSQL().sql);

		expect(countSql).toContain(
			`((not exists (${liveDeploymentSubquery}) and not exists (${liveCustomDomainSubquery})) or exists (${liveCustomDomainSubquery}))`,
		);
	});

	it("treats all publication states selected as no publication filter", () => {
		const repository = new AdminRepository(db as Database);
		const query = {
			page: 1,
			pageSize: 25,
			sort: "newest",
			published: ["unpublished", "subdomain", "custom_domain"],
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

describe("AdminRepository publication log queries", () => {
	it("compiles matching count and lateral list queries over lived deployments", () => {
		const repository = new AdminRepository(db as Database);
		const { countQuery, listQuery } =
			// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
			repository["buildListPublicationsQueries"]({ page: 3, pageSize: 20 });
		const count = countQuery.toSQL();
		const list = listQuery.toSQL();
		const countSql = normalizeSqlParams(count.sql);
		const listSql = normalizeSqlParams(list.sql);

		expect(countSql).toContain('select count(*)::int from "deployments"');
		expect(countSql).toContain('"deployments"."status" in ($?, $?, $?)');
		expect(count.params).toEqual(["active", "superseded", "unpublished"]);

		expect(listSql).toContain('inner join "user"');
		expect(listSql).toContain("left join lateral");
		expect(listSql).toContain('from "domains"');
		expect(listSql).toContain('"domains"."is_primary" =');
		expect(listSql).toContain('"domains"."status" =');
		expect(listSql).toContain('"deployments"."status" in ($?, $?, $?)');
		// Soft-deleted projects stay IN the log (deleting never unpublishes,
		// so the owner of a still-serving slug must remain findable).
		expect(listSql).not.toContain('"projects"."deleted_at" is null');
		expect(listSql).toContain(
			'order by "deployments"."created_at" desc, "deployments"."id" desc',
		);
		expect(list.params).toContain("active");
		expect(list.params).toContain("superseded");
		expect(list.params).toContain("unpublished");
		// page 3 of 20 → limit 20, offset 40.
		expect(list.params.slice(-2)).toEqual([20, 40]);
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

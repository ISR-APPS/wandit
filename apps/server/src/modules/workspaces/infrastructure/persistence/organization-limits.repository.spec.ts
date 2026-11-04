import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { OrganizationLimitsRepository } from "./organization-limits.repository";

type SqlQuery = Parameters<PgDialect["sqlToQuery"]>[0];

/** Renders one drizzle SQL chunk as text plus its params. */
function compile(query: unknown) {
	// SAFETY: the chain stub receives real drizzle SQL chunks from the repository.
	const rendered = new PgDialect().sqlToQuery(query as SqlQuery);
	return {
		params: rendered.params,
		sql: rendered.sql.replaceAll(/\s+/g, " ").trim(),
	};
}

/** A select-chain stub: it records the `where` argument and answers one sum row. */
function setup() {
	const wheres: unknown[] = [];
	const chain = {
		select: () => ({
			from: () => ({
				where: async (where: unknown) => {
					wheres.push(where);
					return [{ spent: 0 }];
				},
			}),
		}),
	};
	// SAFETY: `Object.create` yields `any`; the stub answers the select chain
	// of the spend sum, the only call the methods under test make.
	const db = Object.assign(Object.create(null), chain) as Database;
	return { repository: new OrganizationLimitsRepository(db), wheres };
}

describe("OrganizationLimitsRepository.sumPersonalPoolMemberSpendThisMonth", () => {
	const now = new Date("2026-11-15T10:00:00.000Z");
	const monthStart = "2026-11-01T00:00:00.000Z";

	it.each([
		{
			name: "the owner counts only own events that no other pool paid",
			params: ["user_owner", monthStart],
			sql: '("ai_usage_events"."organization_id" is null and "ai_usage_events"."payer_user_id" is null and "ai_usage_events"."user_id" = $1 and "ai_usage_events"."created_at" >= $2)',
			userId: "user_owner",
		},
		{
			name: "a member counts only the events that the owner's pool paid",
			params: ["user_owner", "user_member", monthStart],
			sql: '("ai_usage_events"."organization_id" is null and "ai_usage_events"."payer_user_id" = $1 and "ai_usage_events"."user_id" = $2 and "ai_usage_events"."created_at" >= $3)',
			userId: "user_member",
		},
	])("$name", async ({ userId, sql, params }) => {
		const { repository, wheres } = setup();

		await repository.sumPersonalPoolMemberSpendThisMonth(
			"user_owner",
			userId,
			now,
		);

		const where = compile(wheres[0]);
		expect(where.sql).toBe(sql);
		expect(where.params).toEqual(params);
	});
});

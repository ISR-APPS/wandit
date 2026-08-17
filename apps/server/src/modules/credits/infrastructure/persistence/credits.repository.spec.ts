import { db } from "@wandit/db";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../../infrastructure/database/database.constants";
import { orgOwner, userOwner } from "../../domain/credit-owner";
import { CreditsRepository } from "./credits.repository";

function normalizeSql(value: string): string {
	return value.replaceAll(/\s+/g, " ").trim();
}

describe("CreditsRepository reserved add-back query", () => {
	it("sums reserved usage events for a personal owner with the org-null predicate", () => {
		const repository = new CreditsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildSumReservedQuery"](
			userOwner("user-1"),
		).toSQL();
		const statement = normalizeSql(query.sql);

		expect(statement).toContain('coalesce(sum("reserved_credits"), 0)::int');
		expect(statement).toContain('from "ai_usage_events"');
		expect(statement).toContain('"ai_usage_events"."status" = $1');
		expect(statement).toContain('"ai_usage_events"."user_id" = $2');
		expect(statement).toContain('"ai_usage_events"."organization_id" is null');
		expect(query.params).toEqual(["reserved", "user-1"]);
	});

	it("sums reserved usage events for the org pool regardless of the acting member", () => {
		const repository = new CreditsRepository(db as Database);
		// biome-ignore lint/complexity/useLiteralKeys: bracket access keeps the production query builder private.
		const query = repository["buildSumReservedQuery"](
			orgOwner("org-1"),
		).toSQL();
		const statement = normalizeSql(query.sql);

		expect(statement).toContain('"ai_usage_events"."status" = $1');
		expect(statement).toContain('"ai_usage_events"."organization_id" = $2');
		// The acting member never narrows the org pool's add-back.
		expect(statement).not.toContain('"user_id"');
		expect(query.params).toEqual(["reserved", "org-1"]);
	});
});

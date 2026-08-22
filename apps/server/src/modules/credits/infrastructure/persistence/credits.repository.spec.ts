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

describe("CreditsRepository.getSettledBalanceSnapshot", () => {
	function fakeClient(row: Record<string, unknown>) {
		const executed: unknown[] = [];

		return {
			client: {
				execute: async (query: unknown) => {
					executed.push(query);

					return { rows: [row] };
				},
			} as unknown as Database,
			executed,
		};
	}

	it("returns balance plus the reserved add-back from ONE statement", async () => {
		const repository = new CreditsRepository(db as Database);
		const { client, executed } = fakeClient({
			plan: "10",
			promo: 5,
			reserved: "7",
			topup: -3,
		});

		const snapshot = await repository.getSettledBalanceSnapshot(
			userOwner("user-1"),
			client,
		);

		// Equals getBalance (10 + 5 - 3 = 12) + sumReservedCentiCredits (7).
		expect(snapshot).toEqual({
			balance: 12,
			plan: 10,
			promo: 5,
			settledBalance: 19,
			topup: -3,
		});
		expect(executed).toHaveLength(1);

		const rendered = (
			db as unknown as {
				dialect: {
					sqlToQuery(query: unknown): { params: unknown[]; sql: string };
				};
			}
		).dialect.sqlToQuery(executed[0]);
		const statement = normalizeSql(rendered.sql);

		expect(statement).toContain('from "credit_ledger"');
		expect(statement).toContain('from "ai_usage_events"');
		expect(statement).toContain('"ai_usage_events"."organization_id" is null');
		expect(rendered.params).toContain("user-1");
	});

	it("treats a missing row as an empty ledger", async () => {
		const repository = new CreditsRepository(db as Database);
		const client = {
			execute: async () => ({ rows: [] }),
		} as unknown as Database;

		await expect(
			repository.getSettledBalanceSnapshot(orgOwner("org-1"), client),
		).resolves.toEqual({
			balance: 0,
			plan: 0,
			promo: 0,
			settledBalance: 0,
			topup: 0,
		});
	});
});

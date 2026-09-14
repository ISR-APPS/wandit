import { PgDialect } from "@wandit/db";
import { describe, expect, it, vi } from "vitest";

import { OnboardingRepository } from "./onboarding.repository";

type SqlCondition = Parameters<PgDialect["sqlToQuery"]>[0];

function compileCondition(condition: SqlCondition | undefined) {
	if (!condition) {
		throw new Error("Expected a Drizzle SQL condition");
	}

	const { params, sql } = new PgDialect().sqlToQuery(condition);

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
}

function setup(rows: { userId: string }[]) {
	const limit = vi.fn(async () => rows);
	const where = vi.fn((_condition: SqlCondition) => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	// SAFETY: isPhoneUsedByOtherUser only calls select().from().where().limit() on the database.
	const repository = new OnboardingRepository({ select } as never);

	return { limit, repository, where };
}

describe("OnboardingRepository.isPhoneUsedByOtherUser", () => {
	it("matches the phone answer on every row except the caller's own", async () => {
		const { limit, repository, where } = setup([]);

		await expect(
			repository.isPhoneUsedByOtherUser("+213661223344", "user_1"),
		).resolves.toBe(false);

		const condition = compileCondition(where.mock.calls[0]?.[0]);
		expect(condition.sql).toContain(
			`"user_onboarding"."answers" ->> 'phone' = $1`,
		);
		expect(condition.sql).toContain(`"user_onboarding"."user_id" <> $2`);
		expect(condition.params).toEqual(["+213661223344", "user_1"]);
		expect(limit).toHaveBeenCalledWith(1);
	});

	it("is true when another user's row holds the phone", async () => {
		const { repository } = setup([{ userId: "user_2" }]);

		await expect(
			repository.isPhoneUsedByOtherUser("+213661223344", "user_1"),
		).resolves.toBe(true);
	});
});

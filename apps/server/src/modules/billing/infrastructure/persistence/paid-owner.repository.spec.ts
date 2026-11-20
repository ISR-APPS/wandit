import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import { userOwner } from "../../../credits/domain/credit-owner";
import { paidOwnerCondition } from "./paid-owner.repository";

// No test database exists, so the cases read the rendered SQL of the rule.
function render(owner: Parameters<typeof paidOwnerCondition>[0]) {
	const query = new PgDialect().sqlToQuery(paidOwnerCondition(owner));
	return { sql: query.sql.replace(/\s+/gu, " ") };
}

describe("paidOwnerCondition", () => {
	it("does not make a team buyer a personal paid owner", () => {
		const { sql } = render(userOwner("buyer_1"));

		// A team row holds its buyer in `user_id`; both halves need the personal pin.
		expect(sql).toContain('"subscriptions"."organization_id" is null');
		expect(sql).toContain('"credit_ledger"."organization_id" is null');
	});
});

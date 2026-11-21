import {
	creditsToCentiCredits,
	STARTER_PASS_USD,
	TOPUP_MIN_AMOUNT_USD,
	topupCreditsForUsd,
} from "@wandit/contracts";
import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import { userOwner } from "../../../credits/domain/credit-owner";
import { paidOwnerCondition } from "./paid-owner.repository";

// No test database exists, so the cases read the rendered SQL of the rule.
function render(owner: Parameters<typeof paidOwnerCondition>[0]) {
	const query = new PgDialect().sqlToQuery(paidOwnerCondition(owner));
	return { params: query.params, sql: query.sql.replace(/\s+/gu, " ") };
}

describe("paidOwnerCondition", () => {
	it("does not make a team buyer a personal paid owner", () => {
		const { sql } = render(userOwner("buyer_1"));

		// A team row holds its buyer in `user_id`; both halves need the personal pin.
		expect(sql).toContain('"subscriptions"."organization_id" is null');
		expect(sql).toContain('"credit_ledger"."organization_id" is null');
	});

	it("needs a top-up of 100 credits or more, so the 1 USD Starter pass is not a paid owner", () => {
		const { params, sql } = render(userOwner("payer_1"));

		const index = Number(
			sql.match(/"credit_ledger"\."delta" >= \$(\d+)/u)?.[1],
		);
		const threshold = params[index - 1];

		// The ledger row of a top-up holds its credits in centi-credits.
		expect(threshold).toBeGreaterThan(
			creditsToCentiCredits(topupCreditsForUsd(STARTER_PASS_USD)),
		);
		expect(threshold).toBeLessThanOrEqual(
			creditsToCentiCredits(topupCreditsForUsd(TOPUP_MIN_AMOUNT_USD)),
		);
	});
});

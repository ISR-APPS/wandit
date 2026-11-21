import { STARTER_PASS_USD, TOPUP_MIN_AMOUNT_USD } from "@wandit/contracts";
import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import { receiptReachesTopupMinimum } from "./user-referrals.repository";

// No test database exists, so the case reads the rendered SQL of the rule.
describe("receiptReachesTopupMinimum", () => {
	it("counts a receipt only from 10 USD, so a 1 USD Starter pass earns no paid reward", () => {
		const query = new PgDialect().sqlToQuery(receiptReachesTopupMinimum);
		const statement = query.sql.replace(/\s+/gu, " ");
		const index = Number(
			statement.match(
				/coalesce\( "billing_topup_receipts"\."amount_usd_cents", case when "billing_topup_receipts"\."currency" = 'usd' then "billing_topup_receipts"\."amount_cents" end \) >= \$(\d+)/u,
			)?.[1],
		);
		const thresholdUsdCents = query.params[index - 1];

		expect(thresholdUsdCents).toBeGreaterThan(STARTER_PASS_USD * 100);
		expect(thresholdUsdCents).toBeLessThanOrEqual(TOPUP_MIN_AMOUNT_USD * 100);
	});
});

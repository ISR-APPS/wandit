import { PgDialect } from "@wandit/db";
import { describe, expect, it } from "vitest";

import { passMoveCandidateCondition } from "./starter-passes.repository";

// No test database exists, so the case reads the rendered SQL of the rule.
function render(receipt: Parameters<typeof passMoveCandidateCondition>[0]) {
	const condition = passMoveCandidateCondition(receipt);
	if (!condition) {
		throw new Error("passMoveCandidateCondition returned no SQL");
	}
	const query = new PgDialect().sqlToQuery(condition);
	return { params: query.params, sql: query.sql.replace(/\s+/gu, " ") };
}

describe("passMoveCandidateCondition", () => {
	it.each([
		{
			// Without the organization_id pin, a personal pass moves onto a team receipt of the same buyer.
			name: "a personal receipt stays in the personal pool",
			receipt: { id: "receipt_lost", organizationId: null, userId: "buyer_1" },
			poolSql: [
				'"billing_topup_receipts"."user_id" = $',
				'"billing_topup_receipts"."organization_id" is null',
				'"credit_ledger"."organization_id" is null',
			],
			absentSql: ['"billing_topup_receipts"."organization_id" = $'],
			poolParam: "buyer_1",
		},
		{
			// A team receipt holds its buyer in user_id. The buyer's personal receipts must not match.
			name: "a team receipt stays in the team pool, not the buyer's",
			receipt: {
				id: "receipt_lost",
				organizationId: "org_1",
				userId: "buyer_1",
			},
			poolSql: [
				'"billing_topup_receipts"."organization_id" = $',
				'"credit_ledger"."organization_id" = $',
			],
			absentSql: ['"billing_topup_receipts"."user_id"'],
			poolParam: "org_1",
		},
	])("$name, and keeps only live receipts", ({
		absentSql,
		poolParam,
		poolSql,
		receipt,
	}) => {
		const { params, sql } = render(receipt);

		for (const fragment of poolSql) {
			expect(sql).toContain(fragment);
		}
		for (const fragment of absentSql) {
			expect(sql).not.toContain(fragment);
		}
		expect(params).toContain(poolParam);
		expect(params).toContain("receipt_lost");
		if (receipt.organizationId) {
			expect(params).not.toContain(receipt.userId);
		}

		// Not the lost receipt itself, not reversed, never the source of a revoked pass.
		expect(sql).toContain('"billing_topup_receipts"."id" <> $');
		expect(sql).toContain('"billing_topup_receipts"."reversed_at" is null');
		expect(sql).toMatch(
			/not exists \( select 1 from "starter_passes" where "starter_passes"\."receipt_id" = "billing_topup_receipts"\."id" and "starter_passes"\."revoked_at" is not null \)/u,
		);
		// No refund or dispute revoke row on the same charge.
		expect(sql).toMatch(
			/"credit_ledger"\."kind" = 'revoke' and \("credit_ledger"\."meta" ->> 'chargeId'\) = "billing_topup_receipts"\."charge_id"/u,
		);
	});
});

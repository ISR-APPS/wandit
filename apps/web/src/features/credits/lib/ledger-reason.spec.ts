import { describe, expect, it } from "vitest";

import { isLedgerAdjustmentReason, ledgerReasonKey } from "./ledger-reason";

describe("ledgerReasonKey", () => {
	it("maps metering reasons to label keys", () => {
		expect(ledgerReasonKey({ reason: "ai_usage_reconcile" })).toBe("reconcile");
		expect(ledgerReasonKey({ reason: "ai_usage_reconcile_refund" })).toBe(
			"reconcileRefund",
		);
		expect(ledgerReasonKey({ reason: "ai_usage_settle_refund" })).toBe(
			"settleRefund",
		);
		expect(ledgerReasonKey({ reason: "ai_usage_fixed_completion" })).toBe(
			"fixedCompletion",
		);
		expect(ledgerReasonKey({ reason: "ai_usage_reserve" })).toBe("reserve");
		expect(ledgerReasonKey({ reason: "ai_usage_settle" })).toBe("settle");
		expect(ledgerReasonKey({ reason: "lead_scrape_failed" })).toBe(null);
	});

	it("tolerates missing or malformed meta", () => {
		expect(ledgerReasonKey(null)).toBe(null);
		expect(ledgerReasonKey(undefined)).toBe(null);
		expect(ledgerReasonKey({})).toBe(null);
		expect(ledgerReasonKey({ reason: 42 })).toBe(null);
	});

	it("flags only post-settlement adjustments for a secondary label", () => {
		expect(isLedgerAdjustmentReason("reconcile")).toBe(true);
		expect(isLedgerAdjustmentReason("reconcileRefund")).toBe(true);
		expect(isLedgerAdjustmentReason("settleRefund")).toBe(true);
		expect(isLedgerAdjustmentReason("fixedCompletion")).toBe(true);
		expect(isLedgerAdjustmentReason("refund")).toBe(true);
		expect(isLedgerAdjustmentReason("reserve")).toBe(false);
		expect(isLedgerAdjustmentReason("settle")).toBe(false);
		expect(isLedgerAdjustmentReason(null)).toBe(false);
	});
});

import { describe, expect, it } from "vitest";

import {
	assertProviderCallEvidenceCost,
	assertProviderCallEvidenceInput,
	canUpgradeProviderCallCostStatus,
	higgsfieldEvidenceKey,
	mcpEvidenceKey,
	serperEvidenceKey,
	sumProviderCallEvidenceUsdMicros,
} from "./provider-call-evidence";

describe("provider call evidence", () => {
	it("builds stable idempotency keys per transport", () => {
		expect(serperEvidenceKey("attempt-1")).toBe("serper:attempt-1");
		expect(higgsfieldEvidenceKey("attempt-1", "job-9")).toBe(
			"higgsfield:attempt-1:job-9",
		);
		expect(higgsfieldEvidenceKey("attempt-1", null)).toBe(
			"higgsfield:attempt-1:submit",
		);
		expect(mcpEvidenceKey("ref-1", null)).toBe("mcp:ref-1:submit");
	});

	it("only upgrades the cost status", () => {
		expect(canUpgradeProviderCallCostStatus("pending", "estimated")).toBe(true);
		expect(canUpgradeProviderCallCostStatus("pending", "measured")).toBe(true);
		expect(canUpgradeProviderCallCostStatus("estimated", "contract_rate")).toBe(
			true,
		);
		expect(canUpgradeProviderCallCostStatus("contract_rate", "measured")).toBe(
			true,
		);
		expect(canUpgradeProviderCallCostStatus("measured", "measured")).toBe(true);
		expect(canUpgradeProviderCallCostStatus("measured", "estimated")).toBe(
			false,
		);
		expect(canUpgradeProviderCallCostStatus("contract_rate", "pending")).toBe(
			false,
		);
	});

	it("validates inputs", () => {
		expect(() =>
			assertProviderCallEvidenceInput({
				costStatus: "pending",
				customerBillable: false,
				idempotencyKey: "serper:a",
				transport: "serper",
				unitKind: "search_page",
				units: 1,
			}),
		).not.toThrow();
		expect(() =>
			assertProviderCallEvidenceInput({
				costStatus: "measured",
				customerBillable: false,
				idempotencyKey: "serper:a",
				transport: "serper",
				unitKind: "search_page",
				units: 1,
			}),
		).toThrow("needs a charged cost");
		expect(() =>
			assertProviderCallEvidenceInput({
				chargedUsdMicros: 1,
				costStatus: "measured",
				customerBillable: false,
				idempotencyKey: "serper:a",
				transport: "serper",
				unitKind: "search_page",
				units: 0,
			}),
		).toThrow("positive integer");
		expect(() =>
			assertProviderCallEvidenceCost({
				chargedUsdMicros: -1,
				costStatus: "measured",
			}),
		).toThrow("non-negative integer");
	});

	it("sums known charges, optionally customer-billable only", () => {
		const rows = [
			{ chargedUsdMicros: 1_000, customerBillable: false },
			{ chargedUsdMicros: 2_000, customerBillable: true },
			{ chargedUsdMicros: null, customerBillable: true },
		];

		expect(sumProviderCallEvidenceUsdMicros(rows)).toBe(3_000);
		expect(
			sumProviderCallEvidenceUsdMicros(rows, { customerBillableOnly: true }),
		).toBe(2_000);
	});
});

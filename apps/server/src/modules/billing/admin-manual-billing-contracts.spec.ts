import {
	adminManualBillingReceiptConfigSchema,
	adminRoutes,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

describe("admin manual billing receipt config contract", () => {
	it("accepts a decimal DZD per USD rate", () => {
		expect(
			adminManualBillingReceiptConfigSchema.parse({ dzdPerUsdRate: 271.25 }),
		).toEqual({ dzdPerUsdRate: 271.25 });
	});

	it.each([
		0, -1, 271.234, 10_000.01,
	])("rejects an invalid DZD per USD rate of %s", (dzdPerUsdRate) => {
		expect(
			adminManualBillingReceiptConfigSchema.safeParse({ dzdPerUsdRate })
				.success,
		).toBe(false);
	});

	it("exports the receipt config API route", () => {
		expect(adminRoutes.manualBillingReceiptConfig).toBe(
			"/api/v1/admin/manual-billing/receipt-config",
		);
	});
});

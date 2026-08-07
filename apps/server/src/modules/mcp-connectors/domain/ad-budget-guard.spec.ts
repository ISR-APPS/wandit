import { describe, expect, it } from "vitest";

import {
	AdBudgetCurrencyError,
	assertUsdAdBudgetArgs,
} from "./ad-budget-guard";

describe("assertUsdAdBudgetArgs", () => {
	it("lets plain numeric budgets through", () => {
		expect(() =>
			assertUsdAdBudgetArgs("meta-ads", {
				params: { objective: "SALES", budget: 50 },
			}),
		).not.toThrow();
	});

	it("lets an explicit USD currency field through", () => {
		expect(() =>
			assertUsdAdBudgetArgs("tiktok-ads", {
				params: { daily_budget: 20, budget_currency: "USD" },
			}),
		).not.toThrow();
	});

	it.each([
		"3000 DA",
		"3000 DZD",
		"3000 دج",
		"3000 دينار",
		"3000 dinars",
	])("rejects a dinar-denominated budget string (%s)", (value) => {
		expect(() =>
			assertUsdAdBudgetArgs("meta-ads", { params: { budget: value } }),
		).toThrow(AdBudgetCurrencyError);
	});

	it("rejects a non-USD currency field", () => {
		expect(() =>
			assertUsdAdBudgetArgs("tiktok-ads", {
				params: { daily_budget: 20, currency: "DZD" },
			}),
		).toThrow(/must be in USD/);
	});

	it("reaches money fields nested under run_platform_tool params", () => {
		expect(() =>
			assertUsdAdBudgetArgs("meta-ads", {
				connector: "meta-ads",
				tool_name: "ads_create_campaign",
				params: { campaign: { lifetime_budget: "500 DZD" } },
			}),
		).toThrow(AdBudgetCurrencyError);
	});

	it("checks entries inside arrays (ad sets)", () => {
		expect(() =>
			assertUsdAdBudgetArgs("tiktok-ads", {
				params: { adgroups: [{ budget: "1000 دج" }] },
			}),
		).toThrow(AdBudgetCurrencyError);
	});

	it("ignores non-ad connectors entirely", () => {
		expect(() =>
			assertUsdAdBudgetArgs("higgsfield", {
				params: { budget: "3000 DZD" },
			}),
		).not.toThrow();
	});

	it("does not confuse ordinary words containing 'da'", () => {
		expect(() =>
			assertUsdAdBudgetArgs("meta-ads", {
				params: {
					budget_note: "spend on sunday, adapt daily",
					budget: 30,
				},
			}),
		).not.toThrow();
	});

	it("never converts — the error tells the model to re-ask in USD", () => {
		try {
			assertUsdAdBudgetArgs("meta-ads", { params: { budget: "3000 DA" } });
			expect.unreachable("guard should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(AdBudgetCurrencyError);
			expect((error as Error).message).toContain("US dollars");
			expect((error as Error).message).not.toContain("convert it to");
		}
	});
});

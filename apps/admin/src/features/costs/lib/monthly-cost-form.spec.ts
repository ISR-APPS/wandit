import { describe, expect, it } from "vitest";

import {
	centsToDollarInput,
	monthlyCostFormSchema,
	monthlyCostFormValuesFromEntry,
	toMonthlyCostUpdateRequest,
} from "./monthly-cost-form";

const validValues = {
	month: "2026-07",
	currency: "usd",
	sourceRows: [
		{ id: "source-1", source: " Google ", dollars: "123.45" },
		{ id: "source-2", source: "META", dollars: "80" },
	],
	infrastructureDollars: "420.09",
	otherDollars: "15.5",
	notes: "  July close  ",
};

describe("monthly cost form mapping", () => {
	it("normalizes source rows and converts dollar strings to integer cents", () => {
		const result = monthlyCostFormSchema.safeParse(validValues);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}

		expect(result.data).toEqual({
			month: "2026-07",
			currency: "usd",
			adSpendBySourceCents: { google: 12_345, meta: 8_000 },
			infrastructureCostCents: 42_009,
			otherCostCents: 1_550,
			notes: "July close",
		});
	});

	it("round-trips cents into editable dollar values", () => {
		expect(centsToDollarInput(0)).toBe("0.00");
		expect(centsToDollarInput(5)).toBe("0.05");
		expect(centsToDollarInput(12_345)).toBe("123.45");

		expect(
			monthlyCostFormValuesFromEntry({
				month: "2026-07",
				currency: "usd",
				adSpendBySourceCents: { google: 12_345 },
				infrastructureCostCents: 42_009,
				otherCostCents: 1_550,
				notes: null,
				totalAdSpendCents: 12_345,
				totalCostCents: 55_904,
				version: 3,
				updatedAt: "2026-08-15T12:00:00.000Z",
			}),
		).toMatchObject({
			month: "2026-07",
			sourceRows: [{ source: "google", dollars: "123.45" }],
			infrastructureDollars: "420.09",
			otherDollars: "15.50",
			notes: "",
		});
	});

	it("rejects duplicate normalized sources and fractional cents", () => {
		const duplicateResult = monthlyCostFormSchema.safeParse({
			...validValues,
			sourceRows: [
				{ id: "source-1", source: "Meta", dollars: "10" },
				{ id: "source-2", source: " meta ", dollars: "20" },
			],
		});
		const fractionalResult = monthlyCostFormSchema.safeParse({
			...validValues,
			otherDollars: "1.001",
		});

		expect(duplicateResult.success).toBe(false);
		expect(fractionalResult.success).toBe(false);
	});

	it("adds the current version to the PATCH contract", () => {
		const createResult = monthlyCostFormSchema.safeParse(validValues);
		expect(createResult.success).toBe(true);
		if (!createResult.success) {
			return;
		}

		const updateResult = toMonthlyCostUpdateRequest(createResult.data, 7);
		expect(updateResult.success).toBe(true);
		if (!updateResult.success) {
			return;
		}

		expect(updateResult.data).toMatchObject({
			version: 7,
			adSpendBySourceCents: { google: 12_345, meta: 8_000 },
		});
		expect(updateResult.data).not.toHaveProperty("month");
	});
});

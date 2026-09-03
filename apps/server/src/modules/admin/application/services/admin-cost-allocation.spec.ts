import { describe, expect, it } from "vitest";

import { prorateMonthlyCosts } from "./admin-cost-allocation";

describe("prorateMonthlyCosts", () => {
	it("prorates every category and source by overlapping UTC calendar days", () => {
		const allocation = prorateMonthlyCosts(
			[
				{
					month: "2026-01-01",
					adSpendBySourceCents: { Meta: 3_100, google: 6_200 },
					infrastructureCostCents: 9_300,
					otherCostCents: 12_400,
				},
				{
					month: "2026-02-01",
					adSpendBySourceCents: { meta: 2_800 },
					infrastructureCostCents: 5_600,
					otherCostCents: 8_400,
				},
			],
			new Date("2026-01-16T00:00:00.000Z"),
			new Date("2026-02-15T00:00:00.000Z"),
		);

		expect(allocation).toEqual({
			adSpendBySourceCents: { meta: 3_000, google: 3_200 },
			adSpendCents: 6_200,
			costCoverageComplete: true,
			infrastructureCostCents: 7_600,
			otherCostCents: 10_600,
			totalCostCents: 24_400,
		});
	});

	it("counts a partially elapsed UTC day as an overlapping calendar day", () => {
		const allocation = prorateMonthlyCosts(
			[
				{
					month: "2026-08-01",
					adSpendBySourceCents: { direct: 3_100 },
					infrastructureCostCents: 0,
					otherCostCents: 0,
				},
			],
			new Date("2026-08-10T00:00:00.000Z"),
			new Date("2026-08-15T10:20:30.000Z"),
		);

		expect(allocation.adSpendCents).toBe(600);
		expect(allocation.adSpendBySourceCents).toEqual({ direct: 600 });
	});

	it("reports incomplete coverage when any intersecting month is absent", () => {
		expect(
			prorateMonthlyCosts(
				[
					{
						month: "2026-01-01",
						adSpendBySourceCents: { direct: 100 },
						infrastructureCostCents: 100,
						otherCostCents: 100,
					},
				],
				new Date("2026-01-01T00:00:00.000Z"),
				new Date("2026-03-01T00:00:00.000Z"),
			),
		).toEqual({
			adSpendBySourceCents: {},
			adSpendCents: 0,
			costCoverageComplete: false,
			infrastructureCostCents: 0,
			otherCostCents: 0,
			totalCostCents: 0,
		});
	});
});

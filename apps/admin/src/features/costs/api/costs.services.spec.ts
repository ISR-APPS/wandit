import { adminCostsRoutes } from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

import {
	createMonthlyCost,
	deleteMonthlyCost,
	listMonthlyCosts,
	updateMonthlyCost,
} from "./costs.services";

vi.mock("@/lib/api-client", () => ({
	apiDelete: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiPost: vi.fn(),
}));

const apiDeleteMock = vi.mocked(apiDelete);
const apiGetMock = vi.mocked(apiGet);
const apiPatchMock = vi.mocked(apiPatch);
const apiPostMock = vi.mocked(apiPost);

const monthlyCost = {
	month: "2026-07",
	currency: "usd",
	adSpendBySourceCents: { google: 12_345, meta: 8_000 },
	infrastructureCostCents: 42_000,
	otherCostCents: 1_500,
	notes: "July close",
	totalAdSpendCents: 20_345,
	totalCostCents: 63_845,
	version: 3,
	updatedAt: "2026-08-15T12:00:00.000Z",
};

afterEach(() => {
	vi.clearAllMocks();
});

describe("monthly costs services", () => {
	it("lists monthly costs through the contract and forwards a validated range", async () => {
		apiGetMock.mockResolvedValueOnce({ months: [monthlyCost] });

		await expect(
			listMonthlyCosts({ fromMonth: "2025-08", toMonth: "2026-07" }),
		).resolves.toEqual({ months: [monthlyCost] });
		expect(apiGetMock).toHaveBeenCalledWith(adminCostsRoutes.collection, {
			fromMonth: "2025-08",
			toMonth: "2026-07",
		});
	});

	it("creates a monthly cost with integer cents and parses the single response", async () => {
		const input = {
			month: "2026-07",
			currency: "usd",
			adSpendBySourceCents: { google: 12_345, meta: 8_000 },
			infrastructureCostCents: 42_000,
			otherCostCents: 1_500,
			notes: "July close",
		};
		apiPostMock.mockResolvedValueOnce({ month: monthlyCost });

		await expect(createMonthlyCost(input)).resolves.toEqual(monthlyCost);
		expect(apiPostMock).toHaveBeenCalledWith(
			adminCostsRoutes.collection,
			input,
		);
	});

	it("patches the month with its optimistic-concurrency version", async () => {
		const data = {
			version: 3,
			adSpendBySourceCents: { google: 13_000 },
			notes: null,
		};
		apiPatchMock.mockResolvedValueOnce({
			month: {
				...monthlyCost,
				adSpendBySourceCents: data.adSpendBySourceCents,
				notes: null,
				totalAdSpendCents: 13_000,
				totalCostCents: 56_500,
				version: 4,
			},
		});

		await expect(
			updateMonthlyCost({ month: "2026-07", data }),
		).resolves.toMatchObject({ version: 4, notes: null });
		expect(apiPatchMock).toHaveBeenCalledWith(
			adminCostsRoutes.month("2026-07"),
			data,
		);
	});

	it("validates the month key before deleting it", async () => {
		apiDeleteMock.mockResolvedValueOnce(undefined);

		await expect(deleteMonthlyCost("2026-07")).resolves.toBeUndefined();
		expect(apiDeleteMock).toHaveBeenCalledWith(
			adminCostsRoutes.month("2026-07"),
		);

		await expect(deleteMonthlyCost("2026-7")).rejects.toThrow();
		expect(apiDeleteMock).toHaveBeenCalledTimes(1);
	});

	it("rejects malformed list and single-resource responses", async () => {
		apiGetMock.mockResolvedValueOnce({
			months: [{ ...monthlyCost, totalCostCents: -1 }],
		});
		apiPostMock.mockResolvedValueOnce({
			month: { ...monthlyCost, updatedAt: "yesterday" },
		});

		await expect(listMonthlyCosts()).rejects.toThrow();
		await expect(
			createMonthlyCost({
				month: "2026-07",
				currency: "usd",
				adSpendBySourceCents: {},
				infrastructureCostCents: 0,
				otherCostCents: 0,
				notes: null,
			}),
		).rejects.toThrow();
	});
});

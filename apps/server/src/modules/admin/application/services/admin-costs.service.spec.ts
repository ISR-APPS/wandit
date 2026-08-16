import { ConflictException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AdminCostsRepository,
	AdminMonthlyCostRow,
} from "../../infrastructure/persistence/admin-costs.repository";
import { AdminCostsService } from "./admin-costs.service";

const NOW = new Date("2026-08-16T10:20:30.000Z");

function row(
	overrides: Partial<AdminMonthlyCostRow> = {},
): AdminMonthlyCostRow {
	return {
		month: "2026-08-01",
		currency: "usd",
		adSpendBySourceCents: { meta: 1_000, google: 500 },
		infrastructureCostCents: 2_000,
		otherCostCents: 300,
		notes: null,
		version: 1,
		createdByUserId: "admin-1",
		updatedByUserId: "admin-1",
		createdAt: new Date("2026-08-01T00:00:00.000Z"),
		updatedAt: new Date("2026-08-16T10:00:00.000Z"),
		...overrides,
	};
}

function setup() {
	const repository = {
		list: vi.fn().mockResolvedValue([row()]),
		create: vi.fn().mockResolvedValue(row()),
		updateIfVersion: vi.fn().mockResolvedValue(row({ version: 2 })),
		delete: vi.fn().mockResolvedValue(undefined),
	};
	const service = new AdminCostsService(
		repository as unknown as AdminCostsRepository,
	);

	return { repository, service };
}

describe("AdminCostsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("defaults the list to the latest twelve UTC calendar months and derives totals", async () => {
		const { repository, service } = setup();

		expect(await service.list({})).toEqual({
			months: [
				expect.objectContaining({
					month: "2026-08",
					totalAdSpendCents: 1_500,
					totalCostCents: 3_800,
					updatedAt: "2026-08-16T10:00:00.000Z",
				}),
			],
		});
		expect(repository.list).toHaveBeenCalledWith("2025-09-01", "2026-08-01");
	});

	it("normalizes currency/source keys and combines colliding source spend", async () => {
		const { repository, service } = setup();

		await service.create("admin-1", {
			month: "2026-08",
			currency: " USD ",
			adSpendBySourceCents: { " Meta ": 700, meta: 300 },
			infrastructureCostCents: 2_000,
			otherCostCents: 300,
			notes: null,
		});

		expect(repository.create).toHaveBeenCalledWith({
			month: "2026-08-01",
			currency: "usd",
			adSpendBySourceCents: { meta: 1_000 },
			infrastructureCostCents: 2_000,
			otherCostCents: 300,
			notes: null,
			adminUserId: "admin-1",
		});
	});

	it("returns HTTP 409 for duplicate months and optimistic version conflicts", async () => {
		const { repository, service } = setup();
		repository.create.mockResolvedValueOnce(null);

		await expect(
			service.create("admin-1", {
				month: "2026-08",
				currency: "usd",
				adSpendBySourceCents: {},
				infrastructureCostCents: 0,
				otherCostCents: 0,
				notes: null,
			}),
		).rejects.toBeInstanceOf(ConflictException);

		repository.updateIfVersion.mockResolvedValueOnce(null);
		await expect(
			service.update("admin-1", "2026-08", {
				version: 4,
				notes: "changed",
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("maps YYYY-MM to the date PK for updates and deletes", async () => {
		const { repository, service } = setup();

		await service.update("admin-2", "2026-08", {
			version: 1,
			otherCostCents: 500,
		});
		await service.delete("2026-08");

		expect(repository.updateIfVersion).toHaveBeenCalledWith({
			month: "2026-08-01",
			expectedVersion: 1,
			updatedByUserId: "admin-2",
			changes: { otherCostCents: 500 },
		});
		expect(repository.delete).toHaveBeenCalledWith("2026-08-01");
	});
});

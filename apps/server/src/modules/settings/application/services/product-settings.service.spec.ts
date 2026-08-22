import { ConflictException } from "@nestjs/common";
import {
	type PatchProductSettingsBody,
	patchProductSettingsBodySchema,
} from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/product-settings.constants";
import type {
	ProductSettingsRepository,
	ProductSettingsRow,
	UpdateProductSettingsInput,
} from "../../infrastructure/persistence/product-settings.repository";
import { ProductSettingsService } from "./product-settings.service";

const INITIAL_DATE = new Date("2026-08-01T10:00:00.000Z");

function defaultRow(
	overrides: Partial<ProductSettingsRow> = {},
): ProductSettingsRow {
	return {
		...DEFAULT_PRODUCT_SETTINGS,
		// Legacy DB column: still on the row, no longer a product setting.
		earlyAccessRequired: false,
		updatedAt: INITIAL_DATE,
		updatedByUserId: null,
		...overrides,
	};
}

class FakeProductSettingsRepository {
	row: ProductSettingsRow | null = null;

	getOrCreate = vi.fn(async () => {
		this.row ??= defaultRow();
		return this.row;
	});

	updateIfVersion = vi.fn(async (input: UpdateProductSettingsInput) => {
		this.row ??= defaultRow();

		if (this.row.version !== input.expectedVersion) {
			return null;
		}

		this.row = {
			...this.row,
			...input.changes,
			updatedAt: new Date(),
			updatedByUserId: input.updatedByUserId,
			version: this.row.version + 1,
		};

		return this.row;
	});
}

function setup() {
	const repository = new FakeProductSettingsRepository();
	const service = new ProductSettingsService(
		repository as unknown as ProductSettingsRepository,
	);

	return { repository, service };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("ProductSettingsService", () => {
	it.each([
		0, 30,
	])("accepts a manual grace period of %i days", (manualGraceDays) => {
		expect(
			patchProductSettingsBodySchema.parse({ manualGraceDays, version: 1 }),
		).toEqual({ manualGraceDays, version: 1 });
	});

	it.each([
		-1, 31, 1.5,
	])("rejects an invalid manual grace period of %s days", (manualGraceDays) => {
		expect(() =>
			patchProductSettingsBodySchema.parse({ manualGraceDays, version: 1 }),
		).toThrow();
	});

	it("creates and returns the singleton with launch defaults", async () => {
		const { repository, service } = setup();

		await expect(service.get()).resolves.toEqual({
			emailAuthEnabled: false,
			id: 1,
			manualGraceDays: 0,
			manualPaymentsEnabled: false,
			organizationsEnabled: false,
			paidSubscriptionsEnabled: false,
			// Stored (and internally served) as centi-credits: 5000 = 50 credits.
			signupGrantCredits: 5000,
			signupGrantEnabled: false,
			topupsEnabled: false,
			updatedAt: INITIAL_DATE.toISOString(),
			updatedByUserId: null,
			version: 1,
		});
		expect(repository.getOrCreate).toHaveBeenCalledTimes(1);
	});

	it("serves the singleton from cache for 30 seconds and refreshes after expiry", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(INITIAL_DATE);
		const { repository, service } = setup();

		const first = await service.get();
		repository.row = defaultRow({ paidSubscriptionsEnabled: true, version: 2 });

		vi.advanceTimersByTime(29_999);
		await expect(service.get()).resolves.toBe(first);
		expect(repository.getOrCreate).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(2);
		await expect(service.get()).resolves.toMatchObject({
			paidSubscriptionsEnabled: true,
			version: 2,
		});
		expect(repository.getOrCreate).toHaveBeenCalledTimes(2);
	});

	it("passes grace changes through, bumps the version, and invalidates the cache", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(INITIAL_DATE);
		const { repository, service } = setup();
		await service.get();

		const input: PatchProductSettingsBody = {
			manualGraceDays: 3,
			version: 1,
		};
		await expect(service.update(input, "admin_1")).resolves.toMatchObject({
			manualGraceDays: 3,
			updatedByUserId: "admin_1",
			version: 2,
		});
		expect(repository.updateIfVersion).toHaveBeenCalledWith({
			changes: { manualGraceDays: 3 },
			expectedVersion: 1,
			updatedByUserId: "admin_1",
		});

		await service.get();
		expect(repository.getOrCreate).toHaveBeenCalledTimes(2);
	});

	it("does not let an in-flight stale read overwrite write invalidation", async () => {
		const { repository, service } = setup();
		const staleRow = defaultRow();
		repository.row = staleRow;
		let resolveRead!: (row: ProductSettingsRow) => void;
		repository.getOrCreate.mockImplementationOnce(
			() =>
				new Promise<ProductSettingsRow>((resolve) => {
					resolveRead = resolve;
				}),
		);

		const staleRead = service.get();
		await service.update(
			{ paidSubscriptionsEnabled: true, version: 1 },
			"admin_1",
		);
		resolveRead(staleRow);

		await expect(staleRead).resolves.toMatchObject({ version: 1 });
		await expect(service.get()).resolves.toMatchObject({
			paidSubscriptionsEnabled: true,
			version: 2,
		});
		expect(repository.getOrCreate).toHaveBeenCalledTimes(2);
	});

	it("rejects a stale version and clears its stale cached value", async () => {
		const { repository, service } = setup();
		repository.row = defaultRow({ version: 2 });
		await service.get();
		repository.row = defaultRow({ signupGrantEnabled: true, version: 3 });

		await expect(
			service.update({ topupsEnabled: true, version: 1 }, "admin_1"),
		).rejects.toBeInstanceOf(ConflictException);

		await expect(service.get()).resolves.toMatchObject({
			signupGrantEnabled: true,
			version: 3,
		});
		expect(repository.getOrCreate).toHaveBeenCalledTimes(2);
	});

	it("exposes only the public switches", async () => {
		const { repository, service } = setup();
		repository.row = defaultRow({
			manualGraceDays: 7,
			manualPaymentsEnabled: true,
			paidSubscriptionsEnabled: true,
			signupGrantEnabled: true,
			topupsEnabled: false,
		});

		await expect(service.getPublic()).resolves.toEqual({
			emailAuthEnabled: false,
			manualGraceDays: 7,
			manualPaymentsEnabled: true,
			organizationsEnabled: false,
			paidSubscriptionsEnabled: true,
			signupGrantEnabled: true,
			topupsEnabled: false,
		});
	});
});

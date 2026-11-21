import { ConflictException } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type PatchProductSettingsBody,
	patchProductSettingsBodySchema,
	publicSettingsSchema,
} from "@wandit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/product-settings.constants";
import type {
	ProductSettingsRepository,
	ProductSettingsRow,
	UpdateProductSettingsInput,
} from "../../infrastructure/persistence/product-settings.repository";
import { AdminSettingsController } from "../../presentation/http/controllers/admin-settings.controller";
import { ProductSettingsService } from "./product-settings.service";

const INITIAL_DATE = new Date("2026-08-01T10:00:00.000Z");

function defaultRow(
	overrides: Partial<ProductSettingsRow> = {},
): ProductSettingsRow {
	return {
		...DEFAULT_PRODUCT_SETTINGS,
		// Legacy DB column: still on the row, no longer a product setting.
		earlyAccessRequired: false,
		// Column default; DEFAULT_PRODUCT_SETTINGS leaves it to the database.
		v2DisabledModels: [],
		updatedAt: INITIAL_DATE,
		updatedByUserId: null,
		...overrides,
	};
}

class FakeProductSettingsRepository {
	row: ProductSettingsRow | null = null;

	skippedSignupGrants = 0;

	getOrCreate = vi.fn(async () => {
		this.row ??= defaultRow();
		return this.row;
	});

	countSkippedSignupGrants = vi.fn(async () => this.skippedSignupGrants);

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

		return { grandfatheredPasses: 0, row: this.row };
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
	it("reports the skipped signup-grant rows when the grant is switched on, without granting", async () => {
		const { repository, service } = setup();
		repository.skippedSignupGrants = 12;

		await expect(
			service.update({ signupGrantEnabled: true, version: 1 }, "admin_1"),
		).resolves.toMatchObject({
			signupGrantEnabled: true,
			signupGrantSkippedCount: 12,
		});

		const off = await service.update(
			{ signupGrantEnabled: false, version: 2 },
			"admin_1",
		);
		expect(off).not.toHaveProperty("signupGrantSkippedCount");
	});

	it("drops the removed plan switches from an admin patch", () => {
		expect(
			patchProductSettingsBodySchema.parse({
				manualGraceDays: 3,
				paidSubscriptionsEnabled: true,
				topupsEnabled: true,
				version: 1,
			}),
		).toEqual({ topupsEnabled: true, version: 1 });
		expect(() =>
			patchProductSettingsBodySchema.parse({
				paidSubscriptionsEnabled: true,
				version: 1,
			}),
		).toThrow();
	});

	it.each([
		0.01, 270, 270.12, 10_000,
	])("accepts a DZD per USD rate of %s", (dzdPerUsdRate) => {
		expect(
			patchProductSettingsBodySchema.parse({ dzdPerUsdRate, version: 1 }),
		).toEqual({ dzdPerUsdRate, version: 1 });
	});

	it.each([
		0, -1, 270.123, 10_000.01,
	])("rejects an invalid DZD per USD rate of %s", (dzdPerUsdRate) => {
		expect(() =>
			patchProductSettingsBodySchema.parse({ dzdPerUsdRate, version: 1 }),
		).toThrow();
	});

	it("passes DZD rate changes through and bumps the version", async () => {
		const { repository, service } = setup();

		await expect(
			service.update({ dzdPerUsdRate: 27_125, version: 1 }, "admin_1"),
		).resolves.toMatchObject({
			dzdPerUsdRate: 27_125,
			updatedByUserId: "admin_1",
			version: 2,
		});
		expect(repository.updateIfVersion).toHaveBeenCalledWith({
			changes: { dzdPerUsdRate: 27_125 },
			expectedVersion: 1,
			updatedByUserId: "admin_1",
		});
	});

	it("serves the singleton from cache for 30 seconds and refreshes after expiry", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(INITIAL_DATE);
		const { repository, service } = setup();

		const first = await service.get();
		repository.row = defaultRow({ topupsEnabled: true, version: 2 });

		vi.advanceTimersByTime(29_999);
		await expect(service.get()).resolves.toBe(first);
		expect(repository.getOrCreate).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(2);
		await expect(service.get()).resolves.toMatchObject({
			topupsEnabled: true,
			version: 2,
		});
		expect(repository.getOrCreate).toHaveBeenCalledTimes(2);
	});

	it("passes switch changes through, bumps the version, and invalidates the cache", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(INITIAL_DATE);
		const { repository, service } = setup();
		await service.get();

		const input: PatchProductSettingsBody = {
			manualPaymentsEnabled: true,
			version: 1,
		};
		await expect(service.update(input, "admin_1")).resolves.toMatchObject({
			manualPaymentsEnabled: true,
			updatedByUserId: "admin_1",
			version: 2,
		});
		expect(repository.updateIfVersion).toHaveBeenCalledWith({
			changes: { manualPaymentsEnabled: true },
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
		await service.update({ topupsEnabled: true, version: 1 }, "admin_1");
		resolveRead(staleRow);

		await expect(staleRead).resolves.toMatchObject({ version: 1 });
		await expect(service.get()).resolves.toMatchObject({
			topupsEnabled: true,
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

	it.each([
		{ exposedCredits: 0.5, storedCentiCredits: 50 },
		{ exposedCredits: 7, storedCentiCredits: 700 },
	])("exposes $storedCentiCredits stored centi-credits publicly as $exposedCredits credits, and paid subscriptions as off", async ({
		exposedCredits,
		storedCentiCredits,
	}) => {
		const { repository, service } = setup();
		repository.row = defaultRow({
			lifecycleEmailsEnabled: true,
			manualGraceDays: 7,
			manualPaymentsEnabled: true,
			paidSubscriptionsEnabled: true,
			signupGrantCredits: storedCentiCredits,
			signupGrantEnabled: true,
			starterPassRequired: true,
			topupsEnabled: false,
			userReferralActivationCredits: 2500,
			userReferralFriendCredits: 1500,
			userReferralPaidCredits: 12_000,
			userReferralsEnabled: true,
		});

		const publicSettings = await service.getPublic();
		const expectedPublicSettings = {
			emailAuthEnabled: false,
			manualGraceDays: 7,
			manualPaymentsEnabled: true,
			organizationsEnabled: false,
			paidSubscriptionsEnabled: false,
			signupGrantCredits: exposedCredits,
			signupGrantEnabled: true,
			starterPassRequired: true,
			topupsEnabled: false,
			// The row holds centi-credits. The public answer holds credits.
			userReferralActivationCredits: 25,
			userReferralFriendCredits: 15,
			userReferralPaidCredits: 120,
			userReferralsEnabled: true,
			v2BuilderEnabled: false,
		};

		expect(publicSettings).toEqual(expectedPublicSettings);
		expect(publicSettingsSchema.parse(publicSettings)).toEqual(
			expectedPublicSettings,
		);
		expect(await service.get()).toMatchObject({
			dzdPerUsdRate: 25_000,
			lifecycleEmailsEnabled: true,
		});
	});
});

describe("AdminSettingsController", () => {
	it("stores the user referral amounts as centi-credits and answers in whole credits", async () => {
		const { repository, service } = setup();
		const controller = new AdminSettingsController(service);
		// SAFETY: the controller reads only `id` of the admin.
		const admin = { id: "admin_1" } as AuthUser;

		const response = await controller.update(
			{
				userReferralActivationCredits: 25,
				userReferralFriendCredits: 15,
				userReferralPaidCredits: 120,
				version: 1,
			},
			admin,
		);

		expect(repository.row).toMatchObject({
			userReferralActivationCredits: 2500,
			userReferralFriendCredits: 1500,
			userReferralPaidCredits: 12_000,
		});
		expect(response).toMatchObject({
			userReferralActivationCredits: 25,
			userReferralFriendCredits: 15,
			userReferralPaidCredits: 120,
			version: 2,
		});
	});
});

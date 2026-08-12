import { ForbiddenException } from "@nestjs/common";
import type { ProductSettings } from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProductSettingsService } from "../../../application/services/product-settings.service";
import { SUBSCRIPTIONS_DISABLED_ERROR_CODE } from "../../../domain/errors/subscriptions-disabled.error";
import { TOPUPS_DISABLED_ERROR_CODE } from "../../../domain/errors/topups-disabled.error";
import { SubscriptionsEnabledGuard } from "./subscriptions-enabled.guard";
import { TopupsEnabledGuard } from "./topups-enabled.guard";

function settings(overrides: Partial<ProductSettings> = {}): ProductSettings {
	return {
		emailAuthEnabled: false,
		id: 1,
		organizationsEnabled: false,
		paidSubscriptionsEnabled: false,
		signupGrantCredits: 20,
		signupGrantEnabled: false,
		topupsEnabled: false,
		updatedAt: "2026-08-01T10:00:00.000Z",
		updatedByUserId: null,
		version: 1,
		...overrides,
	};
}

function serviceFor(value: ProductSettings) {
	return {
		get: vi.fn(async () => value),
	} as unknown as ProductSettingsService;
}

describe("product settings admission guards", () => {
	it("allows subscription admissions when paid subscriptions are enabled", async () => {
		const guard = new SubscriptionsEnabledGuard(
			serviceFor(settings({ paidSubscriptionsEnabled: true })),
		);

		await expect(guard.canActivate()).resolves.toBe(true);
	});

	it("rejects subscription admissions with a typed 403", async () => {
		const guard = new SubscriptionsEnabledGuard(serviceFor(settings()));

		expect.assertions(3);
		try {
			await guard.canActivate();
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException);
			expect((error as ForbiddenException).getStatus()).toBe(403);
			expect((error as ForbiddenException).getResponse()).toMatchObject({
				code: SUBSCRIPTIONS_DISABLED_ERROR_CODE,
			});
		}
	});

	it("allows top-up admissions when top-ups are enabled", async () => {
		const guard = new TopupsEnabledGuard(
			serviceFor(settings({ topupsEnabled: true })),
		);

		await expect(guard.canActivate()).resolves.toBe(true);
	});

	it("rejects top-up admissions with a typed 403", async () => {
		const guard = new TopupsEnabledGuard(serviceFor(settings()));

		expect.assertions(3);
		try {
			await guard.canActivate();
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException);
			expect((error as ForbiddenException).getStatus()).toBe(403);
			expect((error as ForbiddenException).getResponse()).toMatchObject({
				code: TOPUPS_DISABLED_ERROR_CODE,
			});
		}
	});
});

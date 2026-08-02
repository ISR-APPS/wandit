import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { ProductSettings } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { ProductSettingsService } from "../../../../settings/application/services/product-settings.service";
import {
	EARLY_ACCESS_REQUIRED_ERROR_CODE,
	EarlyAccessGuard,
} from "./early-access.guard";

function contextFor(user: { earlyAccess?: boolean; role?: string }) {
	return {
		switchToHttp: () => ({
			getRequest: () => ({ user }),
		}),
	} as unknown as ExecutionContext;
}

function settingsService(
	overrides: Partial<ProductSettings> = {},
): ProductSettingsService {
	return {
		get: async () => ({
			earlyAccessRequired: true,
			id: 1,
			paidSubscriptionsEnabled: false,
			signupGrantCredits: 20,
			signupGrantEnabled: false,
			topupsEnabled: false,
			updatedAt: "2026-08-01T10:00:00.000Z",
			updatedByUserId: null,
			version: 1,
			...overrides,
		}),
	} as ProductSettingsService;
}

describe("EarlyAccessGuard", () => {
	const guard = new EarlyAccessGuard(settingsService());

	it("allows a user with the persisted early-access flag", async () => {
		await expect(
			guard.canActivate(contextFor({ earlyAccess: true, role: "user" })),
		).resolves.toBe(true);
	});

	it("allows an admin, including a comma-separated Better Auth role", async () => {
		await expect(
			guard.canActivate(contextFor({ earlyAccess: false, role: "user,admin" })),
		).resolves.toBe(true);
	});

	it("allows every authenticated user when early access is not required", async () => {
		const disabledGuard = new EarlyAccessGuard(
			settingsService({ earlyAccessRequired: false }),
		);

		await expect(
			disabledGuard.canActivate(
				contextFor({ earlyAccess: false, role: "user" }),
			),
		).resolves.toBe(true);
	});

	it("rejects a regular user with a typed 403", async () => {
		expect.assertions(3);

		try {
			await guard.canActivate(contextFor({ earlyAccess: false, role: "user" }));
		} catch (error) {
			expect(error).toBeInstanceOf(ForbiddenException);
			expect((error as ForbiddenException).getStatus()).toBe(403);
			expect((error as ForbiddenException).getResponse()).toMatchObject({
				code: EARLY_ACCESS_REQUIRED_ERROR_CODE,
				message: "Early access is required",
			});
		}
	});
});

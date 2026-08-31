import { RequestMethod } from "@nestjs/common";
import {
	GUARDS_METADATA,
	METHOD_METADATA,
	PATH_METADATA,
} from "@nestjs/common/constants";
import { adminRoleHasPermission } from "@wandit/auth/admin-permissions";
import { describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSION_KEY } from "../../../../admin/presentation/http/decorators/admin-permission.decorator";
import { AdminGuard } from "../../../../admin/presentation/http/guards/admin.guard";
import type { ProductSettingsService } from "../../../../settings";
import type { ManualSubscriptionsService } from "../../../application/services/manual-subscriptions.service";
import { AdminManualBillingController } from "./admin-manual-billing.controller";

function setup() {
	const manualSubscriptionsService = {};
	const productSettingsService = {
		get: vi.fn().mockResolvedValue({ dzdPerUsdRate: 27_125 }),
	};
	const controller = new AdminManualBillingController(
		manualSubscriptionsService as ManualSubscriptionsService,
		productSettingsService as unknown as ProductSettingsService,
	);

	return { controller, productSettingsService };
}

describe("AdminManualBillingController receipt config", () => {
	it("exposes an admin-only GET route with billing read permission", () => {
		const handler = AdminManualBillingController.prototype.receiptConfig;

		expect(
			Reflect.getMetadata(PATH_METADATA, AdminManualBillingController),
		).toBe("v1/admin");
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AdminManualBillingController),
		).toEqual([AdminGuard]);
		const permission = Reflect.getMetadata(
			ADMIN_PERMISSION_KEY,
			AdminManualBillingController,
		);

		expect(permission).toEqual({ billing: ["read"] });
		expect(adminRoleHasPermission("support", permission)).toBe(true);
		expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
			RequestMethod.GET,
		);
		expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
			"manual-billing/receipt-config",
		);
	});

	it("reads the cached product settings and converts the stored rate", async () => {
		const { controller, productSettingsService } = setup();

		await expect(controller.receiptConfig()).resolves.toEqual({
			dzdPerUsdRate: 271.25,
		});
		expect(productSettingsService.get).toHaveBeenCalledOnce();
	});
});

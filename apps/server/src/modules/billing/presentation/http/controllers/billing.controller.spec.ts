import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { TopupsEnabledGuard } from "../../../../settings";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { WebOriginWriteGuard } from "../guards/web-origin-write.guard";
import { BillingController } from "./billing.controller";

describe("BillingController money guards", () => {
	it("starts a top-up only with the top-up switch and the web origin check", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, BillingController.prototype.topup),
		).toEqual([TopupsEnabledGuard, WebOriginWriteGuard]);
	});

	it.each([
		"topup",
		"payments",
		"portal",
	] as const)("lets only the billing manager call %s", (method) => {
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				BillingController.prototype[method],
			),
		).toEqual({ actions: ["manage"], resource: "billing" });
	});
});

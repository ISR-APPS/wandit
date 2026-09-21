import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { VersionsController } from "./versions.controller";

describe("VersionsController", () => {
	it("sits behind the V2BuilderEnabledGuard", () => {
		const guards = Reflect.getMetadata(GUARDS_METADATA, VersionsController);
		// SAFETY: the metadata is the array UseGuards registered.
		expect(guards as unknown[]).toContain(V2BuilderEnabledGuard);
	});

	it("requires project:update on restore only", () => {
		const restorePermission = Reflect.getMetadata(
			WORKSPACE_PERMISSION_KEY,
			VersionsController.prototype.restore,
		);
		expect(restorePermission).toEqual({
			actions: ["update"],
			resource: "project",
		});

		// List and diff are reads; scope filtering happens in the service.
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				VersionsController.prototype.list,
			),
		).toBeUndefined();
		expect(
			Reflect.getMetadata(
				WORKSPACE_PERMISSION_KEY,
				VersionsController.prototype.diff,
			),
		).toBeUndefined();
	});
});

import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { VersionsController } from "./versions.controller";

describe("VersionsController", () => {
	it("sits behind the V2BuilderEnabledGuard", () => {
		const guards = Reflect.getMetadata(GUARDS_METADATA, VersionsController);
		// SAFETY: the metadata is the array UseGuards registered.
		expect(guards as unknown[]).toContain(V2BuilderEnabledGuard);
	});

	it("needs the editor role on restore and the viewer role on the reads", () => {
		for (const [handler, role] of [
			[VersionsController.prototype.restore, "editor"],
			[VersionsController.prototype.list, "viewer"],
			[VersionsController.prototype.diff, "viewer"],
		] as const) {
			expect(Reflect.getMetadata(PROJECT_ROLE_KEY, handler)).toEqual({
				anyEngine: false,
				role,
			});
		}
	});
});

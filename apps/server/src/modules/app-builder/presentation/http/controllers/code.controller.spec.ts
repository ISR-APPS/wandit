import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { CodeController } from "./code.controller";

describe("CodeController", () => {
	it("sits behind the V2BuilderEnabledGuard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, CodeController)).toContain(
			V2BuilderEnabledGuard,
		);
	});

	it("needs no workspace permission: any member reads, like GET /projects/:id", () => {
		for (const route of [
			CodeController.prototype.snapshot,
			CodeController.prototype.file,
		]) {
			expect(
				Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, route),
			).toBeUndefined();
		}
	});
});

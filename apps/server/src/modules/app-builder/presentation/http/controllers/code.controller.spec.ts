import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import { V2BuilderEnabledGuard } from "../guards/v2-builder-enabled.guard";
import { CodeController } from "./code.controller";

describe("CodeController", () => {
	it("sits behind the V2BuilderEnabledGuard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, CodeController)).toContain(
			V2BuilderEnabledGuard,
		);
	});

	it("opens both reads to a project viewer", () => {
		for (const route of [
			CodeController.prototype.snapshot,
			CodeController.prototype.file,
		]) {
			expect(Reflect.getMetadata(PROJECT_ROLE_KEY, route)).toEqual({
				anyEngine: false,
				role: "viewer",
			});
		}
	});
});
